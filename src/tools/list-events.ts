/**
 * list_events Tool
 * Lists events within a time range across providers
 */

import type { CalendarEvent, ProviderError, ListEventsParams } from '../types/index.js';
import type { CalendarService } from '../services/calendar-service.js';
import type { ListEventsInput } from '../schemas/tool-inputs.js';
import { formatDateTime } from '../utils/datetime.js';
import { DateTime } from 'luxon';

export interface ListEventsResult {
  events: CalendarEvent[];
  totalCount: number;
  partialSuccess?: boolean;
  errors?: ProviderError[];
}

/**
 * Execute list_events tool
 */
export async function executeListEvents(
  input: ListEventsInput,
  calendarService: CalendarService
): Promise<ListEventsResult> {
  const params: ListEventsParams = {
    startTime: input.startTime,
    endTime: input.endTime,
    providers: input.providers,
    calendarIds: input.calendarIds,
    searchQuery: input.searchQuery,
    expandRecurring: input.expandRecurring,
    maxResults: input.maxResults,
    orderBy: input.orderBy,
  };

  const result = await calendarService.listAllEvents(params);

  return {
    events: result.events,
    totalCount: result.events.length,
    partialSuccess: result.partialSuccess,
    errors: result.errors,
  };
}

/**
 * Format result for MCP response
 */
export function formatListEventsResult(result: ListEventsResult): string {
  const lines: string[] = [];

  if (result.events.length === 0) {
    lines.push('No events found in the specified time range.');
    if (result.errors && result.errors.length > 0) {
      lines.push('');
      lines.push('Errors occurred:');
      for (const error of result.errors) {
        lines.push(`  - ${error.provider}: ${error.message}`);
      }
    }
    return lines.join('\n');
  }

  lines.push(`Found ${result.totalCount} event(s):\n`);

  // Group events by date
  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of result.events) {
    const dt = DateTime.fromISO(event.start.dateTime);
    const dateKey = dt.toFormat('yyyy-MM-dd');
    const existing = byDate.get(dateKey) ?? [];
    existing.push(event);
    byDate.set(dateKey, existing);
  }

  for (const [dateKey, events] of byDate) {
    const dt = DateTime.fromISO(dateKey);
    lines.push(`**${dt.toFormat('cccc, MMMM d, yyyy')}**`);

    for (const event of events) {
      const startTime = DateTime.fromISO(event.start.dateTime);
      const endTime = DateTime.fromISO(event.end.dateTime);

      let timeStr: string;
      if (event.isAllDay) {
        timeStr = 'All day';
      } else {
        timeStr = `${startTime.toFormat('h:mm a')} - ${endTime.toFormat('h:mm a')}`;
      }

      const providerBadge = `[${event.provider}]`;
      const recurringBadge = event.isRecurring ? ' 🔁' : '';
      const meetingBadge = event.isOnlineMeeting ? ' 📹' : '';

      lines.push(`  ${timeStr} ${providerBadge}${recurringBadge}${meetingBadge}`);
      lines.push(`    **${event.subject}**`);

      if (event.location) {
        lines.push(`    📍 ${event.location}`);
      }

      if (event.attendees && event.attendees.length > 0) {
        const attendeeCount = event.attendees.length;
        lines.push(`    👥 ${attendeeCount} attendee(s)`);
      }

      lines.push(`    ID: ${event.id}`);
      lines.push('');
    }
  }

  if (result.partialSuccess) {
    lines.push('⚠️ Results may be incomplete due to provider errors.');
  }

  if (result.errors && result.errors.length > 0) {
    lines.push('Provider errors:');
    for (const error of result.errors) {
      lines.push(`  - ${error.provider}: ${error.message}`);
    }
  }

  return lines.join('\n');
}
