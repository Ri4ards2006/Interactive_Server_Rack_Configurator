/**
 * telemetryClient.ts
 *
 * REST API client for Prometheus & Zabbix metrics endpoints:
 * - Executes instant PromQL vector queries against /api/v1/query
 * - Maps host/instance labels to hardware IDs
 * - Evaluates thermal and health thresholds
 * - Computes real-time datacenter aggregate summaries
 */

import type {
  PrometheusQueryResponse,
  PrometheusVectorResult,
  HealthStatus,
  ChassisLiveMetrics,
  LiveTelemetrySummary,
} from '../../types/telemetry.types';

/**
 * Evaluates live health status based on CPU temperature thresholds.
 */
export function evaluateLiveHealthStatus(
  cpuTempC: number,
  warningThreshold = 65,
  criticalThreshold = 80,
): HealthStatus {
  if (cpuTempC >= criticalThreshold) return 'critical';
  if (cpuTempC >= warningThreshold) return 'warning';
  return 'healthy';
}

/**
 * Execute an instant PromQL query against Prometheus REST API.
 */
export async function queryPrometheusInstant(
  endpointUrl: string,
  query: string,
  apiToken?: string,
): Promise<PrometheusVectorResult[]> {
  const url = new URL('/api/v1/query', endpointUrl);
  url.searchParams.set('query', query);

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (apiToken) {
    headers['Authorization'] = `Bearer ${apiToken}`;
  }

  const res = await fetch(url.toString(), { method: 'GET', headers });
  if (!res.ok) {
    throw new Error(`Prometheus HTTP error ${res.status}: ${res.statusText}`);
  }

  const data: PrometheusQueryResponse = await res.json();
  if (data.status !== 'success' || !data.data?.result) {
    throw new Error(`Prometheus query error: ${data.error || 'Unknown query failure'}`);
  }

  return data.data.result;
}

/**
 * Map Prometheus vector query response to a Map of identifier -> metric value.
 */
export function parsePrometheusVector(
  results: PrometheusVectorResult[],
  targetLabel = 'instance',
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of results) {
    const key = item.metric[targetLabel] || item.metric['hostname'] || item.metric['job'] || 'unknown';
    const val = parseFloat(item.value[1]);
    if (!isNaN(val)) {
      map.set(key, val);
    }
  }
  return map;
}

/**
 * Compute high-level real-time telemetry summary across all active chassis.
 */
export function computeTelemetrySummary(
  metrics: Record<string, ChassisLiveMetrics>,
): LiveTelemetrySummary {
  const list = Object.values(metrics);
  if (list.length === 0) {
    return {
      totalLivePowerWatts: 0,
      avgCpuTempC: 0,
      maxCpuTempC: 0,
      hotspotChassisId: null,
      healthyCount: 0,
      warningCount: 0,
      criticalCount: 0,
      totalNetworkThroughputMbps: 0,
    };
  }

  let totalPower = 0;
  let tempSum = 0;
  let maxTemp = -Infinity;
  let hotspotId: string | null = null;
  let healthy = 0;
  let warning = 0;
  let critical = 0;
  let totalNet = 0;

  for (const m of list) {
    totalPower += m.powerDrawWatts;
    tempSum += m.cpuTempC;
    totalNet += m.networkRxMbps + m.networkTxMbps;

    if (m.cpuTempC > maxTemp) {
      maxTemp = m.cpuTempC;
      hotspotId = m.hardwareId;
    }

    if (m.healthStatus === 'critical') critical++;
    else if (m.healthStatus === 'warning') warning++;
    else healthy++;
  }

  return {
    totalLivePowerWatts: Math.round(totalPower),
    avgCpuTempC: Math.round((tempSum / list.length) * 10) / 10,
    maxCpuTempC: Math.round(maxTemp * 10) / 10,
    hotspotChassisId: hotspotId,
    healthyCount: healthy,
    warningCount: warning,
    criticalCount: critical,
    totalNetworkThroughputMbps: Math.round(totalNet * 10) / 10,
  };
}
