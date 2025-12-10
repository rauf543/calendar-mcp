/**
 * find_matching_events MCP tool
 * Finds matching events between two calendars/providers
 */

import { z } from 'zod';
import type { SyncService, MatchConfidence } from '../services/sync-service.js';

export const findMatchingEventsSchema = z.object({
  source_provider: z.enum(['google', 'microsoft', 'exchange']).describe('Source calendar provider'),
  source_calendar_id: z.string().optional().describe('Source calendar ID (defaults to primary)'),
  target_provider: z.enum(['google', 'microsoft', 'exchange']).describe('Target calendar provider'),
  target_calendar_id: z.string().optional().describe('Target calendar ID (defaults to primary)'),
  start_time: z.string().describe('Start of time range (ISO 8601)'),
  end_time: z.string().describe('End of time range (ISO 8601)'),
  min_confidence: z.enum(['high', 'medium', 'low']).optional().describe('Minimum match confidence (default: low)'),
});

export type FindMatchingEventsInput = z.infer<typeof findMatchingEventsSchema>;

export function createFindMatchingEventsHandler(syncService: SyncService) {
  return async (input: unknown) => {
    const params = findMatchingEventsSchema.parse(input);

    const matches = await syncService.findMatchingEvents({
      sourceProvider: params.source_provider,
      sourceCalendarId: params.source_calendar_id,
      targetProvider: params.target_provider,
      targetCalendarId: params.target_calendar_id,
      startTime: params.start_time,
      endTime: params.end_time,
      minConfidence: params.min_confidence as MatchConfidence | undefined,
    });

    // Format output
    const formattedMatches = matches.map(match => ({
      confidence: match.confidence,
      score: Math.round(match.score * 100),
      sourceEvent: {
        id: match.sourceEvent.id,
        subject: match.sourceEvent.subject,
        start: match.sourceEvent.start.dateTime,
        end: match.sourceEvent.end.dateTime,
        provider: match.sourceEvent.provider,
      },
      targetEvent: {
        id: match.targetEvent.id,
        subject: match.targetEvent.subject,
        start: match.targetEvent.start.dateTime,
        end: match.targetEvent.end.dateTime,
        provider: match.targetEvent.provider,
      },
      matchFactors: match.matchFactors.map(f => ({
        factor: f.factor,
        matched: f.matched,
        details: f.details,
      })),
    }));

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            matchCount: matches.length,
            timeRange: {
              start: params.start_time,
              end: params.end_time,
            },
            sourceProvider: params.source_provider,
            targetProvider: params.target_provider,
            matches: formattedMatches,
          }, null, 2),
        },
      ],
    };
  };
}

export const findMatchingEventsDefinition = {
  name: 'find_matching_events',
  description: 'Find matching events between two calendars or providers. Useful for identifying duplicates or corresponding events across different calendar systems.',
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
        description: 'Start of time range (ISO 8601)',
      },
      end_time: {
        type: 'string',
        description: 'End of time range (ISO 8601)',
      },
      min_confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Minimum match confidence level',
      },
    },
    required: ['source_provider', 'target_provider', 'start_time', 'end_time'],
  },
};
