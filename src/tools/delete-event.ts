/**
 * delete_event Tool
 * Deletes a calendar event
 */

import type { DeleteOptions } from '../types/index.js';
import type { CalendarService } from '../services/calendar-service.js';
import type { DeleteEventInput } from '../schemas/tool-inputs.js';

export interface DeleteEventResult {
  success: boolean;
  eventId: string;
  provider: string;
}

/**
 * Execute delete_event tool
 */
export async function executeDeleteEvent(
  input: DeleteEventInput,
  calendarService: CalendarService
): Promise<DeleteEventResult> {
  const options: DeleteOptions = {
    deleteScope: input.deleteScope,
    sendCancellation: input.sendCancellation,
  };

  await calendarService.deleteEvent(
    input.eventId,
    input.provider,
    options,
    input.calendarId
  );

  return {
    success: true,
    eventId: input.eventId,
    provider: input.provider,
  };
}

/**
 * Format result for MCP response
 */
export function formatDeleteEventResult(result: DeleteEventResult): string {
  const lines: string[] = [];

  lines.push('✅ Event deleted successfully!');
  lines.push('');
  lines.push(`Event ID: ${result.eventId}`);
  lines.push(`Provider: ${result.provider}`);

  return lines.join('\n');
}
