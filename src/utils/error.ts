/**
 * Error handling utilities for Calendar MCP
 */

import type { ProviderType } from '../types/index.js';

/**
 * Error codes used throughout the application
 */
export const ErrorCodes = {
  // Authentication errors
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_FAILED: 'AUTH_FAILED',
  AUTH_MISSING: 'AUTH_MISSING',

  // Provider errors
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  PROVIDER_NOT_CONFIGURED: 'PROVIDER_NOT_CONFIGURED',
  PROVIDER_NOT_FOUND: 'PROVIDER_NOT_FOUND',

  // Event errors
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  EVENT_CONFLICT: 'EVENT_CONFLICT',
  INVALID_EVENT_DATA: 'INVALID_EVENT_DATA',

  // Calendar errors
  CALENDAR_NOT_FOUND: 'CALENDAR_NOT_FOUND',
  CALENDAR_READ_ONLY: 'CALENDAR_READ_ONLY',

  // Permission errors
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_ORGANIZER: 'NOT_ORGANIZER',

  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',

  // Recurrence errors
  INVALID_RECURRENCE: 'INVALID_RECURRENCE',

  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',

  // Input validation
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',

  // Internal errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',

  // Conflict errors
  CONFLICT_ERROR: 'CONFLICT_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Custom error class for Calendar MCP
 */
export class CalendarMCPError extends Error {
  public readonly code: ErrorCode;
  public readonly provider?: ProviderType;
  public readonly providerId?: string;
  public readonly retryable: boolean;
  public readonly retryAfter?: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode,
    options?: {
      provider?: ProviderType;
      providerId?: string;
      retryable?: boolean;
      retryAfter?: number;
      details?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'CalendarMCPError';
    this.code = code;
    this.provider = options?.provider;
    this.providerId = options?.providerId;
    this.retryable = options?.retryable ?? false;
    this.retryAfter = options?.retryAfter;
    this.details = options?.details;
  }

  /**
   * Convert to a JSON-serializable object for MCP responses
   */
  toJSON(): Record<string, unknown> {
    return {
      error: true,
      code: this.code,
      message: this.message,
      provider: this.provider,
      providerId: this.providerId,
      retryable: this.retryable,
      retryAfter: this.retryAfter,
      details: this.details,
    };
  }

  /**
   * Format as user-friendly message
   */
  toUserMessage(): string {
    const prefix = this.provider ? `[${this.provider}] ` : '';
    return `${prefix}${this.message}`;
  }
}

/**
 * Create an authentication expired error
 */
export function authExpiredError(
  provider: ProviderType,
  providerId: string
): CalendarMCPError {
  return new CalendarMCPError(
    `Authentication expired for ${provider}. Please re-authenticate.`,
    ErrorCodes.AUTH_EXPIRED,
    { provider, providerId, retryable: false }
  );
}

/**
 * Create an authentication failed error
 */
export function authFailedError(
  provider: ProviderType,
  providerId: string,
  reason?: string
): CalendarMCPError {
  return new CalendarMCPError(
    `Authentication failed for ${provider}${reason ? `: ${reason}` : ''}`,
    ErrorCodes.AUTH_FAILED,
    { provider, providerId, retryable: false }
  );
}

/**
 * Create a provider unavailable error
 */
export function providerUnavailableError(
  provider: ProviderType,
  providerId: string,
  cause?: Error
): CalendarMCPError {
  return new CalendarMCPError(
    `${provider} calendar service is currently unavailable`,
    ErrorCodes.PROVIDER_UNAVAILABLE,
    { provider, providerId, retryable: true, retryAfter: 30, cause }
  );
}

/**
 * Create an event not found error
 */
export function eventNotFoundError(
  eventId: string,
  provider?: ProviderType
): CalendarMCPError {
  return new CalendarMCPError(
    `Event not found: ${eventId}`,
    ErrorCodes.EVENT_NOT_FOUND,
    { provider, details: { eventId } }
  );
}

/**
 * Create a rate limited error
 */
export function rateLimitedError(
  provider: ProviderType,
  retryAfterSeconds?: number
): CalendarMCPError {
  return new CalendarMCPError(
    `Rate limited by ${provider}. Please try again later.`,
    ErrorCodes.RATE_LIMITED,
    { provider, retryable: true, retryAfter: retryAfterSeconds ?? 60 }
  );
}

/**
 * Create an invalid input error
 */
export function invalidInputError(
  message: string,
  details?: Record<string, unknown>
): CalendarMCPError {
  return new CalendarMCPError(message, ErrorCodes.INVALID_INPUT, { details });
}

/**
 * Create a permission denied error
 */
export function permissionDeniedError(
  action: string,
  provider?: ProviderType
): CalendarMCPError {
  return new CalendarMCPError(
    `Permission denied: ${action}`,
    ErrorCodes.PERMISSION_DENIED,
    { provider }
  );
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof CalendarMCPError) {
    return error.retryable;
  }
  return false;
}

