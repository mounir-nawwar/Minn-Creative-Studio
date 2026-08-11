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
import { db, DB_PATH } from '../services/database.ts';
import { authMiddleware } from '../services/auth.ts';

const router = express.Router();

router.use(authMiddleware);

/** Google's free-credit allowance the counter runs down. */
const CREDIT_LIMIT_USD = Number(process.env.VERTEX_CREDIT_LIMIT_USD || 300);

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
  const spent = totals.totalCost || 0;
  return {
    ...totals,
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

    console.log(`[Usage] reset — cleared $${(before.totalCost || 0).toFixed(4)} of tracked spend`);
    res.json({ ...summary(), clearedCost: before.totalCost || 0, backupPath });
  } catch (error) {
    console.error('[Usage] reset failed:', error);
    res.status(500).json({ error: 'Failed to reset usage' });
  }
});

export default router;
