/**
 * Google Calendar data mapping
 * Converts between Google Calendar API format and our unified CalendarEvent format
 */

import type { calendar_v3 } from 'googleapis';
import type {
  Calendar,
  CalendarEvent,
  Attendee,
  RecurrencePattern,
  DateTimeWithZone,
  CreateEventParams,
  UpdateEventParams,
  ResponseStatus,
  ShowAs,
  EventStatus,
  Sensitivity,
  OnlineMeetingProvider,
  DayOfWeek,
} from '../../types/index.js';
import { toRecurrencePattern } from '../../types/recurrence.js';
import { getDefaultTimezone } from '../../utils/datetime.js';

type GoogleEvent = calendar_v3.Schema$Event;
type GoogleCalendar = calendar_v3.Schema$CalendarListEntry;
type GoogleAttendee = calendar_v3.Schema$EventAttendee;

// ─────────────────────────────────────────────────────────────────────────────
// Calendar Mapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map Google Calendar to our Calendar format
 */
export function mapGoogleCalendar(
  googleCal: GoogleCalendar,
  providerId: string
): Calendar {
  return {
    id: googleCal.id ?? '',
    provider: 'google',
    name: googleCal.summary ?? googleCal.id ?? 'Unnamed Calendar',
    email: googleCal.id ?? '',
    isPrimary: googleCal.primary === true,
    canEdit: googleCal.accessRole === 'owner' || googleCal.accessRole === 'writer',
    color: googleCal.backgroundColor ?? undefined,
    description: googleCal.description ?? undefined,
    timezone: googleCal.timeZone ?? undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Mapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map Google's response status to our format
 */
function mapResponseStatus(googleStatus?: string): ResponseStatus {
  switch (googleStatus) {
    case 'accepted':
      return 'accepted';
    case 'declined':
      return 'declined';
    case 'tentative':
      return 'tentative';
    default:
      return 'needsAction';
  }
}

/**
 * Map Google's event status to our format
 */
function mapEventStatus(googleStatus?: string): EventStatus {
  switch (googleStatus) {
    case 'confirmed':
      return 'confirmed';
    case 'tentative':
      return 'tentative';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'confirmed';
  }
}

/**
 * Map Google's transparency to our showAs format
 */
function mapShowAs(transparency?: string, status?: string): ShowAs {
  if (status === 'tentative') return 'tentative';
  if (transparency === 'transparent') return 'free';
  return 'busy';
}

/**
 * Map Google's visibility to our sensitivity format
 */
function mapSensitivity(visibility?: string): Sensitivity {
  switch (visibility) {
    case 'private':
      return 'private';
    case 'confidential':
      return 'confidential';
    default:
      return 'normal';
  }
}

/**
 * Detect online meeting provider from conference data
 */
function detectMeetingProvider(
  conferenceData?: calendar_v3.Schema$ConferenceData
): OnlineMeetingProvider | undefined {
  if (!conferenceData) return undefined;

  const solutionKey = conferenceData.conferenceSolution?.key?.type;
  if (solutionKey === 'hangoutsMeet') return 'meet';

  // Check entry points for other providers
  const entryPoints = conferenceData.entryPoints ?? [];
  for (const ep of entryPoints) {
    const uri = ep.uri?.toLowerCase() ?? '';
    if (uri.includes('zoom.us')) return 'zoom';
    if (uri.includes('teams.microsoft')) return 'teams';
  }

  return 'other';
}

/**
 * Get online meeting URL from conference data
 */
function getMeetingUrl(conferenceData?: calendar_v3.Schema$ConferenceData): string | undefined {
  if (!conferenceData) return undefined;

  const videoEntry = conferenceData.entryPoints?.find(
    ep => ep.entryPointType === 'video'
  );
  return videoEntry?.uri ?? undefined;
}

/**
 * Map Google attendee to our format
 */
function mapAttendee(googleAttendee: GoogleAttendee): Attendee {
  return {
    email: googleAttendee.email ?? '',
    name: googleAttendee.displayName ?? undefined,
    response: mapResponseStatus(googleAttendee.responseStatus ?? undefined),
    type: googleAttendee.optional ? 'optional' : 'required',
    isOrganizer: googleAttendee.organizer === true,
  };
}

/**
 * Parse Google's datetime (handles both dateTime and date formats)
 */
function parseGoogleDateTime(
  dateTime?: string,
  date?: string,
  timeZone?: string
): DateTimeWithZone {
  if (dateTime) {
    return {
      dateTime: dateTime,
      timezone: timeZone ?? getDefaultTimezone(),
    };
  }

  // All-day event uses date field (YYYY-MM-DD)
  if (date) {
    return {
      dateTime: `${date}T00:00:00`,
      timezone: timeZone ?? getDefaultTimezone(),
    };
  }

  throw new Error('Event has no start/end time');
}

/**
 * Parse RRULE string to our RecurrencePattern (simplified)
 * Full RRULE parsing is complex; this handles common cases
 */
function parseRRule(rrule: string, startDate: string): RecurrencePattern | undefined {
  // Extract RRULE from the full line if needed
  const rulePart = rrule.startsWith('RRULE:') ? rrule.slice(6) : rrule;
  const parts = rulePart.split(';');
  const params: Record<string, string> = {};

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key && value) {
      params[key] = value;
    }
  }

  const freq = params['FREQ'];
  if (!freq) return undefined;

  // Map frequency to our type
  let type: RecurrencePattern['type'];
  switch (freq) {
    case 'DAILY':
      type = 'daily';
      break;
    case 'WEEKLY':
      type = 'weekly';
      break;
    case 'MONTHLY':
      type = params['BYDAY'] ? 'relativeMonthly' : 'absoluteMonthly';
      break;
    case 'YEARLY':
      type = 'absoluteYearly';
      break;
    default:
      return undefined;
  }

  const pattern: RecurrencePattern = {
    type,
    interval: parseInt(params['INTERVAL'] ?? '1', 10),
    startDate: startDate.split('T')[0]!,
    endType: 'noEnd',
  };

  // Parse BYDAY for weekly
  if (params['BYDAY']) {
    const dayMap: Record<string, DayOfWeek> = {
      'SU': 'sunday',
      'MO': 'monday',
      'TU': 'tuesday',
      'WE': 'wednesday',
      'TH': 'thursday',
      'FR': 'friday',
      'SA': 'saturday',
    };
    pattern.daysOfWeek = params['BYDAY']
      .split(',')
      .map(d => dayMap[d.slice(-2)])
      .filter((d): d is DayOfWeek => d !== undefined);
  }

  // Parse BYMONTHDAY
  if (params['BYMONTHDAY']) {
    pattern.dayOfMonth = parseInt(params['BYMONTHDAY'], 10);
  }

  // Parse end conditions
  if (params['UNTIL']) {
    pattern.endType = 'endDate';
    pattern.endDate = params['UNTIL'].slice(0, 10); // YYYYMMDD -> YYYY-MM-DD needs conversion
  } else if (params['COUNT']) {
    pattern.endType = 'numbered';
    pattern.numberOfOccurrences = parseInt(params['COUNT'], 10);
  }

  return pattern;
}

