/**
 * thermalCalculations.ts
 *
 * Thermodynamic calculation engine for datacenter server rack airflow,
 * temperature rise (Delta T = 1.76 * P / CFM), blanking panel bypass recirculation,
 * and vertical thermal gradients.
 */

import { HardwareProps, HardwareType } from '../types/rack.types';
import {
  ChassisThermalData,
  USlotThermalData,
  RackThermalReport,
} from '../types/thermal.types';
import { RACK_UNIT_HEIGHT } from '../store/useConfiguratorStore';

/**
 * Estimates cooling airflow in CFM (Cubic Feet per Minute) based on chassis type and power draw.
 */
export function estimateChassisCFM(
  type: HardwareType,
  rackUnits: number,
  powerWatts: number,
): number {
  if (type === 'blank' || type === 'brush' || type === 'cable-manager') {
    return 0; // Passive blocking/brush panels move no forced air
  }

  // Base CFM floor plus dynamic fan scaling per Watt of heat dissipation
  switch (type) {
    case 'switch':
    case 'router':
    case 'firewall':
      return Math.max(15, 20 + powerWatts * 0.12);

    case 'server':
    case 'nas':
      return Math.max(30 * rackUnits, 25 * rackUnits + powerWatts * 0.18);

    case 'jbod':
    case 'kvm':
      return Math.max(25 * rackUnits, 20 * rackUnits + powerWatts * 0.15);

    case 'ups':
      return Math.max(20, 15 + powerWatts * 0.08);

    default:
      return Math.max(20, powerWatts * 0.15);
  }
}

/**
 * Calculates temperature delta across chassis using the ASHRAE air heating equation:
 * Delta T (°C) = (1.76 * Power_Watts) / Airflow_CFM
 */
export function calculateTemperatureDelta(
  powerWatts: number,
  airflowCFM: number,
): number {
  if (airflowCFM <= 0 || powerWatts <= 0) return 0;
  return (1.76 * powerWatts) / airflowCFM;
}

/**
 * Interpolates a temperature in Celsius to an RGB hex color for heatmaps.
 * Cold (<20°C: Cyan) -> Optimal (25°C: Emerald) -> Warm (32°C: Yellow) -> Hot (40°C: Orange) -> Critical (>50°C: Red/Magenta)
 */
export function getThermalColor(tempC: number): string {
  if (tempC <= 20) return '#06b6d4'; // Cyan
  if (tempC <= 26) return '#10b981'; // Emerald Green
  if (tempC <= 34) return '#eab308'; // Amber Yellow
  if (tempC <= 44) return '#f97316'; // Orange
  if (tempC <= 55) return '#ef4444'; // Red
  return '#d946ef'; // Magenta (Critical Overheating)
}

export interface ThermalEvaluationOptions {
  rackId?: string;
  capacity?: number;
  ambientColdAisleTempC?: number;
}

/**
 * Full thermodynamic evaluation of a rack's thermal performance and hot-air recirculation.
 */
