/**
 * bomExporter.ts
 *
 * Comprehensive Bill of Materials (BOM) and datacenter telemetry serialization engine.
 * Generates structured JSON and RFC-4180 compliant CSV exports with power, thermal,
 * electrical phase assignment, and cabling schedule details.
 */

import type { RackInstance, HardwareProps, CableProps } from '../../types/rack.types';
import { RACK_UNIT_HEIGHT } from '../../store/useConfiguratorStore';
import { estimateChassisCFM } from '../thermalCalculations';
import { PHASES } from '../electricalCalculations';

export const WATTS_TO_BTU_PER_HOUR = 3.41214;

export interface BOMItem {
  rackId: string;
  rackName: string;
  slotRange: string;
  uStart: number;
  uEnd: number;
  rackUnits: number;
  hardwareId: string;
  hardwareType: string;
  powerWatts: number;
  heatOutputBTUhr: number;
  airflowCFM: number;
  pduPhase: string;
  pduFeed: string;
  depthMm: number;
  connectedPatchRuns: string[];
}

export interface BOMReport {
  timestamp: string;
  projectTitle: string;
  rackCount: number;
  totalChassisCount: number;
  totalRackUnitsOccupied: number;
  totalPowerWatts: number;
  totalHeatBTUhr: number;
  totalAirflowCFM: number;
  cableCountsByMedium: Record<string, number>;
  totalCableLengthMeters: number;
  items: BOMItem[];
}

/**
 * Computes slot range (1-indexed U1 to U42) from hardware position and rack units.
 */
export function getChassisSlotRange(h: HardwareProps, capacity: number = 42): {
  slotRange: string;
  uStart: number;
  uEnd: number;
} {
  const bottom = h.position[1] - (h.rackUnits * RACK_UNIT_HEIGHT) / 2;
  const uStart = Math.max(1, Math.round(bottom / RACK_UNIT_HEIGHT) + 1);
  const uEnd = Math.min(capacity, uStart + h.rackUnits - 1);
  const slotRange = uStart === uEnd ? `U${uStart}` : `U${uStart}-U${uEnd}`;
  return { slotRange, uStart, uEnd };
}

/**
 * Generates a full BOM Report across all bayed racks and patch cables.
 */
export function generateBOMReport(
  racks: RackInstance[],
  cables: CableProps[] = [],
  projectTitle: string = 'Interactive Datacenter Server Rack Configuration',
): BOMReport {
  const items: BOMItem[] = [];
  let totalChassis = 0;
  let totalUnits = 0;
  let totalWatts = 0;
  let totalCFM = 0;

  racks.forEach((rack) => {
    rack.installedHardware.forEach((h, idx) => {
      totalChassis++;
      totalUnits += h.rackUnits;
      totalWatts += h.powerDraw;

      const { slotRange, uStart, uEnd } = getChassisSlotRange(h, rack.capacity);
      const isPassive = h.type === 'blank' || h.type === 'brush' || h.type === 'cable-manager';
      const cfm = isPassive ? 0 : estimateChassisCFM(h.type, h.rackUnits, h.powerDraw);
      totalCFM += cfm;

      const heatBTU = h.powerDraw * WATTS_TO_BTU_PER_HOUR;
      const phase = isPassive ? 'N/A' : PHASES[idx % 3];
      const feed = isPassive ? 'Passive' : 'Feed A + Feed B (Dual-Corded)';
      const depthMm = Math.round(h.depth * 1000);

      // Find patch runs connected to this hardware
      const connectedPatchRuns = cables
        .filter((c) => c.fromDevice === h.id || c.toDevice === h.id)
        .map((c) => {
          const isSource = c.fromDevice === h.id;
          const peerDevice = isSource ? c.toDevice : c.fromDevice;
          const localPort = isSource ? c.fromPort : c.toPort;
          const peerPort = isSource ? c.toPort : c.fromPort;
          const medium = c.type || 'copper-cat6';
          return `${localPort} <-> ${peerDevice}:${peerPort} (${medium}, ${(c.lengthMeters || 0.4).toFixed(2)}m)`;
        });

      items.push({
        rackId: rack.id,
        rackName: rack.name,
        slotRange,
        uStart,
        uEnd,
        rackUnits: h.rackUnits,
        hardwareId: h.id,
        hardwareType: h.type,
        powerWatts: h.powerDraw,
        heatOutputBTUhr: Number(heatBTU.toFixed(1)),
        airflowCFM: Number(cfm.toFixed(1)),
        pduPhase: phase,
        pduFeed: feed,
        depthMm,
        connectedPatchRuns,
      });
    });
  });

  // Calculate cable breakdown
  const cableCountsByMedium: Record<string, number> = {};
  let totalCableLengthMeters = 0;

  cables.forEach((c) => {
    const medium = c.type || 'copper-cat6';
    cableCountsByMedium[medium] = (cableCountsByMedium[medium] || 0) + 1;
    totalCableLengthMeters += c.lengthMeters || 0.4;
  });

  return {
    timestamp: new Date().toISOString(),
    projectTitle,
    rackCount: racks.length,
    totalChassisCount: totalChassis,
    totalRackUnitsOccupied: totalUnits,
    totalPowerWatts: totalWatts,
    totalHeatBTUhr: Number((totalWatts * WATTS_TO_BTU_PER_HOUR).toFixed(1)),
    totalAirflowCFM: Number(totalCFM.toFixed(1)),
    cableCountsByMedium,
    totalCableLengthMeters: Number(totalCableLengthMeters.toFixed(2)),
    items,
  };
}

