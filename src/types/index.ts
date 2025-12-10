/**
 * Type exports for Calendar MCP
 */

// Calendar types
export type {
  ProviderType,
  EventStatus,
  ShowAs,
  ResponseStatus,
  AttendeeType,
  Sensitivity,
  BodyType,
  OnlineMeetingProvider,
  ReminderMethod,
  Calendar,
  Attendee,
  DateTimeWithZone,
  Reminder,
  EventReminders,
  CalendarEvent,
  ListEventsParams,
  CreateEventParams,
  UpdateEventParams,
  DeleteOptions,
  ResponseType,
  AttendeeInput,
  RecurrenceInput,
} from './calendar.js';

// Recurrence types
export type {
  RecurrenceType,
  DayOfWeek,
  WeekIndex,
  RecurrenceEndType,
  RecurrencePattern,
  SimpleRecurrenceInput,
} from './recurrence.js';

export { toRecurrencePattern, formatRecurrencePattern } from './recurrence.js';

// Free/Busy types
export type {
  BusyStatus,
  TimeSlot,
  BusySlot,
  FreeSlot,
  WorkingHours,
  FreeBusyParams,
  CalendarFreeBusy,
  FreeBusyResponse,
  CheckConflictsParams,
  ConflictCheckResult,
} from './free-busy.js';

// Provider types
export type {
  BaseProviderConfig,
  GoogleProviderConfig,
  MicrosoftProviderConfig,
  ExchangeAuthMethod,
  ExchangeProviderConfig,
  ProviderConfig,
  ProviderError,
  ListEventsResult,
  ICalendarProvider,
  ProviderFactory,
  ProviderHealthStatus,
} from './provider.js';
