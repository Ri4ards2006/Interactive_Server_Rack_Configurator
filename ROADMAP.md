# Engineering Milestone Roadmap

> **Interactive 19″ Server Rack Configurator**  
> Strategic feature roadmap, technical milestones, and architectural evolution tracks.

---

## Roadmap Overview

```
+---------------------------------------------------------------------------------------+
|  PHASE 1: PRECISION & USABILITY (Short-Term: 0 - 3 Months)                            |
|  * Undo/Redo History Stack (Temporal Zustand Middleware)                              |
|  * Multi-Rack Bridging & Row Layouts (2x42U, Nx42U Baying)                            |
|  * Cable Routing Visualizer (Cat6 vs. OM4 Fiber, Physics Sag, Bundling)               |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
|  PHASE 2: THERMAL & ELECTRICAL SIMULATION (Mid-Term: 3 - 6 Months)                    |
|  * 3-Phase PDU Load Balancing (L1/L2/L3 Phase Math, A/B Redundancy, 80% NEC Rule)    |
|  * CFD-Lite Airflow & Thermal Heatmap (CFM Differentials, Delta-T, Blanking Leaks)    |
|  * Multi-Format Exporters (BOM CSV/JSON, GLTF 3D Export, Vector PDF Elevation)        |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
|  PHASE 3: INTEGRATION & ECOSYSTEM (Long-Term: 6 - 12 Months)                          |
|  * Bidirectional NetBox / RackHD DCIM API Synchronization (REST & GraphQL)            |
|  * Custom GLTF Asset Importer with Auto BBox Extraction & Port Locator Tool           |
|  * Headless CI/CD Validation Engine (`rack-lint` CLI for Git Ops Verification)        |
+---------------------------------------------------------------------------------------+
```

---

## Phase 1: Precision & Usability (Short-Term)

Focus: Elevating workspace editing precision, enabling multi-bay layouts, and introducing high-fidelity physical cabling.

### 1.1 Undo / Redo History Stack (`zundo` / Temporal Command Pattern)

#### Problem Statement
Currently, deletions (`removeHardware`, `removeCable`), position updates (`updateHardwarePosition`), and property adjustments immediately overwrite state with no roll-back mechanism.

#### Technical Architecture
Integrate Zustand's temporal middleware (`zundo`) or implement a bespoke command pattern layer:

```ts
// src/store/temporalMiddleware.ts
import { temporal } from 'zundo';
import { create } from 'zustand';
import { ConfiguratorState, useConfiguratorStore } from './useConfiguratorStore';

export interface HistoryTracker {
  pastStates: RackState[];
  futureStates: RackState[];
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
}

// Group rapid slider changes (e.g. powerDraw, depth) into single atomic transactions
export const equalityFilter = (
  pastState: ConfiguratorState,
  currentState: ConfiguratorState
): boolean => {
  return (
    JSON.stringify(pastState.installedHardware) === JSON.stringify(currentState.installedHardware) &&
    JSON.stringify(pastState.cables) === JSON.stringify(currentState.cables) &&
    pastState.rackType === currentState.rackType
  );
};
```

* **Keyboard Accelerators:** Global bindings for `Cmd+Z` / `Ctrl+Z` (Undo) and `Cmd+Shift+Z` / `Ctrl+Y` (Redo).
* **Batching Transaction Window:** Wrap continuous slider adjustments (`POWER_TARGET`, `DEPTH_SPEC`) in a 300 ms debounce bucket so single user drags produce a single undo record.

---

### 1.2 Multi-Rack Bridging & Row-Level Layouts

#### Problem Statement
Modern data center designs require side-by-side baying cabinets (e.g., Row A: Rack 01, Rack 02, Rack 03) with inter-rack cabling and shared overhead trays.

#### Technical Architecture

```
                    Row Spacing: RACK_GAP = 0.05 m
                  +-----------------+   +-----------------+
                  |                 |   |                 |
                  |     RACK-01     |<->|     RACK-02     |
                  |     (42U)       |   |     (42U)       |
                  |                 |   |                 |
                  +-----------------+   +-----------------+
                  x = 0.0 m             x = 0.65 m
```

