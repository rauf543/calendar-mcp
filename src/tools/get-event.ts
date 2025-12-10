/**
 * get_event Tool
 * Retrieves a single event by ID
 */

import type { CalendarEvent } from '../types/index.js';
import type { CalendarService } from '../services/calendar-service.js';
import type { GetEventInput } from '../schemas/tool-inputs.js';
import { DateTime } from 'luxon';

/**
 * Execute get_event tool
 */
export async function executeGetEvent(
  input: GetEventInput,
  calendarService: CalendarService
): Promise<CalendarEvent> {
  return calendarService.getEvent(input.eventId, input.provider, input.calendarId);
}

/**
 * Format result for MCP response
 */
export function formatGetEventResult(event: CalendarEvent): string {
  const lines: string[] = [];

  lines.push(`**${event.subject}**`);
  lines.push('');

  // Date and time
  const startDt = DateTime.fromISO(event.start.dateTime);
  const endDt = DateTime.fromISO(event.end.dateTime);

  if (event.isAllDay) {
    if (startDt.hasSame(endDt, 'day')) {
      lines.push(`📅 ${startDt.toFormat('cccc, MMMM d, yyyy')} (All day)`);
    } else {
      lines.push(`📅 ${startDt.toFormat('MMMM d')} - ${endDt.toFormat('MMMM d, yyyy')} (All day)`);
    }
  } else {
    if (startDt.hasSame(endDt, 'day')) {
      lines.push(`📅 ${startDt.toFormat('cccc, MMMM d, yyyy')}`);
      lines.push(`🕐 ${startDt.toFormat('h:mm a')} - ${endDt.toFormat('h:mm a')} (${event.start.timezone})`);
    } else {
      lines.push(`📅 ${startDt.toFormat('MMM d, h:mm a')} - ${endDt.toFormat('MMM d, h:mm a, yyyy')}`);
    }
  }

  lines.push('');

  // Location
  if (event.location) {
    lines.push(`📍 **Location:** ${event.location}`);
  }

  // Online meeting
  if (event.isOnlineMeeting && event.onlineMeetingUrl) {
    lines.push(`📹 **Online Meeting:** ${event.onlineMeetingUrl}`);
  }

  // Organizer
  if (event.organizer) {
    const orgName = event.organizer.name ?? event.organizer.email;
    lines.push(`👤 **Organizer:** ${orgName}`);
  }

  // Attendees
  if (event.attendees && event.attendees.length > 0) {
    lines.push(`👥 **Attendees (${event.attendees.length}):**`);
    for (const attendee of event.attendees) {
      const name = attendee.name ?? attendee.email;
      const response = attendee.response ?? 'unknown';
      const type = attendee.type !== 'required' ? ` (${attendee.type})` : '';
      lines.push(`   - ${name} [${response}]${type}`);
    }
  }

  lines.push('');

  // Body/description
  if (event.body) {
    lines.push('**Description:**');
    lines.push(event.body.substring(0, 500));
    if (event.body.length > 500) {
      lines.push('... (truncated)');
    }
  }

  lines.push('');

  // Metadata
  lines.push('**Details:**');
  lines.push(`- Provider: ${event.provider}`);
  lines.push(`- Calendar: ${event.calendarId}`);
  lines.push(`- Status: ${event.status}`);
  lines.push(`- Show as: ${event.showAs}`);
  lines.push(`- Sensitivity: ${event.sensitivity}`);

  if (event.isRecurring) {
    lines.push('- Recurring: Yes');
    if (event.recurrence) {
      lines.push(`- Pattern: ${event.recurrence.humanReadable ?? event.recurrence.pattern}`);
    }
  }

  lines.push(`- ID: ${event.id}`);

  return lines.join('\n');
}
