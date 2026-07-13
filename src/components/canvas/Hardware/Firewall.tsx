/**
 * Firewall.tsx
 *
 * 1U Enterprise Security Appliance (Firewall) chassis.
 * Features a bold red/dark polymer bezel, 8 RJ45 gigabit copper ports,
 * 4 SFP+ cage sockets, console interface, and status LEDs.
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
const COPPER_PORT_COUNT = 8;
const SFP_PORT_COUNT = 4;
const PORT_W = 0.01;
const PORT_H = 0.008;
const PORT_GAP = 0.004;

// ---- PBR Materials --------------------------------------------------
const chassisMaterial = new THREE.MeshStandardMaterial({
  color: '#1a1a1c',
  metalness: 0.5,
  roughness: 0.6,
});

const redBezelMaterial = new THREE.MeshStandardMaterial({
  color: '#b91c1c', // striking anodized deep red
  metalness: 0.75,
  roughness: 0.35,
});

const portMaterial = new THREE.MeshStandardMaterial({
  color: '#5b5d63',
  metalness: 0.8,
  roughness: 0.3,
});

const portHoleMaterial = new THREE.MeshBasicMaterial({
  color: '#020202',
});

const sfpMaterial = new THREE.MeshStandardMaterial({
  color: '#cbd5e1',
  metalness: 0.9,
  roughness: 0.25,
});

const ledGreenMaterial = new THREE.MeshBasicMaterial({
  color: '#10b981',
  toneMapped: false,
});

const ledAmberMaterial = new THREE.MeshBasicMaterial({
  color: '#f59e0b',
  toneMapped: false,
});

const blueprintRedMaterial = new THREE.MeshBasicMaterial({
  color: '#7f1d1d', // flat deep red for blueprints
});

const blueprintPortMaterial = new THREE.MeshBasicMaterial({
  color: '#94a3b8',
});

interface FirewallProps {
  hardware: HardwareProps;
}

export function Firewall({ hardware }: FirewallProps) {
  const copperPortRef = useRef<THREE.InstancedMesh>(null);
  const sfpRef = useRef<THREE.InstancedMesh>(null);

  const RACK_UNITS = 1;
  const DEPTH = 0.3;

  const interaction = useHardwareInteraction({
    ...hardware,
    rackUnits: RACK_UNITS,
    depth: DEPTH,
  });

  const isBlueprint = useIsBlueprint();
  const chassisHeight = RACK_UNITS * RACK_UNIT_HEIGHT - EDGE_GAP;
  const zShift = 0.39 - DEPTH / 2;

  // Horizontal placements on the front bezel
  const portDepthOffset = 0.39 + 0.002;
  const startX = -0.08; // centered grouping on the bezel

  // -- Seed RJ45 Copper ports ------------------------------------------
  useLayoutEffect(() => {
    const mesh = copperPortRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < COPPER_PORT_COUNT; i++) {
      dummy.position.set(
        startX + i * (PORT_W + PORT_GAP),
        -0.002,
        portDepthOffset,
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.count = COPPER_PORT_COUNT;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [startX, portDepthOffset]);

  // -- Seed SFP+ ports ------------------------------------------------
  useLayoutEffect(() => {
    const mesh = sfpRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const sfpStartX = startX + COPPER_PORT_COUNT * (PORT_W + PORT_GAP) + 0.02;
    for (let i = 0; i < SFP_PORT_COUNT; i++) {
      dummy.position.set(
        sfpStartX + i * (0.012 + PORT_GAP),
        -0.002,
        portDepthOffset,
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.count = SFP_PORT_COUNT;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [startX, portDepthOffset]);

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

      {/* Front Bezel - striking red styling */}
      <mesh
        position={[0, 0, 0.39 + 0.0015]}
        material={isBlueprint ? blueprintRedMaterial : redBezelMaterial}
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

      {/* Copper RJ45 ports */}
      <instancedMesh
        ref={copperPortRef}
        args={[undefined, undefined, COPPER_PORT_COUNT]}
        material={isBlueprint ? blueprintPortMaterial : portMaterial}
        castShadow={false}
      >
        <boxGeometry args={[PORT_W, PORT_H, 0.0015]} />
      </instancedMesh>

      {/* SFP+ cages */}
      <instancedMesh
        ref={sfpRef}
        args={[undefined, undefined, SFP_PORT_COUNT]}
        material={isBlueprint ? blueprintPortMaterial : sfpMaterial}
        castShadow={false}
      >
        <boxGeometry args={[0.012, 0.01, 0.0015]} />
      </instancedMesh>

      {/* Local Console port & LEDs details */}
      {!isBlueprint && (
        <group position={[0.13, -0.002, portDepthOffset + 0.0005]}>
          {/* Console RJ45 */}
          <mesh material={portMaterial}>
            <boxGeometry args={[PORT_W, PORT_H, 0.001]} />
          </mesh>
          <mesh position={[0, 0, 0.0006]} material={portHoleMaterial}>
            <boxGeometry args={[PORT_W - 0.004, PORT_H - 0.004, 0.0002]} />
          </mesh>
          {/* Status LEDs */}
          <mesh position={[-0.23, 0.008, 0]} material={ledGreenMaterial}>
            <sphereGeometry args={[0.002, 8, 8]} />
          </mesh>
          <mesh position={[-0.22, 0.008, 0]} material={ledAmberMaterial}>
            <sphereGeometry args={[0.002, 8, 8]} />
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
