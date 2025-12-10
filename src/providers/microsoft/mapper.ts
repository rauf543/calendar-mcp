/**
 * Microsoft Graph to Calendar MCP data mapping
 */

import type {
  Calendar,
  CalendarEvent,
  Attendee,
  DateTimeWithZone,
  ShowAs,
  EventStatus,
  Sensitivity,
  ResponseStatus,
  RecurrencePattern,
  DayOfWeek,
  OnlineMeetingProvider,
  CreateEventParams,
  UpdateEventParams,
  AttendeeType,
} from '../../types/index.js';
import { formatRecurrencePattern } from '../../types/recurrence.js';
import { getDefaultTimezone } from '../../utils/datetime.js';

// Microsoft Graph types (simplified)
interface GraphCalendar {
  id?: string | null;
  name?: string | null;
  color?: string | null;
  isDefaultCalendar?: boolean | null;
  canEdit?: boolean | null;
  owner?: {
    address?: string | null;
    name?: string | null;
  } | null;
}

interface GraphDateTime {
  dateTime?: string | null;
  timeZone?: string | null;
}

interface GraphAttendee {
  type?: string | null;
  status?: {
    response?: string | null;
  } | null;
  emailAddress?: {
    address?: string | null;
    name?: string | null;
  } | null;
}

interface GraphRecurrence {
  pattern?: {
    type?: string | null;
    interval?: number | null;
    daysOfWeek?: string[] | null;
    dayOfMonth?: number | null;
    index?: string | null;
    firstDayOfWeek?: string | null;
    month?: number | null;
  } | null;
  range?: {
    type?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    numberOfOccurrences?: number | null;
  } | null;
}

interface GraphEvent {
  id?: string | null;
  subject?: string | null;
  body?: {
    contentType?: string | null;
    content?: string | null;
  } | null;
  start?: GraphDateTime | null;
  end?: GraphDateTime | null;
  isAllDay?: boolean | null;
  location?: {
    displayName?: string | null;
    address?: unknown;
  } | null;
  attendees?: GraphAttendee[] | null;
  organizer?: {
    emailAddress?: {
      address?: string | null;
      name?: string | null;
    } | null;
  } | null;
  isOrganizer?: boolean | null;
  showAs?: string | null;
  sensitivity?: string | null;
  iCalUId?: string | null;
  recurrence?: GraphRecurrence | null;
  seriesMasterId?: string | null;
  originalStart?: string | null;
  isOnlineMeeting?: boolean | null;
  onlineMeetingUrl?: string | null;
  onlineMeeting?: {
    joinUrl?: string | null;
  } | null;
  webLink?: string | null;
  createdDateTime?: string | null;
  lastModifiedDateTime?: string | null;
  isCancelled?: boolean | null;
  responseStatus?: {
    response?: string | null;
  } | null;
}

interface GraphFreeBusyItem {
  start?: GraphDateTime | null;
  end?: GraphDateTime | null;
  status?: string | null;
}

/**
 * Map Graph calendar to our format
 */
export function mapGraphCalendar(graphCalendar: GraphCalendar, providerId: string): Calendar {
  return {
    id: graphCalendar.id ?? '',
    provider: 'microsoft',
    name: graphCalendar.name ?? 'Unnamed Calendar',
    email: graphCalendar.owner?.address ?? '',
    isPrimary: graphCalendar.isDefaultCalendar === true,
    canEdit: graphCalendar.canEdit !== false,
    color: graphCalendar.color ?? undefined,
    accessRole: graphCalendar.canEdit ? 'writer' : 'reader',
  };
}

/**
 * Map Graph showAs to our format
 */
function mapShowAs(graphShowAs?: string | null): ShowAs {
  switch (graphShowAs) {
    case 'free':
      return 'free';
    case 'tentative':
      return 'tentative';
    case 'oof':
    case 'workingElsewhere':
      return 'oof';
    case 'busy':
    default:
      return 'busy';
  }
}

/**
 * Map Graph sensitivity to our format
 */
function mapSensitivity(graphSensitivity?: string | null): Sensitivity {
  switch (graphSensitivity) {
    case 'private':
      return 'private';
    case 'confidential':
      return 'confidential';
    case 'personal':
      return 'personal';
    case 'normal':
    default:
      return 'normal';
  }
}

/**
 * Map Graph response status to our format
 */
function mapResponseStatus(graphResponse?: string | null): ResponseStatus {
  switch (graphResponse) {
    case 'accepted':
      return 'accepted';
    case 'declined':
      return 'declined';
    case 'tentativelyAccepted':
      return 'tentative';
    case 'notResponded':
    case 'none':
    default:
      return 'needsAction';
  }
}

/**
 * Map Graph attendee type to our format
 */
function mapAttendeeType(graphType?: string | null): AttendeeType {
  switch (graphType) {
    case 'optional':
      return 'optional';
    case 'resource':
      return 'resource';
    case 'required':
    default:
      return 'required';
  }
}

/**
 * Map Graph attendee to our format
 */
