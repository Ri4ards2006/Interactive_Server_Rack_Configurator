/**
 * room.types.ts
 *
 * TypeScript domain schemas for Datacenter Room Planning,
 * 600x600mm Raised Floor Grid, Cold/Hot Aisle Containment,
 * and Perimeter CRAC/CRAH Cooling Units.
 */

export type TileType = 'solid' | 'perforated-25' | 'perforated-50' | 'grate-70';

export interface RaisedFloorTile {
  xIndex: number;
  zIndex: number;
  worldX: number;
  worldZ: number;
  type: TileType;
  airflowCFM?: number;
}

export interface RoomDimensions {
  widthMeters: number; // e.g. 12m
  depthMeters: number; // e.g. 10m
  heightMeters: number; // e.g. 3.5m
  raisedFloorHeightMeters: number; // e.g. 0.6m
}

export type ContainmentType = 'cold-aisle' | 'hot-aisle' | 'none';

export interface AisleContainmentConfig {
  enabled: boolean;
  type: ContainmentType;
  roofHeightMeters: number; // e.g. 2.4m
  doorOpen: boolean;
  tintColor: string; // e.g. '#38bdf8'
}

export interface CracUnit {
  id: string;
  name: string;
  coolingKw: number; // Cooling capacity in kW (e.g. 40kW - 100kW)
  airflowCFM: number; // Airflow delivery in CFM (e.g. 6000 - 15000 CFM)
  position: [number, number, number];
  orientation: number; // Rotation in radians (e.g. 0, Math.PI/2, Math.PI, 3*Math.PI/2)
  status: 'online' | 'standby' | 'alarm';
}

export interface DataHallConfig {
  roomDimensions: RoomDimensions;
  containment: AisleContainmentConfig;
  cracUnits: CracUnit[];
  tilesOverride: Record<string, TileType>; // key: `${xIndex}_${zIndex}`
}

export interface RoomCoolingReport {
  totalItPowerKw: number;
  totalCoolingCapacityKw: number;
  coolingRedundancy: string; // e.g. 'N+1', 'N+2', 'Deficit'
  coolingReserveKw: number;
  totalCracCfm: number;
  totalItCfm: number;
  cfmSafetyMargin: number; // percentage
  status: 'healthy' | 'warning' | 'critical';
}
