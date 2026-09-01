/**
 * electricalCalculations.ts
 *
 * Physics & mathematical engine for 3-Phase PDU load balancing,
 * phase current calculation, IEEE/ANSI phase imbalance,
 * NEC 80% continuous safety thresholds, and A/B feed failover simulation.
 */

import { HardwareProps } from '../types/rack.types';
import {
  PDUFeedId,
  PDUPhase,
  VoltageStandard,
  BreakerRating,
  FeedFailoverMode,
  PDUPhaseReport,
  PDUFeedReport,
  RackElectricalEvaluation,
  VOLTAGE_STANDARDS,
} from '../types/electrical.types';

export const NOMINAL_POWER_FACTOR = 0.95;
export const NEC_CONTINUOUS_LOAD_FACTOR = 0.80;
export const PHASES: PDUPhase[] = ['L1', 'L2', 'L3'];

/**
 * Calculates RMS AC current in Amperes given power in Watts, line-to-neutral voltage, and power factor.
 * Formula: I = P / (V * PF)
 */
export function calculatePhaseCurrent(
  powerWatts: number,
  phaseVoltage: number,
  powerFactor: number = NOMINAL_POWER_FACTOR,
): number {
  if (phaseVoltage <= 0 || powerFactor <= 0) return 0;
  return powerWatts / (phaseVoltage * powerFactor);
}

/**
 * Calculates the percentage phase imbalance using the IEEE/ANSI standard definition:
 * Imbalance (%) = (max deviation from average / average current) * 100%
 */
export function calculatePhaseImbalance(
  i1: number,
  i2: number,
  i3: number,
): number {
  const avg = (i1 + i2 + i3) / 3;
  if (avg <= 0.0001) return 0;

  const maxDev = Math.max(
    Math.abs(i1 - avg),
    Math.abs(i2 - avg),
    Math.abs(i3 - avg),
  );

  return (maxDev / avg) * 100;
}

export interface ElectricalEvaluationOptions {
  rackId?: string;
  voltageStandard?: VoltageStandard;
  breakerRating?: BreakerRating;
  failoverMode?: FeedFailoverMode;
  powerFactor?: number;
}

/**
 * Full electrical evaluation of a rack's installed hardware load across
 * 3-phase PDU Feed A and Feed B, including failover stress testing.
 */