* **Multi-Cabinet Schema:**
  ```ts
  export interface RackContainer {
    id: string; // e.g. "RACK-01"
    label: string;
    capacity: number;
    rackType: '2-post' | '4-post' | 'cabinet';
    isDoorOpen: boolean;
    worldOffset: [number, number, number]; // [xIndex * (CABINET_WIDTH + GAP), 0, 0]
    installedHardware: HardwareProps[];
  }
  ```
* **Coordinate Isolation:** Hardware coordinates remain rack-local ($[0, y, z]$), while R3F `<group position={rack.worldOffset}>` handles row translation.
* **Inter-Rack Cable Paths:** Patch cables spanning from `RACK-01` to `RACK-02` elevate dynamically through overhead ladder racks ($y = \text{height} + 0.15\text{ m}$) or down through raised-floor cutouts ($y = -0.10\text{ m}$).

---

### 1.3 Cable Routing Visualizer (Cat6 Copper vs. OM4 Fiber)

#### Problem Statement
Patch cables currently use a unified Catmull-Rom spline with generic curvature. Real-world network engineering requires distinguishing copper vs. optical fiber physical constraints.

#### Technical Architecture

```ts
export type CableMedium = 'cat6_copper' | 'cat6a_shielded' | 'om4_fiber' | 'os2_singlemode' | 'dac_twinax';

export interface ExtendedCableProps extends CableProps {
  medium: CableMedium;
  lengthMeters: number;
  outerDiameterMm: number;
  minBendRadiusMm: number;
  vlanTag?: number;
  subnetLabel?: string;
}
```

| Cable Type | Outer Diameter ($\varnothing$) | Min Bend Radius ($R_{\min}$) | Physical Sag Factor | Visual Shader / Material |
|---|---|---|---|---|
| **Cat6 UTP** | $6.0\text{ mm}$ | $4 \times \varnothing = 24\text{ mm}$ | Medium ($0.38$) | Matte PVC polymer, color-coded |
| **Cat6A STP** | $8.5\text{ mm}$ | $8 \times \varnothing = 68\text{ mm}$ | Low ($0.20$ - stiffer) | Thick metallic/braided sheath |
| **OM4 Multimode** | $2.0\text{ mm}$ | $10 \times \varnothing = 20\text{ mm}$ | High ($0.45$) | Aqua (`#06b6d4`) glossy zip-cord |
| **OS2 Singlemode** | $2.0\text{ mm}$ | $10 \times \varnothing = 20\text{ mm}$ | High ($0.45$) | Yellow (`#eab308`) thin jacket |
| **DAC Twinax** | $5.5\text{ mm}$ | $12 \times \varnothing = 66\text{ mm}$ | Very Low ($0.15$) | Matte black with cast metal SFP+ hoods |

* **Bend Radius Violations:** Real-time spline curvature evaluation:
  $$\kappa(t) = \frac{\|\mathbf{r}'(t) \times \mathbf{r}''(t)\|}{\|\mathbf{r}'(t)\|^3}$$
  If $R = \frac{1}{\kappa(t)} < R_{\min}$, highlight the cable section in pulsing crimson warning shaders.
* **Cable Bundling & Velcro Ties:** Group parallel cables within horizontal cable managers (`CableManager.tsx`) into single geometry bundles with cosmetic Velcro tie rings.

---

## Phase 2: Thermal & Electrical Simulation (Mid-Term)

Focus: Transforming the visual sandbox into an engineering-grade simulation and compliance tool.

### 2.1 3-Phase PDU Load Distribution & Electrical Balancing

#### Problem Statement
High-density server racks utilize 3-Phase 208V or 400V PDUs. Unbalanced loads across phases (L1, L2, L3) cause neutral wire overheating, premature breaker trips, and energy inefficiency.

#### Technical Architecture

```
          +-------------------------------------------------------------+
          |               3-PHASE PDU LOAD BALANCER                     |
          +-------------------------------------------------------------+
          | Phase L1: [||||||||||||||||||||] 14.2 A / 16.0 A  (88.7%)   |
          | Phase L2: [|||||||||||||||     ] 11.5 A / 16.0 A  (71.8%)   |
          | Phase L3: [||||||||||||||||    ] 12.8 A / 16.0 A  (80.0%)   |
          +-------------------------------------------------------------+
          | Phase Imbalance: 9.8% (<15% OK) · Total Load: 8.24 kW       |
          +-------------------------------------------------------------+
```

