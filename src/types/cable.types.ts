/**
 * cable.types.ts
 *
 * Domain types and physical specifications for the 3D Cable Routing & Patching Engine.
 */

import type { Vec3 } from './rack.types';

export type CableType =
  | 'copper-cat6'
  | 'copper-cat6a'
  | 'fiber-om4'
  | 'fiber-os2'
  | 'dac-10g';

export type CablePlugType = 'rj45' | 'lc-duplex' | 'sfp-plus';

export interface CableMediumSpec {
  id: CableType;
  name: string;
  shortLabel: string;
  category: 'copper' | 'fiber' | 'direct-attach';
  outerDiameterMm: number;
  minBendRadiusMm: number;
  defaultColor: string;
  jacketRoughness: number;
  jacketMetalness: number;
  sagMultiplier: number;
  plugType: CablePlugType;
}

export interface CableColorPreset {
  name: string;
  hex: string;
}

export const CABLE_COLOR_PRESETS: CableColorPreset[] = [
  { name: 'Ethernet Blue', hex: '#3b82f6' },
  { name: 'Patch Yellow', hex: '#eab308' },
  { name: 'Uplink Green', hex: '#10b981' },
  { name: 'Alarm Red', hex: '#ef4444' },
  { name: 'Management Purple', hex: '#8b5cf6' },
  { name: 'Fiber Aqua', hex: '#06b6d4' },
  { name: 'SAN Orange', hex: '#f97316' },
  { name: 'Stealth Black', hex: '#18181b' },
  { name: 'Neutral White', hex: '#e4e4e7' },
];

export const CABLE_MEDIUM_SPECS: Record<CableType, CableMediumSpec> = {
  'copper-cat6': {
    id: 'copper-cat6',
    name: 'Cat6 UTP Copper (1GbE/10GbE)',
    shortLabel: 'Cat6 UTP',
    category: 'copper',
    outerDiameterMm: 6.0,
    minBendRadiusMm: 25.0,
    defaultColor: '#3b82f6',
    jacketRoughness: 0.6,
    jacketMetalness: 0.1,
    sagMultiplier: 1.15,
    plugType: 'rj45',
  },
  'copper-cat6a': {
    id: 'copper-cat6a',
    name: 'Cat6A Shielded Copper (10GbE)',
    shortLabel: 'Cat6A STP',
    category: 'copper',
    outerDiameterMm: 7.5,
    minBendRadiusMm: 30.0,
    defaultColor: '#10b981',
    jacketRoughness: 0.5,
    jacketMetalness: 0.2,
    sagMultiplier: 1.3,
    plugType: 'rj45',
  },
  'fiber-om4': {
    id: 'fiber-om4',
    name: 'OM4 Multimode Fiber (40/100GbE)',
    shortLabel: 'OM4 MM',
    category: 'fiber',
    outerDiameterMm: 3.0,
    minBendRadiusMm: 15.0,
    defaultColor: '#06b6d4',
    jacketRoughness: 0.3,
    jacketMetalness: 0.05,
    sagMultiplier: 0.7,
    plugType: 'lc-duplex',
  },
  'fiber-os2': {
    id: 'fiber-os2',
    name: 'OS2 Singlemode Fiber (100GbE+)',
    shortLabel: 'OS2 SM',
    category: 'fiber',
    outerDiameterMm: 2.8,
    minBendRadiusMm: 20.0,
    defaultColor: '#eab308',
    jacketRoughness: 0.3,
    jacketMetalness: 0.05,
    sagMultiplier: 0.65,
    plugType: 'lc-duplex',
  },
  'dac-10g': {
    id: 'dac-10g',
    name: '10G/25G Direct Attach Copper (Twinax)',
    shortLabel: 'DAC Twinax',
    category: 'direct-attach',
    outerDiameterMm: 4.5,
    minBendRadiusMm: 30.0,
    defaultColor: '#18181b',
    jacketRoughness: 0.4,
    jacketMetalness: 0.4,
    sagMultiplier: 0.85,
    plugType: 'sfp-plus',
  },
};

export interface PortReference {
  deviceId: string;
  portId: string;
  position: Vec3;
}

export interface CableEvaluation {
  lengthMeters: number;
  minBendRadiusFoundMm: number;
  hasBendViolation: boolean;
}

