<div align="center">

# 🛠️ Interactive 19″ Rack Lab Configurator

**A web-native engineering sandbox for designing, validating and stress-testing EIA-310-D server-rack layouts — without touching real hardware.**

> Part of the **rz-cloud.work** ecosystem · Browser-only · Zero backend · Production telemetry-safe

[![license: ISC](https://img.shields.io/badge/license-ISC-22d3ee.svg)](#license)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](#tech-stack)
[![Three.js · R3F v9](https://img.shields.io/badge/Three.js-R3F%20v9-000000.svg)](#tech-stack)
[![Vite ESM](https://img.shields.io/badge/Vite-ESM-646cff.svg)](#tech-stack)
[![Tailwind v4](https://img.shields.io/badge/Tailwind-CSS%20v4-38bdf8.svg)](#tech-stack)
[![Zustand v5](https://img.shields.io/badge/Zustand-v5-6366f1.svg)](#tech-stack)
[![Vitest 2](https://img.shields.io/badge/Vitest-2.x-6e9f18.svg)](#testing)

</div>

---

## ✨ Why this exists

Spreadsheets can't model a 42U cabinet. Vendor PDFs can't show you *what happens* when you stack a 4U server on top of a 1U switch. Most rack-visualizer SaaS products either render the geometry but won't let you drag anything, **or** they drag but ignore EIA-310 spacing rules and let chassis intersect.

This sandbox fixes both sides of that trade-off. The configurator is a single-page React + WebGL app that renders a real 19-inch rack frame — **2-post**, **4-post**, or full **cabinet with hinged glass door** — lets you inject 11 hardware chassis types from a structured catalog, drag them around at 60 Hz inside a transient dragstore, and gives you instant visual *and* numerical feedback on what will physically fit, alongside aggregate telemetry for total power draw per cabinet.

The whole thing runs client-side in your browser. There is no server, no account, no telemetry.

---

## 🎬 What you can do

| Capability | Detail |
|---|---|
| 🌀 **Dual-mode rendering** | Flip the viewport between a fully-PBR **`3D RENDER`** view (HDR reflections, contact shadows, brushed-metal chassis) and a precision **`BLUEPRINT`** schematic (flat fills, cyan-300 wireframes, U1..U42 rail labels, no shadow pass). |
| 🧲 **60 Hz drag-and-drop** | Drag any chassis with hardware-captured pointer events. Snap math runs at cursor frequency; chassis tracks at 60 fps inside a transient `useDragStore` so the persistent store never re-renders mid-drag. |
| 🛡️ **Collision prevention** | Each drop is checked against the rack bounds **and** against every other installed chassis via floating-point Y-range overlap. Out-of-bounds or overlapping positions flip the live drag-ghost to crimson. |
| ⚡ **Power-draw telemetry** | Live `TOTAL_DRAW` and `CAPACITY_USE` readouts in the sidebar HUD update on every change; UPS units report a *negative* contribution to model battery discharge. |
| 🎚️ **Hardware tuning** | Per-chassis sliders adjust `POWER_TARGET` (50–1200 W) and `DEPTH_SPEC` (10–100 cm) in real time. |
| 🧭 **Smart camera** | Blueprint mode auto-snaps the camera to a perpendicular schematic view and locks orbit rotation while preserving pan/zoom (both default-`true` on drei's `OrbitControls`). |
| 🚪 **Cabinet door animation** | In `CABINET` rack mode, the front glass door rotates π/2 around its left hinge via a time-independent exponential lerp inside `useFrame`. |
| 🪟 **Zen Mode** | One-click HUD retraction — sidebars translate off-screen and restore canvas event-domination for clean screenshots and orbit freedom. |

> [!TIP]
> In `BLUEPRINT` mode, drag-and-drop math, snap rules, collision feedback, and the cabinet door animation all work identically — only the *visual* presentation flips between photoreal PBR and CAD-style wireframe.

---

## 🧱 Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Frontend** | React 19 · TypeScript (strict, ES2022, bundler resolution) | First-class JSX automatic runtime, sharp typing at the chassis-component props boundary. |
| **Build tooling & styles** | Vite (ESM) · Tailwind CSS v4 | Lightning-fast esbuild pipeline. Tailwind v4 uses the new `@tailwindcss/vite` plugin — see [Quick Start](#quick-start). |
| **3D engine** | Three.js · `@react-three/fiber` v9 · `@react-three/drei` v10 | React-flavored WebGL scene graph with troika-powered SDF text and HDR environment maps. |
| **State management** | Zustand v5 | Two stores: **persistent** `useConfiguratorStore` for rack data + UI flags + rack-type + door state, and **transient** `useDragStore` for 60 Hz drag snapshots. The split eliminates the render-storm you would otherwise see on every pointer-move tick. |
| **Testing** | Vitest 2 | Pure-Node test runner for the snap/collision math and the drag command-pattern handlers — no canvas, no DOM stubs required. |

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

Vite pre-bundles dependencies in `node_modules/.vite`. After bumping a major version (especially `@react-three/fiber`, `three` or `@tailwindcss/vite`), the cache can hold stale ESM resolutions and lead to **white-screen / partially loaded modules** at runtime. Force a clean resolution:

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
<summary><strong>TypeScript integrity / "cannot find module" errors after a clone</strong></summary>

Make sure your editor has hydrated the workspace before running typecheck. In VS Code: `Ctrl+Shift+P → "TypeScript: Restart TS Server"`. Then run a strict no-emit pass:

```bash
npx tsc --noEmit
```

This surfaces type errors without producing a `dist/` directory. Combine with the Vite cache reset above when chained dependency upgrades land.

</details>

> [!TIP]
> A consolidated "Local Sandbox Debugging" cheat-sheet lives in [README_CONFIGURATOR.md §9](./README_CONFIGURATOR.md#9-local-sandbox-debugging) — covering React 19 StrictMode double-mount behaviour, devtools snapshot reset, and the specific failure modes for the dual-store architecture.

---

## 📦 Complete Hardware Catalog

All 11 chassis types are declared in a single TypeScript union (`src/types/rack.types.ts`) and dispatched by `HardwareMapper.tsx` to a dedicated React component. Each entry tells the store its **default U-height**, **default depth (m)**, and **default power draw (W)** at insertion time — values that the right-sidebar inspector can later override per-asset via `POWER_TARGET` and `DEPTH_SPEC` sliders.

The HUD sidebar groups them into five **catalog sections** that match the rz-cloud.work classification:

### Compute

| Type | Sizes | Depth | P_draw (default) | Visual signature |
|---|---|---|---|---|
| 🖥 **Server** | **1U** / **2U** / **4U** *(user-selectable)* | `0.60 m` | `150 / 300 / 500 W` | Brushed-metal chassis · front bezel · cyan selection halo |

### Networking

| Type | Sizes | Depth | P_draw (default) | Visual signature |
|---|---|---|---|---|
| 🔀 **Switch**       | **1U** *(forced)* | `0.30 m` | `50 W`  | 2×24 RJ45 grid · 48 LEDs · emissive cyan accent stripe |
| 🌐 **Router**       | **1U** / **2U**    | `0.40 m` | `80 / 150 W` | Dual PSU bays · vent grille · SFP+ cages · 4 status-LED spheres (LED #2 red) |
| 🔌 **Patch Panel**  | **1U** *(forced)* | `0.10 m` | `0 W` *(passive)* | 24 keystone jacks in a single instanced mesh |
| 🛡 **Firewall**     | **1U** *(forced)* | `0.30 m` | `40 W` | 8 RJ45 copper + 4 SFP+ cages + **striking red anodized bezel** + console port |

### Auxiliary

| Type | Sizes | Depth | P_draw (default) | Visual signature |
|---|---|---|---|---|
| 🔋 **UPS**        | **2U**     | `0.60 m` | `−1500 W` ⚠️ | Heavy dark chassis · glowing LCD panel · red power cylinder · 2 status spheres |
| ⌨️ **KVM Drawer** | **1U**     | `0.40 m` | `30 W` | Drawer slides forward `0.15 m` **on selection** · 17″ LCD unfolds to 36° tilt |

### Storage

| Type | Sizes | Depth | P_draw (default) | Visual signature |
|---|---|---|---|---|
| 💾 **JBOD** | **4U** | `0.65 m` | `600 W` | 36 hot-swap HDD sleds (3×12 instanced grid) · amber rebuild LEDs every 7th column · zinc release latches |
| 📦 **NAS**  | **2U** | `0.55 m` | `150 W` | 12 horizontal drive caddies (6×2 instanced grid) · left-anchored cyan OLED telemetry panel |

### Airflow Management

| Type | Sizes | Depth | P_draw (default) | Visual signature |
|---|---|---|---|---|
| ▫️ **Blanking Panel** | **1U** / **2U** *(user-selectable)* | `0.02 m` | `0 W` | Powder-coated dark face sheet · 2 black plastic snap-in clips |
| 🪮 **Cable Brush**   | **1U** *(forced)* | `0.02 m` | `0 W` | Solid metal frame · dense black bristle strip for cable pass-through |

> [!IMPORTANT]
> Only `Server` and `Blanking Panel` let you pick the U-height *at insertion*. All other types lock their form factor at the first drop. The right-sidebar `DEPTH_SPEC` slider continues to override depth at any time.

> [!WARNING]
> **UPS = −1500 W is intentional.** A UPS that is *supplying* power to downstream loads is modeled as discharging its battery — its contribution to `TOTAL_DRAW` shows negative. With all real loads added (positive watts), a working installation reports a *net negative* until the UPS charges. Drive the `PWR_TARGET` slider on the UPS into positive territory to simulate mains-failure mode where the unit starts recharging.

---

## 🧮 Mathematical & Architectural Invariants

The configurator is held together by three pure-math modules plus one immutable constant. They're documented here at the level a developer needs to confidently extend the catalog.

### 1. The single source of truth: `RACK_UNIT_HEIGHT`

```ts
// src/store/useConfiguratorStore.ts
export const RACK_UNIT_HEIGHT = 0.04445;   // meters — ≈ 4.445 cm (EIA-310-D)
```

Every other module (`snapToU`, `RackFrame`, `RackScrews`, `RackLabels`, every chassis geometry helper, `RackMountDetails`) imports this **one** constant. There is no second copy. A 42U rack therefore measures `42 × 0.04445 ≈ 1.866 m` of vertical interior space, perfectly aligned with the EIA-310-D mounting-hole spec.

### 2. Coordinate system: rack-local, floor-zero

$$\text{rack-local position: } \vec{p} = (x, y, z) \quad \text{where} \quad y=0 \text{ is the rack floor}$$

The chassis's `position[1]` is its **vertical centre**, never its bottom edge. `x` and `z` are lateral axes; the rack frame is centred at the world origin and shifted by `[0, height/2, 0]` so its bottom sits at `y=0`. All transient drag-state math treats this as a **3D matrix transformation** with the rack as origin — `useDragStore` records `Vec3` snapshots, never raw pixel coordinates.

### 3. Parity-aware snap (`snapToU`)

EIA-310-D mounting holes sit at **slot centres** for odd-unit chassis and **slot seams** for even-unit chassis. `snapToU` mirrors this:

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
> The test suite fuzzes `snapToU` with subnormals, `±Infinity`, `±Number.MAX_VALUE` and `NaN` to confirm graceful propagation. NaN inputs flow downstream to `checkDropValidity`, which explicitly rejects them — see the *“Geometric Collision Layer”* section of [the architecture reference](./README_CONFIGURATOR.md#3-geometric-collision-layer) for the full proof.

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
| Materials | PBR `MeshStandardMaterial` (brushed metal, emissive cyan / amber accents) | Flat `MeshBasicMaterial` in dark fill |
| Edge outlines | None | Cyan-300 `LineSegments` overlay (memoised `EdgesGeometry`) |
| Lights + HDR | HDR warehouse + directional shadows | Unmounted entirely — no shadow pass |
| Floor chrome | `<Grid>` + `<ContactShadows>` | Unmounted |
| Camera | `[1.5, 1.2, 1.5]`, free orbit | `[0, midY, 2.2]`, rotation locked, pan + zoom enabled |
| `<RackLabels>` | Hidden (`null`) | 84 `<Text>` markers along both rails |
| Drag math, snap, collision | **identical** | **identical** |
| Cabinet door animation | runs | suppressed (`!isBlueprint` gate) |

All blueprint-mode materials (`blueprintChassisMaterial`, `blueprintFrameFillMaterial`, `blueprintBezelMaterial`, `blueprintAccentMaterial`, `blueprintEdgeMaterial`) are module-scoped so a `viewMode` flip is a **reference swap, not an allocation** — no per-frame `new MeshBasicMaterial(...)`, no GPU re-uploads beyond the static pointer reshuffle.

### 6. HUD overlay (pointer-events isolation)

The repository mounts everything into one DOM tree:

```tsx
// src/App.tsx (simplified)
<div className="relative h-screen w-screen ...">            {/* stage */}
  <div className="absolute inset-0 z-0"><Scene /></div>     {/* R3F canvas */}
  <div className="relative z-10 pointer-events-none
                  h-full w-full">
    <ConfiguratorPanel />                                  {/* HUD overlay */}
  </div>
</div>
```

The HUD wrapper carries `pointer-events-none` so the entire overlay is **click-through by default** — the underlying WebGL canvas keeps receiving all pointer events (orbit, drag, hover). Every interactive HUD child (`<button>`, `<input type="range">`, inventory cards, the zen-mode toggle pill) must explicitly re-enable:

```tsx
<button className="... pointer-events-auto cursor-pointer ...">…</button>
```

This **Layered Pointer-Events** pattern lets a 3D-convenient HUD + a fully-interactive 3D viewport coexist in the same coordinate space without JS hit-testing. A deeper expansion (Zen Mode, Rack Type selector, Asset Diagnostics Inspector) lives in [README_CONFIGURATOR.md §8](./README_CONFIGURATOR.md#8-advanced-hud-system).

### 7. Rack Frame Topology

The persistent store carries a `rackType: '2-post' | '4-post' | 'cabinet'` flag. `RackFrame.tsx` reads it and renders three structurally distinct frames from the same primitive set (`POST_SIZE`, `BEAM_HEIGHT`, `FRAME_WIDTH`, `FRAME_DEPTH`):

| Mode | Posts | Beams | Extras |
|---|---|---|---|
| **2-post**   | 2 centre-mast posts           | 2 deep top/bottom support feet (depth `0.15 m`) | none |
| **4-post**   | 4 corner posts                | 4 thin top/bottom beams (depth `POST_SIZE`) | none |
| **cabinet**  | 4 corner posts                | 4 thin top/bottom beams                       | 2 side-wall panels (`opacity 0.85`) + opaque top roof + **pivoting translucent glass door** |

In **cabinet** mode, the glass door group is anchored at `[-FRAME_WIDTH/2, 0, FRAME_DEPTH/2]` (left hinge) and lerps its `rotation.y` towards `π/2` using a **time-independent exponential smoothing**:

```ts
doorGroupRef.current.rotation.y = THREE.MathUtils.lerp(
  doorGroupRef.current.rotation.y,
  isDoorOpen ? Math.PI / 2 : 0,
  1 - Math.exp(-8 * delta)   // ≈ 8 rad/s convergence rate
);
```

The lever of `useFrame`'s `delta` (frame dt) keeps the animation frame-rate independent — 30 fps and 144 fps produce visually identical door sweeps.

### 8. The two-store split (60 Hz drag safety)

Drag state resides in **its own** Zustand store (`useDragStore`) so the persistent configurator never re-renders mid-frame:

| Store | Cadence | Subscribers |
|---|---|---|
| `useConfiguratorStore` (persistent) | Low — drop / add / remove / mode toggle / rack-type flip / door toggle | ConfiguratorPanel (HUD), HardwareMapper (chassis dispatches), RackFrame, every chassis component for its own `selectedHardwareId` slice |
| `useDragStore` (transient) | High — ~60 Hz during active drag | **Only** `DropIndicator` (the green/red ghost) |

The split is enforced by code review: every R3F pointer handler mutates drag state via the transient store, **never** the persistent one.

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
│   │   └── rack.types.ts               # RackState · HardwareProps · HardwareType (11 literals) · Vec3
│   ├── store/
│   │   ├── useConfiguratorStore.ts     # Persistent: rack data + UI flags + rackType + isDoorOpen
│   │   └── useDragStore.ts             # Transient @60Hz drag snapshot (DropIndicator consumer only)
│   ├── hooks/
│   │   ├── useHardwareInteraction.ts   # React orchestration + window-level pointer fallback
│   │   ├── interactionHandlers.ts      # Pure pointer handlers (Vitest-mockable)
│   │   └── snapToU.ts                  # EIA-310-D parity-aware snap
│   ├── utils/
│   │   └── rackLayout.ts               # getChassisFootprint · checkDropValidity (ε = 1 mm)
│   ├── components/
│   │   ├── ui/
│   │   │   └── ConfiguratorPanel.tsx   # HUD overlay (Zen toggle, Rack Type selector, 5 catalog subgroups, Asset Diagnostics)
│   │   └── canvas/
│   │       ├── Scene.tsx               # <Canvas> root + camera-snap + viewMode gate
│   │       ├── HardwareMapper.tsx      # Exhaustiveness-switch dispatch for all 11 types
│   │       ├── Hardware/
│   │       │   ├── shared.tsx          # SelectionOutline (with optional position prop) · RackMountDetails · SchematicBox · blueprint palette
│   │       │   ├── Server.tsx          # 1U / 2U / 4U brushed-metal chassis
│   │       │   ├── Switch.tsx          # 1U · 2×24 RJ45 · emissive cyan accent
│   │       │   ├── Router.tsx          # 1U / 2U · dual PSU · vent · SFP+ cages · 4 LEDs
│   │       │   ├── PatchPanel.tsx      # 1U · 24 keystones
│   │       │   ├── Firewall.tsx        # 1U · 8 copper + 4 SFP+ · striking red bezel
│   │       │   ├── UPS.tsx             # 2U · LCD + red power button + LEDs
│   │       │   ├── KVMConsole.tsx      # 1U · slide-out drawer + unfolding 17″ LCD on selection
│   │       │   ├── JBOD.tsx            # 4U · 36 hot-swap HDD sleds (instanced) + amber LEDs
│   │       │   ├── NAS.tsx             # 2U · 12 caddies + cyan OLED telemetry
│   │       │   ├── BlankingPanel.tsx   # 1U / 2U airflow blocker + plastic snap-in clips
│   │       │   └── BrushPanel.tsx      # 1U cable brush strip
│   │       ├── Rack/
│   │       │   ├── RackFrame.tsx       # 2-post / 4-post / cabinet frames + lerp door animation
│   │       │   ├── RackScrews.tsx      # Instanced mounting screws (2·capacity total)
│   │       │   └── RackLabels.tsx      # 84 <Text> U-markers, blueprint-only
│   │       └── interactions/
│   │           └── DropIndicator.tsx   # Drag-ghost mesh (valid emerald / invalid crimson)
│   └── __tests__/                      # Vitest — pure-math + handler suites
└── README_CONFIGURATOR.md              # ⬅ Enterprise architectural deep dive (9-section reference)
```

---

## 🧪 Testing

Pure modules (`snapToU.ts`, `rackLayout.ts`, `interactionHandlers.ts`, `useConfiguratorStore`) are exhaustively unit-tested under Vitest 2. There is **no canvas, no DOM stubbing** in the test suites — all geometry and event-handler logic is exercised against typed mocks.

```bash
npx vitest --run         # one-shot CI mode (no `--run` would launch interactive watch)
npx vitest --watch       # explicit TDD-friendly watch mode
```

> [!TIP]
> The architectural reference ([README_CONFIGURATOR.md](./README_CONFIGURATOR.md)) lists exactly which invariants each test guards — read it before refactoring `snapToU`, `checkDropValidity` or the `DragInteractionContext` shape.

---

## 📜 Available Scripts

| Script | Action |
|---|---|
| `npm run dev`      | Boot the Vite dev server with HMR (http://localhost:5173). |
| `npm run build`    | `tsc --noEmit && vite bundle` — strict typecheck + production build into `./dist`. |
| `npm run preview`  | Serve the built `./dist` on `http://localhost:4173`. |

---

## 📚 Further Reading

- 📘 **[README_CONFIGURATOR.md](./README_CONFIGURATOR.md)** — the exhaustive **9-section** architectural deep dive. Particularly worth reading once you're about to touch: the **two-store split**, the **`viewMode` flip**, the **R3F v9 pointer-capture pattern** with `asElement` runtime narrowing, the **`RackFrame` lerp animation**, and the **complete hardware catalog with per-type depth / power / U-height citations**.
- 📐 [EIA-310 standard, 19-inch rack mounting](https://en.wikipedia.org/wiki/19-inch_rack) — the physical spec this sandbox emulates.
- 🌐 [rz-cloud.work](https://rz-cloud.work) — the parent ecosystem.

---

## 🪪 License

[ISC](./LICENSE) © 2026 rz-cloud.work contributors.
