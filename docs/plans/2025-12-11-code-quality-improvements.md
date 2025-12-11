# Code Quality Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address MEDIUM priority code review feedback to improve maintainability and robustness.

**Architecture:** (1) Extract duplicated provider initialization logic into a shared utility function, (2) Remove unconventional health check query parameter to prevent unintended behavior.

**Tech Stack:** TypeScript, Node.js

---

## Task 1: Extract Shared Provider Initialization Logic (DRY)

**Files:**
- Create: `src/utils/provider-init.ts`
- Modify: `src/index.ts:39-75`
- Modify: `api/mcp.ts:101-124`

**Step 1: Create the shared provider initialization utility**

Create file `src/utils/provider-init.ts`:

```typescript
/**
 * Shared provider initialization logic
 * Used by both src/index.ts (STDIO) and api/mcp.ts (Vercel)
 */

import { ProviderRegistry } from '../providers/index.js';
import { GoogleCalendarProvider } from '../providers/google/index.js';
import { MicrosoftCalendarProvider } from '../providers/microsoft/index.js';
import { ExchangeCalendarProvider } from '../providers/exchange/index.js';
import type {
  ProviderConfig,
  GoogleProviderConfig,
  MicrosoftProviderConfig,
  ExchangeProviderConfig,
} from '../types/index.js';

export interface InitializeProvidersOptions {
  /** Log prefix for console messages */
  logPrefix?: string;
  /** Whether to throw on provider initialization failure (default: false) */
  throwOnError?: boolean;
}

/**
 * Initialize and register providers based on configuration
 * @param registry - The provider registry to register providers with
 * @param providers - Array of provider configurations
 * @param options - Initialization options
 */
export async function initializeProviders(
  registry: ProviderRegistry,
  providers: ProviderConfig[],
  options: InitializeProvidersOptions = {}
): Promise<void> {
  const { logPrefix = '[calendar-mcp]', throwOnError = false } = options;

  for (const providerConfig of providers) {
    if (!providerConfig.enabled) continue;

    try {
      switch (providerConfig.type) {
        case 'google': {
          console.error(`${logPrefix} Initializing Google Calendar provider...`);
          const googleProvider = new GoogleCalendarProvider(providerConfig as GoogleProviderConfig);
          await googleProvider.connect();
          registry.register(googleProvider);
          console.error(`${logPrefix} Google Calendar provider connected`);
          break;
        }
        case 'microsoft': {
          console.error(`${logPrefix} Initializing Microsoft 365 provider...`);
          const microsoftProvider = new MicrosoftCalendarProvider(providerConfig as MicrosoftProviderConfig);
          await microsoftProvider.connect();
          registry.register(microsoftProvider);
          console.error(`${logPrefix} Microsoft 365 provider connected`);
          break;
        }
        case 'exchange': {
          console.error(`${logPrefix} Initializing Exchange provider...`);
          const exchangeProvider = new ExchangeCalendarProvider(providerConfig as ExchangeProviderConfig);
          await exchangeProvider.connect();
          registry.register(exchangeProvider);
          console.error(`${logPrefix} Exchange provider connected`);
          break;
        }
        default:
          console.error(`${logPrefix} Unknown provider type: ${(providerConfig as ProviderConfig).type}`);
      }
    } catch (error) {
      console.error(`${logPrefix} Failed to initialize ${providerConfig.type} provider:`, error);
      if (throwOnError) {
        throw new Error(
          `Provider initialization failed for ${providerConfig.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  const connected = registry.getConnected();
  console.error(`${logPrefix} ${connected.length} provider(s) connected`);

  if (connected.length === 0) {
    console.error(`${logPrefix} Warning: No providers connected. Check your configuration.`);
  }
}
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/utils/provider-init.ts
git commit -m "refactor: extract shared provider initialization logic"
```

---

## Task 2: Update src/index.ts to Use Shared Utility

**Files:**
- Modify: `src/index.ts`

**Step 1: Update imports and replace initializeProviders function**

Replace the imports at top of file (around lines 22-24):

```typescript
import { GoogleCalendarProvider } from './providers/google/index.js';
import { MicrosoftCalendarProvider } from './providers/microsoft/index.js';
import { ExchangeCalendarProvider } from './providers/exchange/index.js';
```

With:

```typescript
import { initializeProviders } from './utils/provider-init.js';
```

**Step 2: Replace the initializeProviders function (lines 39-83)**

Replace:

```typescript
/**
 * Initialize and connect providers based on configuration
 */
