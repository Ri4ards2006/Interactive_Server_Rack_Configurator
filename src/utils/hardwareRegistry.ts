/**
 * hardwareRegistry.ts
 *
 * Dynamic Registry Service for hardware plugins.
 * Decouples hardware types from hardcoded switch statements and allows
 * runtime extension with custom vendor specifications and R3F renderers.
 */

import type { ComponentType } from 'react';
import type { HardwareProps, HardwareType, PortProps } from '../types/rack.types';
import type { HardwareCategory, HardwarePluginDefinition } from '../types/plugin.types';
import { CHASSIS_WIDTH, RACK_UNIT_HEIGHT, EDGE_GAP } from '../store/useConfiguratorStore';

// Built-in Hardware Component Renderers
import { Server } from '../components/canvas/Hardware/Server';
import { Switch } from '../components/canvas/Hardware/Switch';
import { Router } from '../components/canvas/Hardware/Router';
import { PatchPanel } from '../components/canvas/Hardware/PatchPanel';
import { Firewall } from '../components/canvas/Hardware/Firewall';
import { JBOD } from '../components/canvas/Hardware/JBOD';
import { NAS } from '../components/canvas/Hardware/NAS';
import { UPS } from '../components/canvas/Hardware/UPS';
import { KVMConsole } from '../components/canvas/Hardware/KVMConsole';
import { BlankingPanel } from '../components/canvas/Hardware/BlankingPanel';
import { BrushPanel } from '../components/canvas/Hardware/BrushPanel';
import { CableManager } from '../components/canvas/Hardware/CableManager';

export type HardwareRendererComponent = ComponentType<{ hardware: HardwareProps }>;

export class HardwareRegistryService {
  private plugins = new Map<string, HardwarePluginDefinition>();
  private renderers = new Map<string, HardwareRendererComponent>();

  constructor() {
    this.registerBuiltins();
  }

  /**
   * Register a hardware plugin definition and optional R3F renderer component.
   */
  public register(
    plugin: HardwarePluginDefinition,
    renderer?: HardwareRendererComponent,
  ): void {
    this.plugins.set(plugin.id, plugin);
    // Also index by type if not already occupied
    if (!this.plugins.has(plugin.type)) {
      this.plugins.set(plugin.type, plugin);
    }
    if (renderer) {
      this.renderers.set(plugin.id, renderer);
      this.renderers.set(plugin.type, renderer);
    }
  }

  /**
   * Look up a plugin definition by ID or hardware type.
   */
  public getPlugin(typeOrId: HardwareType | string): HardwarePluginDefinition | undefined {
    return this.plugins.get(typeOrId);
  }

  /**
   * Check if a plugin exists in the registry.
   */
  public has(typeOrId: string): boolean {
    return this.plugins.has(typeOrId);
  }

  /**
   * Retrieve all registered plugins.
   */
  public getAllPlugins(): HardwarePluginDefinition[] {
    // Unique list by plugin ID
    const unique = new Map<string, HardwarePluginDefinition>();
    for (const plugin of this.plugins.values()) {
      unique.set(plugin.id, plugin);
    }
    return Array.from(unique.values());
  }

  /**
   * Filter plugins by category.
   */
  public getPluginsByCategory(category: HardwareCategory): HardwarePluginDefinition[] {
    return this.getAllPlugins().filter((p) => p.category === category);
  }

  /**
   * Get the R3F renderer component for a given hardware type or plugin ID.
   */
  public getRenderer(typeOrId: HardwareType | string): HardwareRendererComponent | undefined {
    return this.renderers.get(typeOrId);
  }

  /**
   * Calculate default power, depth, and ports for a given hardware type and U-size.
   */
  public getDefaultSpecs(
    type: HardwareType,
    rackUnits: number,
  ): { powerDraw: number; depth: number; ports?: PortProps[] } {
    const plugin = this.getPlugin(type);
    if (!plugin) {
      return { powerDraw: 150, depth: 0.6 };
    }

    let power = plugin.defaultPowerDraw;
    if (type === 'server') {
      power = rackUnits === 1 ? 150 : rackUnits === 2 ? 300 : 500;
    } else if (type === 'router') {
      power = rackUnits === 1 ? 80 : 150;
    }

    const depth = plugin.depthMeters;
    const ports = plugin.portsGenerator ? plugin.portsGenerator(depth, rackUnits) : undefined;

    return { powerDraw: power, depth, ports };
  }

