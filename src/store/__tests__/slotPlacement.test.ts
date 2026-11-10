/**
 * slotPlacement.test.ts
 *
 * Store-level rack slot behaviour:
 * - `addHardware` places new devices into the lowest free gap and
 *   refuses (returns null, state unchanged) when nothing fits — AUDIT B1.
 * - `moveHardwareByUnits` moves a device by whole U, validated against
 *   rails and collisions (used by keyboard + inspector buttons).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useConfiguratorStore } from '../useConfiguratorStore';
import { centerYToUStart } from '../../utils/rackLayout';

const RACK_ID = 'rack-test';

function reset(capacity = 42) {
  useConfiguratorStore.setState({
    racks: [
      {
        id: RACK_ID,
        name: 'Rack T',
        capacity,
        rackType: '4-post',
        isDoorOpen: false,
        position: [0, 0, 0],
        installedHardware: [],
      },
    ],
    activeRackId: RACK_ID,
    capacity,
    installedHardware: [],
    cables: [],
    selectedHardwareId: null,
    selectedCableId: null,
    hddBays: {},
    past: [],
    future: [],
  });
}

const uStartOf = (id: string) => {
  const h = useConfiguratorStore.getState().installedHardware.find((x) => x.id === id)!;
  return centerYToUStart(h.position[1], h.rackUnits);
};

beforeEach(() => reset());

describe('addHardware slot placement', () => {
  it('returns the new id and mounts at U1 in an empty rack', () => {
    const id = useConfiguratorStore.getState().addHardware('server', 2);
    expect(id).toBeTypeOf('string');
    expect(uStartOf(id!)).toBe(1);
  });

  it('fills a gap left by a removed device', () => {
    const s = useConfiguratorStore.getState();
    const a = s.addHardware('switch', 1)!; // U1
    const b = s.addHardware('switch', 1)!; // U2
    s.addHardware('switch', 1); // U3
    s.removeHardware(b);
    const c = useConfiguratorStore.getState().addHardware('firewall', 1)!;
    expect(uStartOf(a)).toBe(1);
    expect(uStartOf(c)).toBe(2);
  });

  it('refuses to overflow a full rack (no device above the top U)', () => {
    reset(4);
    const s = useConfiguratorStore.getState();
    expect(s.addHardware('server', 4)).not.toBeNull();
    const before = useConfiguratorStore.getState().racks;
    expect(useConfiguratorStore.getState().addHardware('switch', 1)).toBeNull();
    expect(useConfiguratorStore.getState().racks).toBe(before);
    expect(useConfiguratorStore.getState().installedHardware).toHaveLength(1);
  });

  it('refuses an invalid U height', () => {
    expect(useConfiguratorStore.getState().addHardware('server', 0)).toBeNull();
    expect(useConfiguratorStore.getState().addHardware('server', 43)).toBeNull();
  });
});

describe('moveHardwareByUnits', () => {
  it('moves a device up by one U when the slot is free', () => {
    const id = useConfiguratorStore.getState().addHardware('server', 2)!;
    expect(useConfiguratorStore.getState().moveHardwareByUnits(id, 1)).toBe(true);
    expect(uStartOf(id)).toBe(2);
  });

  it('refuses to move below U1', () => {
    const id = useConfiguratorStore.getState().addHardware('server', 2)!;
    expect(useConfiguratorStore.getState().moveHardwareByUnits(id, -1)).toBe(false);
    expect(uStartOf(id)).toBe(1);
  });

  it('refuses to move into another device', () => {
    const s = useConfiguratorStore.getState();
    const a = s.addHardware('server', 2)!; // U1-U2
    s.addHardware('switch', 1); // U3
    expect(useConfiguratorStore.getState().moveHardwareByUnits(a, 1)).toBe(false);
    expect(uStartOf(a)).toBe(1);
  });

  it('records an undo snapshot for a successful move', () => {
    const id = useConfiguratorStore.getState().addHardware('server', 1)!;
    useConfiguratorStore.getState().moveHardwareByUnits(id, 3);
    expect(uStartOf(id)).toBe(4);
    useConfiguratorStore.getState().undo();
    expect(uStartOf(id)).toBe(1);
  });

  it('returns false for an unknown id', () => {
    expect(useConfiguratorStore.getState().moveHardwareByUnits('nope', 1)).toBe(false);
  });
});