async function initializeProviders(registry: ProviderRegistry): Promise<void> {
  const config = getConfig();

  for (const providerConfig of config.providers) {
    try {
      if (providerConfig.type === 'google') {
        console.error('[calendar-mcp] Initializing Google Calendar provider...');
        const googleConfig = providerConfig as import('./types/index.js').GoogleProviderConfig;

        const googleProvider = new GoogleCalendarProvider(googleConfig);

        await googleProvider.connect();
        registry.register(googleProvider);
        console.error('[calendar-mcp] Google Calendar provider connected');
      } else if (providerConfig.type === 'microsoft') {
        console.error('[calendar-mcp] Initializing Microsoft 365 provider...');
        const microsoftConfig = providerConfig as import('./types/index.js').MicrosoftProviderConfig;

        const microsoftProvider = new MicrosoftCalendarProvider(microsoftConfig);

        await microsoftProvider.connect();
        registry.register(microsoftProvider);
        console.error('[calendar-mcp] Microsoft 365 provider connected');
      } else if (providerConfig.type === 'exchange') {
        console.error('[calendar-mcp] Initializing Exchange provider...');
        const exchangeConfig = providerConfig as import('./types/index.js').ExchangeProviderConfig;

        const exchangeProvider = new ExchangeCalendarProvider(exchangeConfig);

        await exchangeProvider.connect();
        registry.register(exchangeProvider);
        console.error('[calendar-mcp] Exchange provider connected');
      }
    } catch (error) {
      console.error(`[calendar-mcp] Failed to initialize ${providerConfig.type} provider:`, error);
    }
  }

  const connected = registry.getConnected();
  console.error(`[calendar-mcp] ${connected.length} provider(s) connected`);

  if (connected.length === 0) {
    console.error('[calendar-mcp] Warning: No providers connected. Check your configuration.');
  }
}
```

With:

```typescript
/**
 * Initialize and connect providers based on configuration
 */
async function initializeProvidersFromConfig(registry: ProviderRegistry): Promise<void> {
  const config = getConfig();
  await initializeProviders(registry, config.providers, {
    logPrefix: '[calendar-mcp]',
    throwOnError: false, // STDIO mode: log errors but continue
  });
}
```

**Step 3: Update the call site in createServer (around line 97)**

Replace:

```typescript
  // Initialize providers
  await initializeProviders(registry);
```

With:

```typescript
  // Initialize providers
  await initializeProvidersFromConfig(registry);
```

**Step 4: Verify build passes**

Run: `npm run build`
Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add src/index.ts
git commit -m "refactor: use shared provider initialization in STDIO entry point"
```

---

## Task 3: Update api/mcp.ts to Use Shared Utility

**Files:**
- Modify: `api/mcp.ts`

**Step 1: Update imports**

Replace lines 17-21:

```typescript
// Import provider classes for manual registration
import { GoogleCalendarProvider } from '../src/providers/google/index.js';
import { MicrosoftCalendarProvider } from '../src/providers/microsoft/index.js';
import { ExchangeCalendarProvider } from '../src/providers/exchange/index.js';
import type { GoogleProviderConfig, MicrosoftProviderConfig, ExchangeProviderConfig } from '../src/types/index.js';
```

With:

```typescript
// Import shared provider initialization
import { initializeProviders } from '../src/utils/provider-init.js';
```

**Step 2: Simplify getServices function (lines 94-135)**

Replace:

