/**
 * PatchPanel.tsx
 *
 * Passive punch-down patch panel: a tight, high-density row of keystone
 * port housings spanning the front bezel. Purely passive infrastructure.
 *
 * Overhaul:
 * - Aligns to Z = 0.39 as front face so the chassis extends backward.
 *   Mounted via ears and support rails to bridge depth.
 * - Models 4 blocks of 6 keystone ports with inner socket recess holes
 *   and white ID label blocks above each port.
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
  useIsBlueprint,
  RackMountDetails,
} from './shared';

// ---- PatchPanel-specific geometry constants -------------------------
const PORT_COLS = 24; 
const PORT_W = 0.01;
const PORT_H = 0.01;
const PORT_GAP_X = 0.004;
const PORT_GAP_Y = 0.004;
const PORT_INSET_DEPTH = 0.002;

const PORT_HOLE_W = PORT_W - 0.004;
const PORT_HOLE_H = PORT_H - 0.004;

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

const portMaterial = new THREE.MeshStandardMaterial({
  color: '#141416', // matte black plastic
  metalness: 0.1,
  roughness: 0.8,
});

const portHoleMaterial = new THREE.MeshBasicMaterial({
  color: '#020202', // deep black recess socket hole
});

const labelMaterial = new THREE.MeshStandardMaterial({
  color: '#f4f4f5', // matte white label field
  metalness: 0.1,
  roughness: 0.7,
});

const blueprintPortMaterial = new THREE.MeshBasicMaterial({
  color: '#151518',
});

interface PatchPanelProps {
  hardware: HardwareProps;
}

export function PatchPanel({ hardware }: PatchPanelProps) {
  const portRef = useRef<THREE.InstancedMesh>(null);
  const portHoleRef = useRef<THREE.InstancedMesh>(null);
  const labelRef = useRef<THREE.InstancedMesh>(null);

  const PATCH_PANEL_RACK_UNITS = 1;
  const DEPTH = 0.1;

  const interaction = useHardwareInteraction({
    ...hardware,
    rackUnits: PATCH_PANEL_RACK_UNITS,
    depth: DEPTH,
  });

  const isBlueprint = useIsBlueprint();
  const chassisHeight = PATCH_PANEL_RACK_UNITS * RACK_UNIT_HEIGHT - EDGE_GAP;
  const zShift = 0.39 - DEPTH / 2;

  const portRows = 1;
  const totalPorts = portRows * PORT_COLS;

  // Fit 4 groups of 6 columns
  const groupWidth = 6 * PORT_W + 5 * PORT_GAP_X;
  const gapBetweenGroups = 0.015;

  const getPortX = (c: number) => {
    const groupIdx = Math.floor(c / 6);
    const colInGroup = c % 6;
    const startX = -((4 * groupWidth + 3 * gapBetweenGroups) / 2) + groupWidth / 2;
    return startX + groupIdx * (groupWidth + gapBetweenGroups) - groupWidth / 2 + colInGroup * (PORT_W + PORT_GAP_X) + PORT_W / 2;
  };

  const startY = -0.002; // slightly offset for the label above
  const portDepthOffset = 0.39 + 0.002;
  const labelYOffset = PORT_H / 2 + 0.0025;

  // -- Seed keystone port housings ------------------------------------
  useLayoutEffect(() => {
    const mesh = portRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let c = 0; c < PORT_COLS; c++) {
      dummy.position.set(
        getPortX(c),
        startY,
        portDepthOffset,
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i++, dummy.matrix);
    }
    mesh.count = totalPorts;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [startY, portDepthOffset, totalPorts]);

  // -- Seed keystone port holes ---------------------------------------
  useLayoutEffect(() => {
    const mesh = portHoleRef.current;
    if (!mesh || isBlueprint) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let c = 0; c < PORT_COLS; c++) {
      dummy.position.set(
        getPortX(c),
        startY,
        portDepthOffset + 0.0002,
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i++, dummy.matrix);
    }
    mesh.count = totalPorts;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [startY, portDepthOffset, totalPorts, isBlueprint]);

  // -- Seed ID label fields -------------------------------------------
  useLayoutEffect(() => {
    const mesh = labelRef.current;
    if (!mesh || isBlueprint) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let c = 0; c < PORT_COLS; c++) {
      dummy.position.set(
        getPortX(c),
        startY + labelYOffset,
        portDepthOffset + 0.0001,
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i++, dummy.matrix);
    }
    mesh.count = totalPorts;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [startY, portDepthOffset, totalPorts, isBlueprint]);

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

      {/* Keystone port housings */}
      <instancedMesh
        ref={portRef}
        args={[undefined, undefined, totalPorts]}
        material={isBlueprint ? blueprintPortMaterial : portMaterial}
        castShadow={false}
      >
        <boxGeometry args={[PORT_W, PORT_H, PORT_INSET_DEPTH]} />
      </instancedMesh>

      {/* Recess socket holes */}
      {!isBlueprint && (
        <instancedMesh
          ref={portHoleRef}
          args={[undefined, undefined, totalPorts]}
          material={portHoleMaterial}
        >
          <boxGeometry args={[PORT_HOLE_W, PORT_HOLE_H, PORT_INSET_DEPTH + 0.0002]} />
        </instancedMesh>
      )}

      {/* ID Label fields */}
      {!isBlueprint && (
        <instancedMesh
          ref={labelRef}
          args={[undefined, undefined, totalPorts]}
          material={labelMaterial}
        >
          <boxGeometry args={[PORT_W, 0.002, 0.0005]} />
        </instancedMesh>
      )}

      {/* Selection outline */}
      {interaction.isSelected && (
        <SelectionOutline
          rackUnits={PATCH_PANEL_RACK_UNITS}
          depth={DEPTH}
          position={[0, 0, zShift]}
        />
      )}
    </group>
  );
}
