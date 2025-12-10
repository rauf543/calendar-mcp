/**
 * Exchange EWS to Calendar MCP data mapping
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

// EWS type aliases (simplified)
interface EwsCalendarFolder {
  FolderId?: { Id?: string; ChangeKey?: string };
  DisplayName?: string;
}

interface EwsDateTime {
  DateTime?: string;
  TimeZone?: string;
}

interface EwsAttendee {
  Mailbox?: {
    EmailAddress?: string;
    Name?: string;
  };
  ResponseType?: string;
  AttendeeType?: string;
}

interface EwsRecurrence {
  RecurrencePattern?: {
    Type?: string;
    Interval?: number;
    DaysOfWeek?: string[];
    DayOfMonth?: number;
    Month?: number;
  };
  RecurrenceRange?: {
    Type?: string;
    StartDate?: string;
    EndDate?: string;
    NumberOfOccurrences?: number;
  };
}

interface EwsCalendarItem {
  ItemId?: { Id?: string; ChangeKey?: string };
  Subject?: string;
  Body?: { BodyType?: string; Content?: string };
  Start?: string;
  End?: string;
  IsAllDayEvent?: boolean;
  Location?: string;
  RequiredAttendees?: EwsAttendee[];
  OptionalAttendees?: EwsAttendee[];
  Organizer?: {
    Mailbox?: {
      EmailAddress?: string;
      Name?: string;
    };
  };
  LegacyFreeBusyStatus?: string;
  Sensitivity?: string;
  ICalUid?: string;
  Recurrence?: EwsRecurrence;
  RecurrenceMasterId?: string;
  IsRecurring?: boolean;
  IsMeeting?: boolean;
  IsOnlineMeeting?: boolean;
  OnlineMeetingSettings?: {
    JoinUrl?: string;
  };
  WebClientReadFormQueryString?: string;
  DateTimeCreated?: string;
  LastModifiedTime?: string;
  IsCancelled?: boolean;
  MyResponseType?: string;
}

/**
 * Map EWS folder to our Calendar format
 */
export function mapEwsCalendar(ewsFolder: EwsCalendarFolder, providerId: string, email: string): Calendar {
  return {
    id: ewsFolder.FolderId?.Id ?? '',
    provider: 'exchange',
    name: ewsFolder.DisplayName ?? 'Calendar',
    email,
    isPrimary: ewsFolder.DisplayName === 'Calendar',
    canEdit: true,
    accessRole: 'owner',
  };
}

/**
 * Map EWS showAs to our format
 */
function mapShowAs(ewsStatus?: string): ShowAs {
  switch (ewsStatus) {
    case 'Free':
      return 'free';
    case 'Tentative':
      return 'tentative';
    case 'OOF':
      return 'oof';
    case 'WorkingElsewhere':
      return 'workingElsewhere';
    case 'Busy':
    default:
      return 'busy';
  }
}

/**
 * Map EWS sensitivity to our format
 */
function mapSensitivity(ewsSensitivity?: string): Sensitivity {
  switch (ewsSensitivity) {
    case 'Private':
      return 'private';
    case 'Confidential':
      return 'confidential';
    case 'Personal':
      return 'personal';
    case 'Normal':
    default:
      return 'normal';
  }
}

/**
 * Map EWS response status to our format
 */
function mapResponseStatus(ewsResponse?: string): ResponseStatus {
  switch (ewsResponse) {
    case 'Accept':
      return 'accepted';
    case 'Decline':
      return 'declined';
    case 'Tentative':
      return 'tentative';
    case 'Unknown':
    case 'NoResponseReceived':
    default:
      return 'needsAction';
  }
}

/**
 * Map EWS attendee to our format
 */
function mapAttendee(ewsAttendee: EwsAttendee, type: AttendeeType): Attendee {
  return {
    email: ewsAttendee.Mailbox?.EmailAddress ?? '',
    name: ewsAttendee.Mailbox?.Name ?? undefined,
    response: mapResponseStatus(ewsAttendee.ResponseType),
    type,
  };
}

/**
 * Parse EWS datetime to our format
 */
function parseEwsDateTime(dateTimeStr?: string): DateTimeWithZone {
  return {
    dateTime: dateTimeStr ?? new Date().toISOString(),
    timezone: getDefaultTimezone(),
  };
}

/**
 * Map day of week from EWS format
 */
