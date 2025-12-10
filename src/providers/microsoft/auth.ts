/**
 * Microsoft Graph OAuth authentication handling
 */

import {
  ConfidentialClientApplication,
  PublicClientApplication,
  AccountInfo,
  AuthenticationResult,
} from '@azure/msal-node';
import type { MicrosoftProviderConfig } from '../../types/index.js';
import { CalendarMCPError, ErrorCodes } from '../../utils/error.js';

/**
 * Required OAuth scopes for Microsoft Graph Calendar
 */
export const MICROSOFT_CALENDAR_SCOPES = [
  'https://graph.microsoft.com/Calendars.ReadWrite',
  'https://graph.microsoft.com/User.Read',
  'offline_access',
];

/**
 * Token cache interface
 */
export interface TokenCache {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

/**
 * Microsoft auth manager
 */
export class MicrosoftAuthManager {
  private msalClient: ConfidentialClientApplication | PublicClientApplication | null = null;
  private currentToken: TokenCache | null = null;
  private config: MicrosoftProviderConfig;

  constructor(config: MicrosoftProviderConfig) {
    this.config = config;
    this.initializeMsal();
  }

  private initializeMsal(): void {
    if (this.config.clientId && this.config.clientSecret) {
      // Confidential client (server-side)
      this.msalClient = new ConfidentialClientApplication({
        auth: {
          clientId: this.config.clientId,
          clientSecret: this.config.clientSecret,
          authority: `https://login.microsoftonline.com/${this.config.tenantId}`,
        },
      });
    } else if (this.config.clientId) {
      // Public client (for pre-authorized tokens)
      this.msalClient = new PublicClientApplication({
        auth: {
          clientId: this.config.clientId,
          authority: `https://login.microsoftonline.com/${this.config.tenantId}`,
        },
      });
    }

    // Set pre-authorized credentials
    if (this.config.credentials) {
      this.currentToken = {
        accessToken: this.config.credentials.accessToken,
        refreshToken: this.config.credentials.refreshToken,
        expiresAt: this.config.credentials.tokenExpiry
          ? new Date(this.config.credentials.tokenExpiry).getTime()
          : undefined,
      };
    }
  }

  /**
   * Get a valid access token
   */
  async getAccessToken(): Promise<string> {
    // If we have a current token that's still valid, use it
    if (this.currentToken?.accessToken) {
      const expiresAt = this.currentToken.expiresAt ?? 0;
      const bufferMs = 5 * 60 * 1000; // 5 minute buffer

      if (Date.now() < expiresAt - bufferMs) {
        return this.currentToken.accessToken;
      }

      // Try to refresh
      if (this.currentToken.refreshToken) {
        try {
          await this.refreshToken();
          return this.currentToken.accessToken;
        } catch (error) {
          // Refresh failed, fall through to error
        }
      }
    }

    throw new CalendarMCPError(
      'No valid Microsoft access token available. Please re-authenticate.',
      ErrorCodes.AUTH_EXPIRED,
      { provider: 'microsoft' }
    );
  }

  /**
   * Refresh the access token
   */
  async refreshToken(): Promise<void> {
    if (!this.msalClient || !this.currentToken?.refreshToken) {
      throw new CalendarMCPError(
        'Cannot refresh token: missing MSAL client or refresh token',
        ErrorCodes.AUTH_FAILED,
        { provider: 'microsoft' }
      );
    }

    try {
      // For confidential clients with refresh tokens
      if (this.msalClient instanceof ConfidentialClientApplication) {
        const result = await this.msalClient.acquireTokenByRefreshToken({
          refreshToken: this.currentToken.refreshToken,
          scopes: MICROSOFT_CALENDAR_SCOPES,
        });

        if (result) {
          this.updateTokenFromResult(result);
        }
      }
    } catch (error) {
      throw new CalendarMCPError(
        `Failed to refresh Microsoft token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.AUTH_FAILED,
        { provider: 'microsoft', cause: error instanceof Error ? error : undefined }
      );
    }
  }

  /**
   * Update stored token from auth result
   */
  private updateTokenFromResult(result: AuthenticationResult): void {
    this.currentToken = {
      accessToken: result.accessToken,
      // Note: MSAL handles refresh tokens internally, we keep our stored one
      refreshToken: this.currentToken?.refreshToken,
      expiresAt: result.expiresOn?.getTime(),
    };
  }

  /**
   * Check if we have valid credentials
   */
  hasCredentials(): boolean {
    return !!(this.currentToken?.accessToken);
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthUrl(redirectUri: string): string {
    if (!this.msalClient) {
      throw new CalendarMCPError(
        'MSAL client not initialized',
        ErrorCodes.PROVIDER_NOT_CONFIGURED,
        { provider: 'microsoft' }
      );
    }

    const authCodeUrlParameters = {
      scopes: MICROSOFT_CALENDAR_SCOPES,
      redirectUri,
    };

    // This is async but we're returning a promise
    return `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/authorize?` +
      `client_id=${this.config.clientId}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(MICROSOFT_CALENDAR_SCOPES.join(' '))}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenCache> {
    if (!this.msalClient || !(this.msalClient instanceof ConfidentialClientApplication)) {
      throw new CalendarMCPError(
        'MSAL confidential client not initialized',
        ErrorCodes.PROVIDER_NOT_CONFIGURED,
        { provider: 'microsoft' }
      );
    }

    try {
      const result = await this.msalClient.acquireTokenByCode({
        code,
        scopes: MICROSOFT_CALENDAR_SCOPES,
        redirectUri,
      });

      if (result) {
        this.updateTokenFromResult(result);
        return this.currentToken!;
      }

      throw new Error('No token returned');
    } catch (error) {
      throw new CalendarMCPError(
        `Failed to exchange code for tokens: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.AUTH_FAILED,
        { provider: 'microsoft' }
      );
    }
  }
}

/**
 * Create auth manager from config
 */
export function createMicrosoftAuthManager(config: MicrosoftProviderConfig): MicrosoftAuthManager {
  return new MicrosoftAuthManager(config);
}
