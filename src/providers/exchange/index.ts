/**
 * Exchange EWS Calendar Provider Implementation
 */

import type {
  Calendar,
  CalendarEvent,
  CreateEventParams,
  UpdateEventParams,
  DeleteOptions,
  ListEventsParams,
  ResponseType,
  ExchangeProviderConfig,
  CalendarFreeBusy,
  FreeBusyParams,
  BusySlot,
  ShowAs,
} from '../../types/index.js';
import { parseDateTime, getDefaultTimezone } from '../../utils/datetime.js';

// EWS only supports a subset of ShowAs values
type EwsShowAs = 'free' | 'busy' | 'tentative' | 'oof';

/**
 * Convert ShowAs to EWS-compatible format
 * EWS doesn't support 'workingElsewhere', so map it to 'busy'
 */
function toEwsShowAs(showAs?: ShowAs): EwsShowAs | undefined {
  if (!showAs) return undefined;
  if (showAs === 'workingElsewhere') return 'busy';
  return showAs;
}
import { BaseCalendarProvider, ProviderLogger } from '../base.js';
import { CalendarMCPError, ErrorCodes } from '../../utils/error.js';
import { ExchangeAuthManager, createExchangeAuthManager } from './auth.js';
import { ExchangeEwsClient } from './client.js';
import { mapEwsCalendar, mapEwsEvent } from './mapper.js';

/**
 * Exchange EWS Calendar provider implementation
 */
