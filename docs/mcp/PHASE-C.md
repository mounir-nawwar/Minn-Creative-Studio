# Phase C — Graph tools (build node pipelines that appear in the Canvas)

> Execution doc. Prerequisites: Phase A (required), Phase B (recommended — reference generation).
> Design written 2026-07-11 — **re-verify cited files before implementing.**

## Objective

Claude can build and edit React Flow workflows through MCP — add any of the ~50 node types, wire
any node to any compatible node, set every parameter (seed, cfg/guidance, aspect ratio, negative
prompt, reference roles/strength…), and the result **is the graph the user sees in the Canvas**
(same rows the canvas auto-save writes). No new persistence — workflows are already just JSON.

## Ground truth: what a stored workflow looks like

`workflows` table: `nodes TEXT` + `edges TEXT` (two JSON-string columns). Exact shapes the canvas
writes (`src/canvas/Canvas.tsx` auto-save, ~line 57-106):

```jsonc
// node
{ "id": "imagen-1720000000000",          // convention: `${type}-${Date.now()}` — VERIFY in
                                          // src/store/useStore.ts addNode / wherever ids are minted
  "type": "imagen",                       // NodeType union member (src/types.ts)
  "position": { "x": 120, "y": 240 },     // finite numbers required
  "data": { "type": "imagen",             // data.type mirrors node type
             "label": "Imagen",
             "config": { "model": "imagen-4.0-generate-001", "aspectRatio": "1:1",
                          "sampleCount": 1, "seed": 1234, ... },   // per-node config interface
             "output": "/storage/...",    // primary output (string url or text)
             "outputs": ["/storage/..."]  // multi-output
  } }
// edge
{ "id": "e-<source>-<target>-<handle>", "source": "<nodeId>", "target": "<nodeId>",
  "sourceHandle": "image", "targetHandle": "reference",
  "type": null, "animated": false, "data": null }
```

Base64 `data:` URLs are stripped by the canvas on save — MCP must only ever write `/storage` URLs
into `output`/`outputs`.

## The schema generator (the heart of this phase)

Claude can only build valid graphs if the tool schema teaches it the node system. Generate it from
the real registries — never hand-maintain a copy:

- `src/types.ts` — the `NodeType` union (~50 ids).
- `src/types/nodeHandles.ts` — `NODE_HANDLES: Record<NodeType|'default', { inputs: HandleDefinition[]; outputs: HandleDefinition[] }>`
  where `HandleDefinition = { id, type: HandleType, label?, position? }` and
  `HandleType = image|prompt|seed|video|audio|mask|number|text|boolean|json|array|motion|unknown`.
- `src/types/validationRules.ts` — `CONNECTION_VALIDATION_RULES` (per-nodeType `allowedInputs`/
  `allowedOutputs`/`blockedConnections`; **partial** — nodes without rules fall back to
  handle-type equality).
- Node config interfaces live per component (`src/nodes/ImagenNode.tsx` `ImagenNodeData` etc.) —
  there is no central config schema. Phase C builds one: `backend/mcp/graph/nodeCatalog.ts`, a
  typed catalog `{ [nodeType]: { description, configFields: {name, type, enum?, default?, min?, max?}[] } }`
  for the **generator + param nodes first** (imagen, nanoBanana, veo, imageToVideo, lyria, llm,
  prompt, seed, number, cfgScale, guidanceStrength, motionIntensity, imageUpload, output, text),
  expanding coverage over time. `describe_node_types` exposes it.

All three frontend files are backend-importable **only if** they stay free of browser-only imports
— verify (`nodeHandles.ts`/`validationRules.ts`/`types.ts` are pure data/types today). Add a node
unit test importing them (same guard pattern as `src/lib/models.ts` in Phase A).

## Tool catalog

Reads reuse Phase A. Writes go through the `workflows` repo (same as `PUT /api/workflows/:id`).
Every mutating tool validates the whole graph before saving and returns the validation report.

| Tool | Input (sketch) | Behavior |
|---|---|---|
| `describe_node_types` | `{ nodeType? }` | Node catalog: handles (id+type), config fields, connection rules. Claude calls this before building |
| `create_workflow` | `{ projectId, name }` | `workflows.create(id, projectId, userId, name, [], [])` |
| `add_node` | `{ workflowId, nodeType, config?, label?, position? }` | Validate nodeType + config against catalog; mint id `${type}-${Date.now()}`; auto-position if omitted (see layout); save |
| `update_node` | `{ workflowId, nodeId, config?, label?, position? }` | Shallow-merge into `data.config` (immutably); save |
| `remove_node` | `{ workflowId, nodeId }` | Drop node + all its edges; save |
| `connect_nodes` | `{ workflowId, sourceNodeId, sourceHandle, targetNodeId, targetHandle }` | Validate: handles exist in `NODE_HANDLES[type]`, handle-type compatibility, `CONNECTION_VALIDATION_RULES` (incl. `blockedConnections`), no duplicate edge, one edge per target handle (replace or reject — match canvas behavior, VERIFY in `useStore.onConnect`); save |
| `disconnect_nodes` | `{ workflowId, edgeId }` | Remove edge; save |
| `set_workflow` | `{ workflowId, nodes, edges }` | Whole-graph write for "build me this pipeline" in one call — full validation of every node/edge first; reject with a precise error list on any failure |
| `validate_workflow` | `{ workflowId }` | Dry-run report: unknown types, dangling edges, type mismatches, missing required inputs (e.g. generator without prompt), cycles |
| `auto_layout` | `{ workflowId }` | Topological columns: x = 320 * depth, y = 180 * indexWithinColumn (matches canvas node sizing roughly; tune visually) |

## Concurrency with the canvas (pre-Phase-E rule)

The canvas auto-saves the whole graph 2s after any change and **does not poll for external
changes**. If Claude edits a workflow that is open in someone's browser, the browser's next
auto-save will overwrite Claude's write (last-writer-wins, whole-document).

Phase C mitigation (documented behavior, not code): tool descriptions instruct that edits apply to
workflows not currently being edited by a human, and every mutating tool returns
`updated_at` so Claude can detect interleaved writes (re-read before each mutation, warn on drift).
The real fix is Phase E.

## Acceptance checklist

- [ ] From claude.ai: "create a workflow in project X: prompt node → imagen (seed 42, 3:4, 2
      samples) → output" → open the Canvas → the graph is there, positioned readably, and **Run on
      the imagen node works untouched**.
- [ ] `connect_nodes` refuses: image→seed (blocked), unknown handle, duplicate edge — with
      messages that tell Claude what IS allowed.
- [ ] `set_workflow` with a 6+ node try-on pipeline (imageUpload ×2 → nanoBanana with references →
      imagen/veo …) validates and renders.
- [ ] Reference images: an edge into `reference` + `config.referenceRoles[edgeId]` set — node runs
      in the UI with the role applied (mirror `ImagenNode.tsx` role reading, ~line 93-105).
- [ ] Graph written by MCP survives a human edit + auto-save round-trip without corruption.
- [ ] Unit tests: validator (type compatibility matrix, blocked pairs, cycle detection), layout
      determinism, catalog↔NODE_HANDLES consistency (every catalog node exists in NODE_HANDLES).

## Rollback

Additive (new tool files + `backend/mcp/graph/`). No schema change. Worst case: bad graphs written
to a workflow — recover by deleting the workflow in the UI.
