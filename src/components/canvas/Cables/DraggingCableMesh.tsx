/**
 * DraggingCableMesh.tsx
 *
 * Visualizes in-flight patch cable routing while the user drags
 * from a source socket toward a destination port.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useConfiguratorStore } from '../../../store/useConfiguratorStore';
import {
  calculateCableCurve,
  getCableMediumSpec,
} from '../../../utils/cableGeometry';
import { ConnectorPlug } from './ConnectorPlugs';

export function DraggingCableMesh() {
  const activeDraggingCable = useConfiguratorStore((s) => s.activeDraggingCable);

  const curveData = useMemo(() => {
    if (!activeDraggingCable) return null;
    const start = new THREE.Vector3(...activeDraggingCable.startPortGlobalPos);
    const end = new THREE.Vector3(...activeDraggingCable.currentMouseWorldPos);

    return {
      start,
      end,
      ...calculateCableCurve(
        start,
        end,
        activeDraggingCable.type || 'copper-cat6',
      ),
    };
  }, [activeDraggingCable]);

  if (!activeDraggingCable || !curveData) return null;

  const spec = getCableMediumSpec(activeDraggingCable.type || 'copper-cat6');
  const radius = (spec.outerDiameterMm / 2000) * 1.1;

  return (
    <group>
      {/* Source Plug */}
      <ConnectorPlug
        type={spec.plugType}
        position={curveData.start}
        color={activeDraggingCable.color}
      />

      {/* In-flight 3D Cable Tube */}
      <mesh>
        <tubeGeometry args={[curveData.curve, 32, radius, 8, false]} />
        <meshStandardMaterial
          color={activeDraggingCable.color}
          roughness={0.3}
          metalness={0.2}
          emissive={activeDraggingCable.color}
          emissiveIntensity={0.5}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Trailing cursor glowing snap target ring */}
      <mesh position={curveData.end}>
        <sphereGeometry args={[0.008, 12, 12]} />
        <meshBasicMaterial
          color={activeDraggingCable.color}
          transparent
          opacity={0.8}
        />
      </mesh>
    </group>
  );
}
