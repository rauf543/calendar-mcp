/**
 * Provider registry and factory
 */

import type {
  ProviderType,
  ICalendarProvider,
  ProviderConfig,
  ProviderHealthStatus,
  GoogleProviderConfig,
  MicrosoftProviderConfig,
  ExchangeProviderConfig,
} from '../types/index.js';
import { CalendarMCPError, ErrorCodes } from '../utils/error.js';
import { BaseCalendarProvider, ProviderLogger, defaultLogger } from './base.js';

// Re-export base class
export { BaseCalendarProvider, defaultLogger } from './base.js';
export type { ProviderLogger } from './base.js';

/**
 * Provider factory function type
 */
export type ProviderFactory<C extends ProviderConfig> = (
  config: C,
  logger?: ProviderLogger
) => ICalendarProvider;

/**
 * Registry for calendar providers
 * Manages provider instances and provides access to them
 */
export class ProviderRegistry {
  private providers: Map<string, ICalendarProvider> = new Map();
  private factories: Map<ProviderType, ProviderFactory<ProviderConfig>> = new Map();
  private logger: ProviderLogger;

  constructor(logger?: ProviderLogger) {
    this.logger = logger ?? defaultLogger;
  }

  /**
   * Register a factory for a provider type
   */
  registerFactory<C extends ProviderConfig>(
    type: ProviderType,
    factory: ProviderFactory<C>
  ): void {
    this.factories.set(type, factory as ProviderFactory<ProviderConfig>);
    this.logger.info(`Registered factory for provider type: ${type}`);
  }

  /**
   * Create and register a provider from configuration
   */
  async createProvider(config: ProviderConfig): Promise<ICalendarProvider> {
    const factory = this.factories.get(config.type);
    if (!factory) {
      throw new CalendarMCPError(
        `No factory registered for provider type: ${config.type}`,
        ErrorCodes.PROVIDER_NOT_CONFIGURED,
        { details: { type: config.type } }
      );
    }

    const provider = factory(config, this.logger);
    this.providers.set(config.id, provider);
    this.logger.info(`Created provider: ${config.id} (${config.type})`);
    return provider;
  }

  /**
   * Register an existing provider instance
   */
  register(provider: ICalendarProvider): void {
    this.providers.set(provider.providerId, provider);
    this.logger.info(`Registered provider: ${provider.providerId}`);
  }

  /**
   * Get a provider by ID
   */
  get(providerId: string): ICalendarProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get a provider by ID, throwing if not found
   */
  getOrThrow(providerId: string): ICalendarProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new CalendarMCPError(
        `Provider not found: ${providerId}`,
        ErrorCodes.PROVIDER_NOT_FOUND,
        { details: { providerId } }
      );
    }
    return provider;
  }

  /**
   * Get all providers of a specific type
   */
  getByType(type: ProviderType): ICalendarProvider[] {
    return Array.from(this.providers.values()).filter(
      p => p.providerType === type
    );
  }

  /**
   * Get all registered providers
   */
  getAll(): ICalendarProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get all connected providers
   */
  getConnected(): ICalendarProvider[] {
    return this.getAll().filter(p => p.isConnected());
  }

  /**
   * Get provider count
   */
  get count(): number {
    return this.providers.size;
  }

  /**
   * Check if a provider is registered
   */
  has(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  /**
   * Remove a provider
   */
  async remove(providerId: string): Promise<boolean> {
    const provider = this.providers.get(providerId);
    if (provider) {
      if (provider.isConnected()) {
        await provider.disconnect();
      }
      this.providers.delete(providerId);
      this.logger.info(`Removed provider: ${providerId}`);
      return true;
    }
    return false;
  }

  /**
   * Connect all registered providers
   */
  async connectAll(): Promise<{ success: string[]; failed: Array<{ id: string; error: string }> }> {
    const success: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    await Promise.all(
      this.getAll().map(async provider => {
        try {
          await provider.connect();
          success.push(provider.providerId);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failed.push({ id: provider.providerId, error: message });
          this.logger.error(`Failed to connect ${provider.providerId}: ${message}`);
        }
      })
    );

    return { success, failed };
  }

  /**
   * Disconnect all providers
   */
  async disconnectAll(): Promise<void> {
    await Promise.all(
      this.getAll().map(async provider => {
        try {
          await provider.disconnect();
        } catch (error) {
          this.logger.error(`Failed to disconnect ${provider.providerId}:`, error);
        }
      })
    );
  }

  /**
   * Get health status of all providers
   */
  async getHealthStatus(): Promise<ProviderHealthStatus[]> {
    return this.getAll().map(provider => ({
      providerId: provider.providerId,
      providerType: provider.providerType,
      connected: provider.isConnected(),
    }));
  }

  /**
   * Clear all providers (for testing)
   */
  async clear(): Promise<void> {
    await this.disconnectAll();
    this.providers.clear();
  }
}

/**
 * Singleton registry instance
 */
let registryInstance: ProviderRegistry | null = null;

/**
 * Get the global provider registry
 */
export function getRegistry(): ProviderRegistry {
  if (!registryInstance) {
    registryInstance = new ProviderRegistry();
  }
  return registryInstance;
}

/**
 * Reset the global registry (for testing)
 */
export async function resetRegistry(): Promise<void> {
  if (registryInstance) {
    await registryInstance.clear();
    registryInstance = null;
  }
}

/**
 * Initialize providers from configuration
 */
export async function initializeProviders(
  configs: ProviderConfig[]
): Promise<ProviderRegistry> {
  const registry = getRegistry();

  for (const config of configs) {
    if (config.enabled) {
      try {
        await registry.createProvider(config);
      } catch (error) {
        console.error(`Failed to create provider ${config.id}:`, error);
      }
    }
  }

  return registry;
}
