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

## 2. Coordinate Space & Snap Mathematics

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

## Appendix: file-by-file reference

| File | Purpose |
|---|---|
| `src/store/useConfiguratorStore.ts` | Persistent rack data + UI flags + mutators. Defines `RACK_UNIT_HEIGHT` + chassis geometry constants. |
| `src/store/useDragStore.ts` | Transient drag snapshot for 60 Hz updates. |
| `src/types/rack.types.ts` | `RackState`, `HardwareProps`, `HardwareType`, `Vec3` — framework-agnostic data shapes. |
| `src/hooks/snapToU.ts` | Pure `snapToU(y, rackUnits)` function with parity-aware shift trick. |
| `src/hooks/interactionHandlers.ts` | Pure drag handlers (`handlePointerDown` / `Move` / `Up`) consuming a `DragInteractionContext`. Module-private `asElement` runtime guard. |
| `src/hooks/useHardwareInteraction.ts` | React orchestration layer for the drag hook + window-level fallback. |
| `src/utils/rackLayout.ts` | `checkDropValidity`, `getChassisFootprint`, `COLLISION_EPSILON`. |
| `src/components/canvas/Scene.tsx` | R3F canvas root, lights + chrome, camera-snap `useEffect`, OrbitControls ref. |
| `src/components/canvas/Rack/RackFrame.tsx` | Outer metal frame (4 corner posts + 4 beams). |
| `src/components/canvas/Rack/RackScrews.tsx` | Mounting screws — single instanced mesh per capacity. |
| `src/components/canvas/Rack/RackLabels.tsx` | 84 `<Text>` markers visible in blueprint mode. |
| `src/components/canvas/Hardware/shared.tsx` | `SelectionOutline`, `SchematicBox`, blueprint palette, `useIsBlueprint()`. |
| `src/components/canvas/Hardware/{Server,Switch,Router,PatchPanel}.tsx` | Per-type chassis components with viewMode swap. |
| `src/components/canvas/HardwareMapper.tsx` | Dispatches each chassis by `hardware.type` to its hardware-specific component. |
| `src/components/canvas/interactions/DropIndicator.tsx` | Drag-ghost mesh; reads `useDragStore` valid/invalid flag; switches between emerald/red `MeshBasicMaterial` module references. |
| `src/components/ui/ConfiguratorPanel.tsx` | UI overlay with add/remove + View Mode toggle. |
| `src/hooks/__tests__/{snapToU,interactionHandlers}.test.ts` | Pure-math + command-pattern test suites (44 tests). |
| `src/utils/__tests__/rackLayout.test.ts` | Collision + bounds + fuzz (183 tests). |
| `src/store/__tests__/useConfiguratorStore.test.ts` | viewMode mutator + persistence-shape independence (8 tests). |
