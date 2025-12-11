/**
 * MCP Tool Registry
 * Exports all tool implementations and registration function
 */

// Tool implementations
export * from './list-calendars.js';
export * from './list-events.js';
export * from './get-event.js';
export * from './create-event.js';
export * from './update-event.js';
export * from './delete-event.js';
export * from './get-free-busy.js';
export * from './check-conflicts.js';
export * from './respond-to-invite.js';
export * from './find-matching-events.js';
export * from './copy-event.js';
export * from './compare-calendars.js';

// Re-export schemas for convenience
export {
  ListCalendarsInputSchema,
  ListEventsInputSchema,
  GetEventInputSchema,
  CreateEventInputSchema,
  UpdateEventInputSchema,
  DeleteEventInputSchema,
  GetFreeBusyInputSchema,
  CheckConflictsInputSchema,
  RespondToInviteInputSchema,
} from '../schemas/tool-inputs.js';

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { CalendarService } from '../services/calendar-service.js';
import type { FreeBusyService } from '../services/free-busy-service.js';
import type { ConflictService } from '../services/conflict-service.js';
import type { SyncService } from '../services/sync-service.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

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
} from '../schemas/tool-inputs.js';

import {
  executeListCalendars,
  formatListCalendarsResult,
} from './list-calendars.js';
import {
  executeListEvents,
  formatListEventsResult,
} from './list-events.js';
import {
  executeGetEvent,
  formatGetEventResult,
} from './get-event.js';
import {
  executeCreateEvent,
  formatCreateEventResult,
} from './create-event.js';
import {
  executeUpdateEvent,
  formatUpdateEventResult,
} from './update-event.js';
import {
  executeDeleteEvent,
  formatDeleteEventResult,
} from './delete-event.js';
import {
  executeGetFreeBusy,
  formatFreeBusyResult,
} from './get-free-busy.js';
import {
  executeCheckConflicts,
  formatCheckConflictsResult,
} from './check-conflicts.js';
import {
  executeRespondToInvite,
  formatRespondToInviteResult,
} from './respond-to-invite.js';
import {
  findMatchingEventsSchema,
  createFindMatchingEventsHandler,
  findMatchingEventsDefinition,
} from './find-matching-events.js';
import {
  copyEventSchema,
  createCopyEventHandler,
  copyEventDefinition,
} from './copy-event.js';
import {
  compareCalendarsSchema,
  createCompareCalendarsHandler,
  compareCalendarsDefinition,
} from './compare-calendars.js';

import { CalendarMCPError, formatErrorForMCP } from '../utils/error.js';

/**
 * Tool definitions for MCP registration
 */
export const toolDefinitions = [
  {
    name: 'list_calendars',
    description: 'List all available calendars across all connected providers. Returns calendar ID, name, color, and access permissions.',
    inputSchema: zodToJsonSchema(ListCalendarsInputSchema),
  },
  {
    name: 'list_events',
    description: 'List calendar events within a time range. Supports filtering by provider, calendar, and search query. Returns events sorted by start time.',
    inputSchema: zodToJsonSchema(ListEventsInputSchema),
  },
  {
    name: 'get_event',
    description: 'Get detailed information about a specific event by ID. Returns full event details including attendees, recurrence, and online meeting links.',
    inputSchema: zodToJsonSchema(GetEventInputSchema),
  },
  {
    name: 'create_event',
    description: 'Create a new calendar event. Supports attendees, recurrence, online meetings (Teams/Meet), and custom reminders. IMPORTANT: If the user has more than one calendar connected, ALWAYS ask which calendar to create the event on - never assume.',
    inputSchema: zodToJsonSchema(CreateEventInputSchema),
  },
  {
    name: 'update_event',
    description: 'Update an existing calendar event. For recurring events, can update single instance, this and future, or all instances.',
    inputSchema: zodToJsonSchema(UpdateEventInputSchema),
  },
  {
    name: 'delete_event',
    description: 'Delete a calendar event. For recurring events, can delete single instance, this and future, or entire series.',
    inputSchema: zodToJsonSchema(DeleteEventInputSchema),
  },
  {
    name: 'get_free_busy',
    description: 'Get aggregated availability across all calendars. Returns busy times, free slots, and optionally suggests meeting times of requested duration.',
    inputSchema: zodToJsonSchema(GetFreeBusyInputSchema),
  },
  {
    name: 'check_conflicts',
    description: 'Check if a proposed time slot conflicts with existing events. Returns conflicting events and suggests alternative times.',
    inputSchema: zodToJsonSchema(CheckConflictsInputSchema),
  },
  {
    name: 'respond_to_invite',
    description: 'Respond to a meeting invitation (accept, decline, or tentative). Optionally include a response message.',
    inputSchema: zodToJsonSchema(RespondToInviteInputSchema),
  },
  {
    name: 'find_matching_events',
    description: findMatchingEventsDefinition.description,
    inputSchema: zodToJsonSchema(findMatchingEventsSchema),
  },
  {
    name: 'copy_event',
    description: copyEventDefinition.description,
    inputSchema: zodToJsonSchema(copyEventSchema),
  },
  {
    name: 'compare_calendars',
    description: compareCalendarsDefinition.description,
    inputSchema: zodToJsonSchema(compareCalendarsSchema),
  },
];

