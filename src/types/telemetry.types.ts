/**
 * telemetry.types.ts
 *
 * TypeScript domain schemas for Live Telemetry & Sensor Polling:
 * Prometheus PromQL queries, Zabbix item keys, real-time mock stream generators,
 * chassis health metrics, fan RPMs, power telemetry, and network throughput.
 */

export type TelemetryProvider = 'prometheus' | 'zabbix' | 'mock-stream';

export type HealthStatus = 'healthy' | 'warning' | 'critical';

export interface ChassisLiveMetrics {
  hardwareId: string;
  cpuTempC: number;
  intakeTempC: number;
  exhaustTempC: number;
  powerDrawWatts: number;
  fanSpeedRpm: number;
  networkRxMbps: number;
  networkTxMbps: number;
  healthStatus: HealthStatus;
  timestamp: number;
}

export interface PrometheusVectorResult {
  metric: Record<string, string>;
  value: [number, string]; // [unixTimestamp, stringValue]
}

export interface PrometheusQueryResponse {
  status: 'success' | 'error';
  data?: {
    resultType: 'vector' | 'matrix' | 'scalar' | 'string';
    result: PrometheusVectorResult[];
  };
  errorType?: string;
  error?: string;
}

export interface TelemetryConfig {
  provider: TelemetryProvider;
  endpointUrl: string;
  apiToken?: string;
  pollingIntervalMs: number;
  queryMap: {
    tempQuery?: string;
    powerQuery?: string;
    fanQuery?: string;
    networkRxQuery?: string;
    networkTxQuery?: string;
  };
}

export interface LiveTelemetrySummary {
  totalLivePowerWatts: number;
  avgCpuTempC: number;
  maxCpuTempC: number;
  hotspotChassisId: string | null;
  healthyCount: number;
  warningCount: number;
  criticalCount: number;
  totalNetworkThroughputMbps: number;
}

