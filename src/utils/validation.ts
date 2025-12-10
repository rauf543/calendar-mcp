/**
 * Input validation utilities
 */

import { DateTime } from 'luxon';
import type { ProviderType, DayOfWeek } from '../types/index.js';
import { invalidInputError, CalendarMCPError, ErrorCodes } from './error.js';

/**
 * Valid provider types
 */
export const VALID_PROVIDERS: ProviderType[] = ['exchange', 'google', 'microsoft'];

/**
 * Valid days of week
 */
export const VALID_DAYS: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/**
 * Validate that a value is a non-empty string
 */
export function validateNonEmptyString(
  value: unknown,
  fieldName: string
): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw invalidInputError(`${fieldName} must be a non-empty string`);
  }
}

/**
 * Validate that a value is a valid ISO 8601 datetime
 */
export function validateISODateTime(value: unknown, fieldName: string): asserts value is string {
  validateNonEmptyString(value, fieldName);
  const dt = DateTime.fromISO(value);
  if (!dt.isValid) {
    throw invalidInputError(
      `${fieldName} must be a valid ISO 8601 datetime. Got: "${value}". Error: ${dt.invalidReason}`
    );
  }
}

/**
 * Validate a time range (start must be before end)
 */
export function validateTimeRange(startTime: string, endTime: string): void {
  validateISODateTime(startTime, 'startTime');
  validateISODateTime(endTime, 'endTime');

  const start = DateTime.fromISO(startTime);
  const end = DateTime.fromISO(endTime);

  if (start >= end) {
    throw new CalendarMCPError(
      'Start time must be before end time',
      ErrorCodes.INVALID_DATE_RANGE,
      { details: { startTime, endTime } }
    );
  }
}

/**
 * Validate that a value is a valid provider type
 */
export function validateProviderType(value: unknown): asserts value is ProviderType {
  if (!VALID_PROVIDERS.includes(value as ProviderType)) {
    throw invalidInputError(
      `Invalid provider type: "${value}". Must be one of: ${VALID_PROVIDERS.join(', ')}`
    );
  }
}

/**
 * Validate that a value is an array of valid provider types
 */
export function validateProviderTypes(
  value: unknown
): asserts value is ProviderType[] {
  if (!Array.isArray(value)) {
    throw invalidInputError('Providers must be an array');
  }
  for (const item of value) {
    validateProviderType(item);
  }
}

/**
 * Validate email address format
 */
export function validateEmail(value: unknown, fieldName: string): asserts value is string {
  validateNonEmptyString(value, fieldName);
  // Simple email regex - not RFC 5322 compliant but good enough
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    throw invalidInputError(`${fieldName} must be a valid email address. Got: "${value}"`);
  }
}

/**
 * Validate an array of attendees
 */
export function validateAttendees(
  value: unknown
): asserts value is Array<{ email: string; type?: string }> {
  if (!Array.isArray(value)) {
    throw invalidInputError('Attendees must be an array');
  }
  for (let i = 0; i < value.length; i++) {
    const attendee = value[i];
    if (typeof attendee !== 'object' || attendee === null) {
      throw invalidInputError(`Attendee at index ${i} must be an object`);
    }
    validateEmail((attendee as Record<string, unknown>).email, `attendees[${i}].email`);
  }
}

/**
 * Validate day of week
 */
export function validateDayOfWeek(value: unknown): asserts value is DayOfWeek {
  if (!VALID_DAYS.includes(value as DayOfWeek)) {
    throw invalidInputError(
      `Invalid day of week: "${value}". Must be one of: ${VALID_DAYS.join(', ')}`
    );
  }
}

/**
 * Validate days of week array
 */
export function validateDaysOfWeek(value: unknown): asserts value is DayOfWeek[] {
  if (!Array.isArray(value)) {
    throw invalidInputError('Days of week must be an array');
  }
  for (const day of value) {
    validateDayOfWeek(day);
  }
}

/**
 * Validate positive integer
 */
export function validatePositiveInteger(
  value: unknown,
  fieldName: string
): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw invalidInputError(`${fieldName} must be a positive integer. Got: ${value}`);
  }
}

/**
 * Validate non-negative integer
 */
export function validateNonNegativeInteger(
  value: unknown,
  fieldName: string
): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw invalidInputError(`${fieldName} must be a non-negative integer. Got: ${value}`);
  }
}

/**
 * Validate integer in range
 */
export function validateIntegerInRange(
  value: unknown,
  fieldName: string,
  min: number,
  max: number
): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw invalidInputError(
      `${fieldName} must be an integer between ${min} and ${max}. Got: ${value}`
    );
  }
}

/**
 * Validate IANA timezone
 */
export function validateTimezone(value: unknown, fieldName: string): asserts value is string {
  validateNonEmptyString(value, fieldName);
  // Try to create a DateTime with this zone
  const dt = DateTime.now().setZone(value);
  if (!dt.isValid) {
    throw invalidInputError(
      `${fieldName} must be a valid IANA timezone. Got: "${value}"`
    );
  }
}

/**
 * Validate update scope for recurring events
 */
export function validateUpdateScope(
  value: unknown
): asserts value is 'single' | 'thisAndFuture' | 'all' {
  const validScopes = ['single', 'thisAndFuture', 'all'];
  if (!validScopes.includes(value as string)) {
    throw invalidInputError(
      `Invalid update scope: "${value}". Must be one of: ${validScopes.join(', ')}`
    );
  }
}

/**
 * Validate response type for invitations
 */
export function validateResponseType(
  value: unknown
): asserts value is 'accepted' | 'declined' | 'tentative' {
  const validResponses = ['accepted', 'declined', 'tentative'];
  if (!validResponses.includes(value as string)) {
    throw invalidInputError(
      `Invalid response type: "${value}". Must be one of: ${validResponses.join(', ')}`
    );
  }
}

/**
 * Validate recurrence type
 */
export function validateRecurrenceType(
  value: unknown
): asserts value is 'daily' | 'weekly' | 'monthly' | 'yearly' {
  const validTypes = ['daily', 'weekly', 'monthly', 'yearly'];
  if (!validTypes.includes(value as string)) {
    throw invalidInputError(
      `Invalid recurrence type: "${value}". Must be one of: ${validTypes.join(', ')}`
    );
  }
}

/**
 * Sanitize string input (trim whitespace, limit length)
 */
export function sanitizeString(value: string, maxLength: number = 1000): string {
  return value.trim().slice(0, maxLength);
}

/**
 * Coerce value to boolean
 */
export function toBoolean(value: unknown, defaultValue: boolean = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return defaultValue;
}

/**
 * Coerce value to number
 */
export function toNumber(value: unknown, defaultValue: number): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) return parsed;
  }
  return defaultValue;
}
