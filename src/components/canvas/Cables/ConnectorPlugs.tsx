/**
 * ConnectorPlugs.tsx
 *
 * High-fidelity 3D connector models for:
 * - RJ45 modular jack plug (Cat6/Cat6A)
 * - LC Duplex optical connector (OM4/OS2)
 * - SFP+ Direct Attach Copper transceiver head (DAC)
 */

import * as THREE from 'three';
import { useIsBlueprint } from '../Hardware/shared';
import type { CablePlugType } from '../../../types/cable.types';

interface PlugProps {
  position: THREE.Vector3;
  tangent?: THREE.Vector3;
  color?: string;
}

/**
 * Standard RJ45 modular plug with locking tab and gold pin array.
 */
export function RJ45Plug({ position }: PlugProps) {
  const isBlueprint = useIsBlueprint();
  if (isBlueprint) return null;

  const isBack = position.z < 0.2;

  return (
    <group position={position} rotation={[0, isBack ? Math.PI : 0, 0]}>
      {/* Translucent polycarbonate body */}
      <mesh castShadow receiveShadow position={[0, 0, 0.006]}>
        <boxGeometry args={[0.007, 0.007, 0.012]} />
        <meshStandardMaterial
          color="#d4d4d8"
          transparent
          opacity={0.7}
          roughness={0.2}
          metalness={0.1}
        />
      </mesh>

      {/* Gold contact pins */}
      <mesh position={[0, -0.0012, 0.0006]}>
        <boxGeometry args={[0.005, 0.0008, 0.0012]} />
        <meshStandardMaterial color="#d97706" metalness={0.95} roughness={0.05} />
      </mesh>

      {/* Strain relief boot */}
      <mesh position={[0, 0, 0.014]}>
        <cylinderGeometry args={[0.0035, 0.004, 0.008, 12]} />
        <meshStandardMaterial color="#3f3f46" roughness={0.7} />
      </mesh>

      {/* Locking Tab / Clip */}
      <mesh position={[0, 0.0048, 0.007]} rotation={[-0.22, 0, 0]}>
        <boxGeometry args={[0.0018, 0.0015, 0.007]} />
        <meshStandardMaterial color="#cbd5e1" transparent opacity={0.85} roughness={0.3} />
      </mesh>
    </group>
  );
}

/**
 * Dual LC Duplex optical connector with ceramic ferrules and clip latch.
 */
export function LCDuplexPlug({ position, color = '#06b6d4' }: PlugProps) {
  const isBlueprint = useIsBlueprint();
  if (isBlueprint) return null;

  const isBack = position.z < 0.2;

  return (
    <group position={position} rotation={[0, isBack ? Math.PI : 0, 0]}>
      {/* Molded duplex housing */}
      <mesh castShadow receiveShadow position={[0, 0, 0.008]}>
        <boxGeometry args={[0.009, 0.006, 0.014]} />
        <meshStandardMaterial color="#27272a" roughness={0.4} />
      </mesh>

      {/* Dual ceramic ferrules (Zirconia white) */}
      <mesh position={[-0.0022, 0, 0.0005]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0009, 0.0009, 0.003, 10]} />
        <meshStandardMaterial color="#ffffff" roughness={0.1} />
      </mesh>
      <mesh position={[0.0022, 0, 0.0005]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0009, 0.0009, 0.003, 10]} />
        <meshStandardMaterial color="#ffffff" roughness={0.1} />
      </mesh>

      {/* Color-coded fiber boots */}
      <mesh position={[-0.0022, 0, 0.017]}>
        <cylinderGeometry args={[0.0016, 0.002, 0.007, 10]} />
        <meshStandardMaterial color={color} roughness={0.3} />
      </mesh>
      <mesh position={[0.0022, 0, 0.017]}>
        <cylinderGeometry args={[0.0016, 0.002, 0.007, 10]} />
        <meshStandardMaterial color={color} roughness={0.3} />
      </mesh>

      {/* Push-pull latch */}
      <mesh position={[0, 0.004, 0.009]} rotation={[-0.15, 0, 0]}>
        <boxGeometry args={[0.003, 0.0012, 0.008]} />
        <meshStandardMaterial color="#71717a" roughness={0.4} />
      </mesh>
    </group>
  );
}

/**
 * SFP+ Direct Attach Copper metal transceiver shell with bail latch.
 */
export function SFPlusPlug({ position }: PlugProps) {
  const isBlueprint = useIsBlueprint();
  if (isBlueprint) return null;

  const isBack = position.z < 0.2;

  return (
    <group position={position} rotation={[0, isBack ? Math.PI : 0, 0]}>
      {/* Die-cast metal transceiver body */}
      <mesh castShadow receiveShadow position={[0, 0, 0.01]}>
        <boxGeometry args={[0.011, 0.008, 0.02]} />
        <meshStandardMaterial
          color="#a1a1aa"
          metalness={0.85}
          roughness={0.25}
        />
      </mesh>

      {/* Gold edge-connector tongue */}
      <mesh position={[0, 0, -0.001]}>
        <boxGeometry args={[0.009, 0.002, 0.004]} />
        <meshStandardMaterial color="#d97706" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Bail release latch / pull tab */}
      <mesh position={[0, 0.005, 0.014]}>
        <boxGeometry args={[0.008, 0.002, 0.005]} />
        <meshStandardMaterial color="#ef4444" roughness={0.4} />
      </mesh>

      {/* Rear heavy-duty twinax boot */}
      <mesh position={[0, 0, 0.023]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.003, 0.0035, 0.008, 12]} />
        <meshStandardMaterial color="#18181b" roughness={0.6} />
      </mesh>
    </group>
  );
}

export function ConnectorPlug({
  type,
  position,
  color,
}: {
  type: CablePlugType;
  position: THREE.Vector3;
  color?: string;
}) {
  switch (type) {
    case 'lc-duplex':
      return <LCDuplexPlug position={position} color={color} />;
    case 'sfp-plus':
      return <SFPlusPlug position={position} />;
    case 'rj45':
    default:
      return <RJ45Plug position={position} />;
  }
}