function mapAttendee(graphAttendee: GraphAttendee): Attendee {
  return {
    email: graphAttendee.emailAddress?.address ?? '',
    name: graphAttendee.emailAddress?.name ?? undefined,
    response: mapResponseStatus(graphAttendee.status?.response),
    type: mapAttendeeType(graphAttendee.type),
  };
}

/**
 * Parse Graph datetime to our format
 */
function parseGraphDateTime(graphDateTime?: GraphDateTime | null): DateTimeWithZone {
  return {
    dateTime: graphDateTime?.dateTime ?? new Date().toISOString(),
    timezone: graphDateTime?.timeZone ?? getDefaultTimezone(),
  };
}

/**
 * Map day of week from Graph format
 */
function mapDayOfWeek(graphDay: string): DayOfWeek {
  const dayMap: Record<string, DayOfWeek> = {
    'sunday': 'sunday',
    'monday': 'monday',
    'tuesday': 'tuesday',
    'wednesday': 'wednesday',
    'thursday': 'thursday',
    'friday': 'friday',
    'saturday': 'saturday',
  };
  return dayMap[graphDay.toLowerCase()] ?? 'monday';
}

/**
 * Parse Graph recurrence to our format
 */
function parseGraphRecurrence(graphRecurrence?: GraphRecurrence | null): RecurrencePattern | undefined {
  if (!graphRecurrence?.pattern || !graphRecurrence?.range) {
    return undefined;
  }

  const pattern = graphRecurrence.pattern;
  const range = graphRecurrence.range;

  // Map pattern type
  let type: RecurrencePattern['type'];
  switch (pattern.type) {
    case 'daily':
      type = 'daily';
      break;
    case 'weekly':
      type = 'weekly';
      break;
    case 'absoluteMonthly':
      type = 'absoluteMonthly';
      break;
    case 'relativeMonthly':
      type = 'relativeMonthly';
      break;
    case 'absoluteYearly':
      type = 'absoluteYearly';
      break;
    case 'relativeYearly':
      type = 'relativeYearly';
      break;
    default:
      return undefined;
  }

  // Map end type
  let endType: RecurrencePattern['endType'];
  switch (range.type) {
    case 'endDate':
      endType = 'endDate';
      break;
    case 'numbered':
      endType = 'numbered';
      break;
    case 'noEnd':
    default:
      endType = 'noEnd';
  }

  const result: RecurrencePattern = {
    type,
    interval: pattern.interval ?? 1,
    startDate: range.startDate ?? new Date().toISOString().split('T')[0]!,
    endType,
  };

  // Add optional fields
  if (pattern.daysOfWeek) {
    result.daysOfWeek = pattern.daysOfWeek.map(mapDayOfWeek);
  }
  if (pattern.dayOfMonth) {
    result.dayOfMonth = pattern.dayOfMonth;
  }
  if (pattern.month) {
    result.month = pattern.month;
  }
  if (range.endDate) {
    result.endDate = range.endDate;
  }
  if (range.numberOfOccurrences) {
    result.numberOfOccurrences = range.numberOfOccurrences;
  }

  // Add human-readable description
  result.humanReadable = formatRecurrencePattern(result);

  return result;
}

/**
 * Detect online meeting provider
 */
function detectMeetingProvider(event: GraphEvent): OnlineMeetingProvider | undefined {
  if (!event.isOnlineMeeting) return undefined;

  const url = event.onlineMeetingUrl ?? event.onlineMeeting?.joinUrl;
  if (url) {
    if (url.includes('teams.microsoft.com')) return 'teams';
    if (url.includes('meet.google.com')) return 'meet';
    if (url.includes('zoom.us')) return 'zoom';
  }

  return 'teams'; // Default for Microsoft
}

/**
 * Map Graph event to our CalendarEvent format
 */
export function mapGraphEvent(graphEvent: GraphEvent, calendarId: string): CalendarEvent {
  const start = parseGraphDateTime(graphEvent.start);
  const end = parseGraphDateTime(graphEvent.end);

  // Determine event status
  let status: EventStatus = 'confirmed';
  if (graphEvent.isCancelled) {
    status = 'cancelled';
  }

  // Map attendees
  const attendees = graphEvent.attendees?.map(mapAttendee) ?? [];

  // Get organizer
  const organizer: Attendee | undefined = graphEvent.organizer?.emailAddress ? {
    email: graphEvent.organizer.emailAddress.address ?? '',
    name: graphEvent.organizer.emailAddress.name ?? undefined,
    response: 'accepted',
    type: 'required',
    isOrganizer: true,
  } : undefined;

  // Parse recurrence
  const recurrence = parseGraphRecurrence(graphEvent.recurrence);
  const isRecurring = !!recurrence || !!graphEvent.seriesMasterId;

  return {
    id: graphEvent.id ?? '',
    provider: 'microsoft',
    calendarId,
    iCalUId: graphEvent.iCalUId ?? undefined,

    subject: graphEvent.subject ?? '(No title)',
    body: graphEvent.body?.content ?? undefined,
    bodyType: graphEvent.body?.contentType === 'html' ? 'html' : 'text',

    start,
    end,
    isAllDay: graphEvent.isAllDay === true,

    isRecurring,
    recurrence,
    seriesMasterId: graphEvent.seriesMasterId ?? undefined,
    instanceDate: graphEvent.originalStart ?? undefined,

    location: graphEvent.location?.displayName ?? undefined,
    isOnlineMeeting: graphEvent.isOnlineMeeting === true,
    onlineMeetingUrl: graphEvent.onlineMeetingUrl ?? graphEvent.onlineMeeting?.joinUrl ?? undefined,
    onlineMeetingProvider: detectMeetingProvider(graphEvent),

    organizer,
    attendees: attendees.filter(a => !a.isOrganizer),
    isOrganizer: graphEvent.isOrganizer === true,

    status,
    showAs: mapShowAs(graphEvent.showAs),
    myResponseStatus: mapResponseStatus(graphEvent.responseStatus?.response),
    sensitivity: mapSensitivity(graphEvent.sensitivity),

    createdAt: graphEvent.createdDateTime ?? new Date().toISOString(),
    updatedAt: graphEvent.lastModifiedDateTime ?? new Date().toISOString(),
    webLink: graphEvent.webLink ?? undefined,
  };
}

