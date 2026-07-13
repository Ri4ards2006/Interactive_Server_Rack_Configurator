# Interactive Server Rack Configurator — Technical Architecture Blueprint

> **Status:** Production-ready. `tsc --noEmit` clean. Vitest suites passing across the four canonical test files:
> - `src/hooks/__tests__/snapToU.test.ts` — snap-math (parity, half-up rounding, fuzz on non-finite inputs).
> - `src/utils/__tests__/rackLayout.test.ts` — collision / bounds / `COLLISION_EPSILON` / fuzz.
> - `src/hooks/__tests__/interactionHandlers.test.ts` — drag command-pattern (`down / move / up` lifecycle, capture, store handoff).
> - `src/store/__tests__/useConfiguratorStore.test.ts` — store mutators + `viewMode` flip + persistence-shape independence.
>
> This document is the **definitive architectural reference** for the rack layout subsystem. It captures the design decisions, mathematical primitives, and pinning rules that make the 60 Hz drag pipeline feel rock-stable while every hardware type renders correctly in both 3D and Blueprint modes.
>
> 📘 **Looking for the project overview, tech stack, hardware catalog and quick-start setup?** See [README.md](./README.md). This file is the deeper dive into *why* the invariants look the way they do.

---

## Table of contents

1. [System Overview & Architecture](#1-system-overview--architecture)
2. [Coordinate Space & Snap Mathematics](#2-coordinate-space--snap-mathematics)
3. [Geometric Collision Layer](#3-geometric-collision-layer)
4. [R3F Interaction Pipeline](#4-r3f-interaction-pipeline)
5. [Dual-Presentation Layer (3D vs. Blueprint)](#5-dual-presentation-layer-3d-vs-blueprint)

---

## 1. System Overview & Architecture

The Configurator splits runtime state into **two separate Zustand stores** to eliminate React/Zustand render storms during high-frequency pointer-move ticks. The split is deliberate and architectural, not incidental.

### The two stores

| Store | Location | Purpose | Cadence |
|---|---|---|---|
| `useConfiguratorStore` | `src/store/useConfiguratorStore.ts` | Persistent rack data + UI-only flags. Backed by the `RackState` shape (capacity + installedHardware). | Low — only on user commits (drop / add / remove / mode toggle) |
| `useDragStore` | `src/store/useDragStore.ts` | Ultra-transient drag snapshot: `{ isDragging, dropPosition, isValid, rackUnits, depth }`. | High — ~60 Hz while dragging |

The persistent store **extends** the serializable `RackState` interface so the runtime shape and any future save/load format cannot drift apart:

```ts
export interface ConfiguratorState extends RackState {
  selectedHardwareId: string | null; // UI-only
  viewMode: '3D' | 'blueprint';      // UI-only
  // …mutators…
  toggleViewMode: () => void;
}
```

`RackState` itself contains only `{ capacity, installedHardware }` — the actual data we're configuring.

### Why two stores?

If the persistent store also held drag state, every pointer-move tick would:
1. Mutate `useConfiguratorStore` snapshot
2. Notify all subscribed React components
3. Trigger `useShallow` re-renders on **every** hardware chassis even though only one is being dragged
4. Invalidate `DropIndicator`'s zustand-level equality

At 60 Hz this caused visible jank. Decoupling drag into a tiny transient store with **only** the `DropIndicator` subscribed solves it:

```
                  ┌─────────────────────┐
   persistent ────► useConfiguratorStore │ (low cadence)
                  │  - capacity         │
   transient  ────► useDragStore        │ (60 Hz)
                  │  - dropPosition     │
                  │  - isValid          │
                  └──────────┬──────────┘
                             │
                  ┌──────────▼──────────┐
                  │   UI subscribers    │
                  │  ConfiguratorPanel  │ (renders summary + actions)
                  │  HardwareMapper     │ (dispatches by type)
                  │  DropIndicator      │ (renders ghost only)
                  │  RackLabels         │ (84× Text markers)
                  └─────────────────────┘
```

The persistence shape never contains drag state. Drag state never contains persistence data. They communicate via the **same** `installedHardware` reference (read-only from drag side).

### Why not React Context for UI flags?

Zustand's selector hooks (`useConfiguratorStore((s) => s.viewMode === 'blueprint')`) avoid the Context re-render storm. Components subscribe to the *slice* they care about — toggling `viewMode` does NOT re-render any chassis that doesn't read it. This is critical because we now read `viewMode` from every chassis component for the blueprint swap.

---

## 2. EIA-310-D Engineering Standard & Snap Mathematics

The rack's coordinate system is **rack-local** — every chassis position vector $\vec{p} = (x, y, z)$ is expressed in a frame where:

- $y = 0$ is the **rack floor** (bottom of the cabinet).
- The rack extends upward to $y = \texttt{capacity} \cdot U$ (top of the cabinet, currently `42 × U ≈ 1.86 m`).
- The chassis's `position[1]` is its **vertical center**.
- $x$ and $z$ are lateral axes; chassis widths and depths are flat $x$ / $z$ offsets.

### The 1U constant

EIA-310 (the international standard for 19-inch rack mounting) defines:

```
RACK_UNIT_HEIGHT = 0.04445  // meters, ≈ 4.445 cm
```

Defined once in `src/store/useConfiguratorStore.ts` and imported by every other module. There is no second copy.

### Parity-aware snap — the centering trick

Dragging a chassis past the cursor's snapped Y must respect **two** alignment conventions depending on the chassis height parity:

| Chassis parity | Snap target |
|---|---|
| Odd (`1U`, `3U`, `5U` …) | Center lands on **slot center**: $y = n \cdot U + \frac{U}{2}$ for $n = 0, 1, 2 \dots$ |
| Even (`2U`, `4U` …) | Center lands on **slot seam**: $y = n \cdot U$ for $n = 0, 1, 2 \dots$ |

This convention comes from real hardware: a 1U server's mounting holes are at slot *centers*, while a 2U server's holes are on a *seam*. The snap function is implemented in `src/hooks/snapToU.ts`:

```ts
function snapToU(y: number, rackUnits: number): number {
  const u = RACK_UNIT_HEIGHT;
  const halfU = u / 2;
  if (rackUnits % 2 === 1) {
    // Odd: center sits at slot centres (0.5U, 1.5U, 2.5U, ...).
    // Shift `y` by -halfU so Math.round references a slot-INDEX
    // (0, 1, 2, ...) rather than a slot-seam index, keeping a `y`
    // that exactly hits a slot centre from being mis-rounded to
    // the next higher slot.
    const slotIndex = Math.round((y - halfU) / u);
    return slotIndex * u + halfU;
  }
  // Even: center sits on slot seams (0, U, 2U, ...). Straight round.
  return Math.round(y / u) * u;
}
```

#### Why the $- \frac{U}{2}$ shift?

JavaScript's `Math.round(x)` follows the banker's-rounding-toward-+∞ rule at exact half-integers: `Math.round(0.5) === 1`, `Math.round(-0.5) === 0`. Without the shift, a 1U chassis dragged to exactly the **slot 0 centre** ($y = 0.5U$) would compute `Math.round(0.5) = 1`, snapping to `y = U + 0.5U = 1.5U` — slot 1. The $-halfU$ trick re-aligns the round-to-nearest grid so that $y = 0.5U$ sits exactly on slot-index 0.

The asymmetry on the negative side (where $-0.5$ rounds to $0$ instead of $-1$) means a chassis dragged precisely to slot 0's seam when below the floor snaps one slot *up*, not *down* — a designed-in small bias toward "snap to the floor" rather than "snap off the rack".

### The test invariant

We verify parity covers all five spectra:

| Input                                   | $\text{rackUnits}$ | Expected |
|----------------------------------------|--------------------|---------|
| `y = 0.6 U`                             | `1` (odd) | `0.5 U` |
| `y = U` (slot-1 center for 1U)             | `1` | `1.5 U` |
| `y = 1.4 U`                             | `2` (even) | `U` |
| `y = 1.5 U`                             | `2` | `2 U` (half-up round) |
| `y = 41.5 U` (top slot 41 centre, 1U)     | `1` | `41.5 U` (within capacity) |

Plus a fuzz block that fires IEEE-754-perturbed inputs (subnormals, `±MAX_SAFE_INTEGER`, `±Number.MAX_VALUE`, `±Infinity`, `NaN`) to confirm the function doesn't crash and handles non-real `y` gracefully (NaN propagates NaN, `±Infinity` is range-rejected downstream by `checkDropValidity`).

---

## 3. Geometric Collision Layer

Collision detection lives in `src/utils/rackLayout.ts`. The naive approach — indexing installed chassis in a sorted array and bisecting to find the slot — fails because:

1. Hardware is heterogeneous (chassis of different `rackUnits` heights interleaved arbitrarily).
2. Even when sizes match, two chassis whose footprints **touch at a seam** are physically distinct (1U servers stacking seam-to-seam).
3. Array-index checking breaks when a chassis straddles two "slots" (a 3U chassis overlapping slots 5 and 6, etc.).

### Solution: floating-point Y-range overlap

For every chassis (both the dragged ghost and every installed one), compute its vertical **footprint**:

```ts
function getChassisFootprint(y, rackUnits): { min, max } {
  const halfHeight = (rackUnits * RACK_UNIT_HEIGHT) / 2;
  return { min: y - halfHeight, max: y + halfHeight };
}
```

Then **two footprints overlap** iff:

$$
[\min_a, \max_a] \cap [\min_b, \max_b] \neq \varnothing \quad\iff\quad
\max_a > \min_b + \varepsilon \;\wedge\; \min_a < \max_b - \varepsilon
$$

The two-sided $\varepsilon$ buffer accommodates both:
- IEEE-754 rounding noise from the snap step (a chassis centred on $n \cdot U + U/2$ might have a $10^{-15}$ offset in its `max` due to floating-point math).
- Edges touching at a slot seam: max of one chassis = min of the next, neither strictly greater. The $\varepsilon$ makes that a **non-overlap** so two correctly-stacked chassis report VALID.

### The epsilon constant

```
COLLISION_EPSILON = 0.001  // meters = 1 mm
```

- Sub-millimetre: smaller than any meaningful physical overlap.
- Above IEEE-754 noise: `0.04445 + U/2` computed in floating-point never drifts more than ~$10^{-15}$, so 1 mm is a generous noise margin.
- Below chassis half-heights: any overlap must be at least the smallest slot pitch $U = 44.45 \text{ mm}$ to be a real collision.

### Fuzz robustness

`checkDropValidity` rejects non-finite values up-front:

```ts
if (!Number.isFinite(snappedY) ||
    !Number.isFinite(rackUnits) ||
    !Number.isFinite(capacity)) {
  return false;
}
```

Without this guard, NaN propagates through every `min < x` / `max > x` comparison (each producing `false`), and the function silently returns `true` — a malformed drop would be *accepted*. The early-return closes this gap.

### Bounds check

After the overlap check passes, a final bounds test rejects drops that overhang the rack:

```ts
if (drop.min < -COLLISION_EPSILON ||
    drop.max > capacity * RACK_UNIT_HEIGHT + COLLISION_EPSILON) {
  return false;
}
```

Both bounds use the same $\varepsilon$ so a chassis centred exactly at $y = 0$ (touching the floor) is accepted while one with center $y = -0.005$ is rejected.

### Why no integer-slot indexing?

One alternative we evaluated was a bitfield of 42 slots with bitwise collision queries. The trade-off:
- Pro: $O(1)$ collision queries.
- Con: cannot represent mid-slot positions ($n \cdot U + 0.5U$ for odd chassis), requires re-bucketed mathematics, and fails on 3U / heterogeneous heights.
- The Y-range overlap approach is $O(N)$ per query but $N$ is bounded by user input (≤ 42 / 1 = 42 in practice), which is cheap. We trade asymptotics for clarity.

---

## 4. R3F Interaction Pipeline

The pointer-event chain for drag is encoded across:

1. `useHardwareInteraction` (React orchestration, in `src/hooks/useHardwareInteraction.ts`)
2. `interactionHandlers` (pure command-pattern functions, in `src/hooks/interactionHandlers.ts`)
3. `DragInteractionContext` (the typed handoff between the two)

### The split

The hook **owns** React-specific concerns: `useState`, `useEffect`, `useRef`, `useCursor`, the Zustand selector subscriptions, the window-level drag-fallback handler. The handlers are **stateless**: they receive an event and a `ctx`, perform their action, and return.

This split was deliberate: handler logic can be unit-tested in pure-Node Vitest (no canvas, no React, no R3F) using a hand-built `ctx` mock. The current `interactionHandlers.test.ts` has 19 tests covering capture, snap chaining, collision routing, release lifecycle, and a full `down → move → up` integration.

### The DragInteractionContext shape

```ts
export interface DragInteractionContext {
  hardware: HardwareProps;
  isDragging: boolean;
  setIsDragging: Dispatch<SetStateAction<boolean>>;
  capturedPointerIdRef: MutableRefObject<number | null>;

  // Persistent-configurator actions — passed, not imported, so
  // tests mock the ctx without spinning up Zustand.
  selectHardware: (id: string) => void;
  updateHardwarePosition: (id: string, pos: Vec3) => void;
  readPersistentState: () => { capacity, installedHardware };

  // Transient dragstore actions.
  beginDrag: (snapshot) => void;
  updateDropPosition: (pos, isValid) => void;
  endDrag: () => void;
}
```

Every action the handler invokes flows through `ctx`. The handler never reaches into Zustand or ref-bound state directly. This makes the architecture trivially mockable.

### The R3F v9 native pointer-capture trick

R3F v9 (`@react-three/fiber@^9.6.1`) exposes the underlying DOM `Element` as `e.target` on every `ThreeEvent<T>`. The TypeScript intersection `ThreeEvent<T> = IntersectionEvent<T> & Properties<T>` resolves `target` to `PointerEvent['target'] = EventTarget | null` because `Properties<PointerEvent>` widens it.

This means **the methods we need** (`setPointerCapture`, `hasPointerCapture`, `releasePointerCapture`) only exist on `Element`, not on `EventTarget`. Without intervention, TypeScript rejects the call sites; without runtime narrowing, any non-Element target (window, document) crashes.

The fix lives in `src/hooks/interactionHandlers.ts`:

```ts
function asElement(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null;
}
```

`asElement` is a **runtime** narrowing guard (not a type-only cast): it returns `null` for any non-Element target so callers can compose with `?.`:

```ts
asElement(e.target)?.setPointerCapture(e.pointerId);
```

Cheap — single `instanceof` check at call site, ~ns. Defined once at module scope, no allocations per drag tick. Zero-overhead.

### The pointer-capture lifecycle

| Event | Action |
|---|---|
| `pointerdown` on chassis | Call `setPointerCapture(pointerId)` on the canvas element. Drag events now follow the cursor even when it leaves the chassis mesh. |
| `pointermove` | Run `snapToU(e.point.y, hardware.rackUnits)`, then `checkDropValidity(...)`. Mirror position to BOTH the persistent store (drives the chassis's visual position) and the transient dragstore (drives the `DropIndicator` ghost). |
| `pointerup` or `pointercancel` | Release capture if the element still holds it. Clear `capturedPointerIdRef.current = null`. Clear `isDragging = false`. |
| Window `pointerup` / `pointercancel` / `blur` | Belt-and-braces fallback (see below). |

### The belt-and-braces window-fallback

If the cursor leaves the chassis mid-drag, R3F's `onPointerUp` no longer fires (the raycaster no longer intersects). Two protections:

1. **`useThree().gl.domElement.setPointerCapture` at pointerdown** — the pointer is now bound to the canvas element, so the browser continues to fire pointer events.
2. **`window.addEventListener('pointerup' / 'pointercancel' / 'blur')` inside a `useEffect([isDragging])` cleanup arrow** — even if (1) fails for environmental reasons, the window-level fallback tears down state.

Pattern (paraphrased):

```ts
useEffect(() => {
  if (!isDragging) return;
  const endDrag = () => {
    setIsDragging(false);
    useDragStore.getState().endDrag();
    if (capturedPointerIdRef.current != null) {
      const canvas = document.querySelector('canvas');
      canvas?.releasePointerCapture(capturedPointerIdRef.current);
      capturedPointerIdRef.current = null;
    }
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  window.addEventListener('blur', endDrag);
  return () => { /* …remove listeners… */ };
}, [isDragging]);
```

This is the only part of the drag pipeline that lives inside `useHardwareInteraction` rather than `interactionHandlers`. **Why?** The window event has no `ThreeEvent.target` — synthesizing one would re-introduce the multi-canvas `querySelector('canvas')` ambiguity. Keeping this cleanup arrow local is the smaller wart.

---

## 5. Dual-Presentation Layer (3D vs. Blueprint)

The `viewMode: '3D' | 'blueprint'` flag on the configurator store flips the entire scene between two visual languages, conditionally affecting:

- Per-chassis material swap (PBR ↔ flat `MeshBasicMaterial`).
- Per-chassis `<SchematicBox>` edge overlay (cyan-300 `#67e8f9` `EdgesGeometry` outlines rendered via `LineBasicMaterial`).
- Camera position (`[1.5, 1.2, 1.5]` ↔ `[0, midY, 2.2]`).
- OrbitControls rotation lock (`enableRotate = true` ↔ `false`).
- `<RackLabels>` visibility (hidden ↔ 42×2 `<Text>` markers visible on both rails).
- Floor chrome (Grid + ContactShadows + lights all visible ↔ all unmounted).

### The toggle flow

```
┌────────────────────────────┐
│ User clicks "viewMode"     │
│ pill in the header         │
└─────────────┬──────────────┘
              ▼
┌────────────────────────────┐
│ toggleViewMode() fires     │
│ (Zustand set() with        │
│  ternary: '3D' → 'blueprint')│
└─────────────┬──────────────┘
              ▼
┌──────────────────────────────────────────────────────┐
│ Zustand subscribers re-render:                        │
│   - <ConfiguratorPanel> (re-reads viewMode for the    │
│      pill label + dot colour)                          │
│   - <SceneContents> useEffect ([viewMode, capacity,   │
│      camera, orbitRef]) fires                         │
│   - <RackLabels> re-reads useIsBlueprint() and        │
│      mounts/unmounts the 84 Text markers              │
│   - <RackFrame> re-renders with new material          │
│      + SchematicBox overlays                          │
│   - <RackScrews> re-renders with new instancedMesh    │
│      material                                         │
│   - 4 × <HardwareType> re-render ...                  │
└─────────────┬────────────────────────────────────────┘
              ▼
┌──────────────────────────────────────────────────────┐
│ Each chassis component's render is byte-different:    │
│   - chassisMaterial → blueprintChassisMaterial       │
│   - bezelMaterial    → blueprintBezelMaterial         │
│   - accentMaterial   → blueprintAccentMaterial        │
│   - castShadow=true  → castShadow=false (basic        │
│       materials don't react to light anyway)           │
│   - <SchematicBox>   → wrapped in {isBlueprint && ...}│
│       memoised EdgesGeometry on dimensions             │
└──────────────────────────────────────────────────────┘
```

### Why reference-based material swap?

Every material reference lives at module scope (`blueprintChassisMaterial`, `blueprintBezelMaterial`, `blueprintAccentMaterial`, `blueprintFrameFillMaterial`, `blueprintEdgeMaterial`). Allocated once at import time.

```ts
<mesh material={isBlueprint ? blueprintChassisMaterial : chassisMaterial}>
  <boxGeometry args={[CHASSIS_WIDTH, chassisHeight, hardware.depth]} />
</mesh>
{isBlueprint && (
  <SchematicBox width={...} height={...} depth={...} />
)}
```

This means **flipping `viewMode` re-uses the same Five `MeshBasicMaterial` instances** — no per-frame allocations, no `new MeshBasicMaterial(...)` calls inside the render loop, no GPU re-uploads beyond the material's static swap. Conditional render of `<SchematicBox>` is similarly zero-allocation per render path except the useMemo'd `EdgesGeometry` (one per chassis, cached on the dimension triple `width`, `height`, `depth`).

### Camera orchestration

`Scene.tsx` invokes `useThree()` and a `useRef`'d `OrbitControls` to imperatively snap the camera on `viewMode` change:

```ts
// BLUEPRINT_CAMERA_Z = 2.2 is defined at module scope inside Scene.tsx
// (it isn't exported — the snippet below references it for clarity).
useEffect(() => {
  const controls = orbitRef.current;
  if (viewMode === 'blueprint') {
    const midY = (capacity * RACK_UNIT_HEIGHT) / 2;
    camera.position.set(0, midY, BLUEPRINT_CAMERA_Z);   // 2.2 m
    controls.target.set(0, midY, 0);
    controls.enableRotate = false;                       // schematic purity
    controls.update();
  } else {
    camera.position.set(1.5, 1.2, 1.5);                  // 3D default
    controls.target.set(0, 0.8, 0);
    controls.enableRotate = true;
    controls.update();
  }
}, [viewMode, capacity, camera, orbitRef]);
```

In blueprint mode, the camera sits **z-aligned** (camera position's $z = 2.2$, target's $z = 0$, look direction is $-z$ — perpendicular to the rack face). The rotation lock forces the schematic to remain at this angle; pan + zoom remain enabled so the user can inspect individual chassis details.

### RackLabels

`src/components/canvas/Rack/RackLabels.tsx` mounts 84 `<Text>` markers from `@react-three/drei` (42 × 2 rails):

- Positioned at the **vertical centre** of each U-slot: `y = (u - 0.5) × RACK_UNIT_HEIGHT`.
- Located on the inner rails: `x = ±0.27`, near front face: `z = 0.39` (matches `RackScrews` for visual alignment with the screws that anchor each slot).
- `fontSize: 0.025`, `outlineColor: #000`, `outlineWidth: 0.005` — sharp SDF rendering with high-contrast halo.
- Self-hides in 3D mode via `if (!useIsBlueprint()) return null;`.

### Floor chrome unmounted in blueprint mode

`<Grid>`, `<ContactShadows>`, `<ambientLight>`, `<directionalLight>`, and `<Environment preset="warehouse">` are all wrapped in `!isBlueprint && (<>...</>)`. The schematic palette is intentionally unlit:
- `MeshBasicMaterial` does not react to lights.
- The blueprint view's "sharp, flat, high-contrast" aesthetic is undermined by procedural grids or soft shadows.
- Unmounting removes the shadow-map pass cost, which is meaningful on lower-end GPUs.

### The harness's invariants that survive the toggle

| Behavior | 3D mode | Blueprint mode |
|---|---|---|
| Drag snap math (`snapToU`) | unchanged | unchanged |
| Collision check (`checkDropValidity`) | unchanged | unchanged |
| `DropIndicator` valid/invalid color swap | emerald (`#10b981`) / red (`#ef4444`) ghost | emerald / red ghost |
| `useHardwareInteraction` pointer event chain | unchanged | unchanged |
| Selection halo (cyan-400 `#22d3ee` wireframe) | preserved | preserved (chassis behind it is flat, halo still pops) |
| Window-level pointer fallback | unchanged | unchanged |

If you find a behavior that changes between 3D and Blueprint beyond what's listed above, it's a bug.

---

## 6. Rack Frame Topologies (`rackType`)

The persistent store carries a `rackType: '2-post' | '4-post' | 'cabinet'` flag. `RackFrame.tsx` reads it and renders three structurally distinct frames from the same primitive set (`POST_SIZE = 0.04`, `BEAM_HEIGHT = 0.04`, `FRAME_WIDTH = 0.60`, `FRAME_DEPTH = 0.80`).

### Post + beam matrix

| Topology | Posts | Beams (top + bottom) | Extras |
|---|---|---|---|
| **`2-post`**  | 2 centre-mast posts at `x = ±postX`, `z = 0`     | 2 deep `0.15 m` beams tying them | Lightweight wall-mount bracket footprint |
| **`4-post`**  | 4 corner posts at `(±postX, *, ±postZ)`            | 4 thin `POST_SIZE` beams        | Open frame, no enclosure — standard telecom look |
| **`cabinet`** | 4 corner posts at `(±postX, *, ±postZ)`            | 4 thin `POST_SIZE` beams        | + 2 side-wall panels (`opacity 0.85`) + opaque top roof + pivoting translucent glass door |

### The cabinet door's frame-rate-independent lerp

Only the **`cabinet`** topology gets a door. The door group is anchored at `[-FRAME_WIDTH/2, 0, FRAME_DEPTH/2]` (left hinge pivot) and the rotation `y` is updated every frame inside `useFrame`:

```ts
const targetRot = isDoorOpen ? Math.PI / 2 : 0;
doorGroupRef.current.rotation.y = THREE.MathUtils.lerp(
  doorGroupRef.current.rotation.y,
  targetRot,
  1 - Math.exp(-8 * delta),   // ≈ 8 rad/s convergence rate
);
```

The `1 - exp(-k × delta)` form is **time-independent** — 30 fps, 60 fps and 144 fps produce visually identical door sweeps because the smoothing factor scales with the elapsed frame time. `k = 8` is empirical (≈ 80 ms to reach 95 % of `π/2`).

### Why this topology matters

- **Impedance matching of cable routing**: `2-post` frames deliberately omit side walls so patch cables can swing out of the rack laterally without intersecting geometry. `4-post` confines cables to the rear channel. `cabinet` sandwiches everything between solid walls — the only topology where brush panels (`brush` hardware type) become a meaningful airflow-management tool since the door isolates hot exhaust.
- **Snap tolerances preserved**: the parity-aware snap in `snapToU.ts` works identically across all three topologies. The topology only changes *visual envelope*, not the EIA-310-D slot pitch.

---

## 7. Complete Hardware Catalog

Eleven chassis types declared in `HardwareType` and dispatched by `HardwareMapper.tsx`. Each entry's **default U-height**, **default depth (m)** and **default power draw (W)** are seeded at insertion via `useConfiguratorStore.addHardware()`. The HUD sidebar inspector can then override `powerDraw` and `depth` per-asset via `POWER_TARGET` and `DEPTH_SPEC` sliders.

| Group | Type | Sizes (U) | Depth (m) | P_draw (W) | Geometry / visual highlights | Source file |
|---|---|---|---|---|---|---|
| Compute | 🖥 **Server**        | **1** / **2** / **4** *(user)* | `0.60` | `150 / 300 / 500` | Brushed-metal `MeshStandardMaterial`, near-black bezel, cyan selection halo | `Hardware/Server.tsx` |
| Networking | 🔀 **Switch**        | **1** *(forced)* | `0.30` | `50` | 2×24 RJ45 housing + nested hole geometry + per-port green/amber LED instances | `Hardware/Switch.tsx` |
| Networking | 🌐 **Router**        | **1** / **2**    | `0.40` | `80 / 150` | Dual PSU bays · vent grille instanced · SFP+ 16×N cages · 4 sphere LEDs (i === 2 red) | `Hardware/Router.tsx` |
| Networking | 🔌 **Patch Panel**   | **1** *(forced)* | `0.10` | `0` *(passive)* | 24 keystone jacks as a single instanced mesh | `Hardware/PatchPanel.tsx` |
| Networking | 🛡 **Firewall**      | **1** *(forced)* | `0.30` | `40` | 8 RJ45 copper + 4 SFP+ cages + **striking red anodized bezel** + console port | `Hardware/Firewall.tsx` |
| Auxiliary | 🔋 **UPS**           | **2** | `0.60` | **`−1500`** ⚠️ | Glowing cyan-blue LCD backlight · heavy red power cylinder · 2 status spheres | `Hardware/UPS.tsx` |
| Auxiliary | ⌨️ **KVMConsole**    | **1** | `0.40` | `30` | Drawer slides +0.15 m on selection · 17″ LCD unfolds to 36° tilt · brushed-aluminum keyboard tray | `Hardware/KVMConsole.tsx` |
| Storage | 💾 **JBOD**           | **4** | `0.65` | `600` | 36 hot-swap HDD sleds (3×12 instanced grid) · amber rebuild LEDs every 7th column · zinc release latches | `Hardware/JBOD.tsx` |
| Storage | 📦 **NAS**            | **2** | `0.55` | `150` | 12 horizontal caddies (6×2 instanced grid) · left-anchored cyan OLED telemetry panel | `Hardware/NAS.tsx` |
| Airflow | ▫️ **BlankingPanel** | **1** / **2** *(user)* | `0.02` | `0` | Powder-coated dark face sheet · 2 black plastic snap-in clips · `RackMountDetails noRails` | `Hardware/BlankingPanel.tsx` |
| Airflow | 🪮 **BrushPanel**    | **1** *(forced)* | `0.02` | `0` | Solid metal frame · dense black bristle strip · `RackMountDetails noRails` | `Hardware/BrushPanel.tsx` |

> [!WARNING]
> **`ups.powerDraw = −1500 W` is intentional.** It models a UPS *supplying* power to downstream loads — its battery is discharging into the system. The HUD's `TOTAL_DRAW` widget sums wattages linearly, so a working installation can report a net negative number until the UPS recharges. Drive the inspector `PWR_TARGET` slider on the UPS into positive territory to simulate mains-failure charging.

### Shared `<RackMountDetails>` — universal mounting ears

Every chassis above calls `<RackMountDetails height={…} depth={…} isBlueprint={…} />` (defined in `Hardware/shared.tsx`). It renders:

- **Two L-bracket mounting ears** at `x = ±0.235`, `z = 0.39` (front face), full chassis height.
- **Two rear side-brackets** for ear rigidity at `x = ±0.221`, `z = 0.37`.
- **Two drawer-slide rails** when `depth < 0.5 m` *and* the chassis hasn't passed `noRails` — visible structural detail so shallow devices don't appear to "float" without depth.

`BlankingPanel` and `BrushPanel` pass `noRails` because their real-world counterparts are flat inserts that don't need rear support.

### `SelectionOutline` gained a `position` prop

In `Hardware/shared.tsx`, the cyan selection halo's signature is now:

```ts
interface SelectionOutlineProps {
  rackUnits: number;
  depth: number;
  position?: [number, number, number];   // NEW since cabinet refactor
}
```

The new prop is required by `UPS.tsx`, `KVMConsole.tsx`, `JBOD.tsx`, `NAS.tsx`, `Firewall.tsx` and `BlankingPanel.tsx` because their chassis body is shifted on the Z axis to peak at `z = 0.39` (the front face), and the halo needs to track that offset rather than sit at `[0, 0, 0]`. Components that haven't been refactored (`Server.tsx`, `Switch.tsx`, `Router.tsx`, `PatchPanel.tsx`) still call `SelectionOutline` with the older two-argument shape — the prop is optional with a default of `[0, 0, 0]`.

---

## 8. Advanced HUD System

The HUD overlay is rendered by `ConfiguratorPanel.tsx`, mounted above the R3F `<Canvas>` inside App.tsx. Its architectural pattern is **Layered Pointer-Events** — three nested DOM layers cooperate so that the canvas never loses drag/orbit focus to a HUD element that the user isn't actively interacting with.

### The pointer-events stack

```tsx
// src/App.tsx — three nested layers
<div className="relative h-screen w-screen ... overflow-hidden">
  {/* Layer 1: R3F canvas — receives ALL events (orbit, drag, hover) */}
  <div className="absolute inset-0 z-0">
    <Scene />
  </div>

  {/* Layer 2: HUD overlay — pointer-events-none on the wrapper,
      individual interactive children re-enable pointer-events-auto */}
  <div className="relative z-10 pointer-events-none h-full w-full">
    <ConfiguratorPanel />
  </div>
</div>
```

Inside `ConfiguratorPanel.tsx` the top-level wrapper carries `pointer-events-none`, and **every interactive child** explicitly opts-in:

| Element | `pointer-events` required |
|---|---|
| Zen-Mode toggle pill (`top center HUD`)           | `pointer-events-auto` |
| Left aside (System / Rack Type / Catalog)         | `pointer-events-auto` |
| Right aside (Inventory + Asset Diagnostics)       | `pointer-events-auto` |
| All `<button>` cards in the catalog              | inherited from aside (`pointer-events-auto`) |
| Zen-mode collapse animation                      | adds `-translate-x-12` + `pointer-events-none` so re-clicking "show UI" mid-transition doesn't double-fire |

The **3D canvas stays interactive through every HUD transition** because `pointer-events: none` propagates down from the wrapper. A chassis orbit or drag continues mid-fade without any JS hit-testing intervention.

### Five catalog subgroups (HUD sidebar groups)

The left aside's `[ INJECT … ]` blocks reflect the rz-cloud.work hardware classifications — five of them:

| Group | Items |
|---|---|
| `[ INJECT COMPUTE ]`      | Server 1U / 2U / 4U |
| `[ INJECT NETWORKING ]`   | Switch 1U · Router 1U · Router 2U · Patch Panel 1U · Firewall 1U |
| `[ INJECT AUXILIARY ]`    | UPS 2U · KVM Drawer 1U |
| `[ INJECT STORAGE ]`      | JBOD 4U · NAS 2U |
| `[ INJECT AIRFLOW ]`      | Blanking Panel 1U · Blanking Panel 2U · Cable Brush Panel 1U |

Each `<button>` carries the same hover/active micro-interaction: `hover:border-cyan-500 hover:text-cyan-400 hover:bg-cyan-950/10 active:scale-95`.

### Asset Diagnostics Inspector (right aside)

The right aside runs in two modes:

- **No selection** → renders the empty-inventory placeholder (`NO MOUNTED CHASSIS — LOAD UNIT IN LEFT PANEL`) when installedHardware is empty.
- **Selection active** → renders the **Asset Diagnostics Inspector** with:
  - Title chip showing the asset's current U-range (`U_n` for 1U, `U_n-m` for 2U+).
  - Two **Shifter** buttons (▲ ▼) — `shiftHardware('up' | 'down')` moves the chassis by `±RACK_UNIT_HEIGHT` only if `checkDropValidity(...)` agrees.
  - **`PWR_TARGET`** slider — `min=50 max=1200 step=10` integer watts.
  - **`DEPTH_SPEC`** slider — `min=0.1 max=1.0 step=0.05` meters.
  - `[ DESELECT ASSET ]` button — calls `selectHardware(null)` (same behaviour as the `Escape` keybind registered in `App.tsx`).

### Statistical HUD widgets

The `[ VIEWPORT_SETTING ]` block also hosts the **capacity utilisation bar**:

```ts
utilizationPct = Math.min(100, (usedUnits / capacity) * 100)
```

…which switches from cyan to red glow when utilisation exceeds 90 %, and two readouts:
- `TOTAL_DRAW` (sum of `powerDraw` across all installedHardware, formatted with `.toLocaleString()`)
- `NODE_COUNT` (count of installedHardware entries)

> [!TIP]
> Because UPS has a *negative* `powerDraw` (−1500 W by default), `TOTAL_DRAW` can read **negative** when only a UPS has been injected. This is correct arithmetic and not a bug — it reflects the modelled battery-discharge direction.

### Rack Type Selector

A three-way segmented control above the stats block drives the persistent `rackType` state:

```tsx
// pseudo
<button onClick={() => setRackType('2-post')}>{2-POST}</button>
<button onClick={() => setRackType('4-post')}>{4-POST}</button>
<button onClick={() => setRackType('cabinet')}>{CABINET}</button>
{rackType === 'cabinet' && (
  <button onClick={() => setDoorOpen(!isDoorOpen)}>
    {isDoorOpen ? '[ CLOSE DOOR ]' : '[ OPEN DOOR ]'}
  </button>
)}
```

The `[ OPEN DOOR ]` / `[ CLOSE DOOR ]` toggle is conditionally rendered only when `rackType === 'cabinet'`; clicking it flips the boolean that the `RackFrame` lerps against.

---

## 9. Local Sandbox Debugging

A consolidated cheat-sheet for the common failure modes that fall out of this specific stack combination (React 19 + StrictMode + Zustand v5 + R3F v9 + Vite 8).

### Cache + integrity triage (canonical sequence)

Run these in order when something renders incorrectly but the terminal shows no TypeScript or build errors:

```bash
# Step 1 — clear Vite's prebundled dependency cache
rm -rf node_modules/.vite

# Step 2 — force subsequent dev start to re-prebundle
npx vite --force

# Step 3 — strict TypeScript pass with no emit
npx tsc --noEmit

# Step 4 (nuclear) — full reinstall from the lockfile
rm -rf node_modules package-lock.json
npm install
```

> [!NOTE]
> **Step 3 alone** is the right answer when a refactor introduces type drift that Vite's bundler silently `--isolatedModules`-skips. The combined error surface is `"X is declared but never read"` plus a missing-module export — both surface quickly under `tsc --noEmit`.

### Common failure modes specific to this project

| Symptom | Likely root cause | First thing to try |
|---|---|---|
| UI overlays render but everything is invisible / collapsed | Tailwind v4 utilities not processed (missing `@import "tailwindcss";` or missing `@tailwindcss/vite` plugin) | Add both per the [Setup section](./README.md#quick-start) |
| Dev server boots but 3D canvas is blank, terminal logs JSX syntax error | `@vitejs/plugin-react` not wired into `vite.config.ts` | Add it to the `plugins: [react(), tailwindcss()]` list |
| Tray/KVM fails to slide out on selection | `interaction.isSelected` not propagating through `useHardwareInteraction` hook | Open `useHardwareInteraction.ts` and confirm `interaction.isSelected` is in the returned object |
| `selectHardware(null)` does not deselect via Escape | Listener registered in `App.tsx`'s `useEffect` is stale (closure over initial `null`) | Confirm `selectHardware` is in the `useEffect` dependency array |
| Drag-ghost flickers or never shows | `useDragStore.updateDropPosition` is being called without an `isValid` boolean | Both arguments are required; pass `isValid: true` as a default |
| Cabinet door doesn't open / closes instantly | `useFrame` lerp target snap not honouring dt | Recompute the smoothing factor as `1 - Math.exp(-k * delta)` (not a constant) |
| `TOTAL_DRAW` reads negative when only a UPS is mounted | Working as designed (battery discharge modelling) | Add positive-wattage loads to bring the sum positive |
| `capacity` slider snaps to 42 when typing custom | The store accepts `capacity` mutation but no setter exposed in `ConfiguratorPanel.tsx` | Drive `setCapacity` directly via `useConfiguratorStore.setState` in devtools |

### React 19 + StrictMode double-invocation

The `main.tsx` entrypoint wraps `<App />` in `<React.StrictMode>`. In development this **double-invokes** every component's body and effect cleanup. Two side effects to check:

1. **Dragstore cross-talk** — `useDragStore.beginDrag` writes `dropPosition: [0, (rackUnits*U)/2, 0]`. In StrictMode dev this can fire twice, seeding the indicator to a slightly off-centre location. The visual impact is nil because the first move event overwrites it.
2. **HDR environment async load** — `<Environment preset="warehouse" />` is async. Its first emit may resolve *after* the second component mount, briefly blanking reflections. This is expected and disappears in the production build.

### Devtools snapshot reset

If a chassis gets into a weird `position` (NaN, ±Infinity) you can reset the entire persistent store from devtools:

```js
// In the browser console while the app is running
useConfiguratorStore = window.__ZUSTAND_DEVTOOLS_GLOBAL__  // not exposed by default

// Easier: invoke the mutators directly via the Store debug namespace
// (no production code path required)
useConfiguratorStore.setState({
  installedHardware: [
    { id: 'reset', type: 'server', rackUnits: 2, powerDraw: 250, depth: 0.6, position: [0, 0.04445, 0] },
  ],
});
```

> [!CAUTION]
> Resetting via `setState` bypasses the mutator's invariants temporarily. Prefer `removeHardware(...)` and `addHardware(...)` to recover normal state, then save a clean layout.

---

## Appendix: file-by-file reference

| File | Purpose |
|---|---|
| `src/store/useConfiguratorStore.ts` | Persistent rack data + UI flags + mutators. Defines `RACK_UNIT_HEIGHT` + chassis geometry constants. New state: `rackType`, `isDoorOpen`, `setRackType`, `setDoorOpen`. Type-specific default `powerDraw` / `depth` per `HardwareType` (UPS = -1500 W, JBOD = 600 W, etc.). |
| `src/store/useDragStore.ts` | Transient drag snapshot for 60 Hz updates. Subscribers: `DropIndicator` only. |
| `src/types/rack.types.ts` | `RackState`, `HardwareProps`, `HardwareType` *(11 literals)*, `Vec3`. |
| `src/hooks/snapToU.ts` | Pure `snapToU(y, rackUnits)` function with parity-aware shift trick. |
| `src/hooks/interactionHandlers.ts` | Pure drag handlers (`handlePointerDown` / `Move` / `Up`) consuming a `DragInteractionContext`. Module-private `asElement` runtime guard. |
| `src/hooks/useHardwareInteraction.ts` | React orchestration layer + window-level pointer fallback. |
| `src/utils/rackLayout.ts` | `checkDropValidity`, `getChassisFootprint`, `COLLISION_EPSILON` (= 1 mm). |
| `src/components/canvas/Scene.tsx` | R3F canvas root, lights + chrome, camera-snap `useEffect`, OrbitControls ref. |
| `src/components/canvas/Rack/RackFrame.tsx` | Outer metal frame. Three topologies: 2-post / 4-post / cabinet. Cabinet variant includes translucent glass door with frame-rate-independent lerp rotation. |
| `src/components/canvas/Rack/RackScrews.tsx` | Mounting screws — single instanced mesh per capacity. |
| `src/components/canvas/Rack/RackLabels.tsx` | 84 `<Text>` markers visible in blueprint mode. |
| `src/components/canvas/Hardware/shared.tsx` | `SelectionOutline` *(now accepts optional `position` prop)*, `SchematicBox`, `RackMountDetails` *(universal ears + side rails)*, blueprint palette, `useIsBlueprint()`. |
| `src/components/canvas/Hardware/Server.tsx` | 1U / 2U / 4U brushed-metal chassis. |
| `src/components/canvas/Hardware/Switch.tsx` | 1U · 2×24 RJ45 grid · emissive cyan accent. |
| `src/components/canvas/Hardware/Router.tsx` | 1U / 2U · dual PSU bays · vent grille instanced · SFP+ cages · 4 sphere status LEDs. |
| `src/components/canvas/Hardware/PatchPanel.tsx` | 1U · 24 keystones (keystones instanced). |
| `src/components/canvas/Hardware/Firewall.tsx` | 1U · 8 RJ45 copper + 4 SFP+ cages · **striking red anodized bezel** + console port. |
| `src/components/canvas/Hardware/UPS.tsx` | 2U · LCD panel + red power cylinder + 2 status spheres. |
| `src/components/canvas/Hardware/KVMConsole.tsx` | 1U · slide-out drawer + unfolding 17″ LCD on selection (animated). |
| `src/components/canvas/Hardware/JBOD.tsx` | 4U · 36 hot-swap HDD sleds (3×12 instanced) + amber rebuild LEDs. |
| `src/components/canvas/Hardware/NAS.tsx` | 2U · 12 horizontal caddies (6×2 instanced) + cyan OLED panel. |
| `src/components/canvas/Hardware/BlankingPanel.tsx` | 1U / 2U airflow face sheet + plastic snap-in clips. |
| `src/components/canvas/Hardware/BrushPanel.tsx` | 1U cable brush strip. |
| `src/components/canvas/HardwareMapper.tsx` | Exhaustiveness-switch dispatch across all 11 hardware types. |
| `src/components/canvas/interactions/DropIndicator.tsx` | Drag-ghost mesh; reads `useDragStore` valid/invalid flag; emerald (`#10b981`) / crimson (`#ef4444`) ghost. |
| `src/components/ui/ConfiguratorPanel.tsx` | HUD overlay: Zen toggle, Rack Type selector, View Mode pill, stats, 5 catalog subgroups, inventory, Asset Diagnostics Inspector, Shifters. |
| `src/hooks/__tests__/{snapToU,interactionHandlers}.test.ts` | Pure-math + command-pattern test suites. |
| `src/utils/__tests__/rackLayout.test.ts` | Collision + bounds + fuzz. |
| `src/store/__tests__/useConfiguratorStore.test.ts` | Mutator coverage including per-type `addHardware` powerDraw defaults. |

