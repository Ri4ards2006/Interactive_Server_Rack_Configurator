/**
 * shared.ts
 *
 * Hardware-level shared resources used by every chassis component
 * (Server, Switch, Router, PatchPanel). Anything that would otherwise
 * be a copy-pasted block across the four files lives here so that a
 * single change to e.g. the selection halo material updates them all
 * in lockstep.
 *
 * Included:
 *   - `selectionMaterial`: the cyan wireframe material used as the
 *      selection halo. Module-scoped so it's allocated once per app
 *      lifetime and shared across every chassis (no per-instance
 *      allocation, no GPU re-upload on selection flips).
 *   - `SelectionOutline`: a tiny R3F component that renders the
 *      cyan halo sized exactly to a given chassis. Each hardware
 *      component renders `{isSelected && <SelectionOutline rackUnits=
 *      {hardware.rackUnits} depth={hardware.depth} />}` so the halo
 *      geometry stays consistent without re-deriving constants at
 *      four call-sites.
 */

import * as THREE from 'three';
import {
  RACK_UNIT_HEIGHT,
  SELECTION_OUTLINE_INSET,
  SELECTION_OUTLINE_WIDTH,
} from '../../../store/useConfiguratorStore';

// Cyan-400 wireframe halo. `depthTest: false` keeps the halo visible
// even when the chassis is partly occluded by the rack frame or other
// hardware, and the translucent wireframe reads as "interactive
// affordance" rather than a solid selection box.
export const selectionMaterial = new THREE.MeshBasicMaterial({
  color: '#22d3ee',
  wireframe: true,
  transparent: true,
  opacity: 0.55,
  depthTest: false,
});

interface SelectionOutlineProps {
  /** Vertical extent of the parent chassis, in rack units. */
  rackUnits: number;
  /** Depth of the parent chassis, in meters. */
  depth: number;
}

/**
 * Renders the cyan selection halo sized to match a chassis of the
 * given `rackUnits` × `depth`. Render order 999 keeps it visually on
 * top of other meshes; combined with the material's `depthTest: false`
 * this guarantees the halo never disappears behind the chassis body.
 */
export function SelectionOutline({ rackUnits, depth }: SelectionOutlineProps) {
  return (
    <mesh
      position={[0, 0, 0]}
      material={selectionMaterial}
      renderOrder={999}
    >
      <boxGeometry
        args={[
          SELECTION_OUTLINE_WIDTH,
          rackUnits * RACK_UNIT_HEIGHT + SELECTION_OUTLINE_INSET,
          depth + SELECTION_OUTLINE_INSET,
        ]}
      />
    </mesh>
  );
}
