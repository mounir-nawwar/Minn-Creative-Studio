# 02 — Backend

The backend lives in `server.ts` (entry) + `backend/`. It is plain Express 4 run directly through `tsx` (no compile step). All paths below are relative to the repo root.

```
backend/
├── config/        auth.ts · cors.ts · pricing.ts
├── middleware/    auth.ts · validation.ts · parameterInjector.ts
├── routes/        auth-new.ts · auth.ts · projects.ts · workflows.ts · chats.ts · assets.ts
│                  gemini.ts · imageProxy.ts · upscale.ts · interpolate.ts · video.ts · batchsize.ts · prompts.ts
├── services/      database.ts · auth.ts · storage.ts · vertex.ts · costTracking.ts
├── processing/    esrgan.ts · rife.ts · video.ts
└── utils/         audio.ts · imageValidation.ts · imageResolver.ts · media.ts
```

---

## 🚀 `server.ts` — boot sequence

1. Loads env (`dotenv` from `.env`), derives `IS_PRODUCTION` from `AUTH_CONFIG.isProduction`.
2. Imports `backend/services/database.ts` for its side effect — **initializing the SQLite schema on startup**.
3. Middleware stack, **in order** (`server.ts:42-50`):
   1. `helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginOpenerPolicy: false })` — CSP/COOP deliberately off for this internal tool.
   2. `corsMiddleware` (origin-reflecting, see below).
   3. `express.json({ limit: '50mb' })` and `express.urlencoded({ extended: true, limit: '50mb' })` — large limits because base64 media flows through JSON bodies.
   4. `cookieParser()`.
4. Builds an `apiRouter` and mounts it at `/api` (`server.ts:52-89`):

   | Mount | Router | Family |
   |-------|--------|--------|
   | `/api/auth` | `auth-new.ts` | New (SQLite/JWT) |
   | `/api/projects` | `projects.ts` | New |
   | `/api/workflows` | `workflows.ts` | New |
   | `/api/chats` | `chats.ts` | New |
   | `/api/assets` | `assets.ts` | New |
   | `/api/presets` | `presets.ts` | New (Chat Studio presets) |
   | `/api/` | `upload.ts` | Legacy |
   | `/api/proxy-image` | `imageProxy.ts` | Legacy |
   | `/api/gemini/proxy` | `gemini.ts` | Legacy (core AI gateway) |
   | `/api/upscale` | `upscale.ts` | Legacy |
   | `/api/interpolate` | `interpolate.ts` | Legacy |
   | `/api/video` | `video.ts` | Legacy |
   | `/api/batchsize` | `batchsize.ts` | Legacy |
   | `/api/prompts` | `prompts.ts` | Legacy |

5. `GET /api/health` → `{ status: 'ok' }`; `GET /api/storage-status` → storage stats (debug).
6. `/storage` → `express.static(STORAGE_PATH)` (default `<cwd>/storage`).
7. Frontend serving:
   - **Dev:** `createViteServer({ server:{ middlewareMode:true }, appType:'spa' })`, then `app.use('/', vite.middlewares)`.
   - **Prod:** `express.static('dist')` + `app.get('*')` → `dist/index.html`.
8. Global error handler returns `{ success:false, error }` with `err.status || 500`.
9. `app.listen(PORT, '0.0.0.0')` — `PORT` defaults to `3000`.

---

## ⚙️ config/

### `config/auth.ts` — `AUTH_CONFIG`
Central auth config and env helpers.
- `isProduction = NODE_ENV === 'production' || !!K_SERVICE`.
- Helpers: `requireEnv(name, devDefault?)` (throws in prod if missing), `requireSecureEnv(name)` (returns an insecure dev default with a warning if unset in dev).
- `AUTH_CONFIG = { sessionSecret, adminUsername, adminPassword, authorizedEmails: Set, jwtExpiresIn: '30d', cookieMaxAge: 30d, isProduction }`.
- `parseAuthorizedEmails()` parses `AUTHORIZED_EMAILS` (comma-separated) into a lowercased `Set`; `isAuthorizedEmail(email)` / `getAuthorizedEmailsList()` read it.

