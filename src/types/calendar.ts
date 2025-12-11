/**
 * Core calendar data types
 * These represent the unified data model used across all providers
 */

export type ProviderType = 'exchange' | 'google' | 'microsoft';

export type EventStatus = 'confirmed' | 'tentative' | 'cancelled';

export type ShowAs = 'free' | 'busy' | 'tentative' | 'oof' | 'workingElsewhere';

export type ResponseStatus = 'accepted' | 'declined' | 'tentative' | 'needsAction';

export type AttendeeType = 'required' | 'optional' | 'resource';

export type Sensitivity = 'normal' | 'personal' | 'private' | 'confidential';

export type BodyType = 'text' | 'html';

export type OnlineMeetingProvider = 'teams' | 'meet' | 'zoom' | 'other';

export type ReminderMethod = 'popup' | 'email';

/**
 * Represents a calendar from any provider
 */
export interface Calendar {
  /** Provider-specific calendar ID */
  id: string;
  /** Which provider this calendar belongs to */
  provider: ProviderType;
  /** Display name of the calendar */
  name: string;
  /** Email address associated with the calendar */
  email: string;
  /** Whether this is the primary/default calendar */
  isPrimary: boolean;
  /** Whether the user can edit this calendar */
  canEdit: boolean;
  /** Calendar color (hex or provider-specific) */
  color?: string;
  /** Optional description */
  description?: string;
  /** Timezone for this calendar */
  timezone?: string;
  /** User's access role (owner, writer, reader, etc.) */
  accessRole?: string;
}

/**
 * Represents an attendee or organizer
 */
export interface Attendee {
  /** Email address */
  email: string;
  /** Display name */
  name?: string;
  /** Response status */
  response: ResponseStatus;
  /** Whether required, optional, or a resource */
  type: AttendeeType;
  /** Whether this person is the organizer */
  isOrganizer?: boolean;
}

/**
 * Date/time with timezone information
 */
export interface DateTimeWithZone {
  /** ISO 8601 datetime string */
  dateTime: string;
  /** IANA timezone identifier (e.g., 'America/New_York') */
  timezone: string;
}

/**
 * Reminder configuration
 */
export interface Reminder {
  /** How to remind (popup or email) */
  method: ReminderMethod;
  /** Minutes before the event to remind */
  minutes: number;
}

/**
 * Reminders configuration for an event
 */
export interface EventReminders {
  /** Whether to use the calendar's default reminders */
  useDefault: boolean;
  /** Custom reminder overrides */
  overrides?: Reminder[];
}

/**
 * Unified calendar event representation
 * This is the standardized format used across all providers
 */
export interface CalendarEvent {
  // ─────────────────────────────────────────────────────────────────────────────
  // Identifiers
  // ─────────────────────────────────────────────────────────────────────────────
  /** Provider-specific event ID */
  id: string;
  /** Which provider this event belongs to */
  provider: ProviderType;
  /** Calendar ID this event belongs to */
  calendarId: string;
  /** Email/account associated with this calendar (for display when multiple accounts exist) */
  calendarEmail?: string;
  /** Universal calendar ID (iCalendar UID) for cross-provider matching */
  iCalUId?: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Content
  // ─────────────────────────────────────────────────────────────────────────────
  /** Event title/subject */
  subject: string;
  /** Event description/body */
  body?: string;
  /** Body content type */
  bodyType?: BodyType;

  // ─────────────────────────────────────────────────────────────────────────────
  // Timing
  // ─────────────────────────────────────────────────────────────────────────────
  /** Event start time */
  start: DateTimeWithZone;
  /** Event end time */
  end: DateTimeWithZone;
  /** Whether this is an all-day event */
  isAllDay: boolean;

  // ─────────────────────────────────────────────────────────────────────────────
  // Recurrence
  // ─────────────────────────────────────────────────────────────────────────────
  /** Whether this event is recurring */
  isRecurring: boolean;
  /** Recurrence pattern (for series master) */
  recurrence?: import('./recurrence.js').RecurrencePattern;
  /** ID of the series master (for instances) */
  seriesMasterId?: string;
  /** Original date of this instance (for modified instances) */
  instanceDate?: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Location
  // ─────────────────────────────────────────────────────────────────────────────
  /** Physical location or room name */
  location?: string;
  /** Whether this is an online meeting */
  isOnlineMeeting: boolean;
  /** URL to join the online meeting */
  onlineMeetingUrl?: string;
  /** Online meeting provider (Teams, Meet, Zoom) */
  onlineMeetingProvider?: OnlineMeetingProvider;

