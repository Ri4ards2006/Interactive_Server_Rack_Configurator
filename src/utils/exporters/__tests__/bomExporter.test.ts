/**
 * bomExporter.test.ts
 *
 * Unit test suite for datacenter Bill of Materials (BOM) serialization (JSON & CSV),
 * BTU/hr heat conversion, cable schedule summaries, and 2D vector elevation SVG generation.
 */

import { describe, it, expect } from 'vitest';
import {
  generateBOMReport,
  exportBOMToJSON,
  exportBOMToCSV,
  WATTS_TO_BTU_PER_HOUR,
} from '../bomExporter';
import { generateRackElevationSVG } from '../elevationExporter';
import type { RackInstance, CableProps } from '../../../types/rack.types';

describe('bomExporter — Serialization & Telemetry Integrity', () => {
  const mockRacks: RackInstance[] = [
    {
      id: 'rack-1',
      name: 'Alpha Bay',
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
          position: [0, 0.04445, 0],
        },
        {
          id: 'sw-1',
          type: 'switch',
          rackUnits: 1,
          powerDraw: 100,
          depth: 0.4,
          position: [0, 0.111125, 0],
        },
      ],
    },
  ];

  const mockCables: CableProps[] = [
    {
      id: 'cable-1',
      fromDevice: 'srv-1',
      fromPort: 'port-eth0',
      toDevice: 'sw-1',
      toPort: 'port-sw-1',
      type: 'copper-cat6a',
      color: '#06b6d4',
      lengthMeters: 1.25,
      hasBendViolation: false,
    },
  ];

  it('generates accurate BOM telemetry report', () => {
    const report = generateBOMReport(mockRacks, mockCables, 'Test Lab Project');

    expect(report.projectTitle).toBe('Test Lab Project');
    expect(report.rackCount).toBe(1);
    expect(report.totalChassisCount).toBe(2);
    expect(report.totalRackUnitsOccupied).toBe(3);
    expect(report.totalPowerWatts).toBe(600);
    expect(report.totalHeatBTUhr).toBeCloseTo(600 * WATTS_TO_BTU_PER_HOUR, 1);
    expect(report.totalAirflowCFM).toBeGreaterThan(0);
    expect(report.cableCountsByMedium['copper-cat6a']).toBe(1);
    expect(report.totalCableLengthMeters).toBe(1.25);

    // Verify items
    expect(report.items.length).toBe(2);
    expect(report.items[0].rackName).toBe('Alpha Bay');
    expect(report.items[0].hardwareType).toBe('server');
    expect(report.items[0].connectedPatchRuns.length).toBe(1);
    expect(report.items[0].connectedPatchRuns[0]).toContain('sw-1:port-sw-1');
  });

  it('exports structured JSON accurately', () => {
    const report = generateBOMReport(mockRacks, mockCables);
    const jsonStr = exportBOMToJSON(report);

    const parsed = JSON.parse(jsonStr);
    expect(parsed.totalPowerWatts).toBe(600);
    expect(parsed.items[0].hardwareId).toBe('srv-1');
  });

  it('exports valid RFC 4180 CSV with headers and rows', () => {
    const report = generateBOMReport(mockRacks, mockCables);
    const csv = exportBOMToCSV(report);

    expect(csv).toContain('# PROJECT:');
    expect(csv).toContain('Rack Name,Rack ID,Slot Range');
    expect(csv).toContain('Alpha Bay');
    expect(csv).toContain('srv-1');
    expect(csv).toContain('copper-cat6a');
  });
});

describe('elevationExporter — 2D Vector SVG Generation', () => {
  const mockRack: RackInstance = {
    id: 'rack-elevation-test',
    name: 'Main Production Rack',
    capacity: 42,
    rackType: 'cabinet',
    isDoorOpen: false,
    position: [0, 0, 0],
    installedHardware: [
      {
        id: 'srv-top',
        type: 'server',
        rackUnits: 4,
        powerDraw: 1200,
        depth: 0.7,
        position: [0, 0.0889, 0],
      },
    ],
  };

  it('generates valid SVG markup with EIA-310-D rails and chassis rects', () => {
    const svg = generateRackElevationSVG(mockRack);

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('MAIN PRODUCTION RACK');
    expect(svg).toContain('EIA-310-D STANDARD MOUNTING');
    expect(svg).toContain('chassis-srv-top');
    expect(svg).toContain('1200W');
    expect(svg).toContain('</svg>');
  });
});
