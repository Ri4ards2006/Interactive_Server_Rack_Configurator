/**
 * thermal.types.ts
 *
 * TypeScript domain models for datacenter rack thermodynamics,
 * CFM airflow dynamics, thermal heatmaps, and hot-air recirculation bypass penalties.
 */

export type AirflowDirection = 'front-to-back' | 'back-to-front' | 'passive';

export interface ChassisThermalData {
  hardwareId: string;
  hardwareType: string;
  rackUnits: number;
  powerWatts: number;
  airflowCFM: number;
  inletTempC: number;
  exhaustTempC: number;
  deltaTempC: number;
  recirculationPenaltyC: number;
  isThermalThrottling: boolean; // Inlet > 35°C or exhaust > 55°C
}

export interface USlotThermalData {
  uSlot: number; // 1-indexed U height (1 to 42)
  isOccupied: boolean;
  isCoveredByBlank: boolean; // blanking panel or brush panel
  hardwareId: string | null;
  inletTempC: number;
  exhaustTempC: number;
}

export interface RackThermalReport {
  rackId: string;
  ambientColdAisleTempC: number;
  maxExhaustTempC: number;
  maxInletTempC: number;
  averageExhaustTempC: number;
  totalAirflowCFM: number;
  openUnblankedSlotsCount: number;
  hasRecirculationWarning: boolean;
  hasThrottlingCritical: boolean;
  chassisThermals: ChassisThermalData[];
  uGradients: USlotThermalData[];
}