/**
 * Wrap an unknown error as CalendarMCPError
 */
export function wrapError(
  error: unknown,
  context?: {
    provider?: ProviderType;
    providerId?: string;
    operation?: string;
  }
): CalendarMCPError {
  if (error instanceof CalendarMCPError) {
    return error;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'An unexpected error occurred';

  return new CalendarMCPError(
    context?.operation ? `${context.operation}: ${message}` : message,
    ErrorCodes.INTERNAL_ERROR,
    {
      provider: context?.provider,
      providerId: context?.providerId,
      cause: error instanceof Error ? error : undefined,
    }
  );
}

/**
 * Format a CalendarMCPError for MCP response
 */
export function formatErrorForMCP(error: CalendarMCPError): string {
  const lines: string[] = [];

  lines.push(`Error: ${error.message}`);
  lines.push(`Code: ${error.code}`);

  if (error.provider) {
    lines.push(`Provider: ${error.provider}`);
  }

  if (error.retryable) {
    lines.push('This error is retryable.');
    if (error.retryAfter) {
      lines.push(`Retry after: ${error.retryAfter} seconds`);
    }
  }

  if (error.details) {
    lines.push(`Details: ${JSON.stringify(error.details)}`);
  }

  return lines.join('\n');
}

/**
 * Error code to user-friendly message mapping
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCodes.AUTH_EXPIRED]: 'Authentication has expired. Please re-authenticate.',
  [ErrorCodes.AUTH_FAILED]: 'Authentication failed. Please check your credentials.',
  [ErrorCodes.AUTH_MISSING]: 'No authentication configured for this provider.',
  [ErrorCodes.PROVIDER_UNAVAILABLE]: 'The calendar provider is currently unavailable.',
  [ErrorCodes.PROVIDER_NOT_CONFIGURED]: 'This provider has not been configured.',
  [ErrorCodes.PROVIDER_NOT_FOUND]: 'Provider not found.',
  [ErrorCodes.EVENT_NOT_FOUND]: 'The requested event was not found.',
  [ErrorCodes.EVENT_CONFLICT]: 'This event conflicts with an existing event.',
  [ErrorCodes.INVALID_EVENT_DATA]: 'Invalid event data provided.',
  [ErrorCodes.CALENDAR_NOT_FOUND]: 'The requested calendar was not found.',
  [ErrorCodes.CALENDAR_READ_ONLY]: 'This calendar is read-only.',
  [ErrorCodes.PERMISSION_DENIED]: 'Permission denied for this operation.',
  [ErrorCodes.NOT_ORGANIZER]: 'Only the organizer can perform this action.',
  [ErrorCodes.RATE_LIMITED]: 'Too many requests. Please try again later.',
  [ErrorCodes.INVALID_RECURRENCE]: 'Invalid recurrence pattern.',
  [ErrorCodes.NETWORK_ERROR]: 'Network error. Please check your connection.',
  [ErrorCodes.TIMEOUT]: 'The request timed out. Please try again.',
  [ErrorCodes.INVALID_INPUT]: 'Invalid input provided.',
  [ErrorCodes.MISSING_REQUIRED_FIELD]: 'A required field is missing.',
  [ErrorCodes.INVALID_DATE_RANGE]: 'Invalid date range specified.',
  [ErrorCodes.INTERNAL_ERROR]: 'An internal error occurred.',
  [ErrorCodes.CONFIGURATION_ERROR]: 'Configuration error.',
  [ErrorCodes.CONFLICT_ERROR]: 'A conflict occurred.',
};
