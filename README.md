# ✦ MINN STUDIO

**MINN STUDIO** is a professional, node-based AI creative pipeline designed for high-end image and video generation. It provides a visual canvas for building complex, reusable workflows using state-of-the-art AI models.

Built with a "Mission Control" aesthetic, MINN STUDIO empowers creators to orchestrate multiple AI models into a single, cohesive creative flow.

---

## 🚀 Core Features

- **Node-Based Canvas:** A visual graph editor (powered by React Flow) for building complex creative pipelines.
- **Multimodal AI Orchestration:** Seamlessly connect models for text, image, video, and audio generation.
  - **Gemini 3.1:** Advanced text and vision capabilities.
  - **Veo 3:** High-fidelity video generation.
  - **Imagen 4:** State-of-the-art image synthesis.
  - **Lyria:** Professional-grade audio and music generation.
- **"Ask AI" Integration:** Intelligent helpers that assist in crafting prompts and camera controls.
- **Persistent Creative Assistant:** A context-aware chat interface for real-time creative brainstorming.
- **Professional Asset Management:** Grid and List views for managing your projects and creative outputs.
- **Firebase Integration:** Secure Google Auth and real-time cloud persistence for workflows and chats.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4.
- **Node Graph:** [React Flow](https://reactflow.dev/).
- **State Management:** [Zustand](https://github.com/pmndrs/zustand).
- **Backend:** [Express.js](https://expressjs.com/) (API Proxy & Server-side processing).
- **Persistence & Auth:** [Firebase](https://firebase.google.com/) (Firestore & Firebase Auth).
- **Animations:** [Motion](https://motion.dev/).

---

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Latest LTS recommended).
- Firebase project with Firestore and Authentication enabled.

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd minn-creative-studio
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Configuration:**
   Create a `.env` file in the root directory:
   ```env
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your-secure-password
   SESSION_SECRET=your-secure-session-secret-at-least-32-characters
   FIREBASE_STORAGE_BUCKET=your-bucket.appspot.com
   FIREBASE_SERVICE_ACCOUNT=<base64-encoded-service-account-json>
   ```
   
   > **Note:** API keys for Gemini/Imagen/Veo are managed server-side. Configure them in your backend deployment environment.

### Running the App

Start the development server (serves both the Vite frontend and the Express backend):
```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## 🏗️ Project Structure

- `/src/nodes`: UI and logic for 50+ specialized node types.
- `/src/canvas`: React Flow instance and graph management.
- `/src/store`: Zustand state management for nodes, edges, and app state.
- `/src/services`: Centralized AI service logic (`geminiService.ts`).
- `/backend`: Server-side proxy routes and processing logic.
- `server.ts`: Combined Express/Vite server entry point.

---

## 📜 Development Guidelines

- **Mission Control Aesthetic:** Adhere to the dark theme (`#0a0a0a`) and accent teal (`#0097A7`).
- **Node Data:** Always use `updateNodeData(nodeId, data)` from the Zustand store; never mutate node state directly.
- **AI Integration:** Route all GenAI calls through `src/services/geminiService.ts`.
- **Type Safety:** Ensure all new components and logic are strictly typed.

---

<div align="center">
  <p align="center">
    <strong>MINN STUDIO 2026</strong><br/>
    The Professional AI Creative Pipeline
  </p>
</div>
