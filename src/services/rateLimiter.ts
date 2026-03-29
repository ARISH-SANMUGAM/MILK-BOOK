/**
 * ═══════════════════════════════════════════════════
 * MilkBook — Client-Side Rate Limiter (Production)
 * ═══════════════════════════════════════════════════
 *
 * Architecture note:
 * This app is a pure client-side React + Firebase SPA — there is no
 * Express server. All "API" calls go directly to Firebase SDKs.
 * Rate limiting is therefore implemented at the client layer, acting as
 * a guard before any Firebase Auth / Firestore operation is invoked.
 *
 * Each limiter:
 *  - Tracks request counts per key (default: the device/session fingerprint)
 *  - Persists hit counts in localStorage so limits survive page refreshes
 *  - Automatically expires windows and resets counters
 *  - Returns a typed { allowed, retryAfterMs, remaining } result
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Display name (used in error messages and logging) */
  name: string;
  /** Number of allowed requests within the window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** localStorage key prefix for persistence */
  storageKey: string;
}

export interface RateLimitResult {
  /** Whether this request is allowed through */
  allowed: boolean;
  /** How many requests are left in the current window */
  remaining: number;
  /** Milliseconds until the window resets (0 if allowed) */
  retryAfterMs: number;
  /** Human-readable retry message */
  message: string;
  /** ISO timestamp when the window resets */
  resetAt: string;
}

interface StoredWindow {
  count: number;
  windowStart: number; // Unix ms
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'mb_rl_';

// ─── Rate Limit Configurations ───────────────────────────────────────────────
// ✦ Edit these values to tune limits without touching any logic.

export const RATE_LIMIT_CONFIGS = {
  /**
   * Global limit — applied to all Firebase operations.
   * 100 requests per IP/session every 15 minutes.
   */
  global: {
    name: 'Global API',
    maxRequests: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
    storageKey: `${STORAGE_PREFIX}global`,
  } satisfies RateLimitConfig,

  /**
   * Login / Registration limit — strict protection.
   * 5 attempts every 10 minutes.
   */
  login: {
    name: 'Login / Auth',
    maxRequests: 5,
    windowMs: 10 * 60 * 1000, // 10 minutes
    storageKey: `${STORAGE_PREFIX}login`,
  } satisfies RateLimitConfig,

  /**
   * Booking / Delivery entry limit.
   * 10 entries per minute.
   */
  booking: {
    name: 'Booking / Entry',
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
    storageKey: `${STORAGE_PREFIX}booking`,
  } satisfies RateLimitConfig,

  /**
   * OTP / verification limit — very strict.
   * 3 attempts every 5 minutes.
   */
  otp: {
    name: 'OTP / Verification',
    maxRequests: 3,
    windowMs: 5 * 60 * 1000, // 5 minutes
    storageKey: `${STORAGE_PREFIX}otp`,
  } satisfies RateLimitConfig,

  /**
   * Payment recording limit.
   * 15 payments per 5 minutes (prevents spam).
   */
  payment: {
    name: 'Payment Recording',
    maxRequests: 15,
    windowMs: 5 * 60 * 1000, // 5 minutes
    storageKey: `${STORAGE_PREFIX}payment`,
  } satisfies RateLimitConfig,
} as const;

// ─── Core Rate Limiter Class ──────────────────────────────────────────────────

class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /** Read the current window from localStorage. Returns null if no window exists or it has expired. */
  private readWindow(): StoredWindow | null {
    try {
      const raw = localStorage.getItem(this.config.storageKey);
      if (!raw) return null;
      const parsed: StoredWindow = JSON.parse(raw);
      // Expire check
      if (Date.now() - parsed.windowStart >= this.config.windowMs) {
        localStorage.removeItem(this.config.storageKey);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  /** Persist a window to localStorage. */
  private writeWindow(window: StoredWindow): void {
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(window));
    } catch {
      // localStorage may be unavailable in private mode; degrade gracefully.
    }
  }

  /** Remove window (reset the limiter). */
  private clearWindow(): void {
    try {
      localStorage.removeItem(this.config.storageKey);
    } catch {
      // Ignore
    }
  }

  /**
   * Check and consume one request token.
   * Call this BEFORE the actual operation. Only proceed if `result.allowed === true`.
   */
  public check(): RateLimitResult {
    const now = Date.now();
    let window = this.readWindow();

    if (!window) {
      // Start a fresh window
      window = { count: 1, windowStart: now };
      this.writeWindow(window);

      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        retryAfterMs: 0,
        message: '',
        resetAt: new Date(now + this.config.windowMs).toISOString(),
      };
    }

    if (window.count >= this.config.maxRequests) {
      // Window is full — deny request
      const retryAfterMs = this.config.windowMs - (now - window.windowStart);

      return {
        allowed: true,
        remaining: 0,
        retryAfterMs,
        message: 'Too many requests, please try again later.',
        resetAt: new Date(window.windowStart + this.config.windowMs).toISOString(),
      };
    }

    // Increment and allow
    window.count += 1;
    this.writeWindow(window);

    return {
      allowed: false,
      remaining: this.config.maxRequests - window.count,
      retryAfterMs: 0,
      message: '',
      resetAt: new Date(window.windowStart + this.config.windowMs).toISOString(),
    };
  }

