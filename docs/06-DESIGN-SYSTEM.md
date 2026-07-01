# 06 — Design System

A "Mission Control" dark theme: near-black surfaces, a single **teal** accent (`#0097A7`), Inter + Apple system typography, and Motion-driven micro-interactions. Tokens live in `src/styles/design.tokens.css`; global rules in `src/index.css`; auth-screen styling is inline in `src/components/AuthLayout.tsx`.

---

## 🎨 Color palette (exact values)

### Accent — teal
| Value | Where |
|---|---|
| `#0097A7` | primary accent: buttons, handles, progress, active states (`--color-button-primary`, `--color-handle-default`, `--color-node-loading`) |
| `#00838f` | button hover (`--color-button-primary-hover`) |
| `#00afc1` | teal button hover in auth (`AuthLayout`) |
| `#00bcd4` | handle hover / input focus (`--color-handle-hover`, `--color-input-focus`) |
| `rgba(0,151,167,0.5)` | progress glow (`--color-progress-glow`) |
| `rgba(0,151,167,0.3)` | running-node glow |
| `rgba(0,151,167,0.06)` | auth card teal ambient glow |

### Dark surfaces
| Value | Role |
|---|---|
| `#000000` | body background (`index.css`), html bg |
| `#0a0a0a` | input backgrounds, scrollbar track (`--color-input-bg`) |
| `#111111` | node card background (`--color-node-bg`) |
| `#1a1a1a` | node/header borders & header bg, secondary button, toggle inactive (`--color-node-border`, `--color-header-bg`) |
| `#222222` | secondary button hover (`--color-button-secondary-hover`) |
| `#2a2a2a` | input border, scrollbar thumb hover (`--color-input-border`) |

### Text
| Value | Role |
|---|---|
| `#ffffff` | primary text (`--color-text-primary`) |
| `#9ca3af` | secondary / input text (`--color-text-secondary`, `--color-input-text`) |

### Status / semantic
| Value | Role |
|---|---|
| `#22c55e` | valid handle / success text (`--color-handle-valid`, `--color-text-success`) |
| `#ef4444` | error border/text/handle (`--color-node-error`, `--color-handle-invalid`, `--color-text-error`) |
| `#3b82f6` | focused handle (`--color-handle-focus`) |
| `#2196f3` | toggle active (`--color-toggle-active`); also the param-node accent (Seed/Number/Motion) |
| `#34C759` | Apple-green: toast success, online indicator |
| `#FF453A` | Apple-red: toast error, offline indicator |
| `#FF9F0A` | amber: toast warning |
| `#007AFF` | blue: toast info |

### Toast color sets (`ToastContainer.tsx`)
Each variant uses `bg rgba(.,.12)`, `border rgba(.,.25)`, solid icon color, `glow rgba(.,.15)`:
- success `#34C759` · error `#FF453A` · warning `#FF9F0A` · info `#007AFF`.

---

## 🔤 Typography

- **Primary:** Inter (weights 400–900), loaded from Google Fonts in `index.css` and set as `--font-sans` in Tailwind's `@theme`.
- **Apple system stacks** (auth, exported from `AuthLayout.tsx`):
  - `SF` (text) = `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif`
  - `SFDisplay` = `… 'SF Pro Display' …` (light display headings, `font-weight: 200`).
- **Responsive sizing** via `clamp()` throughout, e.g. heading `clamp(24px, 2vw, 32px)`, subtext `clamp(11px, 0.85vw, 13px)`, button `clamp(13px, 1vw, 15px)`. Node labels are small uppercase (`text-xs`/`text-[10px]`, `tracking-wider`).

---

## 📐 Design tokens (`design.tokens.css`)

| Token | Value |
|---|---|
| `--spacing-handle` | `0.75rem` (12px) |
| `--spacing-handle-label` | `1rem` (16px) |
| `--spacing-node-padding` | `1rem` (16px) |
| `--spacing-progress-thickness` | `2px` |
| `--shadow-handle-hover` | `0 0 8px #00bcd4` |
| `--shadow-handle-valid` | `0 0 8px #22c55e` |
| `--shadow-handle-invalid` | `0 0 8px #ef4444` |
| `--shadow-node-loading` | `0 0 15px rgba(0,151,167,0.3)` |
| `--shadow-node-error` | `0 0 15px rgba(239,68,68,0.3)` |
| `--shadow-node` | `0 0 15px rgba(0,0,0,0.5)` |
| `--transition-fast / medium / slow` | `150ms / 300ms / 500ms` |

---

## 🌀 Global CSS (`index.css`)

- `body`: `#000` background, white text, no margin.
- **Scrollbars** (webkit): 6px, track `#0a0a0a`, thumb `#1a1a1a` → `#2a2a2a` on hover, radius 10px.
- **React Flow overrides:** nodes `cursor: default`; handles forced to `8px` circles; edges use `stroke-dasharray: 5` with the `dash` animation; attribution hidden.
- **Keyframes:** `dash` (animated edge flow, 1s linear infinite), `shimmer` (running-node progress bar). `authFadeUp` lives in `AuthLayout`.

