/**
 * useHardwareInteraction.ts
 *
 * Custom hook that encapsulates EVERY shared interaction concern for a
 * piece of rack hardware:
 *
 *   - Hover state (`isHovered`) + cursor style (`grab` → `grabbing`).
 *   - Drag state (`isDragging`) + belt-and-braces window-fallback so
 *     the local + global drag state never gets stuck if the cursor
 *     leaves a chassis mid-drag.
 *   - Pointer-event handlers (`onPointerDown`, `onPointerMove`,
 *     `onPointerUp`, `onPointerCancel`, `onPointerOver`,
 *     `onPointerOut`) wired up against the R3F canvas DOM element for
 *     pointer capture (the blueprint's `e.target as Element` trick
 *     does NOT work because `e.target` here is a THREE Object3D).
 *   - Selection state (`isSelected`) via a tight Zustand selector so
 *     each chassis re-renders ONLY when its own selection flag flips.
 *   - Snap-to-U-tick math on pointermove, mirrored simultaneously
 *     to the persistent `useConfiguratorStore` AND the transient
 *     `useDragStore` (the latter for the DropIndicator ghost).
 *
 * Usage from a chassis component:
 *
 *   const { isSelected, ...handlers } = useHardwareInteraction(hardware);
 *   return <group {...handlers} position={...}>...</group>;
 *
 * Behavior is byte-equivalent to the original copies inlined in
 * Server.tsx / Switch.tsx / Router.tsx / PatchPanel.tsx — the refactor
 * just removes the duplicated boilerplate.
 */

import { useEffect, useState } from 'react';
import { type ThreeEvent, useThree } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import {
  useConfiguratorStore,
  RACK_UNIT_HEIGHT,
} from '../store/useConfiguratorStore';
import { useDragStore } from '../store/useDragStore';
import type { HardwareProps, Vec3 } from '../types/rack.types';

export interface HardwareInteraction {
  /** True while the pointer is over this chassis. */
  isHovered: boolean;
  /** True while this hardware is the currently selected item. */
  isSelected: boolean;
  /** True while this hardware is being dragged. */
  isDragging: boolean;
  /** R3F event handlers — spread onto a `<group>` to wire interactions. */
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
  onPointerCancel: (e: ThreeEvent<PointerEvent>) => void;
}

/**
 * Snap a world-space Y value to the nearest VALID chassis-center tick
 * for a chassis of the given `rackUnits`.
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
function snapToU(y: number, rackUnits: number): number {
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

/**
 * Float-precision tolerance for edge-touch checks. Allowing a
 * sub-millimetre epsilon keeps `dragged chassis exactly touches
 * neighbour chassis` from being flagged as a collision caused by
 * IEEE 754 representation noise.
 */
const COLLISION_EPSILON = 0.001;

