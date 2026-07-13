/**
 * KVMConsole.tsx
 *
 * 1U Foldable KVM Console drawer.
 * If selected, the drawer slides forward by +0.15m on the Z-axis
 * and opens a 17" diagonal LCD panel.
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
  color: '#27272a',
  metalness: 0.6,
  roughness: 0.5,
});

const drawerMaterial = new THREE.MeshStandardMaterial({
  color: '#3f3f46', // Brushed aluminum drawer face
  metalness: 0.8,
  roughness: 0.25,
});

const keyboardMaterial = new THREE.MeshStandardMaterial({
  color: '#09090b',
  metalness: 0.1,
  roughness: 0.8,
});

const screenMaterial = new THREE.MeshStandardMaterial({
  color: '#18181b',
  metalness: 0.3,
  roughness: 0.6,
});

interface KVMConsoleProps {
  hardware: HardwareProps;
}

export function KVMConsole({ hardware }: KVMConsoleProps) {
  const interaction = useHardwareInteraction(hardware);
  const isBlueprint = useIsBlueprint();

  const RACK_UNITS = 1;
  const DEPTH = 0.4;
  const chassisHeight = RACK_UNITS * RACK_UNIT_HEIGHT - EDGE_GAP;
  const zShift = 0.39 - DEPTH / 2;

  // Selected state animation
  const isSelected = interaction.isSelected;
  const slideOffset = isSelected ? 0.15 : 0;

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

      {/* Main outer chassis body (fixed in place) */}
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

      {/* Slide drawer & Bezel - animates forward if selected */}
      <group position={[0, 0, slideOffset]}>
        {/* Drawer Face / Bezel */}
        <mesh
          position={[0, 0, 0.39 + 0.0015]}
          material={isBlueprint ? blueprintBezelMaterial : drawerMaterial}
        >
          <boxGeometry args={[CHASSIS_WIDTH - 0.025, chassisHeight - 0.002, 0.003]} />
        </mesh>
        {isBlueprint && (
          <SchematicBox
            width={CHASSIS_WIDTH - 0.025}
            height={chassisHeight - 0.002}
            depth={0.003}
            position={[0, 0, 0.39 + 0.0015]}
          />
        )}

        {/* Pull handle */}
        {!isBlueprint && (
          <mesh position={[0, 0, 0.39 + 0.0035]} material={chassisMaterial}>
            <boxGeometry args={[0.12, 0.006, 0.002]} />
          </mesh>
        )}

        {/* Keyboard tray (slides out with drawer) */}
        {!isBlueprint && isSelected && (
          <group>
            {/* Tray bed */}
            <mesh position={[0, -0.01, 0.39 - 0.07]} material={keyboardMaterial}>
              <boxGeometry args={[0.38, 0.004, 0.14]} />
            </mesh>
            {/* Micro keyboard keys details */}
            <mesh position={[0, -0.007, 0.39 - 0.08]} material={screenMaterial}>
              <boxGeometry args={[0.34, 0.002, 0.08]} />
            </mesh>
            {/* Trackpad area */}
            <mesh position={[0, -0.007, 0.39 - 0.025]} material={drawerMaterial}>
              <boxGeometry args={[0.06, 0.002, 0.025]} />
            </mesh>
          </group>
        )}

        {/* Opened 17" LCD panel (unfolds if selected) */}
        {!isBlueprint && isSelected && (
          <group position={[0, 0.01, 0.39 - 0.145]} rotation={[-Math.PI / 5, 0, 0]}>
            {/* Screen frame */}
            <mesh material={drawerMaterial}>
              <boxGeometry args={[0.38, 0.24, 0.008]} />
            </mesh>
            {/* LCD display screen */}
            <mesh position={[0, 0, 0.0045]} material={screenMaterial}>
              <boxGeometry args={[0.35, 0.21, 0.001]} />
            </mesh>
            {/* Glowing active screen bezel logo / light */}
            <mesh position={[0, -0.11, 0.005]}>
              <sphereGeometry args={[0.0015, 8, 8]} />
              <meshBasicMaterial color="#10b981" toneMapped={false} />
            </mesh>
          </group>
        )}
      </group>

      {/* Selection outline - fits the fixed chassis position */}
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
