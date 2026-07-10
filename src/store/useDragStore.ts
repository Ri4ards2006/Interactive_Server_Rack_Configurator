/**
 * useDragStore.ts
 *
 * Transient drag coordination store. Lives SEPARATE from the main
 * `useConfiguratorStore` on purpose: while a piece of hardware is
 * being dragged, this holds the snap target position, geometry
 * hints, AND a validity flag so scene-level components (like
 * DropIndicator) can react without re-rendering the persistent state.
 *
 * Design rule (per the blueprint):
 *   NEVER put drag state into the main `useConfiguratorStore`.
 *   Use this store instead.
 *
 * Why a separate store and not a Context / ref / window event?
 * - Zustand subscriptions are stable and selective (cheap re-renders).
 * - Each subscription reads via a tight selector, so a single
 *   DropIndicator re-renders only on drag-snapshot changes.
 * - Cleanly testable & devtools-inspectable.
 */

import { create } from 'zustand';
import { RACK_UNIT_HEIGHT } from './useConfiguratorStore';
import type { Vec3 } from '../types/rack.types';

export interface DragSnapshot {
  /** True while a pointer-down on hardware is holding and moving. */
  isDragging: boolean;
  /** ID of the hardware currently being dragged, if any. */
  draggingId: string | null;
  /** Last snapped drop position (rack-local coords). */
  dropPosition: Vec3 | null;
  /** Vertical extent of the dragged item — for size-matching the indicator. */
  rackUnits: number;
  /** Depth extent of the dragged item — for size-matching the indicator. */
  depth: number;
  /**
   * Whether the current `dropPosition` is a valid drop site —
   * i.e. it does NOT clip rack boundaries AND does NOT collide with
   * another piece of hardware already installed.
   *
   * Defaulted to `true` so legacy callers that only pass `(position)`
   * (and don't compute validity themselves) still render the
   * indicator as valid. Server.tsx will flip this to `false` when
   * the user attempts to drop on an occupied or out-of-bounds slot,
   * so DropIndicator can recolor itself.
   */
  isValid: boolean;
}

interface DragActions {
  beginDrag: (params: {
    id: string;
    rackUnits: number;
    depth: number;
  }) => void;
  /**
   * Update the in-flight drop target. `isValid` is optional and
   * defaults to `true` so callers that haven't yet wired up their
   * own collision logic don't have to pass it.
   */
  updateDropPosition: (position: Vec3, isValid?: boolean) => void;
  endDrag: () => void;
}

type DragStore = DragSnapshot & DragActions;

export const useDragStore = create<DragStore>((set) => ({
  isDragging: false,
  draggingId: null,
  dropPosition: null,
  rackUnits: 1,
  depth: 0.6,
  isValid: true,

  beginDrag: ({ id, rackUnits, depth }) =>
    set({
      isDragging: true,
      draggingId: id,
      // Seed with a sensible default position (centered on first U-slot)
      // so the indicator doesn't pop in at the origin frame.
      dropPosition: [0, (rackUnits * RACK_UNIT_HEIGHT) / 2, 0],
      rackUnits,
      depth,
      isValid: true,
    }),

  // Default `isValid = true` keeps any current caller (including
  // Server.tsx, which writes here on every pointermove) compatible
  // until collision logic is added in Server.tsx in a follow-up.
  updateDropPosition: (position, isValid = true) =>
    set({ dropPosition: position, isValid }),

  endDrag: () =>
    set({
      isDragging: false,
      draggingId: null,
      dropPosition: null,
      isValid: true,
    }),
}));
