/**
 * mockNetboxData.ts
 *
 * Built-in mock NetBox DCIM API dataset for offline testing and demonstration.
 * Contains realistic enterprise datacenter sites, racks, devices, and cable schedules.
 */

import {
  NetBoxSite,
  NetBoxRack,
  NetBoxDevice,
  NetBoxCable,
} from '../../types/netbox.types';

export const MOCK_NETBOX_SITES: NetBoxSite[] = [
  { id: 1, name: 'FRA-01 (Frankfurt Main Datacenter)', slug: 'fra-01' },
  { id: 2, name: 'SJC-02 (Silicon Valley Colocation)', slug: 'sjc-02' },
];

export const MOCK_NETBOX_RACKS: NetBoxRack[] = [
  {
    id: 101,
    name: 'FRA-RACK-A01',
    facility: 'Hall 3, Row B, Pos 01',
    u_height: 42,
    width: 19,
    outer_depth: 1000,
    site: { id: 1, name: 'FRA-01 (Frankfurt Main Datacenter)' },
  },
  {
    id: 102,
    name: 'FRA-RACK-A02',
    facility: 'Hall 3, Row B, Pos 02',
    u_height: 42,
    width: 19,
    outer_depth: 1000,
    site: { id: 1, name: 'FRA-01 (Frankfurt Main Datacenter)' },
  },
];

export const MOCK_NETBOX_DEVICES: NetBoxDevice[] = [
  {
    id: 1001,
    name: 'fra01-compute-01',
    device_type: {
      id: 201,
      manufacturer: { id: 1, name: 'Dell' },
      model: 'PowerEdge R750',
      u_height: 2,
      is_full_depth: true,
    },
    rack: { id: 101, name: 'FRA-RACK-A01' },
    position: 1, // U1-U2
    face: 'front',
    status: 'active',
    primary_ip: { address: '10.200.1.11/24' },
  },
  {
    id: 1002,
    name: 'fra01-compute-02',
    device_type: {
      id: 201,
      manufacturer: { id: 1, name: 'Dell' },
      model: 'PowerEdge R750',
      u_height: 2,
      is_full_depth: true,
    },
    rack: { id: 101, name: 'FRA-RACK-A01' },
    position: 3, // U3-U4
    face: 'front',
    status: 'active',
    primary_ip: { address: '10.200.1.12/24' },
  },
  {
    id: 1003,
    name: 'fra01-tor-sw01',
    device_type: {
      id: 202,
      manufacturer: { id: 2, name: 'Cisco' },
      model: 'Catalyst 9300 48P',
      u_height: 1,
      is_full_depth: false,
    },
    rack: { id: 101, name: 'FRA-RACK-A01' },
    position: 24, // U24
    face: 'front',
    status: 'active',
    primary_ip: { address: '10.200.1.254/24' },
  },
  {
    id: 1004,
    name: 'fra01-firewall-01',
    device_type: {
      id: 203,
      manufacturer: { id: 3, name: 'Fortinet' },
      model: 'FortiGate 100F',
      u_height: 1,
      is_full_depth: false,
    },
    rack: { id: 101, name: 'FRA-RACK-A01' },
    position: 25, // U25
    face: 'front',
    status: 'active',
    primary_ip: { address: '10.200.1.1/24' },
  },
  {
    id: 1005,
    name: 'fra01-storage-jbod',
    device_type: {
      id: 204,
      manufacturer: { id: 4, name: 'Supermicro' },
      model: 'CSE-847 36-Bay JBOD',
      u_height: 4,
      is_full_depth: true,
    },
    rack: { id: 101, name: 'FRA-RACK-A01' },
    position: 30, // U30-U33
    face: 'front',
    status: 'active',
  },
  {
    id: 1006,
    name: 'fra01-ups-01',
    device_type: {
      id: 205,
      manufacturer: { id: 5, name: 'APC' },
      model: 'Smart-UPS RT 3000VA',
      u_height: 2,
      is_full_depth: true,
    },
    rack: { id: 101, name: 'FRA-RACK-A01' },
    position: 40, // U40-U41
    face: 'front',
    status: 'active',
  },
];

export const MOCK_NETBOX_CABLES: NetBoxCable[] = [
  {
    id: 5001,
    a_terminations: [
      {
        object_type: 'dcim.interface',
        object_id: 9001,
        object: {
          id: 9001,
          name: 'eth0',
          device: { id: 1001, name: 'fra01-compute-01' },
        },
      },
    ],
    b_terminations: [
      {
        object_type: 'dcim.interface',
        object_id: 9010,
        object: {
          id: 9010,
          name: 'GigabitEthernet1/0/1',
          device: { id: 1003, name: 'fra01-tor-sw01' },
        },
      },
    ],
    type: 'cat6a',
    color: '00ff00',
    length: 1.5,
    length_unit: 'm',
  },
  {
    id: 5002,
    a_terminations: [
      {
        object_type: 'dcim.interface',
        object_id: 9002,
        object: {
          id: 9002,
          name: 'eth0',
          device: { id: 1002, name: 'fra01-compute-02' },
        },
      },
    ],
    b_terminations: [
      {
        object_type: 'dcim.interface',
        object_id: 9011,
        object: {
          id: 9011,
          name: 'GigabitEthernet1/0/2',
          device: { id: 1003, name: 'fra01-tor-sw01' },
        },
      },
    ],
    type: 'cat6a',
    color: '00ffff',
    length: 1.5,
    length_unit: 'm',
  },
];