  // ─────────────────────────────────────────────────────────────────────────────
  // People
  // ─────────────────────────────────────────────────────────────────────────────
  /** Event organizer */
  organizer?: Attendee;
  /** Event attendees */
  attendees?: Attendee[];
  /** Whether the current user is the organizer */
  isOrganizer: boolean;

  // ─────────────────────────────────────────────────────────────────────────────
  // Status
  // ─────────────────────────────────────────────────────────────────────────────
  /** Event status (confirmed, tentative, cancelled) */
  status: EventStatus;
  /** How to show the time (busy, free, etc.) */
  showAs: ShowAs;
  /** Current user's response status */
  myResponseStatus?: ResponseStatus;
  /** Event sensitivity/privacy level */
  sensitivity: Sensitivity;

  // ─────────────────────────────────────────────────────────────────────────────
  // Metadata
  // ─────────────────────────────────────────────────────────────────────────────
  /** When the event was created */
  createdAt: string;
  /** When the event was last updated */
  updatedAt: string;
  /** Link to open the event in web client */
  webLink?: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Reminders
  // ─────────────────────────────────────────────────────────────────────────────
  /** Reminder configuration */
  reminders?: EventReminders;
}

/**
 * Parameters for listing events
 */
export interface ListEventsParams {
  /** Start of time range (ISO 8601) - REQUIRED */
  startTime: string;
  /** End of time range (ISO 8601) - REQUIRED */
  endTime: string;
  /** Filter to specific providers */
  providers?: ProviderType[];
  /** Filter to specific calendar IDs */
  calendarIds?: string[];
  /** Text search in subject/body */
  searchQuery?: string;
  /** Whether to expand recurring events into instances (default: true) */
  expandRecurring?: boolean;
  /** Maximum number of results (default: 100) */
  maxResults?: number;
  /** Sort order (default: 'start') */
  orderBy?: 'start' | 'updated';
}

/**
 * Parameters for creating an event
 */
export interface CreateEventParams {
  /** Event title/subject - REQUIRED */
  subject: string;
  /** Event description/body */
  body?: string;
  /** Body content type */
  bodyType?: BodyType;
  /** Start time (ISO 8601) - REQUIRED */
  startTime: string;
  /** End time (ISO 8601) - REQUIRED */
  endTime: string;
  /** Timezone (default: user's timezone) */
  timezone?: string;
  /** Whether this is an all-day event */
  isAllDay?: boolean;
  /** Physical location */
  location?: string;
  /** Whether to create an online meeting */
  createOnlineMeeting?: boolean;
  /** Online meeting provider preference */
  onlineMeetingProvider?: 'teams' | 'meet';
  /** Event attendees */
  attendees?: Array<{
    email: string;
    type?: AttendeeType;
  }>;
  /** Recurrence configuration */
  recurrence?: {
    type: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval?: number;
    daysOfWeek?: string[];
    dayOfMonth?: number;
    endDate?: string;
    occurrences?: number;
  };
  /** How to show the time */
  showAs?: ShowAs;
  /** Event sensitivity */
  sensitivity?: Sensitivity;
  /** Whether to send invites (default: true if attendees present) */
  sendInvites?: boolean;
  /** Reminder in minutes before event */
  reminderMinutes?: number;
}

/**
 * Parameters for updating an event
 */
export interface UpdateEventParams {
  /** New event title */
  subject?: string;
  /** New event body */
  body?: string;
  /** New body type */
  bodyType?: BodyType;
  /** New start time */
  startTime?: string;
  /** New end time */
  endTime?: string;
  /** New timezone */
  timezone?: string;
  /** New location */
  location?: string;
  /** Updated attendees */
  attendees?: Array<{
    email: string;
    type?: AttendeeType;
  }>;
  /** New show-as status */
  showAs?: ShowAs;
  /** New sensitivity */
  sensitivity?: Sensitivity;
  /** For recurring events: what to update */
  updateScope?: 'single' | 'thisAndFuture' | 'all';
  /** Whether to send updates to attendees (default: true) */
  sendUpdates?: boolean;
}

/**
 * Options for deleting an event
 */
export interface DeleteOptions {
  /** For recurring events: what to delete */
  deleteScope?: 'single' | 'thisAndFuture' | 'all';
  /** Whether to send cancellation notices (default: true if has attendees) */
  sendCancellation?: boolean;
}

/**
 * Response type for meeting invitations
 */
export type ResponseType = 'accepted' | 'declined' | 'tentative';

/**
 * Input type for attendees when creating/updating events
 */
export interface AttendeeInput {
  email: string;
  type?: AttendeeType;
}

/**
 * Input type for recurrence when creating events
 */
export interface RecurrenceInput {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  daysOfWeek?: string[];
  dayOfMonth?: number;
  endDate?: string;
  occurrences?: number;
}
