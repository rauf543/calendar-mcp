/**
 * Zod schemas for MCP tool inputs
 */

import { z } from 'zod';
import {
  ProviderTypeSchema,
  ShowAsSchema,
  SensitivitySchema,
  BodyTypeSchema,
  AttendeeInputSchema,
  RecurrenceInputSchema,
  UpdateScopeSchema,
  DeleteScopeSchema,
  ResponseTypeSchema,
  WorkingHoursSchema,
  OrderBySchema,
  ISODateTimeSchema,
} from './common.js';

// ─────────────────────────────────────────────────────────────────────────────
// list_calendars
// ─────────────────────────────────────────────────────────────────────────────

export const ListCalendarsInputSchema = z.object({
  provider: ProviderTypeSchema.or(z.literal('all')).optional().default('all')
    .describe('Filter by provider type, or "all" for all providers'),
});

export type ListCalendarsInput = z.infer<typeof ListCalendarsInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// list_events
// ─────────────────────────────────────────────────────────────────────────────

export const ListEventsInputSchema = z.object({
  startTime: ISODateTimeSchema.describe('Start of time range (ISO 8601)'),
  endTime: ISODateTimeSchema.describe('End of time range (ISO 8601)'),
  providers: z.array(ProviderTypeSchema).optional()
    .describe('Filter to specific providers'),
  calendarIds: z.array(z.string()).optional()
    .describe('Filter to specific calendar IDs'),
  searchQuery: z.string().optional()
    .describe('Text search in subject/body'),
  expandRecurring: z.boolean().optional().default(true)
    .describe('Whether to expand recurring events into instances'),
  maxResults: z.number().int().positive().max(500).optional().default(100)
    .describe('Maximum number of results'),
  orderBy: OrderBySchema.optional().default('start')
    .describe('Sort order'),
});

export type ListEventsInput = z.infer<typeof ListEventsInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// get_event
// ─────────────────────────────────────────────────────────────────────────────

export const GetEventInputSchema = z.object({
  eventId: z.string().min(1).describe('Event ID'),
  provider: ProviderTypeSchema.describe('Which provider the event belongs to'),
  calendarId: z.string().optional()
    .describe('Calendar ID (required for some providers)'),
});

export type GetEventInput = z.infer<typeof GetEventInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// create_event
// ─────────────────────────────────────────────────────────────────────────────

export const CreateEventInputSchema = z.object({
  provider: ProviderTypeSchema.describe('Which provider to create the event on'),
  calendarId: z.string().optional()
    .describe('Calendar ID (default: primary)'),
  subject: z.string().min(1).max(500).describe('Event title/subject'),
  body: z.string().max(10000).optional()
    .describe('Event description/body'),
  bodyType: BodyTypeSchema.optional().default('text')
    .describe('Body content type'),
  startTime: ISODateTimeSchema.describe('Start time (ISO 8601)'),
  endTime: ISODateTimeSchema.describe('End time (ISO 8601)'),
  timezone: z.string().optional()
    .describe('Timezone (IANA format, default: user timezone)'),
  isAllDay: z.boolean().optional().default(false)
    .describe('Whether this is an all-day event'),
  location: z.string().max(500).optional()
    .describe('Physical location'),
  createOnlineMeeting: z.boolean().optional().default(false)
    .describe('Whether to create an online meeting'),
  onlineMeetingProvider: z.enum(['teams', 'meet']).optional()
    .describe('Online meeting provider preference'),
  attendees: z.array(AttendeeInputSchema).optional()
    .describe('Event attendees'),
  recurrence: RecurrenceInputSchema.optional()
    .describe('Recurrence configuration'),
  showAs: ShowAsSchema.optional().default('busy')
    .describe('How to show the time'),
  sensitivity: SensitivitySchema.optional().default('normal')
    .describe('Event sensitivity'),
  sendInvites: z.boolean().optional()
    .describe('Whether to send invites (default: true if attendees present)'),
  reminderMinutes: z.number().int().min(0).max(40320).optional()
    .describe('Reminder in minutes before event'),
});

export type CreateEventInput = z.infer<typeof CreateEventInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// update_event
// ─────────────────────────────────────────────────────────────────────────────

export const UpdateEventInputSchema = z.object({
  eventId: z.string().min(1).describe('Event ID'),
  provider: ProviderTypeSchema.describe('Which provider the event belongs to'),
  calendarId: z.string().optional()
    .describe('Calendar ID'),
  subject: z.string().min(1).max(500).optional()
    .describe('New event title'),
  body: z.string().max(10000).optional()
    .describe('New event body'),
  bodyType: BodyTypeSchema.optional()
    .describe('Body content type'),
  startTime: ISODateTimeSchema.optional()
    .describe('New start time'),
  endTime: ISODateTimeSchema.optional()
    .describe('New end time'),
  timezone: z.string().optional()
    .describe('New timezone'),
  location: z.string().max(500).optional()
    .describe('New location'),
  attendees: z.array(AttendeeInputSchema).optional()
    .describe('Updated attendees'),
  showAs: ShowAsSchema.optional()
    .describe('New show-as status'),
  sensitivity: SensitivitySchema.optional()
    .describe('New sensitivity'),
  updateScope: UpdateScopeSchema.optional().default('single')
    .describe('For recurring events: what to update'),
  sendUpdates: z.boolean().optional().default(true)
    .describe('Whether to send updates to attendees'),
});

export type UpdateEventInput = z.infer<typeof UpdateEventInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// delete_event
// ─────────────────────────────────────────────────────────────────────────────

