/**
 * Global Zustand store for the Interactive Server Rack Configurator.
 *
 * Architectural notes:
 * - The data shape (`capacity`, `installedHardware`) is inherited from
 *   `RackState` — the documented persistence shape — so the runtime
 *   store and any future save/load format cannot drift apart.
 * - UI-only state (`selectedHardwareId`) and mutators live on
 *   `ConfiguratorState`. They are NOT persisted by design.
 * - Transient drag state is intentionally kept OUT of this store. R3F
 *   pointer events update local component state 60×/sec, while finalized
 *   position commits go through `updateHardwarePosition`. This prevents
 *   the entire canvas tree from re-rendering on every drag frame.
 * - `RACK_UNIT_HEIGHT` is exported as the single source of truth for 1U
 *   geometry math. Components import this instead of redefining locally.
 */

import { create } from 'zustand';
import {
  HardwareType,
  RackState,
  Vec3,
} from '../types/rack.types';

/** 1U height in meters (~4.445 cm, the EIA-310 standard). */
export const RACK_UNIT_HEIGHT = 0.04445;

/**
 * Runtime Zustand state: persisted rack data + ephemeral UI state + mutators.
 * Extends `RackState` to keep the data shape in lockstep across the codebase.
 */
export interface ConfiguratorState extends RackState {
  /** ID of the hardware currently selected (clicked) by the user, if any. */
  selectedHardwareId: string | null;

  // -- Mutators ----------------------------------------------------------

  /** Append a new piece of hardware at a sensible default location. */
  addHardware: (type: HardwareType, rackUnits: number) => void;

  /** Remove a piece of hardware. Clears selection if it was the selected item. */
  removeHardware: (id: string) => void;

  /** Commit a new position (e.g. after a drag). Expects already-snapped coords. */
  updateHardwarePosition: (id: string, position: Vec3) => void;

  /** Set / clear the active selection (used by click + Escape). */
  selectHardware: (id: string | null) => void;
}

/**
 * Safe UUID generator. Falls back gracefully in environments without
 * `crypto.randomUUID` (older Safari, some SSR runtimes, older Node).
 */
const generateId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const useConfiguratorStore = create<ConfiguratorState>((set) => ({
  capacity: 42,
  installedHardware: [],
  selectedHardwareId: null,

  addHardware: (type, rackUnits) =>
    set((state) => ({
      installedHardware: [
        ...state.installedHardware,
        {
          id: generateId(),
          type,
          rackUnits,
          powerDraw: Math.floor(Math.random() * 500) + 100,
          depth: 0.6,
          position: [0, (rackUnits * RACK_UNIT_HEIGHT) / 2, 0],
        },
      ],
    })),

  removeHardware: (id) =>
    set((state) => ({
      installedHardware: state.installedHardware.filter((h) => h.id !== id),
      selectedHardwareId:
        state.selectedHardwareId === id ? null : state.selectedHardwareId,
    })),

  updateHardwarePosition: (id, position) =>
    set((state) => ({
      installedHardware: state.installedHardware.map((h) =>
        h.id === id ? { ...h, position } : h,
      ),
    })),

  selectHardware: (id) => set({ selectedHardwareId: id }),
}));