export function evaluateRackThermal(
  installedHardware: HardwareProps[],
  options: ThermalEvaluationOptions = {},
): RackThermalReport {
  const rackId = options.rackId || 'rack-default';
  const capacity = options.capacity || 42;
  const ambientColdAisleTempC = options.ambientColdAisleTempC ?? 20.0;

  // Build slot occupancy map (1-indexed U1 to U42)
  interface SlotInfo {
    uSlot: number;
    isOccupied: boolean;
    isCoveredByBlank: boolean;
    hardware: HardwareProps | null;
  }

  const slotMap: SlotInfo[] = Array.from({ length: capacity }, (_, i) => ({
    uSlot: i + 1,
    isOccupied: false,
    isCoveredByBlank: false,
    hardware: null,
  }));

  installedHardware.forEach((h) => {
    // Determine bottom U index from rack-local position
    const bottom = h.position[1] - (h.rackUnits * RACK_UNIT_HEIGHT) / 2;
    const uStart = Math.max(1, Math.round(bottom / RACK_UNIT_HEIGHT) + 1);
    const uEnd = Math.min(capacity, uStart + h.rackUnits - 1);
    const isBlank = h.type === 'blank' || h.type === 'brush';

    for (let u = uStart; u <= uEnd; u++) {
      const idx = u - 1;
      if (idx >= 0 && idx < capacity) {
        slotMap[idx].isOccupied = true;
        slotMap[idx].isCoveredByBlank = isBlank;
        slotMap[idx].hardware = h;
      }
    }
  });

  const openUnblankedSlotsCount = slotMap.filter(
    (s) => !s.isOccupied && !s.isCoveredByBlank,
  ).length;

  let totalAirflowCFM = 0;
  let maxExhaustTempC = ambientColdAisleTempC;
  let maxInletTempC = ambientColdAisleTempC;
  let sumExhaust = 0;
  let activeCount = 0;
  let hasThrottlingCritical = false;

  // Evaluate each installed chassis
  const chassisThermals: ChassisThermalData[] = installedHardware.map((h) => {
    const isPassive = h.type === 'blank' || h.type === 'brush';
    const cfm = isPassive ? 0 : estimateChassisCFM(h.type, h.rackUnits, h.powerDraw);
    const deltaT = isPassive ? 0 : calculateTemperatureDelta(h.powerDraw, cfm);

    // Calculate localized hot-air recirculation penalty
    const bottom = h.position[1] - (h.rackUnits * RACK_UNIT_HEIGHT) / 2;
    const uStart = Math.max(1, Math.round(bottom / RACK_UNIT_HEIGHT) + 1);
    const uEnd = Math.min(capacity, uStart + h.rackUnits - 1);

    // Check open slots immediately above or below (+-2 U)
    let nearbyOpenSlots = 0;
    for (let u = Math.max(1, uStart - 2); u <= Math.min(capacity, uEnd + 2); u++) {
      const slot = slotMap[u - 1];
      if (!slot.isOccupied && !slot.isCoveredByBlank) {
        nearbyOpenSlots++;
      }
    }

    const localPenalty = isPassive ? 0 : Math.min(10.0, nearbyOpenSlots * 2.5);
    const globalPenalty = isPassive ? 0 : Math.min(3.0, openUnblankedSlotsCount * 0.2);
    const recirculationPenaltyC = Number((localPenalty + globalPenalty).toFixed(1));

    const inletTempC = Number((ambientColdAisleTempC + recirculationPenaltyC).toFixed(1));
    const exhaustTempC = Number((inletTempC + deltaT).toFixed(1));

    const isThermalThrottling = inletTempC > 35.0 || exhaustTempC > 55.0;
    if (isThermalThrottling) hasThrottlingCritical = true;

    if (!isPassive) {
      totalAirflowCFM += cfm;
      if (exhaustTempC > maxExhaustTempC) maxExhaustTempC = exhaustTempC;
      if (inletTempC > maxInletTempC) maxInletTempC = inletTempC;
      sumExhaust += exhaustTempC;
      activeCount++;
    }

    return {
      hardwareId: h.id,
      hardwareType: h.type,
      rackUnits: h.rackUnits,
      powerWatts: h.powerDraw,
      airflowCFM: Number(cfm.toFixed(1)),
      inletTempC,
      exhaustTempC,
      deltaTempC: Number(deltaT.toFixed(1)),
      recirculationPenaltyC,
      isThermalThrottling,
    };
  });

  const averageExhaustTempC =
    activeCount > 0 ? Number((sumExhaust / activeCount).toFixed(1)) : ambientColdAisleTempC;

  // Build vertical 1U to 42U temperature gradient
  const uGradients: USlotThermalData[] = slotMap.map((slot) => {
    if (slot.hardware) {
      const ct = chassisThermals.find((c) => c.hardwareId === slot.hardware!.id);
      return {
        uSlot: slot.uSlot,
        isOccupied: slot.isOccupied,
        isCoveredByBlank: slot.isCoveredByBlank,
        hardwareId: slot.hardware.id,
        inletTempC: ct ? ct.inletTempC : ambientColdAisleTempC,
        exhaustTempC: ct ? ct.exhaustTempC : ambientColdAisleTempC,
      };
    }

    // Open unpopulated slot
    return {
      uSlot: slot.uSlot,
      isOccupied: false,
      isCoveredByBlank: false,
      hardwareId: null,
      inletTempC: ambientColdAisleTempC,
      exhaustTempC: ambientColdAisleTempC + (openUnblankedSlotsCount > 0 ? 4.0 : 0),
    };
  });

  return {
    rackId,
    ambientColdAisleTempC,
    maxExhaustTempC,
    maxInletTempC,
    averageExhaustTempC,
    totalAirflowCFM: Number(totalAirflowCFM.toFixed(1)),
    openUnblankedSlotsCount,
    hasRecirculationWarning: openUnblankedSlotsCount > 0 && installedHardware.length > 0,
    hasThrottlingCritical,
    chassisThermals,
    uGradients,
  };
}
