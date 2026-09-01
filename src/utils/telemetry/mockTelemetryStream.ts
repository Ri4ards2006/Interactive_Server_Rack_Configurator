/**
 * mockTelemetryStream.ts
 *
 * Physics-informed real-time mock telemetry generator.
 * Produces continuous simulated CPU temperatures, fan RPM curves,
 * power load variations, and bursty network throughput for installed hardware.
 */

import type { HardwareProps, RackInstance } from '../../types/rack.types';
import type { ChassisLiveMetrics } from '../../types/telemetry.types';
import { evaluateLiveHealthStatus } from './telemetryClient';

/**
 * Generates a realistic live telemetry snapshot for all installed hardware across all racks.
 */
export function generateLiveTelemetrySnapshot(
  racks: RackInstance[],
  ambientTempC = 20.0,
  tickCount = 0,
): Record<string, ChassisLiveMetrics> {
  const result: Record<string, ChassisLiveMetrics> = {};
  const timestamp = Date.now();

  racks.forEach((rack, rackIdx) => {
    rack.installedHardware.forEach((h, hIdx) => {
      // Calculate deterministic phase offset per chassis
      const phase = (rackIdx * 10 + hIdx) * 1.3 + tickCount * 0.15;
      const baseLoad = 0.5 + 0.3 * Math.sin(phase) + 0.15 * Math.cos(phase * 2.1);
      const clampedLoad = Math.max(0.1, Math.min(1.0, baseLoad));

      // Live power draw in Watts
      const powerVariation = (clampedLoad - 0.5) * 0.3 * h.powerDraw;
      const powerDrawWatts = Math.max(15, Math.round(h.powerDraw + powerVariation));

      // Realistic temperature rise
      const tempRise = (powerDrawWatts / Math.max(50, h.powerDraw)) * 24 * clampedLoad;
      // Intentionally simulate one intermittent hotspot chassis if load spikes
      const isHotspotCandidate = hIdx === 1 && rackIdx === 0;
      const hotspotPenalty = isHotspotCandidate && (tickCount % 20 > 10) ? 22 : 0;

      const cpuTempC = Math.round((ambientTempC + 18 + tempRise + hotspotPenalty) * 10) / 10;
      const intakeTempC = Math.round((ambientTempC + (hIdx * 0.2)) * 10) / 10;
      const exhaustTempC = Math.round((intakeTempC + (powerDrawWatts / 45)) * 10) / 10;

      // Nonlinear Fan Speed Curve (3000 to 14000 RPM)
      const fanRatio = Math.min(1.0, Math.max(0.2, (cpuTempC - 30) / 55));
      const fanSpeedRpm = Math.round(3000 + Math.pow(fanRatio, 1.8) * 11000);

      // Bursty Network I/O
      const netBurst = Math.abs(Math.sin(phase * 3.7 + tickCount * 0.3));
      const networkRxMbps = Math.round((10 + netBurst * (h.type === 'switch' ? 8500 : 850)) * 10) / 10;
      const networkTxMbps = Math.round((15 + netBurst * (h.type === 'switch' ? 9200 : 720)) * 10) / 10;

      const healthStatus = evaluateLiveHealthStatus(cpuTempC);

      result[h.id] = {
        hardwareId: h.id,
        cpuTempC,
        intakeTempC,
        exhaustTempC,
        powerDrawWatts,
        fanSpeedRpm,
        networkRxMbps,
        networkTxMbps,
        healthStatus,
        timestamp,
      };
    });
  });

  return result;
}

