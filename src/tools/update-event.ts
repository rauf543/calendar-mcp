/**
 * update_event Tool
 * Updates an existing calendar event
 */

import type { CalendarEvent, UpdateEventParams, AttendeeInput } from '../types/index.js';
import type { CalendarService } from '../services/calendar-service.js';
import type { UpdateEventInput } from '../schemas/tool-inputs.js';
import { DateTime } from 'luxon';
import { getDefaultTimezone } from '../utils/datetime.js';

/**
 * Execute update_event tool
 */
export async function executeUpdateEvent(
  input: UpdateEventInput,
  calendarService: CalendarService
): Promise<CalendarEvent> {
  const updates: UpdateEventParams = {};

  // Only include fields that were provided
  if (input.subject !== undefined) updates.subject = input.subject;
  if (input.body !== undefined) updates.body = input.body;
  if (input.bodyType !== undefined) updates.bodyType = input.bodyType;
  if (input.startTime !== undefined) updates.startTime = input.startTime;
  if (input.endTime !== undefined) updates.endTime = input.endTime;
  if (input.timezone !== undefined) updates.timezone = input.timezone;
  if (input.location !== undefined) updates.location = input.location;
  if (input.attendees !== undefined) updates.attendees = input.attendees as AttendeeInput[];
  if (input.showAs !== undefined) updates.showAs = input.showAs;
  if (input.sensitivity !== undefined) updates.sensitivity = input.sensitivity;
  if (input.updateScope !== undefined) updates.updateScope = input.updateScope;
  if (input.sendUpdates !== undefined) updates.sendUpdates = input.sendUpdates;

  return calendarService.updateEvent(
    input.eventId,
    updates,
    input.provider,
    input.calendarId
  );
}

/**
 * Format result for MCP response
 */
export function formatUpdateEventResult(event: CalendarEvent): string {
  const lines: string[] = [];
  const displayTimezone = getDefaultTimezone();

  lines.push('✅ Event updated successfully!');
  lines.push('');
  lines.push(`**${event.subject}**`);

  const startDt = DateTime.fromISO(event.start.dateTime).setZone(displayTimezone);
  const endDt = DateTime.fromISO(event.end.dateTime).setZone(displayTimezone);

  if (event.isAllDay) {
    lines.push(`📅 ${startDt.toFormat('cccc, MMMM d, yyyy')} (All day)`);
  } else {
    lines.push(`📅 ${startDt.toFormat('cccc, MMMM d, yyyy')}`);
    lines.push(`🕐 ${startDt.toFormat('h:mm a')} - ${endDt.toFormat('h:mm a')} (${displayTimezone})`);
  }

  if (event.location) {
    lines.push(`📍 ${event.location}`);
  }

  if (event.isOnlineMeeting && event.onlineMeetingUrl) {
    lines.push(`📹 Online meeting: ${event.onlineMeetingUrl}`);
  }

  lines.push('');
  lines.push(`Provider: ${event.provider}`);
  lines.push(`Event ID: ${event.id}`);

  return lines.join('\n');
}
