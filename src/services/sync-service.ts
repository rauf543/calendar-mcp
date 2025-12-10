/**
 * Calendar synchronization service
 * Provides event matching, copying, and comparison across providers
 */

import type { CalendarEvent, CreateEventParams, AttendeeInput, ProviderType } from '../types/index.js';
import type { CalendarService } from './calendar-service.js';

/**
 * Match confidence levels
 */
export type MatchConfidence = 'high' | 'medium' | 'low';

/**
 * Event match result
 */
export interface EventMatch {
  sourceEvent: CalendarEvent;
  targetEvent: CalendarEvent;
  confidence: MatchConfidence;
  matchFactors: MatchFactor[];
  score: number;
}

/**
 * Factors contributing to match confidence
 */
export interface MatchFactor {
  factor: string;
  weight: number;
  matched: boolean;
  details?: string;
}

/**
 * Calendar comparison result
 */
export interface CalendarComparison {
  sourceCalendarId: string;
  targetCalendarId: string;
  sourceProvider: string;
  targetProvider: string;
  timeRange: {
    startTime: string;
    endTime: string;
  };
  matches: EventMatch[];
  sourceOnly: CalendarEvent[];
  targetOnly: CalendarEvent[];
  statistics: {
    totalSourceEvents: number;
    totalTargetEvents: number;
    matchedCount: number;
    sourceOnlyCount: number;
    targetOnlyCount: number;
  };
}

/**
 * Copy event result
 */
export interface CopyEventResult {
  success: boolean;
  sourceEvent: CalendarEvent;
  copiedEvent?: CalendarEvent;
  error?: string;
}

/**
 * Sync service for cross-calendar operations
 */
export class SyncService {
  constructor(private calendarService: CalendarService) {}

  /**
   * Find matching events between source and target calendars
   */
  async findMatchingEvents(params: {
    sourceProvider: string;
    sourceCalendarId?: string;
    targetProvider: string;
    targetCalendarId?: string;
    startTime: string;
    endTime: string;
    minConfidence?: MatchConfidence;
  }): Promise<EventMatch[]> {
    // Get events from both calendars
    const [sourceResult, targetResult] = await Promise.all([
      this.calendarService.listAllEvents({
        providers: [params.sourceProvider as ProviderType],
        calendarIds: params.sourceCalendarId ? [params.sourceCalendarId] : undefined,
        startTime: params.startTime,
        endTime: params.endTime,
      }),
      this.calendarService.listAllEvents({
        providers: [params.targetProvider as ProviderType],
        calendarIds: params.targetCalendarId ? [params.targetCalendarId] : undefined,
        startTime: params.startTime,
        endTime: params.endTime,
      }),
    ]);
    const sourceEvents = sourceResult.events;
    const targetEvents = targetResult.events;

    // Find matches
    const matches: EventMatch[] = [];
    const minConfidence = params.minConfidence ?? 'low';
    const minScore = minConfidence === 'high' ? 0.8 : minConfidence === 'medium' ? 0.5 : 0.3;

    for (const sourceEvent of sourceEvents) {
      for (const targetEvent of targetEvents) {
        const matchResult = this.calculateMatch(sourceEvent, targetEvent);

        if (matchResult.score >= minScore) {
          matches.push(matchResult);
        }
      }
    }

    // Sort by confidence score descending
    matches.sort((a, b) => b.score - a.score);

    return matches;
  }

