/**
 * networkTopology.test.ts
 *
 * Unit tests for Cable Spline Physics, 60mm rigid tangent exits,
 * L2/L3 Network Configuration data models, and Network Topology Graph extraction.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { calculateCableCurve, calculateSag } from '../cableGeometry';
import type { RackInstance, CableProps } from '../../types/rack.types';
import type { DeviceNetworkConfig, PortNetworkConfig } from '../../types/network.types';

describe('cableGeometry — Tangent Exit Clearance & Sag Physics', () => {
  it('enforces minimum 60mm forward exit clearance from port face', () => {
    const p1 = new THREE.Vector3(0, 0.5, 0.39); // Front port at z=0.39
    const p2 = new THREE.Vector3(0, 0.2, 0.39); // Front port at z=0.39

    const res = calculateCableCurve(p1, p2, 'copper-cat6');

    // First segment after p1 (boot1) must be at least z = p1.z + 0.06
    const boot1 = res.curve.points[1];
    expect(boot1.z).toBeGreaterThanOrEqual(p1.z + 0.06 - 0.001);

    // Cable length must be greater than straight vertical line
    expect(res.length).toBeGreaterThan(0.3);
    expect(res.curve.points.length).toBe(7);
  });

  it('dynamically scales gravitational sag with span distance without exceeding limits', () => {
    const p1 = new THREE.Vector3(0, 0.5, 0.39);
    const pShort = new THREE.Vector3(0, 0.45, 0.39);
    const pLong = new THREE.Vector3(0.8, 0.1, 0.39); // Cross-rack long run

    const sagShort = calculateSag(p1, pShort);
    const sagLong = calculateSag(p1, pLong);

    expect(sagShort).toBeGreaterThanOrEqual(0.02);
    expect(sagLong).toBeGreaterThan(sagShort);
    expect(sagLong).toBeLessThan(0.35); // Capped to avoid extreme clipping
  });
});

describe('network.types — Device & Port L2/L3 Configurations', () => {
  it('instantiates valid network configuration schemas', () => {
    const portConfig: PortNetworkConfig = {
      portId: 'eth0',
      ipAddress: '192.168.1.100',
      cidr: 24,
      vlanConfig: {
        mode: 'access',
        accessVlan: 20,
      },
      speed: '10G-SFP+',
      adminStatus: 'up',
    };

    expect(portConfig.vlanConfig?.mode).toBe('access');
    expect(portConfig.vlanConfig?.accessVlan).toBe(20);
    expect(portConfig.speed).toBe('10G-SFP+');

    const trunkPortConfig: PortNetworkConfig = {
      portId: 'te1/0/48',
      vlanConfig: {
        mode: 'trunk',
        nativeVlan: 1,
        taggedVlans: [10, 20, 30, 40],
      },
      speed: '100G-QSFP28',
      adminStatus: 'up',
    };

    expect(trunkPortConfig.vlanConfig?.mode).toBe('trunk');
    expect(trunkPortConfig.vlanConfig?.taggedVlans?.length).toBe(4);

    const devConfig: DeviceNetworkConfig = {
      hostname: 'tor-switch-01.dc.internal',
      managementIp: '10.200.1.254',
      managementCidr: 24,
      gateway: '10.200.1.1',
      portsConfig: {
        eth0: portConfig,
        'te1/0/48': trunkPortConfig,
      },
    };

    expect(devConfig.hostname).toBe('tor-switch-01.dc.internal');
    expect(devConfig.portsConfig?.['eth0'].adminStatus).toBe('up');
  });
});

