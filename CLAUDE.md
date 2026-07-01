# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in this repo. Read this first.

## What this is

**Minn Creative Studio** — a self-hosted, node-based AI creative studio. Users build image/video/audio
generation pipelines on a React Flow canvas by wiring **nodes** together. It's a private two-user agency
tool, not a public SaaS. One Node process (`server.ts`) serves both the React SPA and the Express API.

## ⚠️ The #1 thing to know: the docs you may have trained on are stale

Older docs (and any lingering comments) describe **Firebase + Google OAuth + a Gemini API key**. **All of that
is gone.** The current architecture is:

- **Auth:** local **JWT** (access 1h / refresh 30d), 2 hardcoded users (`mounir.nawwar`, `rana.tadmori`), PBKDF2 hashing.
- **Database:** **SQLite** via `better-sqlite3` (`data/minn-studio.db`, WAL).
- **Storage:** **local filesystem** under `STORAGE_PATH`, served at `/storage`.
- **AI:** **Google Vertex AI only** (Gemini, Imagen 4, Veo 3.1, Lyria 3) behind one proxy route.

If you see "Firebase/Firestore/onSnapshot" anywhere, treat it as dead leftover, not a pattern to follow.

## Authoritative documentation

Full, code-verified docs live in [`docs/`](./docs). Consult them before large changes:

| Doc | Use when |
|-----|----------|
| `docs/01-ARCHITECTURE.md` | Big picture, topology, auth & shared-workspace model |
| `docs/02-BACKEND.md` | Routes, services, SQLite schema, pricing, env vars |
| `docs/03-FRONTEND.md` | Zustand stores, App routing, hooks, Canvas |
| `docs/04-FRONTEND-BACKEND-CONNECTION.md` | API client, AI proxy, traced request lifecycles |
| `docs/05-NODES.md` | `BaseNode` + every node, handles, models |
| `docs/06-DESIGN-SYSTEM.md` | Exact colors, tokens, typography, components |
| `docs/07-DEPLOYMENT.md` | VPS/Cloudflare/pm2, build/run, Vertex setup |

## Commands

```bash
npm run dev      # run server.ts (Vite SPA + Express API) via tsx — default port 3000
npm start        # same entry, used in production (serves dist/)
npm run build    # Vite production build → dist/
npm run lint     # tsc --noEmit (type-check; there is no ESLint)
npm test         # vitest run
```

There is **no build step for the server** — it runs TypeScript directly through `tsx`.

## Tech stack

React 19 · TypeScript · Vite 6 · Tailwind 4 · React Flow · Zustand · Motion · Express 4 · better-sqlite3 ·
jsonwebtoken · `@google/genai` (Vertex) · ffmpeg-static / fluent-ffmpeg · sharp.

## Layout

```
server.ts              # Express entry: mounts /api, serves SPA, /storage static
backend/               # config · middleware · routes · services · processing · utils
src/
  App.tsx              # auth gate + 5-screen routing state machine
  canvas/Canvas.tsx    # React Flow host + 2s debounced auto-save
  nodes/               # BaseNode.tsx + ~49 registered node components
  components/          # UI (sidebar, toolbar, chat, modals, …)
  store/               # Zustand: useStore (graph), useProjectStore, useToastStore
  hooks/               # useProject, useChat, useAssets (REST + polling)
  services/gemini/     # AI client → POST /api/gemini/proxy
  lib/api.ts           # REST client (auth/projects/workflows/chats/assets) + token refresh
  types/               # NodeType, NODE_HANDLES, validation rules
docs/                  # the authoritative documentation
data/  storage/        # runtime SQLite + media (gitignored)
```

## Conventions & rules

- **Node state is immutable.** Always update a node via `updateNodeData(nodeId, partial)` from `src/store/useStore.ts`.
  Never mutate `node.data` directly. New node data must stay JSON-serializable (the canvas auto-saves it).
- **All AI calls go through `src/services/gemini/*`** → `callBackend(method, params)` → `POST /api/gemini/proxy`.
  Don't call Vertex from the frontend or add new ad-hoc AI endpoints; extend the proxy's `method` switch in `backend/routes/gemini.ts`.
- **New nodes:** create the component in `src/nodes/` (wrap it in `<BaseNode>`), add handle defs to
  `src/types/nodeHandles.ts`, and **register it in `src/utils/nodeTypes.ts`** (unregistered files won't appear on the canvas).
- **Auth:** protected backend routes use `authMiddleware`; the frontend attaches `Authorization: Bearer` via
  `authHeader()` and auto-refreshes on 401 in `lib/api.ts`. Keep that flow intact.
- **Shared workspace is intentional:** `projects.findAll()` returns every user's projects. Don't "fix" it to filter by `user_id`.
- **Styling:** dark theme, single teal accent `#0097A7`. Reuse the tokens in `src/styles/design.tokens.css`
  and the palette in `docs/06-DESIGN-SYSTEM.md`; don't introduce new accent colors.
- **Cost tracking:** anything that calls a paid model should flow through `trackProjectCost` /
  `backend/config/pricing.ts`. Update `MODEL_PRICING` when adding a model.
- **Secrets:** never hardcode credentials. Config comes from `.env` (see `.env.example` and `docs/02-BACKEND.md`).
  `data/`, `storage/`, `.env`, and `SETUP_NOTES.local.md` are gitignored — keep them that way.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `refactor:`…). Don't commit or push unless asked.

## Gotchas

- **Vertex regions:** video/Imagen/Lyria/TTS pin `us-central1`; text uses `global` (see `backend/services/vertex.ts`).
  Veo uses **direct v1 REST** (`vertexRest`) because the SDK is pinned to `v1beta` for video.
- **Long-running media:** Veo/Lyria-Pro return an operation the client **polls** (`getOperation`) then fetches
  (`fetchVideoFile`). Don't expect a synchronous result.
- **Large payloads:** JSON body limit is 50mb (base64 media flows through JSON); the proxy times out at ~58s.
- **GCS images are CORS-blocked** — load them via `POST /api/proxy-image` (`urlToBase64` / `downloadFile`).
- **Two markdown runbooks at root:** `MIGRATION_GUIDE.md` (Firebase→SQLite history) and `SETUP_NOTES.local.md`
  (private — how to switch the Vertex Google account when the $300 credit runs out).
- Windows dev host; production is an Oracle VPS behind Cloudflare, kept alive by pm2 (`minn-studio`).
