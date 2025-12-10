/**
 * Simple health check endpoint to verify Vercel functions work
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[Health] Request received:', req.method, req.url);
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
  });
}
