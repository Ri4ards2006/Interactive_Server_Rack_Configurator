/**
 * rackLint.ts
 *
 * Headless datacenter rack compliance linter engine for CI/CD pipelines.
 * Validates collision physics, U-boundaries, NEC 80% electrical safety,
 * cable bend radii, hot-air thermal bypass, and Center-of-Gravity (CoG) stability.
 *
 * Framework-agnostic with zero browser/DOM/WebGL dependencies.
 */

import type { RackInstance, HardwareProps, CableProps, HardwareType } from '../types/rack.types';
import { RACK_UNIT_HEIGHT } from '../store/useConfiguratorStore';
import { evaluateRackElectrical } from '../utils/electricalCalculations';
import { evaluateRackThermal } from '../utils/thermalCalculations';
import { getChassisSlotRange } from '../utils/exporters/bomExporter';

export type LintCode =
  | 'ERR_COLLISION'
  | 'ERR_OUT_OF_BOUNDS'
  | 'ERR_PDU_OVERLOAD'
  | 'ERR_BEND_RADIUS'
  | 'WARN_THERMAL_BYPASS'
  | 'WARN_TOP_HEAVY';

export type LintSeverity = 'ERROR' | 'WARNING';

export interface LintIssue {
  code: LintCode;
  severity: LintSeverity;
  rackId: string;
  rackName: string;
  message: string;
  hardwareId?: string;
  details?: Record<string, any>;
}

export interface RackLintSummary {
  totalRacks: number;
  totalChassis: number;
  totalWatts: number;
  centerOfGravityMeters: number;
  isStableCoG: boolean;
}

export interface LintResult {
  valid: boolean; // true if 0 errors
  errorCount: number;
  warningCount: number;
  issues: LintIssue[];
  summary: RackLintSummary;
}

/**
 * Estimates physical mass in kg based on chassis type and rack unit height.
 */
export function estimateDeviceMassKg(type: HardwareType, rackUnits: number): number {
  switch (type) {
    case 'ups':
      return 18 * rackUnits; // ~36 kg for 2U UPS
    case 'jbod':
      return 7 * rackUnits; // ~28 kg for 4U JBOD
    case 'server':
      return 8.5 * rackUnits; // ~17 kg for 2U server, ~34 kg for 4U GPU node
    case 'nas':
      return 6 * rackUnits;
    case 'switch':
    case 'router':
    case 'firewall':
      return 5 * rackUnits;
    case 'blank':
    case 'brush':
    case 'cable-manager':
      return 0.5 * rackUnits;
    default:
      return 5 * rackUnits;
  }
}

/**
 * Validates an array of RackInstances and Cables against all compliance rules.
 */
