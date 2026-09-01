/**
 * cableGeometry.test.ts
 *
 * Unit tests for 3D Catmull-Rom patch cable mathematics,
 * gravitational sag, bend radius compliance, and port position resolution.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  getCableMediumSpec,
  calculateSag,
  calculateBendRadius,
  calculateCableCurve,
  getPortWorldPosition,
  isPortConnectionValid,
} from '../cableGeometry';
import type { HardwareProps } from '../../types/rack.types';
import { CABLE_MEDIUM_SPECS, CableType } from '../../types/cable.types';

describe('cableGeometry — Physical Specifications', () => {
  it('provides complete specifications for all 5 cable medium types', () => {
    const types: CableType[] = [
      'copper-cat6',
      'copper-cat6a',
      'fiber-om4',
      'fiber-os2',
      'dac-10g',
    ];

    for (const type of types) {
      const spec = getCableMediumSpec(type);
      expect(spec).toBeDefined();
      expect(spec.id).toBe(type);
      expect(spec.outerDiameterMm).toBeGreaterThan(0);
      expect(spec.minBendRadiusMm).toBeGreaterThan(0);
      expect(spec.defaultColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(spec.plugType).toBeDefined();
    }
  });

  it('correctly sets physical bend radius limits', () => {
    expect(getCableMediumSpec('copper-cat6').minBendRadiusMm).toBe(25.0);
    expect(getCableMediumSpec('copper-cat6a').minBendRadiusMm).toBe(30.0);
    expect(getCableMediumSpec('fiber-om4').minBendRadiusMm).toBe(15.0);
    expect(getCableMediumSpec('fiber-os2').minBendRadiusMm).toBe(20.0);
    expect(getCableMediumSpec('dac-10g').minBendRadiusMm).toBe(30.0);
  });
});

describe('cableGeometry — Gravitational Sag Physics', () => {
  it('calculates greater sag for wider horizontal spans', () => {
    const p1 = new THREE.Vector3(0, 0.5, 0.39);
    const pShort = new THREE.Vector3(0.1, 0.5, 0.39);
    const pLong = new THREE.Vector3(0.4, 0.5, 0.39);

    const sagShort = calculateSag(p1, pShort);
    const sagLong = calculateSag(p1, pLong);

    expect(sagLong).toBeGreaterThan(sagShort);
  });

  it('applies medium-specific sag multipliers', () => {
    const p1 = new THREE.Vector3(0, 0.5, 0.39);
    const p2 = new THREE.Vector3(0.3, 0.5, 0.39);

    const sagCopper = calculateSag(p1, p2, 1.3); // heavier Cat6A
    const sagFiber = calculateSag(p1, p2, 0.65); // lightweight OS2

    expect(sagCopper).toBeGreaterThan(sagFiber);
  });
});

describe('cableGeometry — Discrete Bend Radius Calculation', () => {
  it('returns large radius for near-straight line curves', () => {
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.5, 0),
      new THREE.Vector3(0, 1.0, 0),
    ];
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const minRadius = calculateBendRadius(curve, 16);

    expect(minRadius).toBeGreaterThan(500); // effectively straight
  });

  it('detects tight curves and returns small bend radius', () => {
    // Construct a sharp hairpin bend
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.01, 0.01, 0),
      new THREE.Vector3(0.02, 0, 0),
    ];
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const minRadius = calculateBendRadius(curve, 32);

    expect(minRadius).toBeLessThan(25.0); // sharp bend < 25mm
  });
});

describe('cableGeometry — 3D Catmull-Rom Curve Generation', () => {
  it('generates a smooth 3D curve with realistic length and evaluation', () => {
    const p1 = new THREE.Vector3(-0.1, 0.1, 0.39);
    const p2 = new THREE.Vector3(0.1, 0.3, 0.39);

    const result = calculateCableCurve(p1, p2, 'copper-cat6');

    expect(result.curve).toBeInstanceOf(THREE.CatmullRomCurve3);
    expect(result.length).toBeGreaterThan(0.2); // greater than straight euclidean dist
    expect(result.points.length).toBe(41);
    expect(result.evaluation.lengthMeters).toBeGreaterThan(0);
    expect(typeof result.evaluation.hasBendViolation).toBe('boolean');
  });

  it('routes front-to-front cables forward (+Z aisle clearance)', () => {
    const p1 = new THREE.Vector3(-0.05, 0.1, 0.39);
    const p2 = new THREE.Vector3(0.05, 0.1, 0.39);

    const result = calculateCableCurve(p1, p2, 'copper-cat6');
    const midPoint = result.curve.getPoint(0.5);

    // Midpoint Z should extend further forward than faceplate (Z > 0.39)
    expect(midPoint.z).toBeGreaterThan(0.39);
  });
});

describe('cableGeometry — Port Position & Topology Checks', () => {
  const mockServer: HardwareProps = {
    id: 'srv-1',
    type: 'server',
    rackUnits: 2,
    powerDraw: 300,
    depth: 0.6,
    position: [0, 0.2, 0],
    ports: [
      { id: 'port-1', label: 'LAN 1', position: [-0.1, -0.008, -0.21], cableId: null },
      { id: 'port-2', label: 'LAN 2', position: [-0.06, -0.008, -0.21], cableId: null },
    ],
  };

  it('calculates exact 3D world position of a port within a chassis', () => {
    const pos = getPortWorldPosition(mockServer, 'port-1');
    expect(pos).not.toBeNull();
    expect(pos?.x).toBeCloseTo(-0.1);
    expect(pos?.y).toBeCloseTo(0.2 - 0.008);
    expect(pos?.z).toBeCloseTo(-0.21);
  });

  it('returns null for nonexistent port IDs', () => {
    const pos = getPortWorldPosition(mockServer, 'port-99');
    expect(pos).toBeNull();
  });

  it('validates connection topology rules', () => {
    expect(isPortConnectionValid('server', 'switch')).toBe(true);
    expect(isPortConnectionValid('switch', 'firewall')).toBe(true);
  });
});
