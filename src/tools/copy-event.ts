/**
 * copy_event MCP tool
 * Copies an event from one calendar/provider to another
 */

import { z } from 'zod';
import type { SyncService } from '../services/sync-service.js';

export const copyEventSchema = z.object({
  source_event_id: z.string().describe('ID of the event to copy'),
  source_provider: z.enum(['google', 'microsoft', 'exchange']).describe('Source calendar provider'),
  source_calendar_id: z.string().optional().describe('Source calendar ID'),
  target_provider: z.enum(['google', 'microsoft', 'exchange']).describe('Target calendar provider'),
  target_calendar_id: z.string().optional().describe('Target calendar ID'),
  include_attendees: z.boolean().optional().describe('Include attendees in copy (default: false)'),
  include_body: z.boolean().optional().describe('Include event body/description (default: true)'),
});

export type CopyEventInput = z.infer<typeof copyEventSchema>;

export function createCopyEventHandler(syncService: SyncService) {
  return async (input: unknown) => {
    const params = copyEventSchema.parse(input);

    const result = await syncService.copyEvent({
      sourceEventId: params.source_event_id,
      sourceProvider: params.source_provider,
      sourceCalendarId: params.source_calendar_id,
      targetProvider: params.target_provider,
      targetCalendarId: params.target_calendar_id,
      includeAttendees: params.include_attendees,
      includeBody: params.include_body,
    });

    if (result.success && result.copiedEvent) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: `Event "${result.sourceEvent.subject}" copied successfully`,
              sourceEvent: {
                id: result.sourceEvent.id,
                subject: result.sourceEvent.subject,
                provider: result.sourceEvent.provider,
                start: result.sourceEvent.start.dateTime,
                end: result.sourceEvent.end.dateTime,
              },
              copiedEvent: {
                id: result.copiedEvent.id,
                subject: result.copiedEvent.subject,
                provider: result.copiedEvent.provider,
                calendarId: result.copiedEvent.calendarId,
                start: result.copiedEvent.start.dateTime,
                end: result.copiedEvent.end.dateTime,
              },
            }, null, 2),
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: result.error ?? 'Unknown error',
              sourceEventId: params.source_event_id,
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  };
}

export const copyEventDefinition = {
  name: 'copy_event',
  description: 'Copy an event from one calendar/provider to another. Useful for manually syncing individual events between different calendar systems.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      source_event_id: {
        type: 'string',
        description: 'ID of the event to copy',
      },
      source_provider: {
        type: 'string',
        enum: ['google', 'microsoft', 'exchange'],
        description: 'Source calendar provider',
      },
      source_calendar_id: {
        type: 'string',
        description: 'Source calendar ID (defaults to primary)',
      },
      target_provider: {
        type: 'string',
        enum: ['google', 'microsoft', 'exchange'],
        description: 'Target calendar provider',
      },
      target_calendar_id: {
        type: 'string',
        description: 'Target calendar ID (defaults to primary)',
      },
      include_attendees: {
        type: 'boolean',
        description: 'Whether to include attendees in the copied event (default: false)',
      },
      include_body: {
        type: 'boolean',
        description: 'Whether to include the event body/description (default: true)',
      },
    },
    required: ['source_event_id', 'source_provider', 'target_provider'],
  },
};
