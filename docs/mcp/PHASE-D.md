# Phase D — Headless graph runner

> Execution doc. Prerequisites: Phases A + B (generation service) + C (graph tools/catalog).
> Design written 2026-07-11 — the largest genuinely-new engineering in the roadmap.

## Objective

"Run this workflow" as a single MCP job: the server executes the graph node-by-node in dependency
order — calling Vertex through `backend/services/generation.ts` (Phase B), writing every output
back into `node.data.output`/`outputs` — so the finished pipeline (with all its generated media)
appears in the Canvas exactly as if a human had pressed Run on each node.

Today **no server-side execution exists**: Run lives in each node component
(`handleRun` → `src/services/geminiService` → proxy → `updateNodeData`). The runner re-implements
that orchestration on the backend; the per-model calls themselves are already server-side.

## Architecture

New: `backend/mcp/runner/` (or `backend/services/graphRunner.ts` if the app later wants a UI
"Run all" button — prefer the service location for reuse).

1. **Load** workflow via `workflows.findById` → `{nodes, edges}`.
2. **Plan**: build DAG (edges define deps), Kahn topo-sort; reject cycles (validator from Phase C).
   Only nodes reachable-as-ancestors of requested targets run (`run_workflow` accepts optional
   `targetNodeIds` — default: all executable nodes).
3. **Execute** level-by-level; nodes within a level run sequentially in v1 (Vertex quota + 1GB VPS;
   parallelism is a tuning knob later).
4. **Node executor registry** — `executors: Partial<Record<NodeType, NodeExecutor>>` where
   `NodeExecutor = (node, inputs, ctx) => Promise<{ output?: string; outputs?: string[] }>` and
   `inputs = { [targetHandleId]: upstreamValue }` resolved from edges
   (`upstream.data.output` — mirror how components read them, e.g. `ImagenNode.tsx:138-153`).
   v1 executor coverage (everything else → node marked `skipped`, run continues, report says why):
   - **Value nodes** (no API): `prompt`, `text`, `number`, `seed`, `toggle`, `cfgScale`,
     `guidanceStrength`, `motionIntensity`, `imageUpload`/`videoUpload` (pass through
     `data.output`), `promptConcatenator`, `listSelector`.
   - **LLM/analysis**: `llm`, `imageDescriber`/`vision`, `promptEnhancer` → `generateContent`.
   - **Generators**: `imagen`, `nanoBanana` → image gen (replicate `ImagenNode.tsx` param
     branching); `veo`, `imageToVideo` → `generateVideos` + **server-side** poll of `getOperation`
     + `fetchVideoFile`; `lyria` → audio.
   - **Image ops** (`crop`, `resize`, `blur`, `levels`, …): most are client-side canvas/pixel work
     today — **VERIFY per node**; ones implemented with sharp/ffmpeg server-side can get executors
     (`backend/processing/` already exists), the rest are `skipped` in v1.
5. **Writeback after every node**: `workflows.update(id, { nodes })` with the node's
   `data.output`/`outputs`/`error` set immutably — so partial progress is visible in the Canvas
   (and Phase E streams it live). Also set/clear a `data.isRunning`-equivalent? **No** — that flag
   drives UI spinners; use a separate `data.lastRun` stamp instead to avoid fighting components.
   (Decide at implementation; record in the decisions log.)
6. **Job wrapper**: reuse `mcp_jobs` (Phase B) with `kind:'workflow'` — `run_workflow` returns
   `{ jobId }`; `check_job` reports `{ status, completedNodes, totalNodes, currentNode, perNodeResults }`.
   Cancellation: `cancel_job` sets a flag the loop checks between nodes.

## Tools

| Tool | Input | Behavior |
|---|---|---|
| `run_workflow` | `{ workflowId, targetNodeIds?: string[] }` | Validate → plan → enqueue job → `{ jobId, plan: orderedNodeIds }` |
| `run_node` | `{ workflowId, nodeId }` | Single node with existing upstream outputs (fails listing missing inputs) |
| `cancel_job` | `{ jobId }` | Stop between nodes; nodes already done keep outputs |

## Cost & safety

