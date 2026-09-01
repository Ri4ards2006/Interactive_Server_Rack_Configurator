/**
 * roomLayout.ts
 *
 * Calculations for Datacenter Room Planning:
 * - 600mm x 600mm raised floor tile grid generation
 * - World coordinate to floor tile snapping
 * - Automatic perforated airflow tile placement in front cold aisles
 * - CRAC cooling capacity vs. IT heat load balancing calculations
 */

import type { RackInstance } from '../types/rack.types';
import type {
  RoomDimensions,
  RaisedFloorTile,
  TileType,
  CracUnit,
  RoomCoolingReport,
} from '../types/room.types';

export const FLOOR_TILE_SIZE = 0.60; // 600mm EIA/TIA raised floor tile

/**
 * Convert world X/Z coordinate to discrete integer floor tile indices.
 */
export function worldToTileIndex(x: number, z: number): [number, number] {
  const xIndex = Math.round(x / FLOOR_TILE_SIZE);
  const zIndex = Math.round(z / FLOOR_TILE_SIZE);
  return [xIndex, zIndex];
}

/**
 * Convert discrete integer floor tile indices to center world coordinates.
 */
export function tileIndexToWorld(xIndex: number, zIndex: number): [number, number] {
  return [xIndex * FLOOR_TILE_SIZE, zIndex * FLOOR_TILE_SIZE];
}

/**
 * Snap arbitrary 3D position to the nearest 600x600mm raised floor tile center.
 */
export function snapToFloorTile(x: number, z: number): [number, number] {
  const [xIndex, zIndex] = worldToTileIndex(x, z);
  return tileIndexToWorld(xIndex, zIndex);
}

/**
 * Generate full raised floor tile layout for the data hall room.
 * Automatically marks cold-aisle tiles in front of racks as perforated airflow tiles.
 */
export function generateFloorGrid(
  room: RoomDimensions,
  racks: RackInstance[] = [],
  tilesOverride: Record<string, TileType> = {},
): RaisedFloorTile[] {
  const halfWidth = room.widthMeters / 2;
  const halfDepth = room.depthMeters / 2;

  const minXIdx = Math.floor(-halfWidth / FLOOR_TILE_SIZE);
  const maxXIdx = Math.ceil(halfWidth / FLOOR_TILE_SIZE);
  const minZIdx = Math.floor(-halfDepth / FLOOR_TILE_SIZE);
  const maxZIdx = Math.ceil(halfDepth / FLOOR_TILE_SIZE);

  // Set of cold-aisle tile coordinates in front of racks (Z + 0.6m)
  const coldAisleTileKeys = new Set<string>();
  racks.forEach((rack) => {
    const rackX = rack.position[0];
    const rackZ = rack.position[2];
    // Front face faces +Z; cold aisle tile is 1 tile forward
    const [coldXIdx, coldZIdx] = worldToTileIndex(rackX, rackZ + FLOOR_TILE_SIZE);
    coldAisleTileKeys.add(`${coldXIdx}_${coldZIdx}`);
  });

  const tiles: RaisedFloorTile[] = [];

  for (let x = minXIdx; x <= maxXIdx; x++) {
    for (let z = minZIdx; z <= maxZIdx; z++) {
      const key = `${x}_${z}`;
      const [worldX, worldZ] = tileIndexToWorld(x, z);

      let type: TileType = 'solid';
      if (tilesOverride[key]) {
        type = tilesOverride[key];
      } else if (coldAisleTileKeys.has(key)) {
        type = 'perforated-50';
      }

      tiles.push({
        xIndex: x,
        zIndex: z,
        worldX,
        worldZ,
        type,
        airflowCFM: type === 'perforated-50' ? 850 : type === 'perforated-25' ? 450 : type === 'grate-70' ? 1200 : 0,
      });
    }
  }

  return tiles;
}

/**
 * Calculate total room cooling capacity vs. IT heat load and determine redundancy.
 */
export function calculateTotalCoolingMetrics(
  racks: RackInstance[],
  cracUnits: CracUnit[],
): RoomCoolingReport {
  let totalItWatts = 0;
  racks.forEach((r) => {
    r.installedHardware.forEach((h) => {
      totalItWatts += h.powerDraw;
    });
  });

  const totalItPowerKw = Math.round((totalItWatts / 1000) * 10) / 10;
  // Estimated IT CFM required: ~120 CFM per kW
  const totalItCfm = Math.round(totalItPowerKw * 120);

  const onlineCracs = cracUnits.filter((c) => c.status === 'online');
  const totalCoolingCapacityKw = onlineCracs.reduce((acc, c) => acc + c.coolingKw, 0);
  const totalCracCfm = onlineCracs.reduce((acc, c) => acc + c.airflowCFM, 0);

  const coolingReserveKw = Math.round((totalCoolingCapacityKw - totalItPowerKw) * 10) / 10;
  const cfmMargin =
    totalItCfm > 0
      ? Math.round(((totalCracCfm - totalItCfm) / totalItCfm) * 100)
      : 100;

  let coolingRedundancy = 'N+0';
  if (onlineCracs.length > 1) {
    const avgCracKw = totalCoolingCapacityKw / onlineCracs.length;
    const excessCracs = Math.floor(coolingReserveKw / (avgCracKw || 1));
    if (excessCracs >= 2) coolingRedundancy = 'N+2';
    else if (excessCracs === 1) coolingRedundancy = 'N+1';
    else if (coolingReserveKw < 0) coolingRedundancy = 'Deficit';
  } else if (coolingReserveKw < 0) {
    coolingRedundancy = 'Deficit';
  }

  let status: RoomCoolingReport['status'] = 'healthy';
  if (coolingReserveKw < 0 || cfmMargin < 0) {
    status = 'critical';
  } else if (coolingReserveKw < totalItPowerKw * 0.2 || cfmMargin < 15) {
    status = 'warning';
  }

  return {
    totalItPowerKw,
    totalCoolingCapacityKw,
    coolingRedundancy,
    coolingReserveKw,
    totalCracCfm,
    totalItCfm,
    cfmSafetyMargin: cfmMargin,
    status,
  };
}
