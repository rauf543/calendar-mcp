/**
 * Vercel MCP API Route
 * Exposes the Calendar MCP server via Vercel's serverless functions
 */

import { createMcpHandler } from '@vercel/mcp-adapter';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { CalendarService } from '../src/services/calendar-service.js';
import { FreeBusyService } from '../src/services/free-busy-service.js';
import { ConflictService } from '../src/services/conflict-service.js';
import { SyncService } from '../src/services/sync-service.js';
import { ProviderRegistry, getRegistry } from '../src/providers/index.js';
import { loadConfig } from '../src/utils/config.js';

// Import provider classes for manual registration
import { GoogleCalendarProvider } from '../src/providers/google/index.js';
import { MicrosoftCalendarProvider } from '../src/providers/microsoft/index.js';
import { ExchangeCalendarProvider } from '../src/providers/exchange/index.js';
import type { GoogleProviderConfig, MicrosoftProviderConfig, ExchangeProviderConfig } from '../src/types/index.js';

import {
  ListCalendarsInputSchema,
  ListEventsInputSchema,
  GetEventInputSchema,
  CreateEventInputSchema,
  UpdateEventInputSchema,
  DeleteEventInputSchema,
  GetFreeBusyInputSchema,
  CheckConflictsInputSchema,
  RespondToInviteInputSchema,
} from '../src/schemas/tool-inputs.js';

import {
  executeListCalendars,
  formatListCalendarsResult,
} from '../src/tools/list-calendars.js';
import {
  executeListEvents,
  formatListEventsResult,
} from '../src/tools/list-events.js';
import {
  executeGetEvent,
  formatGetEventResult,
} from '../src/tools/get-event.js';
import {
  executeCreateEvent,
  formatCreateEventResult,
} from '../src/tools/create-event.js';
import {
  executeUpdateEvent,
  formatUpdateEventResult,
} from '../src/tools/update-event.js';
import {
  executeDeleteEvent,
  formatDeleteEventResult,
} from '../src/tools/delete-event.js';
import {
  executeGetFreeBusy,
  formatFreeBusyResult,
} from '../src/tools/get-free-busy.js';
import {
  executeCheckConflicts,
  formatCheckConflictsResult,
} from '../src/tools/check-conflicts.js';
import {
  executeRespondToInvite,
  formatRespondToInviteResult,
} from '../src/tools/respond-to-invite.js';
import {
  createFindMatchingEventsHandler,
} from '../src/tools/find-matching-events.js';
import {
  createCopyEventHandler,
} from '../src/tools/copy-event.js';
import {
  createCompareCalendarsHandler,
} from '../src/tools/compare-calendars.js';

// Service types for memoization
interface Services {
  registry: ProviderRegistry;
  calendarService: CalendarService;
  freeBusyService: FreeBusyService;
  conflictService: ConflictService;
  syncService: SyncService;
}

// Use promise memoization to prevent race conditions in serverless environment
// The promise is assigned synchronously, so concurrent requests share the same initialization
let servicesPromise: Promise<Services> | null = null;

function getServices(): Promise<Services> {
  if (!servicesPromise) {
    servicesPromise = (async () => {
      const config = loadConfig();
      console.log('[MCP] Config loaded - timezone:', config.defaults.timezone);
      const registry = getRegistry();

      // Manually create and register providers (same pattern as src/index.ts)
      for (const providerConfig of config.providers) {
        if (!providerConfig.enabled) continue;

        try {
          if (providerConfig.type === 'google') {
            const googleProvider = new GoogleCalendarProvider(providerConfig as GoogleProviderConfig);
            await googleProvider.connect();
            registry.register(googleProvider);
          } else if (providerConfig.type === 'microsoft') {
            const microsoftProvider = new MicrosoftCalendarProvider(providerConfig as MicrosoftProviderConfig);
            await microsoftProvider.connect();
            registry.register(microsoftProvider);
          } else if (providerConfig.type === 'exchange') {
            const exchangeProvider = new ExchangeCalendarProvider(providerConfig as ExchangeProviderConfig);
            await exchangeProvider.connect();
            registry.register(exchangeProvider);
          }
          console.log(`[MCP] Registered provider: ${providerConfig.id} (${providerConfig.type})`);
        } catch (error) {
          console.error(`[MCP] Failed to initialize provider ${providerConfig.id}:`, error);
        }
      }

      const calendarService = new CalendarService(registry);
      const freeBusyService = new FreeBusyService(registry);
      const conflictService = new ConflictService(calendarService, freeBusyService);
      const syncService = new SyncService(calendarService);

      return { registry, calendarService, freeBusyService, conflictService, syncService };
    })();
  }
  return servicesPromise;
}

