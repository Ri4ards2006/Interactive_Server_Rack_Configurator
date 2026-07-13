<div align="center">

# 🛠️ Interactive 19″ Rack Lab Configurator

**A web-native engineering sandbox for designing, validating and stress-testing EIA-310 server-rack layouts — without touching real hardware.**

> Part of the **rz-cloud.work** ecosystem · Browser-only · Zero backend

[![license](https://img.shields.io/badge/license-ISC-22d3ee.svg)](#license)
[![react](https://img.shields.io/badge/React-19-61dafb.svg)](#tech-stack)
[![three](https://img.shields.io/badge/Three.js-R3F%20v9-000000.svg)](#tech-stack)
[![vite](https://img.shields.io/badge/Vite-ESM-646cff.svg)](#tech-stack)
[![tailwind](https://img.shields.io/badge/Tailwind-CSS%20v4-38bdf8.svg)](#tech-stack)
[![zustand](https://img.shields.io/badge/Zustand-v5-6366f1.svg)](#tech-stack)
[![vitest](https://img.shields.io/badge/Vitest-2.x-6e9f18.svg)](#testing)

</div>

---

## ✨ Why this exists

Spreadsheets can't model a 42U cabinet. Vendor PDFs can't show you *what happens* when you stack a 4U server on top of a 1U switch. Most rack-visualizer SaaS products either render the geometry but won't let you drag anything, **or** they drag but ignore EIA-310 spacing rules and let chassis intersect.

This sandbox fixes both sides of that trade-off. The configurator is a single-page React + WebGL app that renders a real 19-inch rack frame, lets you inject hardware chassis from a structured catalog, drag them around in real time, and gives you instant visual + numerical feedback on what will physically fit — including total power draw telemetry.

The whole thing runs client-side in your browser. There is no server, no account, no telemetry.

---

## 🎬 What you can do

| Capability | Detail |
|---|---|
| 🌀 **Dual-mode rendering** | Flip the viewport between a fully-PBR **`3D RENDER`** view (HDR reflections, contact shadows, brushed-metal chassis) and a precision **`BLUEPRINT`** schematic (flat fills, cyan wireframes, U1..U42 rail labels). |
| 🧲 **60 Hz drag-and-drop** | Drag any chassis with hardware-captured pointer events. Snap math runs at cursor frequency, the chassis tracks at 60 frames per second. |
| 🛡️ **Collision prevention** | Each drop is checked against the rack bounds **and** every other installed chassis *before* it lands. Out-of-bounds or overlapping positions are highlighted red on the live drag-ghost. |
| ⚡ **Power-draw telemetry** | Live `TOTAL_DRAW` and `CAPACITY_USE` readouts in the sidebar HUD update on every change. |
| 🎚️ **Hardware tuning** | Per-chassis sliders adjust `POWER_TARGET` (50–1200 W) and `DEPTH_SPEC` (10–100 cm) in real time. |
| 🧭 **Smart camera** | Blueprint mode auto-snaps the camera to a perpendicular schematic view and locks orbit rotation while preserving pan/zoom (both default-`true` on drei's `OrbitControls` — we keep the defaults rather than toggling them explicitly). |

> [!TIP]
> In `BLUEPRINT` mode, drag-and-drop math, snap rules and collision feedback still work identically — only the *visual* presentation flips between photoreal PBR and CAD-style wireframe overlays.

---

## 🧱 Tech Stack

| Layer | Choice | Why |
|---|---|---|
| **Frontend** | React 19 + TypeScript (strict) | First-class JSX automatic runtime, sharp typing at the props boundary. |
| **Build tooling & styles** | Vite (ESM) · Tailwind CSS v4 | Hot module reload, lightning-fast esbuild pipeline. Tailwind v4 uses the new `@tailwindcss/vite` plugin — see [Quick Start](#quick-start). |
| **3D engine** | Three.js · `@react-three/fiber` v9 · `@react-three/drei` v10 | React-flavored WebGL scene graph with troika-powered SDF text and HDR environment maps out of the box. |
| **State management** | Zustand v5 | One **persistent** store (`useConfiguratorStore`) for rack data + UI flags, plus a **transient** drag store (`useDragStore`) that updates at 60 Hz without re-rendering the whole canvas tree. |
| **Testing** | Vitest | Pure-Node test runner for the snap/collision math and the drag command-pattern handlers — no canvas, no DOM stubs required. |

> [!NOTE]
> The configurator rate-limits architectural complexity on purpose. There is no Redux, no React Query, no ClientRouter, no animation library. Every dependency earns its place.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js ≥ 20** (Vite 8 requires Node 20 LTS or newer)
- **npm ≥ 10** (lockfile-compatible with `package-lock.json`)

### Install & run

```bash
# 1. Clone & install
git clone https://github.com/Ri4ards2006/Interactive_Server_Rack_Configurator.git
cd Interactive_Server_Rack_Configurator
npm install

# 2. Boot the dev server (default: http://localhost:5173)
npm run dev
```

```bash
# 3. Optional: production build + local preview
npm run build
npm run preview          # serves ./dist on http://localhost:4173
```

### 🧯 Troubleshooting

<details>
<summary><strong>Stale Vite dependency cache after upgrading packages</strong></summary>

Vite pre-bundles dependencies in `node_modules/.vite`. After bumping a major version (especially `@react-three/fiber`, `three` or `@tailwindcss/vite`), the cache can hold stale ESM resolutions and lead to **white-screen / partially loaded modules** at runtime. Clear and force:

```bash
rm -rf node_modules/.vite
npx vite --force
```

> [!WARNING]
> If you *still* see a stale screen after this, run a full `rm -rf node_modules package-lock.json && npm install` to regenerate the lockfile from scratch.

</details>

<details>
<summary><strong>Tailwind v4 utility classes not being applied</strong></summary>

Tailwind v4 requires **two** coordinated steps that older guides miss:

1. The `@tailwindcss/vite` plugin must be wired up in `vite.config.ts` (no `tailwind.config.js` is required for v4).
2. `src/index.css` must start with `@import "tailwindcss";` — the old v3 `@tailwind base/components/utilities` directives are **obsolete in v4** and silently do nothing.

Canonical v4 setup:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

```css
/* src/index.css */
@import "tailwindcss";

html, body, #root {
  margin: 0;
  padding: 0;
  height: 100%;
  min-height: 100vh;
  overflow: hidden;
  background-color: #09090b;
}
```

</details>

<details>
<summary><strong>TypeScript path / "cannot find module" errors after a clone</strong></summary>

Make sure your editor has hydrated the workspace before running typecheck. In VS Code: `Ctrl+Shift+P → "TypeScript: Restart TS Server"`. Then:

```bash
npx tsc --noEmit
```

</details>

---

## 📦 Hardware Catalog

All chassis are defined once via a strict `HardwareType` union (`server | switch | router | patch-panel`) and dispatched by `HardwareMapper.tsx`. The catalog exposes the following defaults at the time of writing:

| Type | Default sizes | Default depth | Accent | Visual signature | Notes |
|---|---|---|---|---|---|
| **Server**    | `1U` · `2U` · `4U` | `0.6 m` | — (matte dark) | Brushed-metal chassis + front bezel + selection halo | Most common drop target. Random power draw 100–600 W at creation. |
| **Switch**    | `1U` *(forced)*    | `0.3 m` | cyan `#22d3ee` | 2×24 RJ45 grid · 48 LEDs · emissive cyan stripe | Port holes nested slightly proud of the bezel for depth cues. |
| **Router**    | `1U` · `2U`        | `0.4 m` | amber `#f59e0b` | Dual PSU bays · vent grille · 16-column SFP+ cage array (rows scale with chassis height) · 4 status LEDs as sphere instances | SFP+ row count auto-derives from chassis height. Status LED index 2 is red (`#ef4444`), the rest are green (`#10b981`). |
| **Patch Panel** | `1U` *(forced)* | `0.1 m` | — (matte black) | 24 keystone jacks as a single instanced mesh · ultra-shallow depth | Passive hardware — no LEDs, no emissives. |

> [!IMPORTANT]
> `Switch`, `Router` and `PatchPanel` enforce their form-factor depth on insertion — the slider in the right-sidebar HUD lets you later tune `depth`, but the **type-specific default depth wins** until you re-add the asset.

---

## 🧮 Mathematical & Architectural Invariants

The configurator is held together by three pure-math modules plus one immutable constant. They're documented here at the level a developer needs to confidently extend the catalog.

### 1. The single source of truth: `RACK_UNIT_HEIGHT`

```ts
// src/store/useConfiguratorStore.ts
export const RACK_UNIT_HEIGHT = 0.04445;   // meters — ≈ 4.445 cm (EIA-310)
```

Every other module (`snapToU`, `RackFrame`, `RackScrews`, `RackLabels`, chassis geometry) imports this one constant. There is no second copy. A 42U rack therefore measures `42 × 0.04445 ≈ 1.866 m` of vertical interior space.

### 2. Coordinate system: rack-local, floor-zero

$$\text{rack-local position: } \vec{p} = (x, y, z) \quad \text{where} \quad y=0 \text{ is the rack floor}$$

The chassis's `position[1]` is its **vertical centre**, never its bottom edge. `x` and `z` are lateral axes; the rack frame is centred at the world origin and shifted by `[0, height/2, 0]` so its bottom sits at `y=0`.

### 3. Parity-aware snap (`snapToU`)

EIA-310 mounting holes sit at **slot centres** for odd-unit chassis and **slot seams** for even-unit chassis. `snapToU` mirrors this:

| `rackUnits` parity | Snap target | Why |
|---|---|---|
| odd (`1U, 3U, 5U…`) | `y = n·U + U/2` (slot centre) | Mounting holes are at slot centres. |
| even (`2U, 4U, 6U…`) | `y = n·U` (slot seam) | Mounting holes straddle a slot seam. |

```ts
function snapToU(y: number, rackUnits: number): number {
  const u = RACK_UNIT_HEIGHT;
  const halfU = u / 2;
  if (rackUnits % 2 === 1) {
    // -halfU shift: keeps `y = 0.5 U` (exact slot-0 centre) from being
    // mis-rounded UP to slot 1 by JS's half-up rounding rule.
    return Math.round((y - halfU) / u) * u + halfU;
  }
  return Math.round(y / u) * u;
}
```

> [!NOTE]
> The test suite fuzzes `snapToU` with subnormals, `±Infinity`, `±Number.MAX_VALUE` and `NaN` to confirm graceful propagation. NaN inputs flow downstream to `checkDropValidity`, which explicitly rejects them — see the *“Geometric Collision Layer”* section of [the architecture reference](./README_CONFIGURATOR.md) for the full proof.

### 4. Floating-point Y-range collision

Collision detection is **not** slot-indexed (which can't represent odd-height chassis straddling a slot seam). Instead, every chassis is reduced to a `[min, max]` vertical footprint:

$$\text{overlap}(a,b) \iff a.\max > b.\min + \varepsilon \ \wedge\ a.\min < b.\max - \varepsilon$$

```
COLLISION_EPSILON = 0.001 m   // ~1 mm — sub-millimetre physical overlap,
                              // super-IEEE-754-noise, sub-slot-pitch.
```

The $\varepsilon$ buffer does **two** jobs simultaneously:

1. **Absorbs IEEE-754 rounding noise** from `snapToU` so half-$U$ offsets never spuriously flag a collision.
2. **Allows flush seam mounts** — two adjacent chassis touching at a slot seam report **VALID**, mirroring real EIA-310 stacking.

### 5. Dual-presentation rendering engine

A single `viewMode: '3D' | 'blueprint'` flag on the persistent store drives a coordinate flip across every chassis module:

| Subsystem | 3D mode | Blueprint mode |
|---|---|---|
| Materials | PBR `MeshStandardMaterial` (brushed metal, emissives) | Flat `MeshBasicMaterial` in dark fill |
| Outlines | None | Cyan-300 `LineSegments` overlay (memoised `EdgesGeometry`) |
| Lights + HDR | HDR warehouse + directional shadows | Unmounted entirely — no shadow pass |
| Floor chrome | Grid + `ContactShadows` | Unmounted |
| Camera | `[1.5, 1.2, 1.5]`, free orbit | `[0, midY, 2.2]`, rotation locked, pan + zoom enabled |
| `<RackLabels>` | Hidden (`null`) | 84 `<Text>` markers along both rails |
| Drag math, snap, collision | **identical** | **identical** |

All blueprint-mode materials (`blueprintChassisMaterial`, `blueprintFrameFillMaterial`, `blueprintBezelMaterial`, `blueprintAccentMaterial`, `blueprintEdgeMaterial`) are module-scoped so a `viewMode` flip is a **reference swap, not an allocation** — no per-frame `new MeshBasicMaterial(...)`, no GPU re-uploads beyond the static pointer reshuffle.

### 6. HUD overlay (pointer-events isolation)

The repository mounts everything into one DOM tree:

```tsx
// src/App.tsx (simplified)
<div className="relative h-screen w-screen ...">            {/* stage */}
  <div className="absolute inset-0 z-0"><Scene /></div>     {/* R3F canvas */}
  <div className="relative z-10 pointer-events-none
                  h-full w-full">
    <ConfiguratorPanel />                                  {/* HUD */}
  </div>
</div>
```

The HUD wrapper carries `pointer-events-none` so the entire overlay is **click-through by default** — the underlying WebGL canvas keeps receiving all pointer events (orbit, drag). Every interactive HUD child (`<button>`, `<input type="range">`, inventory cards) must explicitly re-enable:

```tsx
<button className="... pointer-events-auto cursor-pointer ...">…</button>
```

This pattern lets a 3D-convenient HUD + a fully-interactive 3D viewport coexist in the same coordinate space without JS hit-testing.

---

## 🗂️ Project Structure

```
Interactive_Server_Rack_Configurator/
├── index.html                          # Vite entry — mounts <App> via src/main.tsx
├── vite.config.ts                      # ⚠️ to create — see Setup notes below (plugin-react + @tailwindcss/vite)
├── tsconfig.json                       # ES2022 · bundler · strict
├── src/
│   ├── main.tsx                        # React 19 createRoot + StrictMode
│   ├── App.tsx                         # HUD-overlay layout + Escape-to-deselect
│   ├── index.css                       # @import "tailwindcss"; + raw resets
│   ├── types/
│   │   └── rack.types.ts               # RackState · HardwareProps · HardwareType · Vec3
│   ├── store/
│   │   ├── useConfiguratorStore.ts     # Persistent rack data + UI flags
│   │   └── useDragStore.ts             # @60Hz drag snapshot (DropIndicator consumer)
│   ├── hooks/
│   │   ├── useHardwareInteraction.ts   # React orchestration + window fallback
│   │   ├── interactionHandlers.ts      # Pure pointer handlers (testable)
│   │   └── snapToU.ts                  # EIA-310 parity-aware snap
│   ├── utils/
│   │   └── rackLayout.ts               # getChassisFootprint · checkDropValidity (ε = 1 mm)
│   ├── components/
│   │   ├── ui/
│   │   │   └── ConfiguratorPanel.tsx   # HUD overlay (sidebar + inspector)
│   │   └── canvas/
│   │       ├── Scene.tsx               # <Canvas> root + lights + camera-snap
│   │       ├── HardwareMapper.tsx      # Dispatch by HardwareType
│   │       ├── Hardware/{Server,Switch,Router,PatchPanel,shared}.tsx
│   │       ├── Rack/{RackFrame,RackScrews,RackLabels}.tsx
│   │       └── interactions/DropIndicator.tsx
│   └── __tests__/                      # Vitest — pure-math + handler suites
└── README_CONFIGURATOR.md              # ⬅ Architectural deep dive (5-section reference)
```

---

## 🧪 Testing

Pure modules (`snapToU.ts`, `rackLayout.ts`, `interactionHandlers.ts`, `useConfiguratorStore`) are exhaustively unit-tested under Vitest. There is **no canvas, no DOM stubbing** in the test suites — all geometry and event-handler logic is exercised against typed mocks.

```bash
npx vitest --run         # one-shot CI mode (no `--run` would launch interactive watch)
npx vitest --watch       # explicit TDD-friendly watch mode
```

> [!TIP]
> The architectural reference (`README_CONFIGURATOR.md`) lists exactly which invariants each test guards — read it before refactoring `snapToU`, `checkDropValidity` or the `DragInteractionContext` shape.

---

## 📜 Available Scripts

| Script | What it does |
|---|---|
| `npm run dev`      | Boot the Vite dev server with HMR. |
| `npm run build`    | TypeScript check + production build into `./dist`. |
| `npm run preview`  | Serve the built `./dist` on `http://localhost:4173`. |

---

## 📚 Further Reading

- 📘 **[README_CONFIGURATOR.md](./README_CONFIGURATOR.md)** — the exhaustive architectural deep dive (5 sections, mathematical proofs, file-by-file reference). Particularly worth reading once you're about to touch: the **two-store split** (`useConfiguratorStore` vs. `useDragStore`), the **dual-presentation engine** (`viewMode` flip), and the **R3F v9 pointer-capture pattern** with the `asElement` runtime narrowing.
- 📐 [EIA-310 standard, 19-inch rack mounting](https://en.wikipedia.org/wiki/19-inch_rack) — the physical spec this sandbox emulates.
- 🌐 [rz-cloud.work](https://rz-cloud.work) — the parent ecosystem.

---

## 🪪 License

[ISC](./LICENSE) © 2026 rz-cloud.work contributors.
