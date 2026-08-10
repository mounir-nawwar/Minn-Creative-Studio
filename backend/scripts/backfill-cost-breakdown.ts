/**
 * Backfill the per-type cost breakdown on projects.usage.
 *
 * The UI (ProjectContextBar) reads usage.textCost / imageCost / videoCost /
 * audioCost, but those keys were never written — only totalCost was — so the
 * breakdown always rendered $0.0000. Every historical figure needed to
 * reconstruct them is already in usage_logs, which stores one row per
 * generation with its type and cost.
 *
 * Idempotent: the breakdown is recomputed from usage_logs each run, never
 * incremented. `totalCost` is deliberately left untouched (it is the
 * authoritative cumulative figure); any drift between it and the sum of the
 * logs is reported rather than silently "corrected".
 *
 * Usage:
 *   tsx backend/scripts/backfill-cost-breakdown.ts           # dry run
 *   tsx backend/scripts/backfill-cost-breakdown.ts --apply   # write changes
 */
import { db, projects } from '../services/database.ts';

const APPLY = process.argv.includes('--apply');

interface Row { project_id: string; type: string; cost: number; n: number }

const COST_KEY: Record<string, string> = {
  text: 'textCost', image: 'imageCost', video: 'videoCost', audio: 'audioCost',
};
const COUNT_KEY: Record<string, string> = {
  text: 'totalTexts', image: 'totalImages', video: 'totalVideos', audio: 'totalAudio',
};

const rows = db.prepare(`
  SELECT project_id, type, SUM(cost) AS cost, COUNT(*) AS n
  FROM usage_logs GROUP BY project_id, type
`).all() as Row[];

const byProject = new Map<string, Row[]>();
for (const r of rows) {
  if (!byProject.has(r.project_id)) byProject.set(r.project_id, []);
  byProject.get(r.project_id)!.push(r);
}

console.log(APPLY ? '=== APPLYING ===' : '=== DRY RUN (pass --apply to write) ===');
console.log('');

let changed = 0;
for (const [projectId, projectRows] of byProject) {
  const project = projects.findById(projectId);
  if (!project) {
    console.log(`- ${projectId}: project row missing, skipping ${projectRows.length} log group(s)`);
    continue;
  }

  const usage = (project.usage ?? {}) as Record<string, number | string>;
  const next: Record<string, number> = {};
  let loggedTotal = 0;

  for (const r of projectRows) {
    const costKey = COST_KEY[r.type];
    const countKey = COUNT_KEY[r.type];
    if (!costKey) continue;
    next[costKey] = r.cost;
    next[countKey] = r.n;
    loggedTotal += r.cost;
  }

  // Legacy naive pluralisation wrote totalAudios; the UI reads totalAudio.
  const strayAudio = Number(usage.totalAudios ?? 0);
  if (strayAudio && !next.totalAudio) next.totalAudio = strayAudio;

  const storedTotal = Number(usage.totalCost ?? 0);
  const drift = storedTotal - loggedTotal;

  console.log(
    `- ${(project.name ?? projectId).toString().slice(0, 28).padEnd(29)} ` +
    Object.entries(next).filter(([k]) => k.endsWith('Cost'))
      .map(([k, v]) => `${k}=$${v.toFixed(4)}`).join(' ').padEnd(58) +
    ` total=$${storedTotal.toFixed(4)}` +
    (Math.abs(drift) > 0.005 ? `  (logs differ by $${drift.toFixed(4)})` : ''),
  );

  if (APPLY) {
    const sets = Object.keys(next).map((k) => `'$.${k}', ?`).join(', ');
    db.prepare(
      `UPDATE projects SET usage = json_set(COALESCE(usage, '{}'), ${sets}, '$.lastUpdated', datetime('now')) WHERE id = ?`,
    ).run(...Object.values(next), projectId);
    // Drop the misspelled key so it stops shadowing the real one.
    db.prepare(`UPDATE projects SET usage = json_remove(usage, '$.totalAudios') WHERE id = ?`).run(projectId);
  }
  changed++;
}

console.log('');
console.log(`${changed} project(s) ${APPLY ? 'updated' : 'would be updated'}.`);
if (!APPLY) console.log('Re-run with --apply to write.');
