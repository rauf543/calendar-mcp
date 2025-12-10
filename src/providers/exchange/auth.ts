/**
 * Exchange EWS authentication handling
 */

import type { ExchangeProviderConfig, ExchangeAuthMethod } from '../../types/index.js';
import { CalendarMCPError, ErrorCodes } from '../../utils/error.js';

/**
 * Exchange credentials interface
 */
export interface ExchangeCredentials {
  username: string;
  password: string;
  domain?: string;
}

/**
 * Exchange auth manager
 */
export class ExchangeAuthManager {
  private config: ExchangeProviderConfig;
  private credentials: ExchangeCredentials | null = null;

  constructor(config: ExchangeProviderConfig) {
    this.config = config;
    this.initializeCredentials();
  }

  private initializeCredentials(): void {
    if (this.config.authMethod === 'ntlm' || this.config.authMethod === 'basic') {
      if (this.config.username && this.config.password) {
        this.credentials = {
          username: this.config.username,
          password: this.config.password,
          domain: this.config.domain,
        };
      }
    } else if (this.config.authMethod === 'oauth' && this.config.oauth) {
      // OAuth is handled separately
    }
  }

  /**
   * Get authentication method
   */
  getAuthMethod(): ExchangeAuthMethod {
    return this.config.authMethod;
  }

  /**
   * Get EWS URL
   */
  getEwsUrl(): string {
    return this.config.ewsUrl;
  }

  /**
   * Get credentials for NTLM/Basic auth
   */
  getCredentials(): ExchangeCredentials {
    if (!this.credentials) {
      throw new CalendarMCPError(
        'No Exchange credentials available',
        ErrorCodes.AUTH_MISSING,
        { provider: 'exchange' }
      );
    }
    return this.credentials;
  }

  /**
   * Get OAuth access token
   */
  async getOAuthToken(): Promise<string> {
    if (this.config.authMethod !== 'oauth' || !this.config.oauth?.accessToken) {
      throw new CalendarMCPError(
        'OAuth not configured for Exchange',
        ErrorCodes.AUTH_MISSING,
        { provider: 'exchange' }
      );
    }
    return this.config.oauth.accessToken;
  }

  /**
   * Check if we have valid credentials
   */
  hasCredentials(): boolean {
    if (this.config.authMethod === 'ntlm' || this.config.authMethod === 'basic') {
      return !!(this.credentials?.username && this.credentials?.password);
    } else if (this.config.authMethod === 'oauth') {
      return !!this.config.oauth?.accessToken;
    }
    return false;
  }
}

/**
 * Create auth manager from config
 */
export function createExchangeAuthManager(config: ExchangeProviderConfig): ExchangeAuthManager {
  return new ExchangeAuthManager(config);
}
