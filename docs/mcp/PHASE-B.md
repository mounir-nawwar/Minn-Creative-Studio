# Phase B — Creation tools (generate, upload, move, chats)

> Execution doc. Prerequisite: Phase A complete (check the status tracker in
> [00-OVERVIEW.md](./00-OVERVIEW.md)). Design written 2026-07-11 against the then-current code —
> **re-verify every cited path/behavior before implementing.**

## Objective

Claude can *make things*: generate text, images, and audio inline; generate video/long audio via a
job pattern; pull reference images from the Library or a URL; upload assets; move assets between
projects; and read/write Chat Studio sessions. All costs tracked, all writes tagged `{via:'mcp'}`.

## The one refactor this phase requires

All generation currently lives inside the Express handler in `backend/routes/gemini.ts` (the
`method` switch: `generateContent`, `generateImages`, `generateVideos`, `getOperation`,
`fetchVideoFile`). MCP must NOT duplicate that logic and must NOT call HTTP-to-self.

**Refactor:** extract the switch bodies into `backend/services/generation.ts`:

```ts
export async function runGeneration(args: {
  method: 'generateContent'|'generateImages'|'generateVideos'|'getOperation'|'fetchVideoFile';
  params: any;            // same shapes the proxy accepts today
  userId: string;
  signal?: AbortSignal;   // proxy keeps its 58s timeout; MCP passes its own
  via?: 'app'|'mcp';      // NEW: threaded into asset/usage metadata
}): Promise<any>          // same result shapes the proxy returns today
```

- `backend/routes/gemini.ts` becomes a thin HTTP wrapper: auth + `aiLimiter` + 58s AbortController
  + `runGeneration({ ..., via: 'app' })`. **Behavior of the app must not change** — the existing
  frontend keeps working identically (regression: run an Imagen node + a chat-studio generation).
- Keep cost tracking (`trackProjectCost`), storage upload (`uploadInlineDataToStorage`,
  `assets.create` in `fetchVideoFile`), and the `trackedOperations` dedup Set inside the service.
