# 05 — Nodes

Nodes are the building blocks of every workflow. Each is a React component that renders inside the shared **`BaseNode`** shell, exposes typed input/output **handles** (from `src/types/nodeHandles.ts`), and reads/writes its state through `updateNodeData` in the Zustand store. The canvas knows which component to render via the `nodeTypes` map in `src/utils/nodeTypes.ts`.

## 🧱 `BaseNode.tsx` — the shared shell

Every node wraps its body in `<BaseNode>`, which provides consistent chrome (`BaseNode.tsx`):

- **Card:** 320px wide, `bg-[#111111]`, **`ring-1 ring-white/[0.07]`** + soft shadow, rounded-xl. Mounts with a 150ms opacity fade (Motion).
- **State rings:** running → teal ring + glow `shadow-[0_0_20px_rgba(0,151,167,0.25)]`; error → red ring + red glow.
- **Header** (`bg-white/[0.03]`, `border-b`): optional icon + a `font-semibold uppercase tracking-wide` label. While running, a **shimmer progress bar** (`gradient … via-[#0097A7]`, `shimmer 1.5s infinite`) animates along the bottom, with an elapsed `progress` readout (tabular-nums) + spinning `Loader2`. On error an `AlertCircle` shows. A hover-revealed `X` (36px hit area, `active:scale-[0.96]`) deletes the node.
- **Body:** `p-4 space-y-4` slot for the node's own controls (`children`).
- **Error footer:** an `AnimatePresence` height/opacity section showing `data.error` in red when present.
- **Handles:** input handles (`type='target'`, left) and output handles (`type='source'`, right) are read from `NODE_HANDLES[data.type]` (or explicit `data.inputHandles/outputHandles`). Each is an 8px teal dot (`bg-[#0097A7] border-2 border-[#111111]`), positioned vertically via `calcHandlePosition`. During a drag, the hovered target handle turns **emerald (valid)** or **red (invalid)** based on `ConnectionContext` validation. A `ResizeObserver` calls `updateNodeInternals` so React Flow re-measures handle positions when a node grows.

> **Node bodies (post-redesign):** every registered node now renders its inputs through the shared `src/nodes/ui.tsx` primitives (`NodeField`, `NodeLabel`, `NodeInput`, `NodeTextArea`, `NodeSelect`, `NodeToggle`, `RunButton`, `NodeOutput`) — flat `bg-black/30` inputs with a teal focus ring, normal-case buttons with `active:scale-[0.96]`. Per-node accent colors that used to vary (Veo/ImageToVideo orange, param nodes blue, upscalers amber, DirectorPrompt purple, CameraControl blue, Sequence pink, VideoMatte cyan) were all **unified to teal**.

> **Node count:** `src/utils/nodeTypes.ts` registers **49 type keys** (48 distinct components — `ImageDescriberNode` is mapped to both `vision` and `imageDescriber`). Five node files exist in `src/nodes/` but are **not registered** in `nodeTypes` and so aren't placeable on the canvas today: `BrandContextNode`, `BatchOutputSizerNode`, `InpaintingNode`, `PromptLibraryNode`, `VariationNode` (their handle types still exist in `NODE_HANDLES`). Non-node helpers in the folder: `BaseNode.tsx`, `ui.tsx` (shared primitives), `ImagenAdvancedPanel.tsx`, `imagenModels.ts`, `lyriaConstants.ts`.

---

## Handle type legend
Handle types (from `types/handleTypes.ts`) gate which connections are allowed: `image`, `video`, `audio`, `prompt`, `text`, `number`, `seed`, `mask`, `motion`, `array`, `boolean`, `json`, `unknown`. A target only accepts compatible source types (`unknown` is permissive). Below, **In/Out** list each node's handles as `label (type)`.

---

## 📥 Input nodes

| Node (`type`) | Purpose | In | Out |
|---|---|---|---|
| Image Upload (`imageUpload`) | Upload or pick an image; instant local blob preview, optional auto-upload to server (toggle), abortable | — | Image (image) |
| Video Upload (`videoUpload`) | Upload/pick a video | — | Video (video) |
| Prompt (`prompt`) | Free-text prompt with an "Ask AI to Fill" helper | — | Prompt (prompt) |
| Text (`text`) | Generic text value | — | Text (text) |
| Number (`number`) | Numeric value (min/max/decimals) | — | Number (number) |
| Toggle (`toggle`) | Boolean on/off | — | Boolean (boolean) |
| List Selector (`listSelector`) | Pick from preset options | — | Selected (text) |
| Seed (`seed`) | Random/fixed/lock seed control + randomize | Input (unknown) | Seed (seed) |
| Array (`array`) | Bundle up to 3 items into an array | Item 1–3 (unknown) | Array (array) |

