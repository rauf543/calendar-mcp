/**
 * Recurrence pattern types
 * Follows patterns similar to iCalendar RRULE with simplifications
 */

export type RecurrenceType =
  | 'daily'
  | 'weekly'
  | 'absoluteMonthly'
  | 'relativeMonthly'
  | 'absoluteYearly'
  | 'relativeYearly';

export type DayOfWeek =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

export type WeekIndex = 'first' | 'second' | 'third' | 'fourth' | 'last';

export type RecurrenceEndType = 'noEnd' | 'endDate' | 'numbered';

/**
 * Recurrence pattern for recurring events
 */
export interface RecurrencePattern {
  /** Type of recurrence */
  type: RecurrenceType;

  /** How often the pattern repeats (e.g., every 2 weeks) */
  interval: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Weekly pattern specifics
  // ─────────────────────────────────────────────────────────────────────────────
  /** Days of the week (for weekly recurrence) */
  daysOfWeek?: DayOfWeek[];
  /** First day of the week (default: sunday) */
  firstDayOfWeek?: DayOfWeek;

  // ─────────────────────────────────────────────────────────────────────────────
  // Monthly pattern specifics
  // ─────────────────────────────────────────────────────────────────────────────
  /** Day of the month (1-31) for absoluteMonthly */
  dayOfMonth?: number;
  /** Week index for relativeMonthly (e.g., "second Tuesday") */
  weekIndex?: WeekIndex;
  /** Day of week for relativeMonthly */
  dayOfWeekForMonthly?: DayOfWeek;

  // ─────────────────────────────────────────────────────────────────────────────
  // Yearly pattern specifics
  // ─────────────────────────────────────────────────────────────────────────────
  /** Month (1-12) for yearly patterns */
  month?: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Range
  // ─────────────────────────────────────────────────────────────────────────────
  /** Start date of the recurrence (YYYY-MM-DD) */
  startDate: string;
  /** How the recurrence ends */
  endType: RecurrenceEndType;
  /** End date if endType is 'endDate' (YYYY-MM-DD) */
  endDate?: string;
  /** Number of occurrences if endType is 'numbered' */
  numberOfOccurrences?: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Display
  // ─────────────────────────────────────────────────────────────────────────────
  /** Human-readable description of the pattern */
  humanReadable?: string;
  /** Raw RRULE string (provider-specific) */
  pattern?: string;
}

/**
 * Simplified recurrence input for creating events
 * The system will convert this to a full RecurrencePattern
 */
export interface SimpleRecurrenceInput {
  /** Simple type selection */
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  /** How often (default: 1) */
  interval?: number;
  /** Days of week for weekly (e.g., ['monday', 'wednesday', 'friday']) */
  daysOfWeek?: DayOfWeek[];
  /** Day of month for monthly (1-31) */
  dayOfMonth?: number;
  /** End date (YYYY-MM-DD) */
  endDate?: string;
  /** OR number of occurrences */
  occurrences?: number;
}

/**
 * Convert simple recurrence input to full pattern
 */
export function toRecurrencePattern(
  input: SimpleRecurrenceInput,
  eventStartDate: string
): RecurrencePattern {
  const base: RecurrencePattern = {
    type: input.type === 'monthly' ? 'absoluteMonthly' : input.type === 'yearly' ? 'absoluteYearly' : input.type,
    interval: input.interval ?? 1,
    startDate: eventStartDate,
    endType: input.endDate ? 'endDate' : input.occurrences ? 'numbered' : 'noEnd',
  };

  if (input.endDate) {
    base.endDate = input.endDate;
  }

  if (input.occurrences) {
    base.numberOfOccurrences = input.occurrences;
  }

  if (input.daysOfWeek && input.daysOfWeek.length > 0) {
    base.daysOfWeek = input.daysOfWeek;
  }

  if (input.dayOfMonth) {
    base.dayOfMonth = input.dayOfMonth;
  }

  return base;
}

/**
 * Format recurrence pattern as human-readable string
 */
export function formatRecurrencePattern(pattern: RecurrencePattern): string {
  const interval = pattern.interval === 1 ? '' : `every ${pattern.interval} `;

  let frequency: string;
  switch (pattern.type) {
    case 'daily':
      frequency = pattern.interval === 1 ? 'Daily' : `Every ${pattern.interval} days`;
      break;
    case 'weekly':
      if (pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
        const days = pattern.daysOfWeek.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ');
        frequency = pattern.interval === 1 ? `Weekly on ${days}` : `Every ${pattern.interval} weeks on ${days}`;
      } else {
        frequency = pattern.interval === 1 ? 'Weekly' : `Every ${pattern.interval} weeks`;
      }
      break;
    case 'absoluteMonthly':
      frequency = pattern.interval === 1
        ? `Monthly on day ${pattern.dayOfMonth ?? 1}`
        : `Every ${pattern.interval} months on day ${pattern.dayOfMonth ?? 1}`;
      break;
    case 'relativeMonthly':
      frequency = `Monthly on the ${pattern.weekIndex ?? 'first'} ${pattern.dayOfWeekForMonthly ?? 'monday'}`;
      break;
    case 'absoluteYearly':
    case 'relativeYearly':
      frequency = pattern.interval === 1 ? 'Yearly' : `Every ${pattern.interval} years`;
      break;
    default:
      frequency = 'Recurring';
  }

  let ending = '';
  if (pattern.endType === 'endDate' && pattern.endDate) {
    ending = `, until ${pattern.endDate}`;
  } else if (pattern.endType === 'numbered' && pattern.numberOfOccurrences) {
    ending = `, ${pattern.numberOfOccurrences} occurrences`;
  }

  return frequency + ending;
}
