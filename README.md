# Calendar MCP Server

A Model Context Protocol (MCP) server providing unified calendar management across Google Calendar, Microsoft 365, and Exchange On-Premises.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Google Calendar Setup](#google-calendar-setup)
  - [Microsoft 365 Setup](#microsoft-365-setup)
  - [Exchange On-Premises Setup](#exchange-on-premises-setup)
  - [Multiple Exchange Accounts](#multiple-exchange-accounts)
- [Claude Code Integration](#claude-code-integration)
- [Tools Reference](#tools-reference)
- [Resources Reference](#resources-reference)
- [Prompts Reference](#prompts-reference)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)
- [Architecture](#architecture)

---

## Features

- **Multi-Provider Support**: Connect to Google Calendar, Microsoft 365 (Graph API), and Exchange On-Premises (EWS)
- **Multiple Accounts**: Support for multiple accounts per provider (e.g., 2+ Exchange accounts)
- **12 MCP Tools**: Comprehensive calendar operations including CRUD, free/busy, conflict detection, and sync helpers
- **4 MCP Resources**: Quick access to calendar summaries, today's events, weekly schedule, and upcoming events
- **4 MCP Prompts**: Pre-built templates for scheduling meetings and daily briefings
- **NTLM Authentication**: Full support for Exchange NTLM authentication via `@ewsjs/xhr`
- **Unified Data Model**: Consistent event format across all providers
- **Timezone Support**: Configurable timezone for all operations

---

## Quick Start

```bash
# 1. Clone/navigate to the project
cd calendar-mcp

# 2. Install dependencies
npm install

# 3. Build the project
npm run build

# 4. Configure environment variables (see Configuration section)
cp .env.example .env
# Edit .env with your credentials

# 5. Test the server
node dist/index.js
```

---

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- Access to at least one calendar provider (Google, Microsoft 365, or Exchange)

### Install Dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

---

## Configuration

The server uses environment variables for configuration. Create a `.env` file in the project root or pass environment variables directly.

### Environment Variables

#### Server Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_SERVER_NAME` | Server name for identification | `calendar-mcp` |
| `MCP_SERVER_VERSION` | Server version | `1.0.0` |
| `LOG_LEVEL` | Logging level: `debug`, `info`, `warn`, `error` | `info` |
| `DEFAULT_TIMEZONE` | IANA timezone for all operations | `UTC` |
| `DEFAULT_WORKING_HOURS_START` | Working hours start (HH:MM) | `09:00` |
| `DEFAULT_WORKING_HOURS_END` | Working hours end (HH:MM) | `18:00` |
| `DEFAULT_WORKING_DAYS` | Working days (comma-separated) | `monday,tuesday,wednesday,thursday,friday` |

#### Request Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `REQUEST_TIMEOUT` | Request timeout in milliseconds | `30000` |
| `MAX_RETRIES` | Maximum retry attempts | `3` |
| `RETRY_DELAY_MS` | Delay between retries | `1000` |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | Rate limiting | `60` |

---

### Google Calendar Setup

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_ENABLED` | Enable Google Calendar | Yes |
| `GOOGLE_PROVIDER_ID` | Unique identifier for this account | Yes |
| `GOOGLE_PROVIDER_NAME` | Display name | Yes |
| `GOOGLE_EMAIL` | Google account email | Yes |
| `GOOGLE_CLIENT_ID` | OAuth client ID from Google Cloud Console | Yes |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | Yes |
| `GOOGLE_REDIRECT_URI` | OAuth redirect URI | Yes |
| `GOOGLE_ACCESS_TOKEN` | Pre-authorized access token | Yes |
| `GOOGLE_REFRESH_TOKEN` | Refresh token for token renewal | Yes |
| `GOOGLE_TOKEN_EXPIRY` | Token expiry (ISO 8601) | No |

#### Getting Google Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the **Google Calendar API**
4. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
5. Configure consent screen if prompted
6. Select **Desktop app** or **Web application**
7. Copy Client ID and Client Secret
8. Use [OAuth Playground](https://developers.google.com/oauthplayground/) to get tokens:
   - Select `https://www.googleapis.com/auth/calendar`
   - Authorize and get access/refresh tokens

#### Example Google Configuration

```bash
GOOGLE_ENABLED=true
GOOGLE_PROVIDER_ID=google-personal
GOOGLE_PROVIDER_NAME=Personal Google Calendar
GOOGLE_EMAIL=yourname@gmail.com
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/google/callback
GOOGLE_ACCESS_TOKEN=ya29.xxxxx
GOOGLE_REFRESH_TOKEN=1//xxxxx
```

---

### Microsoft 365 Setup

| Variable | Description | Required |
|----------|-------------|----------|
| `MICROSOFT_ENABLED` | Enable Microsoft 365 | Yes |
| `MICROSOFT_PROVIDER_ID` | Unique identifier for this account | Yes |
| `MICROSOFT_PROVIDER_NAME` | Display name | Yes |
| `MICROSOFT_EMAIL` | Microsoft account email | Yes |
| `MICROSOFT_CLIENT_ID` | Azure AD app client ID | Yes |
| `MICROSOFT_CLIENT_SECRET` | Azure AD app client secret | Yes |
| `MICROSOFT_TENANT_ID` | Azure tenant ID (`common`, `organizations`, or specific) | Yes |
| `MICROSOFT_REDIRECT_URI` | OAuth redirect URI | Yes |
| `MICROSOFT_ACCESS_TOKEN` | Pre-authorized access token | Yes |
| `MICROSOFT_REFRESH_TOKEN` | Refresh token | Yes |
| `MICROSOFT_TOKEN_EXPIRY` | Token expiry (ISO 8601) | No |

#### Getting Microsoft Credentials

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Add redirect URI
5. Go to **Certificates & secrets** → **New client secret**
6. Go to **API permissions** → Add:
   - `Calendars.ReadWrite`
   - `User.Read`
7. Grant admin consent if required
8. Use [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer) to test

#### Example Microsoft Configuration

```bash
MICROSOFT_ENABLED=true
MICROSOFT_PROVIDER_ID=microsoft-work
MICROSOFT_PROVIDER_NAME=Work Microsoft 365
MICROSOFT_EMAIL=yourname@company.com
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxx
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=http://localhost:3000/oauth/microsoft/callback
MICROSOFT_ACCESS_TOKEN=eyJ0eXAiOiJKV1QiLCJ...
MICROSOFT_REFRESH_TOKEN=0.xxxxx
```

---

### Exchange On-Premises Setup

| Variable | Description | Required |
|----------|-------------|----------|
| `EXCHANGE_ENABLED` | Enable Exchange provider | Yes |
| `EXCHANGE_PROVIDER_ID` | Unique identifier for this account | Yes |
| `EXCHANGE_PROVIDER_NAME` | Display name | Yes |
| `EXCHANGE_EMAIL` | Exchange email address | Yes |
| `EXCHANGE_EWS_URL` | EWS endpoint URL | Yes |
| `EXCHANGE_AUTH_METHOD` | Authentication: `ntlm`, `basic`, or `oauth` | Yes |

#### For NTLM Authentication (most common for on-premises)

| Variable | Description | Required |
|----------|-------------|----------|
| `EXCHANGE_USERNAME` | Username (without domain) | Yes |
| `EXCHANGE_PASSWORD` | Password (quote if special chars) | Yes |
| `EXCHANGE_DOMAIN` | Active Directory domain | Yes |

#### For Basic Authentication

| Variable | Description | Required |
|----------|-------------|----------|
| `EXCHANGE_USERNAME` | Full username or email | Yes |
| `EXCHANGE_PASSWORD` | Password | Yes |

#### For OAuth Authentication (Hybrid Exchange)

| Variable | Description | Required |
|----------|-------------|----------|
| `EXCHANGE_OAUTH_CLIENT_ID` | Azure AD app ID | Yes |
| `EXCHANGE_OAUTH_CLIENT_SECRET` | Client secret | Yes |
| `EXCHANGE_OAUTH_TENANT_ID` | Azure tenant ID | Yes |
| `EXCHANGE_OAUTH_ACCESS_TOKEN` | Access token | Yes |
| `EXCHANGE_OAUTH_REFRESH_TOKEN` | Refresh token | No |

#### Finding Your EWS URL

1. Open Outlook on desktop
2. Hold Ctrl and right-click the Outlook icon in system tray
3. Select "Test E-mail AutoConfiguration"
4. Look for the EWS URL (typically `https://mail.company.com/EWS/Exchange.asmx`)

Or ask your Exchange administrator.

#### Example Exchange Configuration (NTLM)

```bash
EXCHANGE_ENABLED=true
EXCHANGE_PROVIDER_ID=exchange-work
EXCHANGE_PROVIDER_NAME=Work Exchange
EXCHANGE_EMAIL=yourname@company.com
EXCHANGE_EWS_URL=https://mail.company.com/EWS/Exchange.asmx
EXCHANGE_AUTH_METHOD=ntlm
EXCHANGE_USERNAME="yourname"
EXCHANGE_PASSWORD="YourP@ssword!"
EXCHANGE_DOMAIN="COMPANYDOMAIN"
```

> **Note**: If your password contains special characters like `!`, `@`, `$`, wrap it in quotes.

---

### Multiple Exchange Accounts

To configure additional Exchange accounts, use the `EXCHANGE_2_`, `EXCHANGE_3_`, etc. prefixes:

```bash
# First Exchange Account
EXCHANGE_ENABLED=true
EXCHANGE_PROVIDER_ID=exchange-account1
EXCHANGE_PROVIDER_NAME=Account 1
EXCHANGE_EMAIL=user1@company.com
EXCHANGE_EWS_URL=https://mail.company.com/EWS/Exchange.asmx
EXCHANGE_AUTH_METHOD=ntlm
EXCHANGE_USERNAME="user1"
EXCHANGE_PASSWORD="password1"
EXCHANGE_DOMAIN="DOMAIN"

# Second Exchange Account
EXCHANGE_2_ENABLED=true
EXCHANGE_2_PROVIDER_ID=exchange-account2
EXCHANGE_2_PROVIDER_NAME=Account 2
EXCHANGE_2_EMAIL=user2@company.com
EXCHANGE_2_EWS_URL=https://mail.company.com/EWS/Exchange.asmx
EXCHANGE_2_AUTH_METHOD=ntlm
EXCHANGE_2_USERNAME="user2"
EXCHANGE_2_PASSWORD="password2"
EXCHANGE_2_DOMAIN="DOMAIN"

# Third Exchange Account (if needed)
EXCHANGE_3_ENABLED=true
# ... and so on
```

---

## Claude Code Integration

### Method 1: Using /mcp Command (Recommended)

1. Open Claude Code in your project directory
2. Run `/mcp`
3. Select "Add Server"
4. Configure with:

```json
{
  "type": "stdio",
  "command": "node",
  "args": ["/full/path/to/calendar-mcp/dist/index.js"],
  "env": {
    "DEFAULT_TIMEZONE": "Your/Timezone",
    "EXCHANGE_ENABLED": "true",
    "EXCHANGE_PROVIDER_ID": "your-exchange",
    "EXCHANGE_PROVIDER_NAME": "Your Exchange",
    "EXCHANGE_EMAIL": "your@email.com",
    "EXCHANGE_EWS_URL": "https://mail.company.com/EWS/Exchange.asmx",
    "EXCHANGE_AUTH_METHOD": "ntlm",
    "EXCHANGE_USERNAME": "username",
    "EXCHANGE_PASSWORD": "password",
    "EXCHANGE_DOMAIN": "DOMAIN"
  }
}
```

5. Restart Claude Code or run `/mcp` and reconnect

### Method 2: Edit ~/.claude.json Directly

Add to the `mcpServers` object in your project's configuration:

```json
{
  "projects": {
    "/path/to/your/project": {
      "mcpServers": {
        "calendar": {
          "type": "stdio",
          "command": "node",
          "args": ["/full/path/to/calendar-mcp/dist/index.js"],
          "env": {
            "DEFAULT_TIMEZONE": "Asia/Baku",
            "EXCHANGE_ENABLED": "true",
            "EXCHANGE_PROVIDER_ID": "exchange-work",
            "EXCHANGE_PROVIDER_NAME": "Work Calendar",
            "EXCHANGE_EMAIL": "you@company.com",
            "EXCHANGE_EWS_URL": "https://mail.company.com/EWS/Exchange.asmx",
            "EXCHANGE_AUTH_METHOD": "ntlm",
            "EXCHANGE_USERNAME": "username",
            "EXCHANGE_PASSWORD": "password",
            "EXCHANGE_DOMAIN": "DOMAIN"
          }
        }
      }
    }
  }
}
```

### Verify Connection

After configuring, test with:
- Ask Claude: "List my calendars"
- Or: "What meetings do I have today?"

---

## Tools Reference

### Core Calendar Operations

#### `list_calendars`

List all available calendars across connected providers.

| Parameter | Type | Description |
|-----------|------|-------------|
| `provider` | string | Filter by provider: `google`, `microsoft`, `exchange`, or `all` (default: `all`) |

**Example:**
```
List all my calendars
```

---

#### `list_events`

List events within a time range with optional filters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startTime` | string | Yes | Start of time range (ISO 8601) |
| `endTime` | string | Yes | End of time range (ISO 8601) |
| `providers` | string[] | No | Filter to specific providers |
| `calendarIds` | string[] | No | Filter to specific calendar IDs |
| `searchQuery` | string | No | Text search in subject/body |
| `maxResults` | number | No | Maximum results (default: 100, max: 500) |
| `orderBy` | string | No | Sort order: `start` or `updated` |
| `expandRecurring` | boolean | No | Expand recurring events (default: true) |

**Example:**
```
Show me all my meetings for tomorrow
What events do I have this week?
Search my calendar for "standup" meetings
```

---

#### `get_event`

Get detailed information about a specific event.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventId` | string | Yes | The event ID |
| `provider` | string | Yes | Provider: `google`, `microsoft`, or `exchange` |
| `calendarId` | string | No | Calendar ID (required for some providers) |

**Example:**
```
Get details for event ID AAMkADA3OWE...
```

---

#### `create_event`

Create a new calendar event.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `provider` | string | Yes | Provider to create event on |
| `subject` | string | Yes | Event title |
| `startTime` | string | Yes | Start time (ISO 8601) |
| `endTime` | string | Yes | End time (ISO 8601) |
| `calendarId` | string | No | Target calendar ID |
| `body` | string | No | Event description |
| `bodyType` | string | No | Body type: `text` or `html` |
| `location` | string | No | Physical location |
| `attendees` | array | No | List of attendees with `email` and `type` |
| `isAllDay` | boolean | No | All-day event |
| `recurrence` | object | No | Recurrence settings |
| `reminderMinutes` | number | No | Reminder before event |
| `createOnlineMeeting` | boolean | No | Create Teams/Meet link |
| `onlineMeetingProvider` | string | No | `teams` or `meet` |
| `sensitivity` | string | No | `normal`, `personal`, `private`, `confidential` |
| `showAs` | string | No | `free`, `busy`, `tentative`, `oof`, `workingElsewhere` |

**Example:**
```
Create a meeting called "Project Review" tomorrow at 2pm for 1 hour
Schedule a lunch event next Monday from 12-1pm at "Cafe Downtown"
Create a weekly team standup every Monday at 9am
```

---

#### `update_event`

Update an existing event.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventId` | string | Yes | Event ID to update |
| `provider` | string | Yes | Provider the event belongs to |
| `subject` | string | No | New title |
| `startTime` | string | No | New start time |
| `endTime` | string | No | New end time |
| `body` | string | No | New description |
| `location` | string | No | New location |
| `attendees` | array | No | Updated attendee list |
| `updateScope` | string | No | For recurring: `single`, `thisAndFuture`, `all` |
| `sendUpdates` | boolean | No | Notify attendees (default: true) |

**Example:**
```
Move my 2pm meeting to 3pm
Change the location of event AAMk... to "Room 201"
```

---

#### `delete_event`

Delete a calendar event.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventId` | string | Yes | Event ID to delete |
| `provider` | string | Yes | Provider the event belongs to |
| `calendarId` | string | No | Calendar ID |
| `deleteScope` | string | No | For recurring: `single`, `thisAndFuture`, `all` |
| `sendCancellation` | boolean | No | Send cancellation notices |

**Example:**
```
Delete my 3pm meeting
Cancel all instances of my recurring standup
```

---

### Availability & Scheduling

#### `get_free_busy`

Get aggregated availability across all calendars.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startTime` | string | Yes | Start of time range (ISO 8601) |
| `endTime` | string | Yes | End of time range (ISO 8601) |
| `providers` | string[] | No | Filter to specific providers |
| `calendarIds` | string[] | No | Filter to specific calendars |
| `slotDuration` | number | No | Minimum free slot duration in minutes |
| `workingHoursOnly` | boolean | No | Only consider working hours |
| `workingHours` | object | No | Custom working hours config |

**Example:**
```
When am I free tomorrow?
Find me a 1-hour free slot this week
Show my availability for the next 3 days during working hours
```

---

#### `check_conflicts`

Check if a proposed time slot conflicts with existing events.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startTime` | string | Yes | Proposed start time (ISO 8601) |
| `endTime` | string | Yes | Proposed end time (ISO 8601) |
| `excludeEventId` | string | No | Event ID to exclude (for rescheduling) |
| `excludeProvider` | string | No | Provider of excluded event |

**Example:**
```
Do I have any conflicts tomorrow at 2pm?
Check if I can schedule a meeting on Friday from 10-11am
```

---

#### `respond_to_invite`

Respond to a meeting invitation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventId` | string | Yes | Event ID |
| `provider` | string | Yes | Provider the event belongs to |
| `response` | string | Yes | Response: `accepted`, `declined`, `tentative` |
| `calendarId` | string | No | Calendar ID |
| `message` | string | No | Optional response message |

**Example:**
```
Accept the meeting invite for AAMk...
Decline the team lunch with message "I have a conflict"
Tentatively accept the project review
```

---

### Sync Helpers

#### `find_matching_events`

Find matching events between two calendars.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source_provider` | string | Yes | Source calendar provider |
| `target_provider` | string | Yes | Target calendar provider |
| `start_time` | string | Yes | Start of time range |
| `end_time` | string | Yes | End of time range |
| `source_calendar_id` | string | No | Source calendar ID |
| `target_calendar_id` | string | No | Target calendar ID |
| `min_confidence` | string | No | Match confidence: `high`, `medium`, `low` |

**Example:**
```
Find events that exist in both my Exchange calendars
Check for duplicates between Google and Microsoft
```

---

#### `copy_event`

Copy an event from one calendar to another.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source_event_id` | string | Yes | Event ID to copy |
| `source_provider` | string | Yes | Source provider |
| `target_provider` | string | Yes | Target provider |
| `source_calendar_id` | string | No | Source calendar ID |
| `target_calendar_id` | string | No | Target calendar ID |
| `include_attendees` | boolean | No | Include attendees (default: false) |
| `include_body` | boolean | No | Include description (default: true) |

**Example:**
```
Copy event AAMk... from Exchange to Google Calendar
```

---

#### `compare_calendars`

Compare two calendars to find matching events, differences, and missing events.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source_provider` | string | Yes | Source calendar provider |
| `target_provider` | string | Yes | Target calendar provider |
| `start_time` | string | Yes | Start of time range |
| `end_time` | string | Yes | End of time range |
| `source_calendar_id` | string | No | Source calendar ID |
| `target_calendar_id` | string | No | Target calendar ID |

**Example:**
```
Compare my two Exchange calendars for this week
What events are only in my first calendar but not the second?
```

---

## Resources Reference

MCP Resources provide quick access to calendar data.

| URI | Description |
|-----|-------------|
| `calendar://summary` | Overview of all calendars with event counts |
| `calendar://today` | Today's events across all calendars |
| `calendar://week` | This week's events grouped by day |
| `calendar://next/{count}` | Next N upcoming events (e.g., `calendar://next/5`) |

**Usage in Claude Code:**
```
@calendar://today
Show me @calendar://summary
What's in @calendar://week
```

---

## Prompts Reference

MCP Prompts are pre-built conversation templates.

#### `schedule-meeting`

Interactive prompt to schedule a new meeting.

**Arguments:**
- `title`: Meeting title
- `duration`: Duration (e.g., "30 minutes", "1 hour")
- `attendees`: Comma-separated email addresses
- `notes`: Additional notes

---

#### `daily-briefing`

Generate a briefing of today's schedule.

**Arguments:**
- `timezone`: Override default timezone
- `include_details`: Include full event details (true/false)

---

#### `find-meeting-time`

Find available time slots for a meeting.

**Arguments:**
- `duration`: Required meeting duration
- `within_days`: Number of days to search
- `attendees`: Participants to check availability for

---

#### `sync-calendars`

Compare and sync events between calendars.

**Arguments:**
- `source_provider`: Source calendar provider
- `target_provider`: Target calendar provider
- `action`: `compare`, `copy_missing`, or `full_sync`

---

## Usage Examples

### Daily Workflow

```
# Morning check
"What's on my calendar today?"

# Quick view
"Show me my next 5 meetings"

# Check availability
"Am I free at 3pm today?"

# Schedule meeting
"Schedule a 30-minute call with john@company.com tomorrow at 2pm"
```

### Finding Time

```
"When am I free this week for a 1-hour meeting?"
"Find me an open slot tomorrow afternoon"
"Do I have any conflicts if I book 10-11am on Friday?"
```

### Managing Events

```
"Move my 2pm meeting to 3pm"
"Cancel tomorrow's standup"
"Add 'Conference Room A' as the location for my next meeting"
```

### Multi-Calendar

```
"Compare my two Exchange calendars for this week"
"List all calendars I have access to"
"Copy the project review from my work calendar to personal"
```

---

## Troubleshooting

### Common Issues

#### "No calendars found"

**Cause**: Environment variables not loaded properly.

**Solutions**:
1. Verify `EXCHANGE_ENABLED=true` is set
2. Check that all required variables are present
3. For Claude Code: ensure `env` object in MCP config has all variables
4. Restart Claude Code after config changes

#### "401 Unauthorized" (Exchange NTLM)

**Cause**: Invalid credentials or wrong username format.

**Solutions**:
1. Use just the username, not `domain\user` format
2. Put the domain in `EXCHANGE_DOMAIN` separately
3. Quote passwords with special characters: `EXCHANGE_PASSWORD="P@ss!word"`
4. Verify credentials work by visiting EWS URL in browser

#### "Failed to connect to Exchange"

**Cause**: Network or certificate issues.

**Solutions**:
1. Verify EWS URL is accessible from your network
2. Check if VPN is required
3. For self-signed certs, you may need to set `NODE_TLS_REJECT_UNAUTHORIZED=0`

#### "Property not loaded" errors

**Cause**: EWS doesn't load all properties by default.

**Solution**: This is handled internally with safe property access. If you see this, update to latest version.

#### Google/Microsoft token expired

**Cause**: Access tokens have limited lifetime.

**Solution**:
1. Get new tokens using OAuth flow
2. Update `ACCESS_TOKEN` and `TOKEN_EXPIRY` in config
3. Implement token refresh in your setup

### Debug Mode

Run with debug logging:

```bash
LOG_LEVEL=debug node dist/index.js
```

### Testing Connection

Test Exchange connection directly:

```bash
# Set environment variables
export EXCHANGE_ENABLED=true
export EXCHANGE_EWS_URL=https://mail.company.com/EWS/Exchange.asmx
export EXCHANGE_AUTH_METHOD=ntlm
export EXCHANGE_USERNAME=youruser
export EXCHANGE_PASSWORD='yourpassword'
export EXCHANGE_DOMAIN=YOURDOMAIN

# Run test
node -e "
const { loadConfig, hasConfiguredProviders } = require('./dist/utils/config.js');
console.log('Has providers:', hasConfiguredProviders());
console.log('Config:', JSON.stringify(loadConfig(), null, 2));
"
```

---

## Architecture

```
calendar-mcp/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── types/
│   │   └── index.ts             # TypeScript interfaces
│   ├── providers/
│   │   ├── base.ts              # Base provider interface
│   │   ├── google/
│   │   │   ├── index.ts         # Google Calendar provider
│   │   │   └── client.ts        # Google API client
│   │   ├── microsoft/
│   │   │   ├── index.ts         # Microsoft 365 provider
│   │   │   └── client.ts        # Graph API client
│   │   └── exchange/
│   │       ├── index.ts         # Exchange EWS provider
│   │       ├── client.ts        # EWS client with NTLM support
│   │       └── auth.ts          # Authentication manager
│   ├── services/
│   │   ├── calendar-service.ts  # Multi-provider orchestration
│   │   └── sync-service.ts      # Calendar sync logic
│   ├── tools/
│   │   ├── index.ts             # Tool registration
│   │   ├── list-calendars.ts
│   │   ├── list-events.ts
│   │   ├── get-event.ts
│   │   ├── create-event.ts
│   │   ├── update-event.ts
│   │   ├── delete-event.ts
│   │   ├── get-free-busy.ts
│   │   ├── check-conflicts.ts
│   │   ├── respond-to-invite.ts
│   │   ├── find-matching-events.ts
│   │   ├── copy-event.ts
│   │   └── compare-calendars.ts
│   ├── resources/
│   │   └── index.ts             # MCP resources
│   ├── prompts/
│   │   └── index.ts             # MCP prompts
│   └── utils/
│       ├── config.ts            # Configuration loader
│       ├── date.ts              # Date utilities
│       └── formatting.ts        # Output formatting
├── dist/                        # Compiled JavaScript
├── .env                         # Environment configuration
├── .env.example                 # Example configuration
├── package.json
├── tsconfig.json
└── README.md
```

### Key Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP server implementation |
| `ews-javascript-api` | Exchange Web Services client |
| `@ewsjs/xhr` | NTLM authentication for EWS |
| `@microsoft/microsoft-graph-client` | Microsoft Graph API |
| `googleapis` | Google Calendar API |
| `dotenv` | Environment variable loading |
| `date-fns` | Date manipulation |
| `date-fns-tz` | Timezone handling |

---

## License

MIT

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

---

## Support

For issues and feature requests, please open a GitHub issue.
