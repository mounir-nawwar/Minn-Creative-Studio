# 04 — Frontend ↔ Backend Connection

This is the glue: how the React SPA talks to the Express API. Two client layers do all of it:

1. **`src/lib/api.ts`** — the REST client for the data layer (auth, projects, workflows, chats, assets).
2. **`src/services/gemini/*`** — the AI client that funnels every generation through the single `POST /api/gemini/proxy` gateway.

Both attach the JWT and both target `API_BASE = '/api'` (same origin — see [03](./03-FRONTEND.md)).

---

## 🔑 `lib/api.ts` — REST client

### Token handling
- Tokens live in `localStorage` (`accessToken`, `refreshToken`) and module-level vars. `setTokens`/`clearTokens` keep both in sync. `authHeader()` returns `{ Authorization: 'Bearer …' }` or `{}` when logged out.
- **`apiRequest<T>(endpoint, options)`** is the shared fetch wrapper (`api.ts:117`):
  - Sets `Content-Type: application/json` + `authHeader()`.
  - On **`401`**: if a refresh token exists, calls `auth.refreshToken(...)`, and on success **retries the original request once** with the new token; otherwise `clearTokens()` and throws `Unauthorized`.
  - Non-OK → throws `Error(error.error || 'API Error: <status>')`.

### Sub-clients
| Object | Methods → endpoints |
|--------|---------------------|
| `auth` | `login`→`POST /auth/login` (stores tokens), `logout`→`POST /auth/logout`, `refreshToken`→`POST /auth/refresh`, `me`→`GET /auth/me`, plus `getCurrentUser`/`setCurrentUser` (localStorage cache) |
| `projectsApi` | `list`/`get`/`create`/`update`/`delete`/`getUsage` → `/projects…` |
| `workflowsApi` | `list(projectId?)`/`get`/`create`/`update`/`delete` → `/workflows…` |
| `chatsApi` | `list`/`get`/`getMessages`/`create`/`addMessage`/`update`/`delete` → `/chats…` |
| `assetsApi` | `list`/`get`/`upload` (FormData, raw `fetch` with `authHeader`)/`uploadBase64`/`uploadFromUrl`/`delete` → `/assets…` |

`login` and `refreshToken` use raw `fetch` (not `apiRequest`) because they manage tokens themselves. `assets.upload` uses raw `fetch` so the browser sets the `multipart/form-data` boundary.

---

## 🤖 `services/gemini/*` — AI proxy client

`src/services/geminiService.ts` is a barrel that re-exports from `src/services/gemini/`:
- `client.ts` — transport (`callBackend`, `urlToBase64`)
- `textService.ts` — `generateText`, `suggestNodeConfig`, `fillProjectData`
- `imageService.ts` — `generateImage`, `generateMask`, `upscaleImage`, …
- `videoService.ts` — `generateVideo`
- `audioService.ts` — `generateAudio`

### `client.ts`
- **`callBackend(method, params, signal?, retryCount=0)`** — `POST /api/gemini/proxy` with `{ method, params }` + `authHeader()`. Unwraps `{ success, data }`. **Retries** retryable failures (timeouts, 5xx, quota) up to `MAX_RETRIES = 3` with exponential backoff (`1000 * 2^retryCount`); does **not** retry client errors (4xx, "blocked", "invalid"). Classifies errors into friendly messages.
- **`urlToBase64(url)`** — if the URL is `storage.googleapis.com` (CORS-blocked), proxies through `POST /api/proxy-image`; otherwise fetches directly and converts to a data URL. Used to inline images/frames before sending them to Vertex.

### Which models each service uses
| Service fn | Default model(s) | Backend `method` |
|------------|------------------|------------------|
| `generateText` | `gemini-3-flash-preview` (chat), other Gemini text models | `generateContent` |
| `generateImage` | `imagen-4.*` → `generateImages`; `gemini-*-image` → `generateContent` | both |
| `generateVideo` | `veo-3.1-*` | `generateVideos` → `getOperation` → `fetchVideoFile` |
| `generateAudio` | `lyria-3-*` | `generateContent`/`getOperation` (Pro is an LRO) |

---

## 🔁 Traced lifecycles

