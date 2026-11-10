/**
 * rackSlots.test.ts
 *
 * U-slot / rail helpers in `rackLayout.ts`:
 * - conversion between EIA-310 U numbers (U1 = bottom) and the
 *   chassis centre Y used by the 3D scene,
 * - rail alignment (bottom edge must sit on a U boundary),
 * - valid U heights,
 * - occupied-slot map and first-free-slot search.
 */

import { describe, it, expect } from 'vitest';
import {
  uStartToCenterY,
  centerYToUStart,
  isRailAligned,
  isValidRackUnitHeight,
  getOccupiedUnits,
  findFirstFreeSlot,
  canPlaceAt,
} from '../rackLayout';
import { RACK_UNIT_HEIGHT as U } from '../../store/useConfiguratorStore';
import type { HardwareProps } from '../../types/rack.types';

const hw = (id: string, uStart: number, rackUnits: number): HardwareProps => ({
  id,
  type: 'server',
  rackUnits,
  powerDraw: 100,
  depth: 0.6,
  position: [0, uStartToCenterY(uStart, rackUnits), 0],
});

describe('U ↔ Y conversion (rails)', () => {
  it('U1 1U chassis is centred half a unit above the floor', () => {
    expect(uStartToCenterY(1, 1)).toBeCloseTo(U / 2, 9);
  });

  it('U1 2U chassis is centred on the U1/U2 seam', () => {
    expect(uStartToCenterY(1, 2)).toBeCloseTo(U, 9);
  });

  it('U42 1U chassis touches the top of a 42U rack', () => {
    expect(uStartToCenterY(42, 1) + U / 2).toBeCloseTo(42 * U, 9);
  });

  it.each([
    [1, 1],
    [1, 2],
    [7, 4],
    [40, 3],
    [42, 1],
  ])('round-trips uStart=%i, %iU', (uStart, rackUnits) => {
    expect(centerYToUStart(uStartToCenterY(uStart, rackUnits), rackUnits)).toBe(uStart);
  });

  it('snaps sub-millimetre float noise to the nearest U', () => {
    const y = uStartToCenterY(10, 2) + 0.0004;
    expect(centerYToUStart(y, 2)).toBe(10);
  });
});

describe('isRailAligned', () => {
  it('accepts a chassis whose bottom edge sits on a U boundary', () => {
    expect(isRailAligned(uStartToCenterY(5, 1), 1)).toBe(true);
    expect(isRailAligned(uStartToCenterY(5, 2), 2)).toBe(true);
  });

  it('rejects a chassis offset by half a U', () => {
    expect(isRailAligned(uStartToCenterY(5, 1) + U / 2, 1)).toBe(false);
  });

  it('tolerates float noise below the collision epsilon', () => {
    expect(isRailAligned(uStartToCenterY(5, 1) + 1e-6, 1)).toBe(true);
  });

  it('rejects non-finite values', () => {
    expect(isRailAligned(Number.NaN, 1)).toBe(false);
    expect(isRailAligned(Number.POSITIVE_INFINITY, 1)).toBe(false);
  });
});

describe('isValidRackUnitHeight', () => {
  it.each([1, 2, 4, 42])('accepts %iU in a 42U rack', (u) => {
    expect(isValidRackUnitHeight(u, 42)).toBe(true);
  });

  it.each([0, -1, 1.5, 43, Number.NaN])('rejects %s', (u) => {
    expect(isValidRackUnitHeight(u, 42)).toBe(false);
  });
});

describe('getOccupiedUnits', () => {
  it('maps every occupied U to the device id', () => {
    const map = getOccupiedUnits([hw('a', 1, 2), hw('b', 5, 1)], 42);
    expect([...map.entries()]).toEqual([
      [1, 'a'],
      [2, 'a'],
      [5, 'b'],
    ]);
  });

  it('returns an empty map for an empty rack', () => {
    expect(getOccupiedUnits([], 42).size).toBe(0);
  });
});

describe('findFirstFreeSlot', () => {
  it('returns U1 in an empty rack', () => {
    expect(findFirstFreeSlot(2, 42, [])).toBe(1);
  });

  it('fills the lowest gap that fits', () => {
    // a: U1-U2, gap U3 (1U), b: U4, gap U5-U42
    const list = [hw('a', 1, 2), hw('b', 4, 1)];
    expect(findFirstFreeSlot(1, 42, list)).toBe(3);
    expect(findFirstFreeSlot(2, 42, list)).toBe(5);
  });

  it('returns null when the rack is full', () => {
    expect(findFirstFreeSlot(1, 2, [hw('a', 1, 2)])).toBeNull();
  });

  it('returns null when no gap is tall enough', () => {
    // 4U rack: U1 free, U2 used, U3 free, U4 used → no 2U gap
    const list = [hw('a', 2, 1), hw('b', 4, 1)];
    expect(findFirstFreeSlot(2, 4, list)).toBeNull();
    expect(findFirstFreeSlot(1, 4, list)).toBe(1);
  });

  it('can place a device that fills the rack exactly', () => {
    expect(findFirstFreeSlot(42, 42, [])).toBe(1);
    expect(findFirstFreeSlot(43, 42, [])).toBeNull();
  });
});

describe('canPlaceAt', () => {
  const list = [hw('a', 10, 2)]; // U10-U11

  it('accepts a free, in-bounds slot', () => {
    expect(canPlaceAt(12, 1, 42, list)).toBe(true);
  });

  it('rejects overlap (collision)', () => {
    expect(canPlaceAt(11, 1, 42, list)).toBe(false);
    expect(canPlaceAt(9, 2, 42, list)).toBe(false);
  });

  it('rejects slots outside the rails', () => {
    expect(canPlaceAt(0, 1, 42, [])).toBe(false);
    expect(canPlaceAt(42, 2, 42, [])).toBe(false);
  });

  it('ignores the moving device itself', () => {
    expect(canPlaceAt(11, 2, 42, list, 'a')).toBe(true);
  });
});
