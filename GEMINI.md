# GEMINI.md - MINN STUDIO Technical Context

This document provides essential context for Gemini CLI and other AI agents to understand and contribute to the MINN STUDIO project.

## 🚀 Project Overview

**MINN STUDIO** is a professional, node-based AI creative pipeline designed for high-end image and video generation. It provides a visual canvas for building complex, reusable workflows using state-of-the-art AI models.

### Core Technologies
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4.
- **Node Graph:** [React Flow](https://reactflow.dev/) for the visual pipeline.
- **State Management:** [Zustand](https://github.com/pmndrs/zustand) for node/edge state and global application state.
- **Backend:** [Express.js](https://expressjs.com/) serving as a proxy to the Gemini API and handling server-side processing.
- **Persistence & Auth:** [Firebase](https://firebase.google.com/) (Firestore for workflows/chats, Firebase Auth for user management).
- **AI Models:** Gemini (Text/Vision), Veo (Video), Imagen (Image), Lyria (Audio).

---

## 🛠️ Building and Running

### Prerequisites
- [Node.js](https://nodejs.org/) (Latest LTS recommended).
- A [Google Gemini API Key](https://aistudio.google.com/).

### Key Commands
- **Install Dependencies:** `npm install`
- **Development Mode:** `npm run dev` (Starts `server.ts` using `tsx`, which serves the Vite frontend and the Express API).
- **Build for Production:** `npm run build`
- **Linting:** `npm run lint` (Type-checking via `tsc`).

### Environment Configuration
Create a `.env.local` file in the root directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
SESSION_SECRET=your_jwt_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
```

---

## 🏗️ Architecture & Development Conventions

### 📁 Directory Structure
- `/src/nodes`: Contains the UI and logic for all 50+ node types (e.g., `ImagenNode.tsx`, `VeoNode.tsx`).
- `/src/canvas`: The `Canvas.tsx` component managing the React Flow instance.
- `/src/store`: Zustand stores (`useStore.ts`) for managing application state.
- `/src/services`: Centralized AI service logic (`geminiService.ts`).
- `/backend`: Server-side routes and processing logic.
- `server.ts`: Main entry point for the combined Express/Vite server.

### 📜 Development Rules
1. **Node Data Updates:** Always use the `updateNodeData(nodeId, data)` function from the Zustand store to update node properties. Do not mutate node state directly.
2. **AI Integration:** All calls to GenAI models should be routed through `src/services/geminiService.ts`, which communicates with the backend proxy.
3. **Styling:** Adhere to the established "Mission Control" aesthetic:
    - Primary Dark: `#0a0a0a` / `#121212`
    - Accent Teal: `#0097A7`
    - Use Tailwind CSS 4 utility classes.
4. **Node Implementation:** Every new node should extend `BaseNode.tsx` for consistent styling and behavior (handles, labels, status indicators).
5. **Persistence:** Workflows are saved as JSON blobs in Firestore. Ensure node data remains serializable.

### 🧪 Testing
- Current focus is on manual verification of node pipelines.
- CI/CD checks for type safety via `npm run lint`.

---

## 🤖 AI Interaction Guidelines
- When asked to add a new node, create the component in `src/nodes/`, register it in `src/utils/nodeTypes.ts`, and ensure any required AI logic is added to `geminiService.ts`.
- When modifying the UI, prioritize the dark, professional aesthetic defined in `index.css` and `App.tsx`.
