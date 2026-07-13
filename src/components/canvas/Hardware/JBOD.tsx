/**
 * JBOD.tsx
 *
 * 4U High-Density Storage Chassis (JBOD).
 * Features a massive front panel grid of 36 vertical hot-swap HDD sleds,
 * modeled via instanced meshes for high rendering performance.
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
const SLED_ROWS = 3;
const SLED_COLS = 12;
const SLED_W = 0.024;
const SLED_H = 0.044;
const SLED_GAP_X = 0.004;
const SLED_GAP_Y = 0.006;

// ---- PBR Materials --------------------------------------------------
const chassisMaterial = new THREE.MeshStandardMaterial({
  color: '#222224',
  metalness: 0.5,
  roughness: 0.6,
});

const bezelMaterial = new THREE.MeshStandardMaterial({
  color: '#0f0f11',
  metalness: 0.8,
  roughness: 0.3,
});

const sledMaterial = new THREE.MeshStandardMaterial({
  color: '#1a1a1d', // Dark steel drive bay
  metalness: 0.7,
  roughness: 0.45,
});

const latchMaterial = new THREE.MeshStandardMaterial({
  color: '#52525b', // Zinc release lever
  metalness: 0.9,
  roughness: 0.2,
});

const ledMaterial = new THREE.MeshBasicMaterial({
  toneMapped: false,
  transparent: true,
  opacity: 0.95,
});

const blueprintSledMaterial = new THREE.MeshBasicMaterial({
  color: '#27272a',
});

const LED_GREEN = new THREE.Color('#10b981');
const LED_AMBER = new THREE.Color('#f59e0b');

interface JBODProps {
  hardware: HardwareProps;
}

export function JBOD({ hardware }: JBODProps) {
  const sledRef = useRef<THREE.InstancedMesh>(null);
  const latchRef = useRef<THREE.InstancedMesh>(null);
  const ledRef = useRef<THREE.InstancedMesh>(null);

  const RACK_UNITS = 4;
  const DEPTH = 0.65;

  const interaction = useHardwareInteraction({
    ...hardware,
    rackUnits: RACK_UNITS,
    depth: DEPTH,
  });

  const isBlueprint = useIsBlueprint();
  const chassisHeight = RACK_UNITS * RACK_UNIT_HEIGHT - EDGE_GAP;
  const zShift = 0.39 - DEPTH / 2;

  const totalSleds = SLED_ROWS * SLED_COLS;
  const totalGridW = SLED_COLS * SLED_W + (SLED_COLS - 1) * SLED_GAP_X;
  const totalGridH = SLED_ROWS * SLED_H + (SLED_ROWS - 1) * SLED_GAP_Y;

  const startX = -totalGridW / 2 + SLED_W / 2;
  const startY = -totalGridH / 2 + SLED_H / 2;
  const portDepthOffset = 0.39 + 0.002;

  // -- Seed HDD Sleds -------------------------------------------------
  useLayoutEffect(() => {
    const mesh = sledRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let r = 0; r < SLED_ROWS; r++) {
      for (let c = 0; c < SLED_COLS; c++) {
        dummy.position.set(
          startX + c * (SLED_W + SLED_GAP_X),
          startY + r * (SLED_H + SLED_GAP_Y),
          portDepthOffset,
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
    }
    mesh.count = totalSleds;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [startX, startY, portDepthOffset, totalSleds]);

  // -- Seed Release Latches -------------------------------------------
  useLayoutEffect(() => {
    const mesh = latchRef.current;
    if (!mesh || isBlueprint) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let r = 0; r < SLED_ROWS; r++) {
      for (let c = 0; c < SLED_COLS; c++) {
        dummy.position.set(
          startX + c * (SLED_W + SLED_GAP_X),
          startY + r * (SLED_H + SLED_GAP_Y) - 0.012,
          portDepthOffset + 0.0006,
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
    }
    mesh.count = totalSleds;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [startX, startY, portDepthOffset, totalSleds, isBlueprint]);

  // -- Seed LEDs -----------------------------------------------------
  useLayoutEffect(() => {
    const mesh = ledRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let r = 0; r < SLED_ROWS; r++) {
      for (let c = 0; c < SLED_COLS; c++) {
        dummy.position.set(
          startX + c * (SLED_W + SLED_GAP_X) + 0.008,
          startY + r * (SLED_H + SLED_GAP_Y) + 0.014,
          portDepthOffset + 0.0006,
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i++, c % 7 === 0 ? LED_AMBER : LED_GREEN);
      }
    }
    mesh.count = totalSleds;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [startX, startY, portDepthOffset, totalSleds]);

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

      {/* HDD Sleds */}
      <instancedMesh
        ref={sledRef}
        args={[undefined, undefined, totalSleds]}
        material={isBlueprint ? blueprintSledMaterial : sledMaterial}
        castShadow={false}
      >
        <boxGeometry args={[SLED_W, SLED_H, 0.001]} />
      </instancedMesh>

      {/* Release latches */}
      {!isBlueprint && (
        <instancedMesh
          ref={latchRef}
          args={[undefined, undefined, totalSleds]}
          material={latchMaterial}
        >
          <boxGeometry args={[0.006, 0.008, 0.0015]} />
        </instancedMesh>
      )}

      {/* Sled Status LEDs */}
      <instancedMesh
        ref={ledRef}
        args={[undefined, undefined, totalSleds]}
        material={ledMaterial}
      >
        <boxGeometry args={[0.002, 0.002, 0.0005]} />
      </instancedMesh>

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
