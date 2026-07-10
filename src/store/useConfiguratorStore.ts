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
 * Shared chassis geometry constants. These are the source of truth for
 * every piece of hardware in the rack so adjacent chassis line up
 * perfectly regardless of type.
 *
 * - `CHASSIS_WIDTH` is the outer width of a 19" mounted chassis.
 * - `EDGE_GAP` is a tiny vertical inset subtracted from the chassis
 *   height so stacked units have a thin visible rail-seam between them.
 * - `SELECTION_OUTLINE_WIDTH` / `SELECTION_OUTLINE_INSET` describe a
 *   bounding box slightly LARGER than the chassis, used to render the
 *   cyan selection halo. Keeping these constants here means the
 *   halo can't drift away from the chassis dimensions.
 */
export const CHASSIS_WIDTH = 0.85;
export const EDGE_GAP = 0.005;
export const SELECTION_OUTLINE_WIDTH = 0.88;
export const SELECTION_OUTLINE_INSET = 0.01;

/**
 * Runtime Zustand state: persisted rack data + ephemeral UI state + mutators.
 * Extends `RackState` to keep the data shape in lockstep across the codebase.
 */
export interface ConfiguratorState extends RackState {
  /** ID of the hardware currently selected (clicked) by the user, if any. */
  selectedHardwareId: string | null;

  /**
   * Visual presentation mode for the canvas:
   *   - `'3D'`: realistic PBR rendering (default) — chassis show
   *     brushed metal, environment reflections, accent emissives.
   *   - `'blueprint'`: technical / schematic view — flat fills,
   *     sharp cyan edge outlines, no environment reflections,
   *     explicit U-tick labeling on the rails.
   *
   * UI-only state — deliberately NOT part of `RackState` so the
   * blueprint preference never leaks into a save/load format.
   */
  viewMode: '3D' | 'blueprint';

  // -- Mutators ----------------------------------------------------------

  /** Append a new piece of hardware at a sensible default location. */
  addHardware: (type: HardwareType, rackUnits: number) => void;

  /** Remove a piece of hardware. Clears selection if it was the selected item. */
  removeHardware: (id: string) => void;

  /** Commit a new position (e.g. after a drag). Expects already-snapped coords. */
  updateHardwarePosition: (id: string, position: Vec3) => void;

  /** Set / clear the active selection (used by click + Escape). */
  selectHardware: (id: string | null) => void;

  /**
   * Flip the visual presentation mode. `Scene.tsx` subscribes to
   * `viewMode` and re-positions the camera + toggles OrbitControls
   * accordingly. Each chassis component reads it to swap PBR
   * materials for the schematic palette.
   */
  toggleViewMode: () => void;
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
  viewMode: '3D',

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

  toggleViewMode: () =>
    set((state) => ({
      viewMode: state.viewMode === '3D' ? 'blueprint' : '3D',
    })),
}));
