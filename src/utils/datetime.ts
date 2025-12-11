/**
 * Date/Time utilities using Luxon
 */

import { DateTime, Duration, Interval, Settings } from 'luxon';
import type { DateTimeWithZone, WorkingHours } from '../types/index.js';
import { getConfig } from './config.js';

/**
 * Get the default timezone from configuration
 */
export function getDefaultTimezone(): string {
  return getConfig().defaults.timezone;
}

/**
 * Parse an ISO datetime string to Luxon DateTime
 *
 * If timezone is provided, naive datetime strings (without offset or Z suffix)
 * are interpreted as being in that timezone. Strings with explicit offsets
 * are parsed with that offset, then converted to the requested timezone.
 */
export function parseDateTime(isoString: string, timezone?: string): DateTime {
  const dt = timezone
    ? DateTime.fromISO(isoString, { zone: timezone })
    : DateTime.fromISO(isoString);
  if (!dt.isValid) {
    throw new Error(`Invalid datetime: ${isoString}`);
  }
  return dt;
}

/**
 * Convert a Luxon DateTime to ISO string
 */
export function toISOString(dt: DateTime): string {
  return dt.toISO()!;
}

/**
 * Convert to a DateTimeWithZone object
 */
export function toDateTimeWithZone(dt: DateTime, timezone?: string): DateTimeWithZone {
  const tz = timezone ?? dt.zoneName ?? getDefaultTimezone();
  const dtInZone = dt.setZone(tz);
  return {
    dateTime: dtInZone.toISO()!,
    timezone: tz,
  };
}

/**
 * Parse a DateTimeWithZone to Luxon DateTime
 */
export function fromDateTimeWithZone(dtWithZone: DateTimeWithZone): DateTime {
  return parseDateTime(dtWithZone.dateTime, dtWithZone.timezone);
}

/**
 * Get current time in the default timezone
 */
export function now(timezone?: string): DateTime {
  return DateTime.now().setZone(timezone ?? getDefaultTimezone());
}

/**
 * Get start of today in the default timezone
 */
export function startOfToday(timezone?: string): DateTime {
  return now(timezone).startOf('day');
}

/**
 * Get end of today in the default timezone
 */
export function endOfToday(timezone?: string): DateTime {
  return now(timezone).endOf('day');
}

/**
 * Get start of this week (Monday) in the default timezone
 */
export function startOfWeek(timezone?: string): DateTime {
  return now(timezone).startOf('week');
}

/**
 * Get end of this week (Sunday) in the default timezone
 */
export function endOfWeek(timezone?: string): DateTime {
  return now(timezone).endOf('week');
}

/**
 * Format datetime for display
 */
export function formatDateTime(
  dt: DateTime | string,
  format: 'short' | 'long' | 'time' | 'date' | 'relative' = 'short'
): string {
  const dateTime = typeof dt === 'string' ? parseDateTime(dt) : dt;

  switch (format) {
    case 'short':
      return dateTime.toLocaleString(DateTime.DATETIME_SHORT);
    case 'long':
      return dateTime.toLocaleString(DateTime.DATETIME_FULL);
    case 'time':
      return dateTime.toLocaleString(DateTime.TIME_SIMPLE);
    case 'date':
      return dateTime.toLocaleString(DateTime.DATE_FULL);
    case 'relative':
      return dateTime.toRelative() ?? dateTime.toLocaleString(DateTime.DATETIME_SHORT);
    default:
      return dateTime.toLocaleString(DateTime.DATETIME_SHORT);
  }
}

/**
 * Format a time range (e.g., "9:00 AM - 10:00 AM")
 */
export function formatTimeRange(start: DateTime | string, end: DateTime | string): string {
  const startDt = typeof start === 'string' ? parseDateTime(start) : start;
  const endDt = typeof end === 'string' ? parseDateTime(end) : end;

  const startTime = startDt.toLocaleString(DateTime.TIME_SIMPLE);
  const endTime = endDt.toLocaleString(DateTime.TIME_SIMPLE);

  // If same day, just show date once
  if (startDt.hasSame(endDt, 'day')) {
    const date = startDt.toLocaleString(DateTime.DATE_MED);
    return `${date}, ${startTime} - ${endTime}`;
  }

  // Different days
  return `${formatDateTime(startDt, 'short')} - ${formatDateTime(endDt, 'short')}`;
}

/**
 * Calculate duration in minutes between two datetimes
 */
export function durationMinutes(start: DateTime | string, end: DateTime | string): number {
  const startDt = typeof start === 'string' ? parseDateTime(start) : start;
  const endDt = typeof end === 'string' ? parseDateTime(end) : end;
  return endDt.diff(startDt, 'minutes').minutes;
}

/**
 * Format duration for display (e.g., "1 hour 30 minutes")
 */
export function formatDuration(minutes: number): string {
  const duration = Duration.fromObject({ minutes });
  return duration.rescale().toHuman({ unitDisplay: 'short' });
}

/**
 * Check if a datetime is within working hours
 */