* **Mathematical Formulations:**
  * **Current per Phase (Single Phase Load on 208V line-to-line):**
    $$I_{\text{device}} = \frac{P_{\text{device}}}{V_{\text{LL}} \cdot \text{PF}} \quad (\text{where } V_{\text{LL}} = 208\text{ V}, \; \text{Power Factor } \text{PF} \approx 0.95)$$
  * **Phase Assignment:** Alternating C13/C19 outlets assigned to pairs (L1-L2, L2-L3, L3-L1).
  * **Phase Imbalance Percentage:**
    $$I_{\text{avg}} = \frac{I_{\text{L1}} + I_{\text{L2}} + I_{\text{L3}}}{3}$$
    $$\% \text{Imbalance} = \frac{\max\left( |I_{\text{L1}} - I_{\text{avg}}|, \; |I_{\text{L2}} - I_{\text{avg}}|, \; |I_{\text{L3}} - I_{\text{avg}}| \right)}{I_{\text{avg}}} \times 100$$
* **NEC 80% Continuous Duty Rule:**
  * Continuous load on a 20A circuit breaker must not exceed $16.0\text{ A}$ ($20\text{ A} \times 0.80$).
  * Any phase exceeding 80% triggers an amber warning; exceeding 100% triggers a critical red overload banner.
* **A/B Dual-Feed Redundancy Simulation:**
  * Models dual-corded servers connected to PDU-A and PDU-B.
  * Simulates a catastrophic PDU-A failure: calculates whether PDU-B can sustain 100% of the combined load without tripping its master breaker ($I_{\text{PDU-B}} \le \text{Breaker Rating} \times 0.80$).

---

### 2.2 CFD-Lite Thermal Heat-Map & Airflow Simulation

#### Problem Statement
Airflow mismanagement (e.g., missing blanking panels) causes hot-air recirculation, increasing server intake temperatures and fan power consumption.

#### Technical Architecture

```
         COLD AISLE (Front)                                HOT AISLE (Rear)
         Intake: 20°C (68°F)                              Exhaust: 35°C - 48°C
      +-----------------------+                         +-----------------------+
      |  [ Switch 1U ]        | === Airflow (50 CFM) => |  Exhaust: 28°C        |
      |  [ Server 2U ]        | == Airflow (180 CFM) => |  Exhaust: 38°C        |
      |  [ MISSING BLANKING ] | <= RECIRCULATION LEAK = |  HOT AIR INGESTION!   |
      |  [ Server 4U (JBOD) ] | == Airflow (320 CFM) => |  Exhaust: 46°C        |
      +-----------------------+                         +-----------------------+
```

* **Thermal Calculations:**
  * **Airflow Requirement per Device:**
    $$\text{CFM} = \frac{1.76 \cdot P_{\text{Watts}}}{\Delta T_{\text{target}} \left(^\circ\text{C}\right)}$$
  * **Temperature Rise Across Chassis:**
    $$\Delta T \left(^\circ\text{C}\right) = \frac{1.76 \cdot P_{\text{Watts}}}{\text{CFM}_{\text{actual}}}$$
* **Blanking Panel Bypass Penalty:**
  * Every unpopulated, unblanked $1U$ slot acts as a low-resistance airflow bypass.
  * Calculates pressure differential $\Delta P$ between front cold aisle ($+15\text{ Pa}$) and rear hot aisle.
  * Unsealed slots recirculate hot exhaust forward, elevating adjacent server inlet temperatures by $+3.2^\circ\text{C}$ per open $U$.
* **3D Volumetric Thermal Shader:**
  * Procedural vertex-color thermal gradient overlay rendered across the front/rear rack faces.
  * Blue ($<22^\circ\text{C}$) $\rightarrow$ Green ($22\text{--}27^\circ\text{C}$) $\rightarrow$ Amber ($28\text{--}35^\circ\text{C}$) $\rightarrow$ Red ($>35^\circ\text{C}$).

---

### 2.3 Comprehensive Multi-Format Exporters

