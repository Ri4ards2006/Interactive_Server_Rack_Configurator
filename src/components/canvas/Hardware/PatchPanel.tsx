/**
 * PatchPanel.tsx
 *
 * Passive punch-down patch panel: a tight, high-density row (or grid)
 * of keystone port housings spanning the front bezel. No LEDs — this
 * is purely passive infrastructure.
 *
 * Visual signature
 * ----------------
 * 3D mode (default): no accent stripe, dark passive chassis, and a dense
 * grid of small black squares representing keystones/ports on the front face.
 *
 * Blueprint mode: flat fills + sharp cyan wireframe edges on chassis
 * and bezel. Keystone ports swap to a flat basic representation (no
 * per-instance edges to keep it clean and clear).
 *
 * Implementation
 * --------------
 * - Enforces a 1U height and an ultra-short depth (0.1m) by overriding
 *   depth and rackUnits in the interaction hook.
 * - Single `<instancedMesh>` for the entire port grid.
 * - Drag / select / cursor / window-release logic is delegated to
 *   `useHardwareInteraction`. The selection halo is the shared
 *   `<SelectionOutline />` component.
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
} from './shared';

// ---- PatchPanel-specific geometry constants -------------------------
// Keystone jacks are modeled as square blocks.
const PORT_COLS = 24;                         // 24 ports per row
const PORT_W = 0.016;
const PORT_H = 0.016;
const PORT_GAP_X = 0.012;
const PORT_GAP_Y = 0.010;
const PORT_INSET_DEPTH = 0.003;               // how far the jack sits proud of the bezel

// ---- Hoisted materials (allocated once at import time) ---------------
const chassisMaterial = new THREE.MeshStandardMaterial({
  color: '#0e0e10',                          // very dark matte — passive hardware
  metalness: 0.5,
  roughness: 0.6,
});

const bezelMaterial = new THREE.MeshStandardMaterial({
  color: '#040405',
  metalness: 0.3,
  roughness: 0.45,
});

// Keystone ports are small black squares.
const portMaterial = new THREE.MeshStandardMaterial({
  color: '#08080a', // black plastic port housings
  metalness: 0.1,
  roughness: 0.8,
});

// Blueprint-mode replacement material for the keystone port grid.
const blueprintPortMaterial = new THREE.MeshBasicMaterial({
  color: '#151518', // flat dark representation
});

interface PatchPanelProps {
  hardware: HardwareProps;
}

export function PatchPanel({ hardware }: PatchPanelProps) {
  const portRef = useRef<THREE.InstancedMesh>(null);

  // Enforce patch panel invariants (1U height and 0.1m ultra-short depth)
  const PATCH_PANEL_RACK_UNITS = 1;
  const DEPTH = 0.1;

  const interaction = useHardwareInteraction({
    ...hardware,
    rackUnits: PATCH_PANEL_RACK_UNITS,
    depth: DEPTH,
  });

  const isBlueprint = useIsBlueprint();

  const chassisHeight = PATCH_PANEL_RACK_UNITS * RACK_UNIT_HEIGHT - EDGE_GAP;

  // Single row for a standard 1U panel.
  const portRows = 1;
  const totalPorts = portRows * PORT_COLS;
  const totalGridW = PORT_COLS * PORT_W + (PORT_COLS - 1) * PORT_GAP_X;
  const totalGridH = portRows * PORT_H + (portRows - 1) * PORT_GAP_Y;

  const startX = -totalGridW / 2 + PORT_W / 2;
  const startY = 0; // centered vertically on the 1U face

  const portDepthOffset = DEPTH / 2 + 0.002;

  useLayoutEffect(() => {
    const mesh = portRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let r = 0; r < portRows; r++) {
      for (let c = 0; c < PORT_COLS; c++) {
        dummy.position.set(
          startX + c * (PORT_W + PORT_GAP_X),
          startY - r * (PORT_H + PORT_GAP_Y),
          portDepthOffset,
        );
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
    }
    mesh.count = totalPorts;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [startX, startY, portDepthOffset, totalPorts, portRows]);

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
        <boxGeometry args={[CHASSIS_WIDTH, chassisHeight, DEPTH]} />
      </mesh>
      {isBlueprint && (
        <SchematicBox
          width={CHASSIS_WIDTH}
          height={chassisHeight}
          depth={DEPTH}
        />
      )}

      {/* Front bezel — slightly inset, very dark */}
      <mesh
        position={[0, 0, DEPTH / 2 + 0.0015]}
        material={isBlueprint ? blueprintBezelMaterial : bezelMaterial}
      >
        <boxGeometry args={[CHASSIS_WIDTH - 0.02, chassisHeight, 0.003]} />
      </mesh>
      {isBlueprint && (
        <SchematicBox
          width={CHASSIS_WIDTH - 0.02}
          height={chassisHeight}
          depth={0.003}
        />
      )}

      {/* Keystone port grid (instanced — 1 draw call for the entire array) */}
      <instancedMesh
        ref={portRef}
        args={[undefined, undefined, totalPorts]}
        material={isBlueprint ? blueprintPortMaterial : portMaterial}
        castShadow={false}
      >
        <boxGeometry args={[PORT_W, PORT_H, PORT_INSET_DEPTH]} />
      </instancedMesh>

      {/* Shared selection halo */}
      {interaction.isSelected && (
        <SelectionOutline
          rackUnits={PATCH_PANEL_RACK_UNITS}
          depth={DEPTH}
        />
      )}
    </group>
  );
}