## 🤖 AI generation nodes

### Imagen (`imagen`)
Image generation. **In:** Prompt (prompt), Reference Image (image, opt), Seed (seed, opt), Guidance Strength (number), CFG Scale (number). **Out:** Generated Image (image). Models come from `imagenModels.ts` (`IMAGE_MODELS`):

| Model id | Label | Price | Family | Notable supports |
|---|---|---|---|---|
| `imagen-4.0-ultra-generate-001` | Imagen 4 Ultra | $0.06/img | imagen4 | 5 aspect ratios, sampleCount, seed, personGeneration, enhancePrompt, addWatermark, safetySetting |
| `imagen-4.0-generate-001` | Imagen 4 | $0.04/img | imagen4 | same as Ultra |
| `imagen-4.0-fast-generate-001` | Imagen 4 Fast | $0.02/img | imagen4 | same as Ultra |
| `gemini-3.1-flash-image-preview` | Nano Banana 2 | free* | nanoBanana2 | 12 aspect ratios, resolution 512–4K, referenceImages, style, grounding, temp/topP/topK |
| `gemini-2.5-flash-image` | Nano Banana 1 | free* | nanoBanana | 10 aspect ratios, resolution 512–2K, referenceImages, style |
| `gemini-3-pro-image-preview` | Nano Banana Pro | free* | nanoBananaPro | resolution 512–4K, thinkingLevel, grounding, referenceImages, style |

*"free" = no flat per-image `price` in the UI model list; these Gemini image models are **token-billed** per `pricing.ts` (input/output + `imageOutput` rate). `ImagenAdvancedPanel.tsx` renders the collapsible advanced controls. References support roles (style/composition/character/subject/background) via `ReferenceStrip`.

### Veo (`veo`)
Video generation from prompt and/or start/end frames. **In:** Prompt (prompt), Start Frame (image, opt), End Frame (image, opt), Reference Images (image), Input Video (video, opt), Motion Data (motion, opt), Seed (seed, opt). **Out:** Generated Video (video). Models: `veo-3.1-fast-generate-001`, `veo-3.1-generate-001`. Config: aspect ratio, resolution (480/720/1080p), duration, negative prompt, person generation, audio toggle, reference strength. Long-running — node shows an elapsed timer while polling.

### Image → Video (`imageToVideo`)
Animate a still (Veo under the hood). **In:** Start Image (image), End Image (image, opt), Reference Images (image), Prompt (prompt, opt), Motion Data (motion, opt), Seed (seed, opt). **Out:** Video (video).

### Lyria (`lyria`)
Music / audio generation. **In:** Text Prompt (text), Reference (image, opt), Seed (seed, opt). **Out:** Generated Audio (audio). Models: Lyria 3 Pro / clip (+ a TTS path). Sound-design controls: genre, mood, instrumentation, BPM, density, brightness, guidance, temperature, and a **musical scale** picker from `lyriaConstants.ts` (`MUSICAL_KEYS` — 28 keys, all majors + minors). Pro generation is a long-running operation.

### LLM (`llm`)
Text generation with optional vision. **In:** Input Text (text), Input Image (image, opt). **Out:** Generated Text (text). Default model `gemini-3-flash-preview`; supports a custom system instruction and injects project context.

### Describers
| Node (`type`) | In | Out |
|---|---|---|
| Image Describer (`imageDescriber` / `vision`) | Image (image) | Description (text) |
| Video Describer (`videoDescriber`) | Video (video) | Description (text) |

## ✍️ Prompt & text nodes

| Node (`type`) | Purpose | In | Out |
|---|---|---|---|
| Prompt Concatenator (`promptConcatenator`) | Merge up to 4 prompts | Prompt 1–4 (prompt) | Combined Prompt (prompt) |
| Prompt Enhancer (`promptEnhancer`) | AI-expand a prompt | Input Prompt (prompt) | Enhanced Prompt (prompt) |
| Director Prompt (`directorPrompt`) | Structured cinematic prompt builder | — | Director Prompt (prompt) |
| Camera Control (`cameraControl`) | Camera move/zoom/rotation settings | — | Camera Settings (text) |
| Text Iterator (`textIterator`) | Step through a text array by index | Text Array (array), Index (number) | Current Text (text) |

## 🖌️ Image processing nodes

