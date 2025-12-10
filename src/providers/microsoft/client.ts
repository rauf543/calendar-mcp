/**
 * Microsoft Graph API client wrapper
 */

import { Client } from '@microsoft/microsoft-graph-client';
import type { MicrosoftAuthManager } from './auth.js';
import { CalendarMCPError, ErrorCodes } from '../../utils/error.js';

// Graph API response types (simplified)
interface GraphPagedResponse<T> {
  value?: T[];
  '@odata.nextLink'?: string;
}

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

interface GraphEvent {
  id?: string | null;
  subject?: string | null;
  body?: {
    contentType?: string | null;
    content?: string | null;
  } | null;
  start?: {
    dateTime?: string | null;
    timeZone?: string | null;
  } | null;
  end?: {
    dateTime?: string | null;
    timeZone?: string | null;
  } | null;
  [key: string]: unknown;
}

interface GraphFreeBusySchedule {
  scheduleId?: string | null;
  availabilityView?: string | null;
  scheduleItems?: Array<{
    status?: string | null;
    start?: { dateTime?: string; timeZone?: string };
    end?: { dateTime?: string; timeZone?: string };
  }>;
}

/**
 * Microsoft Graph client wrapper for calendar operations
 */
export class MicrosoftGraphClient {
  private client: Client;

