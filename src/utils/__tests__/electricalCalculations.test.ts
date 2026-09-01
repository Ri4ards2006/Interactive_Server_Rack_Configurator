/**
 * electricalCalculations.test.ts
 *
 * Comprehensive unit test suite for 3-Phase PDU load balancing,
 * phase current RMS calculation, IEEE/ANSI phase imbalance percentage,
 * NEC 80% continuous safety thresholds, and A/B feed failover simulation.
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePhaseCurrent,
  calculatePhaseImbalance,
  evaluateRackElectrical,
  NOMINAL_POWER_FACTOR,
} from '../electricalCalculations';
import type { HardwareProps } from '../../types/rack.types';

describe('electricalCalculations — Fundamental Current Math', () => {
  it('calculates RMS AC current accurately for EU 230V and US 120V', () => {
    // I = P / (V * PF)
    // 230V with PF=0.95 -> 1000W / (230 * 0.95) = 1000 / 218.5 ≈ 4.5766 A
    const currentEU = calculatePhaseCurrent(1000, 230, 0.95);
    expect(currentEU).toBeCloseTo(4.5766, 3);

    // 120V with PF=0.95 -> 1000W / (120 * 0.95) = 1000 / 114 ≈ 8.7719 A
    const currentUS = calculatePhaseCurrent(1000, 120, 0.95);
    expect(currentUS).toBeCloseTo(8.7719, 3);
  });

  it('returns 0 Amps for zero or negative inputs', () => {
    expect(calculatePhaseCurrent(0, 230)).toBe(0);
    expect(calculatePhaseCurrent(1000, 0)).toBe(0);
    expect(calculatePhaseCurrent(1000, 230, 0)).toBe(0);
  });
});

describe('electricalCalculations — IEEE/ANSI Phase Imbalance', () => {
  it('returns 0% imbalance for perfectly balanced 3-phase loads', () => {
    expect(calculatePhaseImbalance(10.0, 10.0, 10.0)).toBe(0);
    expect(calculatePhaseImbalance(0, 0, 0)).toBe(0);
  });

  it('calculates exact phase imbalance percentage for skewed loads', () => {
    // Loads: 10A, 15A, 20A -> Avg = 15A. Max deviation = |20 - 15| = 5A -> 5/15 * 100% = 33.333%
    const imbalance = calculatePhaseImbalance(10.0, 15.0, 20.0);
    expect(imbalance).toBeCloseTo(33.333, 2);

    // Loads: 8A, 8A, 14A -> Avg = 10A. Max deviation = |14 - 10| = 4A -> 4/10 * 100% = 40.0%
    const imbalance2 = calculatePhaseImbalance(8.0, 8.0, 14.0);
    expect(imbalance2).toBeCloseTo(40.0, 2);
  });
});

describe('electricalCalculations — Full Rack Electrical Evaluation', () => {
  const mockServers: HardwareProps[] = [
    {
      id: 'srv-1',
      type: 'server',
      rackUnits: 2,
      powerDraw: 500, // 500W
      depth: 0.6,
      position: [0, 0, 0],
    },
    {
      id: 'srv-2',
      type: 'server',
      rackUnits: 2,
      powerDraw: 500, // 500W
      depth: 0.6,
      position: [0, 0.1, 0],
    },
    {
      id: 'srv-3',
      type: 'server',
      rackUnits: 2,
      powerDraw: 500, // 500W
      depth: 0.6,
      position: [0, 0.2, 0],
    },
  ];

  it('balances load across 3 phases under normal dual-corded operation', () => {
    const report = evaluateRackElectrical(mockServers, {
      voltageStandard: 'EU-230V-400V',
      breakerRating: 32,
      failoverMode: 'normal',
    });

    expect(report.totalRackPowerWatts).toBe(1500);
    expect(report.feedA.status).toBe('online');
    expect(report.feedB.status).toBe('online');
    expect(report.feedA.totalPowerWatts).toBe(750);
    expect(report.feedB.totalPowerWatts).toBe(750);
    expect(report.hasOverloadWarning).toBe(false);
    expect(report.hasBreakerTrip).toBe(false);
  });

  it('detects NEC 80% continuous overload warnings (> 80% breaker rating)', () => {
    // 32A breaker at 230V (PF=0.95): 80% continuous limit is 25.6A (≈ 5,593W per phase)
    const heavyHardware: HardwareProps[] = [
      {
        id: 'gpu-node-1',
        type: 'server',
        rackUnits: 4,
        powerDraw: 6000, // Large GPU chassis
        depth: 0.8,
        position: [0, 0, 0],
      },
    ];

    const report = evaluateRackElectrical(heavyHardware, {
      voltageStandard: 'EU-230V-400V',
      breakerRating: 16, // 16A breaker -> 80% continuous limit is 12.8A
      failoverMode: 'normal',
    });

    // In normal mode, 3000W on phase L1 -> 3000 / (230 * 0.95) = 13.73A (> 12.8A 80% limit, but < 16A)
    expect(report.feedA.phases.L1.isContinuousOverload).toBe(true);
    expect(report.feedA.phases.L1.isBreakerTripped).toBe(false);
    expect(report.hasOverloadWarning).toBe(true);
  });

  it('detects critical breaker trip condition (> 100% breaker rating)', () => {
    const extremeHardware: HardwareProps[] = [
      {
        id: 'gpu-node-1',
        type: 'server',
        rackUnits: 4,
        powerDraw: 8000,
        depth: 0.8,
        position: [0, 0, 0],
      },
    ];

    const report = evaluateRackElectrical(extremeHardware, {
      voltageStandard: 'EU-230V-400V',
      breakerRating: 16,
      failoverMode: 'normal',
    });

    // 4000W on L1 -> 4000 / (230 * 0.95) = 18.3A (> 16A breaker)
    expect(report.feedA.phases.L1.isBreakerTripped).toBe(true);
    expect(report.feedA.status).toBe('tripped');
    expect(report.hasBreakerTrip).toBe(true);
  });

  it('simulates A/B feed failover and shifts 100% load to surviving feed', () => {
    const servers: HardwareProps[] = [
      {
        id: 'srv-1',
        type: 'server',
        rackUnits: 2,
        powerDraw: 3000,
        depth: 0.6,
        position: [0, 0, 0],
      },
    ];

    // Simulate loss of Feed A
    const report = evaluateRackElectrical(servers, {
      voltageStandard: 'EU-230V-400V',
      breakerRating: 16,
      failoverMode: 'failover-feed-a-down',
    });

    expect(report.feedA.status).toBe('failed');
    expect(report.feedA.totalPowerWatts).toBe(0);
    // Feed B takes 100% of 3000W
    expect(report.feedB.totalPowerWatts).toBe(3000);
    expect(report.feedB.status).toBe('online');
  });
});

