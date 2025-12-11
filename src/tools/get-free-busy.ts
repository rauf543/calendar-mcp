/**
 * get_free_busy Tool
 * Retrieves aggregated availability across calendars
 */

import type { FreeBusyParams, FreeBusyResponse, FreeSlot } from '../types/index.js';
import type { FreeBusyService } from '../services/free-busy-service.js';
import type { GetFreeBusyInput } from '../schemas/tool-inputs.js';
import { DateTime } from 'luxon';
import { getDefaultTimezone } from '../utils/datetime.js';

/**
 * Execute get_free_busy tool
 */
export async function executeGetFreeBusy(
  input: GetFreeBusyInput,
  freeBusyService: FreeBusyService
): Promise<FreeBusyResponse> {
  const params: FreeBusyParams = {
    startTime: input.startTime,
    endTime: input.endTime,
    providers: input.providers,
    calendarIds: input.calendarIds,
    slotDuration: input.slotDuration,
    workingHoursOnly: input.workingHoursOnly,
    workingHours: input.workingHours,
  };

  return freeBusyService.getAggregatedFreeBusy(params);
}

/**
 * Format result for MCP response
 */
export function formatFreeBusyResult(result: FreeBusyResponse): string {
  const lines: string[] = [];
  const displayTimezone = getDefaultTimezone();

  // Summary
  lines.push('**Availability Summary**');
  lines.push(`(Times shown in ${displayTimezone})`);
  lines.push('');

  // Busy times
  if (result.unified.busy.length > 0) {
    lines.push(`🔴 **Busy Times (${result.unified.busy.length}):**`);
    for (const slot of result.unified.busy) {
      const start = DateTime.fromISO(slot.start).setZone(displayTimezone);
      const end = DateTime.fromISO(slot.end).setZone(displayTimezone);
      const dateStr = start.toFormat('EEE, MMM d');
      const timeStr = `${start.toFormat('h:mm a')} - ${end.toFormat('h:mm a')}`;
      lines.push(`   ${dateStr}: ${timeStr}`);
    }
    lines.push('');
  } else {
    lines.push('🟢 No busy times in the specified range.');
    lines.push('');
  }

  // Free times
  if (result.unified.free.length > 0) {
    lines.push(`🟢 **Free Times (${result.unified.free.length}):**`);

    // Group by date (in display timezone)
    const byDate = new Map<string, FreeSlot[]>();
    for (const slot of result.unified.free) {
      const dt = DateTime.fromISO(slot.start).setZone(displayTimezone);
      const dateKey = dt.toFormat('yyyy-MM-dd');
      const existing = byDate.get(dateKey) ?? [];
      existing.push(slot);
      byDate.set(dateKey, existing);
    }

    for (const [dateKey, slots] of byDate) {
      // Parse date string directly in display timezone to avoid day drift
      const dt = DateTime.fromFormat(dateKey, 'yyyy-MM-dd', { zone: displayTimezone });
      lines.push(`   **${dt.toFormat('EEE, MMM d')}:**`);
      for (const slot of slots) {
        const start = DateTime.fromISO(slot.start).setZone(displayTimezone);
        const end = DateTime.fromISO(slot.end).setZone(displayTimezone);
        const duration = slot.durationMinutes;
        const durationStr = duration >= 60
          ? `${Math.floor(duration / 60)}h ${duration % 60}m`
          : `${duration}m`;
        lines.push(`      ${start.toFormat('h:mm a')} - ${end.toFormat('h:mm a')} (${durationStr})`);
      }
    }
    lines.push('');
  }

  // Suggested slots
  if (result.suggestedSlots && result.suggestedSlots.length > 0) {
    lines.push(`💡 **Suggested Meeting Slots:**`);
    for (let i = 0; i < result.suggestedSlots.length; i++) {
      const slot = result.suggestedSlots[i]!;
      const start = DateTime.fromISO(slot.start).setZone(displayTimezone);
      const end = DateTime.fromISO(slot.end).setZone(displayTimezone);
      lines.push(`   ${i + 1}. ${start.toFormat('EEE, MMM d')}: ${start.toFormat('h:mm a')} - ${end.toFormat('h:mm a')}`);
    }
    lines.push('');
  }

  // Per-calendar breakdown
  const calendarIds = Object.keys(result.calendars);
  if (calendarIds.length > 1) {
    lines.push('**Per-Calendar Details:**');
    for (const calId of calendarIds) {
      const cal = result.calendars[calId]!;
      lines.push(`   ${cal.calendarName} (${cal.provider}): ${cal.busy.length} busy slot(s)`);
    }
    lines.push('');
  }

  // Errors
  if (result.errors && result.errors.length > 0) {
    lines.push('⚠️ **Errors:**');
    for (const error of result.errors) {
      lines.push(`   - ${error.provider}: ${error.message}`);
    }
  }

  return lines.join('\n');
}