  constructor(private authManager: MicrosoftAuthManager) {
    this.client = Client.init({
      authProvider: async (done) => {
        try {
          const token = await this.authManager.getAccessToken();
          done(null, token);
        } catch (error) {
          done(error as Error, null);
        }
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Calendar Operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * List all calendars
   */
  async listCalendars(): Promise<GraphCalendar[]> {
    try {
      const calendars: GraphCalendar[] = [];
      let response = await this.client
        .api('/me/calendars')
        .select('id,name,color,isDefaultCalendar,canEdit,owner')
        .get() as GraphPagedResponse<GraphCalendar>;

      if (response.value) {
        calendars.push(...response.value);
      }

      // Handle pagination
      while (response['@odata.nextLink']) {
        response = await this.client.api(response['@odata.nextLink']).get();
        if (response.value) {
          calendars.push(...response.value);
        }
      }

      return calendars;
    } catch (error) {
      throw this.handleApiError(error, 'listCalendars');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Event Operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * List events in a calendar
   */
  async listEvents(params: {
    calendarId: string;
    startDateTime: string;
    endDateTime: string;
    filter?: string;
    top?: number;
  }): Promise<GraphEvent[]> {
    try {
      const events: GraphEvent[] = [];
      const endpoint = params.calendarId === 'primary'
        ? '/me/calendar/calendarView'
        : `/me/calendars/${params.calendarId}/calendarView`;

      let request = this.client
        .api(endpoint)
        .query({
          startDateTime: params.startDateTime,
          endDateTime: params.endDateTime,
        })
        .select('id,subject,body,start,end,isAllDay,location,attendees,organizer,isOrganizer,showAs,sensitivity,iCalUId,recurrence,seriesMasterId,originalStart,isOnlineMeeting,onlineMeetingUrl,onlineMeeting,webLink,createdDateTime,lastModifiedDateTime,isCancelled,responseStatus')
        .orderby('start/dateTime');

      if (params.top) {
        request = request.top(params.top);
      }

      let response = await request.get() as GraphPagedResponse<GraphEvent>;

      if (response.value) {
        events.push(...response.value);
      }

      // Handle pagination
      while (response['@odata.nextLink'] && (!params.top || events.length < params.top)) {
        response = await this.client.api(response['@odata.nextLink']).get();
        if (response.value) {
          events.push(...response.value);
        }
      }

      return params.top ? events.slice(0, params.top) : events;
    } catch (error) {
      throw this.handleApiError(error, 'listEvents');
    }
  }

  /**
   * Get a single event
   */
  async getEvent(calendarId: string, eventId: string): Promise<GraphEvent> {
    try {
      const endpoint = calendarId === 'primary'
        ? `/me/calendar/events/${eventId}`
        : `/me/calendars/${calendarId}/events/${eventId}`;

      return await this.client
        .api(endpoint)
        .select('id,subject,body,start,end,isAllDay,location,attendees,organizer,isOrganizer,showAs,sensitivity,iCalUId,recurrence,seriesMasterId,originalStart,isOnlineMeeting,onlineMeetingUrl,onlineMeeting,webLink,createdDateTime,lastModifiedDateTime,isCancelled,responseStatus')
        .get();
    } catch (error) {
      throw this.handleApiError(error, 'getEvent', eventId);
    }
  }

  /**
   * Create a new event
   */
  async createEvent(
    calendarId: string,
    event: Record<string, unknown>
  ): Promise<GraphEvent> {
    try {
      const endpoint = calendarId === 'primary'
        ? '/me/calendar/events'
        : `/me/calendars/${calendarId}/events`;

      return await this.client.api(endpoint).post(event);
    } catch (error) {
      throw this.handleApiError(error, 'createEvent');
    }
  }

  /**
   * Update an event
   */
  async updateEvent(
    calendarId: string,
    eventId: string,
    updates: Record<string, unknown>
  ): Promise<GraphEvent> {
    try {
      const endpoint = calendarId === 'primary'
        ? `/me/calendar/events/${eventId}`
        : `/me/calendars/${calendarId}/events/${eventId}`;

      return await this.client.api(endpoint).patch(updates);
    } catch (error) {
      throw this.handleApiError(error, 'updateEvent', eventId);
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    try {
      const endpoint = calendarId === 'primary'
        ? `/me/calendar/events/${eventId}`
        : `/me/calendars/${calendarId}/events/${eventId}`;

      await this.client.api(endpoint).delete();
    } catch (error) {
      throw this.handleApiError(error, 'deleteEvent', eventId);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Free/Busy Operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get schedule (free/busy) information
   */
  async getSchedule(params: {
    schedules: string[];
    startTime: string;
    endTime: string;
    availabilityViewInterval?: number;
  }): Promise<GraphFreeBusySchedule[]> {
    try {
      const response = await this.client.api('/me/calendar/getSchedule').post({
        schedules: params.schedules,
        startTime: {
          dateTime: params.startTime,
          timeZone: 'UTC',
        },
        endTime: {
          dateTime: params.endTime,
          timeZone: 'UTC',
        },
        availabilityViewInterval: params.availabilityViewInterval ?? 30,
      });

      return response.value ?? [];
    } catch (error) {
      throw this.handleApiError(error, 'getSchedule');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Event Response Operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Respond to an event invitation
   */
  async respondToEvent(
    calendarId: string,
    eventId: string,
    response: 'accept' | 'decline' | 'tentativelyAccept',
    comment?: string
  ): Promise<void> {
    try {
      const endpoint = calendarId === 'primary'
        ? `/me/calendar/events/${eventId}/${response}`
        : `/me/calendars/${calendarId}/events/${eventId}/${response}`;

      await this.client.api(endpoint).post({
        comment: comment,
        sendResponse: true,
      });
    } catch (error) {
      throw this.handleApiError(error, 'respondToEvent', eventId);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // User Operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<{ mail?: string; displayName?: string }> {
    try {
      return await this.client.api('/me').select('mail,displayName').get();
    } catch (error) {
      throw this.handleApiError(error, 'getCurrentUser');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Error Handling
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Convert Graph API errors to our error format
   */
  private handleApiError(error: unknown, operation: string, resourceId?: string): never {
    const graphError = error as {
      statusCode?: number;
      code?: string;
      message?: string;
    };

    const statusCode = graphError.statusCode;
    const code = graphError.code;
    const message = graphError.message ?? 'Unknown error';

    switch (statusCode) {
      case 401:
        throw new CalendarMCPError(
          `Authentication failed: ${message}`,
          ErrorCodes.AUTH_FAILED,
          { provider: 'microsoft' }
        );

      case 403:
        throw new CalendarMCPError(
          `Permission denied: ${message}`,
          ErrorCodes.PERMISSION_DENIED,
          { provider: 'microsoft' }
        );

      case 404:
        throw new CalendarMCPError(
          resourceId ? `Event not found: ${resourceId}` : 'Resource not found',
          ErrorCodes.EVENT_NOT_FOUND,
          { provider: 'microsoft', details: { resourceId } }
        );

      case 429:
        throw new CalendarMCPError(
          'Too many requests',
          ErrorCodes.RATE_LIMITED,
          { provider: 'microsoft', retryable: true, retryAfter: 60 }
        );

      default:
        throw new CalendarMCPError(
          `${operation} failed: ${message}`,
          ErrorCodes.PROVIDER_UNAVAILABLE,
          {
            provider: 'microsoft',
            retryable: statusCode !== undefined && statusCode >= 500,
            details: { statusCode, code },
          }
        );
    }
  }
}
