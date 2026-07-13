/**
 * Core TypeScript definitions for the Interactive Server Rack Configurator.
 *
 * These types are kept framework-agnostic so they can be consumed by the
 * Zustand store, R3F components, and any UI overlays without circular deps.
 *
 * `RackState` is the canonical *data* shape of the rack — both runtime
 * and persisted (e.g. for save/load). The Zustand store's
 * `ConfiguratorState` extends this to add UI-only fields and mutators,
 * which guarantees the two cannot silently drift apart.
 */

/** All hardware categories that can be installed into a rack. */
export type HardwareType =
  | 'server'
  | 'switch'
  | 'router'
  | 'patch-panel'
  | 'ups'
  | 'kvm'
  | 'jbod'
  | 'blank';

/** Convenience alias for a 3D position tuple used everywhere in the scene. */
export type Vec3 = [number, number, number];

/**
 * Describes a single piece of hardware installed in the rack.
 *
 * `rackUnits` describes the vertical face height (1U, 2U, 4U, etc.)
 * and is converted to meters using `RACK_UNIT_HEIGHT` from the store.
 */
export interface HardwareProps {
  id: string;
  type: HardwareType;
  rackUnits: number;
  powerDraw: number; // Watts
  depth: number; // meters (typical server is ~0.6 m / 60 cm)
  position: Vec3; // meters, in rack-local space
}

/**
 * The minimal, serializable shape of the rack itself.
 *
 * This is the source of truth used for persistence (save/load, GROQ,
 * localStorage) AND for the runtime data fields on the Zustand store.
 * UI-only state (selection, mutators) lives on `ConfiguratorState`.
 */
export interface RackState {
  /** Total U-capacity of the rack frame (e.g. 42U for a full-sized cabinet). */
  capacity: number;

  /** All currently mounted hardware, listed in mount order (bottom → top). */
  installedHardware: HardwareProps[];
}
