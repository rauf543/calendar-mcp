/**
 * Google Calendar Provider Implementation
 */

import type { OAuth2Client } from 'google-auth-library';
import type {
  Calendar,
  CalendarEvent,
  CreateEventParams,
  UpdateEventParams,
  DeleteOptions,
  ListEventsParams,
  ResponseType,
  GoogleProviderConfig,
  CalendarFreeBusy,
  FreeBusyParams,
  BusySlot,
} from '../../types/index.js';
import { BaseCalendarProvider, ProviderLogger } from '../base.js';
import { CalendarMCPError, ErrorCodes } from '../../utils/error.js';
import {
  createOAuth2Client,
  ensureValidCredentials,
  refreshAccessToken,
} from './auth.js';
import { GoogleCalendarClient } from './client.js';
import {
  mapGoogleCalendar,
  mapGoogleEvent,
  toGoogleEvent,
  toGoogleEventPatch,
} from './mapper.js';

/**
 * Google Calendar provider implementation
 */
export class GoogleCalendarProvider extends BaseCalendarProvider {
  private oauth2Client: OAuth2Client;
  private client: GoogleCalendarClient | null = null;
  private calendarsCache: Calendar[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(config: GoogleProviderConfig, logger?: ProviderLogger) {
    super(config, logger);
    this.oauth2Client = createOAuth2Client(config);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Connection Lifecycle
  // ─────────────────────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    this.logger.info(`Connecting to Google Calendar (${this.displayName})...`);

    try {
      // Verify we have credentials
      await ensureValidCredentials(this.oauth2Client);

      // Create client
      this.client = new GoogleCalendarClient(this.oauth2Client);

      // Test connection by listing calendars
      await this.client.listCalendars();

      this._connected = true;
      this.logger.info(`Connected to Google Calendar (${this.displayName})`);
    } catch (error) {
      this._connected = false;
      throw this.wrapError(error, 'connect');
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.calendarsCache = null;
    this._connected = false;
    this.logger.info(`Disconnected from Google Calendar (${this.displayName})`);
  }

  async refreshAuth(): Promise<void> {
    this.logger.debug('Refreshing Google Calendar authentication...');
    await refreshAccessToken(this.oauth2Client);
    this.logger.debug('Google Calendar authentication refreshed');
  }

  private getClient(): GoogleCalendarClient {
    if (!this.client) {
      throw new CalendarMCPError(
        'Google Calendar client not initialized. Call connect() first.',
        ErrorCodes.PROVIDER_NOT_CONFIGURED,
        { provider: 'google', providerId: this.providerId }
      );
    }
    return this.client;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Calendar Operations
  // ─────────────────────────────────────────────────────────────────────────────

  async listCalendars(): Promise<Calendar[]> {
    return this.executeWithErrorHandling('listCalendars', async () => {
      // Check cache
      if (
        this.calendarsCache &&
        Date.now() - this.cacheTimestamp < this.CACHE_TTL_MS
      ) {
        return this.calendarsCache;
      }

      const googleCalendars = await this.getClient().listCalendars();
      const calendars = googleCalendars.map(gc =>
        mapGoogleCalendar(gc, this.providerId)
      );

      // Update cache
      this.calendarsCache = calendars;
      this.cacheTimestamp = Date.now();

      return calendars;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Event Operations
  // ─────────────────────────────────────────────────────────────────────────────

  async listEvents(params: ListEventsParams): Promise<CalendarEvent[]> {
    return this.executeWithErrorHandling('listEvents', async () => {
      const calendars = await this.listCalendars();

      // Filter to specified calendars or use all
      let targetCalendars = calendars;
      if (params.calendarIds && params.calendarIds.length > 0) {
        targetCalendars = calendars.filter(c =>
          params.calendarIds!.includes(c.id)
        );
      }

      // Query each calendar in parallel
      const eventPromises = targetCalendars.map(async calendar => {
        try {
          const events = await this.getClient().listEvents({
            calendarId: calendar.id,
            timeMin: params.startTime,
            timeMax: params.endTime,
            q: params.searchQuery,
            maxResults: params.maxResults,
            singleEvents: params.expandRecurring ?? true,
            orderBy: params.orderBy === 'updated' ? 'updated' : 'startTime',
          });
          return events.map(e => mapGoogleEvent(e, calendar.id));
        } catch (error) {
          this.logger.warn(
            `Failed to list events from calendar ${calendar.id}:`,
            error
          );
          return [];
        }
      });

      const eventArrays = await Promise.all(eventPromises);
      let allEvents = eventArrays.flat();

      // Sort by start time
      allEvents.sort((a, b) => {
        const aTime = new Date(a.start.dateTime).getTime();
        const bTime = new Date(b.start.dateTime).getTime();
        return aTime - bTime;
      });

      // Apply max results
      if (params.maxResults) {
        allEvents = allEvents.slice(0, params.maxResults);
      }

      return allEvents;
    });
  }

  async getEvent(eventId: string, calendarId?: string): Promise<CalendarEvent> {
    return this.executeWithErrorHandling('getEvent', async () => {
      const targetCalendarId = calendarId ?? 'primary';
      const googleEvent = await this.getClient().getEvent(targetCalendarId, eventId);
      return mapGoogleEvent(googleEvent, targetCalendarId);
    });
  }

  async createEvent(
    event: CreateEventParams,
    calendarId?: string
  ): Promise<CalendarEvent> {
    return this.executeWithErrorHandling('createEvent', async () => {
      const targetCalendarId = calendarId ?? 'primary';
      const googleEvent = toGoogleEvent(event);

      const sendUpdates = event.sendInvites === false ? 'none' : 'all';
      const conferenceDataVersion =
        event.createOnlineMeeting && event.onlineMeetingProvider === 'meet'
          ? 1
          : undefined;

      const created = await this.getClient().createEvent(
        targetCalendarId,
        googleEvent,
        { sendUpdates, conferenceDataVersion }
      );

      return mapGoogleEvent(created, targetCalendarId);
    });
  }

  async updateEvent(
    eventId: string,
    updates: UpdateEventParams,
    calendarId?: string
  ): Promise<CalendarEvent> {
    return this.executeWithErrorHandling('updateEvent', async () => {
      const targetCalendarId = calendarId ?? 'primary';
      const googleEventPatch = toGoogleEventPatch(updates);

      const sendUpdates = updates.sendUpdates === false ? 'none' : 'all';

      // For recurring events, handle scope
      let targetEventId = eventId;
      if (updates.updateScope === 'single' && eventId.includes('_')) {
        // This is already an instance ID
        targetEventId = eventId;
      } else if (updates.updateScope === 'thisAndFuture') {
        // Google doesn't have native thisAndFuture - need to handle differently
        // For now, just update the instance
        this.logger.warn(
          'Google Calendar does not natively support "thisAndFuture" - updating single instance'
        );
      }
      // 'all' scope updates the series master, which is the default behavior

      const updated = await this.getClient().patchEvent(
        targetCalendarId,
        targetEventId,
        googleEventPatch,
        { sendUpdates }
      );

      return mapGoogleEvent(updated, targetCalendarId);
    });
  }

  async deleteEvent(
    eventId: string,
    options?: DeleteOptions,
    calendarId?: string
  ): Promise<void> {
    return this.executeWithErrorHandling('deleteEvent', async () => {
      const targetCalendarId = calendarId ?? 'primary';
      const sendUpdates =
        options?.sendCancellation === false ? 'none' : 'all';

      // Handle delete scope for recurring events
      let targetEventId = eventId;
      if (options?.deleteScope === 'single' && !eventId.includes('_')) {
        // Need to specify instance - this should have been provided
        this.logger.warn(
          'Deleting single instance requires instance ID - deleting entire series'
        );
      }
      // 'thisAndFuture' and 'all' delete the series

      await this.getClient().deleteEvent(targetCalendarId, targetEventId, {
        sendUpdates,
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Availability
  // ─────────────────────────────────────────────────────────────────────────────

  async getFreeBusy(params: FreeBusyParams): Promise<CalendarFreeBusy> {
    return this.executeWithErrorHandling('getFreeBusy', async () => {
      const calendars = await this.listCalendars();

      // Filter to specified calendars or use all
      let targetCalendars = calendars;
      if (params.calendarIds && params.calendarIds.length > 0) {
        targetCalendars = calendars.filter(c =>
          params.calendarIds!.includes(c.id)
        );
      }

      const items = targetCalendars.map(c => ({ id: c.id }));

      const response = await this.getClient().getFreeBusy({
        timeMin: params.startTime,
        timeMax: params.endTime,
        items,
      });

      // Aggregate busy times from all calendars
      const busySlots: BusySlot[] = [];

      for (const [calendarId, calendarData] of Object.entries(
        response.calendars ?? {}
      )) {
        const busy = calendarData.busy ?? [];
        for (const slot of busy) {
          if (slot.start && slot.end) {
            busySlots.push({
              start: slot.start,
              end: slot.end,
              status: 'busy',
            });
          }
        }
      }

      // Find primary calendar name
      const primaryCalendar = targetCalendars.find(c => c.isPrimary);
      const calendarName = primaryCalendar?.name ?? this.displayName;

      return {
        provider: 'google',
        calendarId: primaryCalendar?.id ?? 'primary',
        calendarName,
        busy: busySlots,
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Meeting Responses
  // ─────────────────────────────────────────────────────────────────────────────

  async respondToEvent(
    eventId: string,
    response: ResponseType,
    calendarId?: string,
    message?: string
  ): Promise<void> {
    return this.executeWithErrorHandling('respondToEvent', async () => {
      const targetCalendarId = calendarId ?? 'primary';
      await this.getClient().respondToEvent(
        targetCalendarId,
        eventId,
        response,
        message
      );
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get the primary calendar ID
   */
  async getPrimaryCalendarId(): Promise<string> {
    const calendars = await this.listCalendars();
    const primary = calendars.find(c => c.isPrimary);
    return primary?.id ?? 'primary';
  }

  /**
   * Invalidate the calendars cache
   */
  invalidateCache(): void {
    this.calendarsCache = null;
    this.cacheTimestamp = 0;
  }
}

/**
 * Factory function for creating Google Calendar providers
 */
export function createGoogleProvider(
  config: GoogleProviderConfig,
  logger?: ProviderLogger
): GoogleCalendarProvider {
  return new GoogleCalendarProvider(config, logger);
}
