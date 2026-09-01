/**
 * multiRack.test.ts
 *
 * Comprehensive unit test suite for Multi-Rack Baying,
 * side-by-side row coordinate math, active bay switching,
 * cross-rack cable routing, and Undo/Redo persistence.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useConfiguratorStore,
  BAY_SPACING,
  RACK_UNIT_HEIGHT,
} from '../useConfiguratorStore';
import { calculateCableCurve, getPortWorldPosition } from '../../utils/cableGeometry';
import * as THREE from 'three';

describe('Multi-Rack Baying & Architecture', () => {
  beforeEach(() => {
    // Reset store to a clean state
    useConfiguratorStore.setState({
      racks: [
        {
          id: 'test-rack-1',
          name: 'Rack A',
          capacity: 42,
          rackType: '2-post',
          isDoorOpen: false,
          position: [0, 0, 0],
          installedHardware: [],
        },
      ],
      activeRackId: 'test-rack-1',
      capacity: 42,
      rackType: '2-post',
      isDoorOpen: false,
      installedHardware: [],
      cables: [],
      selectedHardwareId: null,
      selectedCableId: null,
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  });

  it('initializes with a default primary rack bay at origin [0, 0, 0]', () => {
    const state = useConfiguratorStore.getState();
    expect(state.racks.length).toBe(1);
    expect(state.racks[0].id).toBe('test-rack-1');
    expect(state.racks[0].position).toEqual([0, 0, 0]);
  });

  it('adds adjacent rack bays with exact standard BAY_SPACING (800mm)', () => {
    const store = useConfiguratorStore.getState();
    store.addRack('Rack B', 'cabinet');

    const state = useConfiguratorStore.getState();
    expect(state.racks.length).toBe(2);
    expect(state.racks[1].name).toBe('Rack B');
    expect(state.racks[1].rackType).toBe('cabinet');
    expect(state.racks[1].position).toEqual([BAY_SPACING, 0, 0]); // [0.8, 0, 0]
    expect(state.activeRackId).toBe(state.racks[1].id);

    // Add a 3rd bay
    state.addRack('Rack C', '4-post');
    const state3 = useConfiguratorStore.getState();
    expect(state3.racks.length).toBe(3);
    expect(state3.racks[2].position).toEqual([2 * BAY_SPACING, 0, 0]); // [1.6, 0, 0]
  });

  it('switches active rack and exposes backward-compatible proxy properties', () => {
    const store = useConfiguratorStore.getState();
    store.addRack('Rack B', 'cabinet');
    const rackBId = useConfiguratorStore.getState().activeRackId;

    // Add hardware into Rack B
    useConfiguratorStore.getState().addHardware('server', 2);
    expect(useConfiguratorStore.getState().installedHardware.length).toBe(1);

    // Switch back to Rack A
    useConfiguratorStore.getState().setActiveRackId('test-rack-1');
    const stateA = useConfiguratorStore.getState();
    expect(stateA.activeRackId).toBe('test-rack-1');
    expect(stateA.rackType).toBe('2-post');
    expect(stateA.installedHardware.length).toBe(0); // isolated from Rack B

    // Switch to Rack B
    stateA.setActiveRackId(rackBId);
    const stateB = useConfiguratorStore.getState();
    expect(stateB.activeRackId).toBe(rackBId);
    expect(stateB.rackType).toBe('cabinet');
    expect(stateB.installedHardware.length).toBe(1);
  });

  it('removes a rack bay, re-indexes remaining bay positions, and purges orphaned cables', () => {
    const store = useConfiguratorStore.getState();
    store.addHardware('server', 2); // In Rack A
    const serverAId = useConfiguratorStore.getState().installedHardware[0].id;

    store.addRack('Rack B', '2-post'); // In Rack B
    store.addHardware('switch', 1);
    const switchBId = useConfiguratorStore.getState().installedHardware[0].id;

    // Patch cross-rack cable from Server in Rack A to Switch in Rack B
    store.addCable(serverAId, 'port-1', switchBId, 'port-1', '#3b82f6', 'copper-cat6');
    expect(useConfiguratorStore.getState().cables.length).toBe(1);

    // Add a 3rd bay (Rack C)
    store.addRack('Rack C', 'cabinet');
    const rackBId = useConfiguratorStore.getState().racks[1].id;

    // Delete middle bay (Rack B)
    useConfiguratorStore.getState().removeRack(rackBId);
    const finalState = useConfiguratorStore.getState();

    expect(finalState.racks.length).toBe(2);
    expect(finalState.racks[0].name).toBe('Rack A');
    expect(finalState.racks[0].position).toEqual([0, 0, 0]);
    expect(finalState.racks[1].name).toBe('Rack C');
    expect(finalState.racks[1].position).toEqual([BAY_SPACING, 0, 0]); // re-indexed from 1.6m to 0.8m

    // Cross-rack cable should be automatically purged
    expect(finalState.cables.length).toBe(0);
  });

  it('does not allow deleting the last remaining rack', () => {
    const store = useConfiguratorStore.getState();
    expect(store.racks.length).toBe(1);

    store.removeRack(store.racks[0].id);
    expect(useConfiguratorStore.getState().racks.length).toBe(1);
  });
});

describe('Multi-Rack Cross-Cabinet 3D Cabling', () => {
  it('calculates accurate world port positions across bay offsets', () => {
    const mockDevice = {
      id: 'srv-1',
      type: 'server' as const,
      rackUnits: 2,
      powerDraw: 300,
      depth: 0.6,
      position: [0, 0.2, 0] as [number, number, number],
      ports: [
        {
          id: 'port-1',
          label: 'LAN 1',
          position: [-0.1, -0.008, 0.392] as [number, number, number],
          cableId: null,
        },
      ],
    };

    // In Rack A (offset [0, 0, 0])
    const pA = getPortWorldPosition(mockDevice, 'port-1', [0, 0, 0]);
    expect(pA?.x).toBeCloseTo(-0.1);

    // In Rack B (offset [0.8, 0, 0])
    const pB = getPortWorldPosition(mockDevice, 'port-1', [BAY_SPACING, 0, 0]);
    expect(pB?.x).toBeCloseTo(0.7); // 0.8 - 0.1
    expect(pB?.y).toBeCloseTo(0.2 - 0.008);
  });

  it('generates cross-rack Catmull-Rom curves with realistic length spanning bays', () => {
    const pRackA = new THREE.Vector3(-0.1, 0.5, 0.392);
    const pRackB = new THREE.Vector3(0.7, 0.5, 0.392); // spanning 800mm to adjacent bay

    const result = calculateCableCurve(pRackA, pRackB, 'fiber-om4');

    expect(result.curve).toBeDefined();
    // Distance must exceed the 0.8m horizontal bay span
    expect(result.evaluation.lengthMeters).toBeGreaterThan(0.8);
    expect(typeof result.evaluation.hasBendViolation).toBe('boolean');
  });
});

describe('Multi-Rack Undo/Redo Temporal State', () => {
  it('reverts and re-applies multi-rack bay additions and deletions cleanly', () => {
    useConfiguratorStore.setState({
      racks: [
        {
          id: 'test-rack-1',
          name: 'Rack A',
          capacity: 42,
          rackType: '2-post',
          isDoorOpen: false,
          position: [0, 0, 0],
          installedHardware: [],
        },
      ],
      activeRackId: 'test-rack-1',
      capacity: 42,
      rackType: '2-post',
      isDoorOpen: false,
      installedHardware: [],
      cables: [],
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });

    const store = useConfiguratorStore.getState();
    store.addRack('Rack B', 'cabinet');
    expect(useConfiguratorStore.getState().racks.length).toBe(2);
    expect(useConfiguratorStore.getState().canUndo).toBe(true);

    // Undo rack addition
    useConfiguratorStore.getState().undo();
    expect(useConfiguratorStore.getState().racks.length).toBe(1);
    expect(useConfiguratorStore.getState().canRedo).toBe(true);

    // Redo rack addition
    useConfiguratorStore.getState().redo();
    expect(useConfiguratorStore.getState().racks.length).toBe(2);
    expect(useConfiguratorStore.getState().racks[1].name).toBe('Rack B');
  });
});

