/**
 * Core TypeScript definitions for the Interactive Server Rack Configurator.
 *
 * These types are kept framework-agnostic so they can be consumed by the
 * Zustand store, R3F components, and any UI overlays without circular deps.
 *
 * Supports single-rack and multi-rack bayed row layouts.
 */

import type { CableType } from './cable.types';

/** All hardware categories that can be installed into a rack. */
export type HardwareType =
  | 'server'
  | 'switch'
  | 'router'
  | 'patch-panel'
  | 'ups'
  | 'kvm'
  | 'jbod'
  | 'blank'
  | 'nas'
  | 'firewall'
  | 'brush'
  | 'cable-manager';

export type RackFrameType = '2-post' | '4-post' | 'cabinet';

/** Convenience alias for a 3D position tuple used everywhere in the scene. */
export type Vec3 = [number, number, number];

export interface PortProps {
  id: string;
  label: string;
  position: Vec3; // relative to device origin [x, y, z]
  cableId: string | null;
}

/**
 * Describes a single piece of hardware installed in a rack bay.
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
  ports?: PortProps[];
  rackId?: string; // Parent rack ID if multi-rack
}

export interface CableProps {
  id: string;
  fromDevice: string;
  fromPort: string;
  toDevice: string;
  toPort: string;
  color: string;
  type?: CableType;
  lengthMeters?: number;
  hasBendViolation?: boolean;
}

/**
 * Represents an individual rack bay instance in a multi-rack row layout.
 */
export interface RackInstance {
  id: string;
  name: string;
  capacity: number;
  rackType: RackFrameType;
  isDoorOpen: boolean;
  position: Vec3; // [x, 0, z] world origin offset
  installedHardware: HardwareProps[];
}

/**
 * The minimal, serializable shape of the multi-rack state.
 */
export interface MultiRackState {
  racks: RackInstance[];
  activeRackId: string;
  cables: CableProps[];
}

/**
 * Legacy single-rack compatibility interface.
 */
export interface RackState {
  capacity: number;
  installedHardware: HardwareProps[];
  cables: CableProps[];
}
