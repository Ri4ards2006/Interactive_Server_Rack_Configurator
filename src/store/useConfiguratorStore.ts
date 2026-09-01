/**
 * Global Zustand store for the Interactive Server Rack Configurator.
 *
 * Architectural notes:
 * - The data shape (`capacity`, `installedHardware`, `cables`) is inherited
 *   from `RackState` — the documented persistence shape.
 * - Ephemeral UI state (`selectedHardwareId`, `viewMode`) lives on
 *   `ConfiguratorState`.
 * - High-frequency drag updates reside in `useDragStore.ts` to prevent
 *   re-rendering the full R3F component tree during 60 Hz pointer moves.
 * - Undo/Redo temporal state history stack tracks mutations to `RackSnapshot`
 *   with a 50-step capacity buffer.
 */

import { create } from 'zustand';
import {
  HardwareType,
  RackState,
  Vec3,
  CableProps,
  PortProps,
  HardwareProps,
} from '../types/rack.types';
import { hardwareRegistry } from '../utils/hardwareRegistry';
import { generateDevicePorts } from '../utils/portLayout';

export interface HddBayState {
  status: 'inserted' | 'extracted' | 'removed';
  isFailed: boolean;
}

export interface DraggingCableProps {
  cableId: string | null;
  fromDevice: string;
  fromPort: string;
  color: string;
  startPortGlobalPos: Vec3;
  currentMouseWorldPos: Vec3;
}

/**
 * Snapshot structure captured for Undo/Redo history.
 * Excludes transient selections, drag-in-flight state, and UI preferences.
 */
export interface RackSnapshot {
  capacity: number;
  installedHardware: HardwareProps[];
  cables: CableProps[];
  rackType: '2-post' | '4-post' | 'cabinet';
  isDoorOpen: boolean;
  hddBays: Record<string, Record<number, HddBayState>>;
}

/** 1U height in meters (~4.445 cm, the EIA-310 standard). */
export const RACK_UNIT_HEIGHT = 0.04445;

/** Shared chassis geometry constants */
export const CHASSIS_WIDTH = 0.44;
export const EDGE_GAP = 0.005;
export const SELECTION_OUTLINE_WIDTH = 0.47;
export const SELECTION_OUTLINE_INSET = 0.01;

const MAX_HISTORY = 50;

export interface ConfiguratorState extends RackState {
  /** ID of the hardware currently selected */
  selectedHardwareId: string | null;

  /** ID of the cable currently selected */
  selectedCableId: string | null;

  /** Set / clear active cable selection */
  selectCable: (id: string | null) => void;

  /** Visual presentation mode */
  viewMode: '3D' | 'blueprint';

  /** Active dragging state for interactive cable routing */
  activeDraggingCable: DraggingCableProps | null;

  /** HDD hot-swap caddy registry */
  hddBays: Record<string, Record<number, HddBayState>>;

  /** Rack frame style */
  rackType: '2-post' | '4-post' | 'cabinet';

  /** Front door open state */
  isDoorOpen: boolean;

  // -- Temporal History (Undo / Redo) -----------------------------------
  past: RackSnapshot[];
  future: RackSnapshot[];
  canUndo: boolean;
  canRedo: boolean;

  undo: () => void;
  redo: () => void;
  recordHistorySnapshot: () => void;
  clearHistory: () => void;

  // -- Mutators ----------------------------------------------------------
  toggleHddBay: (deviceId: string, bayIndex: number) => void;
  removeHddFromBay: (deviceId: string, bayIndex: number) => void;
  insertHddIntoBay: (deviceId: string, bayIndex: number) => void;
  simulateHddFailure: () => void;
  addHardware: (type: HardwareType, rackUnits: number) => void;
  removeHardware: (id: string) => void;
  updateHardwarePosition: (id: string, position: Vec3) => void;
  selectHardware: (id: string | null) => void;
  toggleViewMode: () => void;
  setRackType: (type: '2-post' | '4-post' | 'cabinet') => void;
  setDoorOpen: (isOpen: boolean) => void;
  addCable: (fromDevice: string, fromPort: string, toDevice: string, toPort: string, color: string) => void;
  removeCable: (id: string) => void;
  unpatchPort: (deviceId: string, portId: string) => void;
  startDraggingCable: (fromDevice: string, fromPort: string, startPortGlobalPos: Vec3, color?: string) => void;
  updateDraggingCable: (currentMouseWorldPos: Vec3) => void;
  stopDraggingCable: () => void;
}

const generateId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Deep clone state properties to form an immutable history snapshot.
 */
