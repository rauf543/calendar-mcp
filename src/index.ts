#!/usr/bin/env node
/**
 * Calendar MCP Server
 * Main entry point for the Model Context Protocol server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { loadConfig, getConfig } from './utils/config.js';
import { CalendarMCPError, formatErrorForMCP, ErrorCodes } from './utils/error.js';
import { ProviderRegistry } from './providers/index.js';
import { GoogleCalendarProvider } from './providers/google/index.js';
import { MicrosoftCalendarProvider } from './providers/microsoft/index.js';
import { ExchangeCalendarProvider } from './providers/exchange/index.js';
import { CalendarService, getCalendarService } from './services/calendar-service.js';
import { FreeBusyService, getFreeBusyService } from './services/free-busy-service.js';
import { ConflictService, getConflictService } from './services/conflict-service.js';
import { getSyncService } from './services/sync-service.js';
import { toolDefinitions, createToolHandlers } from './tools/index.js';
import { resourceDefinitions, createResourceHandlers, createDynamicResourceHandler } from './resources/index.js';
import { promptDefinitions, createPromptHandlers } from './prompts/index.js';

const SERVER_NAME = 'calendar-mcp';
const SERVER_VERSION = '1.0.0';

/**
 * Initialize and connect providers based on configuration
 */
async function initializeProviders(registry: ProviderRegistry): Promise<void> {
  const config = getConfig();

  for (const providerConfig of config.providers) {
    try {
      if (providerConfig.type === 'google') {
        console.error('[calendar-mcp] Initializing Google Calendar provider...');
        const googleConfig = providerConfig as import('./types/index.js').GoogleProviderConfig;

        const googleProvider = new GoogleCalendarProvider(googleConfig);

        await googleProvider.connect();
        registry.register(googleProvider);
        console.error('[calendar-mcp] Google Calendar provider connected');
      } else if (providerConfig.type === 'microsoft') {
        console.error('[calendar-mcp] Initializing Microsoft 365 provider...');
        const microsoftConfig = providerConfig as import('./types/index.js').MicrosoftProviderConfig;

        const microsoftProvider = new MicrosoftCalendarProvider(microsoftConfig);

        await microsoftProvider.connect();
        registry.register(microsoftProvider);
        console.error('[calendar-mcp] Microsoft 365 provider connected');
      } else if (providerConfig.type === 'exchange') {
        console.error('[calendar-mcp] Initializing Exchange provider...');
        const exchangeConfig = providerConfig as import('./types/index.js').ExchangeProviderConfig;

        const exchangeProvider = new ExchangeCalendarProvider(exchangeConfig);

        await exchangeProvider.connect();
        registry.register(exchangeProvider);
        console.error('[calendar-mcp] Exchange provider connected');
      }
    } catch (error) {
      console.error(`[calendar-mcp] Failed to initialize ${providerConfig.type} provider:`, error);
    }
  }

  const connected = registry.getConnected();
  console.error(`[calendar-mcp] ${connected.length} provider(s) connected`);

  if (connected.length === 0) {
    console.error('[calendar-mcp] Warning: No providers connected. Check your configuration.');
  }
}

/**
 * Create and configure the MCP server
 */
async function createServer(): Promise<Server> {
  // Load configuration
  loadConfig();
  const config = getConfig();

  // Create provider registry
  const registry = new ProviderRegistry();

  // Initialize providers
  await initializeProviders(registry);

  // Create services
  const calendarService = getCalendarService(registry);
  const freeBusyService = getFreeBusyService(registry);
  const conflictService = getConflictService(calendarService, freeBusyService);
  const syncService = getSyncService(calendarService);

  // Create tool handlers
  const toolHandlers = createToolHandlers(
    calendarService,
    freeBusyService,
    conflictService,
    syncService
  );

  // Create resource handlers
  const resourceHandlers = createResourceHandlers(calendarService, freeBusyService);
  const dynamicResourceHandler = createDynamicResourceHandler(calendarService);

  // Create prompt handlers
  const promptHandlers = createPromptHandlers();

  // Create MCP server
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: toolDefinitions.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const handler = toolHandlers[name];
    if (!handler) {
      return {
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${name}. Available tools: ${Object.keys(toolHandlers).join(', ')}`,
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await handler(args ?? {});
      return result;
    } catch (error) {
      console.error(`[calendar-mcp] Error executing tool ${name}:`, error);

      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
        return {
          content: [
            {
              type: 'text',
              text: `Validation error: ${issues}`,
            },
          ],
          isError: true,
        };
      }

      // Handle CalendarMCPError
      if (error instanceof CalendarMCPError) {
        return {
          content: [
            {
              type: 'text',
              text: formatErrorForMCP(error),
            },
          ],
          isError: true,
        };
      }

      // Handle generic errors
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Register resource list handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: resourceDefinitions.map(resource => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
      })),
    };
  });

  // Register resource read handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    // Try static handlers first
    const handler = resourceHandlers[uri];
    if (handler) {
      return handler();
    }

    // Try dynamic handler (e.g., calendar://next/10)
    const dynamicResult = await dynamicResourceHandler(uri);
    if (dynamicResult) {
      return dynamicResult;
    }

    return {
      contents: [{
        uri,
        mimeType: 'text/plain',
        text: `Unknown resource: ${uri}`,
      }],
    };
  });

  // Register prompt list handler
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: promptDefinitions.map(prompt => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments,
      })),
    };
  });

  // Register prompt get handler
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const handler = promptHandlers[name];
    if (!handler) {
      return {
        description: 'Unknown prompt',
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Unknown prompt: ${name}. Available prompts: ${Object.keys(promptHandlers).join(', ')}`,
          },
        }],
      };
    }

    return handler(args ?? {});
  });

  return server;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.error('[calendar-mcp] Starting Calendar MCP server...');

  try {
    const server = await createServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);
    console.error('[calendar-mcp] Server running on stdio transport');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.error('[calendar-mcp] Shutting down...');
      await server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.error('[calendar-mcp] Shutting down...');
      await server.close();
      process.exit(0);
    });
  } catch (error) {
    console.error('[calendar-mcp] Failed to start server:', error);
    process.exit(1);
  }
}

// Run the server
main().catch((error) => {
  console.error('[calendar-mcp] Fatal error:', error);
  process.exit(1);
});