### `config/cors.ts` — CORS + rate limiters
- `allowedOrigins` (kept for reference, **not enforced**): prod = `studio.minnagency.com`, `http(s)://150.230.52.15:3000`; dev = `localhost:5173`, `localhost:3000`.
- `corsMiddleware = cors({ origin: true, credentials: true })` — **reflects the request origin**. The inline comment explains why: the SPA is same-origin and auth is Bearer-token (not cookie), so strict origin checks would only break legitimate calls without adding protection.
- Rate limiters (`express-rate-limit`, standard headers, no legacy headers):
  - `loginLimiter` — **5 / 15 min**.
  - `apiLimiter` — **100 / 60 s**.
  - `aiLimiter` — **30 / 60 s**, `skip: () => !IS_PRODUCTION` (disabled in dev).

### `config/pricing.ts` — `MODEL_PRICING` + cost math
The source of truth for cost tracking. Exact table (`pricing.ts:1-30`):

| Model | Pricing |
|-------|---------|
| `imagen-4.0-ultra-generate-001` | $0.06 / image |
| `imagen-4.0-generate-001` | $0.04 / image |
| `imagen-4.0-fast-generate-001` | $0.02 / image |
| `imagen-4-upscale` | $0.06 / image |
| `imagen-1-upscale` | $0.003 / image |
| `gemini-3.1-flash-image` | in $0.50, out $3.00, **imageOut $60.00** / 1M tok |
| `gemini-2.5-flash-image` | in $0.50, out $3.00, imageOut $60.00 / 1M |
| `gemini-3-pro-image` | in $2.00, out $12.00, imageOut $120.00 / 1M |
| `veo-3.1-fast-generate-001` | per sec: 720p $0.10, 1080p $0.12, 4K $0.30, +audio $0.10 |
| `veo-3.1-generate-001` | per sec: 720p $0.40, 1080p $0.40, 4K $0.60, +audio $0.40 |
| `lyria-3-pro-preview` | $0.08 / song |
| `lyria-3-clip-preview` | $0.04 / 30s clip |
| `gemini-2.5-flash-preview-tts` | $0.005 / 1K input chars |
| `gemini-3-flash-preview` | in $0.50, out $3.00, audioIn $1.00 / 1M |
| `gemini-3.1-pro-preview` | in $2.00, out $12.00 / 1M |
| `gemini-3.1-flash-lite-preview` | in $0.25, out $1.50, audioIn $0.50 / 1M |

- `calculateCost(model, usage, params)` selects the right formula: flat-per-image, token-based (uses `imageOutput` rate when `usage.imageCount > 0`), video (`per-sec × duration`, +audio), Lyria flat, or TTS per-1K-chars. Unknown model → `0` (logged).
- `categorizeCost(model)` → `'video'` (veo), `'audio'` (lyria/tts), `'image'` (imagen/`*image*`), else `'text'`.

---

## 🛡️ middleware/

### `middleware/auth.ts` & `services/auth.ts` (auth middleware)
JWT verification. The active middleware used by the new routes is `authMiddleware` from `services/auth.ts`:
- Reads `Authorization: Bearer <token>`, verifies with `JWT_SECRET` and `subject: 'access'`, rejects refresh-type tokens, then loads the **fresh** user from the DB and sets `req.user = { id, username, email }`. Missing/invalid → `401`.
- `optionalAuthMiddleware` / `optionalAuth` — same but never blocks (used where auth is optional).
- `middleware/auth.ts` also provides a legacy `requireAuth` that additionally accepts the session cookie and is lenient in dev.

### `middleware/validation.ts` — Zod schemas
`validateBody(schema)` returns `400` with `{ field, message }[]` on failure. Predefined schemas: `loginSchema`, `upscaleVideoSchema`, `interpolateSchema`, `videoProcessSchema`, `variationsSchema`, `inpaintSchema`, `styleTransferSchema`, `batchSizeSchema`, `promptCreateSchema`, `proxyImageSchema`.

### `middleware/parameterInjector.ts`
`injectParameters(baseParams, overrides)` merges node parameter overrides and fills defaults: `seed` (random 0–999999), `guidanceScale` 7.5, `motionIntensity` 50, `cfgScale` 7.

