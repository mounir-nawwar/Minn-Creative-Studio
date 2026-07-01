# 06 — Design System

A "Mission Control" dark theme: near-black surfaces, a single **teal** accent (`#0097A7`), Inter + Apple system typography, **Radix UI** primitives, and a **calm** motion language. Tokens live in `src/styles/design.tokens.css`; global rules + animation keyframes in `src/index.css`; auth-screen styling is inline in `src/components/AuthLayout.tsx`.

> **Interaction principles (post-redesign).** The UI was rebuilt on these rules — follow them for any new surface:
> - **Single teal accent.** Every interactive/active state uses `#0097A7` (hover `#00a9bb`). Off-palette per-node colors (orange/blue/purple/pink/cyan/amber) were all unified to teal.
> - **Calm motion.** No hover/tap scale-jumps and no scale-pop entrances. Use `active:scale-[0.96]` on buttons for press feedback; hover changes ring/shadow/background only. Menu/dialog entrances are short fades (`[0.2,0,0,1]` ease).
> - **Rings over hard borders**, concentric radii, `tabular-nums` for changing numbers, image outlines on media.
> - **Disciplined type.** Normal-case labels/buttons; caps reserved for small field labels used sparingly (no blanket `font-black uppercase`).
> - **Radix** provides the accessible primitives (Dialog, AlertDialog, DropdownMenu, Avatar, Tooltip) — focus-trap, Esc, scroll-lock. Shared primitive sets: `src/nodes/ui.tsx` and `src/components/ProjectCreation/ui.tsx`.

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
| `#2196f3` | **legacy token only** (`--color-toggle-active` in `design.tokens.css`). No longer used at runtime — the toggle and the param nodes (Seed/Number/Motion) are **teal** now. |
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
- **Responsive sizing** via `clamp()` throughout, e.g. heading `clamp(24px, 2vw, 32px)`, subtext `clamp(11px, 0.85vw, 13px)`, button `clamp(13px, 1vw, 15px)`.
- **Disciplined hierarchy (post-redesign):** buttons and most labels are **normal-case** (`Generate image`, not `GENERATE IMAGE`). Small uppercase (`text-[10px]/[11px]`, `tracking-wide`, `font-medium`) is reserved for compact field labels (`NodeLabel`, `FieldLabel`) — not blanket `font-black uppercase`.

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
- **Keyframes:** `dash` (animated edge flow, 1s linear infinite), `shimmer` (running-node progress bar), and the Radix popover/dialog set — `menuIn`/`menuOut` (calm dropdown fade + 4px rise, no scale), `overlayIn` (backdrop/content opacity fade), `dialogIn` (modal opacity fade; **opacity-only** so the `-translate` centering never flashes). `authFadeUp` lives in `AuthLayout`.

---

## 🪟 Auth screen styling (`AuthLayout.tsx`)

- **Glass card:** `background rgba(6,6,6,0.38)`, `backdrop-filter: blur(64px) saturate(180%) brightness(0.95)`, `border 1px rgba(255,255,255,0.08)`, radius `clamp(20px,1.8vw,28px)`, layered shadow incl. `0 0 60px rgba(0,151,167,0.06)`.
- **Staggered entrance:** `.a0–.a4` classes apply `authFadeUp` (translateY 24px + fade) on a `cubic-bezier(0.22,1,0.36,1)` curve at 0 / 0.12 / 0.22 / 0.32 / 0.42s delays.
- **Buttons:** `.auth-btn-white` (white→`#fff` hover, glow `rgba(255,255,255,0.14)`) and `.auth-btn-teal` (`#0097A7`→`#00afc1` hover, glow `rgba(0,151,167,0.3)`); both `clamp(44px,3.5vw,52px)` tall.

---

## 🎞️ Motion & background

- **Two motion systems:**
  - **Radix** components animate via `data-[state=open/closed]` + the `menuIn`/`overlayIn`/`dialogIn` keyframes (dropdowns, dialogs, alert-dialogs). Calm, opacity-led, no scale-pop.
  - **`motion/react`** for the rest: opacity fades and short `y` shifts (`ease [0.2,0,0,1]`), collapsible disclosures (`height:auto`), spring toasts, and the `App.tsx` screen cross-fades. Sidebar width uses a spring. Deliberately **no** `whileHover`/`whileTap` scale — press feedback is `active:scale-[0.96]` in CSS.
- **Animated background:** `public/scene.json` rendered by `unicornstudio-react`'s `<UnicornScene>` behind auth screens only (teal `#0097A7` is baked into the scene's shaders); it fades out and unmounts when entering the main app.

---

## 🧩 Component catalog (`src/components/`)

