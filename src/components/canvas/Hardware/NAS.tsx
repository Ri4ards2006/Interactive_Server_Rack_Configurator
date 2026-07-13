/**
 * NAS.tsx
 *
 * 2U Network Attached Storage (NAS) chassis.
 * Contains a front bezel grid of 12 horizontal drive caddies,
 * a left-anchored OLED status display showing pool telemetry,
 * and PBR dark steel textures.
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
const DRIVE_ROWS = 6;
const DRIVE_COLS = 2;
const DRIVE_W = 0.12;
const DRIVE_H = 0.011;
const DRIVE_GAP_X = 0.015;
const DRIVE_GAP_Y = 0.002;

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

const caddyMaterial = new THREE.MeshStandardMaterial({
  color: '#111112',
  metalness: 0.7,
  roughness: 0.45,
});

const latchMaterial = new THREE.MeshStandardMaterial({
  color: '#4b5563', // gray-600 release clip
  metalness: 0.95,
  roughness: 0.2,
});

const oledMaterial = new THREE.MeshBasicMaterial({
  color: '#22d3ee', // glowing cyan OLED panel
  toneMapped: false,
});

const blueprintCaddyMaterial = new THREE.MeshBasicMaterial({
  color: '#2d2d30',
});

interface NASProps {
  hardware: HardwareProps;
}

export function NAS({ hardware }: NASProps) {
  const caddyRef = useRef<THREE.InstancedMesh>(null);
  const latchRef = useRef<THREE.InstancedMesh>(null);

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

  // Align drive caddies to the center-right of the bezel, leaving space for OLED on left
  const startX = -totalGridW / 2 + DRIVE_W / 2 + 0.04;
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

  // -- Seed caddy latches ----------------------------------------------
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

      {/* Drive Caddies */}
      <instancedMesh
        ref={caddyRef}
        args={[undefined, undefined, totalCaddies]}
        material={isBlueprint ? blueprintCaddyMaterial : caddyMaterial}
        castShadow={false}
      >
        <boxGeometry args={[DRIVE_W, DRIVE_H, 0.001]} />
      </instancedMesh>

      {/* Caddy Release clips */}
      {!isBlueprint && (
        <instancedMesh
          ref={latchRef}
          args={[undefined, undefined, totalCaddies]}
          material={latchMaterial}
        >
          <boxGeometry args={[0.015, 0.006, 0.0012]} />
        </instancedMesh>
      )}

      {/* OLED Status screen on left bezel */}
      {!isBlueprint && (
        <group position={[-CHASSIS_WIDTH / 2 + 0.05, 0, 0.39 + 0.002]}>
          {/* OLED frame */}
          <mesh>
            <boxGeometry args={[0.05, 0.025, 0.001]} />
            <meshBasicMaterial color="#020202" />
          </mesh>
          {/* OLED text backing */}
          <mesh position={[0, 0, 0.0006]} material={oledMaterial}>
            <boxGeometry args={[0.045, 0.02, 0.0002]} />
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
