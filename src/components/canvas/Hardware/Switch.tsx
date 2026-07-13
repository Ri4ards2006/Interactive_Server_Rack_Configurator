/**
 * Switch.tsx
 *
 * Network switch chassis: dense 2×24 grid of RJ45 ports on the front
 * bezel and a per-port status LED (link/activity) tinted green/amber.
 *
 * Overhaul:
 * - Aligns to Z = 0.39 as front face so the chassis extends backward.
 *   Rendered with mounting ears and support rails to bridge depth.
 * - Restructures port grid to fit perfectly inside the bezel (30cm wide,
 *   with two 12-port columns blocks), preventing overflow.
 * - Places LED indicator lights row above each port stack.
 * - Matte dark steel and anodized bezel materials.
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

// ---- Port / accent geometry constants --------------------------------
const PORT_COLS = 24; 
const PORT_W = 0.008;
const PORT_H = 0.006;
const PORT_GAP_X = 0.004;
const PORT_GAP_Y = 0.004;
const ACCENT_STRIPE_HEIGHT = 0.002;
const ACCENT_STRIPE_WIDTH = 0.4;

const PORT_HOLE_W = PORT_W - 0.002;
const PORT_HOLE_H = PORT_H - 0.002;

// ---- PBR Materials ---------------------------------------------------
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
  color: '#22d3ee',
  emissive: '#0e7490',
  emissiveIntensity: 0.8,
  metalness: 0.4,
  roughness: 0.5,
});

const portMaterial = new THREE.MeshStandardMaterial({
  color: '#8b8e96', // silver-grey steel jack
  metalness: 0.8,
  roughness: 0.3,
});

const portHoleMaterial = new THREE.MeshBasicMaterial({
  color: '#020202', // deep black socket recess
});

const ledMaterial = new THREE.MeshBasicMaterial({
  toneMapped: false,
  transparent: true,
  opacity: 0.95,
});

const blueprintPortMaterial = new THREE.MeshBasicMaterial({
  color: '#e5e7eb',
});

const LED_GREEN = new THREE.Color('#10b981');
const LED_AMBER = new THREE.Color('#f59e0b');

interface SwitchProps {
  hardware: HardwareProps;
}

export function Switch({ hardware }: SwitchProps) {
  const portRef = useRef<THREE.InstancedMesh>(null);
  const portHoleRef = useRef<THREE.InstancedMesh>(null);
  const ledRef = useRef<THREE.InstancedMesh>(null);

  const SWITCH_RACK_UNITS = 1;
  const DEPTH = 0.3;

  const interaction = useHardwareInteraction({
    ...hardware,
    rackUnits: SWITCH_RACK_UNITS,
    depth: DEPTH,
  });

  const isBlueprint = useIsBlueprint();
  const chassisHeight = SWITCH_RACK_UNITS * RACK_UNIT_HEIGHT - EDGE_GAP;
  const zShift = 0.39 - DEPTH / 2;

  const portRows = 2;
  const totalPorts = portRows * PORT_COLS;

  // Fit two groups of 12 columns
  const groupWidth = 12 * PORT_W + 11 * PORT_GAP_X;
  const gapBetweenGroups = 0.02;

  const getPortX = (c: number) => {
    const isSecondGroup = c >= 12;
    const groupCol = c % 12;
    const base = -groupWidth - gapBetweenGroups / 2;
    if (isSecondGroup) {
      return gapBetweenGroups / 2 + groupCol * (PORT_W + PORT_GAP_X) + PORT_W / 2;
    } else {
      return base + groupCol * (PORT_W + PORT_GAP_X) + PORT_W / 2;
    }
  };

  const startY = -((portRows * PORT_H + (portRows - 1) * PORT_GAP_Y) / 2) - 0.002;
  const portDepthOffset = 0.39 + 0.002;
  const ledYOffset = PORT_H / 2 + 0.0015;

  // -- Seed RJ45 port instances ---------------------------------------
  useLayoutEffect(() => {
    const mesh = portRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let r = 0; r < portRows; r++) {
      for (let c = 0; c < PORT_COLS; c++) {
        dummy.position.set(
          getPortX(c),
          startY + r * (PORT_H + PORT_GAP_Y),
          portDepthOffset,
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
    }
    mesh.count = totalPorts;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [startY, portDepthOffset, totalPorts, portRows]);

  // -- Seed RJ45 port holes ------------------------------------------
  useLayoutEffect(() => {
    const mesh = portHoleRef.current;
    if (!mesh || isBlueprint) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let r = 0; r < portRows; r++) {
      for (let c = 0; c < PORT_COLS; c++) {
        dummy.position.set(
          getPortX(c),
          startY + r * (PORT_H + PORT_GAP_Y),
          portDepthOffset + 0.0002,
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
    }
    mesh.count = totalPorts;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [startY, portDepthOffset, totalPorts, portRows, isBlueprint]);

  // -- Seed LED instances ---------------------------------------------
  useLayoutEffect(() => {
    const mesh = ledRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let r = 0; r < portRows; r++) {
      for (let c = 0; c < PORT_COLS; c++) {
        dummy.position.set(
          getPortX(c),
          startY + r * (PORT_H + PORT_GAP_Y) + ledYOffset,
          portDepthOffset + 0.0001,
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i++, c % 5 === 0 ? LED_AMBER : LED_GREEN);
      }
    }
    mesh.count = totalPorts;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [startY, portDepthOffset, totalPorts, portRows]);

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

      {/* Cyan accent stripe */}
      <mesh
        position={[
          0,
          chassisHeight / 2 - ACCENT_STRIPE_HEIGHT - 0.0015,
          0.39 + 0.002,
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
          position={[0, chassisHeight / 2 - ACCENT_STRIPE_HEIGHT - 0.0015, 0.39 + 0.002]}
        />
      )}

      {/* RJ45 port housings */}
      <instancedMesh
        ref={portRef}
        args={[undefined, undefined, totalPorts]}
        material={isBlueprint ? blueprintPortMaterial : portMaterial}
        castShadow={false}
      >
        <boxGeometry args={[PORT_W, PORT_H, 0.002]} />
      </instancedMesh>

      {/* Nested RJ45 port hole inlays */}
      {!isBlueprint && (
        <instancedMesh
          ref={portHoleRef}
          args={[undefined, undefined, totalPorts]}
          material={portHoleMaterial}
        >
          <boxGeometry args={[PORT_HOLE_W, PORT_HOLE_H, 0.0022]} />
        </instancedMesh>
      )}

      {/* Per-port status LEDs */}
      <instancedMesh
        ref={ledRef}
        args={[undefined, undefined, totalPorts]}
        material={ledMaterial}
      >
        <boxGeometry args={[0.003, 0.001, 0.0005]} />
      </instancedMesh>

      {/* Selection outline */}
      {interaction.isSelected && (
        <SelectionOutline
          rackUnits={SWITCH_RACK_UNITS}
          depth={DEPTH}
          position={[0, 0, zShift]}
        />
      )}
    </group>
  );
}
