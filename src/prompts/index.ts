/**
 * MCP Prompts for Calendar
 * Provides pre-defined prompt templates for common calendar tasks
 */

import { z } from 'zod';

/**
 * Prompt definition type
 */
export interface PromptDefinition {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

/**
 * Prompt message type
 */
export interface PromptMessage {
  role: 'user' | 'assistant';
  content: {
    type: 'text';
    text: string;
  };
}

/**
 * Prompt list
 */
export const promptDefinitions: PromptDefinition[] = [
  {
    name: 'schedule-meeting',
    description: 'Help schedule a new meeting with participants',
    arguments: [
      {
        name: 'title',
        description: 'Meeting title/subject',
        required: true,
      },
      {
        name: 'duration',
        description: 'Meeting duration (e.g., "30 minutes", "1 hour")',
        required: false,
      },
      {
        name: 'attendees',
        description: 'Comma-separated list of attendee emails',
        required: false,
      },
    ],
  },
  {
    name: 'daily-briefing',
    description: "Generate a briefing of today's schedule",
    arguments: [
      {
        name: 'detail_level',
        description: 'Level of detail: "brief", "normal", or "detailed"',
        required: false,
      },
    ],
  },
  {
    name: 'find-meeting-time',
    description: 'Find available time slots for a meeting',
    arguments: [
      {
        name: 'duration',
        description: 'Meeting duration (e.g., "30 minutes", "1 hour")',
        required: true,
      },
      {
        name: 'days_ahead',
        description: 'Number of days to search (default: 7)',
        required: false,
      },
      {
        name: 'preferred_time',
        description: 'Preferred time of day: "morning", "afternoon", "any"',
        required: false,
      },
    ],
  },
  {
    name: 'sync-calendars',
    description: 'Help compare and sync events between calendars',
    arguments: [
      {
        name: 'source_provider',
        description: 'Source calendar provider (google, microsoft, exchange)',
        required: true,
      },
      {
        name: 'target_provider',
        description: 'Target calendar provider (google, microsoft, exchange)',
        required: true,
      },
    ],
  },
];

/**
 * Prompt handler type
 */
export type PromptHandler = (args: Record<string, string | undefined>) => Promise<{
  description?: string;
  messages: PromptMessage[];
}>;

/**
 * Create prompt handlers
 */
export function createPromptHandlers(): Record<string, PromptHandler> {
  return {
    'schedule-meeting': async (args) => {
      const title = args.title ?? 'New Meeting';
      const duration = args.duration ?? '30 minutes';
      const attendees = args.attendees ?? '';

      const attendeeList = attendees
        .split(',')
        .map(e => e.trim())
        .filter(e => e.length > 0);

      let promptText = `Help me schedule a meeting with the following details:

**Title:** ${title}
**Duration:** ${duration}`;

      if (attendeeList.length > 0) {
        promptText += `\n**Attendees:** ${attendeeList.join(', ')}`;
      }

      promptText += `

Please:
1. First, check my calendar availability using get_free_busy for the next few days
2. Suggest 3 available time slots that would work
3. Once I confirm a time, create the meeting using create_event${attendeeList.length > 0 ? ' and send invites to the attendees' : ''}

Let's start by checking my availability.`;

      return {
        description: `Schedule a meeting: ${title}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: promptText,
            },
          },
        ],
      };
    },

    'daily-briefing': async (args) => {
      const detailLevel = args.detail_level ?? 'normal';

      let promptText = `Generate a briefing of my schedule for today.`;

      if (detailLevel === 'brief') {
        promptText += `

Please provide a brief summary:
1. Use list_events to get today's events
2. Summarize in 2-3 sentences
3. Highlight only the most important meetings`;
      } else if (detailLevel === 'detailed') {
        promptText += `

Please provide a detailed briefing:
1. Use list_events to get today's events
2. For each event, provide:
   - Time and duration
   - Meeting subject and location
   - List of attendees
   - Any preparation notes based on the event body
3. Identify any scheduling conflicts
4. Note any gaps in the schedule that could be used for focused work`;
      } else {
        promptText += `

Please:
1. Use list_events to get today's events
2. Provide a chronological summary of my day
3. Highlight any important meetings
4. Note if there are any back-to-back meetings`;
      }

      return {
        description: "Today's schedule briefing",
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: promptText,
            },
          },
        ],
      };
    },

    'find-meeting-time': async (args) => {
      const duration = args.duration ?? '30 minutes';
      const daysAhead = args.days_ahead ?? '7';
      const preferredTime = args.preferred_time ?? 'any';

      let timePreference = '';
      if (preferredTime === 'morning') {
        timePreference = '\n- Prefer morning slots (9am-12pm)';
      } else if (preferredTime === 'afternoon') {
        timePreference = '\n- Prefer afternoon slots (1pm-5pm)';
      }

      const promptText = `Help me find available time slots for a meeting with these requirements:

**Duration:** ${duration}
**Search period:** Next ${daysAhead} days${timePreference}

Please:
1. Use get_free_busy to check my availability for the next ${daysAhead} days
2. Identify at least 3 suitable time slots
3. Present the options clearly with:
   - Date and day of week
   - Start and end time
   - Any context about adjacent meetings

Format the suggestions so I can easily choose one.`;

      return {
        description: `Find ${duration} meeting slot`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: promptText,
            },
          },
        ],
      };
    },

    'sync-calendars': async (args) => {
      const sourceProvider = args.source_provider ?? 'google';
      const targetProvider = args.target_provider ?? 'microsoft';

      const promptText = `Help me compare and sync my calendars between ${sourceProvider} and ${targetProvider}.

Please:
1. Use compare_calendars to analyze the differences between my ${sourceProvider} and ${targetProvider} calendars for the next 2 weeks
2. Show me:
   - Events that exist in both calendars (matched)
   - Events only in ${sourceProvider} (might need to copy to ${targetProvider})
   - Events only in ${targetProvider} (might need to copy to ${sourceProvider})
3. For any unmatched events, ask me which ones I'd like to copy
4. Use copy_event to sync the events I select

Let's start by comparing the calendars.`;

      return {
        description: `Sync ${sourceProvider} and ${targetProvider} calendars`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: promptText,
            },
          },
        ],
      };
    },
  };
}