const createSnapshot = (state: {
  capacity: number;
  installedHardware: HardwareProps[];
  cables: CableProps[];
  rackType: '2-post' | '4-post' | 'cabinet';
  isDoorOpen: boolean;
  hddBays: Record<string, Record<number, HddBayState>>;
}): RackSnapshot => ({
  capacity: state.capacity,
  installedHardware: state.installedHardware.map((h) => ({
    ...h,
    position: [...h.position] as Vec3,
    ports: h.ports?.map((p: PortProps) => ({ ...p, position: [...p.position] as Vec3 })),
  })),
  cables: state.cables.map((c) => ({ ...c })),
  rackType: state.rackType,
  isDoorOpen: state.isDoorOpen,
  hddBays: Object.fromEntries(
    Object.entries(state.hddBays).map(([devId, bays]) => [
      devId,
      Object.fromEntries(
        Object.entries(bays).map(([idx, bay]) => [idx, { ...bay }]),
      ),
    ]),
  ),
});

/**
 * Helper to record previous state to history before executing a mutation.
 */
const pushHistory = (
  state: ConfiguratorState,
): { past: RackSnapshot[]; future: RackSnapshot[]; canUndo: boolean; canRedo: boolean } => {
  const currentSnapshot = createSnapshot(state);
  const nextPast = [...state.past.slice(-MAX_HISTORY + 1), currentSnapshot];
  return {
    past: nextPast,
    future: [],
    canUndo: true,
    canRedo: false,
  };
};

export const generatePortsForDevice = (
  type: HardwareType,
  depth: number = 0.6,
): PortProps[] | undefined => {
  return generateDevicePorts(type, depth);
};

// Seed default ports
const defaultServerPorts = generatePortsForDevice('server', 0.6)!;
defaultServerPorts.find((p) => p.id === 'port-4')!.cableId = 'default-cable-1';
defaultServerPorts.find((p) => p.id === 'port-3')!.cableId = 'default-cable-2';

const defaultSwitchPorts = generatePortsForDevice('switch', 0.3)!;
defaultSwitchPorts.find((p) => p.id === 'port-1')!.cableId = 'default-cable-1';
defaultSwitchPorts.find((p) => p.id === 'port-12')!.cableId = 'default-cable-2';

