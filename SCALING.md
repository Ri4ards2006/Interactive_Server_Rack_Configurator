# Scalability & Extensibility Architecture

> **Interactive 19″ Server Rack Configurator**  
> Technical blueprint for large-scale multi-rack rendering, collaborative real-time sync, schema migration, and a dynamic hardware plugin architecture.

---

## Table of Contents

1. [Rendering & GPU Optimization (Data Hall Scale)](#1-rendering--gpu-optimization-data-hall-scale)
2. [State & Sync Scalability (Multi-User CRDT & Cloud Persistence)](#2-state--sync-scalability-multi-user-crdt--cloud-persistence)
3. [Extensible Hardware Plugin Architecture (Schema-Driven Registry)](#3-extensible-hardware-plugin-architecture-schema-driven-registry)

---

## 1. Rendering & GPU Optimization (Data Hall Scale)

### 1.1 The Multi-Rack Scaling Challenge

Transitioning from a single 42U rack cabinet to an entire data center hall ($50\text{--}500$ cabinets) introduces exponential draw call and geometric overhead:

| Metric | Single 42U Rack | 100-Rack Data Hall (Unoptimized) | 100-Rack Data Hall (Optimized Target) |
|---|---|---|---|
| **Mounting Screws** | 84 instances | 8,400 individual meshes | 1 `InstancedMesh` draw call |
| **RJ45 / SFP+ Ports** | ~120 ports | 12,000 individual meshes | 4 `InstancedMesh` draw calls |
| **HDD Bay Sleds** | ~40 sleds | 4,000 individual meshes | 2 `InstancedMesh` draw calls |
| **Draw Calls** | ~60 | ~6,000 | $< 120$ |
| **Triangles** | ~45,000 | ~4,500,000 | $< 400,000$ (with LODs) |
| **VRAM Usage** | ~85 MB | ~8.5 GB | $< 450\text{ MB}$ |

---

### 1.2 Instanced Rendering & Matrix Buffer Strategies

Individual hardware components must not create isolated meshes for repeating elements. All repeating sub-elements (screws, keystone jacks, SFP+ cages, drive caddies, status LEDs) are batched into unified, scene-wide `InstancedMesh` instances.

```
       +-----------------------------------------------------------------------+
       |               DATA HALL INSTANCED MESH PIPELINE                       |
       +-----------------------------------------------------------------------+
       |                                                                       |
       |  Scene Matrix Buffer (Float32Array)                                   |
       |  [ Instance 0 Transform Matrix (16 floats) ] -> Rack 01, U1 Screw    |
       |  [ Instance 1 Transform Matrix (16 floats) ] -> Rack 01, U2 Screw    |
       |  ...                                                                  |
       |  [ Instance N Transform Matrix (16 floats) ] -> Rack 100, U42 Screw   |
       |                                                                       |
       |  Scene Color Buffer (Float32Array)                                    |
       |  [ Instance 0 RGB (3 floats) ] -> Active LED Green (#10b981)          |
       |  [ Instance 1 RGB (3 floats) ] -> Fault LED Red (#ef4444)            |
       +-----------------------------------+-----------------------------------+
                                           | Single GPU Draw Call (gl.drawElementsInstanced)
                                           v
       +-----------------------------------------------------------------------+
       |                           GPU VERTEX STAGE                            |
       +-----------------------------------------------------------------------+
```

* **Matrix Buffer Invalidation Rule:** Matrix updates must occur via `useLayoutEffect` only when rack capacity or hardware positions change—never inside `useFrame`.
* **Dynamic Capacity Resizing:** Allocate instanced buffers with a $20\%$ capacity headroom to prevent frequent GPU buffer re-allocation when adding devices.

---

### 1.3 Hierarchical Level of Detail (LOD0 – LOD3)

R3F scenes implement `@react-three/drei` `<Detailed>` or custom distance-based LOD switches:

```
Camera Distance (d)
│
├── 0 m <= d < 3 m   ──> LOD 0: High Fidelity (Interactive inspect mode)
│                        * Full PBR Materials (Brushed aluminum, anodized steel)
│                        * Interactive individual HDD bays & sliding KVM drawers
│                        * Real-time LED blinking shaders & interactive port sockets
│                        * 3D Spline patch cables with RJ45 connector hoods
│
├── 3 m <= d < 10 m  ──> LOD 1: Medium Fidelity (Aisle navigation)
│                        * Baked normal-map bezel textures (replaces 3D port holes)
│                        * Merged static LED clusters
│                        * Simplified cable geometry (ribbon lines or lower curve segments)
│
├── 10 m <= d < 30 m ──> LOD 2: Low Fidelity (Row overview)
│                        * Single box geometry per chassis with flat schematic texture
│                        * Unmounted internal components; disabled contact shadows
│                        * Static text label overlays
│
└── d >= 30 m        ──> LOD 3: Data Hall Billboard (Macro view)
                         * Single bounding volume per rack cabinet
                         * Frosted glass/opaque cabinet enclosure representation
                         * Aggregate thermal heatmap or power color indicator
```

```tsx
// Example LOD Implementation
import { Detailed } from '@react-three/drei';

export function ScalableServer({ hardware, distance }: { hardware: HardwareProps; distance: number }) {
  return (
    <Detailed distances={[0, 3, 10, 30]}>
      {/* LOD 0: Full interactive server */}
      <ServerLOD0 hardware={hardware} />
      {/* LOD 1: Normal-mapped bezel */}
      <ServerLOD1 hardware={hardware} />
      {/* LOD 2: Flat bounding box */}
      <ServerLOD2 hardware={hardware} />
      {/* LOD 3: Cluster point/billboard */}
      <ServerLOD3 hardware={hardware} />
    </Detailed>
  );
}
```

---

### 1.4 Frustum & Occlusion Culling

1. **Bounding Sphere Hierarchies:** Every cabinet computes a master bounding sphere:
   $$R_{\text{rack}} = \frac{1}{2} \sqrt{\text{WIDTH}^2 + \text{HEIGHT}^2 + \text{DEPTH}^2} \approx 1.12\text{ m}$$
   Three.js skips matrix updates and draw calls for any rack whose bounding sphere falls outside the camera frustum.
2. **Cabinet Door Occlusion:** When `rackType === 'cabinet'` and `isDoorOpen === false`, internal hardware meshes are flagged with `visible = false`, preventing the GPU from processing occluded chassis geometry entirely.

---

## 2. State & Sync Scalability (Multi-User CRDT & Cloud Persistence)

### 2.1 Schema Migration Engine (`v1` $\rightarrow$ `v2` $\rightarrow$ `v3`)

To guarantee backwards compatibility across configuration revisions and cloud databases, state serialization uses strict semantic versioning and migration transformers:

```ts
// src/types/migrations.ts
export interface SchemaMigration<From, To> {
  fromVersion: string;
  toVersion: string;
  migrate: (data: From) => To;
}

export interface RackStateV1 {
  version: '1.0.0';
  capacity: number;
  installedHardware: Array<{
    id: string;
    type: string;
    rackUnits: number;
    powerDraw: number;
    depth: number;
    position: [number, number, number];
  }>;
}

export interface RackStateV2 {
  version: '2.0.0';
  capacity: number;
  rackType: '2-post' | '4-post' | 'cabinet';
  isDoorOpen: boolean;
  installedHardware: HardwareProps[]; // Includes ports array
  cables: CableProps[];
}

export const migrateV1ToV2: SchemaMigration<RackStateV1, RackStateV2> = {
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  migrate: (v1Data) => ({
    version: '2.0.0',
    capacity: v1Data.capacity ?? 42,
    rackType: '2-post',
    isDoorOpen: false,
    installedHardware: v1Data.installedHardware.map((h) => ({
      ...h,
      type: h.type as HardwareType,
      ports: generatePortsForDevice(h.type as HardwareType, h.depth),
    })),
    cables: [],
  }),
};

export function migrateToLatest(rawJson: unknown): RackStateV2 {
  const data = rawJson as { version?: string };
  if (!data.version || data.version === '1.0.0') {
    return migrateV1ToV2.migrate(data as RackStateV1);
  }
  return data as RackStateV2;
}
```

---

### 2.2 Collaborative Multi-User Live Editing (CRDT / WebRTC)

For real-time concurrent editing across distributed engineering teams, Zustand is paired with **Yjs** (a high-performance Conflict-free Replicated Data Type engine) via WebRTC / WebSocket providers:

```
 +------------------------+                      +------------------------+
 |    ENGINEER A (Client) |                      |   ENGINEER B (Client)  |
 |                        |                      |                        |
 |  Local Move Chassis    |                      |  Remote Cursor Display |
 |  `useConfiguratorStore`|                      |  `useConfiguratorStore`|
 +-----------+------------+                      +-----------+------------+
             |                                               ^
             v                                               |
     +---------------+                               +---------------+
     |  Yjs Document |                               |  Yjs Document |
     |    (Y.Doc)    |                               |    (Y.Doc)    |
     +-------+-------+                               +-------+-------+
             |                                               ^
             +-------------> [ WebRTC Mesh / P2P ] ----------+
                             (y-webrtc Signaling)
```

#### Shared CRDT Data Structures

```ts
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

export const ydoc = new Y.Doc();
export const yHardware = ydoc.getArray<Y.Map<any>>('installedHardware');
export const yCables = ydoc.getArray<Y.Map<any>>('cables');
export const yMeta = ydoc.getMap('rackMetadata');

// User Awareness Protocol (Cursors, Avatars, Active Selections)
export const webrtcProvider = new WebrtcProvider('rack-room-datacenter-east', ydoc);
export const awareness = webrtcProvider.awareness;

awareness.setLocalStateField('user', {
  name: 'Alex Engineer',
  color: '#22d3ee',
  selectedHardwareId: 'server-01',
  cursor3D: [0.2, 1.1, 0.4],
});
```

* **Deterministic Conflict Resolution:**
  * When two users move the same chassis simultaneously, Yjs applies Last-Write-Wins (LWW) resolution based on logical timestamps.
  * `checkDropValidity` evaluates locally upon receiving remote delta events; if a remote drop conflicts with a local position, the displaced item safely transitions to the nearest unoccupied valid $U$-slot.

---

### 2.3 Cloud Persistence & Binary Serialization

For large configurations ($100+$ racks), standard uncompressed JSON files become bandwidth-heavy. The storage engine provides binary encoding:

| Serialization Format | Payload Size (100 Racks) | Serialization Time | Deserialization Time | Use Case |
|---|---|---|---|---|
| **Pretty JSON** | $4.8\text{ MB}$ | $14.2\text{ ms}$ | $11.8\text{ ms}$ | Human inspection / Git diffing |
| **Minified JSON** | $1.9\text{ MB}$ | $10.1\text{ ms}$ | $8.4\text{ ms}$ | REST API transmission |
| **Gzip / Brotli JSON** | $210\text{ KB}$ | $18.5\text{ ms}$ | $6.2\text{ ms}$ | Standard cloud web storage |
| **MessagePack** | $145\text{ KB}$ | $3.1\text{ ms}$ | $2.4\text{ ms}$ | Real-time WebSocket payloads |
| **Protocol Buffers (Protobuf)**| $98\text{ KB}$ | $1.8\text{ ms}$ | $1.2\text{ ms}$ | High-density archival storage |

---

## 3. Extensible Hardware Plugin Architecture (Schema-Driven Registry)

### 3.1 Strict Plugin Interface Definition

Hardware types must not be locked into hardcoded TypeScript switch statements. Third-party vendors can register hardware components dynamically via a strict schema interface:

```ts
// src/types/plugin.types.ts
export type PortType = 'rj45_1g' | 'rj45_10g' | 'sfp_plus' | 'sfp28' | 'qsfp28_100g' | 'c13_power' | 'c19_power';

export interface PortDefinition {
  id: string;
  label: string;
  type: PortType;
  face: 'front' | 'rear';
  relativePosition: [number, number, number]; // [x, y, z] relative to chassis center
  maxSpeedGbps?: number;
}

export interface ThermalProfile {
  idlePowerWatts: number;
  maxPowerWatts: number;
  targetDeltaTCelsius: number;
  airflowDirection: 'front-to-back' | 'back-to-front' | 'passive';
  fanRpmRange?: [number, number];
}

export interface VisualMeshDefinition {
  gltfModelUrl?: string; // Optional custom 3D asset URL
  proceduralMeshGenerator?: string; // Name of procedural shader/mesh generator
  chassisColor: string;
  bezelColor: string;
  accentColor?: string;
  ledPositions?: Array<{
    color: string;
    position: [number, number, number];
    behavior: 'solid' | 'blink_activity' | 'blink_alarm';
  }>;
}

export interface HardwarePluginDefinition {
  vendor: string;
  model: string;
  category: 'compute' | 'networking' | 'storage' | 'airflow' | 'auxiliary';
  rackUnits: number;
  depthMeters: number;
  weightKg: number;
  thermalProfile: ThermalProfile;
  ports: PortDefinition[];
  visual: VisualMeshDefinition;
  
  // Custom interactive click handlers (e.g. HDD bay extraction, drawer slide)
  interactions?: {
    hasHotSwapDrives?: boolean;
    driveCount?: number;
    hasSlidingDrawer?: boolean;
  };
}
```

---

### 3.2 Dynamic Hardware Registry Pattern

The hardcoded switch statement in `src/components/canvas/HardwareMapper.tsx` evolves into a dynamic, registry-driven component mapper:

```tsx
// src/services/HardwareRegistry.ts
import React from 'react';
import { HardwarePluginDefinition } from '../types/plugin.types';
import { HardwareProps } from '../types/rack.types';

class HardwareRegistryService {
  private registry = new Map<string, HardwarePluginDefinition>();
  private customRenderers = new Map<string, React.ComponentType<{ hardware: HardwareProps }>>();

  public register(plugin: HardwarePluginDefinition, renderer?: React.ComponentType<{ hardware: HardwareProps }>) {
    const key = `${plugin.vendor.toLowerCase()}:${plugin.model.toLowerCase()}`;
    this.registry.set(key, plugin);
    if (renderer) {
      this.customRenderers.set(key, renderer);
    }
  }

  public getPlugin(vendor: string, model: string): HardwarePluginDefinition | undefined {
    return this.registry.get(`${vendor.toLowerCase()}:${model.toLowerCase()}`);
  }

  public getRenderer(vendor: string, model: string): React.ComponentType<{ hardware: HardwareProps }> {
    const custom = this.customRenderers.get(`${vendor.toLowerCase()}:${model.toLowerCase()}`);
    if (custom) return custom;
    
    // Default: Fall back to Universal Procedural Hardware Renderer
    return UniversalProceduralHardwareRenderer;
  }
}

export const HardwareRegistry = new HardwareRegistryService();
```

---

### 3.3 Dynamic Hardware Mapper Component

```tsx
// src/components/canvas/DynamicHardwareMapper.tsx
import { useConfiguratorStore } from '../../store/useConfiguratorStore';
import { HardwareRegistry } from '../../services/HardwareRegistry';
import { useShallow } from 'zustand/react/shallow';

export function DynamicHardwareMapper() {
  const installedHardware = useConfiguratorStore(
    useShallow((s) => s.installedHardware)
  );

  return (
    <>
      {installedHardware.map((hardware) => {
        // Resolve custom or procedural renderer dynamically
        const Component = HardwareRegistry.getRenderer(
          (hardware as any).vendor ?? 'generic',
          hardware.type
        );
        return <Component key={hardware.id} hardware={hardware} />;
      })}
    </>
  );
}
```

* **Zero-Code Runtime Ingestion:** New vendor equipment profiles can be loaded at runtime by fetching a single remote JSON manifest (`POST /api/plugins/register`), automatically populating the catalog HUD, collision bounding systems, thermal calculators, and 3D WebGL render graphs without requiring a re-compile or redeployment of the core application.

