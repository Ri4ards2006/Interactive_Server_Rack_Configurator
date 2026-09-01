/**
 * DataHallFloor.tsx
 *
 * 3D Raised Floor Grid component for Data Hall Room visualization.
 * Generates an array of 600mm x 600mm raised floor tiles with
 * perforated airflow tiles in front of cold-aisle rack intakes.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useConfiguratorStore } from '../../../store/useConfiguratorStore';
import { generateFloorGrid, FLOOR_TILE_SIZE } from '../../../utils/roomLayout';

export function DataHallFloor() {
  const racks = useConfiguratorStore((s) => s.racks);
  const dataHallConfig = useConfiguratorStore((s) => s.dataHallConfig);
  const { roomDimensions, tilesOverride } = dataHallConfig;

  // Generate grid tiles based on room dimensions and current rack positions
  const tiles = useMemo(() => {
    return generateFloorGrid(roomDimensions, racks, tilesOverride);
  }, [roomDimensions, racks, tilesOverride]);

  const halfFloorHeight = roomDimensions.raisedFloorHeightMeters / 2;

  // Solid tile material (dark brushed steel tile)
  const solidMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#18181b',
        roughness: 0.6,
        metalness: 0.4,
      }),
    [],
  );

  // Perforated airflow tile material (cyan-tinted airflow grate)
  const perforatedMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#083344',
        roughness: 0.3,
        metalness: 0.8,
        wireframe: false,
        emissive: '#0e7490',
        emissiveIntensity: 0.35,
      }),
    [],
  );

  // High-flow 70% grate material
  const grateMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#042f2e',
        roughness: 0.2,
        metalness: 0.9,
        emissive: '#0d9488',
        emissiveIntensity: 0.5,
      }),
    [],
  );

  return (
    <group position={[0, -0.01, 0]}>
      {/* Sub-floor plenum concrete slab */}
      <mesh
        position={[0, -roomDimensions.raisedFloorHeightMeters, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[roomDimensions.widthMeters, roomDimensions.depthMeters]} />
        <meshStandardMaterial color="#09090b" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Raised Floor Pedestals / Tiles */}
      {tiles.map((tile) => {
        const isPerf = tile.type.includes('perforated');
        const isGrate = tile.type === 'grate-70';
        const mat = isGrate ? grateMaterial : isPerf ? perforatedMaterial : solidMaterial;

        return (
          <group key={`${tile.xIndex}_${tile.zIndex}`} position={[tile.worldX, 0, tile.worldZ]}>
            {/* Tile Surface Plate (590mm with 10mm stringer gap) */}
            <mesh position={[0, 0, 0]} receiveShadow material={mat}>
              <boxGeometry args={[FLOOR_TILE_SIZE - 0.01, 0.02, FLOOR_TILE_SIZE - 0.01]} />
            </mesh>

            {/* If perforated, add glowing airflow intake marker */}
            {(isPerf || isGrate) && (
              <mesh position={[0, 0.015, 0]}>
                <ringGeometry args={[0.08, 0.22, 16]} />
                <meshBasicMaterial
                  color="#22d3ee"
                  transparent
                  opacity={0.4}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}

            {/* Corner Pedestal Stanchions */}
            <mesh
              position={[
                (FLOOR_TILE_SIZE - 0.02) / 2,
                -halfFloorHeight,
                (FLOOR_TILE_SIZE - 0.02) / 2,
              ]}
            >
              <cylinderGeometry
                args={[0.012, 0.012, roomDimensions.raisedFloorHeightMeters, 8]}
              />
              <meshStandardMaterial color="#71717a" metalness={0.8} roughness={0.3} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
