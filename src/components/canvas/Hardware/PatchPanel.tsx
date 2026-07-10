/**
 * PatchPanel.tsx
 *
 * Passive punch-down patch panel: a tight, high-density row (or grid)
 * of keystone port housings spanning the front bezel. No LEDs — this
 * is purely passive infrastructure so a connected-but-not-linked panel
 * is still visually distinct from an active switch.
 *
 * Visual signature
 * ----------------
 * 3D mode (default): no accent stripe, slightly lighter chassis than
 * the others, and a port form factor slightly larger than RJ45
 * (keystone jacks are a hair wider/taller than standard RJ45 sockets).
 *
 * Blueprint mode: flat fills + sharp cyan wireframe edges on chassis
 * and bezel. Keystone ports become solid light-gray boxes (no
 * per-instance edges — would be visually noisy at 24-port rows).
 *
 * Implementation
 * --------------
 * - Single `<instancedMesh>` for the entire port grid. Single shared
 *   material; no per-instance colour. This is the cheapest of the
 *   three hardware types — no LEDs at all.
 * - Drag / select / cursor / window-release logic is delegated to
 *   `useHardwareInteraction`. The selection halo is the shared
 *   `<SelectionOutline />` component so it stays in lockstep with
 *   the other three chassis types.
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
// Keystone jacks are a touch larger than RJ45 sockets.
const PORT_COLS = 24;                         // wide rows of keystone ports
const PORT_W = 0.024;
const PORT_H = 0.014;
const PORT_GAP_X = 0.006;
const PORT_GAP_Y = 0.010;
const PORT_INSET_DEPTH = 0.003;               // how far the jack sits proud of the bezel

// ---- Hoisted materials (allocated once at import time) ---------------
const chassisMaterial = new THREE.MeshStandardMaterial({
  color: '#0f0f10',                          // very dark matte — passive hardware
  metalness: 0.6,
  roughness: 0.55,
});

const bezelMaterial = new THREE.MeshStandardMaterial({
  color: '#050505',
  metalness: 0.4,
  roughness: 0.3,
});

// Keystone housing is plastic — light, slightly off-white.
const portMaterial = new THREE.MeshStandardMaterial({
  color: '#e5e7eb',
  metalness: 0.4,
  roughness: 0.55,
});

// Blueprint-mode replacement material for the keystone port grid.
// Module-scoped so the conditional swap is a reference assignment.
const blueprintPortMaterial = new THREE.MeshBasicMaterial({
  color: '#94a3b8', // slate-400 — pops against the dark chassis fill
});

interface PatchPanelProps {
  hardware: HardwareProps;
}

export function PatchPanel({ hardware }: PatchPanelProps) {
  const portRef = useRef<THREE.InstancedMesh>(null);
  void portRef; // keep TS happy if unused

  const interaction = useHardwareInteraction(hardware);
  const isBlueprint = useIsBlueprint();

  const chassisHeight = hardware.rackUnits * RACK_UNIT_HEIGHT - EDGE_GAP;

  // Tile the keystone rows vertically to fill whatever chassisHeight we have.
  const portRows = Math.max(
    1,
    Math.floor((chassisHeight - 0.006) / (PORT_H + PORT_GAP_Y)),
  );

  const totalPorts = portRows * PORT_COLS;
  const totalGridW = PORT_COLS * PORT_W + (PORT_COLS - 1) * PORT_GAP_X;
  const totalGridH = portRows * PORT_H + (portRows - 1) * PORT_GAP_Y;

  const startX = -totalGridW / 2 + PORT_W / 2;
  const startY = -totalGridH / 2 + PORT_H / 2;

  const portDepthOffset = hardware.depth / 2 + 0.002;

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
  }, [startX, startY, portDepthOffset, totalPorts, portRows, hardware.depth]);

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
        <boxGeometry args={[CHASSIS_WIDTH, chassisHeight, hardware.depth]} />
      </mesh>
      {isBlueprint && (
        <SchematicBox
          width={CHASSIS_WIDTH}
          height={chassisHeight}
          depth={hardware.depth}
        />
      )}

      {/* Front bezel — slightly inset, very dark */}
      <mesh
        position={[0, 0, hardware.depth / 2 + 0.0015]}
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
          rackUnits={hardware.rackUnits}
          depth={hardware.depth}
        />
      )}
    </group>
  );
}
