/**
 * Abstract base class for calendar providers
 * All provider implementations must extend this class
 */

import type {
  Calendar,
  CalendarEvent,
  CreateEventParams,
  UpdateEventParams,
  DeleteOptions,
  ListEventsParams,
  ProviderType,
  ResponseType,
  ICalendarProvider,
  ProviderConfig,
  CalendarFreeBusy,
  FreeBusyParams,
} from '../types/index.js';
import {
  CalendarMCPError,
  ErrorCodes,
  wrapError,
} from '../utils/error.js';

/**
 * Logger interface for providers
 */
export interface ProviderLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Default console logger
 */
export const defaultLogger: ProviderLogger = {
  debug: (msg, ...args) => console.debug(`[DEBUG] ${msg}`, ...args),
  info: (msg, ...args) => console.info(`[INFO] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[WARN] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args),
};

/**
 * Abstract base class for all calendar providers
 */
export abstract class BaseCalendarProvider implements ICalendarProvider {
  protected _connected: boolean = false;
  protected logger: ProviderLogger;

  constructor(
    protected readonly config: ProviderConfig,
    logger?: ProviderLogger
  ) {
    this.logger = logger ?? defaultLogger;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Identity (implemented by base class from config)
  // ─────────────────────────────────────────────────────────────────────────────

  get providerId(): string {
    return this.config.id;
  }

  get providerType(): ProviderType {
    return this.config.type;
  }

  get displayName(): string {
    return this.config.name;
  }

  get email(): string {
    return this.config.email;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Connection Lifecycle
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Connect to the provider - must be implemented by subclasses
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect from the provider
   */
  async disconnect(): Promise<void> {
    this._connected = false;
    this.logger.info(`Disconnected from ${this.displayName}`);
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this._connected;
  }

  /**
   * Refresh authentication - must be implemented by subclasses
   */
  abstract refreshAuth(): Promise<void>;

  /**
   * Ensure connected before making API calls
   */
  protected ensureConnected(): void {
    if (!this._connected) {
      throw new CalendarMCPError(
        `Provider ${this.displayName} is not connected`,
        ErrorCodes.PROVIDER_NOT_CONFIGURED,
        { provider: this.providerType, providerId: this.providerId }
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Calendar Operations - must be implemented by subclasses
  // ─────────────────────────────────────────────────────────────────────────────

  abstract listCalendars(): Promise<Calendar[]>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Event Operations - must be implemented by subclasses
  // ─────────────────────────────────────────────────────────────────────────────

  abstract listEvents(params: ListEventsParams): Promise<CalendarEvent[]>;
  abstract getEvent(eventId: string, calendarId?: string): Promise<CalendarEvent>;
  abstract createEvent(event: CreateEventParams, calendarId?: string): Promise<CalendarEvent>;
  abstract updateEvent(
    eventId: string,
    updates: UpdateEventParams,
    calendarId?: string
  ): Promise<CalendarEvent>;
  abstract deleteEvent(
    eventId: string,
    options?: DeleteOptions,
    calendarId?: string
  ): Promise<void>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Availability - must be implemented by subclasses
  // ─────────────────────────────────────────────────────────────────────────────

  abstract getFreeBusy(params: FreeBusyParams): Promise<CalendarFreeBusy>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Meeting Responses - must be implemented by subclasses
  // ─────────────────────────────────────────────────────────────────────────────

  abstract respondToEvent(
    eventId: string,
    response: ResponseType,
    calendarId?: string,
    message?: string
  ): Promise<void>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Wrap errors with provider context
   */
  protected wrapError(error: unknown, operation: string): CalendarMCPError {
    return wrapError(error, {
      provider: this.providerType,
      providerId: this.providerId,
      operation,
    });
  }

  /**
   * Execute with error handling
   */
  protected async executeWithErrorHandling<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    this.ensureConnected();
    try {
      return await fn();
    } catch (error) {
      throw this.wrapError(error, operation);
    }
  }

  /**
   * Get the primary calendar ID for this provider
   * Subclasses can override to provide provider-specific logic
   */
  async getPrimaryCalendarId(): Promise<string> {
    const calendars = await this.listCalendars();
    const primary = calendars.find(c => c.isPrimary);
    if (!primary) {
      throw new CalendarMCPError(
        'No primary calendar found',
        ErrorCodes.CALENDAR_NOT_FOUND,
        { provider: this.providerType }
      );
    }
    return primary.id;
  }
}
