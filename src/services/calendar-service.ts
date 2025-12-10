/**
 * Calendar Service
 * Orchestrates operations across multiple calendar providers
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
  ProviderError,
  ListEventsResult,
} from '../types/index.js';
import { ProviderRegistry } from '../providers/index.js';
import { CalendarMCPError, ErrorCodes } from '../utils/error.js';

/**
 * Calendar Service
 * Provides unified access to calendars and events across all providers
 */
export class CalendarService {
  constructor(private registry: ProviderRegistry) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Calendar Operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * List all calendars across all providers (or filtered by provider type)
   */
  async listAllCalendars(providerFilter?: ProviderType | 'all'): Promise<{
    calendars: Calendar[];
    errors: ProviderError[];
  }> {
    const providers = this.registry.getConnected();

    // Filter by provider type if specified
    const targetProviders =
      providerFilter && providerFilter !== 'all'
        ? providers.filter(p => p.providerType === providerFilter)
        : providers;

    if (targetProviders.length === 0) {
      return { calendars: [], errors: [] };
    }

    const results = await Promise.allSettled(
      targetProviders.map(async provider => {
        const calendars = await provider.listCalendars();
        return { providerId: provider.providerId, calendars };
      })
    );

    const calendars: Calendar[] = [];
    const errors: ProviderError[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      const provider = targetProviders[i]!;

      if (result.status === 'fulfilled') {
        calendars.push(...result.value.calendars);
      } else {
        errors.push({
          provider: provider.providerType,
          providerId: provider.providerId,
          code:
            result.reason instanceof CalendarMCPError
              ? result.reason.code
              : ErrorCodes.INTERNAL_ERROR,
          message:
            result.reason instanceof Error
              ? result.reason.message
              : 'Unknown error',
          retryable:
            result.reason instanceof CalendarMCPError
              ? result.reason.retryable
              : false,
        });
      }
    }

    return { calendars, errors };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Event Operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * List events across all providers
   */
  async listAllEvents(params: ListEventsParams): Promise<ListEventsResult> {
    let providers = this.registry.getConnected();

    // Filter by provider types if specified
    if (params.providers && params.providers.length > 0) {
      providers = providers.filter(p =>
        params.providers!.includes(p.providerType)
      );
    }

    if (providers.length === 0) {
      return { events: [], partialSuccess: false };
    }

    const results = await Promise.allSettled(
      providers.map(async provider => {
        const events = await provider.listEvents(params);
        return { providerId: provider.providerId, events };
      })
    );

    const events: CalendarEvent[] = [];
    const errors: ProviderError[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      const provider = providers[i]!;

      if (result.status === 'fulfilled') {
        events.push(...result.value.events);
      } else {
        errors.push({
          provider: provider.providerType,
          providerId: provider.providerId,
          code:
            result.reason instanceof CalendarMCPError
              ? result.reason.code
              : ErrorCodes.INTERNAL_ERROR,
          message:
            result.reason instanceof Error
              ? result.reason.message
              : 'Unknown error',
          retryable:
            result.reason instanceof CalendarMCPError
              ? result.reason.retryable
              : false,
        });
      }
    }

    // Sort all events by start time
    events.sort((a, b) => {
      const aTime = new Date(a.start.dateTime).getTime();
      const bTime = new Date(b.start.dateTime).getTime();
      return aTime - bTime;
    });

    // Apply max results after merging and sorting
    const limitedEvents = params.maxResults
      ? events.slice(0, params.maxResults)
      : events;

    return {
      events: limitedEvents,
      errors: errors.length > 0 ? errors : undefined,
      partialSuccess: errors.length > 0 && events.length > 0,
    };
  }

  /**
   * Get a specific event
   */
  async getEvent(
    eventId: string,
    provider: ProviderType,
    calendarId?: string
  ): Promise<CalendarEvent> {
    const providerInstance = this.getProviderByType(provider);
    return providerInstance.getEvent(eventId, calendarId);
  }

  /**
   * Create an event on a specific provider
   */
  async createEvent(
    params: CreateEventParams,
    provider: ProviderType,
    calendarId?: string
  ): Promise<CalendarEvent> {
    const providerInstance = this.getProviderByType(provider);
    return providerInstance.createEvent(params, calendarId);
  }

  /**
   * Update an event
   */
  async updateEvent(
    eventId: string,
    updates: UpdateEventParams,
    provider: ProviderType,
    calendarId?: string
  ): Promise<CalendarEvent> {
    const providerInstance = this.getProviderByType(provider);
    return providerInstance.updateEvent(eventId, updates, calendarId);
  }

  /**
   * Delete an event
   */
  async deleteEvent(
    eventId: string,
    provider: ProviderType,
    options?: DeleteOptions,
    calendarId?: string
  ): Promise<void> {
    const providerInstance = this.getProviderByType(provider);
    return providerInstance.deleteEvent(eventId, options, calendarId);
  }

  /**
   * Respond to an event invitation
   */
  async respondToEvent(
    eventId: string,
    response: ResponseType,
    provider: ProviderType,
    calendarId?: string,
    message?: string
  ): Promise<void> {
    const providerInstance = this.getProviderByType(provider);
    return providerInstance.respondToEvent(eventId, response, calendarId, message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get a provider by type (returns first matching connected provider)
   */
  private getProviderByType(type: ProviderType) {
    const providers = this.registry.getByType(type);
    const connected = providers.find(p => p.isConnected());

    if (!connected) {
      throw new CalendarMCPError(
        `No connected ${type} provider found`,
        ErrorCodes.PROVIDER_NOT_FOUND,
        { details: { type } }
      );
    }

    return connected;
  }

  /**
   * Get provider by ID
   */
  getProviderById(providerId: string) {
    return this.registry.getOrThrow(providerId);
  }

  /**
   * Check if any providers are connected
   */
  hasConnectedProviders(): boolean {
    return this.registry.getConnected().length > 0;
  }

  /**
   * Get list of connected provider types
   */
  getConnectedProviderTypes(): ProviderType[] {
    return [...new Set(
      this.registry.getConnected().map(p => p.providerType)
    )];
  }
}

/**
 * Singleton service instance
 */
let serviceInstance: CalendarService | null = null;

/**
 * Get or create the calendar service
 */
export function getCalendarService(registry: ProviderRegistry): CalendarService {
  if (!serviceInstance) {
    serviceInstance = new CalendarService(registry);
  }
  return serviceInstance;
}

/**
 * Reset the service (for testing)
 */
export function resetCalendarService(): void {
  serviceInstance = null;
}
