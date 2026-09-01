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
import { generateDevicePorts } from './portLayout';

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
    let power = 150;
    let depth = 0.6;

    switch (type) {
      case 'server':
        power = rackUnits === 1 ? 150 : rackUnits === 2 ? 300 : 500;
        depth = 0.6;
        break;
      case 'switch':
        power = 50;
        depth = 0.3;
        break;
      case 'router':
        power = rackUnits === 1 ? 80 : 150;
        depth = 0.4;
        break;
      case 'patch-panel':
        power = 0;
        depth = 0.1;
        break;
      case 'ups':
        power = -1500;
        depth = 0.6;
        break;
      case 'kvm':
        power = 30;
        depth = 0.4;
        break;
      case 'jbod':
        power = 600;
        depth = 0.65;
        break;
      case 'blank':
        power = 0;
        depth = 0.02;
        break;
      case 'nas':
        power = 150;
        depth = 0.55;
        break;
      case 'firewall':
        power = 40;
        depth = 0.3;
        break;
      case 'brush':
        power = 0;
        depth = 0.02;
        break;
      case 'cable-manager':
        power = 0;
        depth = 0.08;
        break;
    }

    const ports = generateDevicePorts(type, depth, rackUnits);
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
        portsGenerator: (depth) => generateDevicePorts('server', depth),
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
        portsGenerator: (depth) => generateDevicePorts('switch', depth),
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
        portsGenerator: (depth, ru) => generateDevicePorts('router', depth, ru),
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
        portsGenerator: (depth) => generateDevicePorts('patch-panel', depth),
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
        portsGenerator: (depth) => generateDevicePorts('firewall', depth),
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
        portsGenerator: (depth) => generateDevicePorts('nas', depth),
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