| Node (`type`) | Purpose | In | Out |
|---|---|---|---|
| Resize (`resize`) | Resize | Image (image) | Resized Image (image) |
| Crop (`crop`) | Crop to region/aspect | Image (image) | Cropped Image (image) |
| Blur (`blur`) | Blur filter | Image (image) | Blurred Image (image) |
| Invert (`invert`) | Invert colors | Image (image) | Inverted Image (image) |
| Levels (`levels`) | Brightness/contrast/levels | Image (image) | Adjusted Image (image) |
| Channels (`channels`) | R/G/B/A channel control | Image (image) | Processed Image (image) |
| Relight (`relight`) | Re-light (direction/intensity/temperature) | Image (image) | Relit Image (image) |
| Image Upscaler (`imageUpscaler`) | 2×/4× upscale (Nano Banana / Imagen upscale models) | Image (image) | Upscaled Image (image) |
| Compositor (`compositor`) | Composite background+foreground with optional mask | Background (image), Foreground (image), Mask (mask, opt) | Composited Image (image) |
| Painter (`painter`) | Prompt-guided paint over an image | Image (image), Painting Instructions (prompt) | Painted Image (image) |
| Compare (`compare`) | Side-by-side / slider comparison | Input A (image), Input B (image) | Comparison (image) |
| Image Iterator (`imageIterator`) | Step through an image array | Image Array (array), Index (number) | Current Image (image) |

## 🎭 Masking & matte nodes

| Node (`type`) | Purpose | In | Out |
|---|---|---|---|
| Mask Extractor (`maskExtractor`) | Extract a mask/alpha | Image (image) | Mask (mask) |
| Mask By Text (`maskByText`) | Text-prompted mask (bounding-box detection) | Image (image), Description (prompt) | Mask (mask) |
| Matte Adjust (`matteAdjust`) | Feather/expand a mask | Mask (mask) | Adjusted Mask (mask) |
| Merge Alpha (`mergeAlpha`) | Apply mask as alpha | Image (image), Mask (mask) | Merged Image (image) |

## 🎞️ Video processing nodes

| Node (`type`) | Purpose | In | Out |
|---|---|---|---|
| Video Upscaler (`videoUpscaler`) | Upscale video (ESRGAN backend) | Video (video) | Upscaled Video (video) |
| Frame Interpolator (`frameInterpolator`) | Raise FPS (RIFE backend) | Video (video) | Interpolated Video (video) |
| Video Matte (`videoMatte`) | Extract/adjust video matte | Video (video) | Matted Video (video) |
| Video Mask By Text (`videoMaskByText`) | Text-prompted mask on video frames | Video (video), Description (prompt) | Mask (mask) |
| Video Iterator (`videoIterator`) | Step through a video array | Video Array (array), Index (number) | Current Video (video) |

## 🎚️ Parameter & control nodes

| Node (`type`) | Purpose | In | Out |
|---|---|---|---|
| CFG Scale (`cfgScale`) | Guidance (prompt-adherence) value | — | CFG Scale (number) |
| Guidance Strength (`guidanceStrength`) | Reference-image guidance value | — | Guidance Strength (number) |
| Motion Intensity (`motionIntensity`) | Video motion amount (slider) | — | Motion Intensity (number) |
| Sequence (`sequence`) | Fan a trigger out to ordered steps | Trigger (unknown) | Step 1–3 (unknown) |

## 🧩 Specialized & output nodes

| Node (`type`) | Purpose | In | Out |
|---|---|---|---|
| Sticky Note (`stickyNote`) | On-canvas documentation note (no I/O) | — | — |
| Output (`output`) | Terminal collector — thumbnails + download (single or ZIP) of connected results | Output (unknown) | — |

### Unregistered node files (present, not on the canvas)
Defined in `src/nodes/` and have handle definitions, but not wired into `nodeTypes`:
- **Inpainting (`inpainting`)** — canvas mask-paint + prompt editing. In: Image, Mask, Prompt → Out: Inpainted Image.
- **Variation (`variation`)** — generate variations. In: Input Image → Out: Variation.
- **Batch Output Sizer (`batchOutputSizer`)** — multi-aspect crops (backed by `POST /api/batchsize`). In: Image → Out: Resized Image.
- **Brand Context (`brandContext`)** — inject brand palette/tone. Out: Brand Context (json).
- **Prompt Library (`promptLibrary`)** — pick a saved prompt (backed by `/api/prompts`). Out: Prompt.

> Style Transfer (`styleTransfer`) also has handle definitions (Content + Style → Styled Image) used by the `/api/gemini/proxy` style-transfer path, though it isn't a standalone registered canvas node either.