---

## 🛣️ routes/ — every endpoint

> All "new" routes (`projects`, `workflows`, `chats`, `assets`) require `authMiddleware`. AI/legacy routes require `requireAuth` (and `gemini.ts` adds `aiLimiter`).

### Auth — `auth-new.ts` (mounted `/api/auth`)
| Method · Path | Auth | Body → Response |
|---|---|---|
| `POST /login` | no | `{ username, password }` → `{ success, accessToken, refreshToken, user }` |
| `POST /logout` | no | → `{ success, message }` (JWT is stateless; client discards tokens) |
| `POST /refresh` | no | `{ refreshToken }` → `{ success, accessToken }` |
| `GET /me` | Bearer | → `{ authenticated, user? }` (401 without a valid token) |

A separate **legacy** `auth.ts` exists (cookie/session based, `loginLimiter` + `validateBody(loginSchema)`, `timingSafeEqual`) but the app uses `auth-new.ts`.

### Projects — `projects.ts`
| Method · Path | Purpose |
|---|---|
| `GET /projects` | List **all** projects (shared workspace via `projects.findAll()`; the playground sentinel is excluded) |
| `POST /projects/playground` | **Idempotent**: creates/returns the hidden shared **Playground sentinel** (`id='playground'`, `settings.isPlayground`). Registered before `/:id`. |
| `GET /projects/:id` | Single project (also returns the sentinel — needed to enter playground mode) |
| `POST /projects` | Create `{ name, description?, settings? }` |
| `PUT /projects/:id` | Update `{ name?, description?, settings?, usage? }` — **403 for the playground sentinel** |
| `DELETE /projects/:id` | Delete project + `deleteProjectFiles(id)` storage cleanup — **403 for the playground sentinel** |
| `GET /projects/:id/usage` | `usage_logs` for the project |

> **Playground:** playground mode (canvas/chat without a client project) is backed by this sentinel row so every
> `NOT NULL project_id` path (workflows, assets, usage_logs, cost tracking) works unchanged. It never appears in
> project lists and cannot be edited or deleted.

### Workflows — `workflows.ts`
| Method · Path | Purpose |
|---|---|
| `GET /workflows?projectId=X` | Workflows for a project (or for the user if no `projectId`) |
| `GET /workflows/:id` | Single workflow (`nodes`/`edges` parsed from JSON) |
| `POST /workflows` | Create `{ projectId, name?, nodes?, edges? }` |
| `PUT /workflows/:id` | Update `{ name?, nodes?, edges? }` — the **canvas auto-save** target |
| `DELETE /workflows/:id` | Delete |

> **Shared workspace:** workflow routes check that the project/workflow *exists* — not who owns it. Either user
> may open, save, or delete any workflow (required for the shared playground and shared client projects).

### Chats — `chats.ts`
| Method · Path | Purpose |
|---|---|
| `GET /chats` | List chats for user (chats stay **per-user**, unlike projects/assets) |
| `GET /chats/:id` | Chat + its `messages` (each message includes parsed `attachments`) |
| `GET /chats/:id/messages` | Messages only |
| `POST /chats` | Create `{ title?, projectId? }` (project validated for existence only) |
| `POST /chats/:id/messages` | Add `{ role:'user'\|'assistant', content, attachments? }` — attachments validated (≤10, each `{ url, type:'image'\|'video'\|'audio', assetId?, name?, model? }`); updates `last_message` |
| `PUT /chats/:id` | Update `{ title?, projectId?, moveAssets? }` — with `projectId` + `moveAssets:true` it **moves the chat to another project along with every generated asset** its messages reference (resolved by `assetId` or storage URL) and rewrites attachment URLs so media keeps loading |
| `DELETE /chats/:id` | Delete chat (cascades to messages) |

