/**
 * rackLayout.ts
 *
 * Pure rack layout math, decoupled from React / R3F / Zustand so it
 * can be unit-tested in a plain Vitest Node environment
 * (no `useThree`, no store, no DOM).
 *
 * Lives beside `src/hooks/snapToU.ts` (which provides the snap math
 * — the other half of the rack layout pipeline). Both are pure
 * functions consumed by `useHardwareInteraction` and any future
 * features that need rack-aware geometry (e.g. keyboard nudge,
 * save/load validation, layout audit tools).
 *
 * Owns:
 *   - `COLLISION_EPSILON`: float-precision tolerance used so two
 *     chassis sitting flush at a slot seam don't falsely collide.
 *   - `checkDropValidity`: the bounds + collision check that
 *     decides whether a candidate drop target is installable.
 */

import { RACK_UNIT_HEIGHT } from '../store/useConfiguratorStore';
import type { HardwareProps } from '../types/rack.types';

/**
 * Float-precision tolerance for Y-range overlap tests.
 *
 * A sub-millimetre epsilon lets two correctly-aligned chassis whose
 * EDGES touch at a slot seam report VALID (mirroring the EIA-310
 * convention of chassis sitting flush against their neighbour's
 * edge) while still flagging genuine overlaps. Set higher than
 * IEEE-754 representation noise but lower than any meaningful
 * chassis overlap.
 */
export const COLLISION_EPSILON = 0.001;

/**
 * Decide whether a hardware drop is valid:
 *   1. The dragged chassis's vertical range must fit inside the rack
 *      bounds (i.e. not overhang the floor or the rack's top edge).
 *   2. The dragged chassis's vertical range must not overlap any
 *      OTHER already-installed hardware's vertical range.
 *
 * `position[1]` is the chassis's vertical CENTER (matching the
 * `addHardware` default `(rackUnits * U) / 2` and `snapToU` output).
 * Each chassis therefore spans `(position[1] +/- rackUnits * U / 2)`.
 *
 * Floating-point range comparison handles the two chassis-alignment
 * conventions without integer-slot indexing:
 *   - `addHardware` puts chassis centres at slot centres
 *     (`U/2`, `1.5U`, …) for ODD `rackUnits`, and on slot seams
 *     (`0`, `U`, `2U`, …) for EVEN `rackUnits`.
 *   - `snapToU` snaps drag candidates to identical conventions.
 *
 * The `COLLISION_EPSILON` floats the overlap test by 1 mm so that
 * (a) IEEE 754 representation noise doesn't trigger spurious
 * collisions, and (b) two perfectly-adjacent chassis whose edges
 * touch at a slot seam report VALID.
 */
export function checkDropValidity(
  draggingId: string,
  snappedY: number,
  rackUnits: number,
  capacity: number,
  hardwareList: HardwareProps[],
): boolean {
  const halfHeight = (rackUnits * RACK_UNIT_HEIGHT) / 2;
  const dropMin = snappedY - halfHeight;
  const dropMax = snappedY + halfHeight;

  // 1. Bounds check (with float-tolerance).
  if (
    dropMin < -COLLISION_EPSILON ||
    dropMax > capacity * RACK_UNIT_HEIGHT + COLLISION_EPSILON
  ) {
    return false;
  }

  // 2. Overlap check against every OTHER installed chassis. Skip
  //    the dragged item itself (its range naturally overlaps with
  //    the candidate drop range if tested against itself — that
  //    would erroneously flag every drag as a collision).
  for (const h of hardwareList) {
    if (h.id === draggingId) continue;

    const otherHalfHeight = (h.rackUnits * RACK_UNIT_HEIGHT) / 2;
    const otherMin = h.position[1] - otherHalfHeight;
    const otherMax = h.position[1] + otherHalfHeight;

    // Two ranges overlap iff each starts before the other ends
    // (with EPSILON tolerance so edge-touching is allowed).
    if (
      dropMax > otherMin + COLLISION_EPSILON &&
      dropMin < otherMax - COLLISION_EPSILON
    ) {
      return false;
    }
  }

  return true;
}
