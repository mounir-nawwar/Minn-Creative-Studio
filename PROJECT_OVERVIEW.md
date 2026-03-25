# MINN STUDIO - Project Overview & Technical Documentation

**MINN STUDIO** is a professional, node-based AI creative pipeline designed for high-end image and video generation. It leverages state-of-the-art models like Gemini 3.1, Veo 3, and specialized image processing tools to allow users to build complex, reusable creative workflows.

---

## 🚀 Tech Stack

-   **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4.
-   **State Management:** Zustand (for the node graph and global state).
-   **Node Graph:** React Flow (customized with a dark, professional aesthetic).
-   **Animations:** Motion (formerly Framer Motion).
-   **Backend:** Express.js (serving as a proxy and handling server-side logic).
-   **Database & Auth:** Firebase (Firestore for chat/workflow persistence, Firebase Auth for Google Login).
-   **AI Models:** Gemini 3.1 (Flash & Pro), Veo 3 (Video), Imagen (Image), Lyria (Audio/Music).

---

## 🎨 Core Features

### 1. Node-Based Workflow
The heart of the application is a visual canvas where users can connect different "Nodes" to create a pipeline.
-   **Data Flow:** Nodes pass data (prompts, images, parameters) through handles.
-   **Execution:** Nodes can be run individually or as a complete chain via the "Run All" feature.
-   **Persistence:** Workflows can be saved to and loaded from Firestore.

### 2. "Ask AI" Helper
Integrated into key input nodes (Prompt, Director's Prompt, Camera Control).
-   **How it works:** Uses Gemini 3 Flash to analyze a user's creative goal and automatically fill in complex parameters (style, lighting, camera movement, etc.).
-   **Service:** `src/services/geminiService.ts` handles the prompt engineering for these suggestions.

### 3. Creative Assistant Chat (Right Drawer)
A dedicated, persistent chat interface on the right side of the screen.
-   **Context-Aware:** Specifically designed to help with prompt engineering and creative direction.
-   **Persistence:** Chat sessions and messages are saved in Firestore, allowing users to resume creative brainstorming across sessions.
-   **Model:** Powered by Gemini 3 Flash Preview.

### 4. Professional UI/UX
-   **Aesthetic:** Dark, high-contrast "Mission Control" style.
-   **Responsive:** Designed for professional desktop use but maintains usability across screen sizes.
-   **Feedback:** Real-time status indicators (loading, success, error) on every node.

---

## 📂 File Structure & Organization

### Root Directory
-   `server.ts`: Express server handling API routes, Vite middleware, and production serving.
-   `firebase-blueprint.json`: IR (Intermediate Representation) of the Firestore schema.
-   `firestore.rules`: Security rules for Firestore (Owner-only access, data validation).
-   `metadata.json`: App name, description, and permissions.

### `/src` Directory
-   `App.tsx`: Main entry point, handles Auth state and layout (Sidebar, Toolbar, Canvas, ChatDrawer).
-   `firebase.ts`: Firebase initialization and exported helpers (Auth, Firestore).
-   `types.ts`: Global TypeScript interfaces and enums.

#### `/src/nodes` (The Logic)
Contains 50+ specialized nodes. Key categories:
-   **Input:** `PromptNode`, `ImageUploadNode`, `VideoUploadNode`.
-   **AI Generation:** `ImagenNode`, `VeoNode`, `LyriaNode`, `LLMNode`.
-   **Creative Control:** `DirectorPromptNode`, `CameraControlNode`, `StyleTransferNode`.
-   **Processing:** `ResizeNode`, `BlurNode`, `InvertNode`, `CropNode`.
-   **Utility:** `PromptConcatenatorNode`, `SeedNode`, `StickyNoteNode`.

#### `/src/components` (UI Components)
-   `ChatDrawer.tsx`: The sliding chat interface with Firebase persistence.
-   `AskAIButton.tsx`: The helper button for AI-assisted parameter filling.
-   `Sidebar.tsx`: Node library for dragging new nodes onto the canvas.
-   `Toolbar.tsx`: Workflow management (Save, Load, Run All).

#### `/src/canvas`
-   `Canvas.tsx`: The React Flow implementation, handling node/edge state and custom node types.

#### `/src/utils`
-   `nodeTypes.ts`: Maps custom node types (e.g., 'prompt', 'directorPrompt') to their respective React components.

#### `/src/store`
-   `useStore.ts`: Zustand store managing `nodes`, `edges`, and helper functions for updating node data.

---

## 🗄️ Firebase Schema

### `chats` (Collection)
-   `title`: string
-   `userId`: string (Owner UID)
-   `createdAt`: timestamp
-   `lastMessage`: string

### `chats/{chatId}/messages` (Sub-collection)
-   `role`: "user" | "model"
-   `text`: string
-   `createdAt`: timestamp

### `workflows` (Collection)
-   `name`: string
-   `nodes`: array (React Flow nodes)
-   `edges`: array (React Flow edges)
-   `userId`: string
-   `createdAt`: timestamp

---

## 🔐 Security & Rules
-   **Firestore Rules:** Implements a "Default Deny" policy. Users can only read/write their own data (`isOwner` check).
-   **Data Validation:** Strict schema validation for chats and messages to prevent DoS or data corruption.
-   **Auth:** Google OAuth via Firebase Auth.

---

## 🛠️ Environment Variables
-   `GEMINI_API_KEY`: Required for all AI features (Gemini, Imagen, Veo).
-   `FIREBASE_CONFIG`: Injected via `firebase-applet-config.json`.

---

## 📝 Developer Notes for Claude
-   **Node Updates:** When updating a node's configuration, always use the `updateNodeData` function from the Zustand store to ensure the UI and graph stay in sync.
-   **AI Prompts:** The `geminiService.ts` uses structured JSON output for AI suggestions. Ensure any changes to node schemas are reflected in the service's prompt templates.
-   **Styling:** Stick to the teal (`#0097A7`) and dark gray/black color palette for consistency.
