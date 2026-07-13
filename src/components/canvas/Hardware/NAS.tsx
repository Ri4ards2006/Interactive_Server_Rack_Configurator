/**
 * NAS.tsx
 *
 * 2U Network Attached Storage (NAS) chassis.
 * Overhauled to present a high-fidelity visual signature:
 * - 12 horizontal detailed 3.5" HDD caddies arranged in 4 rows of 3 columns.
 * - Left-anchored controller panel featuring a glowing cyan OLED display,
 *   a tiny power button, status LEDs, and a micro-USB console port.
 * - Fits within standard 19-inch mounting dimensions.
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

// ---- Geometry constants ---------------------------------------------
const DRIVE_ROWS = 4;
const DRIVE_COLS = 3;
const DRIVE_W = 0.09;
const DRIVE_H = 0.014;
const DRIVE_GAP_X = 0.005;
const DRIVE_GAP_Y = 0.004;

// ---- PBR Materials --------------------------------------------------
const chassisMaterial = new THREE.MeshStandardMaterial({
  color: '#1a1a1c',
  metalness: 0.6,
  roughness: 0.6,
});

const bezelMaterial = new THREE.MeshStandardMaterial({
  color: '#0d0d0f',
  metalness: 0.85,
  roughness: 0.35,
});

const caddyMaterial = new THREE.MeshStandardMaterial({
  color: '#141416', // Matte black caddy plastic
  metalness: 0.1,
  roughness: 0.8,
});

const latchMaterial = new THREE.MeshStandardMaterial({
  color: '#4b5563', // Brushed gray steel release lever
  metalness: 0.9,
  roughness: 0.25,
});

const oledMaterial = new THREE.MeshBasicMaterial({
  color: '#06b6d4', // Glowing cyan OLED screen
  toneMapped: false,
});

const ledGreen = new THREE.MeshBasicMaterial({
  color: '#10b981',
  toneMapped: false,
});

const usbPortMaterial = new THREE.MeshStandardMaterial({
  color: '#a1a1aa',
  metalness: 0.95,
  roughness: 0.1,
});

const blueprintCaddyMaterial = new THREE.MeshBasicMaterial({
  color: '#27272a',
});

interface NASProps {
  hardware: HardwareProps;
}

export function NAS({ hardware }: NASProps) {
  const caddyRef = useRef<THREE.InstancedMesh>(null);
  const latchRef = useRef<THREE.InstancedMesh>(null);
  const caddyLedRef = useRef<THREE.InstancedMesh>(null);

  const RACK_UNITS = 2;
  const DEPTH = 0.55;

  const interaction = useHardwareInteraction({
    ...hardware,
    rackUnits: RACK_UNITS,
    depth: DEPTH,
  });

  const isBlueprint = useIsBlueprint();
  const chassisHeight = RACK_UNITS * RACK_UNIT_HEIGHT - EDGE_GAP;
  const zShift = 0.39 - DEPTH / 2;

  const totalCaddies = DRIVE_ROWS * DRIVE_COLS;
  const totalGridW = DRIVE_COLS * DRIVE_W + (DRIVE_COLS - 1) * DRIVE_GAP_X;
  const totalGridH = DRIVE_ROWS * DRIVE_H + (DRIVE_ROWS - 1) * DRIVE_GAP_Y;

  // Position caddy grid centered-right on the 44cm wide face
  const startX = -totalGridW / 2 + DRIVE_W / 2 + 0.05;
  const startY = -totalGridH / 2 + DRIVE_H / 2;
  const portDepthOffset = 0.39 + 0.002;

  // -- Seed HDD Caddies ------------------------------------------------
  useLayoutEffect(() => {
    const mesh = caddyRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let r = 0; r < DRIVE_ROWS; r++) {
      for (let c = 0; c < DRIVE_COLS; c++) {
        dummy.position.set(
          startX + c * (DRIVE_W + DRIVE_GAP_X),
          startY + r * (DRIVE_H + DRIVE_GAP_Y),
          portDepthOffset,
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
    }
    mesh.count = totalCaddies;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [startX, startY, portDepthOffset, totalCaddies]);

  // -- Seed Caddy Release Latches --------------------------------------
  useLayoutEffect(() => {
    const mesh = latchRef.current;
    if (!mesh || isBlueprint) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let r = 0; r < DRIVE_ROWS; r++) {
      for (let c = 0; c < DRIVE_COLS; c++) {
        dummy.position.set(
          startX + c * (DRIVE_W + DRIVE_GAP_X) - DRIVE_W / 2 + 0.015,
          startY + r * (DRIVE_H + DRIVE_GAP_Y),
          portDepthOffset + 0.0006,
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
    }
    mesh.count = totalCaddies;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [startX, startY, portDepthOffset, totalCaddies, isBlueprint]);

  // -- Seed Sled Activity LEDs -----------------------------------------
  useLayoutEffect(() => {
    const mesh = caddyLedRef.current;
    if (!mesh || isBlueprint) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let r = 0; r < DRIVE_ROWS; r++) {
      for (let c = 0; c < DRIVE_COLS; c++) {
        dummy.position.set(
          startX + c * (DRIVE_W + DRIVE_GAP_X) + DRIVE_W / 2 - 0.008,
          startY + r * (DRIVE_H + DRIVE_GAP_Y),
          portDepthOffset + 0.0006,
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
    }
    mesh.count = totalCaddies;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [startX, startY, portDepthOffset, totalCaddies, isBlueprint]);

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

      {/* Drive caddies */}
      <instancedMesh
        ref={caddyRef}
        args={[undefined, undefined, totalCaddies]}
        material={isBlueprint ? blueprintCaddyMaterial : caddyMaterial}
        castShadow={false}
      >
        <boxGeometry args={[DRIVE_W, DRIVE_H, 0.0015]} />
      </instancedMesh>

      {/* Release clips */}
      {!isBlueprint && (
        <instancedMesh
          ref={latchRef}
          args={[undefined, undefined, totalCaddies]}
          material={latchMaterial}
        >
          <boxGeometry args={[0.012, 0.008, 0.001]} />
        </instancedMesh>
      )}

      {/* Disk status green LEDs */}
      {!isBlueprint && (
        <instancedMesh
          ref={caddyLedRef}
          args={[undefined, undefined, totalCaddies]}
          material={ledGreen}
        >
          <boxGeometry args={[0.002, 0.002, 0.0005]} />
        </instancedMesh>
      )}

      {/* Controller panel on the left bezel */}
      {!isBlueprint && (
        <group position={[-CHASSIS_WIDTH / 2 + 0.055, 0, 0.39 + 0.002]}>
          {/* OLED Display */}
          <mesh position={[-0.015, 0, 0.0005]}>
            <boxGeometry args={[0.045, 0.022, 0.001]} />
            <meshBasicMaterial color="#020202" />
          </mesh>
          <mesh position={[-0.015, 0, 0.0012]} material={oledMaterial}>
            <boxGeometry args={[0.04, 0.018, 0.0002]} />
          </mesh>

          {/* Power Button */}
          <mesh position={[0.02, 0.008, 0.0005]} material={latchMaterial} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.004, 0.004, 0.002, 8]} />
          </mesh>
          <mesh position={[0.02, 0.008, 0.0012]} material={ledGreen}>
            <sphereGeometry args={[0.001, 8, 8]} />
          </mesh>

          {/* Micro-USB Console Port */}
          <mesh position={[0.02, -0.008, 0.0005]} material={usbPortMaterial}>
            <boxGeometry args={[0.006, 0.004, 0.0015]} />
          </mesh>
          <mesh position={[0.02, -0.008, 0.0012]}>
            <boxGeometry args={[0.003, 0.0015, 0.0002]} />
            <meshBasicMaterial color="#020202" />
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
