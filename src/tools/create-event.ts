/**
 * create_event Tool
 * Creates a new calendar event
 */

import type { CalendarEvent, CreateEventParams, AttendeeInput, RecurrenceInput } from '../types/index.js';
import type { CalendarService } from '../services/calendar-service.js';
import type { CreateEventInput } from '../schemas/tool-inputs.js';
import { DateTime } from 'luxon';

/**
 * Execute create_event tool
 */
export async function executeCreateEvent(
  input: CreateEventInput,
  calendarService: CalendarService
): Promise<CalendarEvent> {
  const params: CreateEventParams = {
    subject: input.subject,
    body: input.body,
    bodyType: input.bodyType,
    startTime: input.startTime,
    endTime: input.endTime,
    timezone: input.timezone,
    isAllDay: input.isAllDay,
    location: input.location,
    createOnlineMeeting: input.createOnlineMeeting,
    onlineMeetingProvider: input.onlineMeetingProvider,
    attendees: input.attendees as AttendeeInput[] | undefined,
    recurrence: input.recurrence as RecurrenceInput | undefined,
    showAs: input.showAs,
    sensitivity: input.sensitivity,
    sendInvites: input.sendInvites,
    reminderMinutes: input.reminderMinutes,
  };

  return calendarService.createEvent(params, input.provider, input.calendarId);
}

/**
 * Format result for MCP response
 */
export function formatCreateEventResult(event: CalendarEvent): string {
  const lines: string[] = [];

  lines.push('✅ Event created successfully!');
  lines.push('');
  lines.push(`**${event.subject}**`);

  const startDt = DateTime.fromISO(event.start.dateTime);
  const endDt = DateTime.fromISO(event.end.dateTime);

  if (event.isAllDay) {
    lines.push(`📅 ${startDt.toFormat('cccc, MMMM d, yyyy')} (All day)`);
  } else {
    lines.push(`📅 ${startDt.toFormat('cccc, MMMM d, yyyy')}`);
    lines.push(`🕐 ${startDt.toFormat('h:mm a')} - ${endDt.toFormat('h:mm a')}`);
  }

  if (event.location) {
    lines.push(`📍 ${event.location}`);
  }

  if (event.isOnlineMeeting && event.onlineMeetingUrl) {
    lines.push(`📹 Online meeting: ${event.onlineMeetingUrl}`);
  }

  if (event.attendees && event.attendees.length > 0) {
    lines.push(`👥 ${event.attendees.length} attendee(s) invited`);
  }

  lines.push('');
  lines.push(`Provider: ${event.provider}`);
  lines.push(`Event ID: ${event.id}`);

  return lines.join('\n');
}
