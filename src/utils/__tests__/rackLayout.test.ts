/**
 * rackLayout.test.ts
 *
 * Unit tests for the pure rack layout helpers in `src/utils/rackLayout.ts`.
 *
 * Coverage target — three categories from the project brief:
 *   1. Valid placements: drop into empty + partially-filled rack,
 *      confirming the snap/convention alignment reaches the rack
 *      without violating bounds or colliding.
 *   2. Out of bounds: chassis that overflows the floor or the rack
 *      ceiling is rejected, including oversized chassis that
 *      cannot fit at all.
 *   3. Overlaps / collisions: dropped chassis whose Y-range
 *      intersects an installed chassis is rejected; edge-touching
 *      at slot seams remains VALID (COLLISION_EPSILON tolerance).
 *
 * Run with: `npm test` or `npx vitest run`.
 */

import { describe, it, expect } from 'vitest';
import {
  checkDropValidity,
  COLLISION_EPSILON,
  getChassisFootprint,
} from '../rackLayout';
import { RACK_UNIT_HEIGHT } from '../../store/useConfiguratorStore';
import type { HardwareProps } from '../../types/rack.types';

const U = RACK_UNIT_HEIGHT;
const CAPACITY = 42;

/**
 * Compact factory so test cases stay readable. Defaults to a 1U
 * `server`-type chassis with `powerDraw = 0`, `depth = 0.6 m`,
 * and `position[1] = (rackUnits * U) / 2` — i.e.:

 *   - 1U ⇒ slot-0 centre (0.5U),
 *   - 2U ⇒ seam 1 (U),
 *   - 4U ⇒ seam 2 (2U).
 *
 * Callers override `position` for top-of-rack or custom placements,
 * or `rackUnits` to size the chassis. The default `position` mirrors
 * `src/store/useConfiguratorStore.ts`'s `addHardware` default so we
 * faithfully model a rack populated by the canonical UI flow.
 */
function hw(
  partial: Pick<HardwareProps, 'id' | 'rackUnits'> & Partial<HardwareProps>,
): HardwareProps {
  return {
    type: partial.type ?? 'server',
    powerDraw: partial.powerDraw ?? 0,
    depth: partial.depth ?? 0.6,
    ...partial,
    position:
      partial.position ?? [0, (partial.rackUnits * U) / 2, 0],
  };
}

// ---------------------------------------------------------------------------
// 1. Valid placements
// ---------------------------------------------------------------------------

