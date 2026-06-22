# Minn Creative Studio - Firebase to SQLite Migration Guide

## Overview
This migration replaces Firebase (Auth, Firestore, Storage) with a self-hosted SQLite database and local file storage. This eliminates external dependencies and hosting costs while keeping all functionality intact.

## What Changed

### 1. Authentication
- **Before**: Firebase Auth with Google OAuth
- **After**: Local JWT-based auth with username/password
- **Users**: Exactly two hardcoded accounts:
  - `mounir.nawwar` / `nawwarmounir@gmail.com`
  - `rana.tadmori` / `rstadmori@gmail.com`

### 2. Database
- **Before**: Firebase Firestore (NoSQL)
- **After**: SQLite (relational database stored in a single file)
- **Location**: `data/minn-studio.db`

### 3. File Storage
- **Before**: Firebase Storage (cloud)
- **After**: Local filesystem with Nginx/Express serving
- **Location**: `storage/` directory

### 4. AI Models
- **Unchanged**: Still uses Google Vertex AI (Gemini, Veo, Imagen, Lyria)
- **Requires**: Google Cloud service account with Vertex AI access

---

## Setup Instructions

### Step 1: Install Dependencies
```bash
cd Minn-Creative-Studio
npm install better-sqlite3
```

### Step 2: Configure Environment
Copy `.env.example.new` to `.env` and set:

```bash
# User Passwords (CHANGE THESE!)
USER_MOUNIR_PASSWORD=your_secure_password_here
USER_RANA_PASSWORD=your_secure_password_here

# JWT Secret (generate a random string)
JWT_SECRET=some-random-string-at-least-32-chars

# Vertex AI (for AI models)
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_REGION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### Step 3: Replace Server
```bash
# Backup old server
mv server.ts server-old.ts

# Use new server
mv server-new.ts server.ts
```

### Step 4: Update Frontend
Replace Firebase imports with API client in:
- `src/App.tsx`
- `src/components/Toolbar.tsx`
- `src/components/Sidebar/WorkflowsTab.tsx`
- `src/components/Sidebar/ChatsTab.tsx`
- `src/hooks/useFirebaseChat.ts`
- `src/hooks/useProject.ts`
- `src/hooks/useAssets.ts`
- `src/canvas/Canvas.tsx`

### Step 5: Build and Run
```bash
# Development
npm run dev

# Production
NODE_OPTIONS="--max-old-space-size=1024" npm run build
npm start
```

---

## Vertex AI Setup (for AI Models)

### Option 1: Service Account JSON
1. Go to Google Cloud Console → IAM & Admin → Service Accounts
2. Create a service account with Vertex AI User role
3. Create a JSON key and download it
4. Set `GOOGLE_APPLICATION_CREDENTIALS` in `.env` to the file path

### Option 2: Application Default Credentials (for GCP VMs)
```bash
gcloud auth application-default login
```

### Required Vertex AI APIs
Enable these in your Google Cloud project:
- Vertex AI API
- Cloud Vision API (for image processing)
- Cloud Storage (if using GCS for model outputs)

---

## Database Schema

### Tables
1. **users** - User accounts
2. **projects** - User projects
3. **workflows** - Saved node graphs
4. **chats** - Chat sessions
5. **messages** - Chat messages
6. **assets** - Uploaded/generated files
7. **usage_logs** - Cost tracking

### Migrating Existing Data
If you have data in Firebase you want to keep:
1. Export from Firebase Console
2. Write a migration script to insert into SQLite
3. The schema is designed to match Firebase structure

---

## API Endpoints

### Auth
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Get current user

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Workflows
- `GET /api/workflows` - List workflows
- `POST /api/workflows` - Create workflow
- `GET /api/workflows/:id` - Get workflow
- `PUT /api/workflows/:id` - Update workflow
- `DELETE /api/workflows/:id` - Delete workflow

### Chats
- `GET /api/chats` - List chats
- `POST /api/chats` - Create chat
- `GET /api/chats/:id` - Get chat with messages
- `POST /api/chats/:id/messages` - Add message
- `DELETE /api/chats/:id` - Delete chat

### Assets
- `GET /api/assets` - List assets
- `POST /api/assets/upload` - Upload file
- `POST /api/assets/base64` - Upload base64
- `DELETE /api/assets/:id` - Delete asset

---

## Frontend Migration

### Replace Firebase SDK with API Client

**Before:**
```typescript
import { db, auth } from '../firebase';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';

const q = query(collection(db, 'workflows'), where('userId', '==', uid));
onSnapshot(q, (snapshot) => { ... });
```

**After:**
```typescript
import { workflowsApi } from '../lib/api';

const workflows = await workflowsApi.list(projectId);
// Or use polling/SSE for real-time updates
```

### Real-time Updates
Firebase's `onSnapshot` provided real-time updates. With SQLite:
- Use polling: `setInterval(() => fetchData(), 5000)`
- Or implement WebSockets (future enhancement)
- Or use Server-Sent Events (SSE)

---

## Troubleshooting

### Database locked
SQLite uses file locking. Ensure only one process accesses the DB at a time.

### Out of memory during build
Use: `NODE_OPTIONS="--max-old-space-size=1024" npm run build`

### Assets not loading
Check that `STORAGE_PATH` is correct and Nginx/Express serves `/storage` route.

### Vertex AI errors
Verify:
1. Service account has correct permissions
2. APIs are enabled
3. Region matches model availability

---

## Files Changed

### New Files
- `backend/services/database.ts` - SQLite database service
- `backend/services/auth.ts` - JWT authentication service
- `backend/services/storage.ts` - Local file storage service
- `backend/routes/auth-new.ts` - Auth API routes
- `backend/routes/projects.ts` - Projects API routes
- `backend/routes/workflows.ts` - Workflows API routes
- `backend/routes/chats.ts` - Chats API routes
- `backend/routes/assets.ts` - Assets API routes
- `src/lib/api.ts` - Frontend API client
- `server-new.ts` - Updated server

### Files to Update
- `src/App.tsx` - Replace Firebase auth
- `src/firebase.ts` - Remove or repurpose
- `src/components/Toolbar.tsx` - Use API client
- `src/hooks/*` - Update all hooks

### Files to Remove (after migration)
- `firebase-applet-config.json`
- Firebase-related dependencies in `package.json` (optional, keep for Vertex AI SDK)

---

## Cost Comparison

### Firebase (Before)
- Auth: Free tier (but limited)
- Firestore: Pay per read/write
- Storage: Pay per GB stored + bandwidth
- **Estimated monthly**: $10-50+ depending on usage

### Self-Hosted (After)
- Auth: Free (local)
- Database: Free (SQLite file)
- Storage: Free (local disk) + backup costs
- Vertex AI: Pay per API call only
- **Estimated monthly**: $0-20 (Vertex AI only)

---

## Security Notes

1. **Change default passwords** in `.env`
2. **Use strong JWT secret** (32+ random characters)
3. **Secure the VPS** with firewall rules
4. **Backup the SQLite database** regularly
5. **Restrict API access** with rate limiting (already configured)
6. **Use HTTPS** in production (Let's Encrypt with Nginx)
