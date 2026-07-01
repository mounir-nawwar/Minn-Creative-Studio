# 07 — Deployment

Minn Creative Studio runs as a **single Node process** (`server.ts`) that serves both the SPA and the API. There is no separate frontend host, no managed database, and no object store — just one VPS with a SQLite file and a `storage/` directory.

## 🌐 Topology

```
   Browser ──HTTPS──▶ Cloudflare ──▶ Oracle VPS (150.230.52.15) ──▶ pm2: "minn-studio" (node server.ts :3000)
                      (studio.minnagency.com)                         ├─ SQLite  data/minn-studio.db
                                                                      ├─ Files   storage/projects/...
                                                                      └─ Google Vertex AI (ADC / service account)
```

- **Host:** Oracle Cloud VPS, public IP `150.230.52.15`, user `ubuntu`, app at `~/Minn-Creative-Studio`.
- **Edge:** Cloudflare in front of `studio.minnagency.com` (TLS + proxy).
- **Process manager:** pm2, process name **`minn-studio`**.
- **AI:** Google Vertex AI, authenticated via gcloud Application Default Credentials (ADC) or a service-account JSON.

## 🏗️ Build & run

```bash
# Install
npm install

# Production build (frontend → dist/). Cap memory on the small VPS:
NODE_OPTIONS="--max-old-space-size=1024" npm run build

# Start (serves dist/ + /api). With pm2:
pm2 start npm --name minn-studio -- start      # first time
pm2 restart minn-studio --update-env           # after env changes
pm2 logs minn-studio --lines 50
```

`npm start` runs `tsx server.ts`. With `NODE_ENV=production` the server serves the prebuilt `dist/` and falls back unknown routes to `index.html`; otherwise it boots a Vite dev server in middleware mode.

## 🔐 Environment (`.env`)

Copy `.env.example` → `.env` and set at minimum:

```bash
NODE_ENV=production
PORT=3000

# The two app users
USER_MOUNIR_PASSWORD=...
USER_RANA_PASSWORD=...

# JWT (32+ chars, distinct)
JWT_SECRET=...
JWT_REFRESH_SECRET=...
SESSION_SECRET=...          # legacy cookie auth
ADMIN_USERNAME=admin        # legacy routes
ADMIN_PASSWORD=...

# Vertex AI
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_REGION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json   # or use gcloud ADC

# Storage
STORAGE_PATH=/home/ubuntu/storage
PUBLIC_URL_BASE=/storage
```

See the full variable reference in [02 — Backend → Environment variables](./02-BACKEND.md).

## ☁️ Vertex AI credentials

Two ways to authenticate (the app uses `google-auth-library`):

1. **Service account JSON** — create a service account with the *Vertex AI User* role, download a key, point `GOOGLE_APPLICATION_CREDENTIALS` at it.
2. **Application Default Credentials (headless VPS)**:
   ```bash
   gcloud auth login
   gcloud auth application-default login
   gcloud auth application-default set-quota-project YOUR_PROJECT_ID
   gcloud services enable aiplatform.googleapis.com --project=YOUR_PROJECT_ID
   ```

The active project is read from `GOOGLE_CLOUD_PROJECT` (logged on boot as `[Vertex] Active Project: …`). Video/Imagen/Lyria/TTS calls pin region `us-central1`; text uses `global`.

> **403 on generation after switching accounts** almost always means the Vertex AI API isn't enabled on the new project, or billing isn't linked.

## 💾 Persistence & backups

- **Database:** the single SQLite file `data/minn-studio.db` (WAL mode → also `-wal`/`-shm` sidecars). Back it up by copying these files while the app is briefly stopped, or use `sqlite3 .backup`.
- **Media:** everything under `STORAGE_PATH` (`storage/projects/<projectId>/…`). Back up the directory.
- The DB and `storage/` are runtime artifacts and should be **gitignored** (they are).

## 🔁 Related runbooks

- **`SETUP_NOTES.local.md`** (repo root, private — not committed): step-by-step for moving Vertex to a **new Google account/project** when the $300 free credit runs out. No code/nginx/Cloudflare changes — only `GOOGLE_CLOUD_PROJECT` + gcloud ADC and a `pm2 restart minn-studio --update-env`.
- **`MIGRATION_GUIDE.md`** (repo root): the historical Firebase → SQLite/local-storage/JWT migration, including the data model and the rationale.

## ✅ Post-deploy smoke check

1. `pm2 logs minn-studio` shows: `✅ Minn Creative Studio running…`, `✅ SQLite database schema initialized`, `[Vertex] Active Project: …`.
2. `GET https://studio.minnagency.com/api/health` → `{ "status": "ok" }`.
3. Log in as one user, create a project, run an Imagen node → image appears and is served from `/storage/...`.
4. Confirm the second user sees the same project (shared workspace).
