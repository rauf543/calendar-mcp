/**
 * respond_to_invite Tool
 * Responds to a meeting invitation
 */

import type { ResponseType } from '../types/index.js';
import type { CalendarService } from '../services/calendar-service.js';
import type { RespondToInviteInput } from '../schemas/tool-inputs.js';

export interface RespondToInviteResult {
  success: boolean;
  eventId: string;
  provider: string;
  response: ResponseType;
}

/**
 * Execute respond_to_invite tool
 */
export async function executeRespondToInvite(
  input: RespondToInviteInput,
  calendarService: CalendarService
): Promise<RespondToInviteResult> {
  await calendarService.respondToEvent(
    input.eventId,
    input.response,
    input.provider,
    input.calendarId,
    input.message
  );

  return {
    success: true,
    eventId: input.eventId,
    provider: input.provider,
    response: input.response,
  };
}

/**
 * Format result for MCP response
 */
export function formatRespondToInviteResult(result: RespondToInviteResult): string {
  const lines: string[] = [];

  const responseEmoji = {
    accepted: '✅',
    declined: '❌',
    tentative: '❓',
  };

  const responseText = {
    accepted: 'accepted',
    declined: 'declined',
    tentative: 'tentatively accepted',
  };

  lines.push(`${responseEmoji[result.response]} Meeting invitation ${responseText[result.response]}!`);
  lines.push('');
  lines.push(`Event ID: ${result.eventId}`);
  lines.push(`Provider: ${result.provider}`);

  return lines.join('\n');
}