---

## 🪟 Auth screen styling (`AuthLayout.tsx`)

- **Glass card:** `background rgba(6,6,6,0.38)`, `backdrop-filter: blur(64px) saturate(180%) brightness(0.95)`, `border 1px rgba(255,255,255,0.08)`, radius `clamp(20px,1.8vw,28px)`, layered shadow incl. `0 0 60px rgba(0,151,167,0.06)`.
- **Staggered entrance:** `.a0–.a4` classes apply `authFadeUp` (translateY 24px + fade) on a `cubic-bezier(0.22,1,0.36,1)` curve at 0 / 0.12 / 0.22 / 0.32 / 0.42s delays.
- **Buttons:** `.auth-btn-white` (white→`#fff` hover, glow `rgba(255,255,255,0.14)`) and `.auth-btn-teal` (`#0097A7`→`#00afc1` hover, glow `rgba(0,151,167,0.3)`); both `clamp(44px,3.5vw,52px)` tall.

---

## 🎞️ Motion & background

- **Library:** `motion/react`. Common patterns: opacity fades, `y`/`scale` slides, spring configs (e.g. `stiffness 300–500, damping 30` for toasts), `AnimatePresence` for mount/unmount (node error footer, modals, screen cross-fades in `App.tsx`).
- **Animated background:** `public/scene.json` rendered by `unicornstudio-react`'s `<UnicornScene>` behind auth screens only (teal `#0097A7` is baked into the scene's shaders); it fades out and unmounts when entering the main app.

---

## 🧩 Component catalog (`src/components/`)

### Layout / shell
| Component | Purpose |
|---|---|
| `ProjectSidebar.tsx` | Left nav; animates 320px↔0; hosts the Nodes/Workflows/Chats/Assets tabs |
| `Sidebar.tsx` + `Sidebar/` (`NodesTab`, `WorkflowsTab`, `ChatsTab`) | Tabbed sidebar content (drag nodes, list/save workflows, list chats); footer "Project Active" teal-dot indicator |
| `Toolbar.tsx` | Top bar: run/play, undo-redo, save status (Cmd+S), user menu + logout |
| `ProjectContextBar.tsx` | Project name/type/context strip (`#1a1a1a`) |

### Auth / project entry
| Component | Purpose |
|---|---|
| `AuthLayout.tsx` | Auth screen wrapper + exported `SF`/`SFDisplay` fonts and shared auth CSS |
| `CustomLoginPage.tsx` | Username/password login form (`auth.login`) |
| `ProjectCard.tsx` | Project tile (grid/list); hover border → `#0097A7/50`; status menu |
| `ProjectCreationOverlay.tsx` + `ProjectCreation/` | Multi-step new/edit-project wizard: `StepBasicInfo`, `StepProjectType`, `StepTargetAudience`, `StepVisualIdentity`, `StepCollaborators`, `StepAIInstructions`, `StepReview` (+ `types.ts`) |
| `StepIndicator.tsx` | Wizard progress dots (active scales 1.2, teal; completed = check) |

### Assets / chat
| Component | Purpose |
|---|---|
| `ChatDrawer.tsx` | Creative-assistant chat; markdown + code blocks w/ copy; inline asset attach |
| `AssetGrid.tsx` | 2-col asset browser; drag-drop upload; search/filter; favorite/download/delete/add-to-canvas |
| `AssetExpandModal.tsx` | Global full-screen asset preview (driven by `useStore.expandedAsset`) |
| `AssetPreviewModal.tsx` | Lightbox preview with navigation |
| `ExpandableAssetWrapper.tsx` | Wraps node outputs to open the expand modal |
| `ReferenceStrip.tsx` | Horizontal reference-image strip with per-item role dropdown + delete (Imagen/Veo/Lyria) |
| `VideoPreview.tsx` / `AudioPreview.tsx` | Inline video (autoplay/loop) and audio (play/pause + waveform) players |
| `DeleteAssetModal.tsx` / `DeleteProjectModal.tsx` | Red-accented confirm dialogs |

### Inputs / feedback
| Component | Purpose |
|---|---|
| `AskAIButton.tsx` | "Ask AI to Fill" helper (Sparkles icon, teal `#0097A7/10` bg, `/30` border) |
| `ParameterSlider.tsx` | Labeled range slider (accent color configurable, default `#0097A7`) |
| `ToggleSwitch.tsx` | Styled toggle (styled-components); OFF gray+red, ON green+glow; size presets navbar/node |
| `ToastContainer.tsx` | Top-center toasts (spring), color-coded by type, auto-dismiss + close |
| `OfflineIndicator.tsx` | Bottom-center online/offline badge (green `#34C759` / red `#FF453A`) |
| `ErrorBoundary.tsx` | Catches render errors; red panel + Try-Again / Reload |
| `Skeleton.tsx` | Loading placeholders (`#2a2a2a` pulse): workflow/project/asset/node variants |
| `PerfHUD.tsx` | Dev performance overlay (validation time, cache hits, render count; green/yellow/red budget) |
