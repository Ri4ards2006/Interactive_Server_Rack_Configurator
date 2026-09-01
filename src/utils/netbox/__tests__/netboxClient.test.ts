/**
 * netboxClient.test.ts
 *
 * Unit tests for NetBox DCIM REST API schema mapping, position transformations,
 * bidirectional sync client, and mock fallback service.
 */

import { describe, it, expect } from 'vitest';
import {
  mapNetBoxDeviceTypeToLocal,
  netboxPositionToWorldY,
  worldYToNetBoxPosition,
  transformNetBoxToRack,
  NetBoxClient,
} from '../netboxClient';
import {
  MOCK_NETBOX_RACKS,
  MOCK_NETBOX_DEVICES,
  MOCK_NETBOX_CABLES,
} from '../mockNetboxData';
import { RACK_UNIT_HEIGHT } from '../../../store/useConfiguratorStore';
import type { NetBoxDeviceType } from '../../../types/netbox.types';
import type { RackInstance } from '../../../types/rack.types';

describe('netboxClient — Schema & Device Type Mapping', () => {
  it('maps NetBox device types accurately to local hardware categories', () => {
    const switchDT: NetBoxDeviceType = {
      id: 1,
      manufacturer: { name: 'Cisco' },
      model: 'Catalyst 9300 48-Port Switch',
      u_height: 1,
    };
    expect(mapNetBoxDeviceTypeToLocal(switchDT).type).toBe('switch');

    const routerDT: NetBoxDeviceType = {
      id: 2,
      manufacturer: { name: 'Juniper' },
      model: 'MX204 Edge Router',
      u_height: 1,
    };
    expect(mapNetBoxDeviceTypeToLocal(routerDT).type).toBe('router');

    const fwDT: NetBoxDeviceType = {
      id: 3,
      manufacturer: { name: 'Fortinet' },
      model: 'FortiGate 200F Firewall',
      u_height: 1,
    };
    expect(mapNetBoxDeviceTypeToLocal(fwDT).type).toBe('firewall');

    const serverDT: NetBoxDeviceType = {
      id: 4,
      manufacturer: { name: 'Dell' },
      model: 'PowerEdge R760 Rack Server',
      u_height: 2,
    };
    expect(mapNetBoxDeviceTypeToLocal(serverDT).type).toBe('server');
    expect(mapNetBoxDeviceTypeToLocal(serverDT).powerDraw).toBe(500); // 250 * 2U
  });
});

describe('netboxClient — Position Transformations', () => {
  it('converts between 1-indexed NetBox bottom U and 3D rack-local Y coordinate', () => {
    // 2U chassis starting at U1:
    // Bottom = 0, Center = 1U = 0.04445m
    const yCenter = netboxPositionToWorldY(1, 2);
    expect(yCenter).toBeCloseTo(RACK_UNIT_HEIGHT, 5);

    const backToU = worldYToNetBoxPosition(yCenter, 2);
    expect(backToU).toBe(1);

    // 4U chassis starting at U10:
    // Bottom = 9 * 0.04445, Center = (9 + 2) * 0.04445 = 11 * 0.04445
    const yCenter4U = netboxPositionToWorldY(10, 4);
    expect(yCenter4U).toBeCloseTo(11 * RACK_UNIT_HEIGHT, 5);

    const backToU4U = worldYToNetBoxPosition(yCenter4U, 4);
    expect(backToU4U).toBe(10);
  });
});

describe('netboxClient — NetBox to Rack Transformer', () => {
  it('transforms NetBox rack, devices, and cables into local 3D RackInstance', () => {
    const netboxRack = MOCK_NETBOX_RACKS[0];
    const devices = MOCK_NETBOX_DEVICES.filter((d) => d.rack.id === netboxRack.id);
    const cables = MOCK_NETBOX_CABLES;

    const { rack, cables: localCables } = transformNetBoxToRack(
      netboxRack,
      devices,
      cables,
    );

    expect(rack.name).toBe('FRA-RACK-A01');
    expect(rack.capacity).toBe(42);
    expect(rack.installedHardware.length).toBe(devices.length);

    // Verify first device (Dell 2U server @ U1)
    const firstHw = rack.installedHardware[0];
    expect(firstHw.id).toBe('nb-1001');
    expect(firstHw.type).toBe('server');
    expect(firstHw.rackUnits).toBe(2);

    // Verify cables
    expect(localCables.length).toBe(cables.length);
    expect(localCables[0].fromDevice).toBe('nb-1001');
    expect(localCables[0].toDevice).toBe('nb-1003');
    expect(localCables[0].type).toBe('copper-cat6a');
  });
});

describe('netboxClient — NetBoxClient Mock API Operations', () => {
  const client = new NetBoxClient({
    url: 'https://netbox.mock.internal',
    token: 'mock-token',
    mockMode: true,
  });

  it('fetches sites and racks in mock mode', async () => {
    const sites = await client.fetchSites();
    expect(sites.length).toBeGreaterThan(0);
    expect(sites[0].slug).toBe('fra-01');

    const racks = await client.fetchRacks();
    expect(racks.length).toBeGreaterThan(0);
    expect(racks[0].name).toBe('FRA-RACK-A01');
  });

  it('imports full rack in mock mode', async () => {
    const { rack, cables } = await client.importRack(101);
    expect(rack.name).toBe('FRA-RACK-A01');
    expect(rack.installedHardware.length).toBeGreaterThan(0);
    expect(cables.length).toBeGreaterThan(0);
  });

  it('simulates push sync to NetBox in mock mode', async () => {
    const mockLocalRack: RackInstance = {
      id: 'local-rack-1',
      name: 'Local Test Bay',
      capacity: 42,
      rackType: 'cabinet',
      isDoorOpen: false,
      position: [0, 0, 0],
      installedHardware: [
        {
          id: 'dev-1',
          type: 'switch',
          rackUnits: 1,
          powerDraw: 100,
          depth: 0.4,
          position: [0, 0.022225, 0],
        },
      ],
    };

    const result = await client.syncRackToNetBox(mockLocalRack);
    expect(result.success).toBe(true);
    expect(result.importedDevicesCount).toBe(1);
    expect(result.logs.some((l) => l.includes('Device switch'))).toBe(true);
  });
});