export function lintRackConfiguration(
  racks: RackInstance[],
  cables: CableProps[] = [],
): LintResult {
  const issues: LintIssue[] = [];
  let totalChassis = 0;
  let totalWatts = 0;
  let totalMass = 0;
  let weightedHeightSum = 0;

  racks.forEach((rack) => {
    const capacity = rack.capacity || 42;
    const rackMaxMeters = capacity * RACK_UNIT_HEIGHT;
    const hardwareList = rack.installedHardware || [];

    totalChassis += hardwareList.length;

    // 1. Check Collisions and Out of Bounds
    for (let i = 0; i < hardwareList.length; i++) {
      const h1 = hardwareList[i];
      totalWatts += h1.powerDraw || 0;

      const mass1 = estimateDeviceMassKg(h1.type, h1.rackUnits);
      totalMass += mass1;
      weightedHeightSum += mass1 * h1.position[1];

      const r1 = getChassisSlotRange(h1, capacity);
      const rawBottom = h1.position[1] - (h1.rackUnits * RACK_UNIT_HEIGHT) / 2;
      const rawUStart = Math.round(rawBottom / RACK_UNIT_HEIGHT) + 1;
      const rawUEnd = rawUStart + h1.rackUnits - 1;

      // Check Out of Bounds
      if (rawUStart < 1 || rawUEnd > capacity) {
        issues.push({
          code: 'ERR_OUT_OF_BOUNDS',
          severity: 'ERROR',
          rackId: rack.id,
          rackName: rack.name,
          hardwareId: h1.id,
          message: `Chassis "${h1.id}" (${h1.type}) spans U${rawUStart}-U${rawUEnd}, which exceeds the 1U-${capacity}U rack boundary.`,
          details: { uStart: rawUStart, uEnd: rawUEnd, capacity },
        });
      }

      // Check Heavy Hardware Mounted at Top (Center of Gravity Tip Hazard)
      if ((h1.type === 'ups' || h1.type === 'jbod') && r1.uStart > 24) {
        issues.push({
          code: 'WARN_TOP_HEAVY',
          severity: 'WARNING',
          rackId: rack.id,
          rackName: rack.name,
          hardwareId: h1.id,
          message: `High center-of-gravity tip hazard: Heavy unit "${h1.id}" (${h1.type}, ${mass1}kg) mounted high at ${r1.slotRange}. UPS and storage shelves should be installed below U10.`,
          details: { slotRange: r1.slotRange, massKg: mass1 },
        });
      }

      // Check Pairwise Collisions
      for (let j = i + 1; j < hardwareList.length; j++) {
        const h2 = hardwareList[j];
        const r2 = getChassisSlotRange(h2, capacity);

        const overlaps = Math.max(r1.uStart, r2.uStart) <= Math.min(r1.uEnd, r2.uEnd);
        if (overlaps) {
          issues.push({
            code: 'ERR_COLLISION',
            severity: 'ERROR',
            rackId: rack.id,
            rackName: rack.name,
            hardwareId: h1.id,
            message: `Physical collision detected between "${h1.id}" (${r1.slotRange}) and "${h2.id}" (${r2.slotRange}).`,
            details: { chassisA: h1.id, rangeA: r1.slotRange, chassisB: h2.id, rangeB: r2.slotRange },
          });
        }
      }
    }

    // 2. Check Electrical PDU Overloads
    const elecReport = evaluateRackElectrical(hardwareList, { rackId: rack.id });
    if (elecReport.hasBreakerTrip) {
      issues.push({
        code: 'ERR_PDU_OVERLOAD',
        severity: 'ERROR',
        rackId: rack.id,
        rackName: rack.name,
        message: `CRITICAL PDU OVERLOAD: Breaker trip condition on "${rack.name}". Maximum phase current exceeds breaker rating.`,
        details: { maxPhaseAmps: Math.max(elecReport.feedA.maxPhaseAmps, elecReport.feedB.maxPhaseAmps) },
      });
    } else if (elecReport.hasOverloadWarning) {
      issues.push({
        code: 'ERR_PDU_OVERLOAD',
        severity: 'ERROR',
        rackId: rack.id,
        rackName: rack.name,
        message: `NEC 80% RULE VIOLATION: Continuous electrical load on "${rack.name}" exceeds 80% breaker safety threshold.`,
      });
    }

    // 3. Check Thermal Bypass Warnings
    const thermReport = evaluateRackThermal(hardwareList, { rackId: rack.id, capacity });
    if (thermReport.hasRecirculationWarning) {
      issues.push({
        code: 'WARN_THERMAL_BYPASS',
        severity: 'WARNING',
        rackId: rack.id,
        rackName: rack.name,
        message: `Hot-air bypass recirculation warning on "${rack.name}": ${thermReport.openUnblankedSlotsCount} unpopulated U-slots allow hot exhaust air into server intakes. Blanking panels recommended.`,
        details: { openSlots: thermReport.openUnblankedSlotsCount },
      });
    }
  });

  // 4. Check Cable Bend Radii
  cables.forEach((c) => {
    if (c.hasBendViolation) {
      issues.push({
        code: 'ERR_BEND_RADIUS',
        severity: 'ERROR',
        rackId: 'cables',
        rackName: 'Inter-rack Patching',
        message: `Bend radius violation on patch cable "${c.id}" (${c.type}). Bend radius is below manufacturer physical limits.`,
        details: { cableId: c.id, from: c.fromDevice, to: c.toDevice },
      });
    }
  });

  const errorCount = issues.filter((i) => i.severity === 'ERROR').length;
  const warningCount = issues.filter((i) => i.severity === 'WARNING').length;
  const CoGHeightMeters = totalMass > 0 ? Number((weightedHeightSum / totalMass).toFixed(3)) : 0;
  const avgRackMax = (racks[0]?.capacity || 42) * RACK_UNIT_HEIGHT;
  const isStableCoG = CoGHeightMeters <= 0.55 * avgRackMax;

  return {
    valid: errorCount === 0,
    errorCount,
    warningCount,
    issues,
    summary: {
      totalRacks: racks.length,
      totalChassis,
      totalWatts,
      centerOfGravityMeters: CoGHeightMeters,
      isStableCoG,
    },
  };
}
