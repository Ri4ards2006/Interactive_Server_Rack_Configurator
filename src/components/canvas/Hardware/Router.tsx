/**
 * Router.tsx
 *
 * Network router chassis: dual PSU bays on the left third of the
 * front bezel, a centre vent grille representing fan trays, and
 * high-density SFP+ cages on the right two-thirds.
 *
 * Overhaul:
 * - Aligns to Z = 0.39 as front face so the chassis extends backward.
 *   Avoids the floating look by mounting ears and side rails.
 * - Adds console ports (RJ45 + USB-C shape) and dual hot-swappable
 *   fan tray handles in the vent section.
 * - Upgrades all textures to PBR matte steel, anodized aluminum bezel,
 *   and glowing emissive status LEDs.
 */

import { useLayoutEffect, useRef } from 'react';
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
  blueprintAccentMaterial,
  useIsBlueprint,
  RackMountDetails,
} from './shared';

// ---- Router-specific geometry constants -----------------------------
const ACCENT_STRIPE_WIDTH = 0.45;
const ACCENT_STRIPE_HEIGHT = 0.002;

// PSU outline dimensions
const PSU_WIDTH = 0.08;
const PSU_GAP_X = 0.015;
const PSU_TOP_MARGIN = 0.008;

// Vent grille
const VENT_BAR_WIDTH = 0.004;
const VENT_BAR_COUNT = 6;
const VENT_BAR_GAP = 0.003;
const VENT_SECTION_WIDTH =
  VENT_BAR_COUNT * VENT_BAR_WIDTH +
  (VENT_BAR_COUNT - 1) * VENT_BAR_GAP;

// SFP+ cages
const SFP_COLS = 16;
const SFP_W = 0.009;
const SFP_H = 0.009;
const SFP_GAP_X = 0.006;
const SFP_GAP_Y = 0.006;

// Status LEDs row above SFP
const STATUS_LED_COUNT = 4;

// ---- PBR Materials --------------------------------------------------
const chassisMaterial = new THREE.MeshStandardMaterial({
  color: '#222224',
  metalness: 0.5,
  roughness: 0.6,
});

const bezelMaterial = new THREE.MeshStandardMaterial({
  color: '#1a1a1c',
  metalness: 0.8,
  roughness: 0.3,
});

const accentMaterial = new THREE.MeshStandardMaterial({
  color: '#f59e0b', // amber-500
  emissive: '#b45309',
  emissiveIntensity: 0.8,
  metalness: 0.4,
  roughness: 0.5,
});

const psuMaterial = new THREE.MeshStandardMaterial({
  color: '#2d2d30',
  metalness: 0.7,
  roughness: 0.4,
});

const psuLeverMaterial = new THREE.MeshStandardMaterial({
  color: '#c084fc', // purple lever accent
  metalness: 0.8,
  roughness: 0.3,
});

const ventMaterial = new THREE.MeshStandardMaterial({
  color: '#0d0d0f',
  metalness: 0.7,
  roughness: 0.6,
});

const sfpMaterial = new THREE.MeshStandardMaterial({
  color: '#cbd5e1', // silver cage
  metalness: 0.9,
  roughness: 0.2,
});

const ledMaterial = new THREE.MeshBasicMaterial({
  toneMapped: false,
  transparent: true,
  opacity: 0.95,
});

const consolePortMaterial = new THREE.MeshStandardMaterial({
  color: '#52525b',
  metalness: 0.9,
  roughness: 0.25,
});

const portHoleMaterial = new THREE.MeshBasicMaterial({
  color: '#020202',
});

const blueprintPsuMaterial = new THREE.MeshBasicMaterial({
  color: '#27272a',
});
const blueprintVentMaterial = new THREE.MeshBasicMaterial({
  color: '#0a0a0a',
});
const blueprintSfpMaterial = new THREE.MeshBasicMaterial({
  color: '#94a3b8',
});

const LED_GREEN = new THREE.Color('#10b981');
const LED_RED = new THREE.Color('#ef4444');

interface RouterProps {
  hardware: HardwareProps;
  rackUnits?: number;
}

