/**
 * BlankingPanel.tsx
 *
 * 1U or 2U airflow blocker blanking panel.
 * Made of a flat, heavily textured, powder-coated dark grey panel
 * with two plastic snap-in clips on the left and right edges.
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
  RackMountDetails,
} from './shared';

const blankMaterial = new THREE.MeshStandardMaterial({
  color: '#121214', // heavily textured powder-coated dark grey
  metalness: 0.2,
  roughness: 0.8,
});

const clipMaterial = new THREE.MeshStandardMaterial({
  color: '#080809', // black plastic clips
  metalness: 0.1,
  roughness: 0.6,
});

interface BlankingPanelProps {
  hardware: HardwareProps;
}

export function BlankingPanel({ hardware }: BlankingPanelProps) {
  const interaction = useHardwareInteraction(hardware);
  const isBlueprint = useIsBlueprint();

  const DEPTH = 0.02;
  const chassisHeight = hardware.rackUnits * RACK_UNIT_HEIGHT - EDGE_GAP;
  const zShift = 0.39 - DEPTH / 2;

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
      {/* Universal Rack Ears (But no side extension rails) */}
      <RackMountDetails height={chassisHeight} depth={DEPTH} isBlueprint={isBlueprint} noRails />

      {/* Main panel face sheet */}
      <mesh
        position={[0, 0, zShift]}
        castShadow={!isBlueprint}
        receiveShadow={!isBlueprint}
        material={isBlueprint ? blueprintChassisMaterial : blankMaterial}
      >
        <boxGeometry args={[CHASSIS_WIDTH - 0.02, chassisHeight, DEPTH]} />
      </mesh>
      {isBlueprint && (
        <SchematicBox
          width={CHASSIS_WIDTH - 0.02}
          height={chassisHeight}
          depth={DEPTH}
          position={[0, 0, zShift]}
        />
      )}

      {/* Left and right plastic snap-in clips */}
      {!isBlueprint && (
        <group position={[0, 0, 0.39]}>
          {/* Left clip */}
          <mesh position={[-CHASSIS_WIDTH / 2 + 0.015, 0, 0.001]} material={clipMaterial}>
            <boxGeometry args={[0.008, chassisHeight * 0.4, 0.004]} />
          </mesh>
          {/* Right clip */}
          <mesh position={[CHASSIS_WIDTH / 2 - 0.015, 0, 0.001]} material={clipMaterial}>
            <boxGeometry args={[0.008, chassisHeight * 0.4, 0.004]} />
          </mesh>
        </group>
      )}

      {/* Selection outline */}
      {interaction.isSelected && (
        <SelectionOutline
          rackUnits={hardware.rackUnits}
          depth={DEPTH}
          position={[0, 0, zShift]}
        />
      )}
    </group>
  );
}
