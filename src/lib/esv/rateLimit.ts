/**
 * Mirrors Crossway's published throttling limits so we never exceed them:
 *   max 60 requests / minute, 1,000 / hour, 5,000 / day.
 * In-memory and per server instance. On multi-instance/serverless deployments
 * swap this for a shared store (e.g. Upstash/Redis) — counters only, never Scripture.
 */
const WINDOWS = [
  { ms: 60_000, max: 60 },
  { ms: 3_600_000, max: 1_000 },
  { ms: 86_400_000, max: 5_000 },
];

let timestamps: number[] = [];

export function tryConsume(now = Date.now()): { ok: true } | { ok: false; retryAfterSec: number } {
  timestamps = timestamps.filter((t) => now - t < 86_400_000);
  for (const w of WINDOWS) {
    const inWindow = timestamps.filter((t) => now - t < w.ms);
    if (inWindow.length >= w.max) {
      const retryAfterSec = Math.ceil((w.ms - (now - inWindow[0])) / 1000);
      return { ok: false, retryAfterSec };
    }
  }
  timestamps.push(now);
  return { ok: true };
}

export function resetRateLimit() {
  timestamps = [];
}
