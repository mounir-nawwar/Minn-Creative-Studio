# Performance & Speed Optimizations Plan

This document outlines the architecture, execution steps, and verification procedures for the 4 core performance optimizations in Minn Creative Studio.

---

## **Overview of Optimizations**

| Phase | Optimization | Impact Area | Target Gain |
|---|---|---|---|
| **Phase 1** | Express Gzip Compression & `/storage` Caching | Network & Payload Size | **~70-80% smaller API payloads**, 0ms repeat media fetches via browser HTTP cache |
| **Phase 2** | SQLite Compound Query Indexing | Database Query Latency | **0ms index scans** for paginated asset lists and URL lookups |
| **Phase 3** | Proxy Image In-Memory Caching | External Image Resolving | Instant cache hits for repeated reference image URLs |
| **Phase 4** | Canvas Node Memoization | Frontend Frame Rate | **60 FPS** smooth dragging on large workflows (20+ nodes) |

---

## **Phase 1: HTTP Response Compression & Storage Caching**

### **Objective**
Enable response compression (`compression` middleware) on API routes and set aggressive browser caching headers on `/storage` static media.

### **Changes Required**
1. **Dependencies (`package.json`)**: Add `compression` and `@types/compression`.
2. **Express Server (`server.ts`)**:
   - Mount `compression()` middleware early before API routes.
   - Configure `express.static(STORAGE_PATH)` with `{ maxAge: '7d', immutable: true, etag: true }`.

### **Acceptance Criteria**
- `GET /api/workflows`, `GET /api/assets/all`, and `GET /api/chats` return `Content-Encoding: gzip` or `br`.
- Requests for files under `/storage/...` return `Cache-Control: public, max-age=604800, immutable`.

---

## **Phase 2: SQLite Compound Query Indexing**

### **Objective**
Add compound SQLite indexes to eliminate full table scans on high-frequency queries (`assets.findByProjectId`, `assets.findAllWithProject`, `assets.findByUrl`).

### **Changes Required**
In `backend/services/database.ts`, add the following indexes to `initializeSchema`:
1. `idx_assets_project_created`: `assets(project_id, created_at DESC)`
2. `idx_assets_url`: `assets(url)`
3. `idx_assets_type_created`: `assets(type, created_at DESC)`

### **Acceptance Criteria**
- `EXPLAIN QUERY PLAN SELECT * FROM assets WHERE project_id = ? ORDER BY created_at DESC LIMIT 10 OFFSET 0` uses `idx_assets_project_created`.
- `EXPLAIN QUERY PLAN SELECT * FROM assets WHERE url = ?` uses `idx_assets_url`.

---

## **Phase 3: Proxy Image In-Memory Caching**

### **Objective**
Cache external image fetches in `/api/proxy-image` using a time-bounded in-memory LRU cache so repeated node renders don't re-download the same external URL.

### **Changes Required**
1. In `backend/routes/imageProxy.ts`, add an in-memory Map cache (`url` ➔ `{ base64, mimeType, timestamp }`).
2. Implement 15-minute TTL eviction and a maximum memory footprint cap (e.g. 50 items).

---

## **Phase 4: Canvas Node Memoization & React Flow Optimization**

### **Objective**
Prevent unnecessary re-renders of off-screen or unedited React Flow canvas nodes during node dragging.

### **Changes Required**
1. Wrap node components in `React.memo` with custom prop comparators (`prevProps.data === nextProps.data`).
2. Ensure transient base64 outputs are stripped before passing to React Flow store states.

---

## **Status & Roadmap**

- [x] **Phase 1**: Implemented (Compression & Caching)
- [x] **Phase 2**: Implemented (Database Indexes)
- [x] **Phase 3**: Implemented (Proxy Image In-Memory Cache)
- [x] **Phase 4**: Implemented (Canvas Node Memoization)
