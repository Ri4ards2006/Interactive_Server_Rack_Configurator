/**
 * Switch.tsx
 *
 * Network switch chassis: dense 2×24 grid of RJ45 ports on the front
 * bezel and a per-port status LED (link/activity) tinted green/amber.
 *
 * Visual signature
 * ----------------
 * 3D mode (default): brushed metal body + thin cyan accent stripe at the top
 * of the bezel (reads as an enterprise 48-port 1U switch). RJ45 ports use
 * nested box geometries (outer metallic jack + inner black socket hole).
 *
 * Blueprint mode: flat fills, sharp cyan wireframe edges on chassis
 * + bezel + accent stripe. Ports become solid flat boxes (no per-
 * instance wireframes — too noisy at 48 instances). LEDs remain
 * coloured boxes (per-instance hue via `instanceColor`) so the link/
 * activity pattern is still readable on the schematic.
 *
 * Implementation
 * --------------
 * - Overrides store-default depth to enforce a 1U (1 * RACK_UNIT_HEIGHT),
 *   shallow (0.3m) form factor.
 * - The port grid, port holes, and the LEDs use `<instancedMesh>` so a 48-port
 *   switch costs minimal draw calls.
 * - Every material is module-scoped (allocated once at import time).
 * - Drag / select / cursor / window-release logic is delegated to
 *   `useHardwareInteraction`.
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
} from './shared';

// ---- Port / accent geometry constants (Switch-specific) -------------
const PORT_COLS = 24; // columns of RJ45 ports — 24 cols × 2 rows = 48 = classic 1U switch
const PORT_W = 0.014;
const PORT_H = 0.008;
const PORT_GAP_X = 0.012;
const PORT_GAP_Y = 0.008;
const ACCENT_STRIPE_HEIGHT = 0.002;
const ACCENT_STRIPE_WIDTH = 0.5;

// Nested RJ45 inner hole dimensions
const PORT_HOLE_W = PORT_W - 0.004; // 0.010m
const PORT_HOLE_H = PORT_H - 0.004; // 0.004m

// ---- Hoisted materials (allocated once at import time) ---------------
const chassisMaterial = new THREE.MeshStandardMaterial({
  color: '#2a2b30', // brushed dark steel color
  metalness: 0.9,    // highly metallic for brushed metal
  roughness: 0.35,   // medium-low roughness for reflection
});

const bezelMaterial = new THREE.MeshStandardMaterial({
  color: '#08080a',
  metalness: 0.3,
  roughness: 0.4,
});

const accentMaterial = new THREE.MeshStandardMaterial({
  color: '#22d3ee',
  emissive: '#0e7490',
  emissiveIntensity: 0.8,
  metalness: 0.4,
  roughness: 0.5,
});

const portMaterial = new THREE.MeshStandardMaterial({
  color: '#8b8e96', // silver-grey steel jack housing
  metalness: 0.8,
  roughness: 0.3,
});

const portHoleMaterial = new THREE.MeshBasicMaterial({
  color: '#020202', // deep black hole
});

// MeshBasicMaterial lets `instanceColor` drive each LED's hue directly.
// `toneMapped: false` keeps the saturated LED color from being dimmed by
// the scene's exposure — pure self-illuminated look, no shader needed.
const ledMaterial = new THREE.MeshBasicMaterial({
  toneMapped: false,
  transparent: true,
  opacity: 0.95,
});

// Blueprint-mode replacements. Module-scoped so we don't allocate on
// every render.
const blueprintPortMaterial = new THREE.MeshBasicMaterial({
  color: '#e5e7eb', // light gray — pops against the dark chassis fill
});

// Reused per-instance — `new Color` is cheap but we only need two.
const LED_GREEN = new THREE.Color('#10b981');
const LED_AMBER = new THREE.Color('#f59e0b');

interface SwitchProps {
  hardware: HardwareProps;
}

export function Switch({ hardware }: SwitchProps) {
  const portRef = useRef<THREE.InstancedMesh>(null);
  const portHoleRef = useRef<THREE.InstancedMesh>(null);
  const ledRef = useRef<THREE.InstancedMesh>(null);

  // Enforce switch-specific invariants (1U height and 0.3m shallow depth)
  const SWITCH_RACK_UNITS = 1;
  const DEPTH = 0.3;

  const interaction = useHardwareInteraction({
    ...hardware,
    rackUnits: SWITCH_RACK_UNITS,
    depth: DEPTH,
  });

  const isBlueprint = useIsBlueprint();

  // Chassis height = U × rackUnits minus the shared edge gap.
  const chassisHeight = SWITCH_RACK_UNITS * RACK_UNIT_HEIGHT - EDGE_GAP;

  const portRows = 2; // Fixed Comfortably for 1U
  const totalPorts = portRows * PORT_COLS;

  // Total horizontal span of the grid (used to center it on the bezel).
  const totalGridW = PORT_COLS * PORT_W + (PORT_COLS - 1) * PORT_GAP_X;
  const totalGridH = portRows * PORT_H + (portRows - 1) * PORT_GAP_Y;

  // Origin of the first port (top-left of grid). Centered horizontally,
  // sits in the lower portion of the bezel (top reserved for the accent).
  const startX = -totalGridW / 2 + PORT_W / 2;
  const startY = -totalGridH / 2 + PORT_H / 2 - ACCENT_STRIPE_HEIGHT / 2 - 0.001;

  const portDepthOffset = DEPTH / 2 + 0.002;
  const ledXOffset = PORT_W / 2 + 0.005;

  // -- Seed RJ45 port instances ---------------------------------------
  useLayoutEffect(() => {
    const mesh = portRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let r = 0; r < portRows; r++) {
      for (let c = 0; c < PORT_COLS; c++) {
        dummy.position.set(
          startX + c * (PORT_W + PORT_GAP_X),
          startY + r * (PORT_H + PORT_GAP_Y),
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

  // -- Seed RJ45 port holes (nested details) --------------------------
  useLayoutEffect(() => {
    const mesh = portHoleRef.current;
    if (!mesh || isBlueprint) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let r = 0; r < portRows; r++) {
      for (let c = 0; c < PORT_COLS; c++) {
        dummy.position.set(
          startX + c * (PORT_W + PORT_GAP_X),
          startY + r * (PORT_H + PORT_GAP_Y),
          portDepthOffset + 0.0002, // slightly forward so it sits on the face
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
  }, [startX, startY, portDepthOffset, totalPorts, portRows, isBlueprint]);

  // -- Seed LED instances (with per-instance colour) -------------------
  useLayoutEffect(() => {
    const mesh = ledRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let r = 0; r < portRows; r++) {
      for (let c = 0; c < PORT_COLS; c++) {
        dummy.position.set(
          startX + c * (PORT_W + PORT_GAP_X) + ledXOffset,
          startY + r * (PORT_H + PORT_GAP_Y),
          portDepthOffset,
        );
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i++, c % 5 === 0 ? LED_AMBER : LED_GREEN);
      }
    }
    mesh.count = totalPorts;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
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

      {/* Cyan accent stripe (brand-style marker) */}
      <mesh
        position={[
          0,
          chassisHeight / 2 - ACCENT_STRIPE_HEIGHT - 0.001,
          DEPTH / 2 + 0.002,
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
        />
      )}

      {/* RJ45 port housings (instanced — 1 draw call) */}
      <instancedMesh
        ref={portRef}
        args={[undefined, undefined, totalPorts]}
        material={isBlueprint ? blueprintPortMaterial : portMaterial}
        castShadow={false}
      >
        <boxGeometry args={[PORT_W, PORT_H, 0.003]} />
      </instancedMesh>

      {/* Nested RJ45 port hole inlays (only rendered in 3D mode) */}
      {!isBlueprint && (
        <instancedMesh
          ref={portHoleRef}
          args={[undefined, undefined, totalPorts]}
          material={portHoleMaterial}
        >
          <boxGeometry args={[PORT_HOLE_W, PORT_HOLE_H, 0.0032]} />
        </instancedMesh>
      )}

      {/* Per-port status LEDs (instanced, per-instance colour) */}
      <instancedMesh
        ref={ledRef}
        args={[undefined, undefined, totalPorts]}
        material={ledMaterial}
      >
        <boxGeometry args={[0.004, 0.004, 0.001]} />
      </instancedMesh>

      {/* Shared selection halo */}
      {interaction.isSelected && (
        <SelectionOutline
          rackUnits={SWITCH_RACK_UNITS}
          depth={DEPTH}
        />
      )}
    </group>
  );
}
