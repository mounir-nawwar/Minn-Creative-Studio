# 01 — Architecture

## 🎯 What it is

Minn Creative Studio is a **visual, node-based AI creative studio**. The user works on an infinite [React Flow](https://reactflow.dev/) canvas, dropping **nodes** and connecting their handles to form a directed graph (a "workflow"). Nodes range from simple inputs (a prompt, a number, an uploaded image) to heavy AI generators (Imagen, Veo, Lyria) to processing utilities (blur, crop, upscale, mask) to a terminal **Output** node that collects and downloads results.

It is a **single-tenant, two-user private tool** for an agency, not a public product — hence the hardcoded accounts and the deliberately permissive CORS.

## 🧱 Tech stack

| Concern | Choice |
|--------|--------|
| UI | React 19 + TypeScript + Vite 6 |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`) + CSS custom-property design tokens |
| Canvas | `reactflow` 11 |
| Client state | Zustand 5 (`useStore`, `useProjectStore`, `useToastStore`) |
| UI primitives | **Radix UI** (`dialog`, `alert-dialog`, `dropdown-menu`, `avatar`, `tooltip`) |
| Animation | `motion` (Motion / ex-Framer Motion) + `unicornstudio-react` animated background |
| Server | Express 4, run with `tsx` (TypeScript, no build step for the server) |
| DB | SQLite via `better-sqlite3` (`data/minn-studio.db`, WAL mode) |
| Auth | JWT (`jsonwebtoken`) — access token 1h, refresh token 30d |
| File storage | Local filesystem under `STORAGE_PATH`, served at `/storage` |
| AI | Google **Vertex AI** (`@google/genai` + `google-auth-library`) |
| Media | `ffmpeg-static` + `fluent-ffmpeg`, `sharp` for images |

## 🗺️ System topology

```
                         ┌────────────────────────── Browser (SPA) ──────────────────────────┐
                         │  React 19 + React Flow canvas + Zustand stores                     │
                         │  lib/api.ts (REST client)   services/gemini/* (AI proxy client)    │
                         └───────────────┬─────────────────────────────┬─────────────────────┘
                                         │  fetch /api/*               │ fetch /storage/* (media)
                                         ▼                             ▼
   ┌──────────────────────────────── server.ts (Express, port 3000) ─────────────────────────────┐
   │  helmet → CORS → json/urlencoded(50mb) → cookie-parser                                       │
   │                                                                                              │
   │  /api/auth /api/projects /api/workflows /api/chats /api/assets     ── "new" routes (SQLite)  │
   │  /api/gemini/proxy /api/proxy-image /api/upscale /api/interpolate                            │
   │  /api/video /api/batchsize /api/prompts                            ── "legacy" routes (AI)   │
   │                                                                                              │
   │  Dev:  Vite middleware serves the SPA   |   Prod: static dist/ + SPA fallback                │
   │  /storage  →  express.static(STORAGE_PATH)                                                   │
   └───────────────┬───────────────────────────────────┬───────────────────────┬────────────────┘
                   ▼                                   ▼                       ▼
         SQLite (better-sqlite3)            Local filesystem            Google Vertex AI
         data/minn-studio.db                STORAGE_PATH/projects/...   Gemini · Imagen · Veo · Lyria
```

**Deployment:** the whole thing runs as one Node process (`server.ts`) on an **Oracle VPS** (`150.230.52.15`), behind **Cloudflare** (domain `studio.minnagency.com`), kept alive by **pm2** (process name `minn-studio`). See [07 — Deployment](./07-DEPLOYMENT.md).

## 🧩 The single-server model

`server.ts` is the only entry point and serves **both** the frontend and the API:

- It mounts an `apiRouter` under `/api` with two families of routes:
  - **"New" routes** (`auth`, `projects`, `workflows`, `chats`, `assets`) — the SQLite + local-storage data layer that replaced Firebase.
  - **"Legacy" routes** (`gemini/proxy`, `proxy-image`, `upscale`, `interpolate`, `video`, `batchsize`, `prompts`) — Vertex AI generation and media processing. (They predate the migration; "legacy" only refers to their age, not deprecation — `gemini/proxy` is the core generation gateway.)
- It serves generated media from `STORAGE_PATH` at `/storage` via `express.static`.
- In **dev** it boots a Vite dev server in middleware mode (HMR, instant TS). In **production** it serves the pre-built `dist/` and falls back all unknown routes to `index.html` (SPA routing).

Because the SPA and API share an origin, auth is **Bearer-token only** (no cookies needed for the new flow) and CORS simply reflects the origin. See [02 — Backend](./02-BACKEND.md).

## 🔐 Auth model (at a glance)

- Exactly **two users**, seeded on first boot from env passwords:
  - `mounir.nawwar` / `nawwarmounir@gmail.com`
  - `rana.tadmori` / `rstadmori@gmail.com`
- Login returns an **access token (1h)** and a **refresh token (30d)**, both stored in `localStorage`.
- Every protected API call sends `Authorization: Bearer <accessToken>`. On a `401`, the client transparently calls `/api/auth/refresh` and retries once.
- Passwords are hashed with **PBKDF2** (100k iterations, SHA-512, per-user salt) and compared in constant time.

Full detail in [02 — Backend → Services → auth](./02-BACKEND.md) and the traced login flow in [04](./04-FRONTEND-BACKEND-CONNECTION.md).

## 👥 Shared workspace model

There is **one shared workspace**: every authenticated user sees **all** projects, not just their own. This is implemented server-side by `projects.findAll()` (a plain `SELECT * FROM projects`) rather than filtering by `user_id`. The frontend compares each project's `user_id` to the current user and visually marks the others as "shared". Workflows, chats, assets, and usage are still associated with the user who created them.

## 🔁 Request lifecycle (high level)

A typical AI generation:

1. A node (e.g. `ImagenNode`) calls a function in `src/services/gemini/*` (e.g. `generateImage`).
2. That calls `callBackend(method, params)` → `POST /api/gemini/proxy` with a `{ method, params }` envelope and the Bearer token.
3. The backend `gemini.ts` route authenticates, resolves any image URLs to base64, calls **Vertex AI**, tracks the cost in `usage_logs`, uploads generated media to local storage, and returns a result.
4. The node writes the result into its data via `updateNodeData(...)` in the Zustand store; the canvas re-renders.
5. After a 2-second debounce, `Canvas.tsx` auto-saves the whole graph with `PUT /api/workflows/:id`.

Long-running media (Veo video, Lyria Pro audio) returns an **operation** that the client polls via the same proxy (`method: 'getOperation'`) until `done`, then fetches the file (`method: 'fetchVideoFile'`). The step-by-step traces are in [04 — Frontend ↔ Backend](./04-FRONTEND-BACKEND-CONNECTION.md).

## 📁 Top-level layout

```
Minn-Creative-Studio/
├── server.ts                # Express entry — mounts API + serves SPA
├── backend/                 # Server code (config, middleware, routes, services, processing, utils)
├── src/                     # React frontend (App, canvas, nodes, components, store, hooks, services)
├── data/minn-studio.db      # SQLite database (created at runtime)
├── storage/                 # Generated/uploaded media (created at runtime)
├── dist/                    # Production build output
├── public/scene.json        # UnicornStudio animated background scene
├── docs/                    # ← you are here
├── MIGRATION_GUIDE.md       # Firebase → SQLite migration notes
└── SETUP_NOTES.local.md     # Private runbook (Vertex account / credit switch)
```
