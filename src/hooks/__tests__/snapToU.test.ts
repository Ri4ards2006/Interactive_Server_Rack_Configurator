/**
 * snapToU.test.ts
 *
 * Locks down the parity-aware snap math against future regressions.
 * The bug being guarded against: snap_to_y(y, 1) used to round to
 * integer U boundaries, so a 1U chassis at slot 0 drifted half a
 * slot higher than its neighbours and visibly straddled the seam.
 *
 * Expectations covered by these tests
 * -----------------------------------
 * - Odd `rackUnits` (1U, 3U, …) snap centres land on SLOT CENTRES
 *   (0.5U, 1.5U, 2.5U, …) regardless of the input cursor position.
 * - Even `rackUnits` (2U, 4U, …) snap centres land on SLOT SEAMS
 *   (0, U, 2U, …) — chassis straddle equal numbers of slots above
 *   and below their centre.
 * - Sub-floor and beyond-capacity cursors still produce a
 *   mathematically valid Y. The BBOX check (in `checkDropValidity`)
 *   is what actually rejects these; the snap function alone only
 *   has to remain deterministic + safe with extreme inputs.
 *
 * Run with: `npx vitest run` or `npm test`.
 */

import { describe, it, expect } from 'vitest';
import { snapToU } from '../snapToU';
import { RACK_UNIT_HEIGHT } from '../../store/useConfiguratorStore';

const U = RACK_UNIT_HEIGHT;

// Sub-nanometre tolerance — the snap math is pure IEEE 754
// multiplications + additions, so the actual drift between an
// expected value computed via "0.5 * U" and the same value computed
// inside `snapToU` is orders of magnitude smaller than this.
const SNAP_TOLERANCE = 1e-9;

/** Assert that `actual` matches `expected` within SNAP_TOLERANCE. */
function expectSnap(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThan(SNAP_TOLERANCE);
}

describe('snapToU — odd rackUnits (chassis CENTER lands on slot CENTRES)', () => {
  it('1U: snaps a sub-floor cursor and a chassis right above the slot boundary to slot 0 centre (0.5U)', () => {
    // Pre-bug behaviour would round these to 0*U (slot seam), causing
    // the chassis to straddle slots 0 and -1. Now they snap up to
    // the slot-0 centre.
    expectSnap(snapToU(0, 1), 0.5 * U);
    expectSnap(snapToU(0.25 * U, 1), 0.5 * U);
    expectSnap(snapToU(0.49 * U, 1), 0.5 * U);
  });

  it('1U: y = 0.5*U snaps EXACTLY to slot 0 centre (not to slot 1 due to Math.round(0.5)=1)', () => {
    // Anti-regression: this is the precise off-by-half-step bug
    // that motivated the parity-aware snap. Without the
    // `y - halfU` shift trick this would return 1.5*U.
    expectSnap(snapToU(0.5 * U, 1), 0.5 * U);
  });

  it('1U: y = 0.51*U (just past the slot-0 centre) snaps to slot 0 centre', () => {
    // 0.51 > 0.5 so the rounding reference ((y - halfU)/U = 0.01)
    // still falls below the next integer → slot 0 wins.
    expectSnap(snapToU(0.51 * U, 1), 0.5 * U);
  });

  it('1U: y = 0.99*U (just below the slot 0/1 seam) snaps to slot 0 centre', () => {
    // Cursor very close to slot seam still picks the closer centre.
    expectSnap(snapToU(0.99 * U, 1), 0.5 * U);
  });

  it('1U: y = 1.0*U (exactly on slot 0/1 seam) snaps UP to slot 1 centre (1.5U)', () => {
    // Equidistant: the half-up `Math.round` convention picks the
    // higher slot. This is an intentional tie-break — NOT a bug.
    expectSnap(snapToU(U, 1), 1.5 * U);
  });

  it('1U: y = 1.4*U snaps EXACTLY to slot 1 centre (1.5U)', () => {
    // The specific input called out in the user spec for odd
    // rackUnits. This is the primary anti-regression case.
    expectSnap(snapToU(1.4 * U, 1), 1.5 * U);
  });

  it('1U: y close to higher slots (e.g. 20.4*U, 20.6*U) snaps to slot 20 centre', () => {
    expectSnap(snapToU(20.4 * U, 1), 20.5 * U);
    expectSnap(snapToU(20.6 * U, 1), 20.5 * U);
  });

  it('3U: snaps to slot centres (e.g. y ≈ 1.5*U → 1.5*U, spans slots 0–2)', () => {
    expectSnap(snapToU(1.4 * U, 3), 1.5 * U);
    expectSnap(snapToU(1.6 * U, 3), 1.5 * U);
    expectSnap(snapToU(0.5 * U, 3), 0.5 * U);
    expectSnap(snapToU(2.6 * U, 3), 2.5 * U);
  });
});

describe('snapToU — even rackUnits (chassis CENTER lands on slot SEAMS)', () => {
  it('2U: y near 0 snaps down to seam 0', () => {
    expectSnap(snapToU(0, 2), 0);
    expectSnap(snapToU(0.3 * U, 2), 0);
    expectSnap(snapToU(0.49 * U, 2), 0);
  });

  it('2U: snaps EXACTLY onto integer boundaries — y = U → U, y = 2U → 2U', () => {
    expectSnap(snapToU(U, 2), U);
    expectSnap(snapToU(2 * U, 2), 2 * U);
    expectSnap(snapToU(0.7 * U, 2), U);
    expectSnap(snapToU(1.5 * U, 2), 2 * U); // Math.round(1.5) === 2 → snaps up
  });

  it('2U: 2U starting just above floor (y = U) lands cleanly on slot seam (chassis spans slots 0/1)', () => {
    expectSnap(snapToU(U, 2), U);
  });

  it('4U: snaps to slot seams (chassis covers 4 slots evenly above and below the centre)', () => {
    expectSnap(snapToU(0, 4), 0);
    expectSnap(snapToU(2 * U, 4), 2 * U);
    expectSnap(snapToU(2.4 * U, 4), 2 * U);
    expectSnap(snapToU(3.5 * U, 4), 4 * U);
  });
});

