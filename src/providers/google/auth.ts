/**
 * Google Calendar OAuth authentication handling
 */

import { google } from 'googleapis';
import type { OAuth2Client, Credentials } from 'google-auth-library';
import type { GoogleProviderConfig } from '../../types/index.js';
import { CalendarMCPError, ErrorCodes } from '../../utils/error.js';

/**
 * Required OAuth scopes for Google Calendar
 */
export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

/**
 * Create an OAuth2 client from configuration
 */
export function createOAuth2Client(config: GoogleProviderConfig): OAuth2Client {
  const oauth2Client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );

  // If we have pre-authorized credentials, set them
  if (config.credentials) {
    const credentials: Credentials = {
      access_token: config.credentials.accessToken,
      refresh_token: config.credentials.refreshToken,
      expiry_date: config.credentials.tokenExpiry
        ? new Date(config.credentials.tokenExpiry).getTime()
        : undefined,
    };
    oauth2Client.setCredentials(credentials);
  }

  return oauth2Client;
}

/**
 * Get authorization URL for OAuth flow
 */
export function getAuthUrl(oauth2Client: OAuth2Client): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_CALENDAR_SCOPES,
    prompt: 'consent', // Force consent to get refresh token
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  oauth2Client: OAuth2Client,
  code: string
): Promise<Credentials> {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    return tokens;
  } catch (error) {
    throw new CalendarMCPError(
      'Failed to exchange authorization code for tokens',
      ErrorCodes.AUTH_FAILED,
      {
        provider: 'google',
        cause: error instanceof Error ? error : undefined,
      }
    );
  }
}

/**
 * Check if tokens are expired or will expire soon
 */
export function isTokenExpired(oauth2Client: OAuth2Client, bufferMs: number = 60000): boolean {
  const credentials = oauth2Client.credentials;
  if (!credentials.expiry_date) {
    // No expiry info, assume not expired but try to refresh anyway
    return true;
  }
  return credentials.expiry_date <= Date.now() + bufferMs;
}

/**
 * Refresh the access token
 */
export async function refreshAccessToken(oauth2Client: OAuth2Client): Promise<Credentials> {
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    return credentials;
  } catch (error) {
    throw new CalendarMCPError(
      'Failed to refresh access token. Please re-authenticate.',
      ErrorCodes.AUTH_EXPIRED,
      {
        provider: 'google',
        cause: error instanceof Error ? error : undefined,
      }
    );
  }
}

/**
 * Ensure we have valid credentials, refreshing if necessary
 */
export async function ensureValidCredentials(oauth2Client: OAuth2Client): Promise<void> {
  const credentials = oauth2Client.credentials;

  if (!credentials.access_token) {
    throw new CalendarMCPError(
      'No access token available. Please authenticate.',
      ErrorCodes.AUTH_MISSING,
      { provider: 'google' }
    );
  }

  if (isTokenExpired(oauth2Client)) {
    if (!credentials.refresh_token) {
      throw new CalendarMCPError(
        'Access token expired and no refresh token available. Please re-authenticate.',
        ErrorCodes.AUTH_EXPIRED,
        { provider: 'google' }
      );
    }
    await refreshAccessToken(oauth2Client);
  }
}

/**
 * Get current credentials (for saving)
 */
export function getCredentials(oauth2Client: OAuth2Client): {
  accessToken: string;
  refreshToken: string;
  tokenExpiry?: string;
} | null {
  const creds = oauth2Client.credentials;
  if (!creds.access_token || !creds.refresh_token) {
    return null;
  }
  return {
    accessToken: creds.access_token,
    refreshToken: creds.refresh_token,
    tokenExpiry: creds.expiry_date
      ? new Date(creds.expiry_date).toISOString()
      : undefined,
  };
}
