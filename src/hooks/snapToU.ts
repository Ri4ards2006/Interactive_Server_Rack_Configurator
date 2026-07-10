/**
 * snapToU.ts
 *
 * Pure-math helper that snaps a world-space Y value to the nearest
 * VALID chassis-center tick for a chassis of the given `rackUnits`.
 *
 * Lives in its own module (no React / R3F / Zustand imports) so it is
 * trivially unit-testable in a plain Vitest Node environment — the
 * `useHardwareInteraction` hook imports it from here rather than
 * defining it inline.
 *
 * Slot-alignment convention
 * -------------------------
 * - **Odd `rackUnits` (1U, 3U, 5U …)**: the chassis has ODD height,
 *   so its center sits at a HALF-U offset — i.e. exactly on a slot
 *   center (e.g. `0.5U`, `1.5U`, `2.5U`). Anchoring to slot centers
 *   means a 1U chassis always perfectly fills one slot.
 * - **Even `rackUnits` (2U, 4U, 6U …)**: the chassis has EVEN
 *   height, so its center sits on an INTEGER-U boundary — i.e.
 *   exactly on a slot seam (e.g. `0`, `U`, `2U`). Anchoring to
 *   slot seams means a 2U chassis always perfectly straddles
 *   exactly two adjacent slots with equal extents above and below
 *   the center.
 *
 * This mirrors the existing `addHardware` default
 * (`position[1] = (rackUnits * U) / 2`) so freshly added and
 * freshly dragged chassis end up at identical alignment. Without
 * this, 1U chassis would snap onto slot seams (an off-by-half-U bug)
 * and visibly drift higher than their neighbours.
 *
 * The "shift `y` by halfU before Math.round" trick for odd rackUnits
 * is intentional: `Math.round(0.5) === 1` in JS (half rounds toward
 * +∞), so without the shift an exact hit on a slot centre (e.g. a
 * freshly-added 1U chassis at `y = 0.5U`) would round UP to slot 1.
 *
 * Pure function: no allocations beyond primitives.
 */

import { RACK_UNIT_HEIGHT } from '../store/useConfiguratorStore';

/**
 * Snap a world-space Y value to the nearest valid chassis-center
 * tick for a chassis of the given `rackUnits`.
 */
export function snapToU(y: number, rackUnits: number): number {
  const u = RACK_UNIT_HEIGHT;
  const halfU = u / 2;
  if (rackUnits % 2 === 1) {
    // Odd: centre sits at slot centres (0.5U, 1.5U, 2.5U, …).
    // Shift `y` by -halfU so Math.round references a slot-INDEX
    // (0, 1, 2, …) rather than a slot-seam index (0, 1, 2, …). This
    // keeps a `y` that exactly hits a slot centre from being
    // mis-rounded to the next higher slot.
    const slotIndex = Math.round((y - halfU) / u);
    return slotIndex * u + halfU;
  }
  // Even: centre sits on slot seams (0, U, 2U, …). Straight round.
  return Math.round(y / u) * u;
}
