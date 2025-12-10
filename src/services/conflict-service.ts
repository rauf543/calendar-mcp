/**
 * Conflict Detection Service
 * Checks for scheduling conflicts across all calendars
 */

import type {
  CalendarEvent,
  CheckConflictsParams,
  ConflictCheckResult,
  ListEventsParams,
  ProviderType,
} from '../types/index.js';
import { CalendarService } from './calendar-service.js';
import { FreeBusyService } from './free-busy-service.js';
import { parseDateTime, rangesOverlap, durationMinutes } from '../utils/datetime.js';
import { DateTime } from 'luxon';

/**
 * Conflict Detection Service
 */
export class ConflictService {
  constructor(
    private calendarService: CalendarService,
    private freeBusyService: FreeBusyService
  ) {}

  /**
   * Check for conflicts with a proposed time slot
   */
  async checkConflicts(params: CheckConflictsParams): Promise<ConflictCheckResult> {
    const proposedStart = parseDateTime(params.startTime);
    const proposedEnd = parseDateTime(params.endTime);

    // Get all events in the time range (with some buffer)
    const bufferMinutes = 60;
    const queryStart = proposedStart.minus({ minutes: bufferMinutes });
    const queryEnd = proposedEnd.plus({ minutes: bufferMinutes });

    const listParams: ListEventsParams = {
      startTime: queryStart.toISO()!,
      endTime: queryEnd.toISO()!,
      expandRecurring: true,
    };

    const { events } = await this.calendarService.listAllEvents(listParams);

    // Find conflicts
    const conflicts = events.filter(event => {
      // Skip the excluded event (for rescheduling)
      if (
        params.excludeEventId &&
        event.id === params.excludeEventId &&
        (!params.excludeProvider || event.provider === params.excludeProvider)
      ) {
        return false;
      }

      // Skip events that show as "free"
      if (event.showAs === 'free') {
        return false;
      }

      // Check for time overlap
      return rangesOverlap(
        proposedStart,
        proposedEnd,
        event.start.dateTime,
        event.end.dateTime
      );
    });

    const result: ConflictCheckResult = {
      hasConflict: conflicts.length > 0,
      conflicts: conflicts.map(event => ({
        id: event.id,
        provider: event.provider,
        calendarId: event.calendarId,
        subject: event.subject,
        start: event.start.dateTime,
        end: event.end.dateTime,
        showAs: event.showAs,
      })),
    };

    // If there's a conflict, try to suggest an alternative
    if (conflicts.length > 0) {
      const suggestion = await this.findAlternativeSlot(
        proposedStart,
        proposedEnd,
        events
      );
      if (suggestion) {
        result.suggestion = suggestion;
      }
    }

    return result;
  }

  /**
   * Find the next available slot of the same duration
   */
  private async findAlternativeSlot(
    proposedStart: DateTime,
    proposedEnd: DateTime,
    existingEvents: CalendarEvent[]
  ): Promise<{ start: string; end: string; reason: string } | undefined> {
    const duration = proposedEnd.diff(proposedStart, 'minutes').minutes;

    // Look for free slots in the next 7 days
    const searchEnd = proposedStart.plus({ days: 7 });

    // Get busy times
    const busySlots = existingEvents
      .filter(e => e.showAs !== 'free')
      .map(e => ({
        start: parseDateTime(e.start.dateTime),
        end: parseDateTime(e.end.dateTime),
      }))
      .sort((a, b) => a.start.toMillis() - b.start.toMillis());

    // Try to find a slot starting from the proposed time
    let cursor = proposedStart;

    while (cursor < searchEnd) {
      const slotEnd = cursor.plus({ minutes: duration });

      // Check if this slot conflicts with any busy time
      let hasConflict = false;
      for (const busy of busySlots) {
        if (cursor < busy.end && slotEnd > busy.start) {
          hasConflict = true;
          // Move cursor to after this busy slot
          cursor = busy.end;
          break;
        }
      }

      if (!hasConflict) {
        // Found a free slot
        const isLaterSameDay = cursor.hasSame(proposedStart, 'day');
        const reason = isLaterSameDay
          ? 'Next available slot today'
          : `Next available slot on ${cursor.toLocaleString(DateTime.DATE_MED)}`;

        return {
          start: cursor.toISO()!,
          end: slotEnd.toISO()!,
          reason,
        };
      }

      // Make sure we're making progress
      if (cursor <= proposedStart) {
        cursor = proposedEnd;
      }
    }

    return undefined;
  }

  /**
   * Check if a specific event conflicts with others
   */
  async checkEventConflicts(
    event: CalendarEvent
  ): Promise<ConflictCheckResult> {
    return this.checkConflicts({
      startTime: event.start.dateTime,
      endTime: event.end.dateTime,
      excludeEventId: event.id,
      excludeProvider: event.provider,
    });
  }

  /**
   * Find events that would conflict if moved to a new time
   */
  async checkRescheduleConflicts(
    eventId: string,
    provider: ProviderType,
    newStartTime: string,
    newEndTime: string
  ): Promise<ConflictCheckResult> {
    return this.checkConflicts({
      startTime: newStartTime,
      endTime: newEndTime,
      excludeEventId: eventId,
      excludeProvider: provider,
    });
  }
}

/**
 * Singleton service instance
 */
let serviceInstance: ConflictService | null = null;

/**
 * Get or create the conflict service
 */
export function getConflictService(
  calendarService: CalendarService,
  freeBusyService: FreeBusyService
): ConflictService {
  if (!serviceInstance) {
    serviceInstance = new ConflictService(calendarService, freeBusyService);
  }
  return serviceInstance;
}

/**
 * Reset the service (for testing)
 */
export function resetConflictService(): void {
  serviceInstance = null;
}