- `via` lands in `assets.metadata` and `usage_logs.metadata` JSON (add key, don't restructure).

## Tool catalog

All tools require a `projectId`; docs/tool descriptions tell Claude to use `'playground'` for
scratch work (the sentinel keeps every NOT-NULL FK path working). All wrapped in `auditToolCall`.

### Inline tools (complete within one request; Cloudflare-safe)

| Tool | Input (sketch) | Maps to |
|---|---|---|
| `generate_text` | `{ projectId, prompt, model? (default gemini-3-flash-preview), systemInstruction?, imageUrls?: string[], temperature?, maxOutputTokens? }` | `runGeneration('generateContent')` — returns `{ text }` |
| `generate_image` | `{ projectId, prompt, model? (imagen/nano-banana ids from list_models), aspectRatio?, resolution?, sampleCount? (≤4), seed?, negativePrompt?, referenceImages?: [{url, role?, strength?}] }` | `runGeneration('generateImages')` for Imagen, `generateContent` for nano-banana (mirror `src/nodes/ImagenNode.tsx` param branching) — returns `{ images: [{url, assetId}] }` (proxy already persists to storage + asset rows) |
| `generate_speech` | `{ projectId, text, voice? (TTS_VOICES from src/lib/models.ts) }` | `generateContent` with TTS model |
| `generate_music_clip` | `{ projectId, prompt, bpm?, density?, brightness?, musicScale? }` | `generateContent` lyria-3-clip (sync path) |
| `upload_asset_from_url` | `{ projectId, url, filename? }` | `storage.uploadFromUrl` (SSRF-guarded already) |
| `move_asset` | `{ assetId, targetProjectId }` | `storage.moveAssetToProject` (exists — used by the Library UI) |

### Job-pattern tools (long-running: Veo video, Lyria-Pro)

Cloudflare kills ~100s responses; Veo takes minutes. Mirror the frontend's poll loop
(`src/services/gemini/videoService.ts`: `generateVideos` → poll `getOperation` → `fetchVideoFile`):

| Tool | Behavior |
|---|---|
| `start_video_job` | `{ projectId, prompt, model? (veo-3.1-fast/veo-3.1), aspectRatio?, resolution?, duration?, negativePrompt?, seed?, audio?, startFrameUrl?, endFrameUrl?, referenceImages? }` → `runGeneration('generateVideos')` → store `{ operationName, model, projectId, userId, createdAt }` in a new `mcp_jobs` table (or reuse in-memory + operation name — **prefer the table**: survives pm2 restarts) → return `{ jobId }` immediately |
| `start_music_job` | Same pattern for `lyria-3-pro-preview` (`predictLongRunning` → `{operation, isLro:true}`) |
| `check_job` | `{ jobId }` → `runGeneration('getOperation')`; not done → `{ status:'running', elapsedSeconds }`; done (video) → `runGeneration('fetchVideoFile')` → `{ status:'done', url, assetId }`; done (audio) → decode/persist per existing chat-studio audio path; error → `{ status:'error', message }`. Idempotent: once done, re-checks return the stored result |

`mcp_jobs` DDL sketch:
```sql
CREATE TABLE IF NOT EXISTS mcp_jobs (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, project_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('video','audio')),
  operation_name TEXT NOT NULL, model TEXT, params TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','done','error')),
  result TEXT, error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Chat tools (Chat Studio interop)

Chats are **per-user** (unlike projects/assets) — only expose the caller's own chats
(`chats.findByUserId(ctx.user.id)`); enforce owner check on every chat tool.

| Tool | Maps to |
|---|---|
| `list_chats` | `{ projectId? }` → chats repo filtered to caller |
| `get_chat` | `{ chatId }` → messages incl. attachments (owner check) |
| `post_chat_message` | `{ chatId, role: 'user'\|'assistant', content, attachments? }` → `messages.create` (validate like `POST /api/chats/:id/messages` does: ≤10 attachments, valid types) |
| `create_chat` | `{ projectId, title? }` |

## Validation & safety

- Validate every input with zod (enums for models from the registry — reject unknown model ids so
  pricing can't be bypassed; `sampleCount ≤ 4`; URL params must be same-origin `/storage/...` or
  http(s) — reuse the SSRF guard for external URLs).
- Reference-image URLs: accept Library URLs (`/storage/...` → resolve via `assets.findByUrl`) or
  external URLs (fetch via the guarded path).
- Cost: automatic via `trackProjectCost` inside the service — verify usage rows appear with
  `metadata.via = 'mcp'`.

## Acceptance checklist

- [ ] App regression: Imagen node run + Chat Studio image + Veo video behave exactly as before the
      proxy refactor (`git diff` on gemini.ts should show only extraction, no logic change).
- [ ] `generate_image` from claude.ai lands the file in `/storage`, an asset row with
      `metadata.via='mcp'`, a usage_log row, and shows up in the Library UI.
- [ ] `start_video_job` → `check_job` loop from claude.ai completes a Veo clip; job survives a
      `pm2 restart` mid-run (re-check after restart still resolves).
- [ ] Rana's chats are invisible to mounir's MCP session and vice versa.
- [ ] `npm run lint`, `npm test` green; unit tests for job store + input validation.

## Rollback

Tools are additive. The proxy refactor is the only risk surface — revert `backend/routes/gemini.ts`
+ delete `backend/services/generation.ts` restores the exact previous behavior. `mcp_jobs` table is
additive.

## As built (2026-07-12, commits c770c19 → 063778a)

Deviations/notes versus the spec above:

1. **Tool names/scope**: shipped `generate_text`, `generate_image`, `generate_speech`,
   `generate_music_clip`, `upload_asset_from_url`, `move_asset`, `start_video_job`,
   `start_music_job`, `check_job`, `list_chats`, `get_chat`, `create_chat`, `post_chat_message`
   (13 new; 20 total). `generate_image` has **no negativePrompt** — neither app image path
   supports one; exclusions go in the prompt. Reference images are Gemini-image-model only
   (Imagen 4 is one-shot, enforced with a helpful error).
2. **Reference URLs**: Library `/storage/...` (or absolute) urls are read from disk with a
   path-traversal guard (`backend/mcp/media.ts`); external http(s) urls flow through the existing
   `_imageUrl` → `resolveImageUrls` path (images) or a direct fetch (video frames).
3. **Sample caps**: Imagen ≤4 per call; Gemini image models ≤2 (sequential one-image calls).
4. **Jobs**: `mcp_jobs` kinds `video`/`audio` as specced; ≤3 running jobs per user; `check_job`
   is callable by any authenticated user (shared-workspace semantics), results idempotent.
   Lyria-Pro audio arrives WAV-normalized from `vertexGetOperation` and is persisted via
   `uploadBase64` with `via:'mcp'`.
5. **Environment finding**: Imagen 4 models return Vertex 404 (`NOT_FOUND`) on the current GCP
   project — not enabled/allowlisted there. Gemini image models (`gemini-3.1-flash-image`
   etc.) verified working. Revisit if Imagen access is enabled on the Google side.
6. **Live-verified locally**: chat tools, `generate_text` ($0.00003), `generate_image` via
   gemini-3.1-flash-image ($0.067) — asset row + usage rows carried `via:'mcp'`, audit
   logged everything including the Imagen failure. Video/music jobs are unit-covered and
   code-mirrored from the app's poll loop but not yet run end-to-end (video costs); first real
   run happens from a connected Claude client.
