/**
 * CableManager.tsx
 *
 * 2U Cable Management Panel component.
 * Features a solid metal backplate, horizontal cable routing pass-through cutouts,
 * and a series of detailed plastic guide fingers (tines/ducts) projecting forward
 * to hold and organize patch cords.
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

// ---- Materials ------------------------------------------------------
const panelMaterial = new THREE.MeshStandardMaterial({
  color: '#18181b', // Matte dark grey/black
  metalness: 0.7,
  roughness: 0.5,
});

const plasticFingerMaterial = new THREE.MeshStandardMaterial({
  color: '#09090b', // Deep textured black plastic
  metalness: 0.1,
  roughness: 0.7,
});

const passThroughMaterial = new THREE.MeshBasicMaterial({
  color: '#020202', // Hollow slot recess
});

interface CableManagerProps {
  hardware: HardwareProps;
}

export function CableManager({ hardware }: CableManagerProps) {
  const RACK_UNITS = 2;
  const DEPTH = 0.08; // Extends forward and slightly backward

  const interaction = useHardwareInteraction({
    ...hardware,
    rackUnits: RACK_UNITS,
    depth: DEPTH,
  });

  const isBlueprint = useIsBlueprint();
  const chassisHeight = RACK_UNITS * RACK_UNIT_HEIGHT - EDGE_GAP;
  
  // Pivot and mounting face is at Z = 0.39.
  // The panel itself sits at Z = 0.39. The fingers extend forward (towards +Z).
  const panelZ = 0.39;

  // Let's create a row of 10 guide fingers spaced across the panel
  const FINGER_COUNT = 10;
  const FINGER_SPACING = 0.04;
  const startX = -((FINGER_COUNT - 1) * FINGER_SPACING) / 2;

  // Horizontal slot cutouts for cable routing
  const slotCount = 5;
  const slotSpacing = 0.08;
  const slotStartX = -((slotCount - 1) * slotSpacing) / 2;

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
      {/* Universal Rack Ears - No rails needed since it's a light front-panel accessory */}
      <RackMountDetails height={chassisHeight} depth={DEPTH} isBlueprint={isBlueprint} noRails />

      {/* Main metal backplate panel */}
      <mesh
        position={[0, 0, panelZ + 0.001]}
        castShadow={!isBlueprint}
        receiveShadow={!isBlueprint}
        material={isBlueprint ? blueprintBezelMaterial : panelMaterial}
      >
        <boxGeometry args={[CHASSIS_WIDTH - 0.02, chassisHeight, 0.003]} />
      </mesh>
      {isBlueprint && (
        <SchematicBox
          width={CHASSIS_WIDTH - 0.02}
          height={chassisHeight}
          depth={0.003}
          position={[0, 0, panelZ + 0.001]}
        />
      )}

      {/* Cable pass-through slots (horizontal recesses) */}
      {!isBlueprint && (
        <group>
          {Array.from({ length: slotCount }).map((_, i) => {
            const xOffset = slotStartX + i * slotSpacing;
            return (
              <group key={i} position={[xOffset, 0, panelZ + 0.002]}>
                {/* Hollow opening mesh */}
                <mesh material={passThroughMaterial}>
                  <boxGeometry args={[0.055, 0.016, 0.001]} />
                </mesh>
                {/* Bevel rim detail */}
                <mesh position={[0, 0, -0.0005]}>
                  <boxGeometry args={[0.059, 0.02, 0.0015]} />
                  <meshStandardMaterial color="#09090b" roughness={0.6} />
                </mesh>
              </group>
            );
          })}
        </group>
      )}

      {/* Cable Guide fingers (T-shaped/U-shaped tines extending forward) */}
      {!isBlueprint && (
        <group>
          {Array.from({ length: FINGER_COUNT }).map((_, i) => {
            const xOffset = startX + i * FINGER_SPACING;
            
            // Alternating slight offsets or heights for realism if needed, or symmetric
            return (
              <group key={i} position={[xOffset, 0, panelZ + 0.0025]}>
                {/* Horizontal main tine extending forward (Z-axis) */}
                <mesh position={[0, 0, 0.03]} castShadow material={plasticFingerMaterial}>
                  <boxGeometry args={[0.004, 0.012, 0.06]} /> {/* 6cm length */}
                </mesh>

                {/* Top hook pointing upward at the front end */}
                <mesh position={[0, 0.012, 0.057]} castShadow material={plasticFingerMaterial}>
                  <boxGeometry args={[0.004, 0.016, 0.006]} />
                </mesh>

                {/* Bottom hook pointing downward at the front end */}
                <mesh position={[0, -0.012, 0.057]} castShadow material={plasticFingerMaterial}>
                  <boxGeometry args={[0.004, 0.016, 0.006]} />
                </mesh>

                {/* Base mounting flange on panel */}
                <mesh position={[0, 0, 0.002]} material={plasticFingerMaterial}>
                  <boxGeometry args={[0.012, 0.024, 0.004]} />
                </mesh>
              </group>
            );
          })}
        </group>
      )}

      {/* Blueprint Schematic representation for fingers */}
      {isBlueprint && (
        <group>
          {Array.from({ length: FINGER_COUNT }).map((_, i) => {
            const xOffset = startX + i * FINGER_SPACING;
            return (
              <group key={i} position={[xOffset, 0, panelZ + 0.002]}>
                <SchematicBox
                  width={0.004}
                  height={0.012}
                  depth={0.06}
                  position={[0, 0, 0.03]}
                />
              </group>
            );
          })}
        </group>
      )}

      {/* Selection outline */}
      {interaction.isSelected && (
        <SelectionOutline
          rackUnits={RACK_UNITS}
          depth={DEPTH}
          position={[0, 0, panelZ + DEPTH / 2 - 0.01]}
        />
      )}
    </group>
  );
}