```typescript
function getServices(): Promise<Services> {
  if (!servicesPromise) {
    servicesPromise = (async () => {
      const config = loadConfig();
      console.log('[MCP] Config loaded - timezone:', config.defaults.timezone);
      const registry = getRegistry();

      // Manually create and register providers (same pattern as src/index.ts)
      for (const providerConfig of config.providers) {
        if (!providerConfig.enabled) continue;

        try {
          if (providerConfig.type === 'google') {
            const googleProvider = new GoogleCalendarProvider(providerConfig as GoogleProviderConfig);
            await googleProvider.connect();
            registry.register(googleProvider);
          } else if (providerConfig.type === 'microsoft') {
            const microsoftProvider = new MicrosoftCalendarProvider(providerConfig as MicrosoftProviderConfig);
            await microsoftProvider.connect();
            registry.register(microsoftProvider);
          } else if (providerConfig.type === 'exchange') {
            const exchangeProvider = new ExchangeCalendarProvider(providerConfig as ExchangeProviderConfig);
            await exchangeProvider.connect();
            registry.register(exchangeProvider);
          }
          console.log(`[MCP] Registered provider: ${providerConfig.id} (${providerConfig.type})`);
        } catch (error) {
          console.error(`[MCP] Failed to initialize provider ${providerConfig.id}:`, error);
          throw new Error(`Provider initialization failed for ${providerConfig.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      const calendarService = new CalendarService(registry);
      const freeBusyService = new FreeBusyService(registry);
      const conflictService = new ConflictService(calendarService, freeBusyService);
      const syncService = new SyncService(calendarService);

      return { registry, calendarService, freeBusyService, conflictService, syncService };
    })();
  }
  return servicesPromise;
}
```

With:

```typescript
function getServices(): Promise<Services> {
  if (!servicesPromise) {
    servicesPromise = (async () => {
      const config = loadConfig();
      console.log('[MCP] Config loaded - timezone:', config.defaults.timezone);
      const registry = getRegistry();

      // Initialize providers using shared utility
      await initializeProviders(registry, config.providers, {
        logPrefix: '[MCP]',
        throwOnError: true, // Vercel mode: fail fast on provider errors
      });

      const calendarService = new CalendarService(registry);
      const freeBusyService = new FreeBusyService(registry);
      const conflictService = new ConflictService(calendarService, freeBusyService);
      const syncService = new SyncService(calendarService);

      return { registry, calendarService, freeBusyService, conflictService, syncService };
    })();
  }
  return servicesPromise;
}
```

**Step 3: Verify build passes**

Run: `npm run build`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add api/mcp.ts
git commit -m "refactor: use shared provider initialization in Vercel entry point"
```

---

## Task 4: Remove Unconventional Health Check Query Parameter

**Files:**
- Modify: `api/mcp.ts`

**Step 1: Remove the query parameter health check**

Replace line 428:

```typescript
  if (pathname === '/api/mcp/health' || req.query?.health === 'true') {
```

With:

```typescript
  if (pathname === '/api/mcp/health') {
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add api/mcp.ts
git commit -m "fix: remove unconventional health check query parameter"
```

---

## Task 5: Final Verification and Push

**Step 1: Run full build**

Run: `npm run build`
Expected: No errors

**Step 2: Push all changes**

```bash
git push origin vercel
```

**Step 3: Verify Vercel deployment succeeds**

Check the PR for updated deployment status from Vercel bot.

---

## Summary of Changes

| Issue | Severity | Fix |
|-------|----------|-----|
| Duplicated provider initialization | MEDIUM | Extract to `src/utils/provider-init.ts` |
| Unconventional health check query param | MEDIUM | Remove `req.query?.health === 'true'` check |

## Benefits

1. **DRY Principle**: Provider initialization logic is now in one place
2. **Maintainability**: Adding a new provider type only requires changes in one file
3. **Configurability**: `throwOnError` option allows different behavior for STDIO vs Vercel
4. **Safety**: Health check can only be triggered by explicit path, not accidental query params
