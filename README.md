# ✦ MINN STUDIO

**Minn Creative Studio** is a self-hosted, node-based AI creative pipeline for high-end image, video, and audio generation. You build pipelines visually on an infinite canvas by dragging **nodes** (prompt, Imagen, Veo, Lyria, processing, masking, output…) and wiring them together. The app orchestrates Google **Vertex AI** models behind a single Express proxy, persists everything to a local **SQLite** database, and stores generated media on the local filesystem.

It is built for a private two-person agency workspace ("Mission Control" dark aesthetic, teal accent), not a public SaaS.

> ⚠️ **Note on older docs:** earlier versions of this project used **Firebase** (Auth + Firestore + Storage). That is **gone**. Auth is now local JWT, the database is SQLite, and storage is the local disk. If you find any "Firebase / Firestore / Google OAuth" references, treat them as historical only. See [`MIGRATION_GUIDE.md`](./MIGRATION_GUIDE.md) for the migration story.

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4 |
| Canvas | React Flow (`reactflow`) |
| State | Zustand |
| UI primitives | Radix UI (dialog, dropdown-menu, avatar, …) |
| Animation | Motion (`motion/react`) + UnicornStudio background |
| Backend | Express 4 (single combined Vite + API server, `tsx`) |
| Database | SQLite via `better-sqlite3` |
| Auth | Local JWT (access + refresh), 2 seeded users |
| Storage | Local filesystem (`/storage`), served by Express static |
| AI | Google **Vertex AI** — Gemini, Imagen 4, Veo 3.1, Lyria 3 |
| Media tooling | `ffmpeg-static`, `fluent-ffmpeg`, `sharp` |
| Hosting | Oracle VPS + Cloudflare + pm2 |

---

## 🏁 Quickstart

```bash
npm install
cp .env.example .env     # then fill in passwords, JWT secrets, GOOGLE_CLOUD_PROJECT
npm run dev              # starts server.ts (Vite SPA + Express API) on PORT (default 3000)
```

For AI generation you also need Google credentials — either `gcloud auth application-default login`
or a service-account JSON pointed at by `GOOGLE_APPLICATION_CREDENTIALS`. See [`docs/07-DEPLOYMENT.md`](./docs/07-DEPLOYMENT.md).

### Key scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` / `npm start` | Run `server.ts` (frontend + API) via `tsx` |
| `npm run build` | Vite production build into `dist/` |
| `npm run lint` | Type-check (`tsc --noEmit`) |
| `npm test` | Run Vitest |

---

## 📚 Documentation

Detailed, code-accurate docs live in [`docs/`](./docs):

| Doc | What's inside |
|-----|---------------|
| [01 — Architecture](./docs/01-ARCHITECTURE.md) | Big picture, topology, request lifecycle, auth model, shared workspace |
| [02 — Backend](./docs/02-BACKEND.md) | `server.ts`, config, middleware, every API route, services, processing, env vars |
| [03 — Frontend](./docs/03-FRONTEND.md) | Build, Zustand stores, App routing, hooks, canvas, types |
| [04 — Frontend ↔ Backend](./docs/04-FRONTEND-BACKEND-CONNECTION.md) | API client, AI proxy layer, full traced request lifecycles, endpoint map |
| [05 — Nodes](./docs/05-NODES.md) | `BaseNode` shell + every registered node, handles, models |
| [06 — Design System](./docs/06-DESIGN-SYSTEM.md) | Exact color palette, tokens, typography, motion, component catalog |
| [07 — Deployment](./docs/07-DEPLOYMENT.md) | VPS/Cloudflare/pm2 topology, build & run, Vertex setup, account switch |

Operational runbooks kept at the repo root: [`MIGRATION_GUIDE.md`](./MIGRATION_GUIDE.md) (Firebase→SQLite) and `SETUP_NOTES.local.md` (private — Google account / credit switch).

---

<div align="center"><strong>MINN STUDIO</strong> · The Professional AI Creative Pipeline</div>
