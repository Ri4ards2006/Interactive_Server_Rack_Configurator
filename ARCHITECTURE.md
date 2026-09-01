# System Architecture & Technical Specifications

> **Interactive 19″ Server Rack Configurator**  
> Engine: React 19 · Three.js (r185) · @react-three/fiber v9 · @react-three/drei v10 · Zustand v5 · Tailwind CSS v4

---

## Table of Contents

1. [System Topography & Component Hierarchy](#1-system-topography--component-hierarchy)
2. [State Management & The 60 Hz Split](#2-state-management--the-60-hz-split)
3. [Mathematical & Geometric Invariants](#3-mathematical--geometric-invariants)
4. [Dual-Mode Rendering Pipeline (PBR vs. Blueprint)](#4-dual-mode-rendering-pipeline-pbr-vs-blueprint)
5. [Pointer Event Isolation & HUD Architecture](#5-pointer-event-isolation--hud-architecture)
6. [Chassis & Hardware Module Registry](#6-chassis--hardware-module-registry)

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
│           ├── Multi-Rack Array Subsystem
│           │   └── racks.map((rack) => group key={rack.id} position={rack.position})
│           │       ├── RackFrame.tsx (2-Post / 4-Post / Cabinet Enclosure + Glass Door)
│           │       ├── RackScrews.tsx (InstancedMesh: 2 × Capacity Hex Cap Screws)
│           │       ├── RackLabels.tsx (Blueprint Only: 84 × Troika SDF <Text> U-Markers)
│           │       ├── HardwareMapper.tsx (Zustand useShallow Dispatcher)
│           │       │   ├── Server.tsx (1U / 2U / 4U Server Chassis + Hot-Swap Sleds)
│           │       │   ├── Switch.tsx (1U 48-Port Switch + Instanced RJ45 & LEDs)
│           │       │   ├── Router.tsx (1U / 2U Router + Dual PSU & SFP+ Array)
│           │       │   ├── PatchPanel.tsx (1U 24-Keystone Jack Array)
│           │       │   ├── Firewall.tsx (1U NGFW + Anodized Bezel & Alarm Cluster)
│           │       │   ├── JBOD.tsx (4U 36-Bay Storage Array)
│           │       │   ├── NAS.tsx (2U 12-Bay Storage Array + OLED Display)
│           │       │   ├── UPS.tsx (2U Battery Backup Unit)
│           │       │   ├── KVMConsole.tsx (1U Slide-out Drawer + 17″ Tilting LCD)
│           │       │   ├── BlankingPanel.tsx (1U / 2U Airflow Baffles)
│           │       │   ├── BrushPanel.tsx (1U Cable Pass-through Bristle Strip)
│           │       │   ├── CableManager.tsx (2U High-Density Horizontal Ring Duct)
│           │       │   └── CustomGltfChassis.tsx (Dynamic User-Uploaded 3D Models)
│           │       └── ThermalHeatmapOverlay.tsx (Volumetric 3D Airflow / Temp Shader)
│           ├── Cable Routing Subsystem
│           │   └── CableLayer.tsx (Cross-Rack Physical Connectivity)
│           │       ├── CableMesh[] (CatmullRom 3D Splines + Bending Curvature Shaders)
│           │       ├── ConnectorPlugs[] (Molded RJ45 / LC Duplex Boots)
│           │       ├── DraggingCableMesh (Real-time In-Flight CatmullRom Curve)
│           │       └── DragCatcher Plane (5.0 m × 5.0 m Invisible Pointer Interceptor)
│           ├── Ghost Preview & Snapping HUD
│           │   └── DropIndicator.tsx (Zustand useDragStore Ghost Mesh)
│           └── <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
│
└── <div className="relative z-10 pointer-events-none">
    └── ConfiguratorPanel.tsx (HUD Overlay System)
        ├── Zen Mode Toggle (Top-Center HUD Action)
        ├── Left Sidebar: Control Console
        │   ├── Telemetry Header (Status, Loc-ID, Multi-Rack Selector)
        │   ├── Terminal Search Input (`> SEARCH_HARDWARE...`)
        │   ├── Viewport Mode Switch (`3D RENDER` vs. `BLUEPRINT`)
        │   ├── Rack Form Factor Selector (`2-POST` / `4-POST` / `CABINET`)
        │   ├── Cabinet Door Toggle (`[ OPEN DOOR ]` / `[ CLOSE DOOR ]`)
        │   ├── Power & Phase Gauges (L1/L2/L3 Balance, 80% NEC Rule Limit)
        │   ├── Thermal Telemetry (CFM Differential, Intake/Exhaust Delta-T)
        │   └── Categorized Hardware Injection Catalog (5 Sub-groups)
        └── Right Sidebar: Asset Inventory & Diagnostics
            ├── Installed Unit Counter & List
            ├── Re-order / Vertical Shifter Controls (`canShiftUp` / `canShiftDown`)
            ├── Live Property Inspectors (`PWR_TARGET`, `DEPTH_SPEC` range sliders)
            ├── Export Actions (BOM CSV/JSON, GLTF 3D Scene, Vector SVG Elevation)
            └── Asset Decommission / Deselect Triggers
```

### 1.2 Structural Pipeline & Synchronization Flow

```
 +---------------------------------------------------------------------------------------+
 |                                  BROWSER WINDOW (App.tsx)                             |
 |  Global Listeners: [Escape] -> selectHardware(null), [Ctrl+Z] -> undo(), [Ctrl+Y] -> redo()
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
 |  pointer-events-auto (active controls)|       |  Raycaster / Pointer Event Target     |
 +-------------------+-------------------+       +-------------------+-------------------+
                     |                                               |
                     |  Dispatches Inventory & Layout Actions        |  Reads Snapping & Drag State
                     v                                               v
 +---------------------------------------------------------------------------------------+
 |                               ZUSTAND GLOBAL STORES                                   |
 |                                                                                       |
 |  useConfiguratorStore (Persistent Domain State)                                       |
 |  - Multi-rack array: `racks: RackInstance[]`, `activeRackId: string`                 |
 |  - Inventory: `installedHardware: HardwareProps[]`                                    |
 |  - Physical Connectivity: `cables: CableProps[]`                                      |
 |  - Electrical & Thermal: `voltage`, `breakerRating`, `ambientTempC`                   |
 |  - Selection: `selectedHardwareId`, `selectedCableId`                                 |
 |  - Temporal Ring Buffer: `undo()`, `redo()`, `history`                                |
 |                                                                                       |
 |  useDragStore (Transient 60 Hz Pointer Coordination)                                  |
 |  - Frame-rate math: `isDragging: boolean`, `dropPosition: Vec3 | null`                 |
 |  - Snapping feedback: `isValid: boolean`, `rackUnits: number`, `depth: number`        |
 +---------------------------------------------------------------------------------------+
```

---

## 2. State Management & The 60 Hz Split

A primary performance bottleneck in 3D web configurators is React state thrashing during high-frequency pointer interactions. When a user drags a 4U server across a 42U rack, the pointer emits up to 120 `pointermove` events per second. Updating persistent component state at this frequency causes full-tree re-renders, stalling the JavaScript main thread and triggering visible frame drops.

### 2.1 The Two-Store Architecture

To achieve a locked 60 Hz (or 120 Hz on ProMotion displays) interaction loop, state is strictly split across two independent stores:

```
                          USER DRAGS HARDWARE IN 3D
                                     │
                     ┌───────────────┴───────────────┐
                     │                               │
        POINTERMOVE (60-120 Hz)              POINTERUP (Atomic)
                     │                               │
                     ▼                               ▼
       ┌───────────────────────────┐   ┌───────────────────────────┐
       │       useDragStore        │   │   useConfiguratorStore    │
       │     (Transient State)     │   │    (Persistent State)     │
       ├───────────────────────────┤   ├───────────────────────────┤
       │ • isDragging: true        │   │ • updateHardwarePosition  │
       │ • dropPosition: [0, y, 0] │   │ • recordHistorySnapshot   │
       │ • isValid: boolean        │   │ • recomputeTelemetry      │
       └─────────────┬─────────────┘   └─────────────┬─────────────┘
                     │                               │
                     ▼                               ▼
          Only <DropIndicator />           Full Component Tree
          re-renders at 60 Hz              re-renders ONCE on commit
```

### 2.2 Store Responsibilities & Interfaces

#### 1. Persistent Domain Store: `useConfiguratorStore`
* **Persistence Boundary:** Contains all data that must be serialized, exported to BOM, synchronized with NetBox DCIM, or tracked in the undo/redo history.
* **Component Subscription Pattern:** Subscribed components must use shallow equality selectors (`useShallow`) to prevent re-rendering when unrelated properties mutate.

```ts
export interface ConfiguratorState {
  racks: RackInstance[];
  activeRackId: string;
  capacity: number;
  rackType: RackFrameType;
  isDoorOpen: boolean;
  installedHardware: HardwareProps[];
  cables: CableProps[];
  selectedHardwareId: string | null;
  selectedCableId: string | null;
  viewMode: '3D' | 'blueprint';
  voltage: VoltageStandard;
  breakerRating: BreakerRating;
  ambientTempC: number;
  
  // Actions
  addHardware: (type: HardwareType, rackUnits: number, depth?: number) => void;
  removeHardware: (id: string) => void;
  updateHardwarePosition: (id: string, position: Vec3) => void;
  addCable: (cable: Omit<CableProps, 'id'>) => void;
  removeCable: (id: string) => void;
  undo: () => void;
  redo: () => void;
}
```

#### 2. Transient Coordination Store: `useDragStore`
* **High-Frequency Boundary:** Holds the instantaneous 3D intersection coordinates, computed snap grid ticks, and real-time bounding box collision flags.
* **Zero Component Re-renders:** Only the lightweight `<DropIndicator />` ghost mesh subscribes to this store. The chassis being dragged remains static in persistent state until `pointerup` fires.

```ts
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

---

## 3. Mathematical & Geometric Invariants

All spatial math across 3D meshes, collision detectors, snap helpers, and SVG elevation exporters references a single immutable source of truth: **EIA-310-D Standard Dimensions**.

### 3.1 Fundamental Metric Constants

$$\text{1 Rack Unit (1U)} = 1.750\text{ inches} = 44.450\text{ mm} = 0.04445\text{ m}$$
$$\text{Standard 19″ Horizontal Chassis Width} = 17.323\text{ inches} = 440.0\text{ mm} = 0.440\text{ m}$$
$$\text{Outer Mounting Hole Pitch} = 18.312\text{ inches} = 465.12\text{ mm} = 0.46512\text{ m}$$
$$\text{Multi-Rack Baying Pitch} = 800.0\text{ mm} = 0.800\text{ m}$$

```ts
export const RACK_UNIT_HEIGHT = 0.04445; // meters (1U)
export const CHASSIS_WIDTH = 0.44;       // meters (440 mm inner clearance)
export const BAY_SPACING = 0.8;          // meters (800 mm center-to-center)
export const EDGE_GAP = 0.005;           // meters (5 mm aesthetic clearance)
export const COLLISION_EPSILON = 0.001;  // meters (1 mm numerical tolerance)
```

### 3.2 Rack-Local Coordinate Frame

* **Origin $(0, 0, 0)$:** Floor level ($y = 0$), centered horizontally ($x = 0$) along the front mounting rail face ($z = 0$).
* **Positive $Y$ Axis:** Extends vertically toward the rack roof ($y = \text{capacity} \times \text{RACK\_UNIT\_HEIGHT}$).
* **Positive $Z$ Axis:** Extends forward toward the cold aisle. Chassis insertion projects along negative $Z$ into the cabinet depth.
* **Positive $X$ Axis:** Extends to the right rail face. Multi-rack baying positions adjacent racks at $x_k = k \times \text{BAY\_SPACING}$.

```
                   +Y (Vertical Top: capacity * 0.04445m)
                    ^
                    |
                    |       +----+ (Chassis Face: Width = 0.44m)
                    |      /    /|
                    |     +----+ |
                    |     |    | +
                    |     +----+/  Depth (0.6m - 0.8m)
                    |
                    +---------------------> +X (Right Rail)
                   / (Floor Zero: y = 0)
                  /
                 v
               +Z (Front Aisle / Door)
```

### 3.3 Parity-Aware Vertical Snapping (`snapToU`)

Chassis models anchor their geometric origin at their **volumetric center**. Because height varies with $U$-count, odd-height chassis ($1\text{U}, 3\text{U}, 5\text{U}$) and even-height chassis ($2\text{U}, 4\text{U}, 6\text{U}$) align differently relative to integer $U$ grid lines:

1. **Odd $U$ Parity ($1\text{U}, 3\text{U}, \dots$):** The center must sit on a **slot midpoint** ($y = k \cdot U + \frac{U}{2}$).
2. **Even $U$ Parity ($2\text{U}, 4\text{U}, \dots$):** The center must sit on a **slot boundary seam** ($y = k \cdot U$).

```
 [2U Chassis] Center @ y = 1.0 * U (Seam)     [1U Chassis] Center @ y = 0.5 * U (Midpoint)
 +-------------------------------------+       +-------------------------------------+ U2 (0.0889m)
 |                  ^                  |       |                                     |
 |                  | 0.5U             |       + - - - - - - - - - - - - - - - - - - + Midpoint (0.0666m)
 |                  v                  |       |                  ^                  |
 +==================X==================+ U1    +==================X==================+ U1 (0.0444m)
 |                  ^                  |       |                  | 0.5U             |
 |                  | 0.5U             |       |                  v                  |
 |                  v                  |       + - - - - - - - - - - - - - - - - - - + Midpoint (0.0222m)
 +-------------------------------------+ U0    +-------------------------------------+ U0 (0.0000m)
```

#### Mathematical Formulation

For a raw raycast intersection $y \in \mathbb{R}$ and chassis height $h_U \in \mathbb{N}^+$:

$$\operatorname{snapToU}(y, h_U) = \begin{cases} 
\operatorname{round}\left(\frac{y - U/2}{U}\right) \cdot U + \frac{U}{2}, & \text{if } h_U \equiv 1 \pmod 2 \\ 
\operatorname{round}\left(\frac{y}{U}\right) \cdot U, & \text{if } h_U \equiv 0 \pmod 2 
\end{cases}$$

```ts
export function snapToU(y: number, rackUnits: number): number {
  const u = RACK_UNIT_HEIGHT;
  const halfU = u / 2;
  if (rackUnits % 2 === 1) {
    const slotIndex = Math.round((y - halfU) / u);
    return slotIndex * u + halfU;
  }
  return Math.round(y / u) * u;
}
```

### 3.4 Floating-Point Range Collision Validation

The system evaluates collision validity by calculating the 1D closed interval $[y_{\min}, y_{\max}]$ occupied by each chassis along the vertical rail.

#### Footprint Definition

$$\mathcal{F}(y_c, h_U) = \left[ y_c - \frac{h_U \cdot U}{2}, \; y_c + \frac{h_U \cdot U}{2} \right]$$

#### Overlap Invariant with Epsilon Tolerance

Let $\mathcal{F}_{\text{drop}} = [a_{\min}, a_{\max}]$ be the candidate drop footprint, and $\mathcal{F}_i = [b_{\min, i}, b_{\max, i}]$ be the footprint of an installed chassis $i$.

A collision occurs if and only if:

$$\operatorname{Overlap}(\mathcal{F}_{\text{drop}}, \mathcal{F}_i) \iff \left( a_{\max} > b_{\min, i} + \varepsilon \right) \;\land\; \left( a_{\min} < b_{\max, i} - \varepsilon \right)$$

where $\varepsilon = \text{COLLISION\_EPSILON} = 0.001\text{ m}$ ($1.0\text{ mm}$).

```
 Case 1: Overlap Detected (Collision -> Invalid)
 Candidate:   [========== a_min ... a_max ==========]
 Installed:              [========== b_min ... b_max ==========]
 Condition:   (a_max > b_min + ε) AND (a_min < b_max - ε) === TRUE -> REJECT

 Case 2: Flush Seam Stacking (Allowed -> Valid)
 Candidate:   [========== a_min ... a_max ==========]
 Installed:                                         [========== b_min ... b_max ==========]
 Boundary:                                         a_max == b_min
 Condition:   (a_max > b_min + ε) === FALSE -> ACCEPT
```

The $\varepsilon$ buffer absorbs IEEE-754 floating-point inaccuracies and allows flush seam stacking (where $a_{\max} = b_{\min}$) without false-positive collision rejections.

---

## 4. Dual-Mode Rendering Pipeline

The configurator incorporates two distinct rendering paths optimized for different use cases: photoreal visual inspection (`3D`) and technical CAD drafting (`blueprint`).

```
                    ┌───────────────────────────────┐
                    │      useConfiguratorStore     │
                    │      viewMode === '...'       │
                    └───────────────┬───────────────┘
                                    │
            ┌───────────────────────┴───────────────────────┐
            │                                               │
            ▼ '3D'                                          ▼ 'blueprint'
 ┌─────────────────────────────────────┐   ┌─────────────────────────────────────┐
 │         PHOTOREAL PBR STAGE         │   │         CAD BLUEPRINT STAGE         │
 ├─────────────────────────────────────┤   ├─────────────────────────────────────┤
 │ • MeshStandardMaterial              │   │ • MeshBasicMaterial (Flat Colors)   │
 │   - Roughness: 0.2 - 0.7            │   │   - Background: #0a0a0a             │
 │   - Metalness: 0.1 - 0.85           │   │   - Chassis Body: #09090b           │
 │ • HDR Environment (Warehouse)       │   │   - Bezel Accents: #0c4a6e          │
 │ • DirectionalLight + AmbientLight   │   │ • Memoized EdgesGeometry (Cyan-400) │
 │ • Dynamic Contact Shadows           │   │ • Unmounted Lights, HDR & Shadows   │
 │ • Free Orbital Camera               │   │ • Locked Orthogonal Front Camera    │
 │ • Perspective Projection            │   │ • 84x SDF U-Height Text Labels      │
 └─────────────────────────────────────┘   └─────────────────────────────────────┘
```

### 4.1 Photoreal PBR Mode Pipeline (`3D`)
1. **Lighting & Environment:** Uses `<Environment preset="warehouse" />` combined with a key `<directionalLight castShadow position={[5, 8, 4]} intensity={1.6} />` and fill `<ambientLight intensity={0.35} />`.
2. **Floor Chrome:** Renders `<ContactShadows opacity={0.55} scale={10} blur={2.4} far={4} />` beneath the rack chassis, grounding the assembly on a dark infinite procedural grid (`#27272a`).
3. **Camera Rig:** Perspective camera with free orbit, smooth damping (`dampingFactor={0.08}`), and constrained polar angles preventing camera descent beneath floor level.

### 4.2 CAD Blueprint Mode Pipeline (`blueprint`)
1. **Lighting & Environment Bypass:** Ambient lights, directional lights, HDR environments, and contact shadows are completely unmounted from the scene graph, preventing GPU compute overhead for lighting passes.
2. **Flat Unlit Shading:** All chassis components switch references to static `MeshBasicMaterial` instances (`#09090b` chassis bodies, `#0c4a6e` anodized bezels, `#0284c7` structural flanges).
3. **Memoized Wireframe Overlays (`SchematicBox`):** Edge lines are extracted via `THREE.EdgesGeometry` with an angle threshold of $25^\circ$, rendering sharp cyan outlines (`#22d3ee` at $85\%$ opacity) along structural chassis seams:

```tsx
export function SchematicBox({ width, height, depth, position }: SchematicBoxProps) {
  const edgeGeo = useMemo(() => {
    const box = new THREE.BoxGeometry(width, height, depth);
    const edges = new THREE.EdgesGeometry(box, 25);
    box.dispose();
    return edges;
  }, [width, height, depth]);

  return (
    <lineSegments
      position={position}
      geometry={edgeGeo}
      material={blueprintEdgeMaterial}
      renderOrder={100}
    />
  );
}
```

4. **Orthogonal Camera Lock:** When switching to Blueprint mode, `SceneContents` animates the camera to a front-facing elevation coordinate $(x_{\text{rack}}, y_{\text{mid}}, 2.2\text{m})$, targets $(x_{\text{rack}}, y_{\text{mid}}, 0)$, and disables `OrbitControls.enableRotate`.

---

## 5. Pointer Event Isolation & HUD Architecture

The application layout layers a 2D HTML/DOM Heads-Up Display directly over the 3D WebGL Canvas. Because DOM elements sit higher in the browser rendering stack, naive pointer events would intercept raycasts and prevent 3D object interaction.

```
 +-----------------------------------------------------------------------+
 | HTML DOCUMENT BODY                                                    |
 |                                                                       |
 |   Layer 0 (z-0): 3D R3F WebGL Canvas (Pointer Target for 3D Scene)    |
 |   +---------------------------------------------------------------+   |
 |   | [Scene.tsx] Hardware Meshes, Cable Splines, OrbitControls     |   |
 |   +---------------------------------------------------------------+   |
 |                                                                       |
 |   Layer 1 (z-10): HUD Overlay Container (pointer-events: none)        |
 |   +---------------------------------------------------------------+   |
 |   | [Clicks pass straight through transparent voids to Canvas]    |   |
 |   |                                                               |   |
 |   |   Layer 2: Interactive Controls (pointer-events: auto)        |   |
 |   |   +-----------------------+       +-----------------------+   |   |
 |   |   | Left Control Panel    |       | Right Inventory Panel |   |   |
 |   |   | - Search & Catalog    |       | - Unit List & Shifter |   |   |
 |   |   | - Viewport Toggle     |       | - Power / Depth Range |   |   |
 |   |   +-----------------------+       +-----------------------+   |   |
 |   +---------------------------------------------------------------+   |
 +-----------------------------------------------------------------------+
```

### 5.1 The Isolation Protocol

1. **Root Overlay Container (`pointer-events-none`):** The parent HUD container covers the entire viewport (`inset-0`) with `pointer-events-none`. All clicks in empty areas pass directly to R3F's raycaster.
2. **Interactive Islands (`pointer-events-auto`):** Individual control sidebars, buttons, text inputs, and sliders declare `pointer-events-auto`, re-enabling click, scroll, and drag handlers on those UI elements.
3. **Pointer Capture during 3D Drag:** When dragging begins on a 3D chassis mesh, the interaction hook executes `e.target.setPointerCapture(e.pointerId)`. This binds subsequent pointer movement to the 3D target even if the cursor moves over HUD elements or exits the browser window, preventing drag loss.

---

## 6. Chassis & Hardware Module Registry

Hardware rendering is dynamic and extensible through a singleton `HardwareRegistry`. Adding a new hardware type requires zero modifications to the core R3F scene graph.

### 6.1 Implemented Modular Chassis Components

| Chassis Component | File Path | Default Height | Default Power | Port Density | Visual Features |
|---|---|---|---|---|---|
| **Server** | `Hardware/Server.tsx` | 1U / 2U / 4U | 350 W - 850 W | 4-8 RJ45 / SFP+ | Hot-swap 2.5″/3.5″ drive caddies, power toggle, activity LEDs |
| **Switch** | `Hardware/Switch.tsx` | 1U | 120 W | 48 RJ45 + 4 SFP+ | Instanced RJ45 ports, dual status LEDs per port, rack ears |
| **Router** | `Hardware/Router.tsx` | 1U / 2U | 180 W | 8 SFP28 + Console | Dual hot-swap rear PSUs, management console ports, hex venting |
| **Patch Panel** | `Hardware/PatchPanel.tsx` | 1U | 0 W | 24 Keystone Jacks | Keystone jack cutouts, write-on label strips, cable tie bars |
| **Firewall** | `Hardware/Firewall.tsx` | 1U | 220 W | 8 SFP+ + Bypass | High-vis security bezel, status alarm cluster, status LCD |
| **JBOD Storage** | `Hardware/JBOD.tsx` | 4U | 650 W | 4 SAS-3 / QSFP | 36 top/front-loading 3.5″ drive sleds with release latches |
| **NAS Storage** | `Hardware/NAS.tsx` | 2U | 280 W | 4 RJ45 + 2 SFP+ | 12 front drive trays, system status OLED display screen |
| **UPS Unit** | `Hardware/UPS.tsx` | 2U | 50 W (Idle) | C13/C19 Outlets | High-contrast battery status display, LED charge bar, alarm mute |
| **KVM Console** | `Hardware/KVMConsole.tsx` | 1U | 30 W | 1 VGA/USB Input | Slide-out tray drawer, 17″ tilting LCD panel, integrated keyboard |
| **Blanking Panel**| `Hardware/BlankingPanel.tsx`| 1U / 2U | 0 W | None | Matte airflow baffle, finger-snap toolless clips, hex perforations |
| **Brush Panel** | `Hardware/BrushPanel.tsx` | 1U | 0 W | Cable Pass-thru | High-density nylon bristle strip for clean cable passthrough |
| **Cable Manager** | `Hardware/CableManager.tsx` | 2U | 0 W | D-Ring Channels | High-capacity horizontal routing channel with hinged front cover |
| **Custom GLTF** | `Hardware/CustomGltfChassis.tsx`| Dynamic | Dynamic | Dynamic | User-uploaded `.glb`/`.gltf` asset with auto-computed bounding box |

### 6.2 The Registry Pattern

```ts
// src/utils/hardwareRegistry.ts
class HardwareRegistry {
  private renderers = new Map<HardwareType, React.ComponentType<{ hardware: HardwareProps }>>();

  register(type: HardwareType, renderer: React.ComponentType<{ hardware: HardwareProps }>) {
    this.renderers.set(type, renderer);
  }

  getRenderer(type: HardwareType) {
    return this.renderers.get(type);
  }
}

export const hardwareRegistry = new HardwareRegistry();
```

Hardware dispatch in `HardwareMapper.tsx` resolves renderers via this registry, falling back to `GenericFallbackHardware` when an unmapped plugin type is encountered.
