/**
 * Google Calendar API client wrapper
 */

import { google, calendar_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { GaxiosResponse } from 'gaxios';
import { CalendarMCPError, ErrorCodes } from '../../utils/error.js';

type Calendar = calendar_v3.Calendar;
type Event = calendar_v3.Schema$Event;
type CalendarList = calendar_v3.Schema$CalendarList;
type Events = calendar_v3.Schema$Events;
type FreeBusyResponse = calendar_v3.Schema$FreeBusyResponse;

/**
 * Google Calendar API client wrapper
 * Provides typed methods for all calendar operations
 */
export class GoogleCalendarClient {
  private calendar: Calendar;

  constructor(auth: OAuth2Client) {
    this.calendar = google.calendar({ version: 'v3', auth });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Calendar Operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * List all calendars accessible to the user
   */
  async listCalendars(): Promise<calendar_v3.Schema$CalendarListEntry[]> {
    try {
      const calendars: calendar_v3.Schema$CalendarListEntry[] = [];
      let pageToken: string | undefined;

      do {
        const response: GaxiosResponse<CalendarList> = await this.calendar.calendarList.list({
          pageToken,
          maxResults: 100,
        });

        if (response.data.items) {
          calendars.push(...response.data.items);
        }
        pageToken = response.data.nextPageToken ?? undefined;
      } while (pageToken);

      return calendars;
    } catch (error) {
      throw this.handleApiError(error, 'listCalendars');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Event Operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * List events in a calendar within a time range
   */
  async listEvents(params: {
    calendarId: string;
    timeMin: string;
    timeMax: string;
    q?: string;
    maxResults?: number;
    singleEvents?: boolean;
    orderBy?: 'startTime' | 'updated';
  }): Promise<Event[]> {
    try {
      const events: Event[] = [];
      let pageToken: string | undefined;

      do {
        const response: GaxiosResponse<Events> = await this.calendar.events.list({
          calendarId: params.calendarId,
          timeMin: params.timeMin,
          timeMax: params.timeMax,
          q: params.q,
          maxResults: Math.min(params.maxResults ?? 250, 2500),
          singleEvents: params.singleEvents ?? true,
          orderBy: params.singleEvents !== false ? (params.orderBy ?? 'startTime') : undefined,
          pageToken,
        });

        if (response.data.items) {
          events.push(...response.data.items);
        }
        pageToken = response.data.nextPageToken ?? undefined;

        // Stop if we've reached the requested max
        if (params.maxResults && events.length >= params.maxResults) {
          break;
        }
      } while (pageToken);

      return params.maxResults ? events.slice(0, params.maxResults) : events;
    } catch (error) {
      throw this.handleApiError(error, 'listEvents');
    }
  }

  /**
   * Get a single event by ID
   */
  async getEvent(calendarId: string, eventId: string): Promise<Event> {
    try {
      const response = await this.calendar.events.get({
        calendarId,
        eventId,
      });
      return response.data;
    } catch (error) {
      throw this.handleApiError(error, 'getEvent', eventId);
    }
  }

  /**
   * Create a new event
   */
  async createEvent(
    calendarId: string,
    event: Event,
    options?: {
      sendUpdates?: 'all' | 'externalOnly' | 'none';
      conferenceDataVersion?: number;
    }
  ): Promise<Event> {
    try {
      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: event,
        sendUpdates: options?.sendUpdates ?? 'all',
        conferenceDataVersion: options?.conferenceDataVersion ?? 1,
      });
      return response.data;
    } catch (error) {
      throw this.handleApiError(error, 'createEvent');
    }
  }

  /**
   * Update an existing event
   */
  async updateEvent(
    calendarId: string,
    eventId: string,
    event: Event,
    options?: {
      sendUpdates?: 'all' | 'externalOnly' | 'none';
    }
  ): Promise<Event> {
    try {
      const response = await this.calendar.events.update({
        calendarId,
        eventId,
        requestBody: event,
        sendUpdates: options?.sendUpdates ?? 'all',
      });
      return response.data;
    } catch (error) {
      throw this.handleApiError(error, 'updateEvent', eventId);
    }
  }

  /**
   * Patch (partial update) an existing event
   */
  async patchEvent(
    calendarId: string,
    eventId: string,
    event: Partial<Event>,
    options?: {
      sendUpdates?: 'all' | 'externalOnly' | 'none';
    }
  ): Promise<Event> {
    try {
      const response = await this.calendar.events.patch({
        calendarId,
        eventId,
        requestBody: event,
        sendUpdates: options?.sendUpdates ?? 'all',
      });
      return response.data;
    } catch (error) {
      throw this.handleApiError(error, 'patchEvent', eventId);
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(
    calendarId: string,
    eventId: string,
    options?: {
      sendUpdates?: 'all' | 'externalOnly' | 'none';
    }
  ): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates: options?.sendUpdates ?? 'all',
      });
    } catch (error) {
      throw this.handleApiError(error, 'deleteEvent', eventId);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Free/Busy Operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Query free/busy information
   */
  async getFreeBusy(params: {
    timeMin: string;
    timeMax: string;
    items: Array<{ id: string }>;
  }): Promise<FreeBusyResponse> {
    try {
      const response = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: params.timeMin,
          timeMax: params.timeMax,
          items: params.items,
        },
      });
      return response.data;
    } catch (error) {
      throw this.handleApiError(error, 'getFreeBusy');
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
    response: 'accepted' | 'declined' | 'tentative',
    comment?: string
  ): Promise<Event> {
    try {
      // First, get the current event
      const event = await this.getEvent(calendarId, eventId);

      // Find self in attendees and update response
      if (event.attendees) {
        const selfIndex = event.attendees.findIndex(a => a.self);
        if (selfIndex >= 0) {
          event.attendees[selfIndex]!.responseStatus = response;
          if (comment) {
            event.attendees[selfIndex]!.comment = comment;
          }
        }
      }

      // Update the event
      return await this.patchEvent(calendarId, eventId, {
        attendees: event.attendees,
      });
    } catch (error) {
      throw this.handleApiError(error, 'respondToEvent', eventId);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Instance Operations (for recurring events)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * List instances of a recurring event
   */
  async listEventInstances(
    calendarId: string,
    eventId: string,
    params?: {
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
    }
  ): Promise<Event[]> {
    try {
      const instances: Event[] = [];
      let pageToken: string | undefined;

      do {
        const response = await this.calendar.events.instances({
          calendarId,
          eventId,
          timeMin: params?.timeMin,
          timeMax: params?.timeMax,
          maxResults: params?.maxResults ?? 250,
          pageToken,
        });

        if (response.data.items) {
          instances.push(...response.data.items);
        }
        pageToken = response.data.nextPageToken ?? undefined;
      } while (pageToken);

      return instances;
    } catch (error) {
      throw this.handleApiError(error, 'listEventInstances', eventId);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Error Handling
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Convert Google API errors to our error format
   */
  private handleApiError(error: unknown, operation: string, resourceId?: string): never {
    // Check for Google API error structure
    const gaxiosError = error as {
      code?: number;
      errors?: Array<{ reason?: string; message?: string }>;
      message?: string;
    };

    const statusCode = gaxiosError.code;
    const reason = gaxiosError.errors?.[0]?.reason;
    const message = gaxiosError.message ?? 'Unknown error';

    // Map status codes to our error codes
    switch (statusCode) {
      case 401:
        throw new CalendarMCPError(
          `Authentication failed: ${message}`,
          ErrorCodes.AUTH_FAILED,
          { provider: 'google' }
        );

      case 403:
        if (reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded') {
          throw new CalendarMCPError(
            'Rate limit exceeded',
            ErrorCodes.RATE_LIMITED,
            { provider: 'google', retryable: true, retryAfter: 60 }
          );
        }
        throw new CalendarMCPError(
          `Permission denied: ${message}`,
          ErrorCodes.PERMISSION_DENIED,
          { provider: 'google' }
        );

      case 404:
        throw new CalendarMCPError(
          resourceId ? `Event not found: ${resourceId}` : 'Resource not found',
          ErrorCodes.EVENT_NOT_FOUND,
          { provider: 'google', details: { resourceId } }
        );

      case 409:
        throw new CalendarMCPError(
          `Conflict: ${message}`,
          ErrorCodes.CONFLICT_ERROR,
          { provider: 'google', retryable: true }
        );

      case 429:
        throw new CalendarMCPError(
          'Too many requests',
          ErrorCodes.RATE_LIMITED,
          { provider: 'google', retryable: true, retryAfter: 60 }
        );

      default:
        throw new CalendarMCPError(
          `${operation} failed: ${message}`,
          ErrorCodes.PROVIDER_UNAVAILABLE,
          {
            provider: 'google',
            retryable: statusCode !== undefined && statusCode >= 500,
            details: { statusCode, reason },
          }
        );
    }
  }
}