/**
 * Decide whether a hardware drop is valid:
 *   1. The dragged chassis's vertical range must fit inside the rack
 *      bounds (i.e. not overhang the floor or the rack's top edge).
 *   2. The dragged chassis's vertical range must not overlap any
 *      OTHER already-installed hardware's vertical range.
 *
 * `position[1]` is the chassis's vertical CENTER, so each chassis
 * spans `(position[1] +/- rackUnits * U / 2)`. Floating-point range
 * comparison handles the two chassis-alignment conventions without
 * any integer-slot indexing:
 *   - `addHardware` puts chassis centres at slot centres
 *     (`U/2`, `1.5U`, …) for ODD `rackUnits`, and on slot seams
 *     (`0`, `U`, `2U`, …) for EVEN `rackUnits`.
 *   - `snapToU` now snaps drag candidates to identical conventions
 *     (slot centres for odd, slot seams for even), so a candidate
 *     and an existing chassis share one of two footprint sets
 *     (`[nU, nU+U)` for odd block, `[nU-U/2, nU+U/2)` for even
 *     block at the seam `nU`).
 *
 * The `COLLISION_EPSILON` floats the overlap test by 1 mm so that
 * (a) IEEE 754 representation noise doesn't trigger spurious
 * collisions and (b) two perfectly-adjacent chassis whose EDGES
 * touch at a slot seam (e.g. a 1U at slot 0 vs a 1U at slot 1)
 * report VALID — mirroring the EIA-310 convention of chassis
 * sitting flush against their neighbour's edge. Adjacent chassis
 * centres are `U` apart in this case, not `0.5U`.
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
  //    the candidate drop range when we test against ourselves).
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

export function useHardwareInteraction(
  hardware: HardwareProps,
): HardwareInteraction {
  const { gl } = useThree();

  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Tight selector: re-render ONLY when this specific hardware's
  // selection flag flips. Other chassis' selection changes are
  // invisible to us.
  const isSelected = useConfiguratorStore(
    (s) => s.selectedHardwareId === hardware.id,
  );

  // Cursor feedback: 'grab' on hover, 'grabbing' mid-drag. drei's
  // useCursor auto-resolves the canvas DOM element from R3F context,
  // so we don't pass it as the third arg.
  const cursorActive = isHovered || isDragging;
  const cursorStyle: 'grab' | 'grabbing' | 'auto' = isDragging
    ? 'grabbing'
    : isHovered
      ? 'grab'
      : 'auto';
  useCursor(cursorActive, cursorStyle);

  // Belt-and-braces drag release: if the cursor leaves the chassis
  // mid-drag, R3F's onPointerUp no longer fires (raycaster misses),
  // so we ALSO listen on `window` for any `pointerup`,
  // `pointercancel`, or `blur` to force the release. This prevents
  // both the local `isDragging` flag AND the global drag store from
  // getting stuck `true`.
  useEffect(() => {
    if (!isDragging) return;
    const endDrag = () => {
      setIsDragging(false);
      useDragStore.getState().endDrag();
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    window.addEventListener('blur', endDrag);
    return () => {
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      window.removeEventListener('blur', endDrag);
    };
  }, [isDragging]);

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setIsDragging(false);
    useDragStore.getState().endDrag();
    if (gl.domElement.hasPointerCapture(e.pointerId)) {
      gl.domElement.releasePointerCapture(e.pointerId);
    }
  };

  return {
    isHovered,
    isSelected,
    isDragging,

    onPointerOver(e) {
      e.stopPropagation();
      setIsHovered(true);
    },

    onPointerOut(e) {
      e.stopPropagation();
      setIsHovered(false);
    },

    onPointerDown(e) {
      e.stopPropagation();
      // Select this hardware AND publish a drag snapshot BEFORE
      // toggling local state, so the transient drag store is ready
      // by the time the first `onPointerMove` fires.
      useConfiguratorStore.getState().selectHardware(hardware.id);
      useDragStore.getState().beginDrag({
        id: hardware.id,
        rackUnits: hardware.rackUnits,
        depth: hardware.depth,
      });
      setIsDragging(true);
      // Capture the pointer on the CANVAS DOM element — not the
      // THREE Object3D that R3F's synthetic event exposes as
      // `e.target`. Without this, drag events stop firing the
      // moment the cursor leaves the chassis mesh.
      gl.domElement.setPointerCapture(e.pointerId);
    },

    onPointerMove(e) {
      // Bail unless this chassis is the active drag target.
      if (!isDragging) return;
      e.stopPropagation();

      // `rackUnits` is passed in so `snapToU` knows whether to land
      // on a slot centre (odd) or a slot seam (even) for this
      // particular chassis.
      const snappedY = snapToU(e.point.y, hardware.rackUnits);

      // Snapshot the persistent store synchronously so ALL reads
      // (current position, capacity, collision list) are consistent
      // for this single pointer-move tick — using multiple getState()
      // calls in succession would be fine but a single read here
      // makes the data relationship obvious.
      const persistent = useConfiguratorStore.getState();
      const current = persistent.installedHardware.find(
        (h) => h.id === hardware.id,
      );
      const x = current?.position[0] ?? hardware.position[0];
      const z = current?.position[2] ?? hardware.position[2];
      const nextPosition: Vec3 = [x, snappedY, z];

      // Collision + bounds check against the canonical rack state.
      // Result feeds the transient drag store so DropIndicator can
      // recolor its ghost without coupling to this component's
      // local React state.
      const isValid = checkDropValidity(
        hardware.id,
        snappedY,
        hardware.rackUnits,
        persistent.capacity,
        persistent.installedHardware,
      );

      // Commit to persistent store (drives this chassis' render so
      // it tracks the cursor even when the ghost is "invalid" — the
      // ghost is purely a visual cue and should not steal control of
      // where the chassis sits).
      persistent.updateHardwarePosition(hardware.id, nextPosition);
      // Mirror to transient drag store with the validity result.
      useDragStore.getState().updateDropPosition(nextPosition, isValid);
    },

    onPointerUp,

    // Treat `pointercancel` identically to a normal pointer-up:
    // a cancelled drag (e.g. browser scrollbar grab) still cleanly
    // tears down the pointer capture + drag store via the same path.
    onPointerCancel: onPointerUp,
  };
}