function mapDayOfWeek(ewsDay: string): DayOfWeek {
  const dayMap: Record<string, DayOfWeek> = {
    'Sunday': 'sunday',
    'Monday': 'monday',
    'Tuesday': 'tuesday',
    'Wednesday': 'wednesday',
    'Thursday': 'thursday',
    'Friday': 'friday',
    'Saturday': 'saturday',
  };
  return dayMap[ewsDay] ?? 'monday';
}

/**
 * Parse EWS recurrence to our format
 */
function parseEwsRecurrence(ewsRecurrence?: EwsRecurrence): RecurrencePattern | undefined {
  if (!ewsRecurrence?.RecurrencePattern || !ewsRecurrence?.RecurrenceRange) {
    return undefined;
  }

  const pattern = ewsRecurrence.RecurrencePattern;
  const range = ewsRecurrence.RecurrenceRange;

  // Map pattern type
  let type: RecurrencePattern['type'];
  switch (pattern.Type) {
    case 'Daily':
      type = 'daily';
      break;
    case 'Weekly':
      type = 'weekly';
      break;
    case 'AbsoluteMonthly':
      type = 'absoluteMonthly';
      break;
    case 'RelativeMonthly':
      type = 'relativeMonthly';
      break;
    case 'AbsoluteYearly':
      type = 'absoluteYearly';
      break;
    case 'RelativeYearly':
      type = 'relativeYearly';
      break;
    default:
      return undefined;
  }

  // Map end type
  let endType: RecurrencePattern['endType'];
  switch (range.Type) {
    case 'EndDate':
      endType = 'endDate';
      break;
    case 'Numbered':
      endType = 'numbered';
      break;
    case 'NoEnd':
    default:
      endType = 'noEnd';
  }

  const result: RecurrencePattern = {
    type,
    interval: pattern.Interval ?? 1,
    startDate: range.StartDate ?? new Date().toISOString().split('T')[0]!,
    endType,
  };

  // Add optional fields
  if (pattern.DaysOfWeek) {
    result.daysOfWeek = pattern.DaysOfWeek.map(mapDayOfWeek);
  }
  if (pattern.DayOfMonth) {
    result.dayOfMonth = pattern.DayOfMonth;
  }
  if (pattern.Month) {
    result.month = pattern.Month;
  }
  if (range.EndDate) {
    result.endDate = range.EndDate;
  }
  if (range.NumberOfOccurrences) {
    result.numberOfOccurrences = range.NumberOfOccurrences;
  }

  // Add human-readable description
  result.humanReadable = formatRecurrencePattern(result);

  return result;
}

/**
 * Detect online meeting provider
 */
function detectMeetingProvider(item: EwsCalendarItem): OnlineMeetingProvider | undefined {
  if (!item.IsOnlineMeeting) return undefined;

  const url = item.OnlineMeetingSettings?.JoinUrl;
  if (url) {
    if (url.includes('teams.microsoft.com')) return 'teams';
    if (url.includes('meet.google.com')) return 'meet';
    if (url.includes('zoom.us')) return 'zoom';
  }

  return 'teams'; // Default for Exchange
}

/**
 * Map EWS CalendarItem to our CalendarEvent format
 */
export function mapEwsEvent(ewsItem: EwsCalendarItem, calendarId: string): CalendarEvent {
  const start = parseEwsDateTime(ewsItem.Start);
  const end = parseEwsDateTime(ewsItem.End);

  // Determine event status
  let status: EventStatus = 'confirmed';
  if (ewsItem.IsCancelled) {
    status = 'cancelled';
  }

  // Map attendees
  const requiredAttendees = ewsItem.RequiredAttendees?.map(a => mapAttendee(a, 'required')) ?? [];
  const optionalAttendees = ewsItem.OptionalAttendees?.map(a => mapAttendee(a, 'optional')) ?? [];
  const attendees = [...requiredAttendees, ...optionalAttendees];

  // Get organizer
  const organizer: Attendee | undefined = ewsItem.Organizer?.Mailbox ? {
    email: ewsItem.Organizer.Mailbox.EmailAddress ?? '',
    name: ewsItem.Organizer.Mailbox.Name ?? undefined,
    response: 'accepted',
    type: 'required',
    isOrganizer: true,
  } : undefined;

  // Parse recurrence
  const recurrence = parseEwsRecurrence(ewsItem.Recurrence);
  const isRecurring = !!recurrence || !!ewsItem.RecurrenceMasterId || ewsItem.IsRecurring === true;

  return {
    id: ewsItem.ItemId?.Id ?? '',
    provider: 'exchange',
    calendarId,
    iCalUId: ewsItem.ICalUid ?? undefined,

    subject: ewsItem.Subject ?? '(No title)',
    body: ewsItem.Body?.Content ?? undefined,
    bodyType: ewsItem.Body?.BodyType === 'HTML' ? 'html' : 'text',

    start,
    end,
    isAllDay: ewsItem.IsAllDayEvent === true,

    isRecurring,
    recurrence,
    seriesMasterId: ewsItem.RecurrenceMasterId ?? undefined,

    location: ewsItem.Location ?? undefined,
    isOnlineMeeting: ewsItem.IsOnlineMeeting === true,
    onlineMeetingUrl: ewsItem.OnlineMeetingSettings?.JoinUrl ?? undefined,
    onlineMeetingProvider: detectMeetingProvider(ewsItem),

    organizer,
    attendees: attendees.filter(a => !a.isOrganizer),
    isOrganizer: false, // Would need to check against current user

    status,
    showAs: mapShowAs(ewsItem.LegacyFreeBusyStatus),
    myResponseStatus: mapResponseStatus(ewsItem.MyResponseType),
    sensitivity: mapSensitivity(ewsItem.Sensitivity),

    createdAt: ewsItem.DateTimeCreated ?? new Date().toISOString(),
    updatedAt: ewsItem.LastModifiedTime ?? new Date().toISOString(),
    webLink: ewsItem.WebClientReadFormQueryString ?? undefined,
  };
}

