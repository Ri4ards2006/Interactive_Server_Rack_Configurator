# System Architecture & Technical Specifications

> **Interactive 19″ Server Rack Configurator**  
> Engine: React 19 · Three.js (r185) · @react-three/fiber v9 · @react-three/drei v10 · Zustand v5 · Tailwind CSS v4

---

## Table of Contents

1. [System Topography & Component Hierarchy](#1-system-topography--component-hierarchy)
2. [State Management & The 60 Hz Split](#2-state-management--the-60-hz-split)
3. [Mathematical & Geometric Invariants](#3-mathematical--geometric-invariants)
4. [Dual-Mode Rendering Pipeline (PBR vs. Blueprint)](#4-dual-mode-rendering-pipeline-pbr-vs-blueprint)
5. [Pointer Event Isolation & Interaction Architecture](#5-pointer-event-isolation--interaction-architecture)
6. [Hardware Component Reference Specifications](#6-hardware-component-reference-specifications)

---

## 1. System Topography & Component Hierarchy

The application utilizes a decoupled, dual-layer interface architecture: an interactive 3D WebGL Canvas rendered by `@react-three/fiber` (R3F) running concurrently beneath a 2D HUD (Heads-Up Display) overlay managed by standard DOM/React.

### 1.1 Complete Component Tree

```
App.tsx (Root Viewport & Window Event Controller)
│
├── <div className="absolute inset-0 z-0">
│   └── Scene.tsx (Canvas, Camera, WebGL Context, OrbitControls)
│       └── SceneContents (R3F Canvas Children)
│           ├── <color attach="background" />
│           ├── Lighting Subsystem (3D Mode Only)
│           │   ├── <ambientLight intensity={0.35} />
│           │   ├── <directionalLight castShadow intensity={1.6} />
│           │   └── <Environment preset="warehouse" />
│           ├── Floor & Environment Chrome (3D Mode Only)
│           │   ├── <ContactShadows opacity={0.55} blur={2.4} />
│           │   └── <Grid infiniteGrid cellColor="#27272a" />
│           ├── Rack Structure Subsystem
│           │   ├── RackFrame.tsx (2-Post / 4-Post / Cabinet Enclosure + Glass Door)
│           │   ├── RackScrews.tsx (InstancedMesh: 2 × Capacity Hex Cap Screws)
│           │   └── RackLabels.tsx (Blueprint Only: 84 × Troika SDF <Text> U-Markers)
│           ├── Hardware Dispatch & Scene Population
│           │   └── HardwareMapper.tsx (Zustand useShallow Dispatcher)
│           │       ├── Server.tsx (1U / 2U / 4U Server Chassis + Hot-Swap Sleds)
│           │       ├── Switch.tsx (1U 48-Port Switch + Instanced RJ45 & LEDs)
│           │       ├── Router.tsx (1U / 2U Router + Dual PSU & SFP+ Array)
│           │       ├── PatchPanel.tsx (1U 24-Keystone Jack Array)
│           │       ├── Firewall.tsx (1U NGFW + Anodized Bezel & Alarm Cluster)
│           │       ├── JBOD.tsx (4U 36-Bay Storage Array)
│           │       ├── NAS.tsx (2U 12-Bay Storage Array + OLED Display)
│           │       ├── UPS.tsx (2U Battery Backup Unit)
│           │       ├── KVMConsole.tsx (1U Slide-out Drawer + 17″ Tilting LCD)
│           │       ├── BlankingPanel.tsx (1U / 2U Airflow Baffles)
│           │       ├── BrushPanel.tsx (1U Cable Pass-through Bristle Strip)
│           │       └── CableManager.tsx (2U High-Density Horizontal Ring Duct)
│           ├── Cable Routing Subsystem
│           │   └── CableMapper (src/components/canvas/Hardware/PatchCable.tsx)
│           │       ├── PatchCable[] (CatmullRom 3D Splines + RJ45 Plugs + Delete HTML HUD)
│           │       ├── DraggingCable (Real-time in-flight CatmullRom Curve)
│           │       └── DragCatcher Plane (5.0 m × 5.0 m Invisible Pointer Interceptor)
│           ├── Ghost Preview & Snapping HUD
│           │   └── DropIndicator.tsx (Zustand useDragStore Ghost Mesh)
│           └── <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
│
└── <div className="relative z-10 pointer-events-none">
    └── ConfiguratorPanel.tsx (HUD Overlay System)
        ├── Zen Mode Toggle (Top-Center HUD Action)
        ├── Left Sidebar: Control Console
        │   ├── Telemetry Header (Status, Loc-ID)
        │   ├── Terminal Search Input (`> SEARCH_HARDWARE...`)
        │   ├── Viewport Mode Switch (`3D RENDER` vs. `BLUEPRINT`)
        │   ├── Rack Form Factor Selector (`2-POST` / `4-POST` / `CABINET`)
        │   ├── Cabinet Door Toggle Button (`[ OPEN DOOR ]` / `[ CLOSE DOOR ]`)
        │   ├── Power & Capacity Gauges (`TOTAL_DRAW`, `CAPACITY_USE`, `NODE_COUNT`)
        │   └── Categorized Hardware Injection Catalog (5 Sub-groups)
        └── Right Sidebar: Asset Inventory & Diagnostics
            ├── Installed Unit Counter & List
            ├── Re-order / Vertical Shifter Controls (`canShiftUp` / `canShiftDown`)
            ├── Live Property Inspectors (`PWR_TARGET`, `DEPTH_SPEC` range sliders)
            └── Asset Decommission / Deselect Triggers
```

### 1.2 Structural Topography & Data Flow Diagram

```
 +---------------------------------------------------------------------------------------+
 |                                  BROWSER WINDOW (App.tsx)                             |
 |  Global Listeners: [Escape] -> selectHardware(null)                                   |
 +-------------------------------------------+-------------------------------------------+
                                             |
                     +-----------------------+-----------------------+
                     |                                               |
                     v                                               v
 +---------------------------------------+       +---------------------------------------+
 |          2D DOM HUD OVERLAY           |       |           3D WEBGL VIEWPORT           |
 |         (ConfiguratorPanel)           |       |                (Scene)                |
 |                                       |       |                                       |
 |  pointer-events-none (container)      |       |  R3F Canvas, Camera, OrbitControls    |
 |  pointer-events-auto (active buttons) |       |  Raycaster / Pointer Event Target     |
 |                                       |       |                                       |
 |  * Catalog Hardware Injectors         |       |  * Rack Frame Geometry & Screws       |
 |  * Telemetry Gauges (Watts, U-Space)  |       |  * 12 Distinct Chassis Meshes         |
 |  * Diagnostic Sliders (Depth, Power)  |       |  * 3D Bezier Patch Cables             |
 |  * Rack & Viewport Mode Selectors     |       |  * Transient Snapping Drop Ghost      |
 +-------------------+-------------------+       +-------------------+-------------------+
                     |                                               |
                     | Subscribes via Selectors                      | Reads State & Dispatches
                     | Mutates via Actions                           | Captures Pointer Events
                     v                                               v
 +---------------------------------------------------------------------------------------+
 |                                 ZUSTAND STORE LAYER                                   |
 |                                                                                       |
 |  +-------------------------------------+     +-------------------------------------+  |
 |  |    useConfiguratorStore (Persistent)|     |      useDragStore (Transient)       |  |
 |  |                                     |     |                                     |  |
 |  |  * capacity: 42                     |     |  * isDragging: boolean              |  |
 |  |  * installedHardware: HardwareProps[]     |  * draggingId: string | null        |  |
 |  |  * cables: CableProps[]             |     |  * dropPosition: Vec3 | null        |  |
 |  |  * selectedHardwareId: string | null|     |  * rackUnits: number                |  |
 |  |  * selectedCableId: string | null   |     |  * depth: number                    |  |
 |  |  * viewMode: '3D' | 'blueprint'     |     |  * isValid: boolean                 |  |
 |  |  * rackType: '2-post'|'4-post'|'cab'|     |                                     |  |
 |  |  * isDoorOpen: boolean              |     |  Cadence: ~60 Hz (drag frames only) |  |
 |  |  * hddBays: Record<devId, BayState> |     |  Subscribers: Only DropIndicator    |  |
 |  |                                     |     +-------------------------------------+  |
 |  |  Cadence: Low (On user commit only) |                                              |
 |  |  Subscribers: HUD, Mapper, Frame    |                                              |
 |  +-------------------------------------+                                              |
 +---------------------------------------------------------------------------------------+
```

---

## 2. State Management & The 60 Hz Split

### 2.1 The Render Bottleneck Problem

In a Three.js / React-Three-Fiber scene graph containing hundreds of sub-meshes, instanced geometries, lights, and materials, firing high-frequency store mutations (~60 frames per second during mouse move) into a unified root store triggers massive performance degradation:

1. **Selector Invalidation:** Any component using shallow comparison or non-primitive selectors re-evaluates on every store write.
2. **Reconciliation Cost:** React attempts to reconcile the virtual DOM tree across all 11+ installed chassis components.
3. **GPU Matrix Recalculations:** Three.js updates the world transformation matrices (`updateMatrixWorld()`) across nested `<group>` and `<mesh>` nodes unnecessarily.

### 2.2 The Dual-Store Boundary

To guarantee smooth, uninterrupted 60 Hz dragging, state is partitioned into two orthogonal stores:

```ts
// src/types/rack.types.ts
export interface RackState {
  capacity: number;
  installedHardware: HardwareProps[];
  cables: CableProps[];
}

// src/store/useConfiguratorStore.ts
export interface ConfiguratorState extends RackState {
  selectedHardwareId: string | null;
  selectedCableId: string | null;
  viewMode: '3D' | 'blueprint';
  activeDraggingCable: DraggingCableProps | null;
  hddBays: Record<string, Record<number, HddBayState>>;
  rackType: '2-post' | '4-post' | 'cabinet';
  isDoorOpen: boolean;
  
  // Mutators (Commit-level operations)
  addHardware: (type: HardwareType, rackUnits: number) => void;
  removeHardware: (id: string) => void;
  updateHardwarePosition: (id: string, position: Vec3) => void;
  selectHardware: (id: string | null) => void;
  toggleViewMode: () => void;
  setRackType: (type: '2-post' | '4-post' | 'cabinet') => void;
  setDoorOpen: (isOpen: boolean) => void;
  addCable: (fromDev: string, fromPort: string, toDev: string, toPort: string, color: string) => void;
  removeCable: (id: string) => void;
  unpatchPort: (deviceId: string, portId: string) => void;
  toggleHddBay: (deviceId: string, bayIndex: number) => void;
  simulateHddFailure: () => void;
}

// src/store/useDragStore.ts
export interface DragSnapshot {
  isDragging: boolean;
  draggingId: string | null;
  dropPosition: Vec3 | null;
  rackUnits: number;
  depth: number;
  isValid: boolean;
}

export interface DragActions {
  beginDrag: (params: { id: string; rackUnits: number; depth: number }) => void;
  updateDropPosition: (position: Vec3, isValid: boolean) => void;
  endDrag: () => void;
}
```

### 2.3 Store Interaction Lifecycle

During a hardware drag interaction, event processing delegates to `src/hooks/interactionHandlers.ts`:

```
[ User Presses Pointer on Chassis ]
  │
  ├── 1. e.stopPropagation()
  ├── 2. asElement(e.target)?.setPointerCapture(e.pointerId)
  ├── 3. ctx.selectHardware(hardware.id)                    --> Updates useConfiguratorStore (once)
  ├── 4. ctx.beginDrag({ id, rackUnits, depth })           --> Initializes useDragStore (once)
  └── 5. ctx.setIsDragging(true)                           --> Local component React state
  
[ User Moves Pointer (60 Hz Event Stream) ]
  │
  ├── 1. e.stopPropagation()
  ├── 2. snappedY = snapToU(e.point.y, rackUnits)           --> Pure mathematical projection
  ├── 3. isValid = checkDropValidity(id, snappedY, ...)     --> Fast geometric collision test
  ├── 4. ctx.updateDropPosition([x, snappedY, z], isValid) --> Mutates useDragStore ONLY (~60 Hz)
  │      └── Only <DropIndicator /> re-renders (recolors green/red ghost)
  └── 5. ctx.updateHardwarePosition(id, [x, snappedY, z])   --> Direct positional tracking

[ User Releases Pointer / Pointer Cancel / Blur ]
  │
  ├── 1. e.stopPropagation()
  ├── 2. asElement(e.target)?.releasePointerCapture(pointerId)
  ├── 3. ctx.setIsDragging(false)                          --> Local component React state
  ├── 4. ctx.endDrag()                                     --> Clears useDragStore (unmounts ghost)
  └── 5. Position already committed in persistent store
```

---

## 3. Mathematical & Geometric Invariants

### 3.1 Standard Physical Constants

All spatial measurements in the configurator are modeled in standard metric units (meters) derived directly from the **EIA-310-D** international standard:

| Constant | Value (SI) | Value (Imperial) | Description | Location |
|---|---|---|---|---|
| `RACK_UNIT_HEIGHT` ($U$) | `0.04445 m` | $1.750\text{ in}$ ($44.45\text{ mm}$) | Vertical pitch per standard Rack Unit | `src/store/useConfiguratorStore.ts:42` |
| `CHASSIS_WIDTH` | `0.44000 m` | $17.323\text{ in}$ ($440\text{ mm}$) | Outer width of a 19″ mountable chassis body | `src/store/useConfiguratorStore.ts:57` |
| `EDGE_GAP` | `0.00500 m` | $0.197\text{ in}$ ($5.0\text{ mm}$) | Vertical visual clearance seam between units | `src/store/useConfiguratorStore.ts:58` |
| `MOUNT_WIDTH` | `0.48200 m` | $18.976\text{ in}$ ($482\text{ mm}$) | 19-inch mounting post center-to-center pitch | `src/components/canvas/Rack/RackFrame.tsx:31` |
| `MOUNT_DEPTH` | `0.78000 m` | $30.709\text{ in}$ ($780\text{ mm}$) | Mounting rail depth (spans $z = -0.39$ to $+0.39$) | `src/components/canvas/Rack/RackFrame.tsx:32` |
| `CABINET_WIDTH` | `0.60000 m` | $23.622\text{ in}$ ($600\text{ mm}$) | Outer width of enclosed cabinet frame | `src/components/canvas/Rack/RackFrame.tsx:25` |
| `CABINET_DEPTH` | `1.00000 m` | $39.370\text{ in}$ ($1000\text{ mm}$) | Outer depth of enclosed cabinet frame | `src/components/canvas/Rack/RackFrame.tsx:26` |
| `COLLISION_EPSILON` ($\varepsilon$) | `0.00100 m` | $0.039\text{ in}$ ($1.0\text{ mm}$) | Float tolerance for Y-range boundary checks | `src/utils/rackLayout.ts:38` |

### 3.2 Coordinate Spaces & Vertical Center Anchoring

The configurator utilizes a **floor-zero rack-local coordinate frame**:

$$\text{Rack Floor Plane: } y = 0 \quad \longleftrightarrow \quad \text{Rack Top Plane: } y = \text{capacity} \cdot U$$

```
   y = 42 * U  +------------------------------------+  (Rack Ceiling: y = 1.8669 m)
               | [U42]                              |
               |                                    |
               |                                    |
               | [U2]                               |
               | [U1]                               |
   y = 0       +====================================+  (Rack Floor: y = 0.0000 m)
                 x = -0.241 m        x = +0.241 m
```

* **Chassis Positioning Rule:** A chassis position is defined by its geometric **vertical center**, NOT its bottom edge:
  $$\text{Chassis Extent: } \left[ y_{\text{center}} - \frac{\text{rackUnits} \cdot U}{2}, \; y_{\text{center}} + \frac{\text{rackUnits} \cdot U}{2} \right]$$
* **Rendered Mesh Height:** To preserve visual panel gaps matching real rack installations:
  $$h_{\text{mesh}} = (\text{rackUnits} \cdot U) - \text{EDGE\_GAP}$$

### 3.3 Parity-Aware Snapping (`snapToU`)

Chassis mounting holes conform to two distinct physical symmetries depending on height parity:
1. **Odd Rack Units ($1U, 3U, 5U \dots$):** Geometric center must land on a **slot center** ($y = n \cdot U + \frac{U}{2}$).
2. **Even Rack Units ($2U, 4U, 6U \dots$):** Geometric center must land on a **slot seam** ($y = n \cdot U$).

```ts
// src/hooks/snapToU.ts
export function snapToU(y: number, rackUnits: number): number {
  const u = RACK_UNIT_HEIGHT;
  const halfU = u / 2;
  
  if (rackUnits % 2 === 1) {
    // Odd parity: Center sits at slot centers (0.5U, 1.5U, 2.5U...).
    // Shift y by -halfU so Math.round references integer slot index n
    // rather than the slot seam.
    const slotIndex = Math.round((y - halfU) / u);
    return slotIndex * u + halfU;
  }
  
  // Even parity: Center sits on slot seams (0, U, 2U...).
  return Math.round(y / u) * u;
}
```

#### Mathematical Proof of the $- \frac{U}{2}$ Shift

In standard JavaScript / IEEE 754 arithmetic, `Math.round(0.5) === 1` (half rounds toward $+\infty$).

Without the shift for a $1U$ device at the bottom slot ($y = 0.5U$):
$$\text{Calculated} = \text{Math.round}\left(\frac{0.5U}{U}\right) \cdot U + 0.5U = \text{Math.round}(0.5) \cdot U + 0.5U = 1 \cdot U + 0.5U = 1.5U \quad (\text{Off by }+1U!)$$

With the shift applied:
$$\text{slotIndex} = \text{Math.round}\left(\frac{0.5U - 0.5U}{U}\right) = \text{Math.round}(0) = 0$$
$$\text{Position} = 0 \cdot U + 0.5U = 0.5U \quad (\text{Correctly matches Slot 0})$$

### 3.4 Floating-Point Collision & Boundary Validation

To avoid fragile integer slot mapping arrays (which fail when handling arbitrary U-heights and half-step offsets), collision detection is performed continuously via floating-point interval overlap calculus with tolerance buffer $\varepsilon$:

$$\text{Footprint Function: } \mathcal{F}(y, k) = \left[ y - \frac{k \cdot U}{2}, \; y + \frac{k \cdot U}{2} \right] \equiv [y_{\min}, y_{\max}]$$

```ts
// src/utils/rackLayout.ts
export function checkDropValidity(
  draggingId: string,
  snappedY: number,
  rackUnits: number,
  capacity: number,
  hardwareList: HardwareProps[],
): boolean {
  if (!Number.isFinite(snappedY) || !Number.isFinite(rackUnits) || !Number.isFinite(capacity)) {
    return false;
  }

  const drop = getChassisFootprint(snappedY, rackUnits);

  // 1. Boundary Check with Epsilon Buffer
  if (
    drop.min < -COLLISION_EPSILON ||
    drop.max > capacity * RACK_UNIT_HEIGHT + COLLISION_EPSILON
  ) {
    return false;
  }

  // 2. Pairwise Overlap Check against all other installed chassis
  for (const h of hardwareList) {
    if (h.id === draggingId) continue;

    const other = getChassisFootprint(h.position[1], h.rackUnits);

    // Two intervals [minA, maxA] and [minB, maxB] overlap iff:
    // maxA > minB + EPSILON && minA < maxB - EPSILON
    if (
      drop.max > other.min + COLLISION_EPSILON &&
      drop.min < other.max - COLLISION_EPSILON
    ) {
      return false;
    }
  }

  return true;
}
```

* **Role of $\varepsilon = 0.001\text{ m}$ (1 mm):**
  1. Absorbs cumulative IEEE 754 precision drift ($10^{-16}\text{ m}$).
  2. Allows flush edge-touching mounts: when $drop.min = other.max$, $drop.min < other.max - \varepsilon$ evaluates to `false`, correctly allowing adjacent stacking.
  3. Rejects genuine overlaps: any overlap $\ge 1\text{ mm}$ is caught and invalidated.

---

## 4. Dual-Mode Rendering Pipeline (PBR vs. Blueprint)

The configurator features an instant, zero-allocation visual switch between high-fidelity photorealistic rendering and technical CAD blueprint visualization.

```
                  +----------------------------------------------+
                  |           ConfiguratorState.viewMode         |
                  +----------------------+-----------------------+
                                         |
                     +-------------------+-------------------+
                     | '3D'                                  | 'blueprint'
                     v                                       v
      +-----------------------------+         +-----------------------------+
      |      PBR REALISTIC MODE     |         |     CAD BLUEPRINT MODE      |
      +-----------------------------+         +-----------------------------+
      | Materials:                  |         | Materials:                  |
      | * MeshStandardMaterial      |         | * MeshBasicMaterial (Flat)  |
      | * Metalness 0.5 - 0.95      |         | * Chassis: #151515          |
      | * Roughness 0.1 - 0.7       |         | * Bezel:   #050505          |
      | * Accent Emissives          |         | * Accent:  #22d3ee (Cyan)   |
      |                             |         |                             |
      | Overlays:                   |         | Overlays:                   |
      | * ContactShadows            |         | * EdgesGeometry Outlines    |
      | * Infinite Floor Grid       |         | * LineBasicMaterial (#67e8f9|
      |                             |         | * RackLabels (84 SDF Text)  |
      | Environment:                |         |                             |
      | * Directional Shadow Map    |         | Environment:                |
      | * Warehouse HDR Map         |         | * Lights UNMOUNTED          |
      |                             |         | * Shadows UNMOUNTED         |
      | Camera:                     |         |                             |
      | * Perspective [1.5, 1.2, 1.5] |         | Camera:                     |
      | * 3-Axis Orbit Controls     |         | * Orthogonal Snap [0, mid, Z|
      +-----------------------------+         | * Rotation LOCKED (Pan/Zoom)|
                                              +-----------------------------+
```

### 4.1 Subsystem Differences Matrix

| Pipeline Feature | 3D Photorealistic Mode | 2D CAD Blueprint Mode | Technical Implementation |
|---|---|---|---|
| **Chassis Surface** | `MeshStandardMaterial` (anodized steel, brushed alu) | `MeshBasicMaterial` (`#151515` flat fill) | Module-scoped singleton material swap |
| **Edge Geometry** | None (shaded PBR edges) | Cyan `EdgesGeometry` (`LineSegments`, `#67e8f9`) | `<SchematicBox />` memoized on `[w,h,d]` |
| **Lighting & HDR** | Directional Light (2048² shadow map) + Warehouse HDR | Completely unmounted (`!isBlueprint && ...`) | Zero light evaluation overhead |
| **Floor & Shadows** | Soft `ContactShadows` + Procedural `<Grid>` | Completely unmounted | Eliminates shadow map pass |
| **Rail Annotations** | Hidden (`null`) | 84 × Troika SDF `<Text>` instances (U1..U42) | `<RackLabels />` with black high-contrast halo |
| **Camera Pose** | Perspective `[1.5, 1.2, 1.5]`, target `[0, 0.8, 0]` | Perpendicular `[0, midY, 2.2]`, target `[0, midY, 0]` | Imperative camera lerp/snap in `SceneContents` |
| **OrbitControls** | Full Orbit Rotation + Pan + Zoom | `enableRotate = false` (Locked Pan + Zoom) | `controls.enableRotate = false` |
| **Cabinet Door** | Smooth exponential lerp open/close | Hidden / Suppressed | Conditional branch on `!isBlueprint` |

### 4.2 Module-Scoped Material Re-use (Zero GC Overhead)

To eliminate garbage collection pauses and GPU texture re-uploads when flipping modes, all materials are instantiated once at module scope:

```ts
// src/components/canvas/Hardware/shared.tsx
export const blueprintChassisMaterial = new THREE.MeshBasicMaterial({ color: '#151515' });
export const blueprintFrameFillMaterial = new THREE.MeshBasicMaterial({ color: '#151515' });
export const blueprintBezelMaterial = new THREE.MeshBasicMaterial({ color: '#050505' });
export const blueprintAccentMaterial = new THREE.MeshBasicMaterial({ color: '#22d3ee' });
export const blueprintEdgeMaterial = new THREE.LineBasicMaterial({ color: '#67e8f9' });

export function SchematicBox({ width, height, depth, position = [0, 0, 0] }: SchematicBoxProps) {
  const edges = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth)),
    [width, height, depth],
  );
  return (
    <lineSegments
      geometry={edges}
      material={blueprintEdgeMaterial}
      position={position}
    />
  );
}
```

---

## 5. Pointer Event Isolation & Interaction Architecture

### 5.1 Layered DOM Pointer-Events Routing

The application mounts the 2D HUD directly over the WebGL Canvas within `App.tsx`:

```tsx
// src/App.tsx
return (
  <div className="relative h-screen w-screen overflow-hidden bg-zinc-950">
    {/* Layer 0: 3D WebGL Canvas (Full interactive receiver) */}
    <div className="absolute inset-0 z-0">
      <Scene />
    </div>
    
    {/* Layer 10: 2D DOM HUD (Transparent pass-through overlay) */}
    <div className="relative z-10 pointer-events-none h-full w-full">
      <ConfiguratorPanel />
    </div>
  </div>
);
```

* **Pass-Through Mechanics:** The HUD wrapper sets `pointer-events-none`. All mouse, scroll, and drag interactions over empty regions fall straight through to R3F's raycaster without synthetic event bubbling.
* **Interactive Opt-In:** Interactive elements inside `ConfiguratorPanel.tsx` (buttons, catalog cards, range sliders) explicitly declare `pointer-events-auto`.

### 5.2 R3F v9 Pointer Capture & Safe Teardown

During chassis drag interactions, the pointer must remain locked to the active hardware even if the cursor temporarily escapes the 3D mesh boundary:

```ts
// src/hooks/interactionHandlers.ts
function asElement(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null;
}

export function handlePointerDown(e: ThreeEvent<PointerEvent>, ctx: DragInteractionContext): void {
  e.stopPropagation();
  ctx.selectHardware(ctx.hardware.id);
  ctx.beginDrag({
    id: ctx.hardware.id,
    rackUnits: ctx.hardware.rackUnits,
    depth: ctx.hardware.depth,
  });
  ctx.setIsDragging(true);
  
  // Lock pointer capture on the underlying canvas DOM element
  asElement(e.target)?.setPointerCapture(e.pointerId);
  ctx.capturedPointerIdRef.current = e.pointerId;
}
```

#### Failsafe Teardown (Window Fallback Listener)

If an operating system dialog interrupts the drag, or a `blur` event fires before `pointerup`, the interaction hook guarantees safe teardown via global window listeners in `src/hooks/useHardwareInteraction.ts`:

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
  return () => {
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
    window.removeEventListener('blur', endDrag);
  };
}, [isDragging]);
```

---

## 6. Hardware Component Reference Specifications

Each hardware component is a standalone R3F component implementing standard mounting geometry, port registries, and diagnostic indicators:

| Hardware Type | Height ($U$) | Default Depth | Default Power ($W$) | Port Layout | Dynamic Behaviors | Source File |
|---|---|---|---|---|---|---|
| **Server** | 1U / 2U / 4U | 0.60 m | 150 / 300 / 500 W | 4× Rear LAN ports | Clickable hot-swap HDD caddies, failure simulation, blinking LEDs | [`Server.tsx`](file:///home/richard/Projects/Ongoing/New/Interactive_Server_Rack_Configurator/src/components/canvas/Hardware/Server.tsx) |
| **Switch** | 1U | 0.30 m | 50 W | 48× Front RJ45 | Instanced dual 24-port bank, per-port link/activity LEDs, cyan accent | [`Switch.tsx`](file:///home/richard/Projects/Ongoing/New/Interactive_Server_Rack_Configurator/src/components/canvas/Hardware/Switch.tsx) |
| **Router** | 1U / 2U | 0.40 m | 80 / 150 W | 16× Front SFP+ | Dual hot-swap PSUs, cooling fan grilles, amber/green status cluster | [`Router.tsx`](file:///home/richard/Projects/Ongoing/New/Interactive_Server_Rack_Configurator/src/components/canvas/Hardware/Router.tsx) |
| **Patch Panel** | 1U | 0.10 m | 0 W | 24× Keystone | 24 individual interactive RJ45 patch ports across front bezel | [`PatchPanel.tsx`](file:///home/richard/Projects/Ongoing/New/Interactive_Server_Rack_Configurator/src/components/canvas/Hardware/PatchPanel.tsx) |
| **Firewall** | 1U | 0.30 m | 40 W | 8× Copper + 4× SFP+ | Aggressive red anodized wings, diagnostic HA/Alarm cluster, console port | [`Firewall.tsx`](file:///home/richard/Projects/Ongoing/New/Interactive_Server_Rack_Configurator/src/components/canvas/Hardware/Firewall.tsx) |
| **JBOD** | 4U | 0.65 m | 600 W | None (Internal SAS) | 36× Instanced drive sleds (3×12 grid) with rebuild LEDs | [`JBOD.tsx`](file:///home/richard/Projects/Ongoing/New/Interactive_Server_Rack_Configurator/src/components/canvas/Hardware/JBOD.tsx) |
| **NAS** | 2U | 0.55 m | 150 W | 4× Rear LAN ports | 12× Drive bays (6×2 grid), glowing cyan OLED telemetry display | [`NAS.tsx`](file:///home/richard/Projects/Ongoing/New/Interactive_Server_Rack_Configurator/src/components/canvas/Hardware/NAS.tsx) |
| **UPS** | 2U | 0.60 m | −1500 W *(Discharge)* | None (Heavy PDU) | Status LCD readout, battery cell enclosure, red emergency disconnect | [`UPS.tsx`](file:///home/richard/Projects/Ongoing/New/Interactive_Server_Rack_Configurator/src/components/canvas/Hardware/UPS.tsx) |
| **KVM Console**| 1U | 0.40 m | 30 W | None (Internal) | Slide-out drawer (+15 cm) and unfolding 36° LCD display on selection | [`KVMConsole.tsx`](file:///home/richard/Projects/Ongoing/New/Interactive_Server_Rack_Configurator/src/components/canvas/Hardware/KVMConsole.tsx) |
| **Blanking Panel**| 1U / 2U | 0.02 m | 0 W | None | Powder-coated airflow barrier with dual plastic snap-in latches | [`BlankingPanel.tsx`](file:///home/richard/Projects/Ongoing/New/Interactive_Server_Rack_Configurator/src/components/canvas/Hardware/BlankingPanel.tsx) |
| **Brush Panel**| 1U | 0.02 m | 0 W | None | Dense synthetic bristle strip for pass-through cable management | [`BrushPanel.tsx`](file:///home/richard/Projects/Ongoing/New/Interactive_Server_Rack_Configurator/src/components/canvas/Hardware/BrushPanel.tsx) |
| **Cable Manager**| 2U | 0.08 m | 0 W | None | High-density horizontal D-ring finger duct with front cover plate | [`CableManager.tsx`](file:///home/richard/Projects/Ongoing/New/Interactive_Server_Rack_Configurator/src/components/canvas/Hardware/CableManager.tsx) |