describe('checkDropValidity — valid placements', () => {
  it('1U dragged into an empty rack at slot 0 centre (0.5U) is VALID', () => {
    expect(checkDropValidity('drag', 0.5 * U, 1, CAPACITY, [])).toBe(true);
  });

  it('2U dragged into an empty rack at seam U is VALID', () => {
    // 2U centre on seam 1 (snappedY = U) → spans [0, 2U]; fits inside.
    expect(checkDropValidity('drag', U, 2, CAPACITY, [])).toBe(true);
  });

  it('1U at the topmost slot centre ((capacity-1)*U + 0.5U) is VALID', () => {
    expect(
      checkDropValidity(
        'drag',
        (CAPACITY - 1) * U + 0.5 * U,
        1,
        CAPACITY,
        [],
      ),
    ).toBe(true);
  });

  it('2U at the topmost valid seam ((capacity-1)*U) is VALID', () => {
    expect(
      checkDropValidity('drag', (CAPACITY - 1) * U, 2, CAPACITY, []),
    ).toBe(true);
  });

  it('multi-device partially-filled rack: a 1U drop well above all installed hardware is VALID', () => {
    const installed = [
      hw({ id: 'A', rackUnits: 1, position: [0, 0.5 * U, 0] }),
      hw({ id: 'B', rackUnits: 2, position: [0, 2 * U, 0] }),
      hw({ id: 'C', rackUnits: 4, position: [0, 6 * U, 0] }),
    ];
    // Slot 13 centre (13.5U) sits comfortably above C's footprint.
    expect(
      checkDropValidity('drag', 13.5 * U, 1, CAPACITY, installed),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Out of bounds
// ---------------------------------------------------------------------------

describe('checkDropValidity — out of bounds', () => {
  it('2U at seam 0 (snappedY = 0) is INVALID — centre at the floor over-hangs', () => {
    // Note: this is symmetric with the 1U case at snappedY = 0
    // (dropMin = -U < -EPSILON → bounds reject), but the 2U is
    // a different invariant because a future refactor to snapping
    // form might accidentally allow seam-0 centres for even
    // rackUnits. Pinned here for that anti-regression.
    expect(checkDropValidity('drag', 0, 2, CAPACITY, [])).toBe(false);
  });

  it('1U with snappedY = -0.5U (centre below the floor) is INVALID', () => {
    expect(checkDropValidity('drag', -0.5 * U, 1, CAPACITY, [])).toBe(
      false,
    );
  });

  it('4U dragged against an empty rack-of-2 is INVALID — chassis cannot fit', () => {
    const tinyCapacity = 2;
    expect(
      checkDropValidity('drag', 0, 4, tinyCapacity, []),
    ).toBe(false);
  });

  it('2U dragged 1 seam past the top (snappedY = capacity*U) is INVALID', () => {
    expect(
      checkDropValidity('drag', CAPACITY * U, 2, CAPACITY, []),
    ).toBe(false);
  });

  it('1U dragged 5 mm past the topmost valid slot centre is INVALID', () => {
    expect(
      checkDropValidity(
        'drag',
        (CAPACITY - 1) * U + 0.5 * U + 0.005,
        1,
        CAPACITY,
        [],
      ),
    ).toBe(false);
  });

  it('1U dragged far above capacity (1000 m above floor) is INVALID', () => {
    expect(checkDropValidity('drag', 1000, 1, CAPACITY, [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Overlaps / Collisions
// ---------------------------------------------------------------------------

describe('checkDropValidity — overlaps with installed hardware', () => {
  it('1U dropped onto an existing 1U at the SAME slot is INVALID', () => {
    const installed = [
      hw({ id: 'A', rackUnits: 1, position: [0, 0.5 * U, 0] }),
    ];
    expect(
      checkDropValidity('drag', 0.5 * U, 1, CAPACITY, installed),
    ).toBe(false);
  });

  it('1U dropped into an ADJACENT slot is VALID (edges touch at the slot seam)', () => {
    // A.1 spans [0, U]; drag B at slot 1 (snappedY = 1.5U) spans
    // [U, 2U]. Edges coincide at y = U. With COLLISION_EPSILON =
    // 1 mm, this is just inside tolerance → VALID.
    const installed = [
      hw({ id: 'A', rackUnits: 1, position: [0, 0.5 * U, 0] }),
    ];
    expect(
      checkDropValidity('drag', 1.5 * U, 1, CAPACITY, installed),
    ).toBe(true);
  });

  it('1U pushed 5 mm past the slot seam into a neighbour slot is INVALID', () => {
    const installed = [
      hw({ id: 'A', rackUnits: 1, position: [0, 0.5 * U, 0] }),
    ];
    expect(
      checkDropValidity('drag', U + 0.005, 1, CAPACITY, installed),
    ).toBe(false);
  });

  it('2U straddling a 1U chassis is INVALID', () => {
    // Existing 1U at slot 0 spans [0, U]. 2U at seam U spans [0, 2U];
    // overlap on [0, U] → INVALID.
    const installed = [
      hw({ id: 'A', rackUnits: 1, position: [0, 0.5 * U, 0] }),
    ];
    expect(
      checkDropValidity('drag', U, 2, CAPACITY, installed),
    ).toBe(false);
  });

  it('2U dropped next to another 2U (touching at the next seam) is VALID', () => {
    // In the "2U centres on slot seams" convention, two 2Us
    // touch without overlapping ONLY when their centres are 2U
    // apart. Adjacent centres at consecutive seams (e.g. U and
    // 2U) would share a slot (slot 1) and collide.
    //   - Existing 2U at seam U spans [0, 2U].   Slots 0–1.
    //   - Drag 2U at seam 3U spans [2U, 4U].     Slots 2–3.
    //   - Edges coincide at y = 2U → VALID.
    const installed = [
      hw({ id: 'A', rackUnits: 2, position: [0, U, 0] }),
    ];
    expect(
      checkDropValidity('drag', 3 * U, 2, CAPACITY, installed),
    ).toBe(true);
  });

  it('2U dropped ONTO an existing 2U at the same seam is INVALID', () => {
    const installed = [
      hw({ id: 'A', rackUnits: 2, position: [0, U, 0] }),
    ];
    expect(
      checkDropValidity('drag', U, 2, CAPACITY, installed),
    ).toBe(false);
  });

  it('4U dropped over an existing 2U chassis is INVALID', () => {
    // Existing 2U at seam 2U spans [U, 3U]. 4U at snappedY = 2U
    // spans [0, 4U]; overlap on [U, 3U] → INVALID.
    const installed = [
      hw({ id: 'A', rackUnits: 2, position: [0, 2 * U, 0] }),
    ];
    expect(
      checkDropValidity('drag', 2 * U, 4, CAPACITY, installed),
    ).toBe(false);
  });

  it('a chassis dragged to its OWN position is VALID (draggingId is skipped)', () => {
    // Anti-regression: the `if (h.id === draggingId) continue;`
    // guard must trigger, otherwise every drag would falsely
    // collide with itself.
    const installed = [
      hw({ id: 'A', rackUnits: 1, position: [0, 0.5 * U, 0] }),
    ];
    expect(
      checkDropValidity('A', 0.5 * U, 1, CAPACITY, installed),
    ).toBe(true);
  });

  it('mixed parity: 1U dropped at slot 2 centre conflicts with a 2U at seam 2', () => {
    // 2U at seam 2U spans [U, 3U]. 1U at slot 2 centre (2.5U)
    // spans [2U, 3U]. Overlap on [2U, 3U] → INVALID.
    const installed = [
      hw({ id: 'A', rackUnits: 2, position: [0, 2 * U, 0] }),
    ];
    expect(
      checkDropValidity('drag', 2.5 * U, 1, CAPACITY, installed),
    ).toBe(false);
  });

  it('fully-packed rack: every candidate 3U drop target is INVALID', () => {
    // Pack the rack tightly with alternating 1U + 2U chassis
    // leaving no gaps. Any 3U drop will run into either the floor,
    // the ceiling, or an installed chassis.
    const installed: HardwareProps[] = [];
    let cursor = 0;
    let i = 0;
    while (cursor < CAPACITY * U - 0.001) {
      const u = i % 2 === 0 ? 1 : 2;
      const half = (u * U) / 2;
      installed.push(
        hw({
          id: `p${i}`,
          rackUnits: u,
          position: [0, cursor + half, 0],
        }),
      );
      cursor += u * U;
      i++;
    }
    // Sanity — we expect ~28 chassis (14 alternating pairs).
    expect(installed.length).toBeGreaterThan(10);

    // Sample several candidate drop positions: each must be INVALID.
    for (const centerY of [0.5 * U, 10 * U, 30 * U]) {
      expect(
        checkDropValidity('drag', centerY, 3, CAPACITY, installed),
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Exported constants
// ---------------------------------------------------------------------------

describe('COLLISION_EPSILON constant', () => {
  it('is exported and equals 0.001 m (1 mm tolerance)', () => {
    expect(COLLISION_EPSILON).toBe(0.001);
  });
});

// ---------------------------------------------------------------------------
// 5. getChassisFootprint helper
// ---------------------------------------------------------------------------

describe('getChassisFootprint — chassis geometry helper', () => {
  it('1U at slot 0 centre (snapY = 0.5U) → {min: 0, max: U}', () => {
    expect(getChassisFootprint(0.5 * U, 1)).toEqual({ min: 0, max: U });
  });

  it('2U at seam 1 (snapY = U) → {min: 0, max: 2U}', () => {
    expect(getChassisFootprint(U, 2)).toEqual({ min: 0, max: 2 * U });
  });

  it('3U centred on slot 1 (snapY = 1.5U) → {min: 0, max: 3U}', () => {
    expect(getChassisFootprint(1.5 * U, 3)).toEqual({ min: 0, max: 3 * U });
  });

  it('4U centred on seam 2 (snapY = 2U) → {min: 0, max: 4U}', () => {
    expect(getChassisFootprint(2 * U, 4)).toEqual({ min: 0, max: 4 * U });
  });

  it('is symmetric about y = 0 — min and max flip signs when y flips', () => {
    const a = getChassisFootprint(10 * U, 3);
    const b = getChassisFootprint(-10 * U, 3);
    expect(a.max).toBeCloseTo(-b.min, 10);
    expect(a.min).toBeCloseTo(-b.max, 10);
  });

  it('centre is the arithmetic mean of (min, max)', () => {
    expect(
      (getChassisFootprint(7.5 * U, 4).min +
        getChassisFootprint(7.5 * U, 4).max) /
        2,
    ).toBeCloseTo(7.5 * U, 10);
  });

  it('height equals rackUnits * RACK_UNIT_HEIGHT', () => {
    const fp1 = getChassisFootprint(0, 5);
    expect(fp1.max - fp1.min).toBeCloseTo(5 * U, 10);
    const fp2 = getChassisFootprint(0, 1);
    expect(fp2.max - fp2.min).toBeCloseTo(U, 10);
  });

  it('NaN input propagates NaN outputs (pure function — no error correction)', () => {
    // The helper has no engineering semantics; NaN-in simply
    // propagates NaN-out per IEEE 754. The drop validator catches
    // NaN dropped via `Number.isFinite`.
    const fp = getChassisFootprint(NaN, 1);
    expect(Number.isNaN(fp.min)).toBe(true);
    expect(Number.isNaN(fp.max)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Bounds fuzzing — erratic / pathological Y coordinates
// ---------------------------------------------------------------------------
//
// Goal: a downstream consumer might pass wildly wrong values (a
// bug in the pointer-event handler, a client-side teleportation
// feature, a deserialised move from a save file with corrupted
// floats, etc.). The validator must:
//   (1) never throw,
//   (2) always return a boolean (never NaN),
//   (3) reject non-real inputs (NaN, ±Infinity),
//   (4) reject any input whose footprint escapes the rack bounds,
//   (5) accept only physically-plausible slot-aligned inputs.
//
// Below we exercise the validator against a hand-curated set of
// extreme Y values spanning six decades of magnitude plus the
// non-real cases.

describe('checkDropValidity — bounds fuzzing', () => {
  // Hand-picked extreme Y coordinates covering IEC 754 subnormals,
  // max-safe-integers, signed infinities, NaN, plus a few slot-
  // valid values for contrast.
  const FUZZ_YS: readonly number[] = [
    // IEC 754 subnormals & tiny
    Number.MIN_VALUE,
    -Number.MIN_VALUE,
    5e-324,
    -5e-324,
    1e-300,
    -1e-300,
    // Small but representable
    1e-10,
    -1e-10,
    1e-5,
    -1e-5,
    0.001,
    -0.001,
    // Zero / signed zero
    0,
    -0,
    // Slot-relative
    U,
    -U,
    0.5 * U,
    -0.5 * U,
    // Small magnitudes
    1,
    -1,
    10,
    -10,
    100,
    -100,
    // Mid-range
    1e3,
    -1e3,
    1e6,
    -1e6,
    // Massive overflows
    1e10,
    -1e10,
    1e15,
    -1e15,
    Number.MAX_SAFE_INTEGER,
    -Number.MAX_SAFE_INTEGER,
    // Full IEEE max magnitudes — well beyond MAX_SAFE_INTEGER
    // (≈9.0e15). A corrupted save file with raw max-double Y is
    // exercised here.
    Number.MAX_VALUE,
    -Number.MAX_VALUE,
    // Signed infinities
    Infinity,
    -Infinity,
    // NaN
    NaN,
  ];

  it.each(FUZZ_YS)(
    'erratic input y=%s → no throw, valid boolean (never NaN)',
    (y) => {
      expect(() =>
        checkDropValidity('drag', y, 1, 42, []),
      ).not.toThrow();
      const result = checkDropValidity('drag', y, 1, 42, []);
      expect(typeof result).toBe('boolean');
      expect(Number.isNaN(result)).toBe(false);
    },
  );

  it.each(FUZZ_YS)(
    'chaotic y=%s across rackUnits ∈ {1, 2, 3, 4} never crashes',
    (y) => {
      for (const rackUnits of [1, 2, 3, 4]) {
        expect(() =>
          checkDropValidity('drag', y, rackUnits, 42, []),
        ).not.toThrow();
      }
    },
  );

  it.each(FUZZ_YS)(
    'chaotic y=%s across capacities ∈ {1, 42, 1000} never crashes',
    (y) => {
      for (const capacity of [1, 42, 1000]) {
        expect(() =>
          checkDropValidity('drag', y, 1, capacity, []),
        ).not.toThrow();
      }
    },
  );

  // ---- Invariant: non-real inputs ALWAYS rejected ----

  it.each([NaN, Infinity, -Infinity])(
    'non-real y=%s is REJECTED (Number.isFinite guard)',
    (y) => {
      expect(checkDropValidity('drag', y, 1, 42, [])).toBe(false);
    },
  );

  // ---- Invariant: massive overflows ALWAYS rejected ----

  it.each([
    Number.MAX_SAFE_INTEGER,
    -Number.MAX_SAFE_INTEGER,
    Number.MAX_VALUE,
    -Number.MAX_VALUE,
    1e15,
    -1e15,
    1e10,
    -1e10,
    1e6,
    -1e6,
    1000,
    -1000,
  ])(
    'overflow y=%s (|y| > capacity*U) is REJECTED',
    (y) => {
      // 42U rack: even |y| > 1000 is far beyond capacity*U + EPSILON.
      expect(checkDropValidity('drag', y, 1, 42, [])).toBe(false);
    },
  );

  // ---- Invariant: subnormal / near-zero ALWAYS rejected (overhangs floor) ----

  it.each([
    Number.MIN_VALUE,
    -Number.MIN_VALUE,
    5e-324,
    -5e-324,
    1e-300,
    -1e-300,
    1e-10,
    -1e-10,
    1e-5,
    -1e-5,
    0.001,
    -0.001,
    0,
    -0,
  ])(
    'subnormal/tiny y=%s near the floor is REJECTED (dropMin < -EPSILON)',
    (y) => {
      expect(checkDropValidity('drag', y, 1, 42, [])).toBe(false);
    },
  );

  // ---- Sanity invariant: slot-valid inputs ACCEPTED in an empty rack ----

  it.each([0.5 * U, 1.5 * U, U, 2 * U, 5 * U, 10 * U, 41.5 * U])(
    'slot-valid y=%s in empty rack is ACCEPTED',
    (y) => {
      expect(checkDropValidity('drag', y, 1, 42, [])).toBe(true);
    },
  );
});
