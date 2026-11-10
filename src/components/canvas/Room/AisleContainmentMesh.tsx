/**
 * AisleContainmentMesh.tsx
 *
 * 3D Cold/Hot Aisle Containment Structure.
 * Renders an extruded aluminum canopy frame with translucent
 * polycarbonate roof ceiling panels and end-of-row sliding glass doors.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useConfiguratorStore, BAY_SPACING } from '../../../store/useConfiguratorStore';

export function AisleContainmentMesh() {
  const racks = useConfiguratorStore((s) => s.racks);
  const containment = useConfiguratorStore((s) => s.dataHallConfig.containment);

  if (!containment.enabled || containment.type === 'none' || racks.length === 0) {
    return null;
  }

  // Calculate aisle bounding coordinates across all racks
  const minX = Math.min(...racks.map((r) => r.position[0])) - 0.4;
  const maxX = Math.max(...racks.map((r) => r.position[0])) + 0.4;
  const totalSpanX = Math.max(0.8, maxX - minX);
  const centerX = (minX + maxX) / 2;

  const roofHeight = containment.roofHeightMeters || 2.2;
  const aisleDepth = 1.2; // 1.2m standard cold aisle width
  const centerZ = 0.6; // Cold aisle center in front of rack

  // Polycarbonate canopy material (translucent cyan)
  const canopyMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: containment.tintColor || '#38bdf8',
        transparent: true,
        opacity: 0.35,
        roughness: 0.1,
        transmission: 0.7,
        thickness: 0.02,
        ior: 1.5,
        side: THREE.DoubleSide,
      }),
    [containment.tintColor],
  );

  // Aluminum frame extrusion material
  const frameMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#27272a',
        metalness: 0.8,
        roughness: 0.3,
      }),
    [],
  );

  // Sliding door offset when open vs closed
  const doorSlideOffset = containment.doorOpen ? 0.7 : 0;

  return (
    <group>
      {/* ------------------------------------------------------------- */}
      {/* Polycarbonate Roof Canopy Panels                               */}
      {/* ------------------------------------------------------------- */}
      <mesh
        position={[centerX, roofHeight, centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={canopyMaterial}
      >
        <planeGeometry args={[totalSpanX, aisleDepth]} />
      </mesh>

      {/* Roof Aluminum Perimeter Frames */}
      <mesh position={[centerX, roofHeight + 0.015, centerZ - aisleDepth / 2]} material={frameMaterial}>
        <boxGeometry args={[totalSpanX, 0.03, 0.04]} />
      </mesh>
      <mesh position={[centerX, roofHeight + 0.015, centerZ + aisleDepth / 2]} material={frameMaterial}>
        <boxGeometry args={[totalSpanX, 0.03, 0.04]} />
      </mesh>
      <mesh position={[minX, roofHeight + 0.015, centerZ]} material={frameMaterial}>
        <boxGeometry args={[0.04, 0.03, aisleDepth]} />
      </mesh>
      <mesh position={[maxX, roofHeight + 0.015, centerZ]} material={frameMaterial}>
        <boxGeometry args={[0.04, 0.03, aisleDepth]} />
      </mesh>

      {/* ------------------------------------------------------------- */}
      {/* End-of-Row Sliding Glass Doors (Left & Right Ends)             */}
      {/* ------------------------------------------------------------- */}

      {/* Left End-of-Row Door */}
      <group position={[minX, roofHeight / 2, centerZ]}>
        {/* Door Glass Panel */}
        <mesh
          position={[0, 0, doorSlideOffset]}
          material={canopyMaterial}
        >
          <boxGeometry args={[0.02, roofHeight - 0.05, aisleDepth - 0.05]} />
        </mesh>
        {/* Door Frame */}
        <mesh position={[0, 0, doorSlideOffset]} material={frameMaterial}>
          <boxGeometry args={[0.03, 0.04, aisleDepth]} />
        </mesh>
        {/* Vertical Grab Handle */}
        <mesh position={[0.03, 0, doorSlideOffset + 0.2]} material={frameMaterial}>
          <cylinderGeometry args={[0.01, 0.01, 0.4, 8]} />
        </mesh>
      </group>

      {/* Right End-of-Row Door */}
      <group position={[maxX, roofHeight / 2, centerZ]}>
        {/* Door Glass Panel */}
        <mesh
          position={[0, 0, -doorSlideOffset]}
          material={canopyMaterial}
        >
          <boxGeometry args={[0.02, roofHeight - 0.05, aisleDepth - 0.05]} />
        </mesh>
        {/* Door Frame */}
        <mesh position={[0, 0, -doorSlideOffset]} material={frameMaterial}>
          <boxGeometry args={[0.03, 0.04, aisleDepth]} />
        </mesh>
        {/* Vertical Grab Handle */}
        <mesh position={[-0.03, 0, -doorSlideOffset - 0.2]} material={frameMaterial}>
          <cylinderGeometry args={[0.01, 0.01, 0.4, 8]} />
        </mesh>
      </group>
    </group>
  );
}
