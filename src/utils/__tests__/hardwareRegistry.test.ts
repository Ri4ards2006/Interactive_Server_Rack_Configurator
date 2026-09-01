/**
 * hardwareRegistry.test.ts
 *
 * Unit tests for the extensible HardwareRegistry service.
 */

import { describe, it, expect } from 'vitest';
import { hardwareRegistry, HardwareRegistryService } from '../hardwareRegistry';
import type { HardwarePluginDefinition } from '../../types/plugin.types';

describe('HardwareRegistryService — Built-in Plugins', () => {
  it('registers all 12 canonical hardware plugins on startup', () => {
    const all = hardwareRegistry.getAllPlugins();
    expect(all.length).toBe(12);

    const types = all.map((p) => p.type);
    expect(types).toContain('server');
    expect(types).toContain('switch');
    expect(types).toContain('router');
    expect(types).toContain('patch-panel');
    expect(types).toContain('firewall');
    expect(types).toContain('jbod');
    expect(types).toContain('nas');
    expect(types).toContain('ups');
    expect(types).toContain('kvm');
    expect(types).toContain('blank');
    expect(types).toContain('brush');
    expect(types).toContain('cable-manager');
  });

  it('retrieves plugins by type or ID', () => {
    const serverPlugin = hardwareRegistry.getPlugin('server');
    expect(serverPlugin).toBeDefined();
    expect(serverPlugin?.name).toBe('Enterprise Server');
    expect(serverPlugin?.category).toBe('compute');

    const byId = hardwareRegistry.getPlugin('generic:switch');
    expect(byId).toBeDefined();
    expect(byId?.type).toBe('switch');
  });

  it('filters plugins by category', () => {
    const networking = hardwareRegistry.getPluginsByCategory('networking');
    expect(networking.length).toBe(4);
    const netTypes = networking.map((p) => p.type);
    expect(netTypes).toEqual(
      expect.arrayContaining(['switch', 'router', 'patch-panel', 'firewall']),
    );

    const storage = hardwareRegistry.getPluginsByCategory('storage');
    expect(storage.length).toBe(2);
    expect(storage.map((p) => p.type)).toEqual(
      expect.arrayContaining(['jbod', 'nas']),
    );
  });

  it('resolves valid React renderer components for each built-in type', () => {
    const types = [
      'server',
      'switch',
      'router',
      'patch-panel',
      'firewall',
      'jbod',
      'nas',
      'ups',
      'kvm',
      'blank',
      'brush',
      'cable-manager',
    ] as const;

    for (const type of types) {
      const renderer = hardwareRegistry.getRenderer(type);
      expect(renderer).toBeDefined();
      expect(typeof renderer).toBe('function');
    }
  });

  it('computes default specs dynamically based on rackUnits', () => {
    const server1U = hardwareRegistry.getDefaultSpecs('server', 1);
    expect(server1U.powerDraw).toBe(150);
    expect(server1U.depth).toBe(0.6);
    expect(server1U.ports?.length).toBe(4);

    const server2U = hardwareRegistry.getDefaultSpecs('server', 2);
    expect(server2U.powerDraw).toBe(300);

    const server4U = hardwareRegistry.getDefaultSpecs('server', 4);
    expect(server4U.powerDraw).toBe(500);

    const switchSpecs = hardwareRegistry.getDefaultSpecs('switch', 1);
    expect(switchSpecs.powerDraw).toBe(50);
    expect(switchSpecs.depth).toBe(0.3);
    expect(switchSpecs.ports?.length).toBe(48);
  });
});

describe('HardwareRegistryService — Custom Plugin Registration', () => {
  it('supports runtime registration of third-party vendor plugins', () => {
    const customRegistry = new HardwareRegistryService();
    const DummyComponent = () => null;

    const customPlugin: HardwarePluginDefinition = {
      id: 'vendor-x:edge-ai-accelerator',
      type: 'server',
      vendor: 'VendorX',
      model: 'AI-Edge-4000',
      name: 'Neural Inference Blade 2U',
      category: 'compute',
      rackUnits: 2,
      depthMeters: 0.7,
      defaultPowerDraw: 850,
      thermalProfile: {
        idlePowerWatts: 150,
        maxPowerWatts: 1000,
        targetDeltaTCelsius: 20,
        airflowDirection: 'front-to-back',
      },
    };

    customRegistry.register(customPlugin, DummyComponent);

    const retrieved = customRegistry.getPlugin('vendor-x:edge-ai-accelerator');
    expect(retrieved).toBeDefined();
    expect(retrieved?.model).toBe('AI-Edge-4000');
    expect(retrieved?.defaultPowerDraw).toBe(850);

    const renderer = customRegistry.getRenderer('vendor-x:edge-ai-accelerator');
    expect(renderer).toBe(DummyComponent);
  });
});

