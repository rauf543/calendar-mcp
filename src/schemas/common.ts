/**
 * Common Zod schemas shared across tool definitions
 */

import { z } from 'zod';

/**
 * Provider type enum
 */
export const ProviderTypeSchema = z.enum(['exchange', 'google', 'microsoft']);

/**
 * Event status enum
 */
export const EventStatusSchema = z.enum(['confirmed', 'tentative', 'cancelled']);

/**
 * Show-as enum
 */
export const ShowAsSchema = z.enum(['free', 'busy', 'tentative', 'oof', 'workingElsewhere']);

/**
 * Response status enum
 */
export const ResponseStatusSchema = z.enum(['accepted', 'declined', 'tentative', 'needsAction']);

/**
 * Attendee type enum
 */
export const AttendeeTypeSchema = z.enum(['required', 'optional', 'resource']);

/**
 * Sensitivity enum
 */
export const SensitivitySchema = z.enum(['normal', 'personal', 'private', 'confidential']);

/**
 * Body type enum
 */
export const BodyTypeSchema = z.enum(['text', 'html']);

/**
 * Online meeting provider enum
 */
export const OnlineMeetingProviderSchema = z.enum(['teams', 'meet', 'zoom', 'other']);

/**
 * Response type for invitations
 */
export const ResponseTypeSchema = z.enum(['accepted', 'declined', 'tentative']);

/**
 * Update scope for recurring events
 */
export const UpdateScopeSchema = z.enum(['single', 'thisAndFuture', 'all']);

/**
 * Delete scope for recurring events
 */
export const DeleteScopeSchema = z.enum(['single', 'thisAndFuture', 'all']);

/**
 * Day of week enum
 */
export const DayOfWeekSchema = z.enum([
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]);

/**
 * ISO datetime string (basic validation)
 */
export const ISODateTimeSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Must be a valid ISO 8601 datetime string' }
);

/**
 * Email address
 */
export const EmailSchema = z.string().email();

/**
 * Attendee input schema
 */
export const AttendeeInputSchema = z.object({
  email: EmailSchema,
  type: AttendeeTypeSchema.optional().default('required'),
});

/**
 * Simple recurrence input schema
 */
export const RecurrenceInputSchema = z.object({
  type: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().positive().optional().default(1),
  daysOfWeek: z.array(DayOfWeekSchema).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  endDate: z.string().optional(),
  occurrences: z.number().int().positive().optional(),
});

/**
 * Working hours schema
 */
export const WorkingHoursSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/, 'Must be in HH:mm format'),
  end: z.string().regex(/^\d{2}:\d{2}$/, 'Must be in HH:mm format'),
  days: z.array(z.string()),
});

/**
 * Order by options for listing events
 */
export const OrderBySchema = z.enum(['start', 'updated']);
