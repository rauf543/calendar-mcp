/**
 * Configuration loading and validation for Calendar MCP
 */

import { config as loadEnv } from 'dotenv';
import type {
  ProviderConfig,
  GoogleProviderConfig,
  MicrosoftProviderConfig,
  ExchangeProviderConfig,
  ExchangeAuthMethod,
} from '../types/index.js';

// Load environment variables
loadEnv();

/**
 * Server configuration
 */
export interface ServerConfig {
  name: string;
  version: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Default settings configuration
 */
export interface DefaultsConfig {
  timezone: string;
  workingHours: {
    start: string;
    end: string;
    days: string[];
  };
}

/**
 * Request configuration
 */
export interface RequestConfig {
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

/**
 * Full application configuration
 */
export interface AppConfig {
  server: ServerConfig;
  defaults: DefaultsConfig;
  request: RequestConfig;
  providers: ProviderConfig[];
}

/**
 * Get environment variable with optional default
 */
function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue;
}

/**
 * Get required environment variable (throws if missing)
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Get boolean environment variable
 */
function getBoolEnv(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Get number environment variable
 */
function getNumberEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Load Google provider configuration from environment
 */
function loadGoogleConfig(): GoogleProviderConfig | null {
  if (!getBoolEnv('GOOGLE_ENABLED', false)) {
    return null;
  }

  const accessToken = getEnv('GOOGLE_ACCESS_TOKEN');
  const refreshToken = getEnv('GOOGLE_REFRESH_TOKEN');

  // Need either tokens or client credentials
  if (!accessToken && !getEnv('GOOGLE_CLIENT_ID')) {
    console.warn('Google Calendar: GOOGLE_ENABLED is true but no credentials provided');
    return null;
  }

  return {
    type: 'google',
    id: getEnv('GOOGLE_PROVIDER_ID', 'google-primary')!,
    name: getEnv('GOOGLE_PROVIDER_NAME', 'Google Calendar')!,
    email: getEnv('GOOGLE_EMAIL', '')!,
    enabled: true,
    clientId: getEnv('GOOGLE_CLIENT_ID'),
    clientSecret: getEnv('GOOGLE_CLIENT_SECRET'),
    redirectUri: getEnv('GOOGLE_REDIRECT_URI'),
    credentials:
      accessToken && refreshToken
        ? {
            accessToken,
            refreshToken,
            tokenExpiry: getEnv('GOOGLE_TOKEN_EXPIRY'),
          }
        : undefined,
  };
}

/**
 * Load Microsoft provider configuration from environment
 */
function loadMicrosoftConfig(): MicrosoftProviderConfig | null {
  if (!getBoolEnv('MICROSOFT_ENABLED', false)) {
    return null;
  }

  const accessToken = getEnv('MICROSOFT_ACCESS_TOKEN');
  const refreshToken = getEnv('MICROSOFT_REFRESH_TOKEN');

  // Need either tokens or client credentials
  if (!accessToken && !getEnv('MICROSOFT_CLIENT_ID')) {
    console.warn('Microsoft 365: MICROSOFT_ENABLED is true but no credentials provided');
    return null;
  }

  return {
    type: 'microsoft',
    id: getEnv('MICROSOFT_PROVIDER_ID', 'microsoft-primary')!,
    name: getEnv('MICROSOFT_PROVIDER_NAME', 'Microsoft 365')!,
    email: getEnv('MICROSOFT_EMAIL', '')!,
    enabled: true,
    tenantId: getEnv('MICROSOFT_TENANT_ID', 'common')!,
    clientId: getEnv('MICROSOFT_CLIENT_ID'),
    clientSecret: getEnv('MICROSOFT_CLIENT_SECRET'),
    redirectUri: getEnv('MICROSOFT_REDIRECT_URI'),
    credentials:
      accessToken && refreshToken
        ? {
            accessToken,
            refreshToken,
            tokenExpiry: getEnv('MICROSOFT_TOKEN_EXPIRY'),
          }
        : undefined,
  };
}

/**
 * Load Exchange provider configuration from environment
 */
function loadExchangeConfig(): ExchangeProviderConfig | null {
  if (!getBoolEnv('EXCHANGE_ENABLED', false)) {
    return null;
  }

  const ewsUrl = getEnv('EXCHANGE_EWS_URL');
  if (!ewsUrl) {
    console.warn('Exchange: EXCHANGE_ENABLED is true but EXCHANGE_EWS_URL is not set');
    return null;
  }

  const authMethod = (getEnv('EXCHANGE_AUTH_METHOD', 'ntlm') as ExchangeAuthMethod);

  const config: ExchangeProviderConfig = {
    type: 'exchange',
    id: getEnv('EXCHANGE_PROVIDER_ID', 'exchange-primary')!,
    name: getEnv('EXCHANGE_PROVIDER_NAME', 'Exchange')!,
    email: getEnv('EXCHANGE_EMAIL', '')!,
    enabled: true,
    ewsUrl,
    authMethod,
  };

  if (authMethod === 'ntlm' || authMethod === 'basic') {
    config.username = getEnv('EXCHANGE_USERNAME');
    config.password = getEnv('EXCHANGE_PASSWORD');
    if (authMethod === 'ntlm') {
      config.domain = getEnv('EXCHANGE_DOMAIN');
    }
  } else if (authMethod === 'oauth') {
    const oauthClientId = getEnv('EXCHANGE_OAUTH_CLIENT_ID');
    const oauthClientSecret = getEnv('EXCHANGE_OAUTH_CLIENT_SECRET');
    const oauthTenantId = getEnv('EXCHANGE_OAUTH_TENANT_ID');

    if (oauthClientId && oauthClientSecret && oauthTenantId) {
      config.oauth = {
        clientId: oauthClientId,
        clientSecret: oauthClientSecret,
        tenantId: oauthTenantId,
        accessToken: getEnv('EXCHANGE_OAUTH_ACCESS_TOKEN'),
        refreshToken: getEnv('EXCHANGE_OAUTH_REFRESH_TOKEN'),
      };
    }
  }

  return config;
}

/**
 * Load Exchange provider configuration from environment (with suffix for multiple)
 */
function loadExchangeConfigWithSuffix(suffix: string): ExchangeProviderConfig | null {
  const prefix = suffix ? `EXCHANGE_${suffix}_` : 'EXCHANGE_';
  const enabledKey = suffix ? `EXCHANGE_${suffix}_ENABLED` : 'EXCHANGE_ENABLED';

  if (!getBoolEnv(enabledKey, false)) {
    return null;
  }

  const ewsUrl = getEnv(`${prefix}EWS_URL`);
  if (!ewsUrl) {
    console.warn(`Exchange ${suffix}: ${prefix}EWS_URL is not set`);
    return null;
  }

  const authMethod = (getEnv(`${prefix}AUTH_METHOD`, 'ntlm') as ExchangeAuthMethod);

  const config: ExchangeProviderConfig = {
    type: 'exchange',
    id: getEnv(`${prefix}PROVIDER_ID`, `exchange-${suffix || 'primary'}`)!,
    name: getEnv(`${prefix}PROVIDER_NAME`, `Exchange ${suffix || ''}`.trim())!,
    email: getEnv(`${prefix}EMAIL`, '')!,
    enabled: true,
    ewsUrl,
    authMethod,
  };

  if (authMethod === 'ntlm' || authMethod === 'basic') {
    config.username = getEnv(`${prefix}USERNAME`);
    config.password = getEnv(`${prefix}PASSWORD`);
    if (authMethod === 'ntlm') {
      config.domain = getEnv(`${prefix}DOMAIN`);
    }
  } else if (authMethod === 'oauth') {
    const oauthClientId = getEnv(`${prefix}OAUTH_CLIENT_ID`);
    const oauthClientSecret = getEnv(`${prefix}OAUTH_CLIENT_SECRET`);
    const oauthTenantId = getEnv(`${prefix}OAUTH_TENANT_ID`);

    if (oauthClientId && oauthClientSecret && oauthTenantId) {
      config.oauth = {
        clientId: oauthClientId,
        clientSecret: oauthClientSecret,
        tenantId: oauthTenantId,
        accessToken: getEnv(`${prefix}OAUTH_ACCESS_TOKEN`),
        refreshToken: getEnv(`${prefix}OAUTH_REFRESH_TOKEN`),
      };
    }
  }

  return config;
}

/**
 * Load all provider configurations
 */
function loadProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];