### Layout / shell
| Component | Purpose |
|---|---|
| `ProfileMenu.tsx` | **Shared** Radix Avatar (initials fallback) + DropdownMenu (name/email + Sign out). `variant`: `chip` (picker) or `avatar` (toolbar). Used by both. |
| `ProjectPickerHeader.tsx` | Project-picker top bar: logo, search, New Project, `ProfileMenu` |
| `ProjectSidebar.tsx` | Left nav; animates 320px↔0 (spring); hosts Nodes/Workflows/Chats/Assets tabs; opacity-only tab transitions |
| `Sidebar/` (`NodesTab`, `WorkflowsTab`, `ChatsTab`) | Tabbed sidebar content (drag nodes, list/save workflows, list chats) |
| `Toolbar.tsx` | Top bar: run, **Radix DropdownMenu** workflows list, **Radix Dialog** save modal, save status (Cmd+S), `ProfileMenu` |
| `ProjectContextBar.tsx` | Project chip, status pill, `type → subtype`, client + industry, colors, tabular-nums cost popover, Settings / Switch |

### Auth / project entry
| Component | Purpose |
|---|---|
| `AuthLayout.tsx` | Auth screen wrapper + exported `SF`/`SFDisplay` fonts and shared auth CSS |
| `CustomLoginPage.tsx` | Username/password login form (`auth.login`) — user-customized |
| `ProjectCard.tsx` | Project tile (grid/list); calm hover on **ring + shadow** (no scale); `StatusControl` dropdown |
| `ProjectCreationOverlay.tsx` + `ProjectCreation/` | **Radix Dialog** 3-step new/edit wizard: `StepBasicInfo` (Project) · `StepVisualIdentity` (Creative brief) · `StepReview`, on the shared `ui.tsx` form primitives. (`StepIndicator` and the old `StepProjectType`/`StepTargetAudience`/`StepAIInstructions`/`StepCollaborators` were removed.) |

### Assets / chat
| Component | Purpose |
|---|---|
| `ChatDrawer.tsx` | Creative-assistant chat as a **Radix Dialog** (drawer + asset picker); markdown + code-copy; inline asset attach |
| `AssetGrid.tsx` | 2-col asset browser; ring cards + image outlines; drag-drop upload; search/filter; favorite/add-to-canvas/delete |
| `AssetPreviewModal.tsx` | **Radix Dialog** lightbox (media + metadata sidebar); shared by the sidebar and the global expand modal |
| `AssetExpandModal.tsx` | Global full-screen preview (renders `AssetPreviewModal`, driven by `useStore.expandedAsset`) |
| `ExpandableAssetWrapper.tsx` | Calm expand affordance (ring hover + corner icon, no scale) for node outputs |
| `ReferenceStrip.tsx` | Horizontal reference-image strip with per-item role dropdown + delete (Imagen/Veo/Lyria) |
| `VideoPreview.tsx` / `AudioPreview.tsx` | Inline video (autoplay/loop) and audio (play/pause + **deterministic** waveform) |
| `DeleteAssetModal.tsx` / `DeleteProjectModal.tsx` | **Radix AlertDialog** confirm dialogs |

### Inputs / feedback
| Component | Purpose |
|---|---|
| `AskAIButton.tsx` | "Ask AI to fill" helper (Sparkles, teal `#0097A7/10` bg + `/25` ring) |
| `ParameterSlider.tsx` | Labeled range slider (tabular-nums value, accent configurable, default teal) |
| `ToggleSwitch.tsx` | **Flat teal pill** switch (rewritten from the old skeuomorphic styled-components toggle); `size` presets `navbar`/`node` |
| `ToastContainer.tsx` | Top-center toasts (spring), color-coded by type, auto-dismiss + close |
| `OfflineIndicator.tsx` | Bottom-center online/offline badge (green `#34C759` / red `#FF453A`) |
| `ErrorBoundary.tsx` | Catches render errors; on-palette Try-again / Reload buttons |
| `Skeleton.tsx` | Loading placeholders (`#2a2a2a` pulse): workflow/project/asset/node variants |
| `PerfHUD.tsx` | Dev performance overlay (validation time, cache hits, render count; green/yellow/red budget) |

> Two shared **primitive** files back the redesign, both exporting flat inputs, teal focus rings, calm press, and normal-case labels:
> `src/components/ProjectCreation/ui.tsx` (`StepShell`, `StepHeader`, `Field`, `TextField`, `TextArea`, `Chip`, `SelectTile`) and
> `src/nodes/ui.tsx` (`NodeField`, `NodeLabel`, `NodeInput`, `NodeTextArea`, `NodeSelect`, `NodeToggle`, `RunButton`, `NodeOutput`).
