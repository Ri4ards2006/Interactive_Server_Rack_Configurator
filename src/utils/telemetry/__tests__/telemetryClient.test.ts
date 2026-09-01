/**
 * telemetryClient.test.ts
 *
 * Unit tests for Prometheus vector response parsing,
 * live health status evaluation, aggregate telemetry summary calculations,
 * and physics-informed mock telemetry stream generation.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateLiveHealthStatus,
  parsePrometheusVector,
  computeTelemetrySummary,
} from '../telemetryClient';
import { generateLiveTelemetrySnapshot } from '../mockTelemetryStream';
import type { PrometheusVectorResult, ChassisLiveMetrics } from '../../../types/telemetry.types';
import type { RackInstance } from '../../../types/rack.types';

describe('telemetryClient — Health Status Evaluation', () => {
  it('correctly maps CPU temperature thresholds to health tiers', () => {
    expect(evaluateLiveHealthStatus(42.5)).toBe('healthy');
    expect(evaluateLiveHealthStatus(64.9)).toBe('healthy');
    expect(evaluateLiveHealthStatus(65.0)).toBe('warning');
    expect(evaluateLiveHealthStatus(75.5)).toBe('warning');
    expect(evaluateLiveHealthStatus(80.0)).toBe('critical');
    expect(evaluateLiveHealthStatus(95.0)).toBe('critical');
  });
});

describe('telemetryClient — Prometheus Vector Parsing', () => {
  it('extracts metric values into Map keyed by instance label', () => {
    const mockVector: PrometheusVectorResult[] = [
      {
        metric: { instance: 'node-01.dc.internal', job: 'node_exporter' },
        value: [1700000000, '54.2'],
      },
      {
        metric: { instance: 'node-02.dc.internal', job: 'node_exporter' },
        value: [1700000000, '82.7'],
      },
    ];

    const result = parsePrometheusVector(mockVector, 'instance');
    expect(result.size).toBe(2);
    expect(result.get('node-01.dc.internal')).toBe(54.2);
    expect(result.get('node-02.dc.internal')).toBe(82.7);
  });
});

describe('telemetryClient — Aggregate Summary Calculations', () => {
  it('computes live datacenter totals and hotspot detection', () => {
    const metrics: Record<string, ChassisLiveMetrics> = {
      'srv-1': {
        hardwareId: 'srv-1',
        cpuTempC: 45.0,
        intakeTempC: 20.0,
        exhaustTempC: 32.0,
        powerDrawWatts: 300,
        fanSpeedRpm: 5000,
        networkRxMbps: 100,
        networkTxMbps: 150,
        healthStatus: 'healthy',
        timestamp: Date.now(),
      },
      'srv-2': {
        hardwareId: 'srv-2',
        cpuTempC: 84.0,
        intakeTempC: 22.0,
        exhaustTempC: 48.0,
        powerDrawWatts: 650,
        fanSpeedRpm: 12000,
        networkRxMbps: 800,
        networkTxMbps: 1200,
        healthStatus: 'critical',
        timestamp: Date.now(),
      },
      'sw-1': {
        hardwareId: 'sw-1',
        cpuTempC: 68.0,
        intakeTempC: 21.0,
        exhaustTempC: 38.0,
        powerDrawWatts: 150,
        fanSpeedRpm: 7500,
        networkRxMbps: 4500,
        networkTxMbps: 5200,
        healthStatus: 'warning',
        timestamp: Date.now(),
      },
    };

    const summary = computeTelemetrySummary(metrics);

    expect(summary.totalLivePowerWatts).toBe(1100);
    expect(summary.maxCpuTempC).toBe(84.0);
    expect(summary.hotspotChassisId).toBe('srv-2');
    expect(summary.healthyCount).toBe(1);
    expect(summary.warningCount).toBe(1);
    expect(summary.criticalCount).toBe(1);
    expect(summary.totalNetworkThroughputMbps).toBe(11950);
  });

  it('handles empty metrics gracefully', () => {
    const summary = computeTelemetrySummary({});
    expect(summary.totalLivePowerWatts).toBe(0);
    expect(summary.hotspotChassisId).toBeNull();
  });
});

describe('mockTelemetryStream — Physics-informed Generator', () => {
  const sampleRacks: RackInstance[] = [
    {
      id: 'rack-a',
      name: 'Rack A',
      capacity: 42,
      rackType: 'cabinet',
      isDoorOpen: false,
      position: [0, 0, 0],
      installedHardware: [
        {
          id: 'server-1',
          type: 'server',
          rackUnits: 2,
          powerDraw: 350,
          depth: 0.6,
          position: [0, 0.1, 0],
        },
        {
          id: 'switch-1',
          type: 'switch',
          rackUnits: 1,
          powerDraw: 120,
          depth: 0.3,
          position: [0, 0.5, 0],
        },
      ],
    },
  ];

  it('generates non-empty valid telemetry objects for all installed chassis', () => {
    const snapshot = generateLiveTelemetrySnapshot(sampleRacks, 20.0, 5);

    expect(Object.keys(snapshot).length).toBe(2);
    const srv = snapshot['server-1'];
    expect(srv).toBeDefined();
    expect(srv.cpuTempC).toBeGreaterThan(30);
    expect(srv.powerDrawWatts).toBeGreaterThan(100);
    expect(srv.fanSpeedRpm).toBeGreaterThan(3000);
    expect(srv.networkRxMbps).toBeGreaterThan(0);
  });
});