export const useConfiguratorStore = create<ConfiguratorState>((set) => ({
  capacity: 42,
  installedHardware: [
    {
      id: 'default-chassis-1',
      type: 'server',
      rackUnits: 2,
      powerDraw: 250,
      depth: 0.6,
      position: [0, 0.04445, 0],
      ports: defaultServerPorts,
    },
    {
      id: 'default-switch-1',
      type: 'switch',
      rackUnits: 1,
      powerDraw: 50,
      depth: 0.3,
      position: [0, 0.111125, 0],
      ports: defaultSwitchPorts,
    },
  ],
  cables: [
    {
      id: 'default-cable-1',
      fromDevice: 'default-chassis-1',
      fromPort: 'port-4',
      toDevice: 'default-switch-1',
      toPort: 'port-1',
      color: '#eab308',
    },
    {
      id: 'default-cable-2',
      fromDevice: 'default-chassis-1',
      fromPort: 'port-3',
      toDevice: 'default-switch-1',
      toPort: 'port-12',
      color: '#3b82f6',
    },
  ],
  selectedHardwareId: null,
  selectedCableId: null,
  selectCable: (id) => set({ selectedCableId: id }),
  viewMode: '3D',
  activeDraggingCable: null,
  hddBays: {
    'default-chassis-1': {
      0: { status: 'inserted', isFailed: false },
      1: { status: 'inserted', isFailed: false },
      2: { status: 'inserted', isFailed: false },
      3: { status: 'inserted', isFailed: true },
      4: { status: 'inserted', isFailed: false },
      5: { status: 'inserted', isFailed: false },
      6: { status: 'inserted', isFailed: false },
      7: { status: 'inserted', isFailed: false },
    },
  },
  rackType: '2-post',
  isDoorOpen: false,

  // Temporal history initial state
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return {};
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, -1);
      const currentSnapshot = createSnapshot(state);

      return {
        past: newPast,
        future: [currentSnapshot, ...state.future.slice(0, MAX_HISTORY - 1)],
        canUndo: newPast.length > 0,
        canRedo: true,
        capacity: previous.capacity,
        installedHardware: previous.installedHardware,
        cables: previous.cables,
        rackType: previous.rackType,
        isDoorOpen: previous.isDoorOpen,
        hddBays: previous.hddBays,
        selectedHardwareId:
          state.selectedHardwareId &&
          previous.installedHardware.some((h) => h.id === state.selectedHardwareId)
            ? state.selectedHardwareId
            : null,
        selectedCableId:
          state.selectedCableId &&
          previous.cables.some((c) => c.id === state.selectedCableId)
            ? state.selectedCableId
            : null,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return {};
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      const currentSnapshot = createSnapshot(state);

      return {
        past: [...state.past.slice(-MAX_HISTORY + 1), currentSnapshot],
        future: newFuture,
        canUndo: true,
        canRedo: newFuture.length > 0,
        capacity: next.capacity,
        installedHardware: next.installedHardware,
        cables: next.cables,
        rackType: next.rackType,
        isDoorOpen: next.isDoorOpen,
        hddBays: next.hddBays,
      };
    }),

  recordHistorySnapshot: () =>
    set((state) => {
      const current = createSnapshot(state);
      return {
        past: [...state.past.slice(-MAX_HISTORY + 1), current],
        future: [],
        canUndo: true,
        canRedo: false,
      };
    }),

  clearHistory: () =>
    set({ past: [], future: [], canUndo: false, canRedo: false }),

  addHardware: (type, rackUnits) =>
    set((state) => {
      const history = pushHistory(state);
      const currentHighestY = state.installedHardware.reduce((acc, h) => {
        const top = h.position[1] + (h.rackUnits * RACK_UNIT_HEIGHT) / 2;
        return Math.max(acc, top);
      }, 0);
      const centerY = currentHighestY + (rackUnits * RACK_UNIT_HEIGHT) / 2;

      const specs = hardwareRegistry.getDefaultSpecs(type, rackUnits);

      let bays: Record<number, HddBayState> = {};
      if (type === 'nas') {
        for (let i = 0; i < 12; i++) {
          bays[i] = { status: 'inserted', isFailed: false };
        }
      } else if (type === 'server') {
        const bayCount = rackUnits * 4;
        for (let i = 0; i < bayCount; i++) {
          bays[i] = { status: 'inserted', isFailed: false };
        }
      }

      const newId = generateId();

      return {
        ...history,
        installedHardware: [
          ...state.installedHardware,
          {
            id: newId,
            type,
            rackUnits,
            powerDraw: specs.powerDraw,
            depth: specs.depth,
            position: [0, centerY, 0],
            ports: specs.ports,
          },
        ],
        hddBays: {
          ...state.hddBays,
          [newId]: bays,
        },
      };
    }),

  removeHardware: (id) =>
    set((state) => {
      const history = pushHistory(state);
      const remainingCables = state.cables.filter(
        (c) => c.fromDevice !== id && c.toDevice !== id,
      );
      const isSelectedCableRemoved =
        state.selectedCableId &&
        remainingCables.every((c) => c.id !== state.selectedCableId);

      const nextHddBays = { ...state.hddBays };
      delete nextHddBays[id];

      return {
        ...history,
        installedHardware: state.installedHardware.filter((h) => h.id !== id),
        cables: remainingCables,
        hddBays: nextHddBays,
        selectedHardwareId:
          state.selectedHardwareId === id ? null : state.selectedHardwareId,
        selectedCableId: isSelectedCableRemoved ? null : state.selectedCableId,
      };
    }),

  toggleHddBay: (deviceId, bayIndex) =>
    set((state) => {
      const history = pushHistory(state);
      const deviceBays = state.hddBays[deviceId] || {};
      const current = deviceBays[bayIndex] || { status: 'inserted', isFailed: false };

      let nextStatus = current.status;
      if (current.status === 'inserted') {
        nextStatus = 'extracted';
      } else if (current.status === 'extracted') {
        nextStatus = 'removed';
      }

      return {
        ...history,
        hddBays: {
          ...state.hddBays,
          [deviceId]: {
            ...deviceBays,
            [bayIndex]: {
              ...current,
              status: nextStatus,
            },
          },
        },
      };
    }),

  removeHddFromBay: (deviceId, bayIndex) =>
    set((state) => {
      const history = pushHistory(state);
      const deviceBays = state.hddBays[deviceId] || {};
      const current = deviceBays[bayIndex] || { status: 'inserted', isFailed: false };
      return {
        ...history,
        hddBays: {
          ...state.hddBays,
          [deviceId]: {
            ...deviceBays,
            [bayIndex]: {
              ...current,
              status: 'removed',
            },
          },
        },
      };
    }),

  insertHddIntoBay: (deviceId, bayIndex) =>
    set((state) => {
      const history = pushHistory(state);
      const deviceBays = state.hddBays[deviceId] || {};
      return {
        ...history,
        hddBays: {
          ...state.hddBays,
          [deviceId]: {
            ...deviceBays,
            [bayIndex]: {
              status: 'inserted',
              isFailed: false,
            },
          },
        },
      };
    }),

  simulateHddFailure: () =>
    set((state) => {
      const eligible = state.installedHardware.filter(
        (h) => h.type === 'server' || h.type === 'nas',
      );
      if (eligible.length === 0) return {};

      const randomDevice = eligible[Math.floor(Math.random() * eligible.length)];
      const deviceBays = state.hddBays[randomDevice.id] || {};
      const bayIndexes = Object.keys(deviceBays).map(Number);
      if (bayIndexes.length === 0) return {};

      const healthyInserted = bayIndexes.filter(
        (idx) => deviceBays[idx].status === 'inserted' && !deviceBays[idx].isFailed,
      );
      if (healthyInserted.length === 0) return {};

      const failedIdx = healthyInserted[Math.floor(Math.random() * healthyInserted.length)];

      return {
        hddBays: {
          ...state.hddBays,
          [randomDevice.id]: {
            ...deviceBays,
            [failedIdx]: {
              ...deviceBays[failedIdx],
              isFailed: true,
            },
          },
        },
      };
    }),

  addCable: (fromDevice, fromPort, toDevice, toPort, color) =>
    set((state) => {
      const history = pushHistory(state);
      const cableId = generateId();
      return {
        ...history,
        cables: [
          ...state.cables,
          {
            id: cableId,
            fromDevice,
            fromPort,
            toDevice,
            toPort,
            color,
          },
        ],
        installedHardware: state.installedHardware.map((h) => {
          if (h.id === fromDevice || h.id === toDevice) {
            return {
              ...h,
              ports: h.ports?.map((p) => {
                if (h.id === fromDevice && p.id === fromPort) return { ...p, cableId };
                if (h.id === toDevice && p.id === toPort) return { ...p, cableId };
                return p;
              }),
            };
          }
          return h;
        }),
      };
    }),

  removeCable: (id) =>
    set((state) => {
      const targetCable = state.cables.find((c) => c.id === id);
      if (!targetCable) return {};
      const history = pushHistory(state);
      return {
        ...history,
        cables: state.cables.filter((c) => c.id !== id),
        selectedCableId: state.selectedCableId === id ? null : state.selectedCableId,
        installedHardware: state.installedHardware.map((h) => {
          if (h.id === targetCable.fromDevice || h.id === targetCable.toDevice) {
            return {
              ...h,
              ports: h.ports?.map((p) => {
                if (p.cableId === id) return { ...p, cableId: null };
                return p;
              }),
            };
          }
          return h;
        }),
      };
    }),

  unpatchPort: (deviceId, portId) =>
    set((state) => {
      const dev = state.installedHardware.find((h) => h.id === deviceId);
      const port = dev?.ports?.find((p) => p.id === portId);
      if (!port || !port.cableId) return {};

      const cableId = port.cableId;
      const targetCable = state.cables.find((c) => c.id === cableId);
      if (!targetCable) return {};
      const history = pushHistory(state);

      return {
        ...history,
        cables: state.cables.filter((c) => c.id !== cableId),
        selectedCableId: state.selectedCableId === cableId ? null : state.selectedCableId,
        installedHardware: state.installedHardware.map((h) => {
          if (h.id === targetCable.fromDevice || h.id === targetCable.toDevice) {
            return {
              ...h,
              ports: h.ports?.map((p) => {
                if (p.cableId === cableId) return { ...p, cableId: null };
                return p;
              }),
            };
          }
          return h;
        }),
      };
    }),

  startDraggingCable: (fromDevice, fromPort, startPortGlobalPos, color = '#3b82f6') =>
    set({
      activeDraggingCable: {
        cableId: null,
        fromDevice,
        fromPort,
        color,
        startPortGlobalPos,
        currentMouseWorldPos: startPortGlobalPos,
      },
    }),

  updateDraggingCable: (currentMouseWorldPos) =>
    set((state) => {
      if (!state.activeDraggingCable) return {};
      return {
        activeDraggingCable: {
          ...state.activeDraggingCable,
          currentMouseWorldPos,
        },
      };
    }),

  stopDraggingCable: () => set({ activeDraggingCable: null }),

  updateHardwarePosition: (id, position) =>
    set((state) => ({
      installedHardware: state.installedHardware.map((h) =>
        h.id === id ? { ...h, position } : h,
      ),
    })),

  selectHardware: (id) => set({ selectedHardwareId: id }),

  toggleViewMode: () =>
    set((state) => ({
      viewMode: state.viewMode === '3D' ? 'blueprint' : '3D',
    })),

  setRackType: (rackType) =>
    set((state) => {
      const history = pushHistory(state);
      return { ...history, rackType };
    }),

  setDoorOpen: (isDoorOpen) =>
    set((state) => {
      const history = pushHistory(state);
      return { ...history, isDoorOpen };
    }),
}));
