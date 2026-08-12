// @vitest-environment node
/**
 * The gate exists because image generation is capped at 2 requests/minute and
 * retrying into an exhausted bucket both fails and starves the next caller.
 * These tests pin the behaviour that matters: never exceed the limit, queue
 * instead of failing when a slot is close, and refuse early when it is not.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { QuotaGate, QuotaWaitTooLong } from './quotaGate.ts';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// A short window keeps the queueing path testable. Production is 2 per 60s,
// where the third caller in a burst necessarily waits longer than maxWaitMs
// (the route aborts at 58s), so it is refused early rather than queued.
const gate = (over: Partial<ConstructorParameters<typeof QuotaGate>[0]> = {}) =>
  new QuotaGate({ name: 'test', limit: 2, windowMs: 10_000, maxWaitMs: 45_000, ...over });

describe('QuotaGate', () => {
  test('grants up to the limit immediately', async () => {
    const g = gate();
    await expect(g.acquire()).resolves.toBeUndefined();
    await expect(g.acquire()).resolves.toBeUndefined();
  });

  test('holds the next caller until a slot frees instead of failing', async () => {
    const g = gate();
    await g.acquire();
    await g.acquire();

    let granted = false;
    const third = g.acquire().then(() => { granted = true; });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(granted).toBe(false);      // still inside the window

    await vi.advanceTimersByTimeAsync(20_000);
    await third;
    expect(granted).toBe(true);
  });

  test('production settings refuse the third burst request rather than hanging', async () => {
    const g = new QuotaGate({ name: 'image generation', limit: 2, windowMs: 60_000, maxWaitMs: 45_000 });
    await g.acquire();
    await g.acquire();
    const err = await g.acquire().catch((e) => e);
    expect(err).toBeInstanceOf(QuotaWaitTooLong);
    expect(err.retryAfterSeconds).toBeGreaterThan(45);
  });

  test('refuses early when the wait exceeds maxWaitMs, naming the seconds', async () => {
    const g = gate({ maxWaitMs: 5_000 });
    await g.acquire();
    await g.acquire();

    const err = await g.acquire().catch((e) => e);
    expect(err).toBeInstanceOf(QuotaWaitTooLong);
    expect(err.retryAfterSeconds).toBeGreaterThan(5);
    expect(err.message).toMatch(/retry in \d+s/);
  });

  test('concurrent callers cannot claim the same slot', async () => {
    const g = gate({ limit: 2, maxWaitMs: 0 });
    const results = await Promise.allSettled([g.acquire(), g.acquire(), g.acquire(), g.acquire()]);
    const granted = results.filter((r) => r.status === 'fulfilled');
    expect(granted).toHaveLength(2);
  });

  test('a rejected reservation does not wedge the queue', async () => {
    const g = gate({ maxWaitMs: 0 });
    await g.acquire();
    await g.acquire();
    await expect(g.acquire()).rejects.toBeInstanceOf(QuotaWaitTooLong);

    // Once the window passes, the gate must still work.
    await vi.advanceTimersByTimeAsync(20_000);
    await expect(g.acquire()).resolves.toBeUndefined();
  });

  test('penalize() blocks the bucket for a full window', async () => {
    const g = gate({ maxWaitMs: 0 });
    g.penalize();
    await expect(g.acquire()).rejects.toBeInstanceOf(QuotaWaitTooLong);

    await vi.advanceTimersByTimeAsync(20_000);
    await expect(g.acquire()).resolves.toBeUndefined();
  });

  test('a slot expires and is reusable after the window', async () => {
    const g = gate({ limit: 1, maxWaitMs: 0 });
    await g.acquire();
    await expect(g.acquire()).rejects.toBeInstanceOf(QuotaWaitTooLong);
    await vi.advanceTimersByTimeAsync(20_000);
    await expect(g.acquire()).resolves.toBeUndefined();
  });

  test('an aborted wait rejects rather than holding the request', async () => {
    const g = gate();
    await g.acquire();
    await g.acquire();

    const controller = new AbortController();
    const pending = g.acquire(controller.signal);
    const assertion = expect(pending).rejects.toThrow(/Aborted/);
    controller.abort();
    await assertion;
  });
});