  const google = loadGoogleConfig();
  if (google) providers.push(google);

  const microsoft = loadMicrosoftConfig();
  if (microsoft) providers.push(microsoft);

  // Load primary exchange (EXCHANGE_*)
  const exchange = loadExchangeConfig();
  if (exchange) providers.push(exchange);

  // Load additional exchange accounts (EXCHANGE_2_*, EXCHANGE_3_*, etc.)
  for (let i = 2; i <= 5; i++) {
    const additionalExchange = loadExchangeConfigWithSuffix(i.toString());
    if (additionalExchange) providers.push(additionalExchange);
  }

  return providers;
}

/**
 * Load full application configuration
 */
export function loadConfig(): AppConfig {
  const workingDaysEnv = getEnv('DEFAULT_WORKING_DAYS', 'monday,tuesday,wednesday,thursday,friday') ?? 'monday,tuesday,wednesday,thursday,friday';
  const workingDays = workingDaysEnv.split(',').map(d => d.trim().toLowerCase());

  return {
    server: {
      name: getEnv('MCP_SERVER_NAME', 'calendar-mcp')!,
      version: getEnv('MCP_SERVER_VERSION', '1.0.0')!,
      logLevel: (getEnv('LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error'),
    },
    defaults: {
      timezone: getEnv('DEFAULT_TIMEZONE', 'America/New_York')!,
      workingHours: {
        start: getEnv('DEFAULT_WORKING_HOURS_START', '09:00')!,
        end: getEnv('DEFAULT_WORKING_HOURS_END', '17:00')!,
        days: workingDays,
      },
    },
    request: {
      timeout: getNumberEnv('REQUEST_TIMEOUT', 30000),
      maxRetries: getNumberEnv('MAX_RETRIES', 3),
      retryDelay: getNumberEnv('RETRY_DELAY_MS', 1000),
    },
    providers: loadProviders(),
  };
}

/**
 * Singleton configuration instance
 */
let configInstance: AppConfig | null = null;

/**
 * Get configuration (loads once)
 */
export function getConfig(): AppConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

/**
 * Reset configuration (for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}

/**
 * Check if any providers are configured
 */
export function hasConfiguredProviders(): boolean {
  const config = getConfig();
  return config.providers.length > 0;
}

/**
 * Get list of enabled provider types
 */
export function getEnabledProviderTypes(): string[] {
  const config = getConfig();
  return config.providers.map(p => p.type);
}
