/**
 * thermalCalculations.test.ts
 *
 * Comprehensive unit tests for datacenter rack thermodynamics,
 * CFM airflow scaling, Delta T heating, blanking panel bypass recirculation penalties,
 * and 3D thermal color mapping.
 */

import { describe, it, expect } from 'vitest';
import {
  estimateChassisCFM,
  calculateTemperatureDelta,
  getThermalColor,
  evaluateRackThermal,
} from '../thermalCalculations';
import type { HardwareProps } from '../../types/rack.types';

describe('thermalCalculations — CFM Airflow & Delta T Equations', () => {
  it('estimates appropriate CFM based on hardware category and power draw', () => {
    // Passive panels move 0 CFM
    expect(estimateChassisCFM('blank', 1, 0)).toBe(0);
    expect(estimateChassisCFM('brush', 1, 0)).toBe(0);

    // 1U switch at 50W
    const switchCFM = estimateChassisCFM('switch', 1, 50);
    expect(switchCFM).toBeGreaterThan(20);

    // 2U server at 500W moves more air than a switch
    const serverCFM = estimateChassisCFM('server', 2, 500);
    expect(serverCFM).toBeGreaterThan(switchCFM);
  });

  it('calculates Delta T accurately using ASHRAE air heating formula', () => {
    // Delta T = (1.76 * Power_Watts) / Airflow_CFM
    // For 500W at 80 CFM -> (1.76 * 500) / 80 = 880 / 80 = 11.0 °C
    const deltaT = calculateTemperatureDelta(500, 80);
    expect(deltaT).toBeCloseTo(11.0, 2);

    // Handles zero / edge cases
    expect(calculateTemperatureDelta(0, 80)).toBe(0);
    expect(calculateTemperatureDelta(500, 0)).toBe(0);
  });
});

describe('thermalCalculations — Heatmap Color Scale', () => {
  it('maps temperatures to distinct spectrum hex codes', () => {
    expect(getThermalColor(18)).toBe('#06b6d4'); // Cold Cyan
    expect(getThermalColor(24)).toBe('#10b981'); // Optimal Emerald
    expect(getThermalColor(32)).toBe('#eab308'); // Warm Yellow
    expect(getThermalColor(40)).toBe('#f97316'); // Hot Orange
    expect(getThermalColor(52)).toBe('#ef4444'); // Critical Red
    expect(getThermalColor(65)).toBe('#d946ef'); // Severe Magenta
  });
});

describe('thermalCalculations — Rack Thermal Evaluation & Recirculation', () => {
  it('evaluates sealed rack with no recirculation penalty when filled with blanks', () => {
    const installed: HardwareProps[] = [
      {
        id: 'srv-1',
        type: 'server',
        rackUnits: 2,
        powerDraw: 400,
        depth: 0.6,
        position: [0, 0.04445, 0], // U1-U2
      },
      {
        id: 'blank-1',
        type: 'blank',
        rackUnits: 40,
        powerDraw: 0,
        depth: 0.1,
        position: [0, 0.9779, 0], // U3-U42 sealed
      },
    ];

    const report = evaluateRackThermal(installed, {
      capacity: 42,
      ambientColdAisleTempC: 20.0,
    });

    expect(report.openUnblankedSlotsCount).toBe(0);
    expect(report.hasRecirculationWarning).toBe(false);
    expect(report.chassisThermals[0].recirculationPenaltyC).toBe(0);
    expect(report.chassisThermals[0].inletTempC).toBe(20.0);
  });

  it('detects hot-air recirculation bypass penalty when unpopulated U-slots are open', () => {
    const unsealedHardware: HardwareProps[] = [
      {
        id: 'srv-1',
        type: 'server',
        rackUnits: 2,
        powerDraw: 600,
        depth: 0.6,
        position: [0, 0.04445, 0], // U1-U2, with U3-U42 completely open!
      },
    ];

    const report = evaluateRackThermal(unsealedHardware, {
      capacity: 42,
      ambientColdAisleTempC: 20.0,
    });

    expect(report.openUnblankedSlotsCount).toBe(40);
    expect(report.hasRecirculationWarning).toBe(true);
    // Server inlet should suffer recirculation penalty from open adjacent slots
    expect(report.chassisThermals[0].recirculationPenaltyC).toBeGreaterThan(0);
    expect(report.chassisThermals[0].inletTempC).toBeGreaterThan(20.0);
  });

  it('detects thermal throttling condition when inlet or exhaust exceeds safety limits', () => {
    const severeHardware: HardwareProps[] = [
      {
        id: 'extreme-gpu-1',
        type: 'server',
        rackUnits: 4,
        powerDraw: 5000, // Massive 5kW draw
        depth: 0.8,
        position: [0, 0.0889, 0],
      },
    ];

    const report = evaluateRackThermal(severeHardware, {
      capacity: 42,
      ambientColdAisleTempC: 30.0, // hot room intake
    });

    expect(report.hasThrottlingCritical).toBe(true);
    expect(report.chassisThermals[0].isThermalThrottling).toBe(true);
  });
});