### Assets — `assets.ts`
| Method · Path | Purpose |
|---|---|
| `GET /assets/all?type=&projectId=&q=&limit=&offset=` | **Global library**: every asset across all projects (playground included) with `project_name` joined in; `q` searches filename + `metadata.$.prompt`. Batch 10 pagination + prefetching. |
| `GET /assets?projectId=X&type=image&q=&limit=&offset=` | List project assets with search, type filter, limit, and offset pagination |
| `GET /assets/:id` | Single asset |
| `POST /assets/upload` | `multipart/form-data`: `file`, `projectId`, `workflowId?`, `nodeId?`, `metadata?` (≤100MB) |
| `POST /assets/base64` | `{ base64, mimeType, filename?, projectId, … }` |
| `POST /assets/url` | `{ url, projectId, … }` — **SSRF-protected** fetch (see storage service) |
| `PATCH /assets/:id/move` | `{ targetProjectId }` — relocates the file into the target project's folder and re-homes the DB row (`storage.moveAssetToProject`) |
| `DELETE /assets/:id` | Delete (file + DB record) |

> **Shared workspace:** asset routes verify the project *exists* (404), not ownership — either user can read,
> write, move, and delete assets in any project, including the playground.

### Chat presets — `presets.ts` (mounted `/api/presets`)
| Method · Path | Purpose |
|---|---|
| `GET /presets` | List all presets (shared between both users). First-ever call **seeds 3 defaults**: "Creative director", "IG caption writer", "Try-on prompt builder". |
| `POST /presets` | Create `{ name, systemInstruction }` |
| `PUT /presets/:id` | Update `{ name?, systemInstruction? }` |
| `DELETE /presets/:id` | Delete |

### AI gateway — `gemini.ts` (mounted `/api/gemini/proxy`, `requireAuth` + `aiLimiter`)
One endpoint, `POST /` with `{ method, params }`. The `method` dispatches:

| `method` | Behavior |
|---|---|
| `generateContent` | Text + image-generating Gemini models. Resolves `_imageUrl`→base64, `sanitizeForVertex`, tracks token cost, uploads generated images to storage. Returns `{ candidates, text, promptFeedback }`. Lyria-Pro handled as an LRO. |
| `generateImages` | Imagen 4. Uploads images to storage (strips raw bytes), tracks per-image cost. |
| `generateVideos` | Veo. Uses `vertexGenerateVideos` (direct v1 REST) → returns a long-running operation `{ operation, isLro:true }`. |
| `getOperation` | Polls a video/audio LRO via `vertexGetOperation`; tracks cost when `done`. Returns `{ done, response:{ generatedVideos, candidates } }`. |
| `fetchVideoFile` | Downloads a finished video (data URL / GCS / HTTP), streams it to local storage, and **records it in the `assets` table** (videos generated before this fix have files but no asset rows); returns `{ storageUrl, assetId }`. |

Errors: `504` if >58s, `422` if the prompt was blocked (no image), else `500 { error }`.

### Other legacy routes
| Route | Endpoint | Does |
|---|---|---|
| `imageProxy.ts` | `POST /proxy-image` | Fetch an image URL (validated, no localhost/private IPs) → `{ data:base64, mimeType }`. Lets the frontend load CORS-blocked GCS images. |
| `upscale.ts` | `POST /upscale/video` | `{ videoUrl, scale 1–4 }` → `upscaleVideo()` (ESRGAN). |
| `interpolate.ts` | `POST /interpolate` | `{ videoUrl, targetFps 24–120, method? }` → `interpolateVideo()` (RIFE). |
| `video.ts` | `POST /video/process` | `{ videoUrl, type, config }` → `processVideo()` (ffmpeg matte/mask). |
| `batchsize.ts` | `POST /batchsize` | `{ imageUrl, sizes[] }` (`1:1`,`4:5`,`9:16`,`16:9`,`1.91:1`) → crop/resize via ffmpeg → `{ images:[{size,url}] }`. |
| `prompts.ts` | `GET/POST/PUT/DELETE /prompts(/:id)` | CRUD for the saved-prompt library. |

---

## 🧰 services/

