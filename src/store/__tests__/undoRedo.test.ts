/**
 * undoRedo.test.ts
 *
 * Unit tests for the Undo/Redo temporal history system in useConfiguratorStore.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useConfiguratorStore } from '../useConfiguratorStore';

beforeEach(() => {
  useConfiguratorStore.setState({
    racks: [
      {
        id: 'default-rack-1',
        name: 'Rack A',
        capacity: 42,
        rackType: '2-post',
        isDoorOpen: false,
        position: [0, 0, 0],
        installedHardware: [],
      },
    ],
    activeRackId: 'default-rack-1',
    capacity: 42,
    installedHardware: [],
    cables: [],
    selectedHardwareId: null,
    selectedCableId: null,
    hddBays: {},
    viewMode: '3D',
    rackType: '2-post',
    isDoorOpen: false,
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
  });
});

describe('useConfiguratorStore — Undo / Redo History Stack', () => {
  it('starts with empty past and future stacks (canUndo=false, canRedo=false)', () => {
    const state = useConfiguratorStore.getState();
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
    expect(state.past.length).toBe(0);
    expect(state.future.length).toBe(0);
  });

  it('undoes adding a piece of hardware', () => {
    const { addHardware, undo, redo } = useConfiguratorStore.getState();

    // 1. Add switch
    addHardware('switch', 1);
    expect(useConfiguratorStore.getState().installedHardware.length).toBe(1);
    expect(useConfiguratorStore.getState().canUndo).toBe(true);
    expect(useConfiguratorStore.getState().canRedo).toBe(false);

    // 2. Undo addition
    undo();
    expect(useConfiguratorStore.getState().installedHardware.length).toBe(0);
    expect(useConfiguratorStore.getState().canUndo).toBe(false);
    expect(useConfiguratorStore.getState().canRedo).toBe(true);

    // 3. Redo addition
    redo();
    expect(useConfiguratorStore.getState().installedHardware.length).toBe(1);
    expect(useConfiguratorStore.getState().canUndo).toBe(true);
    expect(useConfiguratorStore.getState().canRedo).toBe(false);
  });

  it('undoes removing a piece of hardware and restores its state', () => {
    const { addHardware, removeHardware, undo, redo } = useConfiguratorStore.getState();

    addHardware('server', 2);
    const addedId = useConfiguratorStore.getState().installedHardware[0].id;

    removeHardware(addedId);
    expect(useConfiguratorStore.getState().installedHardware.length).toBe(0);

    // Undo removal -> server returns
    undo();
    expect(useConfiguratorStore.getState().installedHardware.length).toBe(1);
    expect(useConfiguratorStore.getState().installedHardware[0].id).toBe(addedId);

    // Redo removal -> server removed again
    redo();
    expect(useConfiguratorStore.getState().installedHardware.length).toBe(0);
  });

  it('undoes rackType and door state transitions', () => {
    const { setRackType, setDoorOpen, undo, redo } = useConfiguratorStore.getState();

    setRackType('cabinet');
    expect(useConfiguratorStore.getState().rackType).toBe('cabinet');

    setDoorOpen(true);
    expect(useConfiguratorStore.getState().isDoorOpen).toBe(true);

    // Undo door open
    undo();
    expect(useConfiguratorStore.getState().isDoorOpen).toBe(false);
    expect(useConfiguratorStore.getState().rackType).toBe('cabinet');

    // Undo rackType change
    undo();
    expect(useConfiguratorStore.getState().rackType).toBe('2-post');

    // Redo both
    redo();
    expect(useConfiguratorStore.getState().rackType).toBe('cabinet');
    redo();
    expect(useConfiguratorStore.getState().isDoorOpen).toBe(true);
  });

  it('undoes cable connections', () => {
    const { addHardware, addCable, removeCable, undo, redo } = useConfiguratorStore.getState();

    addHardware('server', 2);
    addHardware('switch', 1);

    const [srv, sw] = useConfiguratorStore.getState().installedHardware;

    addCable(srv.id, 'port-1', sw.id, 'port-1', '#3b82f6');
    expect(useConfiguratorStore.getState().cables.length).toBe(1);

    const cableId = useConfiguratorStore.getState().cables[0].id;

    // Undo cable addition
    undo();
    expect(useConfiguratorStore.getState().cables.length).toBe(0);

    // Redo cable addition
    redo();
    expect(useConfiguratorStore.getState().cables.length).toBe(1);

    // Remove cable and undo
    removeCable(cableId);
    expect(useConfiguratorStore.getState().cables.length).toBe(0);
    undo();
    expect(useConfiguratorStore.getState().cables.length).toBe(1);
  });

  it('discards future redo stack when a new mutation occurs after an undo', () => {
    const { addHardware, undo } = useConfiguratorStore.getState();

    addHardware('server', 2); // state 1
    addHardware('switch', 1); // state 2

    expect(useConfiguratorStore.getState().installedHardware.length).toBe(2);

    undo(); // back to state 1 (only server)
    expect(useConfiguratorStore.getState().installedHardware.length).toBe(1);
    expect(useConfiguratorStore.getState().canRedo).toBe(true);

    // Perform a new mutation (branching history)
    addHardware('firewall', 1);
    expect(useConfiguratorStore.getState().installedHardware.length).toBe(2);
    expect(useConfiguratorStore.getState().installedHardware[1].type).toBe('firewall');

    // Future redo stack must be cleared
    expect(useConfiguratorStore.getState().canRedo).toBe(false);
    expect(useConfiguratorStore.getState().future.length).toBe(0);
  });

  it('supports recordHistorySnapshot for manual checkpoints before dragging', () => {
    const { addHardware, recordHistorySnapshot, updateHardwarePosition, undo } =
      useConfiguratorStore.getState();

    addHardware('server', 2);
    const srv = useConfiguratorStore.getState().installedHardware[0];
    const initialY = srv.position[1];

    // Simulate drag start checkpoint
    recordHistorySnapshot();

    // Simulate drag movement
    updateHardwarePosition(srv.id, [0, 0.5, 0]);
    expect(useConfiguratorStore.getState().installedHardware[0].position[1]).toBe(0.5);

    // Undo should restore position before drag
    undo();
    expect(useConfiguratorStore.getState().installedHardware[0].position[1]).toBe(initialY);
  });
});

