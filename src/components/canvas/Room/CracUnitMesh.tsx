/**
 * CracUnitMesh.tsx
 *
 * 3D Computer Room Air Conditioning (CRAC / CRAH) cooling towers.
 * Renders perimeter or in-row cooling units with intake louvers,
 * digital telemetry readouts, status beacons, and downflow supply plenum indicators.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useConfiguratorStore } from '../../../store/useConfiguratorStore';
import type { CracUnit } from '../../../types/room.types';

export function CracUnitMesh() {
  const cracUnits = useConfiguratorStore((s) => s.dataHallConfig.cracUnits);
  const isRoomViewEnabled = useConfiguratorStore((s) => s.isRoomViewEnabled);

  if (!isRoomViewEnabled || cracUnits.length === 0) {
    return null;
  }

  // Cabinet body material
  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#18181b',
        roughness: 0.4,
        metalness: 0.7,
      }),
    [],
  );

  // Louver grille material
  const louverMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#27272a',
        roughness: 0.8,
        metalness: 0.2,
      }),
    [],
  );

  return (
    <group>
      {cracUnits.map((crac: CracUnit) => {
        const isOnline = crac.status === 'online';
        const isAlarm = crac.status === 'alarm';
        const beaconColor = isOnline ? '#10b981' : isAlarm ? '#ef4444' : '#f59e0b';

        return (
          <group
            key={crac.id}
            position={crac.position}
            rotation={[0, crac.orientation, 0]}
          >
            {/* Main Enclosure Body (1.0m W x 2.0m H x 0.85m D) */}
            <mesh position={[0, 1.0, 0]} material={bodyMaterial} castShadow receiveShadow>
              <boxGeometry args={[1.0, 2.0, 0.85]} />
            </mesh>

            {/* Front Return Air Intake Grille Louvers */}
            <mesh position={[0, 1.25, 0.43]} material={louverMaterial}>
              <boxGeometry args={[0.85, 1.1, 0.02]} />
            </mesh>

            {/* Digital Telemetry Display Bezel */}
            <mesh position={[0, 0.45, 0.43]}>
              <boxGeometry args={[0.4, 0.2, 0.02]} />
              <meshBasicMaterial color="#0369a1" />
            </mesh>

            {/* Top Status Beacon Light */}
            <mesh position={[0, 2.05, 0.3]}>
              <cylinderGeometry args={[0.04, 0.04, 0.08, 12]} />
              <meshStandardMaterial
                color={beaconColor}
                emissive={beaconColor}
                emissiveIntensity={0.8}
              />
            </mesh>

            {/* Downflow Plenum Underfloor Cold Air Discharge Glow */}
            {isOnline && (
              <mesh position={[0, -0.2, 0]}>
                <boxGeometry args={[0.9, 0.4, 0.75]} />
                <meshBasicMaterial
                  color="#06b6d4"
                  transparent
                  opacity={0.25}
                  wireframe
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
