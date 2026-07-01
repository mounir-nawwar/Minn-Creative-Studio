# 03 — Frontend

The frontend is a React 19 + TypeScript SPA built with Vite and styled with Tailwind 4. It lives under `src/`. This doc covers the build, state, app shell, hooks, canvas, and types. The **node catalog** is in [05 — Nodes](./05-NODES.md), the **visual/design system** in [06 — Design System](./06-DESIGN-SYSTEM.md), and the **API/AI client wiring** in [04 — Frontend ↔ Backend](./04-FRONTEND-BACKEND-CONNECTION.md).

```
src/
├── main.tsx · App.tsx · constants.ts · types.ts
├── canvas/Canvas.tsx
├── store/        useStore.ts · useProjectStore.ts · useToastStore.ts · connection-validator.ts
├── hooks/        useProject.ts · useChat.ts · useAssets.ts · useAssetExpand.tsx
├── services/     geminiService.ts · performance.ts · gemini/*
├── contexts/     ConnectionContext.tsx
├── lib/          api.ts · utils.ts · env.ts · projectContext.ts
├── types/        project.types.ts · nodeHandles.ts · handleTypes.ts · validationRules.ts · …
├── nodes/        BaseNode.tsx · ui.tsx (shared primitives) + ~49 node components
├── components/   UI components (see Design System) · ProfileMenu · ProjectPickerHeader
│                 └── ProjectCreation/  StepBasicInfo · StepVisualIdentity · StepReview · ui.tsx
├── pages/        ProjectPicker.tsx
├── styles/       design.tokens.css
└── index.css
```

> **UI foundation (redesigned):** interactive surfaces are built on **Radix UI**
> primitives (`@radix-ui/react-dialog`, `alert-dialog`, `dropdown-menu`, `avatar`,
> `tooltip`) with a calm-motion language — no scale-pop entrances, `active:scale-[0.96]`
> press feedback, and a single teal accent. Two small primitive sets keep it DRY:
> `nodes/ui.tsx` (node inputs/labels/buttons) and `components/ProjectCreation/ui.tsx`
> (wizard form fields). See [06 — Design System](./06-DESIGN-SYSTEM.md).

---

## 🏗️ Entry & build

- **`index.html`** — single `#root`, loads `/src/main.tsx` as a module. Preconnects to fonts/jsdelivr. Preloads `/scene.json`. (The old dead Firebase preconnects were removed.)
- **`src/main.tsx`** — `createRoot(...).render(<StrictMode><App/></StrictMode>)`; imports `styles/design.tokens.css` and `index.css`.
- **`vite.config.ts`** — React + Tailwind plugins, alias `@ → repo root`, `base:'/'`. `manualChunks` split vendors into `vendor-react` (react/react-dom/scheduler/react-is kept together to avoid circular-chunk crashes), `vendor-flow` (reactflow), `vendor-motion`, `vendor-misc`. `server.hmr` is disabled when `DISABLE_HMR=true` (AI Studio). `allowedHosts` includes `studio.minnagency.com`, the old Cloud Run URL, and `localhost`. Vitest config (`jsdom`, `src/test/setup.ts`).

> **Dev vs prod serving (important):** `server.ts` serves the **live Vite source**
> (HMR) only when `NODE_ENV !== 'production'`; otherwise it serves the prebuilt
> `dist/`. Because `.env` sets `NODE_ENV=production` (for the VPS), `npm run dev`
> uses **`cross-env NODE_ENV=development`** so local edits hot-reload. `npm start`
> stays production. If local changes don't show up, you're being served a stale
> `dist/` — you're not in dev mode.
- **`tsconfig.json`** — ES2022/ESNext, `@/*` path mapping, `react-jsx`.
- **`src/constants.ts`** — `API_BASE = '/api'` (relative → same origin), `RETENTION_DAYS = 30`, `AUTHORIZED_EMAILS` (the two agency emails), `isAuthorized(email)`.
- **`src/lib/env.ts`** — startup env validation with a single cached result; in production enforces a 32+ char `SESSION_SECRET` and a non-default `ADMIN_PASSWORD`.

> **`API_BASE` resolution:** it's always the relative path `/api`, so the SPA talks to whatever origin served it — the same Express process in dev and prod. There's no separate API host.

---

## 🗃️ State management (Zustand)

