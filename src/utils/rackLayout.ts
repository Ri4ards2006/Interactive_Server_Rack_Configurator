/**
 * rackLayout.ts
 *
 * Pure rack layout math, decoupled from React / R3F / Zustand so it
 * can be unit-tested in a plain Vitest Node environment
 * (no `useThree`, no store, no DOM).
 *
 * Lives beside `src/hooks/snapToU.ts` (snap math) and is consumed
 * by `useHardwareInteraction` plus any future features that need
 * rack-aware geometry (keyboard nudges, save/load validation,
 * layout audits).
 *
 * Geometric primitives
 * --------------------
 * - `getChassisFootprint(y, rackUnits)`: the Y-range spanned by a
 *   chassis of the given height whose vertical CENTER sits at `y`.
 *   Returns `{ min, max }`. No bounds checking, no store reads —
 *   pure `(y - rackUnits*U/2, y + rackUnits*U/2)`.
 *
 * - `checkDropValidity(...)`: builds a footprint for the candidate
 *   drop, then verifies (a) the footprint fits inside `[0,
 *   capacity*U]` and (b) the footprint does NOT overlap any OTHER
 *   installed chassis's footprint, allowing edge-touching via
 *   `COLLISION_EPSILON`. Returns a boolean.
 */

import { RACK_UNIT_HEIGHT } from '../store/useConfiguratorStore';
import type { HardwareProps } from '../types/rack.types';

/**
 * Float-precision tolerance for Y-range overlap tests.
 *
 * Sub-millimetre so two correctly-aligned chassis whose EDGES touch
 * at a slot seam report VALID (mirroring EIA-310 flush mounting)
 * while still flagging genuine overlaps. Higher than IEEE 754
 * representation noise, lower than any meaningful chassis overlap.
 */
export const COLLISION_EPSILON = 0.001;

/**
 * The vertical extent of a single chassis in rack-local meters.
 * `min` is the bottom edge, `max` is the top edge.
 */
export interface ChassisFootprint {
  /** Y-coordinate of the chassis's bottom edge. */
  min: number;
  /** Y-coordinate of the chassis's top edge. */
  max: number;
}

/**
 * Compute the vertical footprint of a chassis with its CENTER at
 * `y` and a height of `rackUnits` rack units.
 *
 * Pure arithmetic — no bounds clamping, no store reads. NaN inputs
 * propagate NaN outputs per IEEE 754; the drop validator enforces
 * finiteness so callers don't need to.
 */
export function getChassisFootprint(
  y: number,
  rackUnits: number,
): ChassisFootprint {
  const halfHeight = (rackUnits * RACK_UNIT_HEIGHT) / 2;
  return { min: y - halfHeight, max: y + halfHeight };
}

/**
 * Decide whether a hardware drop is valid:
 *   1. The dragged chassis's vertical range must fit inside the rack
 *      bounds (i.e. not overhang the floor or the rack's top edge).
 *   2. The dragged chassis's vertical range must not overlap any
 *      OTHER already-installed hardware's vertical range.
 *
 * `position[1]` is the chassis's vertical CENTER (matching the
 * `addHardware` default `(rackUnits * U) / 2` and `snapToU` output).
 *
 * Floating-point range comparison handles the two chassis-alignment
 * conventions (odd rackUnits → centres at slot centres, even → on
 * slot seams) without integer-slot indexing. The `COLLISION_EPSILON`
 * floats the overlap test by 1 mm so (a) IEEE 754 representation
 * noise doesn't trigger spurious collisions, and (b) two perfectly
 * adjacent chassis whose edges touch at a slot seam report VALID.
 *
 * Defensive: a non-finite `snappedY` (NaN, +Infinity, -Infinity)
 * has no meaning as a rack coordinate and is rejected up-front
 * with `false` so downstream geometry never silently propagates
 * NaN through the rest of the comparison.
 */
export function checkDropValidity(
  draggingId: string,
  snappedY: number,
  rackUnits: number,
  capacity: number,
  hardwareList: HardwareProps[],
): boolean {
  // Reject non-finite inputs up-front so fuzz / corruptsave Y,
  // uniform-distribution aggregates of NaN rackUnits, etc. cannot
  // sneak through as malformed-but-acceptable. Each is finite-
  // checked independently because NaN comparisons against the
  // bounds + collision ranges always return false — meaning a NaN
  // halfHeight would silently produce `drop.min < -EPSILON` ⇒ false
  // AND `drop.max > capacity*U+EPSILON` ⇒ false, falsely passing
  // bounds; and drop.max > other.min+EPSILON evaluates NaN > x = false
  // for every iteration, falsely reporting zero collisions.
  if (
    !Number.isFinite(snappedY) ||
    !Number.isFinite(rackUnits) ||
    !Number.isFinite(capacity)
  ) {
    return false;
  }

  const drop = getChassisFootprint(snappedY, rackUnits);

  // 1. Bounds check (with float-tolerance).
  if (
    drop.min < -COLLISION_EPSILON ||
    drop.max > capacity * RACK_UNIT_HEIGHT + COLLISION_EPSILON
  ) {
    return false;
  }

  // 2. Overlap check against every OTHER installed chassis. Skip
  //    the dragged item itself (its footprint naturally overlaps
  //    with the candidate drop footprint if tested against itself
  //    — erroneously flagging every drag as a collision).
  for (const h of hardwareList) {
    if (h.id === draggingId) continue;

    const other = getChassisFootprint(h.position[1], h.rackUnits);

    // Two ranges overlap iff each starts before the other ends
    // (with EPSILON tolerance so edge-touching is allowed).
    if (
      drop.max > other.min + COLLISION_EPSILON &&
      drop.min < other.max - COLLISION_EPSILON
    ) {
      return false;
    }
  }

  return true;
}
