/**
 * Free/Busy Service
 * Aggregates availability information across multiple calendar providers
 */

import type {
  FreeBusyParams,
  FreeBusyResponse,
  CalendarFreeBusy,
  BusySlot,
  FreeSlot,
  ProviderType,
  ProviderError,
  WorkingHours,
} from '../types/index.js';
import { ProviderRegistry } from '../providers/index.js';
import { CalendarMCPError, ErrorCodes } from '../utils/error.js';
import {
  parseDateTime,
  createInterval,
  mergeIntervals,
  findGaps,
  durationMinutes,
  isWithinWorkingHours,
  getWorkingHoursForDay,
} from '../utils/datetime.js';
import { DateTime, Interval } from 'luxon';

/**
 * Free/Busy Service
 * Provides aggregated availability across all calendar providers
 */
export class FreeBusyService {
  constructor(private registry: ProviderRegistry) {}

  /**
   * Get aggregated free/busy information across all providers
   */
  async getAggregatedFreeBusy(params: FreeBusyParams): Promise<FreeBusyResponse> {
    let providers = this.registry.getConnected();

    // Filter by provider types if specified
    if (params.providers && params.providers.length > 0) {
      providers = providers.filter(p =>
        params.providers!.includes(p.providerType)
      );
    }

    if (providers.length === 0) {
      return {
        calendars: {},
        unified: { busy: [], free: [] },
      };
    }

    // Query each provider in parallel
    const results = await Promise.allSettled(
      providers.map(async provider => {
        const freeBusy = await provider.getFreeBusy(params);
        return { providerId: provider.providerId, freeBusy };
      })
    );

    const calendars: Record<string, CalendarFreeBusy> = {};
    const errors: FreeBusyResponse['errors'] = [];
    const allBusySlots: BusySlot[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      const provider = providers[i]!;

      if (result.status === 'fulfilled') {
        const { freeBusy } = result.value;
        calendars[freeBusy.calendarId] = freeBusy;
        allBusySlots.push(...freeBusy.busy);
      } else {
        errors.push({
          provider: provider.providerType,
          calendarId: provider.providerId,
          message:
            result.reason instanceof Error
              ? result.reason.message
              : 'Unknown error',
        });
      }
    }

    // Merge and unify busy slots
    const mergedBusy = this.mergeBusySlots(allBusySlots);

    // Compute free slots
    const rangeStart = parseDateTime(params.startTime);
    const rangeEnd = parseDateTime(params.endTime);
    let freeSlots = this.computeFreeSlots(mergedBusy, rangeStart, rangeEnd);

    // Filter by working hours if requested
    if (params.workingHoursOnly) {
      freeSlots = this.filterToWorkingHours(
        freeSlots,
        rangeStart,
        rangeEnd,
        params.workingHours
      );
    }

    // Find suggested slots if duration specified
    let suggestedSlots: FreeSlot[] | undefined;
    if (params.slotDuration && params.slotDuration > 0) {
      suggestedSlots = this.findSuggestedSlots(freeSlots, params.slotDuration);
    }

    const response: FreeBusyResponse = {
      calendars,
      unified: {
        busy: mergedBusy,
        free: freeSlots,
      },
    };

    if (suggestedSlots) {
      response.suggestedSlots = suggestedSlots;
    }

    if (errors.length > 0) {
      response.errors = errors;
    }

    return response;
  }

  /**
   * Merge overlapping busy slots
   */
  private mergeBusySlots(slots: BusySlot[]): BusySlot[] {
    if (slots.length === 0) return [];

    // Sort by start time
    const sorted = [...slots].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );

    const merged: BusySlot[] = [];
    let current = { ...sorted[0]! };

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i]!;
      const currentEnd = new Date(current.end).getTime();
      const nextStart = new Date(next.start).getTime();

      if (nextStart <= currentEnd) {
        // Overlapping or adjacent - extend current
        const nextEnd = new Date(next.end).getTime();
        if (nextEnd > currentEnd) {
          current.end = next.end;
        }
        // Keep the more restrictive status
        if (next.status === 'busy' || current.status !== 'busy') {
          current.status = next.status;
        }
      } else {
        // Gap - save current and start new
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);

    return merged;
  }

  /**
   * Compute free slots as gaps between busy slots
   */
  private computeFreeSlots(
    busySlots: BusySlot[],
    rangeStart: DateTime,
    rangeEnd: DateTime
  ): FreeSlot[] {
    const busyIntervals = busySlots.map(slot =>
      createInterval(slot.start, slot.end)
    );

    const gaps = findGaps(busyIntervals, rangeStart, rangeEnd);

    return gaps
      .filter(gap => gap.start && gap.end)
      .map(gap => ({
        start: gap.start!.toISO()!,
        end: gap.end!.toISO()!,
        durationMinutes: Math.round(gap.length('minutes')),
      }));
  }

  /**
   * Filter free slots to only working hours
   */
  private filterToWorkingHours(
    freeSlots: FreeSlot[],
    rangeStart: DateTime,
    rangeEnd: DateTime,
    workingHours?: WorkingHours
  ): FreeSlot[] {
    const result: FreeSlot[] = [];

    for (const slot of freeSlots) {
      const slotStart = parseDateTime(slot.start);
      const slotEnd = parseDateTime(slot.end);

      // Process day by day
      let cursor = slotStart.startOf('day');
      while (cursor < slotEnd) {
        const dayWorkingHours = getWorkingHoursForDay(cursor, workingHours);

        if (dayWorkingHours) {
          // Calculate overlap between slot and working hours for this day
          const workStart = dayWorkingHours.start;
          const workEnd = dayWorkingHours.end;

          const effectiveStart =
            slotStart > workStart ? slotStart : workStart;
          const effectiveEnd = slotEnd < workEnd ? slotEnd : workEnd;

          if (effectiveStart < effectiveEnd) {
            result.push({
              start: effectiveStart.toISO()!,
              end: effectiveEnd.toISO()!,
              durationMinutes: Math.round(
                effectiveEnd.diff(effectiveStart, 'minutes').minutes
              ),
            });
          }
        }

        cursor = cursor.plus({ days: 1 });
      }
    }

    return result;
  }

  /**
   * Find suggested meeting slots of the requested duration
   */
  private findSuggestedSlots(
    freeSlots: FreeSlot[],
    minDurationMinutes: number,
    maxSuggestions: number = 5
  ): FreeSlot[] {
    const suggested: FreeSlot[] = [];

    for (const slot of freeSlots) {
      if (slot.durationMinutes >= minDurationMinutes) {
        // Suggest the start of this free slot
        const slotStart = parseDateTime(slot.start);
        const slotEnd = slotStart.plus({ minutes: minDurationMinutes });

        suggested.push({
          start: slotStart.toISO()!,
          end: slotEnd.toISO()!,
          durationMinutes: minDurationMinutes,
        });

        if (suggested.length >= maxSuggestions) {
          break;
        }
      }
    }

    return suggested;
  }
}

/**
 * Singleton service instance
 */
let serviceInstance: FreeBusyService | null = null;

/**
 * Get or create the free/busy service
 */
export function getFreeBusyService(registry: ProviderRegistry): FreeBusyService {
  if (!serviceInstance) {
    serviceInstance = new FreeBusyService(registry);
  }
  return serviceInstance;
}

/**
 * Reset the service (for testing)
 */
export function resetFreeBusyService(): void {
  serviceInstance = null;
}