### `store/useStore.ts` — the workflow graph
Holds the React Flow graph and canvas UI state (`useStore.ts:32-60`):
- **State:** `nodes`, `edges`, `pendingNodeType`/`pendingNodeData` (drop-to-place UX), `isChatOpen`, `activeChatId`, `expandedAsset`, `history`, `historyIndex`.
- **React Flow bridges:** `onNodesChange` (applies changes; snapshots history on removals), `onEdgesChange`, `onConnect` (validates via `checkConnection` before `addEdge`; **blocks invalid connections** and logs why).
- **`updateNodeData(nodeId, data)`** (`useStore.ts:147`) — the canonical, immutable node update: `nodes.map(n => n.id===id ? {...n, data:{...n.data, ...data}} : n)`. Wrapped in `perfMonitor` marks; warns if an update exceeds 50ms. **Always use this to mutate node state.**
- **Mutators:** `addNode`, `deleteNode` (also prunes connected edges), `deleteEdge`, `setNodes`/`setEdges`, `setPendingNodeType`, `setChatOpen`, `setActiveChatId`, `setExpandedAsset`.
- **Undo/redo:** `saveToHistory` keeps up to `MAX_HISTORY = 50` deep-cloned snapshots; `undo`/`redo`/`canUndo`/`canRedo` walk the stack. Mutations schedule a snapshot via `setTimeout(…,0)`.

### `store/useProjectStore.ts` — project & shell UI state
`currentProject`, `activeWorkflowId`, `isSettingsOpen`, `isSidebarOpen` (default open), `settingsMode` (`'create'|'edit'`), `uploadEnabled` (default true). Actions: `setCurrentProject`, `setActiveWorkflowId`, `clearProject` (used on logout/back), `updateProject`, `openSettings`/`closeSettings`, `toggleSidebar`/`setSidebarOpen`, `setUploadEnabled`.

### `store/useToastStore.ts` — toasts
`toast.success/error/info/warning(title, message?, options?)`. Auto-dismiss ~4000ms (errors ~6000ms). Rendered by `ToastContainer`.

### `store/connection-validator.ts`
`checkConnection(connection, nodes) → { valid, message }`. Enforces handle-type compatibility (from `types/validationRules.ts` + `types/nodeHandles.ts`) and blocks feedback loops / nonsensical pairings. Used both in `onConnect` and live during drag (see `ConnectionContext`).

---

## 🧭 `App.tsx` — auth gate & screen routing

`App` is a small state machine. On mount it calls `auth.me()` (`GET /api/auth/me`); success sets `user` and caches it. It derives exactly one active screen (`App.tsx:126-130`):

```
isLoading                                   → "Connecting" spinner
!user                                       → CustomLoginPage
user & hasApiKey === false                  → "API Key Required" screen (AI Studio only)
user & no currentProject                    → ProjectPicker
user & currentProject                       → main app
```

- **Background:** the UnicornStudio `scene.json` renders behind auth screens only, fading out (and unmounting after 700ms) once you enter the main app (`App.tsx:138-174`).
- **Logout (`handleLogout`, `App.tsx:110`)** clears tokens, clears the project, and sets `user=null` **synchronously**, then fires `auth.logout()` in the background — this is the fix for the old "had to refresh to log out" bug.
- **Main app shell** (`App.tsx:246-277`) wraps everything in `ReactFlowProvider` + `ConnectionProvider`: `ProjectSidebar` | (`ProjectContextBar` → `Toolbar` → `Canvas` → `ChatDrawer` → `AssetExpandModal` → `OfflineIndicator` → `ProjectCreationOverlay`).
- Lazy-loads the heavy main-app components (`React.lazy`) so the login screen stays light.

---

## 🪝 hooks/

| Hook | Responsibility | Endpoints / polling |
|------|----------------|---------------------|
| `useProject.ts` | Projects list + current project. Converts API↔local `Project` shape (lifts nested `settings.*`), splits active vs archived, soft-delete (status `archived` + `deletedAt`), `cleanupExpiredProjects` past `RETENTION_DAYS`. | `projectsApi.*`; **polls every 5s** + on mount (only while authenticated) |
| `useChat.ts` | Chat sessions + AI replies. `sendMessage` ensures a chat exists, posts the user message, titles the chat on the first message, calls `generateText(...)` (model `gemini-3-flash-preview`, creative-director system prompt, project context, image attachments), posts the assistant reply. | `chatsApi.*` + `generateText`; **polls every 4s** |
| `useAssets.ts` | Upload & list assets. `uploadAsset(file)` (FormData), `uploadBase64(...)` (generated images), `uploadFromUrl(...)`. | `assetsApi.*`; **polls every 5s** |
| `useAssetExpand.tsx` | Thin wrapper exposing `setExpandedAsset` so output nodes can open the global full-screen preview. | — |

---

## 🔌 contexts/