### `services/database.ts` — SQLite layer
- DB at `DATABASE_PATH` or `data/minn-studio.db`. `journal_mode = WAL`, `foreign_keys = ON`. Schema initialized on import (`initializeSchema()`), then **guarded migrations** run via `ensureColumn(table, column, ddl)` (PRAGMA `table_info` check → `ALTER TABLE ADD COLUMN`).
- **9 tables:** `users`, `projects`, `workflows`, `chats`, `messages`, `assets`, `usage_logs`, `prompts`, `chat_presets` (+ indexes on the common FKs). Workflow `nodes`/`edges`, project `settings`/`usage`, asset `metadata`, prompt `tags`, and **message `attachments`** (migrated column, JSON array of `MessageAttachment`) are stored as JSON text and parsed on read.
- `PLAYGROUND_PROJECT_ID = 'playground'` — the shared hidden sentinel; `projects.findAll()` excludes it.
- **Repository objects** with `create/findById/find…/update/delete`: `users`, `projects` (incl. `findAll()` for the shared workspace), `workflows`, `chats` (`update` also re-homes `project_id`), `messages` (`create` accepts attachments; `updateAttachments` rewrites them after asset moves), `assets` (incl. `findByUrl`, `findAllWithProject` for the Library, `updateLocation` for moves), `usageLogs` (`log`, `getByProjectId`), `prompts`, `chatPresets`.
- **Password hashing:** `hashPassword`/`hashPasswordAsync` = PBKDF2 100k iterations, SHA-512, 16-byte salt → `salt:hashHex`; `verifyPassword*` uses `crypto.timingSafeEqual`.
- `generateId()` = 16 random bytes hex. `trackProjectCost(projectId, cost, metadata)` looks up the owning user and writes to `usage_logs` + rolls up `projects.usage` JSON (playground spend is attributed to the sentinel's creator).

### `services/auth.ts` — JWT + seeded users
- Config: `JWT_SECRET` (required), `JWT_REFRESH_SECRET` (defaults to `JWT_SECRET + '-refresh'`), access `'1h'`, refresh `'30d'`.
- **Seeds two users** on startup if absent: `mounir.nawwar`/`nawwarmounir@gmail.com` (`USER_MOUNIR_PASSWORD`) and `rana.tadmori`/`rstadmori@gmail.com` (`USER_RANA_PASSWORD`).
- `login()` accepts username **or** email, uses a dummy-hash compare to resist user enumeration, updates `last_login`, returns `{ user, accessToken, refreshToken }`.
- `verifyToken()` (rejects refresh tokens), `refreshToken()` (issues a new access token), `authMiddleware`/`optionalAuthMiddleware`.

### `services/storage.ts` — local file storage (security-heavy)
- Root `STORAGE_PATH` (default `./storage`), public base `PUBLIC_URL_BASE` (`/storage`). Layout: `STORAGE_PATH/projects/<projectId>/<type>s/<filename>`. Max 100MB; allowlist of MIME types (images, mp4/webm, audio, pdf/json).
- **Protections:**
  - *Path traversal* — `getSafeProjectPath` validates the `projectId` format and `path.resolve`-checks the final path stays inside the projects root.
  - *Content spoofing* — magic-byte signature check that the real bytes match the claimed MIME (special-cased WEBP/WAV).
  - *SSRF* — `isValidExternalUrl` blocks non-http(s), localhost/`.internal`, cloud metadata IPs (`169.254.169.254` etc.), and private ranges; handles hex/decimal/IPv4-mapped forms and validates redirect targets manually (no auto-follow).
  - *Symlinks* — refuses to delete symlinks and checks for them before recursive deletes.
- Functions: `uploadFile`, `uploadBase64`, `uploadFromUrl`, `deleteFile(assetId,userId)` (shared workspace — userId is audit-log only), `moveAssetToProject(assetId, targetProjectId)` (collision-safe rename with copy+unlink fallback; missing source files move the record only), `deleteProjectFiles(projectId)`, `getStorageStats()`.

### `services/vertex.ts` — Vertex AI integration
- Resolves the project id from `GOOGLE_CLOUD_PROJECT` (or `VERTEX_DEV_PROJECT` in dev) → `VERTEX_PROJECT`; logs `[Vertex] Active Project: …`.
- `getVertexClient(model)` returns a `GoogleGenAI` client — **`us-central1`** for `veo-*`/`imagen-*`/tts/lyria, **`global`** otherwise.
- `sanitizeForVertex(params)` normalizes roles (`assistant`→`model`) and hoists `system` messages into `config.systemInstruction` (Vertex only accepts `user`/`model`).
- `vertexRest(url, method, body)` makes **direct v1 REST** calls with a `GoogleAuth` access token — used for **video**, because the `@google/genai` SDK is pinned to `v1beta` for it.
- `vertexGenerateVideos` (builds Veo instance/params, returns `{ name, done:false }`), `vertexGetOperation` (polls `:fetchPredictOperation`, normalizes many response shapes, converts L16 PCM audio → WAV), `vertexFetchGCS` (downloads `gs://` via authed Storage API), `vertexPredict` (synchronous predict for Lyria non-Pro / references).

### `services/costTracking.ts`
Higher-level cost helpers over `usage_logs`: `updateProjectTotalCost`, `getProjectTotalCost`, `trackProjectCost`, `getProjectUsageLogs`, `calculateProjectCost`, `getProjectCostBreakdown` (`{image,video,audio,text,total}`), `getProjectUsageStats`.

---

## 🎞️ processing/ (ffmpeg-based)

| File | Function | What it does |
|------|----------|--------------|
| `esrgan.ts` | `upscaleVideo(videoUrl, scale)` | Downloads video → extracts PNG frames → runs `realesrgan-ncnn-vulkan` (falls back to ffmpeg resize) → reassembles → base64 data URL. |
| `rife.ts` | `interpolateVideo(videoUrl, targetFps)` | Frames → `rife-ncnn-vulkan` (falls back to frame duplication) → reassemble at `targetFps` → base64. |
| `video.ts` | `processVideo(videoUrl, type, config)` | ffmpeg matte (threshold + optional blur) / mask (grayscale). |

The `*-ncnn-vulkan` binaries are optional; without them the ffmpeg fallbacks run. `ffmpeg` comes from `ffmpeg-static`.

## 🔧 utils/
| File | Exports | Purpose |
|------|---------|---------|
| `audio.ts` | `addWavHeader(pcm, sampleRate=24000, ch=1)` | Wrap raw PCM (Lyria L16) into a playable WAV buffer. |
| `imageValidation.ts` | `isValidImageUrl(url)` | http(s) only; blocks localhost/private IPs/`.internal`. |
| `imageResolver.ts` | `resolveImageUrls(contents)` | Replace `_imageUrl` parts with fetched base64 `inlineData` before Vertex calls. |
| `media.ts` | `resolveImageUrls`, `processInlineData`, `base64ToBuffer`, `getExtensionFromMimeType` | Media helpers (incl. L16→WAV). |

---

## 🔑 Environment variables

| Var | Required | Notes |
|-----|----------|-------|
| `PORT` | no (3000) | Server port |
| `NODE_ENV` | prod: yes | `production` enables prod serving, strict env checks, `aiLimiter` |
| `USER_MOUNIR_PASSWORD` / `USER_RANA_PASSWORD` | yes | Seed passwords for the two users |
| `JWT_SECRET` | yes | Access-token signing key (32+ chars) |
| `JWT_REFRESH_SECRET` | no | Defaults to `JWT_SECRET + '-refresh'` |
| `SESSION_SECRET` | prod | Legacy cookie auth |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | prod | Legacy routes |
| `AUTHORIZED_EMAILS` | no | Comma-separated allowlist |
| `GOOGLE_CLOUD_PROJECT` | for AI | Vertex project id (prod) |
| `VERTEX_DEV_PROJECT` | dev | Vertex project id fallback for local dev |
| `GOOGLE_APPLICATION_CREDENTIALS` | for AI | Path to service-account JSON (or use gcloud ADC) |
| `GOOGLE_CLOUD_REGION` | no | Region (models pin `us-central1` internally) |
| `STORAGE_PATH` | no | Media root (default `./storage`) |
| `PUBLIC_URL_BASE` | no | Public URL prefix (default `/storage`) |
| `DATABASE_PATH` | no | SQLite path (default `data/minn-studio.db`) |

See [`.env.example`](../.env.example) for a copy-paste template and [07 — Deployment](./07-DEPLOYMENT.md) for the Vertex credential setup.
