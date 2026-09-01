/**
 * roomLayout.test.ts
 *
 * Unit tests for Data Hall raised floor grid generation,
 * 600x600mm tile coordinate snapping, perforated airflow tile placement,
 * and CRAC cooling capacity vs. IT heat load balancing.
 */

import { describe, it, expect } from 'vitest';
import {
  FLOOR_TILE_SIZE,
  worldToTileIndex,
  tileIndexToWorld,
  snapToFloorTile,
  generateFloorGrid,
  calculateTotalCoolingMetrics,
} from '../roomLayout';
import type { RackInstance } from '../../types/rack.types';
import type { RoomDimensions, CracUnit } from '../../types/room.types';

describe('roomLayout — 600mm Floor Tile Grid Coordinates & Snapping', () => {
  it('correctly maps world coordinates to tile indices and back', () => {
    expect(FLOOR_TILE_SIZE).toBe(0.60);

    const [xIdx, zIdx] = worldToTileIndex(1.22, -2.39);
    expect(xIdx).toBe(2);
    expect(zIdx).toBe(-4);

    const [worldX, worldZ] = tileIndexToWorld(xIdx, zIdx);
    expect(worldX).toBeCloseTo(1.20, 2);
    expect(worldZ).toBeCloseTo(-2.40, 2);
  });

  it('snaps arbitrary 3D position to nearest 600x600mm tile center', () => {
    const [snappedX, snappedZ] = snapToFloorTile(0.85, 1.45);
    expect(snappedX).toBeCloseTo(0.60, 2); // 0.85 rounds to 1 * 0.60 = 0.60
    expect(snappedZ).toBeCloseTo(1.20, 2); // 1.45 rounds to 2 * 0.60 = 1.20
  });
});

describe('roomLayout — generateFloorGrid & Perforated Airflow Tiles', () => {
  const sampleRoom: RoomDimensions = {
    widthMeters: 6,
    depthMeters: 4,
    heightMeters: 3.5,
    raisedFloorHeightMeters: 0.6,
  };

  const sampleRacks: RackInstance[] = [
    {
      id: 'rack-a',
      name: 'Rack A',
      capacity: 42,
      rackType: 'cabinet',
      isDoorOpen: false,
      position: [0, 0, 0],
      installedHardware: [
        {
          id: 'srv-1',
          type: 'server',
          rackUnits: 2,
          powerDraw: 500,
          depth: 0.6,
          position: [0, 0.1, 0],
        },
      ],
    },
  ];

  it('generates a full matrix of tiles covering room bounds', () => {
    const tiles = generateFloorGrid(sampleRoom, sampleRacks);
    expect(tiles.length).toBeGreaterThan(50);

    // Verify solid tiles exist
    const solidTiles = tiles.filter((t) => t.type === 'solid');
    expect(solidTiles.length).toBeGreaterThan(0);

    // Verify perforated tile exists directly in front of Rack A (at world [0, 0.6])
    const coldAisleTile = tiles.find(
      (t) => Math.abs(t.worldX - 0) < 0.05 && Math.abs(t.worldZ - 0.6) < 0.05,
    );
    expect(coldAisleTile).toBeDefined();
    expect(coldAisleTile?.type).toBe('perforated-50');
    expect(coldAisleTile?.airflowCFM).toBe(850);
  });

  it('respects manual tile type overrides', () => {
    const overrides = { '0_0': 'grate-70' as const };
    const tiles = generateFloorGrid(sampleRoom, sampleRacks, overrides);
    const tile00 = tiles.find((t) => t.xIndex === 0 && t.zIndex === 0);
    expect(tile00?.type).toBe('grate-70');
    expect(tile00?.airflowCFM).toBe(1200);
  });
});

describe('roomLayout — calculateTotalCoolingMetrics', () => {
  const sampleRacks: RackInstance[] = [
    {
      id: 'rack-1',
      name: 'Rack 1',
      capacity: 42,
      rackType: 'cabinet',
      isDoorOpen: false,
      position: [0, 0, 0],
      installedHardware: [
        { id: 'h1', type: 'server', rackUnits: 4, powerDraw: 4000, depth: 0.6, position: [0, 0, 0] },
        { id: 'h2', type: 'server', rackUnits: 4, powerDraw: 6000, depth: 0.6, position: [0, 0, 0] },
      ],
    },
  ];

  const sampleCracs: CracUnit[] = [
    {
      id: 'crac-1',
      name: 'CRAC 1',
      coolingKw: 20,
      airflowCFM: 3000,
      position: [-3, 0, 0],
      orientation: 0,
      status: 'online',
    },
    {
      id: 'crac-2',
      name: 'CRAC 2',
      coolingKw: 20,
      airflowCFM: 3000,
      position: [3, 0, 0],
      orientation: 0,
      status: 'online',
    },
  ];

  it('correctly balances 10 kW IT load against 40 kW CRAC capacity (N+1 Redundancy)', () => {
    const report = calculateTotalCoolingMetrics(sampleRacks, sampleCracs);

    expect(report.totalItPowerKw).toBe(10.0);
    expect(report.totalCoolingCapacityKw).toBe(40.0);
    expect(report.coolingReserveKw).toBe(30.0);
    expect(report.totalCracCfm).toBe(6000);
    expect(report.coolingRedundancy).toBe('N+1');
    expect(report.status).toBe('healthy');
  });

  it('detects cooling capacity deficit when CRACs are offline or under-provisioned', () => {
    const offlineCracs: CracUnit[] = [
      {
        id: 'crac-1',
        name: 'CRAC 1',
        coolingKw: 5,
        airflowCFM: 600,
        position: [-3, 0, 0],
        orientation: 0,
        status: 'online',
      },
    ];

    const report = calculateTotalCoolingMetrics(sampleRacks, offlineCracs);

    expect(report.totalItPowerKw).toBe(10.0);
    expect(report.totalCoolingCapacityKw).toBe(5.0);
    expect(report.coolingReserveKw).toBe(-5.0);
    expect(report.coolingRedundancy).toBe('Deficit');
    expect(report.status).toBe('critical');
  });
});
