/**
 * UPS.tsx
 *
 * 2U Uninterruptible Power Supply (UPS) chassis.
 * Contains front-panel segmented LCD display, heavy power button,
 * and status LEDs, styled with matte textured dark steel.
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

const chassisMaterial = new THREE.MeshStandardMaterial({
  color: '#1a1a1c',
  metalness: 0.6,
  roughness: 0.55,
});

const bezelMaterial = new THREE.MeshStandardMaterial({
  color: '#0e0e0f',
  metalness: 0.8,
  roughness: 0.3,
});

const lcdMaterial = new THREE.MeshBasicMaterial({
  color: '#0284c7', // Glowing light blue LCD backlight
  toneMapped: false,
});

const powerBtnMaterial = new THREE.MeshStandardMaterial({
  color: '#dc2626', // Red power button
  metalness: 0.3,
  roughness: 0.5,
});

const ledGreenMaterial = new THREE.MeshBasicMaterial({
  color: '#10b981',
  toneMapped: false,
});

interface UPSProps {
  hardware: HardwareProps;
}

export function UPS({ hardware }: UPSProps) {
  const interaction = useHardwareInteraction(hardware);
  const isBlueprint = useIsBlueprint();

  const RACK_UNITS = 2;
  const DEPTH = 0.6;
  const chassisHeight = RACK_UNITS * RACK_UNIT_HEIGHT - EDGE_GAP;
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
      {/* Universal Rack Ears & Extension Support Rails */}
      <RackMountDetails height={chassisHeight} depth={DEPTH} isBlueprint={isBlueprint} />

      {/* Main chassis body - shifted back */}
      <mesh
        position={[0, 0, zShift]}
        castShadow={!isBlueprint}
        receiveShadow={!isBlueprint}
        material={isBlueprint ? blueprintChassisMaterial : chassisMaterial}
      >
        <boxGeometry args={[CHASSIS_WIDTH, chassisHeight, DEPTH]} />
      </mesh>
      {isBlueprint && (
        <SchematicBox
          width={CHASSIS_WIDTH}
          height={chassisHeight}
          depth={DEPTH}
          position={[0, 0, zShift]}
        />
      )}

      {/* Front bezel */}
      <mesh
        position={[0, 0, 0.39 + 0.0015]}
        material={isBlueprint ? blueprintBezelMaterial : bezelMaterial}
      >
        <boxGeometry args={[CHASSIS_WIDTH - 0.02, chassisHeight, 0.003]} />
      </mesh>
      {isBlueprint && (
        <SchematicBox
          width={CHASSIS_WIDTH - 0.02}
          height={chassisHeight}
          depth={0.003}
          position={[0, 0, 0.39 + 0.0015]}
        />
      )}

      {/* High-fidelity Front Panel Details (LCD, Power button, LEDs) */}
      {!isBlueprint && (
        <group position={[0, 0, 0.39 + 0.003]}>
          {/* Segmented LCD display */}
          <mesh position={[-0.08, 0, 0.0005]}>
            <boxGeometry args={[0.12, 0.03, 0.001]} />
            <meshBasicMaterial color="#020202" />
          </mesh>
          <mesh position={[-0.08, 0, 0.0012]} material={lcdMaterial}>
            <boxGeometry args={[0.11, 0.025, 0.0002]} />
          </mesh>
          
          {/* Heavy-duty power button */}
          <mesh position={[0.08, 0, 0.001]} material={powerBtnMaterial}>
            <cylinderGeometry args={[0.008, 0.008, 0.002, 16]} />
          </mesh>

          {/* Status indicators */}
          <mesh position={[0.13, 0.01, 0.001]} material={ledGreenMaterial}>
            <sphereGeometry args={[0.002, 8, 8]} />
          </mesh>
          <mesh position={[0.13, -0.01, 0.001]} material={ledGreenMaterial}>
            <sphereGeometry args={[0.002, 8, 8]} />
          </mesh>
        </group>
      )}

      {/* Selection outline */}
      {interaction.isSelected && (
        <SelectionOutline
          rackUnits={RACK_UNITS}
          depth={DEPTH}
          position={[0, 0, zShift]}
        />
      )}
    </group>
  );
}
