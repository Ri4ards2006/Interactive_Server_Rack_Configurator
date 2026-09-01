/**
 * netbox.types.ts
 *
 * TypeScript domain models for NetBox DCIM REST API payloads,
 * racks, devices, device types, interfaces, and cable endpoints.
 */

export interface NetBoxConfig {
  url: string;
  token: string;
  siteId?: number;
  mockMode: boolean;
}

export interface NetBoxSite {
  id: number;
  name: string;
  slug: string;
}

export interface NetBoxLocation {
  id: number;
  name: string;
  slug: string;
  site?: { id: number; name: string };
}

export interface NetBoxRack {
  id: number;
  name: string;
  facility?: string;
  u_height: number;
  width?: { value: number; label: string } | number;
  outer_depth?: number;
  site: { id: number; name: string };
  location?: { id: number; name: string };
}

export interface NetBoxDeviceType {
  id: number;
  manufacturer: { id?: number; name: string };
  model: string;
  slug?: string;
  u_height: number;
  is_full_depth?: boolean;
}

export interface NetBoxDevice {
  id: number;
  name: string;
  device_type: NetBoxDeviceType;
  rack: { id: number; name: string };
  position: number; // 1-indexed bottom rack unit (U1 to U42)
  face?: { value: 'front' | 'rear'; label: string } | 'front' | 'rear';
  status?: { value: string; label: string } | string;
  primary_ip?: { address: string };
  custom_fields?: Record<string, any>;
}

export interface NetBoxInterface {
  id: number;
  device: { id: number; name: string };
  name: string;
  type?: { value: string; label: string } | string;
  cable?: { id: number; display?: string } | null;
}

export interface NetBoxCableTermination {
  object_type: string;
  object_id: number;
  object: {
    id: number;
    name: string;
    device: { id: number; name: string };
  };
}

export interface NetBoxCable {
  id: number;
  a_terminations: NetBoxCableTermination[];
  b_terminations: NetBoxCableTermination[];
  type?: { value: string; label: string } | string;
  color?: string;
  length?: number;
  length_unit?: { value: string; label: string } | string;
}

export interface NetBoxSyncResult {
  success: boolean;
  importedRacksCount: number;
  importedDevicesCount: number;
  importedCablesCount: number;
  errors: string[];
  logs: string[];
}
