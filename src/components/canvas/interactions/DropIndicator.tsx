/**
 * DropIndicator.tsx
 *
 * A semi-transparent "ghost" mesh that previews where a hardware
 * item will snap to during a drag. Renders ONLY while a drag is
 * actively in progress (so it's free at rest).
 *
 * Drop target validity:
 * - `useDragStore.isValid` is read atomically with the rest of the
 *   snapshot. When `true`, the ghost is emerald (valid drop slot);
 *   when `false`, it is crimson (collision / out-of-bounds).
 *
 * Architectural notes:
 * - Reads from the *transient* `useDragStore`, NOT the main
 *   `useConfiguratorStore`. Drag state lives in its own ephemeral
 *   store (per the configurator's design rules) so it never pollutes
 *   persistence-shaped state.
 * - Subscribes to the drag fields atomically via `useShallow`, so
 *   this component only re-renders when the drag snapshot changes.
 * - BOTH valid and invalid materials are module-scoped so they're
 *   allocated once at import time. The render loop just swaps
 *   between the two pre-existing references — no allocations, no
 *   `new THREE.MeshBasicMaterial(...)` inside JSX.
 *
 * Visual conventions match Server.tsx so the indicator reads as
 * "this is exactly where the chassis will land":
 *   - chassis width:   CHASSIS_WIDTH
 *   - chassis height:  rackUnits * RACK_UNIT_HEIGHT - EDGE_GAP
 *   - chassis depth:   hardware depth (typically 0.6 m)
 *   - position[1]:     the snapped VERTICAL CENTER in rack-local coords
 *
 * These constants are now imported from `useConfiguratorStore` so the
 * ghost can never drift away from real chassis dimensions.
 */

import { useShallow } from 'zustand/react/shallow';
import * as THREE from 'three';
import { useDragStore } from '../../../store/useDragStore';
import {
  CHASSIS_WIDTH,
  EDGE_GAP,
  RACK_UNIT_HEIGHT,
} from '../../../store/useConfiguratorStore';

// Module-scoped materials — allocated once at import time, never
// recreated inside the render loop. Both materials share `depthWrite:
// false` so they don't occlude underlying hardware / rack geometry.
const validMaterial = new THREE.MeshBasicMaterial({
  color: '#10b981', // emerald-500
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
});

const invalidMaterial = new THREE.MeshBasicMaterial({
  color: '#ef4444', // red-500
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
});

export function DropIndicator() {
  // Subscribe to all five drag fields atomically. useShallow compares
  // each field with Object.is so DropIndicator only re-renders when
  // something in the snapshot actually changes — including the new
  // `isValid` validity flag (no separate render path).
  const { isDragging, isValid, dropPosition, rackUnits, depth } = useDragStore(
    useShallow((s) => ({
      isDragging: s.isDragging,
      isValid: s.isValid,
      dropPosition: s.dropPosition,
      rackUnits: s.rackUnits,
      depth: s.depth,
    })),
  );

  // Hide entirely when not dragging. This is the gate the user requested.
  if (!isDragging || !dropPosition) return null;

  // Geometry math duplicates Server.tsx's chassis math. EDGE_GAP gives
  // a small visible seam between stacked units the same way the real
  // chassis does.
  const height = rackUnits * RACK_UNIT_HEIGHT - EDGE_GAP;

  // Single translucent box. The material reference is chosen at
  // render time between TWO pre-built module references —
  // reference assignment, NOT an allocation, so this stays safe
  // inside the render loop.
  return (
    <group position={dropPosition}>
      <mesh
        renderOrder={998}
        material={isValid ? validMaterial : invalidMaterial}
      >
        <boxGeometry args={[CHASSIS_WIDTH, height, depth]} />
      </mesh>
    </group>
  );
}
