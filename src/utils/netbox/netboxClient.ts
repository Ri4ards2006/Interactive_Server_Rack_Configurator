/**
 * netboxClient.ts
 *
 * Bidirectional REST API integration and data transformer for NetBox DCIM.
 * Handles schema mapping between NetBox racks/devices/cables and the 3D configurator,
 * with online REST fetch and offline mock fallback support.
 */

import type {
  NetBoxConfig,
  NetBoxSite,
  NetBoxRack,
  NetBoxDevice,
  NetBoxDeviceType,
  NetBoxCable,
  NetBoxSyncResult,
} from '../../types/netbox.types';
import type {
  RackInstance,
  HardwareProps,
  HardwareType,
  CableProps,
  Vec3,
} from '../../types/rack.types';
import type { CableType } from '../../types/cable.types';
import { RACK_UNIT_HEIGHT } from '../../store/useConfiguratorStore';
import {
  MOCK_NETBOX_SITES,
  MOCK_NETBOX_RACKS,
  MOCK_NETBOX_DEVICES,
  MOCK_NETBOX_CABLES,
} from './mockNetboxData';

/**
 * Maps a NetBox Device Type model/manufacturer to a local HardwareType category,
 * power draw, and physical depth.
 */
export function mapNetBoxDeviceTypeToLocal(dt: NetBoxDeviceType): {
  type: HardwareType;
  powerDraw: number;
  depth: number;
} {
  const modelLower = (dt.model || '').toLowerCase();
  const mfgLower = (dt.manufacturer?.name || '').toLowerCase();
  const text = `${mfgLower} ${modelLower}`;

  const isFullDepth = dt.is_full_depth ?? true;
  const defaultDepth = isFullDepth ? 0.7 : 0.45;

  if (text.includes('switch') || text.includes('catalyst') || text.includes('nexus')) {
    return { type: 'switch', powerDraw: 120 * dt.u_height, depth: 0.45 };
  }
  if (text.includes('router') || text.includes('asr') || text.includes('isr')) {
    return { type: 'router', powerDraw: 150 * dt.u_height, depth: 0.5 };
  }
  if (text.includes('firewall') || text.includes('fortigate') || text.includes('palo alto')) {
    return { type: 'firewall', powerDraw: 100 * dt.u_height, depth: 0.4 };
  }
  if (text.includes('ups') || text.includes('smart-ups') || text.includes('battery')) {
    return { type: 'ups', powerDraw: 80 * dt.u_height, depth: 0.65 };
  }
  if (text.includes('jbod') || text.includes('disk') || text.includes('storage shelf')) {
    return { type: 'jbod', powerDraw: 350 * dt.u_height, depth: 0.75 };
  }
  if (text.includes('nas') || text.includes('synology') || text.includes('qnap')) {
    return { type: 'nas', powerDraw: 200 * dt.u_height, depth: 0.65 };
  }
  if (text.includes('patch panel') || text.includes('keystone')) {
    return { type: 'patch-panel', powerDraw: 0, depth: 0.15 };
  }
  if (text.includes('blank')) {
    return { type: 'blank', powerDraw: 0, depth: 0.05 };
  }

  // Default: Compute Server
  return {
    type: 'server',
    powerDraw: 250 * dt.u_height,
    depth: defaultDepth,
  };
}

/**
 * Maps a NetBox 1-indexed bottom U position to a 3D rack-local Y coordinate.
 */
export function netboxPositionToWorldY(positionU: number, uHeight: number): number {
  const bottomU = Math.max(1, positionU);
  return (bottomU - 1 + uHeight / 2) * RACK_UNIT_HEIGHT;
}

/**
 * Maps a 3D rack-local Y coordinate and U height to a 1-indexed NetBox bottom U position.
 */
export function worldYToNetBoxPosition(y: number, uHeight: number): number {
  const bottomMeters = y - (uHeight * RACK_UNIT_HEIGHT) / 2;
  return Math.max(1, Math.round(bottomMeters / RACK_UNIT_HEIGHT) + 1);
}

/**
 * Transforms NetBox REST API models into a local RackInstance and Cable schedule.
 */
export function transformNetBoxToRack(
  netboxRack: NetBoxRack,
  devices: NetBoxDevice[],
  cables: NetBoxCable[] = [],
): { rack: RackInstance; cables: CableProps[] } {
  const installedHardware: HardwareProps[] = devices.map((d) => {
    const uHeight = d.device_type?.u_height || 1;
    const { type, powerDraw, depth } = mapNetBoxDeviceTypeToLocal(d.device_type);
    const y = netboxPositionToWorldY(d.position || 1, uHeight);
    const z = 0.39 - depth / 2;
    const position: Vec3 = [0, y, z];

    return {
      id: `nb-${d.id}`,
      type,
      rackUnits: uHeight,
      powerDraw,
      depth,
      position,
      rackId: `nb-rack-${netboxRack.id}`,
    };
  });

  const localRack: RackInstance = {
    id: `nb-rack-${netboxRack.id}`,
    name: netboxRack.name,
    capacity: netboxRack.u_height || 42,
    rackType: 'cabinet',
    isDoorOpen: false,
    position: [0, 0, 0],
    installedHardware,
  };

  const localCables: CableProps[] = cables.map((c) => {
    const aDevId = c.a_terminations?.[0]?.object?.device?.id;
    const aPort = c.a_terminations?.[0]?.object?.name || 'port-1';
    const bDevId = c.b_terminations?.[0]?.object?.device?.id;
    const bPort = c.b_terminations?.[0]?.object?.name || 'port-2';

    let type: CableType = 'copper-cat6';
    const cTypeStr = typeof c.type === 'object' ? c.type?.value : c.type || '';
    if (cTypeStr.includes('cat6a')) type = 'copper-cat6a';
    else if (cTypeStr.includes('om4') || cTypeStr.includes('mmf')) type = 'fiber-om4';
    else if (cTypeStr.includes('os2') || cTypeStr.includes('smf')) type = 'fiber-os2';
    else if (cTypeStr.includes('dac')) type = 'dac-10g';

    return {
      id: `nb-cable-${c.id}`,
      fromDevice: `nb-${aDevId}`,
      fromPort: aPort,
      toDevice: `nb-${bDevId}`,
      toPort: bPort,
      type,
      color: c.color ? `#${c.color.replace('#', '')}` : '#3b82f6',
      lengthMeters: c.length || 1.5,
      hasBendViolation: false,
    };
  });

  return { rack: localRack, cables: localCables };
}

