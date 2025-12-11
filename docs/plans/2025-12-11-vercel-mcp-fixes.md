# Vercel MCP API Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix security, reliability, and functionality issues in the Vercel MCP API handler identified during code review.

**Architecture:** Address 4 categories of issues: (1) security - hide stack traces in production, (2) reliability - fail fast on provider init errors, (3) routing - add missing SSE/message endpoints, (4) streaming - support streaming responses instead of buffering.

**Tech Stack:** TypeScript, Vercel serverless functions, @vercel/mcp-adapter

---

## Task 1: Hide Stack Traces in Production

**Files:**
- Modify: `api/mcp.ts:476-480`

**Step 1: Update error response to conditionally include stack trace**

Replace lines 476-480:

```typescript
  } catch (error) {
    console.error('[MCP] Handler error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
```

With:

```typescript
  } catch (error) {
    console.error('[MCP] Handler error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      // Only expose stack traces in development to prevent information leakage
      ...(process.env.NODE_ENV !== 'production' && error instanceof Error && { stack: error.stack })
    });
  }
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add api/mcp.ts
git commit -m "security: hide stack traces in production error responses"
```

---

## Task 2: Fail Fast on Provider Initialization Errors

**Files:**
- Modify: `api/mcp.ts:120-122`

**Step 1: Update error handling to propagate failures**

Replace lines 120-122:

```typescript
        } catch (error) {
          console.error(`[MCP] Failed to initialize provider ${providerConfig.id}:`, error);
        }
```

With:

```typescript
        } catch (error) {
          console.error(`[MCP] Failed to initialize provider ${providerConfig.id}:`, error);
          throw new Error(`Provider initialization failed for ${providerConfig.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add api/mcp.ts
git commit -m "fix: fail fast when provider initialization fails"
```

---

## Task 3: Fix Health Check URL Matching

**Files:**
- Modify: `api/mcp.ts:425`

**Step 1: Update health check to use URL pathname**

Replace line 425:

```typescript
  if (req.url === '/api/mcp/health' || req.query?.health === 'true') {
```

With:

```typescript
  // Use pathname for robust URL matching (handles query params correctly)
  const pathname = new URL(req.url!, `http://${req.headers.host || 'localhost'}`).pathname;
  if (pathname === '/api/mcp/health' || req.query?.health === 'true') {
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add api/mcp.ts
git commit -m "fix: use pathname for health check URL matching"
```

---

## Task 4: Add Missing SSE/Message Route Rewrites

**Files:**
- Modify: `vercel.json`

**Step 1: Add rewrites for SSE and message endpoints**

Replace entire `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "version": 2,
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "outputDirectory": "dist",
  "framework": null,
  "rewrites": [
    {
      "source": "/mcp",
      "destination": "/api/mcp"
    },
    {
      "source": "/sse",
      "destination": "/api/mcp"
    },
    {
      "source": "/message",
      "destination": "/api/mcp"
    }
  ]
}
```

**Step 2: Commit**

```bash
git add vercel.json
git commit -m "fix: add SSE and message endpoint rewrites"
```

---

## Task 5: Support Streaming Responses

**Files:**
- Modify: `api/mcp.ts:470-473`

**Step 1: Update response handling to stream instead of buffer**

Replace lines 455-473:

```typescript
  try {
    console.log('[MCP] Calling handler...');
    // Call the MCP handler
    const webResponse = await handler(webRequest);

    console.log('[MCP] Handler returned status:', webResponse.status);

    // Convert Web Response to Vercel res
    res.status(webResponse.status);

    // Copy headers
    webResponse.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Send body
    const body = await webResponse.text();
    console.log('[MCP] Response body length:', body.length);
    return res.send(body);
```

With:

```typescript
  try {
    console.log('[MCP] Calling handler...');
    // Call the MCP handler
    const webResponse = await handler(webRequest);

    console.log('[MCP] Handler returned status:', webResponse.status);

    // Convert Web Response to Vercel res
    res.status(webResponse.status);

    // Copy headers
    webResponse.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Check if this is a streaming response (SSE or chunked)
    const contentType = webResponse.headers.get('content-type') || '';
    const isStreaming = contentType.includes('text/event-stream') ||
                        webResponse.headers.get('transfer-encoding') === 'chunked';

    if (isStreaming && webResponse.body) {
      // Stream the response for SSE/chunked transfers
      console.log('[MCP] Streaming response');
      const reader = webResponse.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
      } finally {
        reader.releaseLock();
      }
      return res.end();
    } else {
      // Buffer non-streaming responses
      const body = await webResponse.text();
      console.log('[MCP] Response body length:', body.length);
      return res.send(body);
    }
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add api/mcp.ts
git commit -m "fix: support streaming responses for SSE transport"
```

---

## Task 6: Final Verification and Push

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
| Stack trace exposure | HIGH | Conditionally include based on NODE_ENV |
| Silent provider failures | HIGH | Throw error to fail fast |
| Missing SSE/message routes | P1 | Add rewrites in vercel.json |
| Buffered streaming responses | P1 | Stream SSE responses instead of buffering |
| Brittle health check URL | MEDIUM | Use URL pathname parsing |
