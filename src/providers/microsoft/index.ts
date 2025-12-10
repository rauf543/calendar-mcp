/**
 * Microsoft Graph Calendar Provider Implementation
 */

import type {
  Calendar,
  CalendarEvent,
  CreateEventParams,
  UpdateEventParams,
  DeleteOptions,
  ListEventsParams,
  ResponseType,
  MicrosoftProviderConfig,
  CalendarFreeBusy,
  FreeBusyParams,
  BusySlot,
} from '../../types/index.js';
import { BaseCalendarProvider, ProviderLogger } from '../base.js';
import { CalendarMCPError, ErrorCodes } from '../../utils/error.js';
import { MicrosoftAuthManager, createMicrosoftAuthManager } from './auth.js';
import { MicrosoftGraphClient } from './client.js';
import {
  mapGraphCalendar,
  mapGraphEvent,
  toGraphEvent,
  toGraphEventPatch,
} from './mapper.js';

/**
 * Microsoft Graph Calendar provider implementation
 */
export class MicrosoftCalendarProvider extends BaseCalendarProvider {
  private authManager: MicrosoftAuthManager;
  private client: MicrosoftGraphClient | null = null;
  private calendarsCache: Calendar[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private userEmail: string = '';

  constructor(config: MicrosoftProviderConfig, logger?: ProviderLogger) {
    super(config, logger);
    this.authManager = createMicrosoftAuthManager(config);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Connection Lifecycle
  // ─────────────────────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    this.logger.info(`Connecting to Microsoft 365 (${this.displayName})...`);

    try {
      // Verify we have credentials
      if (!this.authManager.hasCredentials()) {
        throw new CalendarMCPError(
          'No Microsoft credentials available',
          ErrorCodes.AUTH_MISSING,
          { provider: 'microsoft', providerId: this.providerId }
        );
      }

      // Create client
      this.client = new MicrosoftGraphClient(this.authManager);

      // Test connection by getting user info
      const user = await this.client.getCurrentUser();
      this.userEmail = user.mail ?? '';

      this._connected = true;
      this.logger.info(`Connected to Microsoft 365 (${this.displayName}) as ${this.userEmail}`);
    } catch (error) {
      this._connected = false;
      throw this.wrapError(error, 'connect');
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.calendarsCache = null;
    this._connected = false;
    this.logger.info(`Disconnected from Microsoft 365 (${this.displayName})`);
  }

  async refreshAuth(): Promise<void> {
    this.logger.debug('Refreshing Microsoft 365 authentication...');
    await this.authManager.refreshToken();
    this.logger.debug('Microsoft 365 authentication refreshed');
  }

  private getClient(): MicrosoftGraphClient {
    if (!this.client) {
      throw new CalendarMCPError(
        'Microsoft Graph client not initialized. Call connect() first.',
        ErrorCodes.PROVIDER_NOT_CONFIGURED,
        { provider: 'microsoft', providerId: this.providerId }
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

      const graphCalendars = await this.getClient().listCalendars();
      const calendars = graphCalendars.map(gc =>
        mapGraphCalendar(gc, this.providerId)
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
            startDateTime: params.startTime,
            endDateTime: params.endTime,
            top: params.maxResults,
          });
          return events.map(e => mapGraphEvent(e, calendar.id));
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
      const graphEvent = await this.getClient().getEvent(targetCalendarId, eventId);
      return mapGraphEvent(graphEvent, targetCalendarId);
    });
  }

  async createEvent(
    event: CreateEventParams,
    calendarId?: string
  ): Promise<CalendarEvent> {
    return this.executeWithErrorHandling('createEvent', async () => {
      const targetCalendarId = calendarId ?? 'primary';
      const graphEvent = toGraphEvent(event);

      const created = await this.getClient().createEvent(
        targetCalendarId,
        graphEvent
      );

      return mapGraphEvent(created, targetCalendarId);
    });
  }

  async updateEvent(
    eventId: string,
    updates: UpdateEventParams,
    calendarId?: string
  ): Promise<CalendarEvent> {
    return this.executeWithErrorHandling('updateEvent', async () => {
      const targetCalendarId = calendarId ?? 'primary';
      const graphEventPatch = toGraphEventPatch(updates);

      const updated = await this.getClient().updateEvent(
        targetCalendarId,
        eventId,
        graphEventPatch
      );

      return mapGraphEvent(updated, targetCalendarId);
    });
  }

  async deleteEvent(
    eventId: string,
    options?: DeleteOptions,
    calendarId?: string
  ): Promise<void> {
    return this.executeWithErrorHandling('deleteEvent', async () => {
      const targetCalendarId = calendarId ?? 'primary';
      await this.getClient().deleteEvent(targetCalendarId, eventId);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Availability
  // ─────────────────────────────────────────────────────────────────────────────

  async getFreeBusy(params: FreeBusyParams): Promise<CalendarFreeBusy> {
    return this.executeWithErrorHandling('getFreeBusy', async () => {
      // Get schedule for the user's email
      const schedules = await this.getClient().getSchedule({
        schedules: [this.userEmail],
        startTime: params.startTime,
        endTime: params.endTime,
      });

      // Aggregate busy times
      const busySlots: BusySlot[] = [];

      for (const schedule of schedules) {
        if (schedule.scheduleItems) {
          for (const item of schedule.scheduleItems) {
            if (item.status !== 'free' && item.start?.dateTime && item.end?.dateTime) {
              busySlots.push({
                start: item.start.dateTime,
                end: item.end.dateTime,
                status: item.status === 'busy' ? 'busy' :
                       item.status === 'tentative' ? 'tentative' :
                       item.status === 'oof' ? 'oof' : 'busy',
              });
            }
          }
        }
      }

      const calendars = await this.listCalendars();
      const primaryCalendar = calendars.find(c => c.isPrimary);

      return {
        provider: 'microsoft',
        calendarId: primaryCalendar?.id ?? 'primary',
        calendarName: primaryCalendar?.name ?? this.displayName,
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

      // Map our response type to Graph response action
      const graphResponse =
        response === 'accepted' ? 'accept' :
        response === 'declined' ? 'decline' : 'tentativelyAccept';

      await this.getClient().respondToEvent(
        targetCalendarId,
        eventId,
        graphResponse,
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
 * Factory function for creating Microsoft providers
 */
export function createMicrosoftProvider(
  config: MicrosoftProviderConfig,
  logger?: ProviderLogger
): MicrosoftCalendarProvider {
  return new MicrosoftCalendarProvider(config, logger);
}
