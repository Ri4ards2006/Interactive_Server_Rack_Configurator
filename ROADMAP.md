# Engineering Milestone Roadmap

> **Interactive 19″ Server Rack Configurator**  
> Strategic feature roadmap, technical milestones, and architectural evolution tracks.

---

## Roadmap Overview & Release Status

```
+---------------------------------------------------------------------------------------+
|  [x] PHASE 1: PRECISION & USABILITY (COMPLETED - v1.0.0)                              |
|  * Undo/Redo History Stack (Temporal Snapshot Middleware)                             |
|  * Multi-Rack Bridging & Row Layouts (2x42U, Nx42U Baying)                            |
|  * Cable Routing Visualizer (Cat6 vs. OM4 Fiber, Physics Sag, Bend Radii)             |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
|  [x] PHASE 2: THERMAL & ELECTRICAL SIMULATION (COMPLETED - v1.0.0)                    |
|  * 3-Phase PDU Load Balancing (L1/L2/L3 Phase Math, A/B Redundancy, 80% NEC Rule)    |
|  * CFD-Lite Airflow & Thermal Heatmap (CFM Differentials, Delta-T, Blanking Leaks)    |
|  * Multi-Format Exporters (BOM CSV/JSON, GLTF 3D Export, Vector SVG Elevation)        |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
|  [x] PHASE 3: INTEGRATION & ECOSYSTEM (COMPLETED - v1.0.0)                            |
|  * Bidirectional NetBox DCIM API Synchronization (REST Client & Offline Mock)         |
|  * Custom GLTF Asset Importer with Auto BBox Extraction & 19" EIA Mounting Fit        |
|  * Headless CI/CD Validation Engine (`rack-lint` CLI & GitHub Actions Workflow)       |
+---------------------------------------------------------------------------------------+
```

---

## Phase 1: Precision & Usability [COMPLETED]

Focus: Elevating workspace editing precision, enabling multi-bay layouts, and introducing high-fidelity physical cabling.

### 1.1 Undo / Redo History Stack [x] COMPLETED
- Implemented immutable snapshot history tracking in `useConfiguratorStore.ts`.
- `Ctrl+Z` / `Cmd+Z` (Undo) and `Ctrl+Y` / `Cmd+Shift+Z` (Redo) keyboard shortcuts and HUD controls.
- Comprehensive test suite in `src/store/__tests__/undoRedo.test.ts`.

### 1.2 Multi-Rack Bridging & Row-Level Layouts [x] COMPLETED
- Multi-cabinet schema `RackInstance[]` supporting baying offsets ($X = \text{index} \times 0.65\,\text{m}$).
- Dynamic rack creation, deletion, renaming, and active bay focus switching.
- Inter-rack patch cable routing across adjacent bays.
- Verified in `src/store/__tests__/multiRack.test.ts`.

### 1.3 Cable Routing Visualizer & Physics [x] COMPLETED
- Cable models for `copper-cat6`, `copper-cat6a`, `fiber-om4`, `fiber-os2`, and `dac-10g`.
- Smooth 3D catenary sag curves (`CatmullRomCurve3`) in `src/utils/cableGeometry.ts`.
- Physical bend radius tolerance evaluations and visual violation alerts.
- Verified in `src/utils/__tests__/cableGeometry.test.ts`.

---

## Phase 2: Thermal & Electrical Simulation [COMPLETED]

Focus: Transforming the visual sandbox into an engineering-grade simulation and compliance tool.

### 2.1 3-Phase PDU Load Distribution & Electrical Balancing [x] COMPLETED
- RMS phase current calculation: $I = \frac{P}{V \cdot \cos\varphi}$ with nominal power factor $\cos\varphi = 0.95$.
- IEEE/ANSI phase imbalance percentage calculations.
- NEC 80% continuous duty safety thresholds and breaker trip detection (16A, 20A, 32A, 63A).
- A/B Dual-Feed outage failover simulation and kill-switches.
- Verified in `src/utils/__tests__/electricalCalculations.test.ts`.

### 2.2 ASHRAE Thermal Heat-Map & Airflow Simulation [x] COMPLETED
- Chassis temperature rise: $\Delta T = \frac{1.76 \times P}{\text{CFM}}$.
- Airflow CFM estimation per device class.
- Hot-air recirculation bypass model penalizing inlet temps when open unblanked U-slots exist.
- 3D thermal heatmap overlay, color-coded temperature badges, and HUD cold aisle intake slider.
- Verified in `src/utils/__tests__/thermalCalculations.test.ts`.

### 2.3 Comprehensive Multi-Format Exporters [x] COMPLETED
- **BOM CSV & Structured JSON:** Complete bill of materials with BTU/hr heat conversions, phase assignments, and cable schedules (`src/utils/exporters/bomExporter.ts`).
- **3D Binary GLTF (.GLB):** Serializes active 3D scene to CAD-ready binary GLTF (`src/utils/exporters/gltfExporter.ts`).
- **2D Vector SVG Elevation:** Publication-ready 2D rack drawings with EIA-310-D rail markings (`src/utils/exporters/elevationExporter.ts`).
- Verified in `src/utils/exporters/__tests__/bomExporter.test.ts`.

---

## Phase 3: Integration & Ecosystem [COMPLETED]

Focus: Connecting the visual configurator directly into enterprise infrastructure workflows and CI/CD pipelines.

### 3.1 Bidirectional NetBox DCIM API Synchronization [x] COMPLETED
- REST API client for NetBox DCIM in `src/utils/netbox/netboxClient.ts`.
- Schema transformers mapping NetBox devices and elevations to 3D `HardwareProps` and back.
- Built-in realistic offline mock dataset in `src/utils/netbox/mockNetboxData.ts`.
- HUD DCIM sync modal with one-click pull and push actions.
- Verified in `src/utils/netbox/__tests__/netboxClient.test.ts`.

### 3.2 Custom GLTF/GLB Vendor Asset Importer [x] COMPLETED
- `CustomGltfChassis.tsx` 3D component with automatic bounding box calculation (`THREE.Box3`).
- Drag-and-drop file upload zone in the Left Sidebar Hardware Catalog for `.glb`/`.gltf` 3D vendor models.
- Automatic 19-inch mounting fit and U-height detection.

### 3.3 Headless CI/CD Validation Engine (`rack-lint`) [x] COMPLETED
- Zero-dependency headless CLI linter in `src/cli/rackLint.ts` and `bin/rack-lint.js`.
- Rules enforced: `ERR_COLLISION`, `ERR_OUT_OF_BOUNDS`, `ERR_PDU_OVERLOAD`, `ERR_BEND_RADIUS`, `WARN_THERMAL_BYPASS`, `WARN_TOP_HEAVY`.
- Automated GitHub Actions compliance workflow in `.github/workflows/rack-compliance.yml`.
- Verified in `src/cli/__tests__/rackLint.test.ts`.