/**
 * Map Google Event to our CalendarEvent format
 */
export function mapGoogleEvent(
  googleEvent: GoogleEvent,
  calendarId: string
): CalendarEvent {
  const start = parseGoogleDateTime(
    googleEvent.start?.dateTime ?? undefined,
    googleEvent.start?.date ?? undefined,
    googleEvent.start?.timeZone ?? undefined
  );

  const end = parseGoogleDateTime(
    googleEvent.end?.dateTime ?? undefined,
    googleEvent.end?.date ?? undefined,
    googleEvent.end?.timeZone ?? undefined
  );

  const isAllDay = !googleEvent.start?.dateTime;

  // Parse recurrence
  let recurrence: RecurrencePattern | undefined;
  const isRecurring = !!(googleEvent.recurrence && googleEvent.recurrence.length > 0) ||
                       !!googleEvent.recurringEventId;

  if (googleEvent.recurrence) {
    const rruleLine = googleEvent.recurrence.find(r => r.startsWith('RRULE:'));
    if (rruleLine) {
      recurrence = parseRRule(rruleLine, start.dateTime);
    }
  }

  // Map attendees
  const attendees = googleEvent.attendees?.map(mapAttendee);
  const organizer = attendees?.find(a => a.isOrganizer) ??
    (googleEvent.organizer ? {
      email: googleEvent.organizer.email ?? '',
      name: googleEvent.organizer.displayName ?? undefined,
      response: 'accepted' as ResponseStatus,
      type: 'required' as const,
      isOrganizer: true,
    } : undefined);

  // Find current user's response
  const selfAttendee = googleEvent.attendees?.find(a => a.self);
  const myResponseStatus = selfAttendee
    ? mapResponseStatus(selfAttendee.responseStatus ?? undefined)
    : (googleEvent.organizer?.self ? 'accepted' : undefined);

  return {
    id: googleEvent.id ?? '',
    provider: 'google',
    calendarId,
    iCalUId: googleEvent.iCalUID ?? undefined,

    subject: googleEvent.summary ?? '(No title)',
    body: googleEvent.description ?? undefined,
    bodyType: 'html', // Google supports HTML

    start,
    end,
    isAllDay,

    isRecurring,
    recurrence,
    seriesMasterId: googleEvent.recurringEventId ?? undefined,
    instanceDate: (googleEvent.originalStartTime?.dateTime ?? googleEvent.originalStartTime?.date) ?? undefined,

    location: googleEvent.location ?? undefined,
    isOnlineMeeting: !!googleEvent.conferenceData,
    onlineMeetingUrl: getMeetingUrl(googleEvent.conferenceData),
    onlineMeetingProvider: detectMeetingProvider(googleEvent.conferenceData),

    organizer,
    attendees: attendees?.filter(a => !a.isOrganizer),
    isOrganizer: googleEvent.organizer?.self === true,

    status: mapEventStatus(googleEvent.status ?? undefined),
    showAs: mapShowAs(googleEvent.transparency ?? undefined, googleEvent.status ?? undefined),
    myResponseStatus,
    sensitivity: mapSensitivity(googleEvent.visibility ?? undefined),

    createdAt: googleEvent.created ?? new Date().toISOString(),
    updatedAt: googleEvent.updated ?? new Date().toISOString(),
    webLink: googleEvent.htmlLink ?? undefined,

    reminders: googleEvent.reminders ? {
      useDefault: googleEvent.reminders.useDefault === true,
      overrides: googleEvent.reminders.overrides?.map(r => ({
        method: r.method === 'email' ? 'email' as const : 'popup' as const,
        minutes: r.minutes ?? 10,
      })),
    } : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Outgoing Mapping (our format -> Google format)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map our sensitivity to Google visibility
 */
function toGoogleVisibility(sensitivity?: Sensitivity): string {
  switch (sensitivity) {
    case 'private':
      return 'private';
    case 'confidential':
      return 'confidential';
    default:
      return 'default';
  }
}

/**
 * Map our showAs to Google transparency
 */
function toGoogleTransparency(showAs?: ShowAs): string {
  return showAs === 'free' ? 'transparent' : 'opaque';
}

/**
 * Build RRULE string from our recurrence input
 */
function buildRRule(recurrence: CreateEventParams['recurrence']): string[] | undefined {
  if (!recurrence) return undefined;

  const parts: string[] = [];

  // Frequency
  const freqMap: Record<string, string> = {
    daily: 'DAILY',
    weekly: 'WEEKLY',
    monthly: 'MONTHLY',
    yearly: 'YEARLY',
  };
  parts.push(`FREQ=${freqMap[recurrence.type]}`);

  // Interval
  if (recurrence.interval && recurrence.interval > 1) {
    parts.push(`INTERVAL=${recurrence.interval}`);
  }

  // Days of week
  if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
    const dayMap: Record<string, string> = {
      sunday: 'SU',
      monday: 'MO',
      tuesday: 'TU',
      wednesday: 'WE',
      thursday: 'TH',
      friday: 'FR',
      saturday: 'SA',
    };
    const days = recurrence.daysOfWeek.map(d => dayMap[d]).join(',');
    parts.push(`BYDAY=${days}`);
  }

  // Day of month
  if (recurrence.dayOfMonth) {
    parts.push(`BYMONTHDAY=${recurrence.dayOfMonth}`);
  }

  // End conditions
  if (recurrence.endDate) {
    const endDateFormatted = recurrence.endDate.replace(/-/g, '');
    parts.push(`UNTIL=${endDateFormatted}T235959Z`);
  } else if (recurrence.occurrences) {
    parts.push(`COUNT=${recurrence.occurrences}`);
  }

  return [`RRULE:${parts.join(';')}`];
}

/**
 * Convert CreateEventParams to Google Event format
 */
export function toGoogleEvent(params: CreateEventParams): calendar_v3.Schema$Event {
  const event: calendar_v3.Schema$Event = {
    summary: params.subject,
    description: params.body,
    visibility: toGoogleVisibility(params.sensitivity),
    transparency: toGoogleTransparency(params.showAs),
  };

  // Date/time
  if (params.isAllDay) {
    // All-day events use date field
    event.start = { date: params.startTime.split('T')[0] };
    event.end = { date: params.endTime.split('T')[0] };
  } else {
    event.start = {
      dateTime: params.startTime,
      timeZone: params.timezone ?? getDefaultTimezone(),
    };
    event.end = {
      dateTime: params.endTime,
      timeZone: params.timezone ?? getDefaultTimezone(),
    };
  }

  // Location
  if (params.location) {
    event.location = params.location;
  }

  // Attendees
  if (params.attendees && params.attendees.length > 0) {
    event.attendees = params.attendees.map(a => ({
      email: a.email,
      optional: a.type === 'optional',
    }));
  }

  // Recurrence
  if (params.recurrence) {
    event.recurrence = buildRRule(params.recurrence);
  }

  // Reminders
  if (params.reminderMinutes !== undefined) {
    event.reminders = {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: params.reminderMinutes }],
    };
  }

  // Online meeting (Google Meet)
  if (params.createOnlineMeeting && params.onlineMeetingProvider === 'meet') {
    event.conferenceData = {
      createRequest: {
        requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  return event;
}

/**
 * Convert UpdateEventParams to Google Event patch format
 */
export function toGoogleEventPatch(params: UpdateEventParams): calendar_v3.Schema$Event {
  const patch: calendar_v3.Schema$Event = {};

  if (params.subject !== undefined) {
    patch.summary = params.subject;
  }

  if (params.body !== undefined) {
    patch.description = params.body;
  }

  if (params.startTime !== undefined) {
    patch.start = {
      dateTime: params.startTime,
      timeZone: params.timezone ?? getDefaultTimezone(),
    };
  }

  if (params.endTime !== undefined) {
    patch.end = {
      dateTime: params.endTime,
      timeZone: params.timezone ?? getDefaultTimezone(),
    };
  }

  if (params.location !== undefined) {
    patch.location = params.location;
  }

  if (params.attendees !== undefined) {
    patch.attendees = params.attendees.map(a => ({
      email: a.email,
      optional: a.type === 'optional',
    }));
  }

  if (params.sensitivity !== undefined) {
    patch.visibility = toGoogleVisibility(params.sensitivity);
  }

  if (params.showAs !== undefined) {
    patch.transparency = toGoogleTransparency(params.showAs);
  }

  return patch;
}