export function isWithinWorkingHours(
  dt: DateTime | string,
  workingHours?: WorkingHours
): boolean {
  const dateTime = typeof dt === 'string' ? parseDateTime(dt) : dt;
  const config = getConfig();
  const hours = workingHours ?? config.defaults.workingHours;

  // Check if it's a working day
  const dayName = dateTime.weekdayLong?.toLowerCase();
  if (!dayName || !hours.days.includes(dayName)) {
    return false;
  }

  // Parse working hours
  const [startHour, startMin] = hours.start.split(':').map(Number);
  const [endHour, endMin] = hours.end.split(':').map(Number);

  const workStart = dateTime.set({ hour: startHour, minute: startMin, second: 0 });
  const workEnd = dateTime.set({ hour: endHour, minute: endMin, second: 0 });

  return dateTime >= workStart && dateTime <= workEnd;
}

/**
 * Get working hours for a specific day
 */
export function getWorkingHoursForDay(
  date: DateTime | string,
  workingHours?: WorkingHours
): { start: DateTime; end: DateTime } | null {
  const dateTime = typeof date === 'string' ? parseDateTime(date) : date;
  const config = getConfig();
  const hours = workingHours ?? config.defaults.workingHours;

  const dayName = dateTime.weekdayLong?.toLowerCase();
  if (!dayName || !hours.days.includes(dayName)) {
    return null;
  }

  const [startHour, startMin] = hours.start.split(':').map(Number);
  const [endHour, endMin] = hours.end.split(':').map(Number);

  return {
    start: dateTime.set({ hour: startHour, minute: startMin, second: 0, millisecond: 0 }),
    end: dateTime.set({ hour: endHour, minute: endMin, second: 0, millisecond: 0 }),
  };
}

/**
 * Check if two time ranges overlap
 */
export function rangesOverlap(
  start1: DateTime | string,
  end1: DateTime | string,
  start2: DateTime | string,
  end2: DateTime | string
): boolean {
  const s1 = typeof start1 === 'string' ? parseDateTime(start1) : start1;
  const e1 = typeof end1 === 'string' ? parseDateTime(end1) : end1;
  const s2 = typeof start2 === 'string' ? parseDateTime(start2) : start2;
  const e2 = typeof end2 === 'string' ? parseDateTime(end2) : end2;

  return s1 < e2 && e1 > s2;
}

/**
 * Create an Interval from start and end datetimes
 */
export function createInterval(
  start: DateTime | string,
  end: DateTime | string
): Interval {
  const s = typeof start === 'string' ? parseDateTime(start) : start;
  const e = typeof end === 'string' ? parseDateTime(end) : end;
  return Interval.fromDateTimes(s, e);
}

/**
 * Merge overlapping intervals
 */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];

  // Filter out invalid intervals and sort by start time
  const validIntervals = intervals.filter(i => i.isValid && i.start && i.end);
  if (validIntervals.length === 0) return [];

  const sorted = [...validIntervals].sort((a, b) => a.start!.toMillis() - b.start!.toMillis());

  const merged: Interval[] = [];
  let current = sorted[0]!;

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]!;
    if (current.overlaps(next) || current.abutsStart(next)) {
      // Merge: extend current to include next
      const currentEnd = current.end!;
      const nextEnd = next.end!;
      current = Interval.fromDateTimes(
        current.start!,
        currentEnd > nextEnd ? currentEnd : nextEnd
      );
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Find gaps between intervals within a range
 */
export function findGaps(
  intervals: Interval[],
  rangeStart: DateTime,
  rangeEnd: DateTime
): Interval[] {
  const merged = mergeIntervals(intervals);
  const gaps: Interval[] = [];

  let cursor: DateTime = rangeStart;

  for (const interval of merged) {
    // Skip invalid intervals
    if (!interval.start || !interval.end) continue;

    const intervalStart = interval.start;
    const intervalEnd = interval.end;

    // Skip intervals entirely before our range
    if (intervalEnd <= rangeStart) continue;
    // Stop if we've passed our range
    if (intervalStart >= rangeEnd) break;

    // Clamp interval to our range
    const effectiveStart = intervalStart > rangeStart ? intervalStart : rangeStart;
    const effectiveEnd = intervalEnd < rangeEnd ? intervalEnd : rangeEnd;

    // If there's a gap before this interval
    if (cursor < effectiveStart) {
      gaps.push(Interval.fromDateTimes(cursor, effectiveStart));
    }

    cursor = effectiveEnd;
  }

  // Gap after the last interval
  if (cursor < rangeEnd) {
    gaps.push(Interval.fromDateTimes(cursor, rangeEnd));
  }

  return gaps;
}

/**
 * Add days to a date string
 */
export function addDays(isoString: string, days: number): string {
  return parseDateTime(isoString).plus({ days }).toISO()!;
}

/**
 * Check if a date is today
 */
export function isToday(dt: DateTime | string, timezone?: string): boolean {
  const dateTime = typeof dt === 'string' ? parseDateTime(dt) : dt;
  return dateTime.hasSame(now(timezone), 'day');
}

/**
 * Check if a date is in the future
 */
export function isFuture(dt: DateTime | string): boolean {
  const dateTime = typeof dt === 'string' ? parseDateTime(dt) : dt;
  return dateTime > DateTime.now();
}

/**
 * Check if a date is in the past
 */
export function isPast(dt: DateTime | string): boolean {
  const dateTime = typeof dt === 'string' ? parseDateTime(dt) : dt;
  return dateTime < DateTime.now();
}