  /**
   * Register all 12 canonical built-in hardware types.
   */
  private registerBuiltins(): void {
    // 1. Server
    this.register(
      {
        id: 'generic:server',
        type: 'server',
        vendor: 'Standard',
        model: 'Compute Node',
        name: 'Enterprise Server',
        category: 'compute',
        rackUnits: 2,
        allowedRackUnits: [1, 2, 4],
        depthMeters: 0.6,
        defaultPowerDraw: 300,
        thermalProfile: {
          idlePowerWatts: 80,
          maxPowerWatts: 500,
          targetDeltaTCelsius: 15,
          airflowDirection: 'front-to-back',
        },
        portsGenerator: (depth) => {
          const serverPortsX = [-0.1, -0.06, 0.06, 0.1];
          return serverPortsX.map((x, idx) => ({
            id: `port-${idx + 1}`,
            label: `LAN ${idx + 1}`,
            position: [x, -0.008, 0.39 - depth],
            cableId: null,
          }));
        },
        interactions: { hasHotSwapDrives: true },
      },
      Server,
    );

    // 2. Switch
    this.register(
      {
        id: 'generic:switch',
        type: 'switch',
        vendor: 'Standard',
        model: 'Switch.Net 48G',
        name: 'Gigabit Switch 48-Port',
        category: 'networking',
        rackUnits: 1,
        depthMeters: 0.3,
        defaultPowerDraw: 50,
        thermalProfile: {
          idlePowerWatts: 25,
          maxPowerWatts: 60,
          targetDeltaTCelsius: 8,
          airflowDirection: 'front-to-back',
        },
        portsGenerator: () => {
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
        },
      },
      Switch,
    );

    // 3. Router
    this.register(
      {
        id: 'generic:router',
        type: 'router',
        vendor: 'Standard',
        model: 'Core-Rtr.1',
        name: 'Core Edge Router',
        category: 'networking',
        rackUnits: 1,
        allowedRackUnits: [1, 2],
        depthMeters: 0.4,
        defaultPowerDraw: 80,
        thermalProfile: {
          idlePowerWatts: 40,
          maxPowerWatts: 150,
          targetDeltaTCelsius: 10,
          airflowDirection: 'front-to-back',
        },
        portsGenerator: (_, rackUnits) => {
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
        },
      },
      Router,
    );

    // 4. Patch Panel
    this.register(
      {
        id: 'generic:patch-panel',
        type: 'patch-panel',
        vendor: 'Standard',
        model: 'Cable-Mng.P 24',
        name: 'Cat6A Patch Panel 24-Port',
        category: 'networking',
        rackUnits: 1,
        depthMeters: 0.1,
        defaultPowerDraw: 0,
        thermalProfile: {
          idlePowerWatts: 0,
          maxPowerWatts: 0,
          targetDeltaTCelsius: 0,
          airflowDirection: 'passive',
        },
        portsGenerator: () => {
          return Array.from({ length: 24 }, (_, idx) => ({
            id: `port-${idx + 1}`,
            label: `Port ${idx + 1}`,
            position: [-0.16 + idx * (0.32 / 23), 0, 0.39 + 0.002],
            cableId: null,
          }));
        },
      },
      PatchPanel,
    );

    // 5. Firewall
    this.register(
      {
        id: 'generic:firewall',
        type: 'firewall',
        vendor: 'Standard',
        model: 'NGFW-Security Gateway',
        name: 'Next-Gen Firewall Appliance',
        category: 'networking',
        rackUnits: 1,
        depthMeters: 0.3,
        defaultPowerDraw: 40,
        thermalProfile: {
          idlePowerWatts: 20,
          maxPowerWatts: 45,
          targetDeltaTCelsius: 6,
          airflowDirection: 'front-to-back',
        },
        portsGenerator: () => {
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
        },
      },
      Firewall,
    );

    // 6. JBOD
    this.register(
      {
        id: 'generic:jbod',
        type: 'jbod',
        vendor: 'Standard',
        model: 'Dense-Storage 36',
        name: 'JBOD Storage Expansion 4U',
        category: 'storage',
        rackUnits: 4,
        depthMeters: 0.65,
        defaultPowerDraw: 600,
        thermalProfile: {
          idlePowerWatts: 200,
          maxPowerWatts: 650,
          targetDeltaTCelsius: 18,
          airflowDirection: 'front-to-back',
        },
        interactions: { hasHotSwapDrives: true, driveCount: 36 },
      },
      JBOD,
    );

    // 7. NAS
    this.register(
      {
        id: 'generic:nas',
        type: 'nas',
        vendor: 'Standard',
        model: 'Storage-Node 12',
        name: 'NAS Storage Appliance 2U',
        category: 'storage',
        rackUnits: 2,
        depthMeters: 0.55,
        defaultPowerDraw: 150,
        thermalProfile: {
          idlePowerWatts: 60,
          maxPowerWatts: 180,
          targetDeltaTCelsius: 12,
          airflowDirection: 'front-to-back',
        },
        portsGenerator: (depth) => {
          const serverPortsX = [-0.1, -0.06, 0.06, 0.1];
          return serverPortsX.map((x, idx) => ({
            id: `port-${idx + 1}`,
            label: `LAN ${idx + 1}`,
            position: [x, -0.008, 0.39 - depth],
            cableId: null,
          }));
        },
        interactions: { hasHotSwapDrives: true, driveCount: 12 },
      },
      NAS,
    );

    // 8. UPS
    this.register(
      {
        id: 'generic:ups',
        type: 'ups',
        vendor: 'Standard',
        model: 'Battery-Backup 1500VA',
        name: 'Online UPS Power Supply 2U',
        category: 'auxiliary',
        rackUnits: 2,
        depthMeters: 0.6,
        defaultPowerDraw: -1500,
        thermalProfile: {
          idlePowerWatts: 30,
          maxPowerWatts: 80,
          targetDeltaTCelsius: 5,
          airflowDirection: 'front-to-back',
        },
      },
      UPS,
    );

    // 9. KVM Console
    this.register(
      {
        id: 'generic:kvm',
        type: 'kvm',
        vendor: 'Standard',
        model: 'Rack-Console 17',
        name: '1U LCD KVM Drawer',
        category: 'auxiliary',
        rackUnits: 1,
        depthMeters: 0.4,
        defaultPowerDraw: 30,
        thermalProfile: {
          idlePowerWatts: 10,
          maxPowerWatts: 35,
          targetDeltaTCelsius: 4,
          airflowDirection: 'passive',
        },
        interactions: { hasSlidingDrawer: true },
      },
      KVMConsole,
    );

    // 10. Blanking Panel
    this.register(
      {
        id: 'generic:blank',
        type: 'blank',
        vendor: 'Standard',
        model: 'Airflow-Baffle',
        name: 'Toolless Blanking Panel',
        category: 'airflow',
        rackUnits: 1,
        allowedRackUnits: [1, 2],
        depthMeters: 0.02,
        defaultPowerDraw: 0,
        thermalProfile: {
          idlePowerWatts: 0,
          maxPowerWatts: 0,
          targetDeltaTCelsius: 0,
          airflowDirection: 'passive',
        },
      },
      BlankingPanel,
    );

    // 11. Brush Panel
    this.register(
      {
        id: 'generic:brush',
        type: 'brush',
        vendor: 'Standard',
        model: 'Cable-Pass Brush 1U',
        name: 'Cable Brush Pass-Through 1U',
        category: 'airflow',
        rackUnits: 1,
        depthMeters: 0.02,
        defaultPowerDraw: 0,
        thermalProfile: {
          idlePowerWatts: 0,
          maxPowerWatts: 0,
          targetDeltaTCelsius: 0,
          airflowDirection: 'passive',
        },
      },
      BrushPanel,
    );

    // 12. Cable Manager
    this.register(
      {
        id: 'generic:cable-manager',
        type: 'cable-manager',
        vendor: 'Standard',
        model: 'Horizontal D-Ring Duct 2U',
        name: 'Horizontal Cable Manager 2U',
        category: 'airflow',
        rackUnits: 2,
        depthMeters: 0.08,
        defaultPowerDraw: 0,
        thermalProfile: {
          idlePowerWatts: 0,
          maxPowerWatts: 0,
          targetDeltaTCelsius: 0,
          airflowDirection: 'passive',
        },
      },
      CableManager,
    );
  }
}

export const hardwareRegistry = new HardwareRegistryService();