/**
 * Convert our event params to Graph format for creating events
 */
export function toGraphEvent(params: CreateEventParams): Record<string, unknown> {
  const event: Record<string, unknown> = {
    subject: params.subject,
  };

  if (params.body) {
    event.body = {
      contentType: params.bodyType === 'html' ? 'html' : 'text',
      content: params.body,
    };
  }

  // DateTime handling
  const timezone = params.timezone ?? getDefaultTimezone();

  if (params.isAllDay) {
    event.isAllDay = true;
    event.start = {
      dateTime: params.startTime.split('T')[0] + 'T00:00:00',
      timeZone: timezone,
    };
    event.end = {
      dateTime: params.endTime.split('T')[0] + 'T00:00:00',
      timeZone: timezone,
    };
  } else {
    event.start = {
      dateTime: params.startTime,
      timeZone: timezone,
    };
    event.end = {
      dateTime: params.endTime,
      timeZone: timezone,
    };
  }

  if (params.location) {
    event.location = { displayName: params.location };
  }

  if (params.attendees && params.attendees.length > 0) {
    event.attendees = params.attendees.map(a => ({
      type: a.type ?? 'required',
      emailAddress: {
        address: a.email,
      },
    }));
  }

  if (params.showAs) {
    event.showAs = params.showAs;
  }

  if (params.sensitivity) {
    event.sensitivity = params.sensitivity;
  }

  if (params.createOnlineMeeting) {
    event.isOnlineMeeting = true;
    event.onlineMeetingProvider = 'teamsForBusiness';
  }

  // Handle recurrence
  if (params.recurrence) {
    const rec = params.recurrence;
    const pattern: Record<string, unknown> = {
      type: rec.type === 'monthly' ? 'absoluteMonthly' : rec.type === 'yearly' ? 'absoluteYearly' : rec.type,
      interval: rec.interval ?? 1,
    };

    if (rec.daysOfWeek && rec.daysOfWeek.length > 0) {
      pattern.daysOfWeek = rec.daysOfWeek;
    }
    if (rec.dayOfMonth) {
      pattern.dayOfMonth = rec.dayOfMonth;
    }

    const range: Record<string, unknown> = {
      type: rec.endDate ? 'endDate' : rec.occurrences ? 'numbered' : 'noEnd',
      startDate: params.startTime.split('T')[0],
    };

    if (rec.endDate) {
      range.endDate = rec.endDate;
    }
    if (rec.occurrences) {
      range.numberOfOccurrences = rec.occurrences;
    }

    event.recurrence = { pattern, range };
  }

  return event;
}

/**
 * Convert our update params to Graph format
 */
export function toGraphEventPatch(params: UpdateEventParams): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (params.subject !== undefined) {
    patch.subject = params.subject;
  }

  if (params.body !== undefined) {
    patch.body = {
      contentType: params.bodyType === 'html' ? 'html' : 'text',
      content: params.body,
    };
  }

  if (params.startTime !== undefined) {
    const timezone = params.timezone ?? getDefaultTimezone();
    patch.start = {
      dateTime: params.startTime,
      timeZone: timezone,
    };
  }

  if (params.endTime !== undefined) {
    const timezone = params.timezone ?? getDefaultTimezone();
    patch.end = {
      dateTime: params.endTime,
      timeZone: timezone,
    };
  }

  if (params.location !== undefined) {
    patch.location = { displayName: params.location };
  }

  if (params.attendees !== undefined) {
    patch.attendees = params.attendees.map(a => ({
      type: a.type ?? 'required',
      emailAddress: {
        address: a.email,
      },
    }));
  }

  if (params.showAs !== undefined) {
    patch.showAs = params.showAs;
  }

  if (params.sensitivity !== undefined) {
    patch.sensitivity = params.sensitivity;
  }

  return patch;
}