#### 1. Bill of Materials (BOM) — CSV & Structured JSON
Exports exact commercial specifications:
* Rack frame SKU and post specs
* Installed hardware itemized list (Vendor, Type, Form Factor, Serial/Asset Tag)
* Cable schedule (ID, Origin Device/Port, Destination Device/Port, Medium, Color, Length)
* Electrical summary (Total kW, Minimum PDU Breaker Size, BTU/hr Heat Dissipation)

#### 2. 3D GLTF / USDZ Export
* Utilizes Three.js `GLTFExporter` to export the full 3D rack model with hierarchy and materials.
* Generates `.usdz` format for AR (Augmented Reality) spatial preview on iOS/macOS devices.

#### 3. Vector 2D PDF Elevation Schematic
* Generates architectural vector drawings of the front and rear elevations at standard scale (e.g., 1:10).
* Embedded tables displaying slot allocations (U1–U42), cable patch matrices, and phase balance graphs.

---

## Phase 3: Integration & Ecosystem (Long-Term)

Focus: Connecting the visual configurator directly into enterprise infrastructure workflows and CI/CD pipelines.

### 3.1 Bidirectional NetBox / RackHD DCIM Synchronization

#### Problem Statement
Enterprise data center managers use NetBox as their Single Source of Truth (SSOT). Creating configurations in a visual tool requires manual re-entry into NetBox.

#### Technical Architecture

```
 +-----------------------------+                    +-----------------------------+
 |       RACK CONFIGURATOR     |                    |        NETBOX DCIM API      |
 |                             |   REST / GraphQL   |                             |
 |  * Export Layout JSON       | -----------------> |  * POST /api/dcim/devices/  |
 |  * Real-time Canvas Editing | <----------------- |  * GET  /api/dcim/racks/    |
 |  * Live Sync Status Webhook |     Webhooks       |  * POST /api/dcim/cables/   |
 +-----------------------------+                    +-----------------------------+
```

* **Schema Mapping Protocol:**
  * NetBox `dcim.device` $\longleftrightarrow$ Configurator `HardwareProps`
  * NetBox `dcim.cable` $\longleftrightarrow$ Configurator `CableProps`
  * NetBox `dcim.rack` $\longleftrightarrow$ Configurator `RackState`
* **Conflict Resolution Strategy:** Three-way merge with client-side visual diff modal highlighting discrepancies (e.g. device in U10 exists in NetBox but was deleted in 3D canvas).

---

### 3.2 Custom GLTF/GLB Asset Importer & Tooling

#### Technical Architecture
Allows infrastructure vendors and sysadmins to import custom 3D server models:

```
[ User Drops custom-server.glb into Browser ]
  │
  ├── 1. Draco Mesh Decompression & Geometry Optimization
  ├── 2. Bounding Box Analysis: Computes Extents [W, H, D]
  │      └── Snaps Height to nearest integer Rack Unit (e.g., 0.0889 m -> 2U)
  ├── 3. Visual Bezel Port Registration Tool:
  │      └── User clicks on front/rear faces to create interactive Port anchor coordinates
  └── 4. Generates HardwarePluginDefinition JSON Manifest
```

---

### 3.3 Headless CI/CD Validation Engine (`rack-lint`)

#### Problem Statement
Data center infrastructure teams storing rack configurations as code in Git need automated verification before approving pull requests.

#### Technical Architecture
A headless CLI runner built on the existing pure-math modules (`src/utils/rackLayout.ts`, `src/hooks/snapToU.ts`):

```bash
# Example CI pipeline execution
$ npx rack-lint --config ./racks/datacenter-east-row3.json --strict

[PASS] EIA-310 Boundary & Seam Checks (42U rack, 100% compliant)
[PASS] Geometric Overlap Collision Engine (0 collisions detected)
[WARN] Airflow Alert: Slots U14-U16 are unpopulated and missing Blanking Panels.
[FAIL] Electrical Rule: Phase L1 current (17.2A) exceeds 80% continuous duty rating (16.0A).
[FAIL] Dual-Power Failure: Server "app-node-04" has single PSU connection on PDU-A.

Result: 2 Errors, 1 Warning. Pipeline exited with code 1.
```