export function evaluateRackElectrical(
  installedHardware: HardwareProps[],
  options: ElectricalEvaluationOptions = {},
): RackElectricalEvaluation {
  const rackId = options.rackId || 'rack-default';
  const voltageStandard = options.voltageStandard || 'EU-230V-400V';
  const breakerRating = options.breakerRating || 32;
  const failoverMode = options.failoverMode || 'normal';
  const powerFactor = options.powerFactor || NOMINAL_POWER_FACTOR;

  const vSpec = VOLTAGE_STANDARDS[voltageStandard];
  const phaseVoltage = vSpec.phaseVoltage;
  const lineVoltage = vSpec.lineVoltage;
  const continuousLimit = breakerRating * NEC_CONTINUOUS_LOAD_FACTOR;

  // Aggregate phase powers (in Watts) for Feed A and Feed B
  const phaseWattsA: Record<PDUPhase, number> = { L1: 0, L2: 0, L3: 0 };
  const phaseWattsB: Record<PDUPhase, number> = { L1: 0, L2: 0, L3: 0 };

  let totalRackPowerWatts = 0;

  // Distribute chassis across alternating 3-phase outlets
  installedHardware.forEach((chassis, idx) => {
    const power = chassis.powerDraw || 0;
    totalRackPowerWatts += power;

    // Distribute phases cyclically across outlets
    const phaseA: PDUPhase = PHASES[idx % 3];
    const phaseB: PDUPhase = PHASES[(idx + 1) % 3];

    if (failoverMode === 'normal') {
      // 50/50 dual-corded load sharing
      phaseWattsA[phaseA] += power * 0.5;
      phaseWattsB[phaseB] += power * 0.5;
    } else if (failoverMode === 'failover-feed-a-down') {
      // Feed A lost -> 100% shifted to Feed B
      phaseWattsB[phaseB] += power;
    } else if (failoverMode === 'failover-feed-b-down') {
      // Feed B lost -> 100% shifted to Feed A
      phaseWattsA[phaseA] += power;
    }
  });

  // Build Phase Reports for a feed
  const buildFeedReport = (
    feedId: PDUFeedId,
    label: string,
    isFeedFailed: boolean,
    phaseWatts: Record<PDUPhase, number>,
  ): PDUFeedReport => {
    const phases: Record<PDUPhase, PDUPhaseReport> = {} as any;
    let totalFeedPower = 0;
    let maxAmps = 0;
    let hasTrip = false;
    let hasOverload = false;

    PHASES.forEach((phase) => {
      const watts = isFeedFailed ? 0 : phaseWatts[phase];
      totalFeedPower += watts;
      const amps = calculatePhaseCurrent(watts, phaseVoltage, powerFactor);
      if (amps > maxAmps) maxAmps = amps;

      const utilPct = (amps / breakerRating) * 100;
      const isContOverload = amps > continuousLimit;
      const isTripped = amps > breakerRating;

      if (isContOverload) hasOverload = true;
      if (isTripped) hasTrip = true;

      phases[phase] = {
        phase,
        powerWatts: Number(watts.toFixed(1)),
        currentAmps: Number(amps.toFixed(2)),
        utilizationPct: Number(utilPct.toFixed(1)),
        isContinuousOverload: isContOverload,
        isBreakerTripped: isTripped,
      };
    });

    const currentL1 = phases.L1.currentAmps;
    const currentL2 = phases.L2.currentAmps;
    const currentL3 = phases.L3.currentAmps;
    const imbalancePct = isFeedFailed
      ? 0
      : calculatePhaseImbalance(currentL1, currentL2, currentL3);

    return {
      feedId,
      label,
      status: isFeedFailed ? 'failed' : hasTrip ? 'tripped' : 'online',
      totalPowerWatts: Number(totalFeedPower.toFixed(1)),
      phases,
      phaseImbalancePct: Number(imbalancePct.toFixed(1)),
      maxPhaseAmps: Number(maxAmps.toFixed(2)),
      isFeedOverloaded: hasOverload,
      hasTrip,
    };
  };

  const feedA = buildFeedReport(
    'feed-a',
    'Feed A (Primary PDU)',
    failoverMode === 'failover-feed-a-down',
    phaseWattsA,
  );

  const feedB = buildFeedReport(
    'feed-b',
    'Feed B (Secondary PDU)',
    failoverMode === 'failover-feed-b-down',
    phaseWattsB,
  );

  // Check redundancy viability without infinite recursion
  let isRedundancyIntact = true;
  if (failoverMode === 'normal') {
    const testFailoverA = evaluateRackElectrical(installedHardware, {
      ...options,
      failoverMode: 'failover-feed-a-down',
    });
    const testFailoverB = evaluateRackElectrical(installedHardware, {
      ...options,
      failoverMode: 'failover-feed-b-down',
    });
    isRedundancyIntact =
      !testFailoverA.feedB.hasTrip && !testFailoverB.feedA.hasTrip;
  }

  const worstImbalancePct = Math.max(
    feedA.phaseImbalancePct,
    feedB.phaseImbalancePct,
  );
  const hasOverloadWarning = feedA.isFeedOverloaded || feedB.isFeedOverloaded;
  const hasBreakerTrip = feedA.hasTrip || feedB.hasTrip;

  return {
    rackId,
    voltageStandard,
    phaseVoltage,
    lineVoltage,
    breakerRating,
    continuousCurrentLimitAmps: continuousLimit,
    failoverMode,
    totalRackPowerWatts: Number(totalRackPowerWatts.toFixed(1)),
    feedA,
    feedB,
    isRedundancyIntact,
    worstImbalancePct,
    hasOverloadWarning,
    hasBreakerTrip,
  };
}

