/**
 * check_conflicts Tool
 * Checks for scheduling conflicts with a proposed time slot
 */

import type { ConflictCheckResult, CheckConflictsParams } from '../types/index.js';
import type { ConflictService } from '../services/conflict-service.js';
import type { CheckConflictsInput } from '../schemas/tool-inputs.js';
import { DateTime } from 'luxon';
import { getDefaultTimezone } from '../utils/datetime.js';

/**
 * Execute check_conflicts tool
 */
export async function executeCheckConflicts(
  input: CheckConflictsInput,
  conflictService: ConflictService
): Promise<ConflictCheckResult> {
  const params: CheckConflictsParams = {
    startTime: input.startTime,
    endTime: input.endTime,
    excludeEventId: input.excludeEventId,
    excludeProvider: input.excludeProvider,
  };

  return conflictService.checkConflicts(params);
}

/**
 * Format result for MCP response
 */
export function formatCheckConflictsResult(result: ConflictCheckResult): string {
  const lines: string[] = [];
  const displayTimezone = getDefaultTimezone();

  if (!result.hasConflict) {
    lines.push('✅ **No conflicts found!**');
    lines.push('');
    lines.push('The proposed time slot is available across all calendars.');
    return lines.join('\n');
  }

  lines.push(`⚠️ **${result.conflicts.length} Conflict(s) Found**`);
  lines.push(`(Times shown in ${displayTimezone})`);
  lines.push('');

  for (const conflict of result.conflicts) {
    const start = DateTime.fromISO(conflict.start).setZone(displayTimezone);
    const end = DateTime.fromISO(conflict.end).setZone(displayTimezone);

    lines.push(`**${conflict.subject}**`);
    lines.push(`   📅 ${start.toFormat('EEE, MMM d')}: ${start.toFormat('h:mm a')} - ${end.toFormat('h:mm a')}`);
    lines.push(`   Provider: ${conflict.provider}`);
    lines.push(`   Status: ${conflict.showAs ?? 'busy'}`);
    lines.push(`   ID: ${conflict.id}`);
    lines.push('');
  }

  if (result.suggestion) {
    lines.push('💡 **Suggested Alternative:**');
    const sugStart = DateTime.fromISO(result.suggestion.start).setZone(displayTimezone);
    const sugEnd = DateTime.fromISO(result.suggestion.end).setZone(displayTimezone);
    lines.push(`   ${sugStart.toFormat('EEE, MMM d')}: ${sugStart.toFormat('h:mm a')} - ${sugEnd.toFormat('h:mm a')}`);
    lines.push(`   ${result.suggestion.reason}`);
  }

  return lines.join('\n');
}
