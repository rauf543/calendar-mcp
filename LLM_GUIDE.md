# Calendar MCP - LLM Usage Guide

This document provides instructions for AI assistants (LLMs) on how to effectively use the Calendar MCP server to help users manage their calendars.

---

## Table of Contents

1. [Overview](#overview)
2. [Core Principles](#core-principles)
3. [Understanding User Intent](#understanding-user-intent)
4. [Tool Reference](#tool-reference)
5. [Common Workflows](#common-workflows)
6. [Response Formatting](#response-formatting)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)
9. [Examples](#examples)

---

## Overview

You have access to a Calendar MCP server that provides unified calendar management across multiple providers:
- **Google Calendar** - Personal and workspace calendars
- **Microsoft 365** - Outlook/Exchange Online calendars
- **Exchange On-Premises** - Corporate Exchange servers with EWS

The user may have one or more calendars connected across these providers. Your role is to help them manage their schedule through natural conversation.

### Available Capabilities

| Category | Tools |
|----------|-------|
| **View** | `list_calendars`, `list_events`, `get_event` |
| **Manage** | `create_event`, `update_event`, `delete_event` |
| **Schedule** | `get_free_busy`, `check_conflicts`, `respond_to_invite` |
| **Sync** | `find_matching_events`, `copy_event`, `compare_calendars` |

---

## Core Principles

### 1. Confirm Before Modifying

**CRITICAL**: Before creating, updating, or deleting events, always confirm details with the user.

```
User: "Schedule a meeting tomorrow at 2pm"

✅ CORRECT APPROACH:
   "I'll create a meeting for tomorrow (December 11) at 2:00 PM.
    - What should I title it?
    - How long should it be? (default: 1 hour)
    - Which calendar should I add it to? [if multiple]"

❌ WRONG APPROACH:
   [Immediately calling create_event with assumed values]
```

### 2. Be Explicit About Time

Always include:
- The **day of week** and **date** (not just "tomorrow")
- The **timezone** if there's any ambiguity
- **Duration** for events

```
✅ "Your meeting is scheduled for Monday, December 15 at 2:00 PM (Baku time), lasting 1 hour."
❌ "Your meeting is scheduled for tomorrow at 2."
```

### 3. Show Which Calendar

When the user has multiple calendars, always indicate which calendar events belong to:

```
✅ "From your Sinteks Exchange calendar:
    - 10:00 AM: Team Standup

   From your FBCO Exchange calendar:
    - 2:00 PM: Client Meeting"

❌ "You have: Team Standup at 10, Client Meeting at 2"
```

### 4. Provide Context and Summaries

Don't just dump raw data. Add helpful context:

```
✅ "You have 4 meetings today, with a 2-hour gap between 12-2 PM for lunch.
    Your busiest time is the morning."

❌ "Event 1: Standup. Event 2: Review. Event 3: Sync. Event 4: Planning."
```

---

## Understanding User Intent

### Time Expressions

Users speak naturally about time. Here's how to interpret common expressions:

| User Says | Interpretation |
|-----------|----------------|
| "today" | Current date, 00:00 - 23:59 |
| "tomorrow" | Current date + 1 day |
| "this week" | Monday through Sunday of current week |
| "next week" | Monday through Sunday of following week |
| "this afternoon" | Today, 12:00 PM - 6:00 PM |
| "this morning" | Today, 6:00 AM - 12:00 PM |
| "this evening" | Today, 5:00 PM - 9:00 PM |
| "end of day" / "EOD" | Today, 5:00 PM or 6:00 PM |
| "lunch" / "lunchtime" | 12:00 PM - 1:00 PM |
| "after work" | 6:00 PM onwards |
| "next Monday" | The coming Monday (not today if today is Monday) |
| "in 2 hours" | Current time + 2 hours |
| "for an hour" | Duration: 60 minutes |
| "half hour" / "30 minutes" | Duration: 30 minutes |
| "quick call" / "quick sync" | Duration: 15-30 minutes |

### Action Keywords

| User Says | Likely Intent | Primary Tool |
|-----------|---------------|--------------|
| "what's on my calendar" | View schedule | `list_events` |
| "am I free" / "do I have time" | Check availability | `get_free_busy` or `check_conflicts` |
| "schedule" / "book" / "add" / "create" | Create event | `create_event` |
| "move" / "reschedule" / "change time" | Update event | `update_event` |
| "cancel" / "delete" / "remove" | Delete event | `delete_event` |
| "accept" / "decline" / "maybe" | Respond to invite | `respond_to_invite` |
| "find time" / "when can we meet" | Find availability | `get_free_busy` |
| "conflicts" / "double-booked" | Check conflicts | `check_conflicts` |
| "sync" / "copy" / "duplicate" | Cross-calendar ops | `copy_event`, `compare_calendars` |

### Implicit Requirements

Sometimes users don't state everything explicitly:

| User Says | Implicit Requirements |
|-----------|----------------------|
| "Schedule a meeting with John" | Need: John's email, time, duration |
| "Find time for a 1-on-1" | Likely: 30-60 min, during work hours |
| "Block time for deep work" | Likely: 2-4 hours, no attendees, show as busy |
| "Add a reminder to..." | Likely: Short event, maybe all-day, personal calendar |
| "Team standup" | Likely: 15-30 min, recurring, morning |

---

## Tool Reference

### list_calendars

**Purpose**: Discover what calendars the user has access to.

**When to use**:
- At the start of a conversation to understand the user's setup
- When the user asks "what calendars do I have?"
- Before creating an event if you need to ask which calendar

**Parameters**:
```json
{
  "provider": "all" | "google" | "microsoft" | "exchange"
}
```

**Best practices**:
- Call this early to understand the user's calendar landscape
- Note which calendars are "primary" vs secondary
- Remember calendar IDs for subsequent operations

---

### list_events

**Purpose**: Retrieve events within a time range.

**When to use**:
- User asks about their schedule
- Before suggesting meeting times (to see what's busy)
- To find a specific event for updating/deleting

**Parameters**:
```json
{
  "startTime": "ISO 8601 datetime (required)",
  "endTime": "ISO 8601 datetime (required)",
  "providers": ["array of providers to filter"],
  "calendarIds": ["array of calendar IDs to filter"],
  "searchQuery": "text to search in subject/body",
  "maxResults": 100,
  "orderBy": "start" | "updated",
  "expandRecurring": true
}
```

**Best practices**:
- Always specify timezone offset in ISO dates: `2025-12-10T09:00:00+04:00`
- Use `searchQuery` to find specific events by name
- Set reasonable `maxResults` (10-50 for display, higher for analysis)
- For "today" queries, use full day range (00:00 to 23:59)

---

### get_event

**Purpose**: Get full details of a specific event.

**When to use**:
- User asks for details about a specific event
- Before updating an event (to confirm current state)
- To get attendee list, full description, or meeting links

**Parameters**:
```json
{
  "eventId": "event ID (required)",
  "provider": "google" | "microsoft" | "exchange (required)",
  "calendarId": "calendar ID (sometimes required)"
}
```

**Best practices**:
- You'll need the eventId from a previous `list_events` call
- Always include the provider that owns the event

---

### create_event

**Purpose**: Create a new calendar event.

**When to use**:
- User wants to schedule, book, or add a meeting/event
- After confirming all required details with the user

**Parameters**:
```json
{
  "provider": "google" | "microsoft" | "exchange (required)",
  "subject": "Event title (required)",
  "startTime": "ISO 8601 datetime (required)",
  "endTime": "ISO 8601 datetime (required)",
  "calendarId": "target calendar ID",
  "body": "event description",
  "bodyType": "text" | "html",
  "location": "physical location",
  "attendees": [
    {"email": "person@example.com", "type": "required" | "optional"}
  ],
  "isAllDay": false,
  "recurrence": {
    "type": "daily" | "weekly" | "monthly" | "yearly",
    "interval": 1,
    "daysOfWeek": ["monday", "wednesday"],
    "endDate": "ISO date",
    "occurrences": 10
  },
  "reminderMinutes": 15,
  "createOnlineMeeting": true,
  "onlineMeetingProvider": "teams" | "meet",
  "sensitivity": "normal" | "private" | "confidential",
  "showAs": "busy" | "free" | "tentative" | "oof"
}
```

**Best practices**:
- Always confirm subject, time, and duration before creating
- If user has multiple calendars, ask which one
- Default duration: 1 hour for meetings, 30 min for calls
- Set `showAs: "busy"` by default for meetings
- Include timezone in all datetime values

**Calculating endTime**:
```
startTime = "2025-12-10T14:00:00+04:00"
duration = 1 hour
endTime = "2025-12-10T15:00:00+04:00"
```

---

### update_event

**Purpose**: Modify an existing event.

**When to use**:
- User wants to move, reschedule, rename, or modify an event
- User wants to add/remove attendees
- User wants to change location or description

**Parameters**:
```json
{
  "eventId": "event ID (required)",
  "provider": "provider (required)",
  "subject": "new title",
  "startTime": "new start time",
  "endTime": "new end time",
  "body": "new description",
  "location": "new location",
  "attendees": [{"email": "...", "type": "..."}],
  "updateScope": "single" | "thisAndFuture" | "all",
  "sendUpdates": true
}
```

**Best practices**:
- First use `list_events` or `get_event` to find the event
- Confirm the change with the user before executing
- For recurring events, ask about scope: just this instance, future instances, or all
- `sendUpdates: true` notifies attendees of changes

---

### delete_event

**Purpose**: Remove an event from the calendar.

**When to use**:
- User wants to cancel, delete, or remove an event
- User says "nevermind" about a recently created event

**Parameters**:
```json
{
  "eventId": "event ID (required)",
  "provider": "provider (required)",
  "calendarId": "calendar ID",
  "deleteScope": "single" | "thisAndFuture" | "all",
  "sendCancellation": true
}
```

**Best practices**:
- Always confirm before deleting: "Are you sure you want to cancel [Event Name]?"
- For recurring events, clarify scope
- `sendCancellation: true` notifies attendees

---

### get_free_busy

**Purpose**: Find when the user is available or busy.

**When to use**:
- User asks "when am I free?"
- User wants to schedule something but hasn't picked a time
- Finding meeting slots across multiple calendars

**Parameters**:
```json
{
  "startTime": "ISO 8601 (required)",
  "endTime": "ISO 8601 (required)",
  "providers": ["filter providers"],
  "calendarIds": ["filter calendars"],
  "slotDuration": 60,
  "workingHoursOnly": true,
  "workingHours": {
    "start": "09:00",
    "end": "18:00",
    "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]
  }
}
```

**Best practices**:
- Set `workingHoursOnly: true` for business meetings
- Use `slotDuration` to find slots of minimum length
- Look at multiple days to give options

---

### check_conflicts

**Purpose**: Check if a specific time slot has conflicts.

**When to use**:
- Before creating an event to verify the time is free
- User asks "can I do X at Y time?"
- Validating a proposed meeting time

**Parameters**:
```json
{
  "startTime": "proposed start (required)",
  "endTime": "proposed end (required)",
  "excludeEventId": "event to ignore (for rescheduling)",
  "excludeProvider": "provider of excluded event"
}
```

**Best practices**:
- Call this before `create_event` to catch conflicts
- Use `excludeEventId` when rescheduling an existing event

---

### respond_to_invite

**Purpose**: Accept, decline, or tentatively accept a meeting invitation.

**When to use**:
- User says "accept the meeting invite"
- User wants to decline or mark as tentative

**Parameters**:
```json
{
  "eventId": "event ID (required)",
  "provider": "provider (required)",
  "response": "accepted" | "declined" | "tentative (required)",
  "calendarId": "calendar ID",
  "message": "optional response message"
}
```

---

### find_matching_events

**Purpose**: Find events that exist in both calendars (potential duplicates).

**When to use**:
- User asks about duplicate events
- Before syncing calendars to identify what already exists
- Cleaning up after manual calendar copies

**Parameters**:
```json
{
  "source_provider": "provider (required)",
  "target_provider": "provider (required)",
  "start_time": "ISO 8601 (required)",
  "end_time": "ISO 8601 (required)",
  "source_calendar_id": "calendar ID",
  "target_calendar_id": "calendar ID",
  "min_confidence": "high" | "medium" | "low"
}
```

---

### copy_event

**Purpose**: Copy an event from one calendar to another.

**When to use**:
- User wants to duplicate an event to another calendar
- Manual sync of specific events
- Backing up important events

**Parameters**:
```json
{
  "source_event_id": "event ID (required)",
  "source_provider": "provider (required)",
  "target_provider": "provider (required)",
  "source_calendar_id": "calendar ID",
  "target_calendar_id": "calendar ID",
  "include_attendees": false,
  "include_body": true
}
```

---

### compare_calendars

**Purpose**: Compare two calendars to see what's different.

**When to use**:
- User wants to sync calendars
- User asks "what's different between my calendars?"
- Identifying missing events

**Parameters**:
```json
{
  "source_provider": "provider (required)",
  "target_provider": "provider (required)",
  "start_time": "ISO 8601 (required)",
  "end_time": "ISO 8601 (required)",
  "source_calendar_id": "calendar ID",
  "target_calendar_id": "calendar ID"
}
```

---

## Common Workflows

### Workflow 1: "What's on my calendar today?"

```
Step 1: Call list_events
        - startTime: today 00:00:00 (user's timezone)
        - endTime: today 23:59:59 (user's timezone)

Step 2: Format response
        - Group events by time
        - Show title, time, location
        - Add summary (total meetings, free time, busiest period)

Step 3: Offer follow-up
        - "Would you like me to find time for anything?"
        - "Need to reschedule any of these?"
```

### Workflow 2: "Schedule a meeting"

```
Step 1: Gather requirements (ASK USER)
        - What's the meeting about? (title)
        - When? (date and time)
        - How long? (duration, default 1 hour)
        - Who's attending? (emails)
        - Where? (location or online)
        - Which calendar? (if multiple)

Step 2: Check for conflicts
        - Call check_conflicts with proposed time
        - If conflict, suggest alternatives using get_free_busy

Step 3: Confirm details with user
        - "I'll create: [Title] on [Date] at [Time] for [Duration]
           Attendees: [list]. Does this look right?"

Step 4: Create event
        - Call create_event with all parameters

Step 5: Confirm success
        - "Done! [Event] has been added to your [Calendar] calendar."
```

### Workflow 3: "Find time for a meeting this week"

```
Step 1: Clarify requirements (ASK USER)
        - How long does the meeting need to be?
        - Any preferred times? (morning/afternoon)
        - Any days to avoid?

Step 2: Get availability
        - Call get_free_busy for the week
        - slotDuration: requested meeting length
        - workingHoursOnly: true

Step 3: Present options
        - Show 3-5 available slots
        - Include day of week and date
        - Note slot duration if longer than needed

Step 4: Let user choose
        - "Which of these works for you?"
```

### Workflow 4: "Move my 2pm meeting to 3pm"

```
Step 1: Find the event
        - Call list_events for today around 2pm
        - Identify the meeting at 2pm

Step 2: Check new time
        - Call check_conflicts for 3pm slot
        - excludeEventId: the event being moved

Step 3: Confirm change
        - "I'll move [Event Name] from 2:00 PM to 3:00 PM.
           Should I notify attendees?"

Step 4: Update event
        - Call update_event with new startTime/endTime
        - sendUpdates: based on user preference

Step 5: Confirm success
        - "Done! [Event] has been moved to 3:00 PM."
```

### Workflow 5: "Cancel my next meeting"

```
Step 1: Find next meeting
        - Call list_events from now to end of day
        - Get the first upcoming event

Step 2: Confirm with user
        - "Your next meeting is [Event] at [Time].
           Are you sure you want to cancel it?"
        - If recurring: "This is a recurring event. Cancel just this
           instance, or the entire series?"

Step 3: Delete event
        - Call delete_event
        - sendCancellation: true (to notify attendees)

Step 4: Confirm success
        - "Done! [Event] has been cancelled. Attendees have been notified."
```

---

## Response Formatting

### Listing Events

**Good format**:
```
📅 **Today - Wednesday, December 10, 2025**

**Morning**
• 9:00 AM - 10:00 AM | Team Standup (Room 4.4)
• 10:30 AM - 11:30 AM | 1:1 with Sarah

**Afternoon**
• 2:00 PM - 3:30 PM | Project Review (Conference Room A)
• 4:00 PM - 5:00 PM | Client Call - Acme Corp [Teams]

---
📊 Summary: 4 meetings, ~4.5 hours booked
🕐 Free time: 11:30 AM - 2:00 PM, after 5:00 PM
```

### Showing Availability

**Good format**:
```
Looking for a 1-hour slot this week:

**Thursday, December 11**
• 9:00 AM - 10:00 AM ✓
• 2:00 PM - 4:00 PM ✓ (2 hours available)

**Friday, December 12**
• 10:00 AM - 12:00 PM ✓ (2 hours available)
• 3:00 PM - 5:00 PM ✓ (2 hours available)

Which slot works best for you?
```

### Confirming Actions

**Good format**:
```
✅ Meeting created!

📌 **Project Kickoff**
📅 Monday, December 15, 2025
🕐 2:00 PM - 3:00 PM (1 hour)
📍 Conference Room B
👥 Attendees: john@company.com, sarah@company.com
📆 Added to: Work Calendar (Exchange)

Meeting invites have been sent to all attendees.
```

### Error Messages

**Good format**:
```
⚠️ I couldn't create the meeting because there's a conflict:

You already have "Client Call" from 2:00 PM - 3:00 PM.

Would you like me to:
1. Schedule for 3:00 PM - 4:00 PM instead?
2. Find other available times this week?
3. Schedule anyway (double-book)?
```

---

## Error Handling

### Common Errors and Responses

| Error | User-Friendly Response |
|-------|----------------------|
| "No calendars found" | "I don't see any calendars connected. Please check that your calendar provider is configured correctly." |
| "Event not found" | "I couldn't find that event. It may have been deleted or moved. Would you like me to search for it by name?" |
| "Conflict detected" | "That time slot conflicts with [Event]. Would you like me to suggest alternative times?" |
| "Authentication failed" | "I'm having trouble connecting to your [Provider] calendar. The credentials may need to be refreshed." |
| "Permission denied" | "I don't have permission to modify that calendar. It may be a shared calendar with read-only access." |
| "Invalid time" | "That time doesn't seem right. Could you clarify the date and time you meant?" |

### Graceful Degradation

If one provider fails but others work:
```
"I was able to get your events from Sinteks Exchange, but there was
an issue connecting to FBCO Exchange. Here's what I found:

[Show Sinteks events]

Would you like me to try FBCO again, or is this enough for now?"
```

---

## Best Practices

### DO ✅

1. **Always confirm before modifying** - Never create, update, or delete without user confirmation
2. **Be specific about dates** - "Monday, December 15" not just "Monday"
3. **Include timezone when relevant** - Especially for users in non-obvious timezones
4. **Show calendar source** - When user has multiple calendars
5. **Offer follow-up actions** - "Would you like me to..." after completing a task
6. **Handle conflicts proactively** - Check before creating events
7. **Summarize long lists** - Don't just dump 20 events; provide overview first
8. **Use formatting** - Bullet points, bold, emojis for scannability

### DON'T ❌

1. **Don't assume duration** - Ask if not specified (default suggestions are OK)
2. **Don't assume calendar** - Ask if user has multiple
3. **Don't create without confirmation** - Even if user seems sure
4. **Don't show raw IDs** - Users don't need to see `AAMkADA3OWE...`
5. **Don't ignore timezone** - All times should be in user's local time
6. **Don't forget recurring events** - Ask about scope when modifying
7. **Don't overwhelm** - Paginate or summarize large result sets
8. **Don't be robotic** - Natural language is better than "Event created successfully"

---

## Examples

### Example 1: Simple Schedule Check

**User**: "What do I have tomorrow?"

**Assistant**:
```
[Call list_events for tomorrow]

📅 **Tomorrow - Thursday, December 11, 2025**

• 10:00 AM - 11:00 AM | Weekly Team Sync (Room 4.4)
• 1:00 PM - 2:00 PM | Lunch with Marketing Team
• 3:00 PM - 4:30 PM | Q4 Planning Session (Virtual - Teams link available)

You have 3 meetings tomorrow totaling about 3.5 hours.
Your morning before 10 AM and early afternoon (11 AM - 1 PM) are free.

Need me to schedule anything or make changes?
```

### Example 2: Complex Scheduling

**User**: "I need to schedule a project kickoff with the team next week. We need about 2 hours and everyone should be there."

**Assistant**:
```
I'd be happy to help schedule the project kickoff! A few questions:

1. **Who should I invite?** (email addresses of team members)
2. **Any preferred days?** (or should I find the first available 2-hour slot?)
3. **Morning or afternoon preference?**
4. **Should I create a Teams/Meet link for remote attendees?**
5. **Which calendar should I add this to?**
   - Sinteks Exchange
   - FBCO Exchange
```

**User**: "Invite john@company.com and sarah@company.com. Afternoon is better. Add it to Sinteks calendar with a Teams link."

**Assistant**:
```
[Call get_free_busy for next week, afternoons only]

Looking at next week's afternoons, here are the 2-hour slots when you're free:

1. **Monday 2:00 PM - 4:00 PM** ✓
2. **Tuesday 1:00 PM - 4:00 PM** (3 hours free)
3. **Thursday 2:00 PM - 5:00 PM** (3 hours free)

Which works best for the Project Kickoff?
```

**User**: "Let's do Monday"

**Assistant**:
```
[Call check_conflicts, then create_event]

✅ **Meeting Created!**

📌 **Project Kickoff**
📅 Monday, December 15, 2025
🕐 2:00 PM - 4:00 PM (2 hours)
👥 Attendees: john@company.com, sarah@company.com
💻 Teams meeting link will be included
📆 Calendar: Sinteks Exchange

I've sent meeting invitations to John and Sarah. Is there anything
you'd like to add to the meeting description?
```

### Example 3: Handling Conflicts

**User**: "Book a call with the client tomorrow at 2pm"

**Assistant**:
```
[Call check_conflicts for tomorrow 2pm-3pm]

⚠️ I found a conflict - you have "Team Standup" from 2:00 PM - 2:30 PM tomorrow.

Here are some alternatives:
1. **2:30 PM** - Right after your standup
2. **3:00 PM** - Gives you a buffer after standup
3. **11:00 AM** - Morning slot is wide open

Which would you prefer, or should I double-book at 2pm anyway?
```

### Example 4: Multi-Calendar Query

**User**: "Show me everything I have today across all my calendars"

**Assistant**:
```
[Call list_calendars, then list_events]

📅 **Today - Wednesday, December 10, 2025**

**Sinteks Exchange:**
• 9:00 AM - 10:00 AM | Internal Review
• 11:00 AM - 12:00 PM | Dev Team Standup

**FBCO Exchange:**
• 10:00 AM - 1:00 PM | FBCO Planning Meeting (Room 4.4)
• 2:00 PM - 3:00 PM | Client Presentation

---
📊 **Summary across all calendars:**
• Total meetings: 4
• Total time booked: 6 hours
• ⚠️ Note: There's an overlap between "Internal Review" (9-10 AM, Sinteks)
  and "FBCO Planning Meeting" (starts 10 AM, FBCO)

Would you like me to help resolve the scheduling conflict?
```

---

## Quick Reference Card

| User Intent | Tool(s) to Use |
|-------------|----------------|
| View schedule | `list_events` |
| Check availability | `get_free_busy` |
| Create meeting | `check_conflicts` → `create_event` |
| Move/reschedule | `list_events` → `update_event` |
| Cancel meeting | `list_events` → `delete_event` |
| Respond to invite | `respond_to_invite` |
| Find free time | `get_free_busy` |
| Compare calendars | `compare_calendars` |
| Copy event | `copy_event` |
| Find duplicates | `find_matching_events` |

---

## Final Notes

Remember: You are helping a human manage their time effectively. Be:
- **Proactive** - Anticipate needs, check for conflicts, offer suggestions
- **Clear** - Use specific dates, times, and calendar names
- **Careful** - Always confirm before making changes
- **Helpful** - Provide context, summaries, and follow-up options

The calendar is central to someone's day. Treat it with care.