/**
 * Exports BOMReport to pretty-printed JSON.
 */
export function exportBOMToJSON(report: BOMReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Escapes CSV field values according to RFC 4180.
 */
function escapeCSV(val: string | number | undefined): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports BOMReport to RFC 4180 compliant CSV string.
 */
export function exportBOMToCSV(report: BOMReport): string {
  const lines: string[] = [];

  // Title Block Metadata
  lines.push(`# PROJECT: ${report.projectTitle}`);
  lines.push(`# TIMESTAMP: ${report.timestamp}`);
  lines.push(`# TOTAL RACKS: ${report.rackCount} | TOTAL CHASSIS: ${report.totalChassisCount} | OCCUPIED U: ${report.totalRackUnitsOccupied}`);
  lines.push(`# TOTAL POWER: ${report.totalPowerWatts} W | HEAT OUTPUT: ${report.totalHeatBTUhr} BTU/hr | AIRFLOW: ${report.totalAirflowCFM} CFM`);
  lines.push(`# TOTAL CABLES: ${Object.values(report.cableCountsByMedium).reduce((a, b) => a + b, 0)} RUNS (${report.totalCableLengthMeters}m)`);
  lines.push('');

  // Table Headers
  const headers = [
    'Rack Name',
    'Rack ID',
    'Slot Range',
    'U Start',
    'U End',
    'Height (U)',
    'Hardware Type',
    'Hardware ID',
    'Depth (mm)',
    'Power Draw (W)',
    'Heat (BTU/hr)',
    'Airflow (CFM)',
    'PDU Phase',
    'PDU Redundancy',
    'Patch Connections',
  ];
  lines.push(headers.map(escapeCSV).join(','));

  // Table Data Rows
  report.items.forEach((item) => {
    const row = [
      item.rackName,
      item.rackId,
      item.slotRange,
      item.uStart,
      item.uEnd,
      item.rackUnits,
      item.hardwareType,
      item.hardwareId,
      item.depthMm,
      item.powerWatts,
      item.heatOutputBTUhr,
      item.airflowCFM,
      item.pduPhase,
      item.pduFeed,
      item.connectedPatchRuns.join('; '),
    ];
    lines.push(row.map(escapeCSV).join(','));
  });

  return lines.join('\r\n');
}

/**
 * Browser helper to trigger instant file download.
 */
export function downloadFile(
  filename: string,
  content: string | Blob,
  mimeType: string = 'text/plain;charset=utf-8',
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