export class ExchangeCalendarProvider extends BaseCalendarProvider {
  private authManager: ExchangeAuthManager;
  private client: ExchangeEwsClient | null = null;
  private calendarsCache: Calendar[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(config: ExchangeProviderConfig, logger?: ProviderLogger) {
    super(config, logger);
    this.authManager = createExchangeAuthManager(config);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Connection Lifecycle
  // ─────────────────────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    this.logger.info(`Connecting to Exchange (${this.displayName})...`);

    try {
      // Verify we have credentials
      if (!this.authManager.hasCredentials()) {
        throw new CalendarMCPError(
          'No Exchange credentials available',
          ErrorCodes.AUTH_MISSING,
          { provider: 'exchange', providerId: this.providerId }
        );
      }

      // Create client
      this.client = new ExchangeEwsClient(this.authManager);

      // Test connection by listing calendar folders
      await this.client.listCalendarFolders();

      this._connected = true;
      this.logger.info(`Connected to Exchange (${this.displayName})`);
    } catch (error) {
      this._connected = false;
      throw this.wrapError(error, 'connect');
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.calendarsCache = null;
    this._connected = false;
    this.logger.info(`Disconnected from Exchange (${this.displayName})`);
  }

  async refreshAuth(): Promise<void> {
    // Exchange with NTLM/Basic doesn't need token refresh
    this.logger.debug('Exchange authentication does not require refresh');
  }

  private getClient(): ExchangeEwsClient {
    if (!this.client) {
      throw new CalendarMCPError(
        'Exchange EWS client not initialized. Call connect() first.',
        ErrorCodes.PROVIDER_NOT_CONFIGURED,
        { provider: 'exchange', providerId: this.providerId }
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

      const folders = await this.getClient().listCalendarFolders();
      const calendars = folders.map(f =>
        mapEwsCalendar(
          { FolderId: { Id: f.id }, DisplayName: f.name },
          this.providerId,
          this.email
        )
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

      if (targetCalendars.length === 0) {
        return [];
      }

      // Query each calendar in parallel
      const eventPromises = targetCalendars.map(async calendar => {
        try {
          const appointments = await this.getClient().listEvents({
            folderId: calendar.id,
            startDate: new Date(params.startTime),
            endDate: new Date(params.endTime),
            maxResults: params.maxResults,
          });
          return appointments.map(apt =>
            mapEwsEvent(this.appointmentToObject(apt), calendar.id, calendar.email)
          );
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

  /**
   * Convert EWS Appointment to plain object for mapping
   * Safely handles properties that may not be loaded
   */
  private appointmentToObject(apt: any): any {
    // Helper to safely access EWS properties that may not be loaded
    const safeGet = <T>(fn: () => T, defaultValue?: T): T | undefined => {
      try {
        return fn();
      } catch {
        return defaultValue;
      }
    };

    return {
      ItemId: apt.Id ? { Id: apt.Id.UniqueId } : undefined,
      Subject: safeGet(() => apt.Subject),
      Body: safeGet(() => apt.Body ? { Content: apt.Body.Text, BodyType: apt.Body.BodyType?.toString() } : undefined),
      Start: safeGet(() => apt.Start?.ToISOString()),
      End: safeGet(() => apt.End?.ToISOString()),
      IsAllDayEvent: safeGet(() => apt.IsAllDayEvent),
      Location: safeGet(() => apt.Location),
      RequiredAttendees: safeGet(() => apt.RequiredAttendees?.Items?.map((a: any) => ({
        Mailbox: { EmailAddress: a.Address, Name: a.Name },
        ResponseType: a.ResponseType?.toString(),
      }))),
      OptionalAttendees: safeGet(() => apt.OptionalAttendees?.Items?.map((a: any) => ({
        Mailbox: { EmailAddress: a.Address, Name: a.Name },
        ResponseType: a.ResponseType?.toString(),
      }))),
      Organizer: safeGet(() => apt.Organizer ? {
        Mailbox: { EmailAddress: apt.Organizer.Address, Name: apt.Organizer.Name },
      } : undefined),
      LegacyFreeBusyStatus: safeGet(() => apt.LegacyFreeBusyStatus?.toString()),
      Sensitivity: safeGet(() => apt.Sensitivity?.toString()),
      ICalUid: safeGet(() => apt.ICalUid),
      IsRecurring: safeGet(() => apt.IsRecurring),
      IsCancelled: safeGet(() => apt.IsCancelled),
      MyResponseType: safeGet(() => apt.MyResponseType?.toString()),
      DateTimeCreated: safeGet(() => apt.DateTimeCreated?.ToISOString()),
      LastModifiedTime: safeGet(() => apt.LastModifiedTime?.ToISOString()),
    };
  }

  async getEvent(eventId: string, calendarId?: string): Promise<CalendarEvent> {
    return this.executeWithErrorHandling('getEvent', async () => {
      const apt = await this.getClient().getAppointment(eventId);
      const targetCalendar = await this.getTargetCalendar(calendarId);
      return mapEwsEvent(this.appointmentToObject(apt), targetCalendar?.id ?? '', targetCalendar?.email);
    });
  }

  async createEvent(
    event: CreateEventParams,
    calendarId?: string
  ): Promise<CalendarEvent> {
    return this.executeWithErrorHandling('createEvent', async () => {
      const targetCalendar = await this.getTargetCalendar(calendarId);

      // Parse times in the context of the provided timezone
      // This ensures naive ISO strings (without Z or offset) are interpreted correctly
      const timezone = event.timezone ?? getDefaultTimezone();
      const startDt = parseDateTime(event.startTime, timezone);
      const endDt = parseDateTime(event.endTime, timezone);

      const apt = await this.getClient().createAppointment({
        folderId: targetCalendar?.id,
        subject: event.subject,
        body: event.body,
        bodyType: event.bodyType,
        start: startDt.toJSDate(),
        end: endDt.toJSDate(),
        location: event.location,
        isAllDay: event.isAllDay,
        requiredAttendees: event.attendees
          ?.filter(a => a.type !== 'optional')
          .map(a => a.email),
        optionalAttendees: event.attendees
          ?.filter(a => a.type === 'optional')
          .map(a => a.email),
        showAs: toEwsShowAs(event.showAs),
        sensitivity: event.sensitivity,
        sendInvites: event.sendInvites,
      });

      return mapEwsEvent(this.appointmentToObject(apt), targetCalendar?.id ?? '', targetCalendar?.email);
    });
  }

  async updateEvent(
    eventId: string,
    updates: UpdateEventParams,
    calendarId?: string
  ): Promise<CalendarEvent> {
    return this.executeWithErrorHandling('updateEvent', async () => {
      // Parse times in the context of the provided timezone if updating times
      const timezone = updates.timezone ?? getDefaultTimezone();
      const startDate = updates.startTime
        ? parseDateTime(updates.startTime, timezone).toJSDate()
        : undefined;
      const endDate = updates.endTime
        ? parseDateTime(updates.endTime, timezone).toJSDate()
        : undefined;

      const apt = await this.getClient().updateAppointment(eventId, {
        subject: updates.subject,
        body: updates.body,
        bodyType: updates.bodyType,
        start: startDate,
        end: endDate,
        location: updates.location,
        showAs: toEwsShowAs(updates.showAs),
        sensitivity: updates.sensitivity,
        sendUpdates: updates.sendUpdates,
      });

      const targetCalendar = await this.getTargetCalendar(calendarId);
      return mapEwsEvent(this.appointmentToObject(apt), targetCalendar?.id ?? '', targetCalendar?.email);
    });
  }

  async deleteEvent(
    eventId: string,
    options?: DeleteOptions,
    calendarId?: string
  ): Promise<void> {
    return this.executeWithErrorHandling('deleteEvent', async () => {
      await this.getClient().deleteAppointment(eventId, options?.sendCancellation);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Availability
  // ─────────────────────────────────────────────────────────────────────────────

  async getFreeBusy(params: FreeBusyParams): Promise<CalendarFreeBusy> {
    return this.executeWithErrorHandling('getFreeBusy', async () => {
      // Note: Currently returns free/busy for a single calendar.
      // Multi-calendar aggregation happens at the FreeBusyService level.
      // See Issue #6 for sub-calendar support enhancements.
      const targetCalendar = await this.getTargetCalendar(params.calendarIds?.[0]);

      const busyTimes = await this.getClient().getFreeBusy({
        folderId: targetCalendar?.id,
        startTime: new Date(params.startTime),
        endTime: new Date(params.endTime),
      });

      const busySlots: BusySlot[] = busyTimes.map(bt => ({
        start: bt.start,
        end: bt.end,
        status: bt.status === 'Busy' ? 'busy' :
               bt.status === 'Tentative' ? 'tentative' :
               bt.status === 'OOF' ? 'oof' : 'busy',
      }));

      return {
        provider: 'exchange',
        calendarId: targetCalendar?.id ?? 'default',
        calendarName: targetCalendar?.name ?? this.displayName,
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
      const ewsResponse =
        response === 'accepted' ? 'accept' :
        response === 'declined' ? 'decline' : 'tentative';

      await this.getClient().respondToMeeting(eventId, ewsResponse, message);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get the target calendar for an operation.
   * Returns the calendar matching calendarId, or falls back to first available.
   */
  private async getTargetCalendar(calendarId?: string): Promise<Calendar | undefined> {
    const calendars = await this.listCalendars();
    if (calendarId) {
      return calendars.find(c => c.id === calendarId) ?? calendars[0];
    }
    return calendars[0];
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
 * Factory function for creating Exchange providers
 */
export function createExchangeProvider(
  config: ExchangeProviderConfig,
  logger?: ProviderLogger
): ExchangeCalendarProvider {
  return new ExchangeCalendarProvider(config, logger);
}