  /**
   * Compare two calendars and find differences
   */
  async compareCalendars(params: {
    sourceProvider: string;
    sourceCalendarId?: string;
    targetProvider: string;
    targetCalendarId?: string;
    startTime: string;
    endTime: string;
  }): Promise<CalendarComparison> {
    // Get events from both calendars
    const [sourceResult, targetResult] = await Promise.all([
      this.calendarService.listAllEvents({
        providers: [params.sourceProvider as ProviderType],
        calendarIds: params.sourceCalendarId ? [params.sourceCalendarId] : undefined,
        startTime: params.startTime,
        endTime: params.endTime,
      }),
      this.calendarService.listAllEvents({
        providers: [params.targetProvider as ProviderType],
        calendarIds: params.targetCalendarId ? [params.targetCalendarId] : undefined,
        startTime: params.startTime,
        endTime: params.endTime,
      }),
    ]);
    const sourceEvents = sourceResult.events;
    const targetEvents = targetResult.events;

    // Find matches with high confidence
    const matches: EventMatch[] = [];
    const matchedSourceIds = new Set<string>();
    const matchedTargetIds = new Set<string>();

    for (const sourceEvent of sourceEvents) {
      let bestMatch: EventMatch | null = null;

      for (const targetEvent of targetEvents) {
        if (matchedTargetIds.has(targetEvent.id)) continue;

        const matchResult = this.calculateMatch(sourceEvent, targetEvent);

        if (matchResult.score >= 0.5 && (!bestMatch || matchResult.score > bestMatch.score)) {
          bestMatch = matchResult;
        }
      }

      if (bestMatch) {
        matches.push(bestMatch);
        matchedSourceIds.add(sourceEvent.id);
        matchedTargetIds.add(bestMatch.targetEvent.id);
      }
    }

    // Find unmatched events
    const sourceOnly = sourceEvents.filter(e => !matchedSourceIds.has(e.id));
    const targetOnly = targetEvents.filter(e => !matchedTargetIds.has(e.id));

    return {
      sourceCalendarId: params.sourceCalendarId ?? 'primary',
      targetCalendarId: params.targetCalendarId ?? 'primary',
      sourceProvider: params.sourceProvider,
      targetProvider: params.targetProvider,
      timeRange: {
        startTime: params.startTime,
        endTime: params.endTime,
      },
      matches,
      sourceOnly,
      targetOnly,
      statistics: {
        totalSourceEvents: sourceEvents.length,
        totalTargetEvents: targetEvents.length,
        matchedCount: matches.length,
        sourceOnlyCount: sourceOnly.length,
        targetOnlyCount: targetOnly.length,
      },
    };
  }

  /**
   * Copy an event to another calendar/provider
   */
  async copyEvent(params: {
    sourceEventId: string;
    sourceProvider: string;
    sourceCalendarId?: string;
    targetProvider: string;
    targetCalendarId?: string;
    includeAttendees?: boolean;
    includeBody?: boolean;
  }): Promise<CopyEventResult> {
    try {
      // Get source event
      const sourceEvent = await this.calendarService.getEvent(
        params.sourceEventId,
        params.sourceProvider as ProviderType,
        params.sourceCalendarId
      );

      // Build create params for target
      const attendees: AttendeeInput[] = params.includeAttendees
        ? (sourceEvent.attendees ?? []).map(a => ({
            email: a.email,
            name: a.name,
            type: a.type,
          }))
        : [];

      const createParams: CreateEventParams = {
        subject: sourceEvent.subject,
        startTime: sourceEvent.start.dateTime,
        endTime: sourceEvent.end.dateTime,
        timezone: sourceEvent.start.timezone,
        isAllDay: sourceEvent.isAllDay,
        location: sourceEvent.location,
        body: params.includeBody !== false ? sourceEvent.body : undefined,
        bodyType: sourceEvent.bodyType,
        attendees: attendees.length > 0 ? attendees : undefined,
        showAs: sourceEvent.showAs,
        sensitivity: sourceEvent.sensitivity,
        sendInvites: false, // Don't send invites for copied events by default
      };

      // Create event in target calendar
      const copiedEvent = await this.calendarService.createEvent(
        createParams,
        params.targetProvider as ProviderType,
        params.targetCalendarId
      );

      return {
        success: true,
        sourceEvent,
        copiedEvent,
      };
    } catch (error) {
      return {
        success: false,
        sourceEvent: {
          id: params.sourceEventId,
          provider: params.sourceProvider as 'google' | 'microsoft' | 'exchange',
          calendarId: params.sourceCalendarId ?? '',
          subject: 'Unknown',
          start: { dateTime: '', timezone: '' },
          end: { dateTime: '', timezone: '' },
          isAllDay: false,
          isRecurring: false,
          isOnlineMeeting: false,
          isOrganizer: false,
          status: 'confirmed',
          showAs: 'busy',
          myResponseStatus: 'needsAction',
          sensitivity: 'normal',
          createdAt: '',
          updatedAt: '',
        },
        error: error instanceof Error ? error.message : 'Unknown error copying event',
      };
    }
  }

