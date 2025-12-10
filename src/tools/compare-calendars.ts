/**
 * compare_calendars MCP tool
 * Compares two calendars and shows differences
 */

import { z } from 'zod';
import type { SyncService } from '../services/sync-service.js';

export const compareCalendarsSchema = z.object({
  source_provider: z.enum(['google', 'microsoft', 'exchange']).describe('Source calendar provider'),
  source_calendar_id: z.string().optional().describe('Source calendar ID (defaults to primary)'),
  target_provider: z.enum(['google', 'microsoft', 'exchange']).describe('Target calendar provider'),
  target_calendar_id: z.string().optional().describe('Target calendar ID (defaults to primary)'),
  start_time: z.string().describe('Start of time range to compare (ISO 8601)'),
  end_time: z.string().describe('End of time range to compare (ISO 8601)'),
});

export type CompareCalendarsInput = z.infer<typeof compareCalendarsSchema>;

export function createCompareCalendarsHandler(syncService: SyncService) {
  return async (input: unknown) => {
    const params = compareCalendarsSchema.parse(input);

    const comparison = await syncService.compareCalendars({
      sourceProvider: params.source_provider,
      sourceCalendarId: params.source_calendar_id,
      targetProvider: params.target_provider,
      targetCalendarId: params.target_calendar_id,
      startTime: params.start_time,
      endTime: params.end_time,
    });

    // Format event summaries for compact output
    const formatEventSummary = (event: { id: string; subject: string; start: { dateTime: string }; end: { dateTime: string }; provider: string }) => ({
      id: event.id,
      subject: event.subject,
      start: event.start.dateTime,
      end: event.end.dateTime,
      provider: event.provider,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            comparison: {
              sourceProvider: comparison.sourceProvider,
              targetProvider: comparison.targetProvider,
              sourceCalendarId: comparison.sourceCalendarId,
              targetCalendarId: comparison.targetCalendarId,
              timeRange: comparison.timeRange,
              statistics: comparison.statistics,
              matches: comparison.matches.map(m => ({
                confidence: m.confidence,
                score: Math.round(m.score * 100),
                sourceEvent: formatEventSummary(m.sourceEvent),
                targetEvent: formatEventSummary(m.targetEvent),
              })),
              sourceOnly: comparison.sourceOnly.map(formatEventSummary),
              targetOnly: comparison.targetOnly.map(formatEventSummary),
            },
          }, null, 2),
        },
      ],
    };
  };
}

export const compareCalendarsDefinition = {
  name: 'compare_calendars',
  description: 'Compare two calendars to find matching events, events only in source, and events only in target. Useful for understanding synchronization status between calendar systems.',
  inputSchema: {
    type: 'object' as const,
    properties: {
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
      start_time: {
        type: 'string',
        description: 'Start of time range to compare (ISO 8601)',
      },
      end_time: {
        type: 'string',
        description: 'End of time range to compare (ISO 8601)',
      },
    },
    required: ['source_provider', 'target_provider', 'start_time', 'end_time'],
  },
};
