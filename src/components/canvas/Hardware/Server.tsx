/**
 * Server.tsx
 *
 * Single server instance: chassis mesh, front bezel, optional selection
 * outline, and drag-to-snap interaction delegated to
 * `useHardwareInteraction`.
 *
 * Visual signature
 * ----------------
 * 3D mode (default): dark matte chassis + near-black bezel, no accent
 * stripe — reads as a plain utility server.
 *
 * Blueprint mode: flat fills (matching dark chassis colour but without
 * PBR reflections), with sharp cyan wireframe edges around the chassis
 * body AND bezel, plus the side-mounted U-tick labels in `RackLabels`.
 * The hardware components stay clickable / draggable in BOTH modes
 * (snap math, collision, DropIndicator colour flips all still functional).
 *
 * Implementation
 * --------------
 * - PBR chassis + bezel materials are module-scoped (allocated once
 *   and shared across every server). Blueprint palette + edge
 *   materials live in `./shared` for the same reason.
 * - The blueprint material swap is reference-based (ternary on each
 *   mesh's `material` prop), so toggling viewMode is a pointer swap —
 *   no allocations, no React-key churn.
 * - Pointer events, drag state, hover/cursor, selection, and the
 *   window-level drag-fallback all live in `useHardwareInteraction`.
 *   This component is responsible only for the chassis + bezel meshes
 *   themselves, plus the shared `<SelectionOutline />` halo when
 *   selected.
 *
 * Convention: `hardware.position[1]` = server's vertical CENTER in
 * rack-local coordinates (y=0 is the floor). This matches the store's
 * `addHardware` default of `position: [0, rackUnits * RACK_UNIT_HEIGHT / 2, 0]`.
 */

import * as THREE from 'three';
import {
  RACK_UNIT_HEIGHT,
  CHASSIS_WIDTH,
  EDGE_GAP,
} from '../../../store/useConfiguratorStore';
import type { HardwareProps } from '../../../types/rack.types';
import { useHardwareInteraction } from '../../../hooks/useHardwareInteraction';
import {
  SelectionOutline,
  SchematicBox,
  blueprintChassisMaterial,
  blueprintBezelMaterial,
  useIsBlueprint,
} from './shared';

// -- Hoisted PBR materials ---------------------------------------------
// Module-scoped so they're allocated once and shared across every server.
const chassisMaterial = new THREE.MeshStandardMaterial({
  color: '#2b2b2b',
  metalness: 0.85,
  roughness: 0.4,
});

const bezelMaterial = new THREE.MeshStandardMaterial({
  color: '#050505',
  metalness: 0.5,
  roughness: 0.2,
});

interface ServerProps {
  hardware: HardwareProps;
}

export function Server({ hardware }: ServerProps) {
  // All event handlers, hover/select/drag state, and the cursor
  // styling live in the shared hook. We just spread them onto the
  // outermost <group>.
  const interaction = useHardwareInteraction(hardware);

  // Chassis height = U × rackUnits minus the shared edge gap so
  // adjacent units keep a thin visible seam between them.
  const chassisHeight = hardware.rackUnits * RACK_UNIT_HEIGHT - EDGE_GAP;
  const isBlueprint = useIsBlueprint();

  return (
    <group
      position={hardware.position}
      onPointerOver={interaction.onPointerOver}
      onPointerOut={interaction.onPointerOut}
      onPointerDown={interaction.onPointerDown}
      onPointerMove={interaction.onPointerMove}
      onPointerUp={interaction.onPointerUp}
      onPointerCancel={interaction.onPointerCancel}
    >
      {/* Main chassis */}
      <mesh
        castShadow={!isBlueprint}
        receiveShadow={!isBlueprint}
        material={isBlueprint ? blueprintChassisMaterial : chassisMaterial}
      >
        <boxGeometry args={[CHASSIS_WIDTH, chassisHeight, hardware.depth]} />
      </mesh>
      {isBlueprint && (
        <SchematicBox
          width={CHASSIS_WIDTH}
          height={chassisHeight}
          depth={hardware.depth}
        />
      )}

      {/* Front bezel — slightly inset, very dark */}
      <mesh
        position={[0, 0, hardware.depth / 2 + 0.001]}
        material={isBlueprint ? blueprintBezelMaterial : bezelMaterial}
      >
        <boxGeometry args={[CHASSIS_WIDTH - 0.02, chassisHeight, 0.002]} />
      </mesh>
      {isBlueprint && (
        <SchematicBox
          width={CHASSIS_WIDTH - 0.02}
          height={chassisHeight}
          depth={0.002}
        />
      )}

      {/* Selection halo — shared with Switch/Router/PatchPanel */}
      {interaction.isSelected && (
        <SelectionOutline
          rackUnits={hardware.rackUnits}
          depth={hardware.depth}
        />
      )}
    </group>
  );
}
