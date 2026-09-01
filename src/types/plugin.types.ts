/**
 * plugin.types.ts
 *
 * Strict TypeScript schema for the extensible Hardware Plugin Architecture.
 * Allows vendor hardware definitions (specs, geometry, thermal, ports,
 * interactive behavior) to be registered dynamically at runtime.
 */

import type { HardwareType, PortProps, Vec3 } from './rack.types';

export type HardwareCategory =
  | 'compute'
  | 'networking'
  | 'storage'
  | 'airflow'
  | 'auxiliary';

export type PortType =
  | 'rj45_1g'
  | 'rj45_10g'
  | 'sfp_plus'
  | 'sfp28'
  | 'qsfp28_100g'
  | 'c13_power'
  | 'c19_power'
  | 'console';

export interface PortDefinition {
  id: string;
  label: string;
  type: PortType;
  face: 'front' | 'rear';
  relativePosition: Vec3; // [x, y, z] relative to chassis center
  maxSpeedGbps?: number;
}

export interface ThermalProfile {
  idlePowerWatts: number;
  maxPowerWatts: number;
  targetDeltaTCelsius: number;
  airflowDirection: 'front-to-back' | 'back-to-front' | 'passive';
  fanRpmRange?: [number, number];
}

export interface VisualMeshDefinition {
  chassisColor: string;
  bezelColor: string;
  accentColor?: string;
  ledPositions?: Array<{
    color: string;
    position: Vec3;
    behavior: 'solid' | 'blink_activity' | 'blink_alarm';
  }>;
  gltfModelUrl?: string;
  proceduralMeshGenerator?: string;
}

export interface HardwarePluginDefinition {
  /** Unique plugin identifier, e.g. "generic:server" or "cisco:catalyst-9300" */
  id: string;
  /** Primary category type */
  type: HardwareType;
  /** Hardware vendor / manufacturer */
  vendor: string;
  /** Model / SKU string */
  model: string;
  /** Human-readable display name */
  name: string;
  /** Functional category */
  category: HardwareCategory;
  /** Default vertical height in EIA-310-D Rack Units */
  rackUnits: number;
  /** Selectable rack unit options if height is variable (e.g. [1, 2, 4]) */
  allowedRackUnits?: number[];
  /** Default chassis depth in meters */
  depthMeters: number;
  /** Default power draw in Watts */
  defaultPowerDraw: number;
  /** Weight in kilograms */
  weightKg?: number;
  /** Thermal and airflow specifications */
  thermalProfile?: ThermalProfile;
  /** Port generator function or static list */
  portsGenerator?: (depth: number, rackUnits: number) => PortProps[] | undefined;
  /** Visual theme and styling metadata */
  visual?: VisualMeshDefinition;
  /** Interactive behaviors */
  interactions?: {
    hasHotSwapDrives?: boolean;
    driveCount?: number;
    hasSlidingDrawer?: boolean;
  };
}