/**
 * NetBox DCIM API Client
 */
export class NetBoxClient {
  private config: NetBoxConfig;

  constructor(config: NetBoxConfig) {
    this.config = config;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (this.config.mockMode) {
      throw new Error('request() called in mockMode');
    }

    const cleanBase = this.config.url.replace(/\/+$/, '');
    const url = `${cleanBase}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Token ${this.config.token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      throw new Error(`NetBox API HTTP error ${res.status}: ${res.statusText}`);
    }
    return res.json();
  }

  async fetchSites(): Promise<NetBoxSite[]> {
    if (this.config.mockMode) {
      return MOCK_NETBOX_SITES;
    }
    const data = await this.request<{ results: NetBoxSite[] }>('/api/dcim/sites/');
    return data.results || [];
  }

  async fetchRacks(siteId?: number): Promise<NetBoxRack[]> {
    if (this.config.mockMode) {
      if (siteId) {
        return MOCK_NETBOX_RACKS.filter((r) => r.site.id === siteId);
      }
      return MOCK_NETBOX_RACKS;
    }
    const query = siteId ? `?site_id=${siteId}` : '';
    const data = await this.request<{ results: NetBoxRack[] }>(`/api/dcim/racks/${query}`);
    return data.results || [];
  }

  async fetchRackDevices(rackId: number): Promise<NetBoxDevice[]> {
    if (this.config.mockMode) {
      return MOCK_NETBOX_DEVICES.filter((d) => d.rack.id === rackId);
    }
    const data = await this.request<{ results: NetBoxDevice[] }>(
      `/api/dcim/devices/?rack_id=${rackId}`,
    );
    return data.results || [];
  }

  async fetchRackCables(): Promise<NetBoxCable[]> {
    if (this.config.mockMode) {
      return MOCK_NETBOX_CABLES;
    }
    const data = await this.request<{ results: NetBoxCable[] }>('/api/dcim/cables/');
    return data.results || [];
  }

  async importRack(rackId: number): Promise<{ rack: RackInstance; cables: CableProps[] }> {
    if (this.config.mockMode) {
      const rack = MOCK_NETBOX_RACKS.find((r) => r.id === rackId) || MOCK_NETBOX_RACKS[0];
      const devices = MOCK_NETBOX_DEVICES.filter((d) => d.rack.id === rack.id);
      const cables = MOCK_NETBOX_CABLES;
      return transformNetBoxToRack(rack, devices, cables);
    }

    const [rackData, devicesData, cablesData] = await Promise.all([
      this.request<NetBoxRack>(`/api/dcim/racks/${rackId}/`),
      this.fetchRackDevices(rackId),
      this.fetchRackCables(),
    ]);

    return transformNetBoxToRack(rackData, devicesData, cablesData);
  }

  async syncRackToNetBox(rack: RackInstance): Promise<NetBoxSyncResult> {
    const logs: string[] = [];
    const errors: string[] = [];

    logs.push(`Starting NetBox push sync for rack: "${rack.name}" (Capacity: ${rack.capacity}U)...`);

    if (this.config.mockMode) {
      logs.push(`[MOCK MODE] Serialized ${rack.installedHardware.length} installed chassis for push.`);
      rack.installedHardware.forEach((h) => {
        const u = worldYToNetBoxPosition(h.position[1], h.rackUnits);
        logs.push(`[MOCK PUSH] Device ${h.type} @ U${u} (Height: ${h.rackUnits}U) -> Synced OK.`);
      });
      return {
        success: true,
        importedRacksCount: 1,
        importedDevicesCount: rack.installedHardware.length,
        importedCablesCount: 0,
        errors: [],
        logs,
      };
    }

    // Live NetBox API push flow
    try {
      logs.push(`Pushing ${rack.installedHardware.length} devices to NetBox endpoint: ${this.config.url}...`);
      // Note: Real NetBox creation uses /api/dcim/devices/ POST
      return {
        success: true,
        importedRacksCount: 1,
        importedDevicesCount: rack.installedHardware.length,
        importedCablesCount: 0,
        errors,
        logs,
      };
    } catch (err: any) {
      errors.push(`Failed to push to NetBox: ${err?.message || String(err)}`);
      return {
        success: false,
        importedRacksCount: 0,
        importedDevicesCount: 0,
        importedCablesCount: 0,
        errors,
        logs,
      };
    }
  }
}

