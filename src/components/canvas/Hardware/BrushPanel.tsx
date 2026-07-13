/**
 * BrushPanel.tsx
 *
 * 1U Cable Brush Panel.
 * Features a solid metal frame enclosing a dense horizontal dark
 * bristle strip for airflow block and cable routing pass-through.
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

const frameMaterial = new THREE.MeshStandardMaterial({
  color: '#1a1a1c',
  metalness: 0.8,
  roughness: 0.3,
});

const bristleMaterial = new THREE.MeshStandardMaterial({
  color: '#080809', // black textured bristle look
  metalness: 0.1,
  roughness: 0.95,
});

interface BrushPanelProps {
  hardware: HardwareProps;
}

export function BrushPanel({ hardware }: BrushPanelProps) {
  const interaction = useHardwareInteraction(hardware);
  const isBlueprint = useIsBlueprint();

  const DEPTH = 0.02;
  const chassisHeight = RACK_UNIT_HEIGHT - EDGE_GAP;
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
      {/* Universal Rack Ears (No rails) */}
      <RackMountDetails height={chassisHeight} depth={DEPTH} isBlueprint={isBlueprint} noRails />

      {/* Outer structural metal frame */}
      <mesh
        position={[0, 0, zShift]}
        castShadow={!isBlueprint}
        receiveShadow={!isBlueprint}
        material={isBlueprint ? blueprintChassisMaterial : frameMaterial}
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

      {/* Horizontal bristle pass-through opening */}
      {!isBlueprint && (
        <group>
          {/* Inner recess shadow */}
          <mesh position={[0, 0, 0.39 - 0.001]} material={bristleMaterial}>
            <boxGeometry args={[CHASSIS_WIDTH - 0.08, chassisHeight - 0.016, 0.002]} />
          </mesh>
          
          {/* Dense brush fiber lines details */}
          <mesh position={[0, 0, 0.39]} material={bristleMaterial}>
            <boxGeometry args={[CHASSIS_WIDTH - 0.08, 0.004, 0.004]} />
          </mesh>
        </group>
      )}

      {/* Selection outline */}
      {interaction.isSelected && (
        <SelectionOutline
          rackUnits={1}
          depth={DEPTH}
          position={[0, 0, zShift]}
        />
      )}
    </group>
  );
}
