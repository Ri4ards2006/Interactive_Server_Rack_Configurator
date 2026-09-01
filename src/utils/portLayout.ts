/**
 * portLayout.ts
 *
 * Pure-math port coordinate generators for standard EIA-310 hardware.
 * Decoupled from React, Three.js, and Zustand stores to eliminate circular dependencies.
 */

import type { HardwareType, PortProps } from '../types/rack.types';

const RACK_UNIT_HEIGHT = 0.04445;
const CHASSIS_WIDTH = 0.44;
const EDGE_GAP = 0.005;

/**
 * Generate relative 3D port coordinates on chassis plates.
 */
export function generateDevicePorts(
  type: HardwareType,
  depth: number = 0.6,
  rackUnits: number = 1,
): PortProps[] | undefined {
  if (type === 'switch') {
    const ports: PortProps[] = [];
    const portRows = 2;
    const PORT_COLS = 24;
    const PORT_W = 0.008;
    const PORT_GAP_X = 0.004;
    const PORT_GAP_Y = 0.004;
    const PORT_H = 0.006;
    const groupWidth = 12 * PORT_W + 11 * PORT_GAP_X;
    const gapBetweenGroups = 0.02;
    const startY = -((portRows * PORT_H + (portRows - 1) * PORT_GAP_Y) / 2) - 0.002;

    const getPortX = (c: number) => {
      const isSecondGroup = c >= 12;
      const groupCol = c % 12;
      const base = -groupWidth - gapBetweenGroups / 2;
      if (isSecondGroup) {
        return gapBetweenGroups / 2 + groupCol * (PORT_W + PORT_GAP_X) + PORT_W / 2;
      }
      return base + groupCol * (PORT_W + PORT_GAP_X) + PORT_W / 2;
    };

    let pIndex = 1;
    for (let r = 0; r < portRows; r++) {
      for (let c = 0; c < PORT_COLS; c++) {
        ports.push({
          id: `port-${pIndex}`,
          label: `Port ${pIndex}`,
          position: [getPortX(c), startY + r * (PORT_H + PORT_GAP_Y), 0.39 + 0.002],
          cableId: null,
        });
        pIndex++;
      }
    }
    return ports;
  }

  if (type === 'firewall') {
    const ports: PortProps[] = [];
    const copperPortsX = [-0.06, -0.046, -0.032, -0.018, 0.002, 0.016, 0.030, 0.044];
    copperPortsX.forEach((x, idx) => {
      ports.push({
        id: `port-${idx + 1}`,
        label: `GE ${idx + 1}`,
        position: [x, -0.002, 0.39 + 0.003],
        cableId: null,
      });
    });
    const sfpPortsX = [0.076, 0.092, 0.108, 0.124];
    sfpPortsX.forEach((x, idx) => {
      ports.push({
        id: `sfp-${idx + 1}`,
        label: `SFP+ ${idx + 1}`,
        position: [x, -0.002, 0.39 + 0.003],
        cableId: null,
      });
    });
    return ports;
  }

  if (type === 'router') {
    const ports: PortProps[] = [];
    const sfpRows = 1;
    const SFP_COLS = 16;
    const SFP_W = 0.009;
    const SFP_GAP_X = 0.006;
    const SFP_GAP_Y = 0.006;
    const SFP_H = 0.009;
    const chassisHeight = (rackUnits || 1) * RACK_UNIT_HEIGHT - EDGE_GAP;
    const totalSfpGridW = SFP_COLS * SFP_W + (SFP_COLS - 1) * SFP_GAP_X;
    const totalSfpGridH = sfpRows * SFP_H + (sfpRows - 1) * SFP_GAP_Y;
    const sfpStartX = CHASSIS_WIDTH / 2 - 0.025 - totalSfpGridW + SFP_W / 2;
    const sfpStartY = -chassisHeight / 2 + totalSfpGridH / 2 + 0.01;

    let pIndex = 1;
    for (let r = 0; r < sfpRows; r++) {
      for (let c = 0; c < SFP_COLS; c++) {
        ports.push({
          id: `sfp-${pIndex}`,
          label: `SFP+ ${pIndex}`,
          position: [
            sfpStartX + c * (SFP_W + SFP_GAP_X),
            sfpStartY + r * (SFP_H + SFP_GAP_Y),
            0.39 + 0.003,
          ],
          cableId: null,
        });
        pIndex++;
      }
    }
    return ports;
  }

  if (type === 'server' || type === 'nas') {
    const serverPortsX = [-0.1, -0.06, 0.06, 0.1];
    return serverPortsX.map((x, idx) => ({
      id: `port-${idx + 1}`,
      label: `LAN ${idx + 1}`,
      position: [x, -0.008, 0.39 - depth],
      cableId: null,
    }));
  }

  if (type === 'patch-panel') {
    return Array.from({ length: 24 }, (_, idx) => ({
      id: `port-${idx + 1}`,
      label: `Port ${idx + 1}`,
      position: [-0.16 + idx * (0.32 / 23), 0, 0.39 + 0.002],
      cableId: null,
    }));
  }

  return undefined;
}

