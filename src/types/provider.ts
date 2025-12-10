/**
 * Provider configuration and interface types
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
} from './calendar.js';

import type { FreeBusyParams, CalendarFreeBusy } from './free-busy.js';

/**
 * Base configuration for all providers
 */
export interface BaseProviderConfig {
  /** Unique identifier for this provider instance */
  id: string;
  /** Provider type */
  type: ProviderType;
  /** Display name for this provider */
  name: string;
  /** Email address associated with this account */
  email: string;
  /** Whether this provider is enabled */
  enabled: boolean;
}

/**
 * Google Calendar provider configuration
 */
export interface GoogleProviderConfig extends BaseProviderConfig {
  type: 'google';
  /** OAuth client ID */
  clientId?: string;
  /** OAuth client secret */
  clientSecret?: string;
  /** OAuth redirect URI */
  redirectUri?: string;
  /** Pre-authorized credentials */
  credentials?: {
    accessToken: string;
    refreshToken: string;
    tokenExpiry?: string;
  };
}

/**
 * Microsoft 365 provider configuration
 */
export interface MicrosoftProviderConfig extends BaseProviderConfig {
  type: 'microsoft';
  /** Azure AD tenant ID */
  tenantId: string;
  /** OAuth client ID */
  clientId?: string;
  /** OAuth client secret */
  clientSecret?: string;
  /** OAuth redirect URI */
  redirectUri?: string;
  /** Pre-authorized credentials */
  credentials?: {
    accessToken: string;
    refreshToken: string;
    tokenExpiry?: string;
  };
}

/**
 * Exchange authentication method
 */
export type ExchangeAuthMethod = 'ntlm' | 'basic' | 'oauth';

/**
 * Exchange On-Premises provider configuration
 */
export interface ExchangeProviderConfig extends BaseProviderConfig {
  type: 'exchange';
  /** EWS endpoint URL */
  ewsUrl: string;
  /** Authentication method */
  authMethod: ExchangeAuthMethod;
  /** Username (for NTLM/Basic auth) */
  username?: string;
  /** Password (for NTLM/Basic auth) */
  password?: string;
  /** Windows domain (for NTLM auth) */
  domain?: string;
  /** OAuth credentials (for hybrid Exchange) */
  oauth?: {
    clientId: string;
    clientSecret: string;
    tenantId: string;
    accessToken?: string;
    refreshToken?: string;
  };
}

/**
 * Union type of all provider configurations
 */
export type ProviderConfig =
  | GoogleProviderConfig
  | MicrosoftProviderConfig
  | ExchangeProviderConfig;

/**
 * Provider error information
 */
export interface ProviderError {
  provider: ProviderType;
  providerId: string;
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

/**
 * Result from listing events (may include partial failures)
 */
export interface ListEventsResult {
  events: CalendarEvent[];
  errors?: ProviderError[];
  partialSuccess: boolean;
}

/**
 * Abstract interface that all calendar providers must implement
 */
export interface ICalendarProvider {
  // ─────────────────────────────────────────────────────────────────────────────
  // Identity
  // ─────────────────────────────────────────────────────────────────────────────
  /** Unique identifier for this provider instance */
  readonly providerId: string;
  /** Provider type (exchange, google, microsoft) */
  readonly providerType: ProviderType;
  /** Display name */
  readonly displayName: string;
  /** Account email */
  readonly email: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Connection Lifecycle
  // ─────────────────────────────────────────────────────────────────────────────
  /** Initialize and connect to the provider */
  connect(): Promise<void>;
  /** Disconnect from the provider */
  disconnect(): Promise<void>;
  /** Check if currently connected */
  isConnected(): boolean;
  /** Refresh authentication if needed */
  refreshAuth(): Promise<void>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Calendar Operations
  // ─────────────────────────────────────────────────────────────────────────────
  /** List all calendars for this account */
  listCalendars(): Promise<Calendar[]>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Event Operations
  // ─────────────────────────────────────────────────────────────────────────────
  /** List events within a time range */
  listEvents(params: ListEventsParams): Promise<CalendarEvent[]>;

  /** Get a specific event by ID */
  getEvent(eventId: string, calendarId?: string): Promise<CalendarEvent>;

  /** Create a new event */
  createEvent(event: CreateEventParams, calendarId?: string): Promise<CalendarEvent>;

  /** Update an existing event */
  updateEvent(
    eventId: string,
    updates: UpdateEventParams,
    calendarId?: string
  ): Promise<CalendarEvent>;

  /** Delete an event */
  deleteEvent(
    eventId: string,
    options?: DeleteOptions,
    calendarId?: string
  ): Promise<void>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Availability
  // ─────────────────────────────────────────────────────────────────────────────
  /** Get free/busy information */
  getFreeBusy(params: FreeBusyParams): Promise<CalendarFreeBusy>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Meeting Responses
  // ─────────────────────────────────────────────────────────────────────────────
  /** Respond to a meeting invitation */
  respondToEvent(
    eventId: string,
    response: ResponseType,
    calendarId?: string,
    message?: string
  ): Promise<void>;
}

/**
 * Provider factory function type
 */
export type ProviderFactory = (config: ProviderConfig) => ICalendarProvider;

/**
 * Provider health status
 */
export interface ProviderHealthStatus {
  providerId: string;
  providerType: ProviderType;
  connected: boolean;
  lastError?: string;
  lastSuccessfulOperation?: string;
}