export const DeleteEventInputSchema = z.object({
  eventId: z.string().min(1).describe('Event ID'),
  provider: ProviderTypeSchema.describe('Which provider the event belongs to'),
  calendarId: z.string().optional()
    .describe('Calendar ID'),
  deleteScope: DeleteScopeSchema.optional().default('single')
    .describe('For recurring events: what to delete'),
  sendCancellation: z.boolean().optional()
    .describe('Whether to send cancellation notices (default: true if has attendees)'),
});

export type DeleteEventInput = z.infer<typeof DeleteEventInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// get_free_busy
// ─────────────────────────────────────────────────────────────────────────────

export const GetFreeBusyInputSchema = z.object({
  startTime: ISODateTimeSchema.describe('Start of time range (ISO 8601)'),
  endTime: ISODateTimeSchema.describe('End of time range (ISO 8601)'),
  providers: z.array(ProviderTypeSchema).optional()
    .describe('Filter to specific providers'),
  calendarIds: z.array(z.string()).optional()
    .describe('Filter to specific calendar IDs'),
  slotDuration: z.number().int().positive().optional()
    .describe('Minimum slot duration in minutes (for finding free slots)'),
  workingHoursOnly: z.boolean().optional().default(false)
    .describe('Only consider working hours'),
  workingHours: WorkingHoursSchema.optional()
    .describe('Custom working hours configuration'),
});

export type GetFreeBusyInput = z.infer<typeof GetFreeBusyInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// check_conflicts
// ─────────────────────────────────────────────────────────────────────────────

export const CheckConflictsInputSchema = z.object({
  startTime: ISODateTimeSchema.describe('Proposed start time (ISO 8601)'),
  endTime: ISODateTimeSchema.describe('Proposed end time (ISO 8601)'),
  excludeEventId: z.string().optional()
    .describe('Event ID to exclude (for rescheduling)'),
  excludeProvider: ProviderTypeSchema.optional()
    .describe('Provider of excluded event'),
});

export type CheckConflictsInput = z.infer<typeof CheckConflictsInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// respond_to_invite
// ─────────────────────────────────────────────────────────────────────────────

export const RespondToInviteInputSchema = z.object({
  eventId: z.string().min(1).describe('Event ID'),
  provider: ProviderTypeSchema.describe('Which provider the event belongs to'),
  calendarId: z.string().optional()
    .describe('Calendar ID'),
  response: ResponseTypeSchema.describe('Response: accepted, declined, or tentative'),
  message: z.string().max(1000).optional()
    .describe('Optional response message'),
});

export type RespondToInviteInput = z.infer<typeof RespondToInviteInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// find_matching_events (sync helper)
// ─────────────────────────────────────────────────────────────────────────────

export const FindMatchingEventsInputSchema = z.object({
  eventId: z.string().min(1).describe('Source event ID'),
  sourceProvider: ProviderTypeSchema.describe('Provider of source event'),
  sourceCalendarId: z.string().optional()
    .describe('Calendar ID of source event'),
  targetProviders: z.array(ProviderTypeSchema).optional()
    .describe('Providers to search (default: all except source)'),
  matchingStrategy: z.object({
    useSubject: z.boolean().optional().default(true),
    useTime: z.boolean().optional().default(true),
    useTimeWindow: z.number().int().min(0).max(60).optional(),
    useAttendees: z.boolean().optional().default(true),
    useICalUID: z.boolean().optional().default(true),
  }).optional(),
  timeRange: z.object({
    startTime: ISODateTimeSchema,
    endTime: ISODateTimeSchema,
  }).optional(),
});

export type FindMatchingEventsInput = z.infer<typeof FindMatchingEventsInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// copy_event (sync helper)
// ─────────────────────────────────────────────────────────────────────────────

export const CopyEventInputSchema = z.object({
  eventId: z.string().min(1).describe('Source event ID'),
  sourceProvider: ProviderTypeSchema.describe('Source provider'),
  sourceCalendarId: z.string().optional(),
  targetProvider: ProviderTypeSchema.describe('Target provider'),
  targetCalendarId: z.string().optional()
    .describe('Target calendar ID (default: primary)'),
  modifications: z.object({
    subject: z.string().optional(),
    body: z.string().optional(),
    location: z.string().optional(),
    showAs: ShowAsSchema.optional(),
    sensitivity: SensitivitySchema.optional(),
    removeAttendees: z.boolean().optional().default(false),
    addToBody: z.string().optional(),
  }).optional(),
  addSyncMarker: z.boolean().optional().default(true)
    .describe('Add marker to identify synced events'),
  syncMarkerFormat: z.string().optional(),
});

export type CopyEventInput = z.infer<typeof CopyEventInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// compare_calendars (sync helper)
// ─────────────────────────────────────────────────────────────────────────────

export const CompareCalendarsInputSchema = z.object({
  sourceProvider: ProviderTypeSchema.describe('Source provider'),
  sourceCalendarId: z.string().optional(),
  targetProvider: ProviderTypeSchema.describe('Target provider'),
  targetCalendarId: z.string().optional(),
  startTime: ISODateTimeSchema.describe('Start of comparison range'),
  endTime: ISODateTimeSchema.describe('End of comparison range'),
  matchingOptions: z.object({
    useICalUID: z.boolean().optional().default(true),
    timeToleranceMinutes: z.number().int().min(0).max(60).optional().default(5),
    subjectSimilarityThreshold: z.number().min(0).max(1).optional().default(0.8),
  }).optional(),
  excludeAllDay: z.boolean().optional().default(false),
  excludeRecurring: z.boolean().optional().default(false),
  excludeSyncedEvents: z.boolean().optional().default(false),
});

export type CompareCalendarsInput = z.infer<typeof CompareCalendarsInputSchema>;
