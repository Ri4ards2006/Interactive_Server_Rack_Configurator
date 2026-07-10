/**
 * RackScrews.tsx
 *
 * Renders the dozens of small mounting screws that secure hardware to
 * the rack rails. Two rails (left + right), one screw per U-slot, so
 * total count = capacity × 2.
 *
 * Implementation notes:
 * - Uses `InstancedMesh` so we keep one draw call for ALL screws.
 * - Matrices are written ONCE per capacity change (via `useLayoutEffect`)
 *   instead of every frame (`useFrame`). This is the correct pattern;
 *   the blueprint's `useFrame` works but wastes CPU.
 * - Rail positions are fixed offsets from the rack center so the screws
 *   always sit flush against the inside of each corner post.
 *
 * Visual signature
 * ----------------
 * 3D mode (default): PBR metallic dark screws (silver-black).
 * Blueprint mode: flat near-black fill — screws drop into the schematic
 * alongside the rack frame + chassis outlines.
 */

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useConfiguratorStore, RACK_UNIT_HEIGHT } from '../../../store/useConfiguratorStore';
import { useIsBlueprint } from '../Hardware/shared';

// Rail offsets — distance from rack center to each rail's screw column.
const RAIL_X = 0.27;
// Depth of the screws inside the rack (positive = front-facing face).
const SCREW_OFFSET_Z = 0.39;
// Screw dimensions (cylinder: radius_top, radius_bottom, height, segments).
const SCREW_RADIUS = 0.0035;
const SCREW_HEIGHT = 0.008;
const SCREW_SEGMENTS = 8;

// Module-scoped PBR + blueprint materials. Allocated once at import
// time so the conditional swap on `viewMode` flip is a reference
// assignment — no allocations.
const screwMaterial = new THREE.MeshStandardMaterial({
  color: '#0a0a0a',
  metalness: 0.95,
  roughness: 0.25,
});

const blueprintScrewMaterial = new THREE.MeshBasicMaterial({
  color: '#27272a', // slightly lighter than the chassis fill so screws read as distinct dots
});

interface RackScrewsProps {
  /** Optional override; defaults to `capacity * 2`. */
  count?: number;
}

export function RackScrews({ count }: RackScrewsProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const isBlueprint = useIsBlueprint();

  // `capacity` is a primitive so a plain `===` selector is optimal.
  const capacity = useConfiguratorStore((s) => s.capacity);
  const totalScrews = count ?? capacity * 2;

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;

    let i = 0;
    for (const x of [-RAIL_X, RAIL_X]) {
      for (let u = 0; u < capacity; u++) {
        // Position each screw at the vertical center of its U-slot,
        // slightly forward of center depth so they're visible from the front.
        dummy.position.set(
          x,
          u * RACK_UNIT_HEIGHT + RACK_UNIT_HEIGHT / 2,
          SCREW_OFFSET_Z,
        );
        // Slight rotation so the screw head reads as a real hex cap.
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
    }

    // Anything we didn't touch should be hidden far away (defensive: never
    // hit since i === totalScrews at the end, but cheap insurance).
    if (i < totalScrews) {
      dummy.position.set(0, -1000, 0);
      dummy.updateMatrix();
      for (; i < totalScrews; i++) mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    // Crucial for frustum culling — without this the instance bounds
    // would be the cylinder's local bounds, not the spread of all screws.
    mesh.computeBoundingSphere();
  }, [capacity, totalScrews, dummy]);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, totalScrews]}
      castShadow={!isBlueprint}
      receiveShadow={!isBlueprint}
      material={isBlueprint ? blueprintScrewMaterial : screwMaterial}
    >
      <cylinderGeometry
        args={[SCREW_RADIUS, SCREW_RADIUS, SCREW_HEIGHT, SCREW_SEGMENTS]}
      />
    </instancedMesh>
  );
}
