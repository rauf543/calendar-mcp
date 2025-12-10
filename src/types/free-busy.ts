/**
 * Free/Busy data types
 * Used for availability queries across calendars
 */

import type { ProviderType } from './calendar.js';

export type BusyStatus = 'busy' | 'tentative' | 'oof';

/**
 * A time slot (start and end times)
 */
export interface TimeSlot {
  /** Start time (ISO 8601) */
  start: string;
  /** End time (ISO 8601) */
  end: string;
}

/**
 * A busy time slot with additional information
 */
export interface BusySlot extends TimeSlot {
  /** Type of busy status */
  status: BusyStatus;
  /** Event subject (if not private) */
  eventSubject?: string;
  /** Event ID for reference */
  eventId?: string;
}

/**
 * A free time slot with computed duration
 */
export interface FreeSlot extends TimeSlot {
  /** Duration in minutes */
  durationMinutes: number;
}

/**
 * Working hours configuration
 */
export interface WorkingHours {
  /** Start time (HH:mm format, e.g., "09:00") */
  start: string;
  /** End time (HH:mm format, e.g., "17:00") */
  end: string;
  /** Working days */
  days: string[];
}

/**
 * Parameters for requesting free/busy information
 */
export interface FreeBusyParams {
  /** Start of time range (ISO 8601) - REQUIRED */
  startTime: string;
  /** End of time range (ISO 8601) - REQUIRED */
  endTime: string;
  /** Filter to specific providers */
  providers?: ProviderType[];
  /** Filter to specific calendar IDs */
  calendarIds?: string[];
  /** Minimum slot duration to find (minutes) */
  slotDuration?: number;
  /** Only consider working hours */
  workingHoursOnly?: boolean;
  /** Custom working hours configuration */
  workingHours?: WorkingHours;
}

/**
 * Free/busy information for a single calendar
 */
export interface CalendarFreeBusy {
  /** Provider type */
  provider: ProviderType;
  /** Calendar ID */
  calendarId: string;
  /** Calendar display name */
  calendarName: string;
  /** Busy time slots */
  busy: BusySlot[];
}

/**
 * Full free/busy response
 */
export interface FreeBusyResponse {
  /** Per-calendar busy times */
  calendars: Record<string, CalendarFreeBusy>;

  /** Unified view (merged across all calendars) */
  unified: {
    /** All busy slots merged and sorted */
    busy: BusySlot[];
    /** Computed free slots */
    free: FreeSlot[];
  };

  /** Suggested meeting slots (if slotDuration was provided) */
  suggestedSlots?: FreeSlot[];

  /** Any errors from individual providers */
  errors?: Array<{
    provider: ProviderType;
    calendarId?: string;
    message: string;
  }>;
}

/**
 * Parameters for checking conflicts
 */
export interface CheckConflictsParams {
  /** Proposed start time (ISO 8601) */
  startTime: string;
  /** Proposed end time (ISO 8601) */
  endTime: string;
  /** Event ID to exclude (for rescheduling existing events) */
  excludeEventId?: string;
  /** Provider of excluded event */
  excludeProvider?: ProviderType;
}

/**
 * Conflict check result
 */
export interface ConflictCheckResult {
  /** Whether there are any conflicts */
  hasConflict: boolean;
  /** Conflicting events */
  conflicts: Array<{
    id: string;
    provider: ProviderType;
    calendarId: string;
    subject: string;
    start: string;
    end: string;
    showAs: string;
  }>;
  /** Suggested alternative time if conflict found */
  suggestion?: {
    start: string;
    end: string;
    reason: string;
  };
}