describe('snapToU — edge cases (out-of-bounds cursor positions)', () => {
  // NOTE: snapToU is intentionally pure — out-of-bounds cursors
  // still produce a mathematically valid Y. The actual rejection of
  // these positions is done by `checkDropValidity`'s bounds check
  // (`dropMin < -EPSILON || dropMax > capacity * U + EPSILON`).
  // These tests pin down the snap behaviour so any future refactor
  // doesn't accidentally NaN / Infinity out on extreme inputs.

  // The snap formula performs `Math.round((y - halfU) / U)`. At y
  // values where `(y - halfU) / U` falls EXACTLY on a negative
  // half-integer (e.g. `y = -U` → `(y - halfU)/U = -1.5`), IEEE 754
  // noise in the subtraction + division can tip the result one ULP
  // past `-N.5`, making `Math.round` (which rounds half toward +∞)
  // either round UP to `-N + 1` or DOWN to `-N - 1`. Both adjacent
  // slot centres are valid snap targets below the floor; enumerate
  // them explicitly with `arrayContaining` rather than apply a magic
  // tolerance that would silently swallow real regressions.

  /**
   * Assert that `actual` is approximately equal to one of
   * `candidates` within `SNAP_TOLERANCE`. Used for IEEE-754-noisy
   * cases where the snap target is ambiguous between two adjacent
   * slot centres exactly U apart.
   *
   * Note on why this can't use `expect.arrayContaining` directly:
   * `arrayContaining` uses `Object.is` (exact bit-equality) for each
   * candidate, but the candidate constant and the function's
   * computed result can drift by a few ULPs each (e.g. `-0.066675`
   * from `-1.5 * 0.04445` vs. `-0.06667500000000001` from the
   * actual function body). A tolerance-aware `some` predicate is the
   * only way to compare equal-but-bit-different slot centres.
   */
  function expectSnapOneOf(actual: number, candidates: number[]): void {
    const matches = candidates.some(
      (candidate) => Math.abs(actual - candidate) < SNAP_TOLERANCE,
    );
    expect(matches).toBe(true);
  }

  it('1U: a cursor far below the floor (y = -2*U) snaps to slot -2 OR slot -3 centre', () => {
    // (y - halfU)/U = -2.5 canonical; Math.round half-up = -2, but
    // IEEE noise can flip to -3. Both centres are valid; bounds
    // check rejects them regardless.
    expectSnapOneOf(snapToU(-2 * U, 1), [-1.5 * U, -2.5 * U]);
  });

  it('1U: cursor at exactly y = -U snaps to slot -1 OR slot -2 centre (IEEE noise at -1.5 boundary)', () => {
    // (y - halfU)/U = -1.5 canonical; Math.round half-up = -1, but
    // IEEE noise can flip to -2. Both centres are valid snap
    // targets; bounds check rejects them either way.
    expectSnapOneOf(snapToU(-U, 1), [-0.5 * U, -1.5 * U]);
  });

  it('1U: cursor at exactly y = -0.5*U (one half-U below floor) snaps to slot -1 centre (unambiguous integer-rounding reference)', () => {
    // (y - halfU)/U = -1 exactly (no half-integer ambiguity here)
    // → Math.round(-1) = -1.
    expectSnap(snapToU(-0.5 * U, 1), -0.5 * U);
  });

  it('1U: cursor far above capacity-42 (y = 44*U) snaps to slot 44 centre — bounds check rejects', () => {
    // (y - halfU)/U = 43.5 canonical; tie at +∞ always rounds up to
    // 44 (positive side is unambiguous).
    expectSnap(snapToU(44 * U, 1), 44.5 * U);
  });

  it('2U: cursor just past capacity-42 (y = 42*U) snaps onto seam 42 — bounds check rejects', () => {
    expectSnap(snapToU(42 * U, 2), 42 * U);
  });

  it('2U: cursor far past capacity eventually rounds up further', () => {
    expectSnap(snapToU(50 * U, 2), 50 * U);
  });

  it('all rackUnits return mathematically finite values for y = 0 (no NaN / Infinity failover)', () => {
    expectSnap(snapToU(0, 1), 0.5 * U);
    expectSnap(snapToU(0, 2), 0);
    expectSnap(snapToU(0, 3), 0.5 * U);
    expectSnap(snapToU(0, 4), 0);
  });
});

describe('snapToU — convention consistency between cursor and addHardware default', () => {
  // The whole point of the parity-aware fix: a freshly-added 1U
  // chassis and a freshly-dragged-to-the-same-yield 1U chassis must
  // land at the EXACT SAME y. The addHardware default position[1]
  // is `(rackUnits * U) / 2`, so:

  it.each([1, 3, 5])(
    '1U/3U/5U drag-to-slot-0 yields the same y as addHardware default',
    (rackUnits) => {
      const defaultY = (rackUnits * U) / 2;
      // Drag cursor exactly onto slot 0 centre (0.5*U for odd).
      expectSnap(snapToU(defaultY, rackUnits), defaultY);
    },
  );

  it.each([2, 4, 6])(
    '2U/4U/6U drag-to-seam-0 yields the same y as addHardware default',
    (rackUnits) => {
      const defaultY = (rackUnits * U) / 2; // = 1*U, 2*U, 3*U respectively
      expectSnap(snapToU(defaultY, rackUnits), defaultY);
    },
  );
});
