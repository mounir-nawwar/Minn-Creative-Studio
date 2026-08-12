/**
 * Usage / spend API.
 *
 * Reports total Vertex spend across every project (including the hidden
 * playground) and lets it be reset — the counter is tracked against a Google
 * free-credit allowance, so it needs to go back to zero when the credit is
 * renewed or the Vertex project is swapped.
 */

import express from 'express';
import path from 'path';
import { db, DB_PATH, settings } from '../services/database.ts';
import { authMiddleware } from '../services/auth.ts';

const router = express.Router();

router.use(authMiddleware);

/** Google's free-credit allowance the counter runs down. */
const CREDIT_LIMIT_USD = Number(process.env.VERTEX_CREDIT_LIMIT_USD || 300);

const BASELINE_KEY = 'spend_baseline';

/**
 * A reading taken from the Google Cloud console, used to anchor the counter.
 *
 * The app can only price what passes through it, and Google bills for
 * everything on the project — anything run outside the app (a direct REST call,
 * an operation started by a script) is real spend the app never saw. So the
 * headline figure is `amountUsd` as reported by Google at `at`, plus what we
 * have tracked since. Without a baseline it falls back to tracked spend alone.
 */
interface SpendBaseline {
  amountUsd: number;
  at: string;
}

/** Cost recorded after the baseline reading — usage_logs is the row-level source. */
function trackedSince(at: string): number {
  const row = db.prepare('SELECT COALESCE(SUM(cost), 0) AS c FROM usage_logs WHERE created_at > ?').get(at) as { c: number };
  return row.c || 0;
}

interface Totals {
  totalCost: number;
  textCost: number;
  imageCost: number;
  videoCost: number;
  audioCost: number;
  totalImages: number;
  totalVideos: number;
  totalAudio: number;
  totalTexts: number;
  totalTokens: number;
}

function readTotals(): Totals {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(json_extract(usage, '$.totalCost')),   0) AS totalCost,
      COALESCE(SUM(json_extract(usage, '$.textCost')),    0) AS textCost,
      COALESCE(SUM(json_extract(usage, '$.imageCost')),   0) AS imageCost,
      COALESCE(SUM(json_extract(usage, '$.videoCost')),   0) AS videoCost,
      COALESCE(SUM(json_extract(usage, '$.audioCost')),   0) AS audioCost,
      COALESCE(SUM(json_extract(usage, '$.totalImages')), 0) AS totalImages,
      COALESCE(SUM(json_extract(usage, '$.totalVideos')), 0) AS totalVideos,
      COALESCE(SUM(json_extract(usage, '$.totalAudio')),  0) AS totalAudio,
      COALESCE(SUM(json_extract(usage, '$.totalTexts')),  0) AS totalTexts,
      COALESCE(SUM(json_extract(usage, '$.totalTokens')), 0) AS totalTokens
    FROM projects
    WHERE usage IS NOT NULL
  `).get() as Totals;

  return row;
}

function summary() {
  const totals = readTotals();
  const tracked = totals.totalCost || 0;
  const baseline = settings.get<SpendBaseline>(BASELINE_KEY);

  // With a baseline, the headline is Google's figure plus everything since.
  const sinceBaseline = baseline ? trackedSince(baseline.at) : 0;
  const spent = baseline ? baseline.amountUsd + sinceBaseline : tracked;

  return {
    ...totals,
    /** What the app itself has priced, all time. */
    trackedCost: tracked,
    /** The console reading this is anchored to, if any. */
    baseline,
    /** Tracked spend recorded after that reading. */
    trackedSinceBaseline: sinceBaseline,
    /** Spend the app never saw at the time of the reading — a gap worth knowing about. */
    untrackedAtBaseline: baseline ? Math.max(baseline.amountUsd - (tracked - sinceBaseline), 0) : 0,
    totalCost: spent,
    creditLimit: CREDIT_LIMIT_USD,
    remaining: Math.max(CREDIT_LIMIT_USD - spent, 0),
    /** 0..1 — how much of the allowance is consumed. */
    usedFraction: CREDIT_LIMIT_USD > 0 ? Math.min(spent / CREDIT_LIMIT_USD, 1) : 0,
  };
}

/** GET /api/usage/summary — spend across all projects + remaining credit. */
router.get('/summary', (_req, res) => {
  try {
    res.json(summary());
  } catch (error) {
    console.error('[Usage] summary failed:', error);
    res.status(500).json({ error: 'Failed to read usage summary' });
  }
});

/**
 * POST /api/usage/baseline — anchor the counter to the Google Cloud console.
 *
 * Body: `{ amountUsd }` — the "credits used" figure Google currently shows.
 * From then on the counter reads that plus everything tracked afterwards, so it
 * stays aligned with billing instead of drifting by whatever ran outside the app.
 * `{ amountUsd: null }` clears the anchor and returns to tracked-only.
 */
router.post('/baseline', (req, res) => {
  try {
    const { amountUsd } = req.body ?? {};

    if (amountUsd === null) {
      settings.delete(BASELINE_KEY);
      console.log('[Usage] spend baseline cleared');
      return res.json(summary());
    }

    const amount = Number(amountUsd);
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: 'amountUsd must be a non-negative number, or null to clear' });
    }

    const baseline: SpendBaseline = { amountUsd: amount, at: new Date().toISOString() };
    settings.set(BASELINE_KEY, baseline);
    console.log(`[Usage] spend baseline set to $${amount.toFixed(2)} at ${baseline.at}`);
    res.json(summary());
  } catch (error) {
    console.error('[Usage] baseline failed:', error);
    res.status(500).json({ error: 'Failed to set spend baseline' });
  }
});

/**
 * POST /api/usage/reset — zero every project's cost history.
 *
 * Destructive, so a timestamped copy of the database is written first; the
 * per-generation rows in usage_logs are what the breakdown is rebuilt from, so
 * losing them without a backup would be unrecoverable.
 */
router.post('/reset', async (_req, res) => {
  try {
    const before = summary();

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(path.dirname(DB_PATH), `minn-studio.pre-reset-${stamp}.db`);
    await db.backup(backupPath);
    console.log(`[Usage] pre-reset backup → ${backupPath}`);

    const reset = db.transaction(() => {
      // Drop the cost/count keys but keep the rest of the usage object intact.
      db.prepare(`
        UPDATE projects SET usage = json_remove(
          COALESCE(usage, '{}'),
          '$.totalCost', '$.textCost', '$.imageCost', '$.videoCost', '$.audioCost',
          '$.totalImages', '$.totalVideos', '$.totalAudio', '$.totalAudios',
          '$.totalTexts', '$.totalTokens'
        )
        WHERE usage IS NOT NULL
      `).run();
      db.prepare('DELETE FROM usage_logs').run();
    });
    reset();
    // The anchor described a spend history that no longer exists.
    settings.delete(BASELINE_KEY);

    console.log(`[Usage] reset — cleared $${(before.totalCost || 0).toFixed(4)} of tracked spend`);
    res.json({ ...summary(), clearedCost: before.totalCost || 0, backupPath });
  } catch (error) {
    console.error('[Usage] reset failed:', error);
    res.status(500).json({ error: 'Failed to reset usage' });
  }
});

export default router;
