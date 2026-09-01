/**
 * rackLint.test.ts
 *
 * Unit tests for the Headless Datacenter Rack Compliance Linter engine (rack-lint).
 * Validates collision detection, out-of-bounds errors, electrical overload rules,
 * cable bend radius errors, Center-of-Gravity (CoG) stability warnings, and thermal bypass alerts.
 */

import { describe, it, expect } from 'vitest';
import { lintRackConfiguration, estimateDeviceMassKg } from '../rackLint';
import type { RackInstance, CableProps } from '../../types/rack.types';

describe('rackLint — Physical Mass Estimation & Center-of-Gravity', () => {
  it('estimates mass accurately based on hardware type and U-height', () => {
    expect(estimateDeviceMassKg('ups', 2)).toBe(36);
    expect(estimateDeviceMassKg('jbod', 4)).toBe(28);
    expect(estimateDeviceMassKg('server', 2)).toBe(17);
    expect(estimateDeviceMassKg('switch', 1)).toBe(5);
    expect(estimateDeviceMassKg('blank', 1)).toBe(0.5);
  });
});

describe('rackLint — Compliance Validation Rules', () => {
  it('passes a fully compliant, well-balanced rack configuration', () => {
    const validRack: RackInstance = {
      id: 'rack-good',
      name: 'Compliant Production Rack',
      capacity: 42,
      rackType: 'cabinet',
      isDoorOpen: false,
      position: [0, 0, 0],
      installedHardware: [
        // UPS at bottom U1-U2 (Heavy at bottom)
        {
          id: 'ups-1',
          type: 'ups',
          rackUnits: 2,
          powerDraw: 100,
          depth: 0.65,
          position: [0, 0.04445, 0],
        },
        // Server at U3-U4
        {
          id: 'srv-1',
          type: 'server',
          rackUnits: 2,
          powerDraw: 500,
          depth: 0.6,
          position: [0, 0.13335, 0],
        },
        // Switch at U24
        {
          id: 'sw-1',
          type: 'switch',
          rackUnits: 1,
          powerDraw: 100,
          depth: 0.4,
          position: [0, 1.044575, 0],
        },
      ],
    };

    const result = lintRackConfiguration([validRack]);
    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
    expect(result.summary.totalChassis).toBe(3);
    expect(result.summary.totalWatts).toBe(700);
    expect(result.summary.isStableCoG).toBe(true);
  });

  it('detects physical chassis collisions (ERR_COLLISION)', () => {
    const collidingRack: RackInstance = {
      id: 'rack-collision',
      name: 'Collision Rack',
      capacity: 42,
      rackType: 'cabinet',
      isDoorOpen: false,
      position: [0, 0, 0],
      installedHardware: [
        {
          id: 'srv-a',
          type: 'server',
          rackUnits: 2,
          powerDraw: 400,
          depth: 0.6,
          position: [0, 0.04445, 0], // U1-U2
        },
        {
          id: 'srv-b',
          type: 'server',
          rackUnits: 2,
          powerDraw: 400,
          depth: 0.6,
          position: [0, 0.04445, 0], // Collides directly on U1-U2
        },
      ],
    };

    const result = lintRackConfiguration([collidingRack]);
    expect(result.valid).toBe(false);
    expect(result.errorCount).toBeGreaterThanOrEqual(1);
    expect(result.issues.some((i) => i.code === 'ERR_COLLISION')).toBe(true);
  });

  it('detects out-of-bounds placement (ERR_OUT_OF_BOUNDS)', () => {
    const outOfBoundsRack: RackInstance = {
      id: 'rack-oob',
      name: 'OOB Rack',
      capacity: 42,
      rackType: 'cabinet',
      isDoorOpen: false,
      position: [0, 0, 0],
      installedHardware: [
        {
          id: 'srv-oob',
          type: 'server',
          rackUnits: 4,
          powerDraw: 500,
          depth: 0.6,
          position: [0, 2.5, 0], // Exceeds 42U boundary (42 * 0.04445 = 1.8669m)
        },
      ],
    };

    const result = lintRackConfiguration([outOfBoundsRack]);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'ERR_OUT_OF_BOUNDS')).toBe(true);
  });

  it('detects center-of-gravity tip hazards (WARN_TOP_HEAVY)', () => {
    const topHeavyRack: RackInstance = {
      id: 'rack-topheavy',
      name: 'Top Heavy Rack',
      capacity: 42,
      rackType: 'cabinet',
      isDoorOpen: false,
      position: [0, 0, 0],
      installedHardware: [
        // Heavy 2U UPS mounted high at U38-U39
        {
          id: 'ups-top',
          type: 'ups',
          rackUnits: 2,
          powerDraw: 200,
          depth: 0.7,
          position: [0, (38 - 1 + 1) * 0.04445, 0],
        },
      ],
    };

    const result = lintRackConfiguration([topHeavyRack]);
    expect(result.warningCount).toBeGreaterThanOrEqual(1);
    expect(result.issues.some((i) => i.code === 'WARN_TOP_HEAVY')).toBe(true);
  });

  it('detects cable bend radius physical violations (ERR_BEND_RADIUS)', () => {
    const rack: RackInstance = {
      id: 'rack-clean',
      name: 'Clean Rack',
      capacity: 42,
      rackType: 'cabinet',
      isDoorOpen: false,
      position: [0, 0, 0],
      installedHardware: [
        {
          id: 'sw-1',
          type: 'switch',
          rackUnits: 1,
          powerDraw: 100,
          depth: 0.4,
          position: [0, 0.022225, 0],
        },
      ],
    };

    const violatingCables: CableProps[] = [
      {
        id: 'cable-bad-bend',
        fromDevice: 'sw-1',
        fromPort: 'port-1',
        toDevice: 'sw-1',
        toPort: 'port-2',
        type: 'fiber-om4',
        color: '#06b6d4',
        lengthMeters: 0.2,
        hasBendViolation: true,
      },
    ];

    const result = lintRackConfiguration([rack], violatingCables);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'ERR_BEND_RADIUS')).toBe(true);
  });
});