### 1) Login
1. `CustomLoginPage` calls `auth.login(username, password)` → `POST /api/auth/login`.
2. Backend `auth-new.ts` → `services/auth.ts login()`: finds user by username/email, PBKDF2 constant-time verify, updates `last_login`, signs access (1h) + refresh (30d) JWTs.
3. Client `setTokens(...)` stores both in `localStorage`; `App` sets `user`, caches it, and renders `ProjectPicker`.
4. Every later request carries `Authorization: Bearer <accessToken>`; on expiry the 401→refresh→retry path in `apiRequest` keeps the session alive for 30 days.

### 2) Image generation (ImagenNode)
1. User clicks generate → `ImagenNode` calls `generateImage({ prompt, model:'imagen-4.0-generate-001', aspectRatio, sampleCount, projectId, … })`.
2. `imageService` → `callBackend('generateImages', params)` → `POST /api/gemini/proxy`.
3. Backend `gemini.ts`: `requireAuth` + `aiLimiter`, builds the Vertex Imagen call via `getVertexClient(model)` (region `us-central1`), runs it, **uploads each image to local storage** (so the response carries a `/storage/...` URL, not megabytes of base64), and `trackProjectCost(...)` logs the per-image cost.
4. Response bubbles back as image URL(s); the node calls `updateNodeData(id, { output, outputs, isRunning:false })`.
5. 2s later `Canvas` auto-saves the graph: `PUT /api/workflows/:id`.

### 3) Video generation (VeoNode / ImageToVideoNode) — long-running
1. `generateVideo({ model:'veo-3.1-fast-generate-001', prompt, image?, config })`. Start/end frames are inlined via `urlToBase64`.
2. `callBackend('generateVideos', …)` → backend `vertexGenerateVideos` (direct v1 REST) returns an **operation** `{ operation, isLro:true }`.
3. The client **polls**: every 5s it calls `callBackend('getOperation', { operation, model, config })` (backend `vertexGetOperation` hits `:fetchPredictOperation`). Up to `MAX_POLL_COUNT = 120` (~10 min) before timing out; `onProgress` updates the node's elapsed timer.
4. When `done`, for each generated video the client calls `callBackend('fetchVideoFile', { url })` → backend downloads from GCS and streams to local storage → `{ storageUrl }`.
5. Cost is tracked on completion (per-second × duration, +audio); the node stores the `storageUrl`(s).

### 4) Chat message
1. `useChat.sendMessage(text, assets)` creates a chat if needed (`POST /api/chats`), posts the user message (`POST /api/chats/:id/messages`), and titles the chat on the first message.
2. It calls `generateText({ prompt:text, model:'gemini-3-flash-preview', systemInstruction:'creative director…', imageUrls, projectContext, projectId })` → `callBackend('generateContent', …)` → `/api/gemini/proxy` → Vertex.
3. The assistant reply is posted (`POST /api/chats/:id/messages`, role `assistant`); the 4s poll refreshes the message list.

---

## 🗺️ Endpoint → caller map

| Method · Endpoint | Frontend caller |
|---|---|
| `POST /api/auth/login` | `auth.login` (CustomLoginPage) |
| `POST /api/auth/logout` | `auth.logout` (App `handleLogout`) |
| `POST /api/auth/refresh` | `apiRequest` 401 handler |
| `GET /api/auth/me` | `auth.me` (App mount) |
| `GET/POST/PUT/DELETE /api/projects…` | `projectsApi` (useProject) |
| `GET /api/projects/:id/usage` | `projectsApi.getUsage` |
| `GET/POST/PUT/DELETE /api/workflows…` | `workflowsApi` (Canvas auto-save = `PUT`) |
| `GET/POST/PUT/DELETE /api/chats…` | `chatsApi` (useChat) |
| `GET/POST/DELETE /api/assets…` | `assetsApi` / `useAssets` |
| `POST /api/gemini/proxy` | `callBackend` (all `services/gemini/*`) |
| `POST /api/proxy-image` | `urlToBase64`, `downloadFile` |
| `POST /api/upscale/video` | image/video upscaler nodes |
| `POST /api/interpolate` | FrameInterpolatorNode |
| `POST /api/video/process` | video matte/mask nodes |
| `POST /api/batchsize` | BatchOutputSizerNode |
| `GET/POST/PUT/DELETE /api/prompts…` | PromptLibraryNode / prompt library |