// Create the MCP handler with all tools
const handler = createMcpHandler(
  (server: McpServer) => {
    // List Calendars
    server.tool(
      'list_calendars',
      'List all available calendars across all connected providers. Returns calendar ID, name, color, and access permissions.',
      {
        provider: z.enum(['all', 'google', 'microsoft', 'exchange']).default('all').describe('Filter by provider type, or "all" for all providers'),
      },
      async (args: Record<string, unknown>) => {
        const services = await getServices();
        const input = ListCalendarsInputSchema.parse(args);
        const result = await executeListCalendars(input, services.calendarService);
        return { content: [{ type: 'text' as const, text: formatListCalendarsResult(result) }] };
      }
    );

    // List Events
    server.tool(
      'list_events',
      'List calendar events within a time range. Supports filtering by provider, calendar, and search query. Returns events sorted by start time.',
      {
        startTime: z.string().describe('Start of time range (ISO 8601)'),
        endTime: z.string().describe('End of time range (ISO 8601)'),
        providers: z.array(z.enum(['google', 'microsoft', 'exchange'])).optional().describe('Filter to specific providers'),
        calendarIds: z.array(z.string()).optional().describe('Filter to specific calendar IDs'),
        searchQuery: z.string().optional().describe('Text search in subject/body'),
        maxResults: z.number().min(1).max(500).default(100).describe('Maximum number of results'),
        orderBy: z.enum(['start', 'updated']).default('start').describe('Sort order'),
        expandRecurring: z.boolean().default(true).describe('Whether to expand recurring events into instances'),
      },
      async (args: Record<string, unknown>) => {
        const services = await getServices();
        const input = ListEventsInputSchema.parse(args);
        const result = await executeListEvents(input, services.calendarService);
        return { content: [{ type: 'text' as const, text: formatListEventsResult(result) }] };
      }
    );

    // Get Event
    server.tool(
      'get_event',
      'Get detailed information about a specific event by ID. Returns full event details including attendees, recurrence, and online meeting links.',
      {
        eventId: z.string().min(1).describe('Event ID'),
        provider: z.enum(['google', 'microsoft', 'exchange']).describe('Which provider the event belongs to'),
        calendarId: z.string().optional().describe('Calendar ID (required for some providers)'),
      },
      async (args: Record<string, unknown>) => {
        const services = await getServices();
        const input = GetEventInputSchema.parse(args);
        const result = await executeGetEvent(input, services.calendarService);
        return { content: [{ type: 'text' as const, text: formatGetEventResult(result) }] };
      }
    );

    // Create Event
    server.tool(
      'create_event',
      'Create a new calendar event. Supports attendees, recurrence, online meetings (Teams/Meet), and custom reminders.',
      {
        provider: z.enum(['google', 'microsoft', 'exchange']).describe('Which provider to create the event on'),
        subject: z.string().min(1).max(500).describe('Event title/subject'),
        startTime: z.string().describe('Start time (ISO 8601)'),
        endTime: z.string().describe('End time (ISO 8601)'),
        calendarId: z.string().optional().describe('Calendar ID (default: primary)'),
        body: z.string().max(10000).optional().describe('Event description/body'),
        bodyType: z.enum(['text', 'html']).default('text').describe('Body content type'),
        location: z.string().max(500).optional().describe('Physical location'),
        attendees: z.array(z.object({
          email: z.string().email(),
          type: z.enum(['required', 'optional', 'resource']).default('required'),
        })).optional().describe('Event attendees'),
        isAllDay: z.boolean().default(false).describe('Whether this is an all-day event'),
        reminderMinutes: z.number().min(0).max(40320).optional().describe('Reminder in minutes before event'),
        createOnlineMeeting: z.boolean().default(false).describe('Whether to create an online meeting'),
        onlineMeetingProvider: z.enum(['teams', 'meet']).optional().describe('Online meeting provider preference'),
        sensitivity: z.enum(['normal', 'personal', 'private', 'confidential']).default('normal').describe('Event sensitivity'),
        showAs: z.enum(['free', 'busy', 'tentative', 'oof', 'workingElsewhere']).default('busy').describe('How to show the time'),
        timezone: z.string().optional().describe('Timezone (IANA format, default: user timezone)'),
      },
      async (args: Record<string, unknown>) => {
        const services = await getServices();
        const input = CreateEventInputSchema.parse(args);
        const result = await executeCreateEvent(input, services.calendarService);
        return { content: [{ type: 'text' as const, text: formatCreateEventResult(result) }] };
      }
    );

    // Update Event
    server.tool(
      'update_event',
      'Update an existing calendar event. For recurring events, can update single instance, this and future, or all instances.',
      {
        eventId: z.string().min(1).describe('Event ID'),
        provider: z.enum(['google', 'microsoft', 'exchange']).describe('Which provider the event belongs to'),
        calendarId: z.string().optional().describe('Calendar ID'),
        subject: z.string().min(1).max(500).optional().describe('New event title'),
        startTime: z.string().optional().describe('New start time'),
        endTime: z.string().optional().describe('New end time'),
        body: z.string().max(10000).optional().describe('New event body'),
        bodyType: z.enum(['text', 'html']).optional().describe('Body content type'),
        location: z.string().max(500).optional().describe('New location'),
        attendees: z.array(z.object({
          email: z.string().email(),
          type: z.enum(['required', 'optional', 'resource']).default('required'),
        })).optional().describe('Updated attendees'),
        sensitivity: z.enum(['normal', 'personal', 'private', 'confidential']).optional().describe('New sensitivity'),
        showAs: z.enum(['free', 'busy', 'tentative', 'oof', 'workingElsewhere']).optional().describe('New show-as status'),
        timezone: z.string().optional().describe('New timezone'),
        updateScope: z.enum(['single', 'thisAndFuture', 'all']).default('single').describe('For recurring events: what to update'),
        sendUpdates: z.boolean().default(true).describe('Whether to send updates to attendees'),
      },
      async (args: Record<string, unknown>) => {
        const services = await getServices();
        const input = UpdateEventInputSchema.parse(args);
        const result = await executeUpdateEvent(input, services.calendarService);
        return { content: [{ type: 'text' as const, text: formatUpdateEventResult(result) }] };
      }
    );

    // Delete Event
    server.tool(
      'delete_event',
      'Delete a calendar event. For recurring events, can delete single instance, this and future, or entire series.',
      {
        eventId: z.string().min(1).describe('Event ID'),
        provider: z.enum(['google', 'microsoft', 'exchange']).describe('Which provider the event belongs to'),
        calendarId: z.string().optional().describe('Calendar ID'),
        deleteScope: z.enum(['single', 'thisAndFuture', 'all']).default('single').describe('For recurring events: what to delete'),
        sendCancellation: z.boolean().optional().describe('Whether to send cancellation notices (default: true if has attendees)'),
      },
      async (args: Record<string, unknown>) => {
        const services = await getServices();
        const input = DeleteEventInputSchema.parse(args);
        const result = await executeDeleteEvent(input, services.calendarService);
        return { content: [{ type: 'text' as const, text: formatDeleteEventResult(result) }] };
      }
    );

    // Get Free/Busy
    server.tool(
      'get_free_busy',
      'Get aggregated availability across all calendars. Returns busy times, free slots, and optionally suggests meeting times of requested duration.',
      {
        startTime: z.string().describe('Start of time range (ISO 8601)'),
        endTime: z.string().describe('End of time range (ISO 8601)'),
        providers: z.array(z.enum(['google', 'microsoft', 'exchange'])).optional().describe('Filter to specific providers'),
        calendarIds: z.array(z.string()).optional().describe('Filter to specific calendar IDs'),
        slotDuration: z.number().positive().optional().describe('Minimum slot duration in minutes (for finding free slots)'),
        workingHoursOnly: z.boolean().default(false).describe('Only consider working hours'),
        workingHours: z.object({
          start: z.string().regex(/^\d{2}:\d{2}$/),
          end: z.string().regex(/^\d{2}:\d{2}$/),
          days: z.array(z.string()),
        }).optional().describe('Custom working hours configuration'),
      },
      async (args: Record<string, unknown>) => {
        const services = await getServices();
        const input = GetFreeBusyInputSchema.parse(args);
        const result = await executeGetFreeBusy(input, services.freeBusyService);
        return { content: [{ type: 'text' as const, text: formatFreeBusyResult(result) }] };
      }
    );

    // Check Conflicts
    server.tool(
      'check_conflicts',
      'Check if a proposed time slot conflicts with existing events. Returns conflicting events and suggests alternative times.',
      {
        startTime: z.string().describe('Proposed start time (ISO 8601)'),
        endTime: z.string().describe('Proposed end time (ISO 8601)'),
        excludeEventId: z.string().optional().describe('Event ID to exclude (for rescheduling)'),
        excludeProvider: z.enum(['google', 'microsoft', 'exchange']).optional().describe('Provider of excluded event'),
      },
      async (args: Record<string, unknown>) => {
        const services = await getServices();
        const input = CheckConflictsInputSchema.parse(args);
        const result = await executeCheckConflicts(input, services.conflictService);
        return { content: [{ type: 'text' as const, text: formatCheckConflictsResult(result) }] };
      }
    );

    // Respond to Invite
    server.tool(
      'respond_to_invite',
      'Respond to a meeting invitation (accept, decline, or tentative). Optionally include a response message.',
      {
        eventId: z.string().min(1).describe('Event ID'),
        provider: z.enum(['google', 'microsoft', 'exchange']).describe('Which provider the event belongs to'),
        response: z.enum(['accepted', 'declined', 'tentative']).describe('Response: accepted, declined, or tentative'),
        calendarId: z.string().optional().describe('Calendar ID'),
        message: z.string().max(1000).optional().describe('Optional response message'),
      },
      async (args: Record<string, unknown>) => {
        const services = await getServices();
        const input = RespondToInviteInputSchema.parse(args);
        const result = await executeRespondToInvite(input, services.calendarService);
        return { content: [{ type: 'text' as const, text: formatRespondToInviteResult(result) }] };
      }
    );

    // Find Matching Events
    server.tool(
      'find_matching_events',
      'Find matching events between two calendars or providers. Useful for identifying duplicates or corresponding events across different calendar systems.',
      {
        source_provider: z.enum(['google', 'microsoft', 'exchange']).describe('Source calendar provider'),
        target_provider: z.enum(['google', 'microsoft', 'exchange']).describe('Target calendar provider'),
        start_time: z.string().describe('Start of time range (ISO 8601)'),
        end_time: z.string().describe('End of time range (ISO 8601)'),
        source_calendar_id: z.string().optional().describe('Source calendar ID (defaults to primary)'),
        target_calendar_id: z.string().optional().describe('Target calendar ID (defaults to primary)'),
        min_confidence: z.enum(['high', 'medium', 'low']).optional().describe('Minimum match confidence (default: low)'),
      },
      async (args: Record<string, unknown>) => {
        const services = await getServices();
        const handler = createFindMatchingEventsHandler(services.syncService);
        return handler(args);
      }
    );

    // Copy Event
    server.tool(
      'copy_event',
      'Copy an event from one calendar/provider to another. Useful for manually syncing individual events between different calendar systems.',
      {
        source_event_id: z.string().describe('ID of the event to copy'),
        source_provider: z.enum(['google', 'microsoft', 'exchange']).describe('Source calendar provider'),
        target_provider: z.enum(['google', 'microsoft', 'exchange']).describe('Target calendar provider'),
        source_calendar_id: z.string().optional().describe('Source calendar ID'),
        target_calendar_id: z.string().optional().describe('Target calendar ID'),
        include_attendees: z.boolean().optional().describe('Include attendees in copy (default: false)'),
        include_body: z.boolean().optional().describe('Include event body/description (default: true)'),
      },
      async (args: Record<string, unknown>) => {
        const services = await getServices();
        const handler = createCopyEventHandler(services.syncService);
        return handler(args);
      }
    );

    // Compare Calendars
    server.tool(
      'compare_calendars',
      'Compare two calendars to find matching events, events only in source, and events only in target. Useful for understanding synchronization status between calendar systems.',
      {
        source_provider: z.enum(['google', 'microsoft', 'exchange']).describe('Source calendar provider'),
        target_provider: z.enum(['google', 'microsoft', 'exchange']).describe('Target calendar provider'),
        start_time: z.string().describe('Start of time range to compare (ISO 8601)'),
        end_time: z.string().describe('End of time range to compare (ISO 8601)'),
        source_calendar_id: z.string().optional().describe('Source calendar ID (defaults to primary)'),
        target_calendar_id: z.string().optional().describe('Target calendar ID (defaults to primary)'),
      },
      async (args: Record<string, unknown>) => {
        const services = await getServices();
        const handler = createCompareCalendarsHandler(services.syncService);
        return handler(args);
      }
    );
  },
  {
    capabilities: {
      tools: {},
    },
  },
  {
    // Set basePath to '/api' so endpoints become:
    // - /api/mcp (streamable HTTP)
    // - /api/sse (SSE transport)
    // - /api/message (SSE messages)
    basePath: '/api',
    maxDuration: 60,
    verboseLogs: true,
  }
);

// Use Node.js runtime (required for EWS and other Node.js dependencies)
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 60,
};

export default async function (req: VercelRequest, res: VercelResponse) {
  console.log('[MCP] Request received:', req.method, req.url);

  // Health check endpoint
  if (req.url === '/api/mcp/health' || req.query?.health === 'true') {
    console.log('[MCP] Health check response');
    return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  }

  // Convert Vercel req to Web Request
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const url = `${protocol}://${host}${req.url}`;

  console.log('[MCP] Constructed URL:', url);

  // Convert Node.js headers to Web API headers
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach(v => headers.append(key, v));
      } else {
        headers.set(key, value);
      }
    }
  }

  const webRequest = new Request(url, {
    method: req.method,
    headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
  });

  try {
    console.log('[MCP] Calling handler...');
    // Call the MCP handler
    const webResponse = await handler(webRequest);

    console.log('[MCP] Handler returned status:', webResponse.status);

    // Convert Web Response to Vercel res
    res.status(webResponse.status);

    // Copy headers
    webResponse.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Send body
    const body = await webResponse.text();
    console.log('[MCP] Response body length:', body.length);
    return res.send(body);
  } catch (error) {
    console.error('[MCP] Handler error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}
