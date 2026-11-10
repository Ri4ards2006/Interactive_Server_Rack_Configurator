/**
 * network.types.ts
 *
 * TypeScript domain schemas for Layer 2 / Layer 3 networking configurations:
 * Hostnames, Management IPs, Subnet CIDRs, Default Gateways,
 * VLAN modes (Access / Trunk), Link Speeds, and Port Admin status.
 */

export type VlanMode = 'access' | 'trunk';

export interface VlanConfig {
  mode: VlanMode;
  accessVlan?: number;
  nativeVlan?: number;
  taggedVlans?: number[];
}

export type LinkSpeed =
  | '1G-BaseT'
  | '10G-SFP+'
  | '25G-SFP28'
  | '40G-QSFP+'
  | '100G-QSFP28';

export type PortAdminStatus = 'up' | 'down' | 'disabled';

export interface PortNetworkConfig {
  portId?: string;
  ipAddress?: string;
  cidr?: number;
  vlanConfig?: VlanConfig;
  speed?: LinkSpeed;
  adminStatus?: PortAdminStatus;
  macAddress?: string;
}

export interface DeviceNetworkConfig {
  hostname?: string;
  managementIp?: string;
  managementCidr?: number;
  gateway?: string;
  dns?: string[];
  domain?: string;
  portsConfig?: Record<string, PortNetworkConfig>;
}

export interface TopologyNode {
  id: string;
  rackId: string;
  rackName: string;
  label: string;
  type: string;
  managementIp: string;
  uPosition: number;
  rackUnits: number;
  powerWatts: number;
  status: 'online' | 'warning' | 'offline';
  tier: 'spine' | 'leaf' | 'compute' | 'storage' | 'auxiliary';
}

export interface TopologyLink {
  id: string;
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;
  cableType: string;
  speed: string;
  vlanText: string;
  status: 'active' | 'degraded' | 'down';
  color: string;
}

