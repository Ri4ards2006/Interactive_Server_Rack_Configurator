/**
 * PatchCable.tsx
 *
 * Renders 3D Ethernet/fiber patch cables between hardware chassis ports.
 * Uses Catmull-Rom spline interpolation (CatmullRomCurve3) to create smooth,
 * naturally hanging curves under simulated gravity, and renders them as
 * 3D tube geometries.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { useConfiguratorStore } from '../../../store/useConfiguratorStore';
import type { CableProps, HardwareProps } from '../../../types/rack.types';
import { useIsBlueprint } from './shared';

/**
 * Calculates the front-panel 3D port coordinate for a given device.
 * Distributes port numbers horizontally and aligns them vertically based on device type.
 */
export function getPortPosition(device: HardwareProps, portStr: string): THREE.Vector3 {
  const [dx, dy] = device.position;
  const portIndex = parseInt(portStr, 10) || 1;

  // Assume standard rack units have ports centered horizontally.
  // Distribute 24 ports across a 32 cm span (-0.16m to +0.16m).
  const maxPorts = 24;
  const width = 0.32;
  const step = width / (maxPorts - 1);
  const xOffset = -width / 2 + ((portIndex - 1) % maxPorts) * step;

  // Add subtle vertical adjustments based on hardware type for visual variety
  let yOffset = 0;
  if (device.type === 'switch') {
    yOffset = 0.004; // slightly high row
  } else if (device.type === 'patch-panel' || device.type === 'cable-manager') {
    yOffset = 0.0; // center
  } else if (device.type === 'router') {
    yOffset = -0.004;
  } else if (device.type === 'server' || device.type === 'nas' || device.type === 'firewall') {
    yOffset = -0.008; // lower row
  }

  // Z coordinate is slightly in front of the bezel (bezel face is at ~0.39m)
  const zOffset = 0.39 + 0.005;

  return new THREE.Vector3(dx + xOffset, dy + yOffset, zOffset);
}

interface PatchCableProps {
  cable: CableProps;
  fromDevice: HardwareProps;
  toDevice: HardwareProps;
}

export function PatchCable({ cable, fromDevice, toDevice }: PatchCableProps) {
  const isBlueprint = useIsBlueprint();

  // 1. Calculate positions
  const { p1, p1Forward, midPoint, p2Forward, p2 } = useMemo(() => {
    const start = getPortPosition(fromDevice, cable.fromPort);
    const end = getPortPosition(toDevice, cable.toPort);

    // Vector to project cables straight out of the ports for 2cm before bending down
    const startForward = start.clone().setZ(start.z + 0.02);
    const endForward = end.clone().setZ(end.z + 0.02);

    // Calculate midpoint
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    
    // Simulate gravity: Sag the cable down depending on distance
    const dist = start.distanceTo(end);
    const sag = Math.max(0.06, dist * 0.35); // minimum sag of 6cm, scaling with distance
    mid.y -= sag;

    // Project midpoint forward in front of the rack so it doesn't clip through bezels
    mid.z += Math.max(0.05, dist * 0.22);

    return {
      p1: start,
      p1Forward: startForward,
      midPoint: mid,
      p2Forward: endForward,
      p2: end,
    };
  }, [fromDevice, toDevice, cable.fromPort, cable.toPort]);

  // 2. Generate smooth curve spline
  const curve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      p1,
      p1Forward,
      midPoint,
      p2Forward,
      p2
    ]);
  }, [p1, p1Forward, midPoint, p2Forward, p2]);

  // 3. Render tube geometry (3mm radius, 32 radial segments for smoothness)
  return (
    <mesh castShadow={!isBlueprint} receiveShadow={!isBlueprint}>
      <tubeGeometry args={[curve, 40, 0.0028, 8, false]} />
      {isBlueprint ? (
        <meshBasicMaterial color={cable.color} />
      ) : (
        <meshStandardMaterial
          color={cable.color}
          roughness={0.4}
          metalness={0.15}
        />
      )}
    </mesh>
  );
}

/**
 * Maps the global cables list from Zustand store to individual 3D PatchCable meshes.
 */
export function CableMapper() {
  const cables = useConfiguratorStore(
    useShallow((s) => s.cables)
  );
  const installedHardware = useConfiguratorStore(
    useShallow((s) => s.installedHardware)
  );

  return (
    <>
      {cables.map((c) => {
        const fromDev = installedHardware.find((h) => h.id === c.fromDevice);
        const toDev = installedHardware.find((h) => h.id === c.toDevice);

        if (!fromDev || !toDev) return null;

        return (
          <PatchCable
            key={c.id}
            cable={c}
            fromDevice={fromDev}
            toDevice={toDev}
          />
        );
      })}
    </>
  );
}