export function Router({ hardware, rackUnits = 1 }: RouterProps) {
  const ventRef = useRef<THREE.InstancedMesh>(null);
  const sfpRef = useRef<THREE.InstancedMesh>(null);
  const ledRef = useRef<THREE.InstancedMesh>(null);

  const finalRackUnits = hardware.rackUnits ?? rackUnits;
  const DEPTH = 0.4;

  const interaction = useHardwareInteraction({
    ...hardware,
    rackUnits: finalRackUnits,
    depth: DEPTH,
  });
  const isBlueprint = useIsBlueprint();
  const chassisHeight = finalRackUnits * RACK_UNIT_HEIGHT - EDGE_GAP;
  const zShift = 0.39 - DEPTH / 2;

  // PSU placements
  const psuAreaLeftX = -CHASSIS_WIDTH / 2 + 0.025;
  const psu1X = psuAreaLeftX + PSU_WIDTH / 2;
  const psu2X = psu1X + PSU_WIDTH / 2 + PSU_GAP_X + PSU_WIDTH / 2;

  // Vent section between PSUs and SFPs
  const ventSectionLeftEdge = psu2X + PSU_WIDTH / 2 + 0.02;
  const ventSectionLeftX = ventSectionLeftEdge + VENT_SECTION_WIDTH / 2;

  // SFP+ array
  const sfpRows = Math.max(
    1,
    Math.floor((chassisHeight - ACCENT_STRIPE_HEIGHT - 0.02) / (SFP_H + SFP_GAP_Y))
  );
  const totalSfpGridW = SFP_COLS * SFP_W + (SFP_COLS - 1) * SFP_GAP_X;
  const totalSfpGridH = sfpRows * SFP_H + (sfpRows - 1) * SFP_GAP_Y;
  const sfpStartX = CHASSIS_WIDTH / 2 - 0.025 - totalSfpGridW + SFP_W / 2;
  const sfpStartY = -chassisHeight / 2 + totalSfpGridH / 2 + 0.01;

  const bezelDepthOffset = 0.39 + 0.0015;
  const portDepthOffset = 0.39 + 0.003;

  const totalSfps = sfpRows * SFP_COLS;

  // -- Vent grille bars ------------------------------------------------
  useLayoutEffect(() => {
    const mesh = ventRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const ventStartX = ventSectionLeftX - VENT_SECTION_WIDTH / 2 + VENT_BAR_WIDTH / 2;
    for (let i = 0; i < VENT_BAR_COUNT; i++) {
      dummy.position.set(
        ventStartX + i * (VENT_BAR_WIDTH + VENT_BAR_GAP),
        0,
        portDepthOffset,
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.count = VENT_BAR_COUNT;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ventSectionLeftX, portDepthOffset]);

  // -- SFP+ cages ------------------------------------------------------
  useLayoutEffect(() => {
    const mesh = sfpRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let r = 0; r < sfpRows; r++) {
      for (let c = 0; c < SFP_COLS; c++) {
        dummy.position.set(
          sfpStartX + c * (SFP_W + SFP_GAP_X),
          sfpStartY + r * (SFP_H + SFP_GAP_Y),
          portDepthOffset,
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
    }
    mesh.count = totalSfps;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [sfpStartX, sfpStartY, portDepthOffset, totalSfps, sfpRows]);

  // -- Status LEDs ----------------------------------------------------
  useLayoutEffect(() => {
    const mesh = ledRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const ledsStartX = sfpStartX + SFP_W / 2 - 0.003;
    const ledY = sfpStartY + totalSfpGridH / 2 + 0.004;
    for (let i = 0; i < STATUS_LED_COUNT; i++) {
      dummy.position.set(
        ledsStartX + i * 0.015,
        ledY,
        portDepthOffset,
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, i === 2 ? LED_RED : LED_GREEN);
    }
    mesh.count = STATUS_LED_COUNT;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [sfpStartX, sfpStartY, portDepthOffset, totalSfpGridH]);

  const psuHeight = chassisHeight - 2 * PSU_TOP_MARGIN;
  const psuY = 0;

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

      {/* Main chassis - shifted back */}
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

      {/* Front bezel - flush at Z = 0.39 */}
      <mesh
        position={[0, 0, bezelDepthOffset]}
        material={isBlueprint ? blueprintBezelMaterial : bezelMaterial}
      >
        <boxGeometry args={[CHASSIS_WIDTH - 0.02, chassisHeight, 0.003]} />
      </mesh>
      {isBlueprint && (
        <SchematicBox
          width={CHASSIS_WIDTH - 0.02}
          height={chassisHeight}
          depth={0.003}
          position={[0, 0, bezelDepthOffset]}
        />
      )}

      {/* Amber accent stripe */}
      <mesh
        position={[
          0,
          chassisHeight / 2 - ACCENT_STRIPE_HEIGHT - 0.0015,
          bezelDepthOffset + 0.0005,
        ]}
        material={isBlueprint ? blueprintAccentMaterial : accentMaterial}
      >
        <boxGeometry
          args={[ACCENT_STRIPE_WIDTH, ACCENT_STRIPE_HEIGHT, 0.001]}
        />
      </mesh>
      {isBlueprint && (
        <SchematicBox
          width={ACCENT_STRIPE_WIDTH}
          height={ACCENT_STRIPE_HEIGHT}
          depth={0.001}
          position={[0, chassisHeight / 2 - ACCENT_STRIPE_HEIGHT - 0.0015, bezelDepthOffset + 0.0005]}
        />
      )}

      {/* Dual PSU bays */}
      <group>
        <mesh
          position={[psu1X, psuY, bezelDepthOffset + 0.0005]}
          material={isBlueprint ? blueprintPsuMaterial : psuMaterial}
        >
          <boxGeometry args={[PSU_WIDTH, psuHeight, 0.002]} />
        </mesh>
        {isBlueprint && (
          <SchematicBox
            width={PSU_WIDTH}
            height={psuHeight}
            depth={0.002}
            position={[psu1X, psuY, bezelDepthOffset + 0.0005]}
          />
        )}
        {!isBlueprint && (
          <mesh position={[psu1X - 0.02, psuY, bezelDepthOffset + 0.0018]} material={psuLeverMaterial}>
            <boxGeometry args={[0.005, psuHeight * 0.5, 0.001]} />
          </mesh>
        )}

        <mesh
          position={[psu2X, psuY, bezelDepthOffset + 0.0005]}
          material={isBlueprint ? blueprintPsuMaterial : psuMaterial}
        >
          <boxGeometry args={[PSU_WIDTH, psuHeight, 0.002]} />
        </mesh>
        {isBlueprint && (
          <SchematicBox
            width={PSU_WIDTH}
            height={psuHeight}
            depth={0.002}
            position={[psu2X, psuY, bezelDepthOffset + 0.0005]}
          />
        )}
        {!isBlueprint && (
          <mesh position={[psu2X - 0.02, psuY, bezelDepthOffset + 0.0018]} material={psuLeverMaterial}>
            <boxGeometry args={[0.005, psuHeight * 0.5, 0.001]} />
          </mesh>
        )}
      </group>

      {/* Vent grille representing fan trays */}
      <instancedMesh
        ref={ventRef}
        args={[undefined, undefined, VENT_BAR_COUNT]}
        material={isBlueprint ? blueprintVentMaterial : ventMaterial}
      >
        <boxGeometry args={[VENT_BAR_WIDTH, psuHeight, 0.002]} />
      </instancedMesh>

      {/* Fan tray handle details */}
      {!isBlueprint && (
        <group>
          <mesh position={[ventSectionLeftX - 0.012, 0, bezelDepthOffset + 0.0015]} material={psuMaterial}>
            <boxGeometry args={[0.003, psuHeight * 0.4, 0.001]} />
          </mesh>
          <mesh position={[ventSectionLeftX + 0.012, 0, bezelDepthOffset + 0.0015]} material={psuMaterial}>
            <boxGeometry args={[0.003, psuHeight * 0.4, 0.001]} />
          </mesh>
        </group>
      )}

      {/* SFP+ cages */}
      <instancedMesh
        ref={sfpRef}
        args={[undefined, undefined, totalSfps]}
        material={isBlueprint ? blueprintSfpMaterial : sfpMaterial}
      >
        <boxGeometry args={[SFP_W, SFP_H, 0.002]} />
      </instancedMesh>

      {/* Console ports (RJ45 + USB-C shape) */}
      {!isBlueprint && (
        <group position={[ventSectionLeftX + VENT_SECTION_WIDTH / 2 + 0.015, -0.002, bezelDepthOffset + 0.001]}>
          {/* Console RJ45 */}
          <mesh material={consolePortMaterial}>
            <boxGeometry args={[0.009, 0.007, 0.001]} />
          </mesh>
          <mesh position={[0, 0, 0.0006]} material={portHoleMaterial}>
            <boxGeometry args={[0.006, 0.004, 0.0002]} />
          </mesh>
          {/* Console USB-C */}
          <mesh position={[0.012, 0, 0]} material={consolePortMaterial}>
            <boxGeometry args={[0.006, 0.003, 0.001]} />
          </mesh>
          <mesh position={[0.012, 0, 0.0006]} material={portHoleMaterial}>
            <boxGeometry args={[0.004, 0.001, 0.0002]} />
          </mesh>
        </group>
      )}

      {/* Status LEDs */}
      <instancedMesh
        ref={ledRef}
        args={[undefined, undefined, STATUS_LED_COUNT]}
        material={ledMaterial}
      >
        <sphereGeometry args={[0.002, 8, 8]} />
      </instancedMesh>

      {/* Selection outline */}
      {interaction.isSelected && (
        <SelectionOutline
          rackUnits={finalRackUnits}
          depth={DEPTH}
          position={[0, 0, zShift]}
        />
      )}
    </group>
  );
}
