/**
 * list_calendars Tool
 * Lists all available calendars across providers
 */

import type { Calendar, ProviderType, ProviderError } from '../types/index.js';
import type { CalendarService } from '../services/calendar-service.js';
import type { ListCalendarsInput } from '../schemas/tool-inputs.js';

export interface ListCalendarsResult {
  calendars: Calendar[];
  errors?: ProviderError[];
}

/**
 * Execute list_calendars tool
 */
export async function executeListCalendars(
  input: ListCalendarsInput,
  calendarService: CalendarService
): Promise<ListCalendarsResult> {
  const provider = input.provider as ProviderType | 'all' | undefined;

  const { calendars, errors } = await calendarService.listAllCalendars(provider);

  const result: ListCalendarsResult = { calendars };

  if (errors.length > 0) {
    result.errors = errors;
  }

  return result;
}

/**
 * Format result for MCP response
 */
export function formatListCalendarsResult(result: ListCalendarsResult): string {
  const lines: string[] = [];

  if (result.calendars.length === 0) {
    lines.push('No calendars found.');
    if (result.errors && result.errors.length > 0) {
      lines.push('');
      lines.push('Errors occurred while fetching calendars:');
      for (const error of result.errors) {
        lines.push(`  - ${error.provider}: ${error.message}`);
      }
    }
    return lines.join('\n');
  }

  lines.push(`Found ${result.calendars.length} calendar(s):\n`);

  // Group by provider
  const byProvider = new Map<string, Calendar[]>();
  for (const cal of result.calendars) {
    const existing = byProvider.get(cal.provider) ?? [];
    existing.push(cal);
    byProvider.set(cal.provider, existing);
  }

  for (const [provider, cals] of byProvider) {
    lines.push(`**${provider.toUpperCase()}**`);
    for (const cal of cals) {
      const primary = cal.isPrimary ? ' (primary)' : '';
      const access = cal.accessRole ? ` [${cal.accessRole}]` : '';
      lines.push(`  - ${cal.name}${primary}${access}`);
      lines.push(`    ID: ${cal.id}`);
    }
    lines.push('');
  }

  if (result.errors && result.errors.length > 0) {
    lines.push('⚠️ Some providers had errors:');
    for (const error of result.errors) {
      lines.push(`  - ${error.provider}: ${error.message}`);
    }
  }

  return lines.join('\n');
}