/**
 * Tool handler function type
 */
export type ToolHandler = (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>;

/**
 * Create tool handlers with injected services
 */
export function createToolHandlers(
  calendarService: CalendarService,
  freeBusyService: FreeBusyService,
  conflictService: ConflictService,
  syncService?: SyncService
): Record<string, ToolHandler> {
  const wrapHandler = (handler: () => Promise<string>): ToolHandler => {
    return async () => {
      try {
        const text = await handler();
        return { content: [{ type: 'text', text }] };
      } catch (error) {
        const errorMessage = error instanceof CalendarMCPError
          ? formatErrorForMCP(error)
          : `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        return { content: [{ type: 'text', text: errorMessage }] };
      }
    };
  };

  return {
    list_calendars: async (args) => {
      const input = ListCalendarsInputSchema.parse(args);
      const result = await executeListCalendars(input, calendarService);
      return { content: [{ type: 'text', text: formatListCalendarsResult(result) }] };
    },

    list_events: async (args) => {
      const input = ListEventsInputSchema.parse(args);
      const result = await executeListEvents(input, calendarService);
      return { content: [{ type: 'text', text: formatListEventsResult(result) }] };
    },

    get_event: async (args) => {
      const input = GetEventInputSchema.parse(args);
      const result = await executeGetEvent(input, calendarService);
      return { content: [{ type: 'text', text: formatGetEventResult(result) }] };
    },

    create_event: async (args) => {
      const input = CreateEventInputSchema.parse(args);
      const result = await executeCreateEvent(input, calendarService);
      return { content: [{ type: 'text', text: formatCreateEventResult(result) }] };
    },

    update_event: async (args) => {
      const input = UpdateEventInputSchema.parse(args);
      const result = await executeUpdateEvent(input, calendarService);
      return { content: [{ type: 'text', text: formatUpdateEventResult(result) }] };
    },

    delete_event: async (args) => {
      const input = DeleteEventInputSchema.parse(args);
      const result = await executeDeleteEvent(input, calendarService);
      return { content: [{ type: 'text', text: formatDeleteEventResult(result) }] };
    },

    get_free_busy: async (args) => {
      const input = GetFreeBusyInputSchema.parse(args);
      const result = await executeGetFreeBusy(input, freeBusyService);
      return { content: [{ type: 'text', text: formatFreeBusyResult(result) }] };
    },

    check_conflicts: async (args) => {
      const input = CheckConflictsInputSchema.parse(args);
      const result = await executeCheckConflicts(input, conflictService);
      return { content: [{ type: 'text', text: formatCheckConflictsResult(result) }] };
    },

    respond_to_invite: async (args) => {
      const input = RespondToInviteInputSchema.parse(args);
      const result = await executeRespondToInvite(input, calendarService);
      return { content: [{ type: 'text', text: formatRespondToInviteResult(result) }] };
    },

    // Sync tools (require syncService)
    find_matching_events: syncService
      ? createFindMatchingEventsHandler(syncService)
      : async () => ({ content: [{ type: 'text' as const, text: 'Sync service not available' }] }),

    copy_event: syncService
      ? createCopyEventHandler(syncService)
      : async () => ({ content: [{ type: 'text' as const, text: 'Sync service not available' }] }),

    compare_calendars: syncService
      ? createCompareCalendarsHandler(syncService)
      : async () => ({ content: [{ type: 'text' as const, text: 'Sync service not available' }] }),
  };
}
