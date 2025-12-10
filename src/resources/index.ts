/**
 * MCP Resources for Calendar
 * Provides read-only access to calendar data via URI-based resources
 */

import type { CalendarService } from '../services/calendar-service.js';
import type { FreeBusyService } from '../services/free-busy-service.js';
import type { Calendar } from '../types/index.js';
import { DateTime } from 'luxon';
import { getDefaultTimezone } from '../utils/datetime.js';

/**
 * Resource types available
 */
export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

/**
 * Resource list
 */
export const resourceDefinitions: ResourceDefinition[] = [
  {
    uri: 'calendar://summary',
    name: 'Calendar Summary',
    description: 'Overview of connected calendars and upcoming events count',
    mimeType: 'application/json',
  },
  {
    uri: 'calendar://today',
    name: "Today's Events",
    description: "All events scheduled for today across all calendars",
    mimeType: 'application/json',
  },
  {
    uri: 'calendar://week',
    name: "This Week's Events",
    description: 'All events scheduled for the current week',
    mimeType: 'application/json',
  },
  {
    uri: 'calendar://next/5',
    name: 'Next 5 Events',
    description: 'The next 5 upcoming events across all calendars',
    mimeType: 'application/json',
  },
];

/**
 * Resource handler type
 */
export type ResourceHandler = () => Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }>;

/**
 * Create resource handlers
 */
export function createResourceHandlers(
  calendarService: CalendarService,
  freeBusyService: FreeBusyService
): Record<string, ResourceHandler> {
  const timezone = getDefaultTimezone();

  return {
    'calendar://summary': async () => {
      const calendarResult = await calendarService.listAllCalendars();
      const calendars = calendarResult.calendars;
      const now = DateTime.now().setZone(timezone);
      const endOfDay = now.endOf('day');
      const endOfWeek = now.endOf('week');

      // Get today's events count
      const todayResult = await calendarService.listAllEvents({
        startTime: now.toISO()!,
        endTime: endOfDay.toISO()!,
      });

      // Get this week's events count
      const weekResult = await calendarService.listAllEvents({
        startTime: now.toISO()!,
        endTime: endOfWeek.toISO()!,
      });

      const summary = {
        timestamp: now.toISO(),
        timezone,
        calendars: calendars.map((cal: Calendar) => ({
          id: cal.id,
          name: cal.name,
          provider: cal.provider,
          isPrimary: cal.isPrimary,
        })),
        statistics: {
          totalCalendars: calendars.length,
          eventsToday: todayResult.events.length,
          eventsThisWeek: weekResult.events.length,
        },
      };

      return {
        contents: [{
          uri: 'calendar://summary',
          mimeType: 'application/json',
          text: JSON.stringify(summary, null, 2),
        }],
      };
    },

    'calendar://today': async () => {
      const now = DateTime.now().setZone(timezone);
      const startOfDay = now.startOf('day');
      const endOfDay = now.endOf('day');

      const result = await calendarService.listAllEvents({
        startTime: startOfDay.toISO()!,
        endTime: endOfDay.toISO()!,
      });

      const events = result.events.map(event => ({
        id: event.id,
        subject: event.subject,
        start: event.start.dateTime,
        end: event.end.dateTime,
        isAllDay: event.isAllDay,
        location: event.location,
        provider: event.provider,
        calendarId: event.calendarId,
        isOnlineMeeting: event.isOnlineMeeting,
        onlineMeetingUrl: event.onlineMeetingUrl,
      }));

      const response = {
        date: now.toISODate(),
        timezone,
        eventCount: events.length,
        events,
      };

      return {
        contents: [{
          uri: 'calendar://today',
          mimeType: 'application/json',
          text: JSON.stringify(response, null, 2),
        }],
      };
    },

    'calendar://week': async () => {
      const now = DateTime.now().setZone(timezone);
      const startOfWeek = now.startOf('week');
      const endOfWeek = now.endOf('week');

      const result = await calendarService.listAllEvents({
        startTime: startOfWeek.toISO()!,
        endTime: endOfWeek.toISO()!,
      });

      // Group events by day (in display timezone)
      const eventsByDay: Record<string, typeof result.events> = {};
      for (const event of result.events) {
        const day = DateTime.fromISO(event.start.dateTime).setZone(timezone).toISODate()!;
        if (!eventsByDay[day]) {
          eventsByDay[day] = [];
        }
        eventsByDay[day]!.push(event);
      }

      const days = Object.entries(eventsByDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, dayEvents]) => ({
          date,
          dayOfWeek: DateTime.fromISO(date).setZone(timezone).weekdayLong,
          eventCount: dayEvents.length,
          events: dayEvents.map(event => ({
            id: event.id,
            subject: event.subject,
            start: event.start.dateTime,
            end: event.end.dateTime,
            isAllDay: event.isAllDay,
            location: event.location,
            provider: event.provider,
          })),
        }));

      const response = {
        weekStart: startOfWeek.toISODate(),
        weekEnd: endOfWeek.toISODate(),
        timezone,
        totalEvents: result.events.length,
        days,
      };

      return {
        contents: [{
          uri: 'calendar://week',
          mimeType: 'application/json',
          text: JSON.stringify(response, null, 2),
        }],
      };
    },

    'calendar://next/5': async () => {
      return getNextEvents(calendarService, 5, timezone);
    },
  };
}

/**
 * Helper to get next N events
 */
async function getNextEvents(
  calendarService: CalendarService,
  count: number,
  timezone: string
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  const now = DateTime.now().setZone(timezone);
  const endDate = now.plus({ months: 3 }); // Look 3 months ahead

  const result = await calendarService.listAllEvents({
    startTime: now.toISO()!,
    endTime: endDate.toISO()!,
    maxResults: count,
  });

  const events = result.events.map(event => ({
    id: event.id,
    subject: event.subject,
    start: event.start.dateTime,
    end: event.end.dateTime,
    isAllDay: event.isAllDay,
    location: event.location,
    provider: event.provider,
    calendarId: event.calendarId,
    isOnlineMeeting: event.isOnlineMeeting,
    onlineMeetingUrl: event.onlineMeetingUrl,
  }));

  const response = {
    timestamp: now.toISO(),
    timezone,
    requestedCount: count,
    returnedCount: events.length,
    events,
  };

  return {
    contents: [{
      uri: `calendar://next/${count}`,
      mimeType: 'application/json',
      text: JSON.stringify(response, null, 2),
    }],
  };
}

/**
 * Handle dynamic resource URIs (e.g., calendar://next/10)
 */
export function createDynamicResourceHandler(
  calendarService: CalendarService
): (uri: string) => Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> } | null> {
  const timezone = getDefaultTimezone();

  return async (uri: string) => {
    // Handle calendar://next/{count} pattern
    const nextMatch = uri.match(/^calendar:\/\/next\/(\d+)$/);
    if (nextMatch) {
      const count = parseInt(nextMatch[1]!, 10);
      if (count > 0 && count <= 100) {
        return getNextEvents(calendarService, count, timezone);
      }
    }

    return null;
  };
}
