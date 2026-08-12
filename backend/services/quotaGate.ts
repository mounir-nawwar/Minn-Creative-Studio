/**
 * Paces outbound Vertex calls against a per-minute quota.
 *
 * Image generation on this project is capped at **2 requests per minute**
 * (`generate_content_image_gen_per_project_per_base_model`, Google's default —
 * a trial account cannot request an increase). Retrying into an exhausted
 * bucket cannot succeed: it burns the quota the next legitimate request needs,
 * which is how a brief throttle turned into half an hour of nothing working.
 *
 * So callers queue here instead. A request waits for a slot up to `maxWaitMs`
 * and only fails if the wait would exceed it — and then it fails with the
 * number of seconds to wait, rather than a generic 500.
 */

/** Thrown when a slot will not be free soon enough to be worth holding the request. */
export class QuotaWaitTooLong extends Error {
  readonly retryAfterSeconds: number;

  constructor(name: string, retryAfterSeconds: number) {
    super(`${name} quota is exhausted — retry in ${retryAfterSeconds}s`);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface QuotaGateOptions {
  /** Human-readable name, used in errors and logs. */
  name: string;
  /** Requests permitted per window. */
  limit: number;
  /** Window length in ms. */
  windowMs?: number;
  /** Longest a caller will wait for a slot before being told to retry later. */
  maxWaitMs?: number;
}

/**
 * Our window is a hair wider than Google's so a slot we believe is free is not
 * still counted upstream (clock skew, request-time vs receive-time).
 */
const WINDOW_MARGIN_MS = 2000;

export class QuotaGate {
  private readonly name: string;
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxWaitMs: number;
  /** Timestamps of granted slots, oldest first. */
  private grants: number[] = [];
  /** Serialises reservations so concurrent callers can't claim the same slot. */
  private tail: Promise<unknown> = Promise.resolve();

  constructor({ name, limit, windowMs = 60_000, maxWaitMs = 45_000 }: QuotaGateOptions) {
    this.name = name;
    this.limit = Math.max(1, limit);
    this.windowMs = windowMs;
    this.maxWaitMs = maxWaitMs;
  }

  private prune(now: number) {
    this.grants = this.grants.filter((t) => now - t < this.windowMs + WINDOW_MARGIN_MS);
  }

  /**
   * Wait for a slot. Resolves once the caller may proceed.
   * @throws QuotaWaitTooLong if a slot is further away than maxWaitMs.
   */
  async acquire(signal?: AbortSignal): Promise<void> {
    // `tail` is always a settled-or-swallowed promise, so the chain survives a
    // rejected reservation and the next caller is not wedged behind it.
    const reservation = this.tail.then(() => this.reserve(signal));
    this.tail = reservation.catch(() => undefined);
    return reservation;
  }

  private async reserve(signal?: AbortSignal): Promise<void> {
    const now = Date.now();
    this.prune(now);

    if (this.grants.length < this.limit) {
      this.grants.push(now);
      return;
    }

    const waitMs = this.grants[0] + this.windowMs + WINDOW_MARGIN_MS - now;
    if (waitMs > this.maxWaitMs) {
      throw new QuotaWaitTooLong(this.name, Math.ceil(waitMs / 1000));
    }

    console.log(`[Quota] ${this.name}: at ${this.limit}/${this.windowMs / 1000}s, holding request ${Math.ceil(waitMs / 1000)}s`);
    await sleep(waitMs, signal);

    const after = Date.now();
    this.prune(after);
    this.grants.push(after);
  }

  /**
   * Record that Vertex rejected a call with 429 anyway — our count was behind.
   *
   * Google runs a sliding window and adds no penalty for a rejected attempt, so
   * this only tops the bucket up to the limit and leaves existing timestamps
   * alone. A slot therefore opens as soon as the *oldest* request ages out, not
   * a fresh window from now.
   */
  penalize() {
    const now = Date.now();
    this.prune(now);
    while (this.grants.length < this.limit) this.grants.push(now);
    const nextSlotMs = Math.max(0, this.grants[0] + this.windowMs + WINDOW_MARGIN_MS - now);
    console.warn(`[Quota] ${this.name}: upstream 429 — next slot in ${Math.ceil(nextSlotMs / 1000)}s`);
  }
}

const ABORTED = 'Aborted while waiting for a quota slot';

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  // Check first: 'abort' already fired means no listener will ever be called,
  // and the request would sit here for the whole timer.
  if (signal?.aborted) return Promise.reject(new Error(ABORTED));
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error(ABORTED));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * The image-generation gate. Limit is deliberately the real Vertex default;
 * raise VERTEX_IMAGE_RPM to match if the project's quota is ever increased.
 */
export const imageGenerationGate = new QuotaGate({
  name: 'image generation',
  limit: Number(process.env.VERTEX_IMAGE_RPM || 2),
  maxWaitMs: Number(process.env.VERTEX_IMAGE_MAX_WAIT_MS || 45_000),
});