  /**
   * Calculate match score between two events
   */
  private calculateMatch(source: CalendarEvent, target: CalendarEvent): EventMatch {
    const factors: MatchFactor[] = [];
    let totalWeight = 0;
    let matchedWeight = 0;

    // Subject match (weight: 30)
    const subjectWeight = 30;
    const subjectMatched = this.fuzzyMatch(source.subject, target.subject);
    factors.push({
      factor: 'subject',
      weight: subjectWeight,
      matched: subjectMatched >= 0.8,
      details: `${Math.round(subjectMatched * 100)}% similar`,
    });
    totalWeight += subjectWeight;
    matchedWeight += subjectWeight * subjectMatched;

    // Start time match (weight: 25)
    const startWeight = 25;
    const startDiff = Math.abs(
      new Date(source.start.dateTime).getTime() - new Date(target.start.dateTime).getTime()
    );
    const startMatched = startDiff <= 60000; // Within 1 minute
    const startScore = startMatched ? 1 : startDiff <= 300000 ? 0.5 : 0; // Within 5 minutes partial
    factors.push({
      factor: 'startTime',
      weight: startWeight,
      matched: startMatched,
      details: startMatched ? 'exact' : `${Math.round(startDiff / 60000)}min difference`,
    });
    totalWeight += startWeight;
    matchedWeight += startWeight * startScore;

    // End time match (weight: 20)
    const endWeight = 20;
    const endDiff = Math.abs(
      new Date(source.end.dateTime).getTime() - new Date(target.end.dateTime).getTime()
    );
    const endMatched = endDiff <= 60000;
    const endScore = endMatched ? 1 : endDiff <= 300000 ? 0.5 : 0;
    factors.push({
      factor: 'endTime',
      weight: endWeight,
      matched: endMatched,
      details: endMatched ? 'exact' : `${Math.round(endDiff / 60000)}min difference`,
    });
    totalWeight += endWeight;
    matchedWeight += endWeight * endScore;

    // Location match (weight: 10)
    if (source.location || target.location) {
      const locationWeight = 10;
      const locationMatched = this.fuzzyMatch(source.location ?? '', target.location ?? '');
      factors.push({
        factor: 'location',
        weight: locationWeight,
        matched: locationMatched >= 0.8,
        details: source.location && target.location
          ? `${Math.round(locationMatched * 100)}% similar`
          : 'one or both missing',
      });
      totalWeight += locationWeight;
      matchedWeight += locationWeight * locationMatched;
    }

    // All-day event match (weight: 10)
    const allDayWeight = 10;
    const allDayMatched = source.isAllDay === target.isAllDay;
    factors.push({
      factor: 'isAllDay',
      weight: allDayWeight,
      matched: allDayMatched,
      details: allDayMatched ? 'same' : 'different',
    });
    totalWeight += allDayWeight;
    matchedWeight += allDayWeight * (allDayMatched ? 1 : 0);

    // iCalUID match (weight: 5) - if available
    if (source.iCalUId && target.iCalUId) {
      const icalWeight = 5;
      const icalMatched = source.iCalUId === target.iCalUId;
      factors.push({
        factor: 'iCalUId',
        weight: icalWeight,
        matched: icalMatched,
        details: icalMatched ? 'exact match' : 'different',
      });
      totalWeight += icalWeight;
      matchedWeight += icalWeight * (icalMatched ? 1 : 0);
    }

    const score = totalWeight > 0 ? matchedWeight / totalWeight : 0;
    const confidence: MatchConfidence =
      score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low';

    return {
      sourceEvent: source,
      targetEvent: target,
      confidence,
      matchFactors: factors,
      score,
    };
  }

  /**
   * Fuzzy string matching using Levenshtein distance
   */
  private fuzzyMatch(str1: string, str2: string): number {
    if (!str1 && !str2) return 1;
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1;

    // Calculate Levenshtein distance
    const len1 = s1.length;
    const len2 = s2.length;

    if (len1 === 0) return 0;
    if (len2 === 0) return 0;

    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0]![j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j - 1]! + cost
        );
      }
    }

    const distance = matrix[len1]![len2]!;
    const maxLen = Math.max(len1, len2);
    return 1 - distance / maxLen;
  }
}

// Singleton instance
let syncServiceInstance: SyncService | null = null;

/**
 * Get or create sync service instance
 */
export function getSyncService(calendarService: CalendarService): SyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new SyncService(calendarService);
  }
  return syncServiceInstance;
}