### `ConnectionContext.tsx`
Provides live connection-validation state during a handle drag: `isConnecting`, `sourceInfo`, `hoveredTargetInfo` (incl. `validation`), `startConnection`, `setHoveredTarget`, `endConnection`. `BaseNode` starts a connection on drag; `Canvas` finds the nearest handle under the cursor and feeds it back so the target handle renders green (valid) or red (invalid) before the drop.

---

## 🖼️ `canvas/Canvas.tsx`

The React Flow host.
- Renders `<ReactFlow nodes edges onNodesChange onEdgesChange onConnect nodeTypes fitView>` with `Background` (dots), `Controls`, `MiniMap`. `nodeTypes` comes from `src/utils/nodeTypes.ts`.
- **Auto-save:** a `useEffect` on `[nodes, edges, activeWorkflowId]` debounces 2s, then `PUT /api/workflows/:id` with serialized nodes (`id,type,position,data` via `stripUndefined`) and edges (`id,source,target,sourceHandle,targetHandle`). Tracks a `saveStatus` (`saving`/`saved`/`error`). Note: large `data:` URLs are stripped before save to avoid bloating the row.
- **Keyboard shortcuts:** Delete/Backspace (remove selected), Ctrl/Cmd+D (duplicate, +50px offset), Ctrl+Z (undo), Ctrl+Shift+Z / Ctrl+Y (redo), Escape (cancel pending placement).
- **Closest-handle hit detection:** during a connection drag, a mousemove handler finds the nearest `.react-flow__handle` within a zoom-scaled radius (`min(56, max(14, 28*zoom))`) and validates it via `checkConnection`.
- **Ghost-node placement:** when `pendingNodeType` is set (from the sidebar), a click maps screen→flow coordinates and `addNode`s a `{ id: type-Date.now(), type, position, data }`.

---

## 🧷 Types

- **`src/types.ts`** — the `NodeType` string-union (all node kinds), `NodeConfig` (open-ended per-node config bag: `url,fileName,prompt,negativePrompt,seed,aspectRatio,numberOfImages,model,…`), and `WorkflowNodeData` (`label,type,config?,output?,outputs?,error?,isRunning?,triggerRun?,progress?`).
- **`src/types/project.types.ts`** — `Project` (brand identity: `primaryColor/secondaryColor/accentColor`, `fontStyle`, `aiInstructions`, `styleKeywords`, `visualMood[]`, `platforms[]`, `outputFormats[]`, soft-delete fields, `usage`, `collaborators`), `Asset`, and the `ProjectStatus`/`FontStyle`/`AssetType` unions.
- **`src/types/nodeHandles.ts`** — `NODE_HANDLES`: the input/output handle definitions per node type (id, handle `type`, label). This drives both rendering and connection validation. See [05 — Nodes](./05-NODES.md) for the per-node tables.
- **`src/types/handleTypes.ts`** — `HandleDefinition` and the handle `HandleType` union (`image,video,audio,prompt,text,number,seed,mask,motion,array,boolean,json,unknown`).
- **`src/types/validationRules.ts`** — `CONNECTION_VALIDATION_RULES` (which source types each target accepts; blocked pairs).

## 🛠️ `src/lib/utils.ts`
- `cn(...)` — `clsx` + `tailwind-merge`.
- `stripUndefined(obj)` — recursively drops `undefined`/functions/non-finite numbers/non-plain objects so node data is safely serializable before save.
- `downloadFile(url, filename)` — robust download: decodes `data:` URLs, **proxies `storage.googleapis.com` through `/api/proxy-image`** (CORS), else fetches directly; falls back to `window.open` on error.
- `calcHandlePosition(index, total)` — handle vertical distribution (1→`50%`, 2→`33/66%`, 3→`25/50/75%`, 4→`20/40/60/80%`, 5+ linear 20–80%).

## 🧾 `src/lib/projectContext.ts`
`buildProjectContext(project)` builds the one **project brief** string injected into
every AI generation. It includes only the non-empty fields — name, type/subtype,
client + industry, description, target audience, brand tone, visual mood, brand
colors, style keywords, "avoid" (negative) keywords, and the AI master instructions.
Centralizing it here means the whole creative brief reaches the model (not just a
couple of fields). Consumed by `ImagenNode`, `VeoNode`, `LLMNode`,
`PromptEnhancerNode`, and `useChat` — see [04](./04-FRONTEND-BACKEND-CONNECTION.md).

## 📓 Notes for AI agents
`src/AGENTS.md` documents the connection-validation system; `src/AGENTS-REVIEW.md` is a candid self-review flagging known issues (some `any` types, O(n²) validation, unmemoized context value, silent save failures, missing ARIA). Treat the latter as a backlog, not current behavior guarantees.
