/**
 * Server.tsx
 *
 * Single server instance: chassis mesh, front bezel, optional selection
 * outline, and drag-to-snap interaction delegated to
 * `useHardwareInteraction`.
 *
 * Visual overhaul:
 * - Aligns to Z = 0.39 as front face so the chassis extends backward.
 *   Avoids the floating look by mounting ears and side rails.
 * - Details dynamic front drive bays (Release levers + bay outlines)
 *   and status indicator LEDs.
 * - Enhances textures using matte dark steel and anodized bezel.
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

// -- Hoisted PBR materials ---------------------------------------------
const chassisMaterial = new THREE.MeshStandardMaterial({
  color: '#222224', // Matte textured dark steel
  metalness: 0.5,
  roughness: 0.6,
});

const bezelMaterial = new THREE.MeshStandardMaterial({
  color: '#1a1a1c', // Anodized/brushed dark grey aluminum
  metalness: 0.8,
  roughness: 0.3,
});

const driveMaterial = new THREE.MeshStandardMaterial({
  color: '#0f0f10', // Dark polymer drive bay
  metalness: 0.6,
  roughness: 0.4,
});

const leverMaterial = new THREE.MeshStandardMaterial({
  color: '#4a4a4e', // Silver-brushed lever
  metalness: 0.9,
  roughness: 0.2,
});

const ledBlueMaterial = new THREE.MeshBasicMaterial({
  color: '#06b6d4', // Glowing cyan locator LED
  toneMapped: false,
});

const ledGreenMaterial = new THREE.MeshBasicMaterial({
  color: '#10b981', // Glowing green power LED
  toneMapped: false,
});

interface ServerProps {
  hardware: HardwareProps;
}

export function Server({ hardware }: ServerProps) {
  const interaction = useHardwareInteraction(hardware);
  const chassisHeight = hardware.rackUnits * RACK_UNIT_HEIGHT - EDGE_GAP;
  const isBlueprint = useIsBlueprint();

  // Shift chassis body back so front aligns to Z = 0.39
  const zShift = 0.39 - hardware.depth / 2;

  // Dynamic drive grid based on U size
  const driveRows = hardware.rackUnits;
  const driveCols = 4;
  const driveW = (CHASSIS_WIDTH - 0.1) / driveCols;
  const driveH = (chassisHeight - 0.01) / driveRows;

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
      <RackMountDetails height={chassisHeight} depth={hardware.depth} isBlueprint={isBlueprint} />

      {/* Main chassis body - shifted back */}
      <mesh
        position={[0, 0, zShift]}
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
          position={[0, 0, zShift]}
        />
      )}

      {/* Front bezel - placed flush at Z = 0.39 */}
      <mesh
        position={[0, 0, 0.39 + 0.001]}
        material={isBlueprint ? blueprintBezelMaterial : bezelMaterial}
      >
        <boxGeometry args={[CHASSIS_WIDTH - 0.02, chassisHeight, 0.002]} />
      </mesh>
      {isBlueprint && (
        <SchematicBox
          width={CHASSIS_WIDTH - 0.02}
          height={chassisHeight}
          depth={0.002}
          position={[0, 0, 0.39 + 0.001]}
        />
      )}

      {/* High-density drive bays & status LEDs */}
      {!isBlueprint && (
        <group position={[0, 0, 0.39 + 0.002]}>
          {Array.from({ length: driveRows }).map((_, r) =>
            Array.from({ length: driveCols }).map((_, c) => {
              const dx = -CHASSIS_WIDTH / 2 + 0.05 + c * (driveW + 0.005) + driveW / 2;
              const dy = -chassisHeight / 2 + 0.005 + r * (driveH + 0.002) + driveH / 2;
              return (
                <group key={`drive-${r}-${c}`} position={[dx, dy, 0]}>
                  {/* Drive drawer */}
                  <mesh material={driveMaterial}>
                    <boxGeometry args={[driveW, driveH - 0.002, 0.001]} />
                  </mesh>
                  {/* Release lever */}
                  <mesh position={[-driveW / 2 + 0.008, 0, 0.0005]} material={leverMaterial}>
                    <boxGeometry args={[0.008, driveH - 0.006, 0.0005]} />
                  </mesh>
                </group>
              );
            })
          )}

          {/* Diagnostic indicators on the right wing */}
          <mesh position={[CHASSIS_WIDTH / 2 - 0.02, 0, 0.001]} material={ledGreenMaterial}>
            <sphereGeometry args={[0.0025, 8, 8]} />
          </mesh>
          <mesh position={[CHASSIS_WIDTH / 2 - 0.012, 0, 0.001]} material={ledBlueMaterial}>
            <sphereGeometry args={[0.0025, 8, 8]} />
          </mesh>
        </group>
      )}

      {/* Selection outline - matches the shifted chassis position */}
      {interaction.isSelected && (
        <SelectionOutline
          rackUnits={hardware.rackUnits}
          depth={hardware.depth}
          position={[0, 0, zShift]}
        />
      )}
    </group>
  );
}