- Every generator executor flows through `runGeneration` → `trackProjectCost` automatically,
  tagged `via:'mcp'`.
- **Run budget guard**: before executing, estimate cost from the plan (`MODEL_PRICING` ×
  sampleCount/duration) and refuse plans above a configurable ceiling
  (`MCP_MAX_RUN_COST_USD`, default e.g. $5) unless the tool call passes `confirmCost: true`.
  This is the "Claude accidentally queues 40 Veo clips" fuse.
- Concurrency: one running workflow job per user in v1 (second `run_workflow` → 409-style error).

## Acceptance checklist

- [ ] Build (Phase C) then run a pipeline — prompt → imagen(seed) → imageDescriber → veo — entirely
      from claude.ai; Canvas shows each node's media; costs logged per node.
- [ ] `check_job` progress advances node-by-node; canvas partial results visible mid-run.
- [ ] Kill pm2 mid-run → job resumes-or-fails cleanly on restart (mark `running` jobs `error:
      'interrupted'` on boot — do NOT auto-resume in v1).
- [ ] Unsupported node in the path → skipped with reason, downstream that depended on it fails
      with a clear message, siblings still run.
- [ ] Budget guard blocks an expensive plan without `confirmCost`.
- [ ] Human pressing Run in the UI on the same workflow mid-job: document last-writer-wins hazard
      (Phase E fixes); runner re-reads the workflow before each writeback and merges only its own
      node's data fields to minimize clobber.
- [ ] Unit tests: topo-sort (incl. cycle), input resolution from edges, skipped-node propagation,
      budget estimator.

## Rollback

Additive (runner module + 3 tools). Jobs table already exists. Disable = unregister tools.

## As built (2026-07-13, commit 0785a54)

1. **Location**: `backend/services/graphRunner.ts` (service, not `backend/mcp/`) so a future in-app
   "Run all" button can reuse it. Tools live in `backend/mcp/tools/run.ts`.
2. **Tools**: `run_workflow` (background job + jobId), `run_node` (synchronous, single node),
   `cancel_run`. `check_job` was extended to report workflow progress
   (`{completed, total, currentNode, results[]}`) — no separate polling tool.
3. **Executor coverage** (`EXECUTORS` registry): value nodes (prompt/text/number/seed/cfgScale/
   guidanceStrength/motionIntensity/imageUpload/videoUpload/listSelector/toggle), promptConcatenator,
   promptEnhancer, llm, vision/imageDescriber/videoDescriber, imagen + nanoBanana (references, seeds,
   sampleCount), veo + imageToVideo (**server-side LRO polling**, 5s × 120), lyria clips, output.
   Everything else → `skipped` with a reason; dependents are skipped too, siblings still run.
   **Lyria Pro is refused inside a run** (use `start_music_job`) — a run shouldn't block for minutes
   on an LRO that has its own job pattern.
4. **Cost fuse**: pre-flight estimate from `MODEL_PRICING` (images: `perImage`, or ~$0.10/image for
   token-billed Gemini image models; video: `calculateCost` with duration/resolution/audio × samples).
   Runs above `MCP_MAX_RUN_COST_USD` (default **$5**) are refused unless `confirmCost: true`.
   Text spend isn't estimable up front and is ignored in the estimate (still tracked after the fact).
5. **Writeback**: after each node the runner **re-reads the workflow and merges only that node's
   data** onto the latest graph, minimizing clobber if a human is editing concurrently (full fix =
   Phase E). Partial progress is therefore visible in the Canvas mid-run.
6. **Concurrency**: one workflow run per user (`countRunningOfKind`); cancel flags are in-memory.
   `mcp_jobs` CHECK was widened to allow `kind='workflow'` via a **guarded table rebuild** (SQLite
   can't ALTER a CHECK) — rows preserved, runs once. Interrupted runs are failed at boot
   (`failInterruptedRuns`), since the runner's state is in-process.
7. **Live-verified**: prompt+seed → gemini image → imageDescriber → output, plus a `crop` node that
   correctly reported `skipped`. Outputs landed in `data.output`, the describer consumed the image
   the runner had just generated, and usage rows carried `via:'mcp'`.
