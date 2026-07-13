# Phase E — Live canvas sync

> Execution doc. Prerequisites: Phase C (MCP writes graphs), ideally D (runner writes progress).
> Design written 2026-07-11 — re-verify canvas auto-save behavior before implementing.

## Objective

When Claude builds or runs a workflow while a human has it open, the Canvas updates **live** —
nodes appear as Claude places them, outputs fill in as the runner finishes each node. Also fixes
the pre-existing two-human staleness (the canvas never re-reads after load).

## Current behavior (the problem)

- `src/canvas/Canvas.tsx` loads a workflow once, then **auto-saves the whole graph** (nodes+edges)
  2s debounced after any local change. It never re-fetches. External writes (MCP, the other user)
  are invisible until reload — and worse, the next local auto-save **overwrites them**
  (last-writer-wins, whole-document).

## Design

### Transport: SSE (with polling fallback), server → canvas

New endpoint `GET /api/workflows/:id/events` (authMiddleware; Streamable-HTTP-style SSE):
- On workflow write (`workflows.update`/`create` — add an in-process `EventEmitter` in
  `backend/services/database.ts` or a thin wrapper service), emit
  `{ workflowId, updatedAt, source: 'mcp'|'app', sessionToken }` to subscribers of that id.
- Event payload is a *ping*, not the graph — client re-fetches `GET /api/workflows/:id` on ping
  (keeps SSE tiny, avoids ordering bugs).
- Heartbeat comment every 15s (Cloudflare buffering/idle); client `EventSource` auto-reconnects.
  If Cloudflare proves hostile to SSE on this route, fallback: 3s `updated_at` poll — same client
  merge logic, so build the merge first and the transport is swappable.

### Client merge (the hard part)

In `Canvas.tsx` (or a new `useWorkflowSync` hook):
1. Tag every local save with a random `clientToken` sent in the PUT (new optional body field,
   echoed in the SSE ping) → ignore self-pings.
2. On foreign ping: if **no local dirty edits pending** (no debounce timer armed) → fetch + replace
   nodes/edges wholesale (React Flow handles it; preserve local viewport).
3. If local dirty edits pending → **field-level merge**: keep local `position` + any node the user
   is actively editing; take foreign `data.output`/`outputs`/`error`/new nodes/new edges. On
   conflict for the same node's config, latest `updated_at` wins + toast
   "Workflow updated by Claude — review".
4. Runner progress (Phase D writebacks) arrives as ordinary foreign pings — outputs pop in live.

### Reduce clobber at the source

While merging helps, also make the canvas auto-save **delta-aware**: before PUT, re-fetch
`updated_at`; if it moved since load and local isn't the only writer, merge (2) first, then save.
This fixes the two-human overwrite bug independent of MCP.

## Tools / UX additions

- MCP tool additions: none required (writes already trigger events). Optional `focus_workflow`
  no-op tool that just pings the UI to open/scroll to a workflow — skip unless wanted.
- Canvas UI: subtle "live" dot when SSE connected; toast on foreign update while dirty.

## Acceptance checklist

- [ ] Canvas open while Claude runs `add_node` ×5 + `connect_nodes` → nodes appear within ~1s
      each, no reload, no flicker of local viewport.
- [ ] Human drags a node while Claude adds another → both survive (no lost node, no position snap-back).
- [ ] Phase D run: outputs fill in live node-by-node.
- [ ] Two browsers (mounir + rana) same workflow: edits converge, no silent loss — the historical
      staleness bug is gone.
- [ ] SSE through Cloudflare in production stays alive ≥ 10 min (heartbeats); reconnect works
      (kill pm2, restart, canvas recovers).
- [ ] With SSE blocked (dev-tools offline test), polling fallback engages.

## Rollback

Feature-flag the hook (`VITE_LIVE_SYNC=0` or a constant) — canvas reverts to load-once behavior.
Server endpoint is additive.

## As built (2026-07-13, commit c3d86a5)

**Polling, not SSE** — the plan above assumed SSE; two facts killed it:
1. `EventSource` **cannot send an `Authorization: Bearer` header**, and this app has no cookie auth
   (JWT in localStorage). The workarounds are a token in the query string (leaks into logs) or a
   fetch+ReadableStream reader (hand-rolled reconnect/refresh logic).
2. Cloudflare buffers long-lived streams, so SSE would have needed heartbeat tuning to even survive.

A 3s probe of a **new cheap endpoint** `GET /api/workflows/:id/version` (returns `{id, updatedAt}`
only — the graph itself can be large) is simpler, proxy-proof, and well inside "feels live" for a
two-person tool. Swapping in SSE later only changes the trigger; the merge below is the real work.

**Files**: `backend/routes/workflows.ts` (version route, registered before `/:id`),
`src/lib/api.ts` (`workflowsApi.getVersion`), `src/lib/graphMerge.ts` (pure merge + tests),
`src/hooks/useWorkflowSync.ts` (poll + apply), `src/canvas/Canvas.tsx` (wiring).

**Merge semantics** (`mergeGraphs`, bias = never lose work):
- **Clean canvas** (nothing pending): adopt the server graph wholesale.
- **Dirty canvas** (edits waiting on the 2s debounce): local wins for `position`/`config`/`label`
  (what a human is manipulating); the **server wins for `output`/`outputs`/`error`** (only the
  backend produces those); nodes/edges added on either side are kept; **deletions are not
  propagated while dirty** — removing a node someone is editing is worse than briefly showing one
  deleted elsewhere (a reload reconciles).
- **Echo suppression**: the canvas records the `updated_at` its own save returned, and sets an
  `applyingRemoteRef` flag before the hook writes to the store, so a pulled-in graph never bounces
  back out as a fake "local" auto-save.

**Bonus fix**: this also closes the pre-existing two-human hazard where the canvas's next auto-save
silently overwrote the other user's changes.

**Verification**: merge covered by unit tests (`graphMerge.test.ts` — 5 cases incl. "server result
adopted while the user's in-progress config and drag survive"); the version probe was verified live
(unchanged when idle, changes the instant an MCP `add_node` lands). The visual confirmation —
watching nodes appear in an open canvas — is a user-side check (agent can't log into the SPA).
