# ✦ MINN CREATIVE STUDIO

> A self-hosted, node-based AI creative studio & multi-modal workspace for image, video, and audio synthesis.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646cff?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003b57?style=flat-square&logo=sqlite)](https://www.sqlite.org/)
[![Google Vertex AI](https://img.shields.io/badge/Google%20Vertex%20AI-Gemini%20%7C%20Imagen%204%20%7C%20Veo%203.1-4285f4?style=flat-square&logo=googlecloud)](https://cloud.google.com/vertex-ai)

---

## 🎨 Overview

**Minn Creative Studio** is a professional-grade, self-hosted creative suite designed for multi-modal AI generation. It combines visual pipeline orchestration with conversational studio AI into a single unified workspace.

The application features **two primary creation modes**:

1. ⚡ **Visual Canvas Workflow**: An infinite node-based visual pipeline host built on React Flow. Construct complex creative workflows by wiring together specialized nodes (Prompts, LLMs, Imagen 4 generation, Veo 3.1 video synthesis, Lyria 3 music composition, masking, matting, and batch output sizers).
2. 💬 **Chat Studio**: A multi-modal conversational workspace supporting persistent threads, model switching (Gemini 3.1 Flash/Pro, Imagen 4, Veo), system prompt presets, and inline media generation.

---

## 🏗️ Architectural Highlights

- **Unified Full-Stack Runtime**: A single Node process (`server.ts`) serves both the React 19 Single Page Application and the Express REST API, removing network latency between UI and backend.
- **Embedded Relational Storage**: High-performance local **SQLite** database (`better-sqlite3`) utilizing Write-Ahead Logging (WAL) for persistent state management, project metadata, usage logs, and thread histories with zero cloud DB dependency.
- **Unified AI Gateway**: Centralized server-side proxy managing Google **Vertex AI** authentication (via Service Accounts or Application Default Credentials) for Gemini, Imagen 4, Veo 3.1, and Lyria 3 models.
- **On-Disk Asset Management**: Local filesystem media storage with automated asset tracking, magic-byte validation, and path traversal security guards.
- **Model Context Protocol (MCP)**: Embedded remote MCP server connector allowing external agentic tools (such as Claude) to inspect, generate, and build canvas graphs programmatically.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 6, Tailwind CSS 4 |
| **Canvas Engine** | React Flow (`reactflow`), Custom Node Registry |
| **State Management** | Zustand |
| **UI Primitives** | Radix UI (Dialog, Dropdown Menu, Avatar, Tooltip), Lucide Icons |
| **Animation & UX** | Motion (`motion/react`), Custom Glassmorphism design system |
| **Backend & API** | Express 4, `tsx` TypeScript runtime, JWT Authentication |
| **Database** | SQLite via `better-sqlite3` (WAL mode enabled) |
| **AI Integration** | Google Vertex AI SDK (`@google/genai`), Google Auth Library |
| **Media Processing** | `sharp` (image processing), `ffmpeg-static` & `fluent-ffmpeg` (video/audio processing) |
| **Containerization** | Docker, Multi-stage builds |

---

## 🚀 Quickstart

### Prerequisites
- Node.js `20.x` or higher
- `npm` or `pnpm`
- Google Cloud Project with Vertex AI API enabled

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/mounir-nawwar/Minn-Creative-Studio.git
cd Minn-Creative-Studio

# Install dependencies
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env` and configure your credentials:

```bash
cp .env.example .env
```

Set the required environment variables:
```env
PORT=3000
NODE_ENV=development

# JWT Secrets
JWT_SECRET=your_jwt_secret_32_chars_minimum
JWT_REFRESH_SECRET=your_jwt_refresh_secret_32_chars

# User Authentication
USER_MOUNIR_PASSWORD=your_secure_password_1
USER_RANA_PASSWORD=your_secure_password_2

# Google Cloud Vertex AI
GOOGLE_CLOUD_PROJECT=your_gcp_project_id
GOOGLE_CLOUD_REGION=us-central1
```

### 3. Run Development Server

```bash
npm run dev
```

The application will launch in development mode with HMR at `http://localhost:3000`.

---

## 📜 Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Starts live development server with HMR |
| `npm run build` | Builds production SPA assets into `dist/` |
| `npm start` | Runs server in production mode serving `dist/` |
| `npm run lint` | Runs TypeScript type checking (`tsc --noEmit`) |
| `npm test` | Executes test suite via Vitest |

---

## 🐳 Docker Deployment

A multi-stage Docker build is available for containerized deployment:

```bash
# Build and start container
docker compose up -d --build
```

---

<div align="center">
  <sub>Built with precision for modern AI creation.</sub>
</div>