/**
 * Convert our event params to EWS format for creating events
 */
export function toEwsCalendarItem(params: CreateEventParams): Record<string, unknown> {
  const item: Record<string, unknown> = {
    Subject: params.subject,
    Start: params.startTime,
    End: params.endTime,
    IsAllDayEvent: params.isAllDay ?? false,
  };

  if (params.body) {
    item.Body = {
      BodyType: params.bodyType === 'html' ? 'HTML' : 'Text',
      Content: params.body,
    };
  }

  if (params.location) {
    item.Location = params.location;
  }

  if (params.attendees && params.attendees.length > 0) {
    const required = params.attendees
      .filter(a => a.type !== 'optional')
      .map(a => ({ Mailbox: { EmailAddress: a.email } }));
    const optional = params.attendees
      .filter(a => a.type === 'optional')
      .map(a => ({ Mailbox: { EmailAddress: a.email } }));

    if (required.length > 0) {
      item.RequiredAttendees = required;
    }
    if (optional.length > 0) {
      item.OptionalAttendees = optional;
    }
  }

  if (params.showAs) {
    const statusMap: Record<string, string> = {
      'free': 'Free',
      'busy': 'Busy',
      'tentative': 'Tentative',
      'oof': 'OOF',
      'workingElsewhere': 'WorkingElsewhere',
    };
    item.LegacyFreeBusyStatus = statusMap[params.showAs] ?? 'Busy';
  }

  if (params.sensitivity) {
    const sensitivityMap: Record<string, string> = {
      'normal': 'Normal',
      'personal': 'Personal',
      'private': 'Private',
      'confidential': 'Confidential',
    };
    item.Sensitivity = sensitivityMap[params.sensitivity] ?? 'Normal';
  }

  return item;
}

/**
 * Convert our update params to EWS format
 */
export function toEwsCalendarItemUpdate(params: UpdateEventParams): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  if (params.subject !== undefined) {
    updates.Subject = params.subject;
  }

  if (params.body !== undefined) {
    updates.Body = {
      BodyType: params.bodyType === 'html' ? 'HTML' : 'Text',
      Content: params.body,
    };
  }

  if (params.startTime !== undefined) {
    updates.Start = params.startTime;
  }

  if (params.endTime !== undefined) {
    updates.End = params.endTime;
  }

  if (params.location !== undefined) {
    updates.Location = params.location;
  }

  if (params.showAs !== undefined) {
    const statusMap: Record<string, string> = {
      'free': 'Free',
      'busy': 'Busy',
      'tentative': 'Tentative',
      'oof': 'OOF',
      'workingElsewhere': 'WorkingElsewhere',
    };
    updates.LegacyFreeBusyStatus = statusMap[params.showAs] ?? 'Busy';
  }

  if (params.sensitivity !== undefined) {
    const sensitivityMap: Record<string, string> = {
      'normal': 'Normal',
      'personal': 'Personal',
      'private': 'Private',
      'confidential': 'Confidential',
    };
    updates.Sensitivity = sensitivityMap[params.sensitivity] ?? 'Normal';
  }

  return updates;
}