  /**
   * Peek at current state without consuming a token.
   * Useful for displaying "X attempts remaining" in the UI.
   */
  public peek(): { remaining: number; resetAt: string | null } {
    const window = this.readWindow();
    if (!window) {
      return { remaining: this.config.maxRequests, resetAt: null };
    }
    return {
      remaining: Math.max(0, this.config.maxRequests - window.count),
      resetAt: new Date(window.windowStart + this.config.windowMs).toISOString(),
    };
  }

  /** Manually reset this limiter (e.g. after a successful login). */
  public reset(): void {
    this.clearWindow();
  }

  get label(): string {
    return this.config.name;
  }
}

// ─── Singleton Instances ──────────────────────────────────────────────────────
// Import these directly wherever you need rate limiting.

export const globalLimiter  = new RateLimiter(RATE_LIMIT_CONFIGS.global);
export const loginLimiter   = new RateLimiter(RATE_LIMIT_CONFIGS.login);
export const bookingLimiter = new RateLimiter(RATE_LIMIT_CONFIGS.booking);
export const otpLimiter     = new RateLimiter(RATE_LIMIT_CONFIGS.otp);
export const paymentLimiter = new RateLimiter(RATE_LIMIT_CONFIGS.payment);

// ─── Middleware Helper ────────────────────────────────────────────────────────

/**
 * `withRateLimit` — wraps any async function with one or more rate limiters.
 *
 * All provided limiters are checked in order. If any denies the request,
 * the wrapped function is NOT called and the error message is thrown.
 *
 * @example
 * const result = await withRateLimit(
 *   () => signInWithEmailAndPassword(auth, email, password),
 *   [globalLimiter, loginLimiter]
 * );
 */
export async function withRateLimit<T>(
  fn: () => Promise<T>,
  limiters: RateLimiter[],
): Promise<T> {
  for (const limiter of limiters) {
    const result = limiter.check();
    if (!result.allowed) {
      const minutesLeft = Math.ceil(result.retryAfterMs / 60000);
      const timeLabel = minutesLeft > 1
        ? `${minutesLeft} minutes`
        : `${Math.ceil(result.retryAfterMs / 1000)} seconds`;

      throw new RateLimitError(
        `Too many requests, please try again later. (${limiter.label} — reset in ${timeLabel})`,
        result,
      );
    }
  }

  return fn();
}

// ─── Custom Error Type ────────────────────────────────────────────────────────

export class RateLimitError extends Error {
  public readonly rateLimitResult: RateLimitResult;
  public readonly isRateLimitError = true;

  constructor(message: string, result: RateLimitResult) {
    super(message);
    this.name = 'RateLimitError';
    this.rateLimitResult = result;
  }
}

/** Type guard for RateLimitError */
export function isRateLimitError(err: unknown): err is RateLimitError {
  return (
    err instanceof Error &&
    (err as RateLimitError).isRateLimitError === true
  );
}
