/**
 * Token bucket rate limiter with sliding window per-minute and daily cap.
 * State is persisted to localStorage so daily limits survive page refreshes.
 */

interface RateLimitConfig {
  /** Max requests per minute (sliding window) */
  rpm: number;
  /** Max requests per day (rolling 24h) */
  rpd: number;
}

interface PersistedState {
  /** Timestamps of recent requests (ms) */
  timestamps: number[];
  /** Timestamp of state creation for daily window */
  createdAt: number;
}

const STORAGE_PREFIX = 'rake_ratelimit_';

function loadState(key: string): PersistedState {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { timestamps: [], createdAt: Date.now() };
    const parsed = JSON.parse(raw) as PersistedState;
    // Validate the data
    if (!Array.isArray(parsed.timestamps)) return { timestamps: [], createdAt: Date.now() };
    return parsed;
  } catch {
    return { timestamps: [], createdAt: Date.now() };
  }
}

function saveState(key: string, state: PersistedState): void {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — non-critical
  }
}

/**
 * Rate limiter error, thrown when daily limit has been exceeded.
 */
export class RateLimitError extends Error {
  readonly service: string;
  readonly rpd: number;
  readonly retryAfterMs: number;

  constructor(service: string, rpd: number, retryAfterMs: number) {
    super(`${service}: Daily rate limit reached (${rpd}/day). Resets in ${Math.ceil(retryAfterMs / 60000)} min.`);
    this.name = 'RateLimitError';
    this.service = service;
    this.rpd = rpd;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Creates a rate-limited wrapper around an async function.
 *
 * @param name - Human-readable service name (e.g. "Yelp", "Google Places")
 * @param initialConfig - Rate limit configuration (rpm and rpd)
 * @returns An object with `acquire`, `reset`, `stats`, and `updateConfig` methods
 */
export function createRateLimiter(name: string, initialConfig: RateLimitConfig) {
  const storageKey = `${STORAGE_PREFIX}${name.toLowerCase().replace(/\s+/g, '_')}`;
  let state = loadState(storageKey);
  let config: RateLimitConfig = { ...initialConfig };

  // ---- helpers ----

  function prune(minAgeMs: number) {
    const cutoff = Date.now() - minAgeMs;
    const before = state.timestamps.length;
    state.timestamps = state.timestamps.filter((t) => t > cutoff);
    if (state.timestamps.length !== before) saveState(storageKey, state);
  }

  // ---- public API ----

  /**
   * Update the rate limit config at runtime (e.g. from user settings).
   */
  function updateConfig(newConfig: Partial<RateLimitConfig>) {
    config = { ...config, ...newConfig };
  }

  /**
   * Wait until a request slot is available, then return.
   * Throws RateLimitError if the daily cap has been reached.
   */
  async function acquire(): Promise<void> {
    const now = Date.now();
    const ONE_MINUTE = 60_000;
    const ONE_DAY = 86_400_000;

    // Prune stale timestamps (older than 1 minute for RPM, older than 1 day for RPD)
    prune(ONE_MINUTE);

    // Check daily limit — count all timestamps in the last 24 h
    const dayCutoff = now - ONE_DAY;
    const dailyCount = state.timestamps.filter((t) => t > dayCutoff).length;
    if (dailyCount >= config.rpd) {
      // Find the oldest timestamp to calculate retry time
      const oldest = Math.min(...state.timestamps.filter((t) => t > dayCutoff));
      const retryAfterMs = oldest + ONE_DAY - now;
      throw new RateLimitError(name, config.rpd, retryAfterMs);
    }

    // If at RPM limit, wait for the oldest request to expire
    while (state.timestamps.length >= config.rpm) {
      const oldest = state.timestamps[0];
      const waitMs = oldest + ONE_MINUTE - now + 50; // +50ms buffer
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      prune(ONE_MINUTE);
      // Re-check daily limit after waiting
      const dc = state.timestamps.filter((t) => t > dayCutoff).length;
      if (dc >= config.rpd) {
        const oldestT = Math.min(...state.timestamps.filter((t) => t > dayCutoff));
        const retryAfterMs = oldestT + ONE_DAY - Date.now();
        throw new RateLimitError(name, config.rpd, retryAfterMs);
      }
    }

    // Acquire token
    state.timestamps.push(Date.now());
    saveState(storageKey, state);
  }

  /** Reset state (useful for testing or manual override) */
  function reset(): void {
    state = { timestamps: [], createdAt: Date.now() };
    saveState(storageKey, state);
  }

  /** Get current usage stats */
  function stats(): { currentRpm: number; currentRpd: number; resetAfterMs: number } {
    prune(60_000);
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    const oneDayAgo = now - 86_400_000;
    const rpm = state.timestamps.filter((t) => t > oneMinuteAgo).length;
    const rpd = state.timestamps.filter((t) => t > oneDayAgo).length;
    const oldest = state.timestamps.length > 0 ? Math.min(...state.timestamps) : now;
    const resetAfterMs = Math.max(0, oldest + 86_400_000 - now);
    return { currentRpm: rpm, currentRpd: rpd, resetAfterMs };
  }

  return { acquire, reset, stats, updateConfig };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
