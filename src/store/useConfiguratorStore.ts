/**
 * Global Zustand store for the Interactive Server Rack Configurator.
 *
 * Architectural notes:
 * - Supports Multi-Rack bayed row layouts (`racks: RackInstance[]`, `activeRackId`).
 * - Cross-rack 3D cable routing across adjacent cabinets with pitch `BAY_SPACING = 0.8m`.
 * - Ephemeral UI state (`selectedHardwareId`, `viewMode`) lives on `ConfiguratorState`.
 * - High-frequency drag updates reside in `useDragStore.ts` to prevent
 *   re-rendering the full R3F component tree during 60 Hz pointer moves.
 * - Undo/Redo temporal state history stack tracks mutations to `RackSnapshot`.
 */

import { create } from 'zustand';
import {
  canPlaceAt,
  centerYToUStart,
  findFirstFreeSlot,
  uStartToCenterY,
} from '../utils/rackLayout';
import {
  HardwareType,
  RackFrameType,
  RackInstance,
  Vec3,
  CableProps,
  PortProps,
  HardwareProps,
} from '../types/rack.types';
import { CableType } from '../types/cable.types';
import type { DeviceNetworkConfig, PortNetworkConfig } from '../types/network.types';
import type {
  RoomDimensions,
  AisleContainmentConfig,
  CracUnit,
  DataHallConfig,
  TileType,
} from '../types/room.types';
import type {
  TelemetryConfig,
  ChassisLiveMetrics,
} from '../types/telemetry.types';
import {
  VoltageStandard,
  BreakerRating,
  FeedFailoverMode,
} from '../types/electrical.types';

export type ViewMode = '3D' | 'blueprint' | 'thermal' | 'topology';

export const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  provider: 'mock-stream',
  endpointUrl: 'http://localhost:9090',
  pollingIntervalMs: 2000,
  queryMap: {
    tempQuery: 'node_hwmon_temp_celsius',
    powerQuery: 'node_power_watts',
    fanQuery: 'node_fan_speed_rpm',
    networkRxQuery: 'rate(node_network_receive_bytes_total[1m]) * 8 / 1000000',
    networkTxQuery: 'rate(node_network_transmit_bytes_total[1m]) * 8 / 1000000',
  },
};

export const DEFAULT_DATA_HALL_CONFIG: DataHallConfig = {
  roomDimensions: {
    widthMeters: 12,
    depthMeters: 10,
    heightMeters: 3.5,
    raisedFloorHeightMeters: 0.6,
  },
  containment: {
    enabled: true,
    type: 'cold-aisle',
    roofHeightMeters: 2.4,
    doorOpen: false,
    tintColor: '#38bdf8',
  },
  cracUnits: [
    {
      id: 'crac-1',
      name: 'CRAC Unit A (North)',
      coolingKw: 60,
      airflowCFM: 9500,
      position: [-4.5, 0, -3.5],
      orientation: 0,
      status: 'online',
    },
    {
      id: 'crac-2',
      name: 'CRAC Unit B (South)',
      coolingKw: 60,
      airflowCFM: 9500,
      position: [4.5, 0, -3.5],
      orientation: 0,
      status: 'online',
    },
  ],
  tilesOverride: {},
};
import { hardwareRegistry } from '../utils/hardwareRegistry';
import { generateDevicePorts } from '../utils/portLayout';
import {
  calculateCableCurve,
  getPortWorldPosition,
} from '../utils/cableGeometry';

export interface HddBayState {
  status: 'inserted' | 'extracted' | 'removed';
  isFailed: boolean;
}

export interface DraggingCableProps {
  cableId: string | null;
  fromDevice: string;
  fromPort: string;
  color: string;
  type?: CableType;
  startPortGlobalPos: Vec3;
  currentMouseWorldPos: Vec3;
}

/**
 * Snapshot structure captured for Undo/Redo history.
 */
export interface RackSnapshot {
  racks: RackInstance[];
  activeRackId: string;
  cables: CableProps[];
  hddBays: Record<string, Record<number, HddBayState>>;
}

/** 1U height in meters (~4.445 cm, the EIA-310 standard). */
export const RACK_UNIT_HEIGHT = 0.04445;

/** Standard EIA cabinet bay pitch in meters (800mm). */
export const BAY_SPACING = 0.8;

/** Shared chassis geometry constants */
export const CHASSIS_WIDTH = 0.44;
export const EDGE_GAP = 0.005;
export const SELECTION_OUTLINE_WIDTH = 0.47;
export const SELECTION_OUTLINE_INSET = 0.01;

const MAX_HISTORY = 50;

export interface ConfiguratorState {
  /** Array of all bayed rack instances */
  racks: RackInstance[];

  /** Currently selected/focused rack ID */
  activeRackId: string;

  /** Active rack helper getters / proxy properties for backward compatibility */
  capacity: number;
  rackType: RackFrameType;
  isDoorOpen: boolean;
  installedHardware: HardwareProps[];

  /** All patched cable connections across any rack */
  cables: CableProps[];

  /** ID of the hardware currently selected */
  selectedHardwareId: string | null;

  /** ID of the cable currently selected */
  selectedCableId: string | null;

  /** Set / clear active cable selection */
  selectCable: (id: string | null) => void;

  /** Active cable medium for new patch runs */
  activeCableType: CableType;

  /** Active cable color preset for new patch runs */
  activeCableColor: string;

  setActiveCableType: (type: CableType) => void;
  setActiveCableColor: (color: string) => void;
  updateCableColor: (id: string, color: string) => void;
  updateCableType: (id: string, type: CableType) => void;
  clearAllCables: () => void;

  /** Visual presentation mode */
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  /** Ambient cold aisle temperature in Celsius */
  ambientTemperatureC: number;
  setAmbientTemperature: (temp: number) => void;

  /** Active dragging state for interactive cable routing */
  activeDraggingCable: DraggingCableProps | null;

  /** HDD hot-swap caddy registry */
  hddBays: Record<string, Record<number, HddBayState>>;

  // -- Multi-Rack Management ---------------------------------------------
  addRack: (name?: string, rackType?: RackFrameType) => void;
  removeRack: (rackId: string) => void;
  setActiveRackId: (rackId: string) => void;
  setRackName: (rackId: string, name: string) => void;
  importNetBoxRack: (rack: RackInstance, cables?: CableProps[]) => void;

  // -- L2/L3 Network Configurations -------------------------------------
  updateDeviceNetworkConfig: (hardwareId: string, config: Partial<DeviceNetworkConfig>) => void;
  updatePortNetworkConfig: (hardwareId: string, portId: string, config: Partial<PortNetworkConfig>) => void;

  // -- Data Hall Room Planning -------------------------------------------
  isRoomViewEnabled: boolean;
  dataHallConfig: DataHallConfig;
  toggleRoomView: () => void;
  setRoomViewEnabled: (enabled: boolean) => void;
  setRoomDimensions: (dims: Partial<RoomDimensions>) => void;
  setContainmentConfig: (config: Partial<AisleContainmentConfig>) => void;
  addCracUnit: (crac: Omit<CracUnit, 'id'>) => void;
  removeCracUnit: (id: string) => void;
  updateCracUnit: (id: string, updates: Partial<CracUnit>) => void;
  setTileType: (xIdx: number, zIdx: number, type: TileType) => void;
  updateRackPosition: (rackId: string, position: Vec3) => void;

  // -- Live Prometheus / Zabbix Telemetry Engine ------------------------
  isLiveTelemetryActive: boolean;
  telemetryConfig: TelemetryConfig;
  liveMetrics: Record<string, ChassisLiveMetrics>;
  setLiveTelemetryActive: (active: boolean) => void;
  toggleLiveTelemetry: () => void;
  setTelemetryConfig: (config: Partial<TelemetryConfig>) => void;
  updateLiveMetrics: (metrics: Record<string, ChassisLiveMetrics>) => void;

  // -- 3-Phase Electrical Simulation ------------------------------------
  voltageStandard: VoltageStandard;
  breakerRating: BreakerRating;
  feedFailoverMode: FeedFailoverMode;
  setVoltageStandard: (standard: VoltageStandard) => void;
  setBreakerRating: (rating: BreakerRating) => void;
  setFeedFailoverMode: (mode: FeedFailoverMode) => void;

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
  /** Mounts a device in the lowest free gap. Returns the new id, or null if it does not fit. */
  addHardware: (type: HardwareType, rackUnits: number, rackId?: string) => string | null;
  /** Moves a device by whole U (positive = up). Validated; records undo history. */
  moveHardwareByUnits: (id: string, deltaU: number) => boolean;
  removeHardware: (id: string) => void;
  updateHardwarePosition: (id: string, position: Vec3, rackId?: string) => void;
  selectHardware: (id: string | null) => void;
  toggleViewMode: () => void;
  setRackType: (type: RackFrameType, rackId?: string) => void;
  setDoorOpen: (isOpen: boolean, rackId?: string) => void;
  addCable: (
    fromDevice: string,
    fromPort: string,
    toDevice: string,
    toPort: string,
    color?: string,
    type?: CableType,
  ) => void;
  removeCable: (id: string) => void;
  unpatchPort: (deviceId: string, portId: string) => void;
  startDraggingCable: (
    fromDevice: string,
    fromPort: string,
    startPortGlobalPos: Vec3,
    color?: string,
    type?: CableType,
  ) => void;
  updateDraggingCable: (currentMouseWorldPos: Vec3) => void;
  stopDraggingCable: () => void;
}

const generateId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Deep clone multi-rack state to form an immutable history snapshot.
 */
const createSnapshot = (state: {
  racks: RackInstance[];
  activeRackId: string;
  cables: CableProps[];
  hddBays: Record<string, Record<number, HddBayState>>;
}): RackSnapshot => ({
  racks: state.racks.map((r) => ({
    ...r,
    position: [...r.position] as Vec3,
    installedHardware: r.installedHardware.map((h) => ({
      ...h,
      position: [...h.position] as Vec3,
      networkConfig: h.networkConfig
        ? {
            ...h.networkConfig,
            portsConfig: h.networkConfig.portsConfig ? { ...h.networkConfig.portsConfig } : undefined,
          }
        : undefined,
      ports: h.ports?.map((p: PortProps) => ({
        ...p,
        position: [...p.position] as Vec3,
        networkConfig: p.networkConfig ? { ...p.networkConfig } : undefined,
      })),
    })),
  })),
  activeRackId: state.activeRackId,
  cables: state.cables.map((c) => ({ ...c })),
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

const defaultInitialRack: RackInstance = {
  id: 'default-rack-1',
  name: 'Rack A',
  capacity: 42,
  rackType: '2-post',
  isDoorOpen: false,
  position: [0, 0, 0],
  installedHardware: [
    {
      id: 'default-chassis-1',
      type: 'server',
      rackUnits: 2,
      powerDraw: 250,
      depth: 0.6,
      position: [0, 0.04445, 0],
      ports: defaultServerPorts,
      rackId: 'default-rack-1',
    },
    {
      id: 'default-switch-1',
      type: 'switch',
      rackUnits: 1,
      powerDraw: 50,
      depth: 0.3,
      position: [0, 0.111125, 0],
      ports: defaultSwitchPorts,
      rackId: 'default-rack-1',
    },
  ],
};

export const useConfiguratorStore = create<ConfiguratorState>((set, get) => ({
  racks: [defaultInitialRack],
  activeRackId: 'default-rack-1',

  // Active rack proxy properties
  capacity: 42,
  rackType: '2-post',
  isDoorOpen: false,
  installedHardware: defaultInitialRack.installedHardware,

  cables: [
    {
      id: 'default-cable-1',
      fromDevice: 'default-chassis-1',
      fromPort: 'port-4',
      toDevice: 'default-switch-1',
      toPort: 'port-1',
      color: '#eab308',
      type: 'copper-cat6',
      lengthMeters: 0.42,
      hasBendViolation: false,
    },
    {
      id: 'default-cable-2',
      fromDevice: 'default-chassis-1',
      fromPort: 'port-3',
      toDevice: 'default-switch-1',
      toPort: 'port-12',
      color: '#3b82f6',
      type: 'copper-cat6',
      lengthMeters: 0.38,
      hasBendViolation: false,
    },
  ],
  selectedHardwareId: null,
  selectedCableId: null,
  selectCable: (id) => set({ selectedCableId: id }),

  // 3-Phase Electrical Simulation State
  voltageStandard: 'EU-230V-400V',
  breakerRating: 32,
  feedFailoverMode: 'normal',

  setVoltageStandard: (voltageStandard) =>
    set((state) => {
      const history = pushHistory(state);
      return { ...history, voltageStandard };
    }),

  setBreakerRating: (breakerRating) =>
    set((state) => {
      const history = pushHistory(state);
      return { ...history, breakerRating };
    }),

  setFeedFailoverMode: (feedFailoverMode) => set({ feedFailoverMode }),

  activeCableType: 'copper-cat6',
  activeCableColor: '#3b82f6',
  setActiveCableType: (activeCableType) => set({ activeCableType }),
  setActiveCableColor: (activeCableColor) => set({ activeCableColor }),

  updateCableColor: (id, color) =>
    set((state) => {
      const history = pushHistory(state);
      return {
        ...history,
        cables: state.cables.map((c) => (c.id === id ? { ...c, color } : c)),
      };
    }),

  updateCableType: (id, type) =>
    set((state) => {
      const history = pushHistory(state);
      return {
        ...history,
        cables: state.cables.map((c) => {
          if (c.id !== id) return c;

          // Locate devices and parent racks
          let fromDev: HardwareProps | undefined;
          let fromRack: RackInstance | undefined;
          let toDev: HardwareProps | undefined;
          let toRack: RackInstance | undefined;

          for (const r of state.racks) {
            const fd = r.installedHardware.find((h) => h.id === c.fromDevice);
            if (fd) {
              fromDev = fd;
              fromRack = r;
            }
            const td = r.installedHardware.find((h) => h.id === c.toDevice);
            if (td) {
              toDev = td;
              toRack = r;
            }
          }

          const p1 =
            fromDev && fromRack
              ? getPortWorldPosition(fromDev, c.fromPort, fromRack.position)
              : null;
          const p2 =
            toDev && toRack
              ? getPortWorldPosition(toDev, c.toPort, toRack.position)
              : null;

          let lengthMeters = c.lengthMeters;
          let hasBendViolation = c.hasBendViolation;

          if (p1 && p2) {
            const res = calculateCableCurve(p1, p2, type);
            lengthMeters = res.evaluation.lengthMeters;
            hasBendViolation = res.evaluation.hasBendViolation;
          }

          return { ...c, type, lengthMeters, hasBendViolation };
        }),
      };
    }),

  clearAllCables: () =>
    set((state) => {
      const history = pushHistory(state);
      return {
        ...history,
        cables: [],
        selectedCableId: null,
        racks: state.racks.map((r) => ({
          ...r,
          installedHardware: r.installedHardware.map((h) => ({
            ...h,
            ports: h.ports?.map((p) => ({ ...p, cableId: null })),
          })),
        })),
        installedHardware: state.installedHardware.map((h) => ({
          ...h,
          ports: h.ports?.map((p) => ({ ...p, cableId: null })),
        })),
      };
    }),

  viewMode: '3D',
  setViewMode: (viewMode) => set({ viewMode }),
  ambientTemperatureC: 20.0,
  setAmbientTemperature: (ambientTemperatureC) => set({ ambientTemperatureC }),
  activeDraggingCable: null,
  isRoomViewEnabled: false,
  dataHallConfig: DEFAULT_DATA_HALL_CONFIG,

  toggleRoomView: () => set((state) => ({ isRoomViewEnabled: !state.isRoomViewEnabled })),
  setRoomViewEnabled: (isRoomViewEnabled) => set({ isRoomViewEnabled }),
  setRoomDimensions: (dims) =>
    set((state) => ({
      dataHallConfig: {
        ...state.dataHallConfig,
        roomDimensions: {
          ...state.dataHallConfig.roomDimensions,
          ...dims,
        },
      },
    })),
  setContainmentConfig: (containment) =>
    set((state) => ({
      dataHallConfig: {
        ...state.dataHallConfig,
        containment: {
          ...state.dataHallConfig.containment,
          ...containment,
        },
      },
    })),
  addCracUnit: (crac) =>
    set((state) => ({
      dataHallConfig: {
        ...state.dataHallConfig,
        cracUnits: [
          ...state.dataHallConfig.cracUnits,
          { ...crac, id: generateId() },
        ],
      },
    })),
  removeCracUnit: (id) =>
    set((state) => ({
      dataHallConfig: {
        ...state.dataHallConfig,
        cracUnits: state.dataHallConfig.cracUnits.filter((c) => c.id !== id),
      },
    })),
  updateCracUnit: (id, updates) =>
    set((state) => ({
      dataHallConfig: {
        ...state.dataHallConfig,
        cracUnits: state.dataHallConfig.cracUnits.map((c) =>
          c.id === id ? { ...c, ...updates } : c,
        ),
      },
    })),
  setTileType: (xIdx, zIdx, type) =>
    set((state) => ({
      dataHallConfig: {
        ...state.dataHallConfig,
        tilesOverride: {
          ...state.dataHallConfig.tilesOverride,
          [`${xIdx}_${zIdx}`]: type,
        },
      },
    })),
  updateRackPosition: (rackId, position) =>
    set((state) => ({
      racks: state.racks.map((r) =>
        r.id === rackId ? { ...r, position } : r,
      ),
    })),

  // -- Live Prometheus / Zabbix Telemetry --------------------------------
  isLiveTelemetryActive: false,
  telemetryConfig: DEFAULT_TELEMETRY_CONFIG,
  liveMetrics: {},

  setLiveTelemetryActive: (isLiveTelemetryActive) => set({ isLiveTelemetryActive }),
  toggleLiveTelemetry: () => set((state) => ({ isLiveTelemetryActive: !state.isLiveTelemetryActive })),
  setTelemetryConfig: (config) =>
    set((state) => ({
      telemetryConfig: {
        ...state.telemetryConfig,
        ...config,
        queryMap: {
          ...state.telemetryConfig.queryMap,
          ...(config.queryMap || {}),
        },
      },
    })),
  updateLiveMetrics: (liveMetrics) => set({ liveMetrics }),

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

  // -- Multi-Rack Actions ------------------------------------------------
  addRack: (name, rackType = '2-post') =>
    set((state) => {
      const history = pushHistory(state);
      const newIndex = state.racks.length;
      const newRackId = generateId();
      const defaultName = name || `Rack ${String.fromCharCode(65 + newIndex)}`;
      const position: Vec3 = [newIndex * BAY_SPACING, 0, 0];

      const newRack: RackInstance = {
        id: newRackId,
        name: defaultName,
        capacity: 42,
        rackType,
        isDoorOpen: false,
        position,
        installedHardware: [],
      };

      return {
        ...history,
        racks: [...state.racks, newRack],
        activeRackId: newRackId,
        capacity: newRack.capacity,
        rackType: newRack.rackType,
        isDoorOpen: newRack.isDoorOpen,
        installedHardware: [],
        selectedHardwareId: null,
      };
    }),

  removeRack: (rackId) =>
    set((state) => {
      if (state.racks.length <= 1) return {}; // Prevent removing sole rack
      const history = pushHistory(state);

      const targetRack = state.racks.find((r) => r.id === rackId);
      const removedHardwareIds = new Set(
        targetRack?.installedHardware.map((h) => h.id) || [],
      );

      const remainingRacks = state.racks
        .filter((r) => r.id !== rackId)
        .map((r, idx) => ({
          ...r,
          position: [idx * BAY_SPACING, 0, 0] as Vec3,
        }));

      const newActiveRack =
        state.activeRackId === rackId ? remainingRacks[0] : state.racks.find((r) => r.id === state.activeRackId)!;

      const remainingCables = state.cables.filter(
        (c) => !removedHardwareIds.has(c.fromDevice) && !removedHardwareIds.has(c.toDevice),
      );

      return {
        ...history,
        racks: remainingRacks,
        activeRackId: newActiveRack.id,
        capacity: newActiveRack.capacity,
        rackType: newActiveRack.rackType,
        isDoorOpen: newActiveRack.isDoorOpen,
        installedHardware: newActiveRack.installedHardware,
        cables: remainingCables,
        selectedHardwareId: null,
      };
    }),

  setActiveRackId: (rackId) =>
    set((state) => {
      const target = state.racks.find((r) => r.id === rackId);
      if (!target) return {};
      return {
        activeRackId: rackId,
        capacity: target.capacity,
        rackType: target.rackType,
        isDoorOpen: target.isDoorOpen,
        installedHardware: target.installedHardware,
        selectedHardwareId: null,
      };
    }),

  setRackName: (rackId, name) =>
    set((state) => {
      const history = pushHistory(state);
      return {
        ...history,
        racks: state.racks.map((r) => (r.id === rackId ? { ...r, name } : r)),
      };
    }),

  importNetBoxRack: (newRack, newCables = []) =>
    set((state) => {
      const history = pushHistory(state);
      const updatedRacks = state.racks.map((r) =>
        r.id === state.activeRackId
          ? {
              ...newRack,
              id: r.id,
              position: r.position,
              name: newRack.name || r.name,
              installedHardware: newRack.installedHardware.map((h) => ({
                ...h,
                rackId: r.id,
              })),
            }
          : r,
      );

      const activeRack = updatedRacks.find((r) => r.id === state.activeRackId)!;
      return {
        ...history,
        racks: updatedRacks,
        installedHardware: activeRack.installedHardware,
        capacity: activeRack.capacity,
        cables: [...state.cables, ...newCables],
      };
    }),

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

      const activeRack =
        previous.racks.find((r) => r.id === previous.activeRackId) || previous.racks[0];

      return {
        past: newPast,
        future: [currentSnapshot, ...state.future.slice(0, MAX_HISTORY - 1)],
        canUndo: newPast.length > 0,
        canRedo: true,
        racks: previous.racks,
        activeRackId: previous.activeRackId,
        capacity: activeRack.capacity,
        rackType: activeRack.rackType,
        isDoorOpen: activeRack.isDoorOpen,
        installedHardware: activeRack.installedHardware,
        cables: previous.cables,
        hddBays: previous.hddBays,
        selectedHardwareId: null,
        selectedCableId: null,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return {};
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      const currentSnapshot = createSnapshot(state);

      const activeRack =
        next.racks.find((r) => r.id === next.activeRackId) || next.racks[0];

      return {
        past: [...state.past.slice(-MAX_HISTORY + 1), currentSnapshot],
        future: newFuture,
        canUndo: true,
        canRedo: newFuture.length > 0,
        racks: next.racks,
        activeRackId: next.activeRackId,
        capacity: activeRack.capacity,
        rackType: activeRack.rackType,
        isDoorOpen: activeRack.isDoorOpen,
        installedHardware: activeRack.installedHardware,
        cables: next.cables,
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

  addHardware: (type, rackUnits, rackId) => {
    const pre = get();
    const preRack =
      pre.racks.find((r) => r.id === (rackId || pre.activeRackId)) || pre.racks[0];
    if (!preRack) return null;
    const freeU = findFirstFreeSlot(rackUnits, preRack.capacity, preRack.installedHardware);
    if (freeU === null) return null;
    const newId = generateId();

    set((state) => {
      const history = pushHistory(state);
      const targetRackId = preRack.id;
      const centerY = uStartToCenterY(freeU, rackUnits);

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

      const newChassis: HardwareProps = {
        id: newId,
        type,
        rackUnits,
        powerDraw: specs.powerDraw,
        depth: specs.depth,
        position: [0, centerY, 0],
        ports: specs.ports,
        rackId: targetRackId,
      };

      const updatedRacks = state.racks.map((r) =>
        r.id === targetRackId
          ? { ...r, installedHardware: [...r.installedHardware, newChassis] }
          : r,
      );

      const activeRack = updatedRacks.find((r) => r.id === state.activeRackId)!;

      return {
        ...history,
        racks: updatedRacks,
        installedHardware: activeRack.installedHardware,
        hddBays: {
          ...state.hddBays,
          [newId]: bays,
        },
      };
    });
    return newId;
  },

  moveHardwareByUnits: (id, deltaU) => {
    const state = get();
    if (!Number.isInteger(deltaU) || deltaU === 0) return false;
    const rack = state.racks.find((r) => r.installedHardware.some((h) => h.id === id));
    const h = rack?.installedHardware.find((x) => x.id === id);
    if (!rack || !h) return false;
    const target = centerYToUStart(h.position[1], h.rackUnits) + deltaU;
    if (!canPlaceAt(target, h.rackUnits, rack.capacity, rack.installedHardware, id)) return false;
    state.recordHistorySnapshot();
    state.updateHardwarePosition(
      id,
      [h.position[0], uStartToCenterY(target, h.rackUnits), h.position[2]],
      rack.id,
    );
    return true;
  },

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

      const updatedRacks = state.racks.map((r) => ({
        ...r,
        installedHardware: r.installedHardware.filter((h) => h.id !== id),
      }));

      const activeRack = updatedRacks.find((r) => r.id === state.activeRackId) || updatedRacks[0];

      return {
        ...history,
        racks: updatedRacks,
        installedHardware: activeRack.installedHardware,
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
      const allHardware = state.racks.flatMap((r) => r.installedHardware);
      const eligible = allHardware.filter(
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

  addCable: (
    fromDevice,
    fromPort,
    toDevice,
    toPort,
    color,
    type,
  ) =>
    set((state) => {
      const history = pushHistory(state);
      const cableId = generateId();
      const finalColor = color || state.activeCableColor;
      const finalType = type || state.activeCableType;

      let fromDev: HardwareProps | undefined;
      let fromRack: RackInstance | undefined;
      let toDev: HardwareProps | undefined;
      let toRack: RackInstance | undefined;

      for (const r of state.racks) {
        const fd = r.installedHardware.find((h) => h.id === fromDevice);
        if (fd) {
          fromDev = fd;
          fromRack = r;
        }
        const td = r.installedHardware.find((h) => h.id === toDevice);
        if (td) {
          toDev = td;
          toRack = r;
        }
      }

      const p1 =
        fromDev && fromRack
          ? getPortWorldPosition(fromDev, fromPort, fromRack.position)
          : null;
      const p2 =
        toDev && toRack
          ? getPortWorldPosition(toDev, toPort, toRack.position)
          : null;

      let lengthMeters: number | undefined;
      let hasBendViolation = false;

      if (p1 && p2) {
        const res = calculateCableCurve(p1, p2, finalType);
        lengthMeters = res.evaluation.lengthMeters;
        hasBendViolation = res.evaluation.hasBendViolation;
      }

      const updatedRacks = state.racks.map((r) => ({
        ...r,
        installedHardware: r.installedHardware.map((h) => {
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
      }));

      const activeRack = updatedRacks.find((r) => r.id === state.activeRackId)!;

      return {
        ...history,
        racks: updatedRacks,
        installedHardware: activeRack.installedHardware,
        cables: [
          ...state.cables,
          {
            id: cableId,
            fromDevice,
            fromPort,
            toDevice,
            toPort,
            color: finalColor,
            type: finalType,
            lengthMeters,
            hasBendViolation,
          },
        ],
      };
    }),

  removeCable: (id) =>
    set((state) => {
      const targetCable = state.cables.find((c) => c.id === id);
      if (!targetCable) return {};
      const history = pushHistory(state);

      const updatedRacks = state.racks.map((r) => ({
        ...r,
        installedHardware: r.installedHardware.map((h) => {
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
      }));

      const activeRack = updatedRacks.find((r) => r.id === state.activeRackId)!;

      return {
        ...history,
        racks: updatedRacks,
        installedHardware: activeRack.installedHardware,
        cables: state.cables.filter((c) => c.id !== id),
        selectedCableId: state.selectedCableId === id ? null : state.selectedCableId,
      };
    }),

  unpatchPort: (deviceId, portId) =>
    set((state) => {
      let dev: HardwareProps | undefined;
      for (const r of state.racks) {
        const found = r.installedHardware.find((h) => h.id === deviceId);
        if (found) {
          dev = found;
          break;
        }
      }

      const port = dev?.ports?.find((p) => p.id === portId);
      if (!port || !port.cableId) return {};

      const cableId = port.cableId;
      const targetCable = state.cables.find((c) => c.id === cableId);
      if (!targetCable) return {};
      const history = pushHistory(state);

      const updatedRacks = state.racks.map((r) => ({
        ...r,
        installedHardware: r.installedHardware.map((h) => {
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
      }));

      const activeRack = updatedRacks.find((r) => r.id === state.activeRackId)!;

      return {
        ...history,
        racks: updatedRacks,
        installedHardware: activeRack.installedHardware,
        cables: state.cables.filter((c) => c.id !== cableId),
        selectedCableId: state.selectedCableId === cableId ? null : state.selectedCableId,
      };
    }),

  startDraggingCable: (
    fromDevice,
    fromPort,
    startPortGlobalPos,
    color,
    type,
  ) =>
    set((state) => ({
      activeDraggingCable: {
        cableId: null,
        fromDevice,
        fromPort,
        color: color || state.activeCableColor,
        type: type || state.activeCableType,
        startPortGlobalPos,
        currentMouseWorldPos: startPortGlobalPos,
      },
    })),

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

  updateHardwarePosition: (id, position, rackId) =>
    set((state) => {
      const targetRackId = rackId || state.activeRackId;
      const updatedRacks = state.racks.map((r) =>
        r.id === targetRackId
          ? {
              ...r,
              installedHardware: r.installedHardware.map((h) =>
                h.id === id ? { ...h, position } : h,
              ),
            }
          : r,
      );
      const activeRack = updatedRacks.find((r) => r.id === state.activeRackId)!;
      return {
        racks: updatedRacks,
        installedHardware: activeRack.installedHardware,
      };
    }),

  selectHardware: (id) => set({ selectedHardwareId: id }),

  updateDeviceNetworkConfig: (hardwareId, config) =>
    set((state) => {
      const history = pushHistory(state);
      const updatedRacks = state.racks.map((r) => ({
        ...r,
        installedHardware: r.installedHardware.map((h) => {
          if (h.id === hardwareId) {
            return {
              ...h,
              networkConfig: {
                ...h.networkConfig,
                ...config,
                portsConfig: {
                  ...(h.networkConfig?.portsConfig || {}),
                  ...(config.portsConfig || {}),
                },
              },
            };
          }
          return h;
        }),
      }));

      const activeRack = updatedRacks.find((r) => r.id === state.activeRackId)!;
      return {
        ...history,
        racks: updatedRacks,
        installedHardware: activeRack.installedHardware,
      };
    }),

  updatePortNetworkConfig: (hardwareId, portId, config) =>
    set((state) => {
      const history = pushHistory(state);
      const updatedRacks = state.racks.map((r) => ({
        ...r,
        installedHardware: r.installedHardware.map((h) => {
          if (h.id === hardwareId) {
            const currentPortsConfig = h.networkConfig?.portsConfig || {};
            const currentPortCfg = currentPortsConfig[portId] || {};
            const updatedPortCfg: PortNetworkConfig = {
              ...currentPortCfg,
              ...config,
              portId,
            };

            const updatedPorts = h.ports?.map((p) =>
              p.id === portId ? { ...p, networkConfig: updatedPortCfg } : p,
            );

            return {
              ...h,
              ports: updatedPorts,
              networkConfig: {
                ...h.networkConfig,
                portsConfig: {
                  ...currentPortsConfig,
                  [portId]: updatedPortCfg,
                },
              },
            };
          }
          return h;
        }),
      }));

      const activeRack = updatedRacks.find((r) => r.id === state.activeRackId)!;
      return {
        ...history,
        racks: updatedRacks,
        installedHardware: activeRack.installedHardware,
      };
    }),

  toggleViewMode: () =>
    set((state) => {
      const modes: ViewMode[] = ['3D', 'blueprint', 'thermal', 'topology'];
      const nextIdx = (modes.indexOf(state.viewMode) + 1) % modes.length;
      return { viewMode: modes[nextIdx] };
    }),

  setRackType: (rackType, rackId) =>
    set((state) => {
      const history = pushHistory(state);
      const targetRackId = rackId || state.activeRackId;
      const updatedRacks = state.racks.map((r) =>
        r.id === targetRackId ? { ...r, rackType } : r,
      );
      const activeRack = updatedRacks.find((r) => r.id === state.activeRackId)!;
      return {
        ...history,
        racks: updatedRacks,
        rackType: activeRack.rackType,
      };
    }),

  setDoorOpen: (isDoorOpen, rackId) =>
    set((state) => {
      const history = pushHistory(state);
      const targetRackId = rackId || state.activeRackId;
      const updatedRacks = state.racks.map((r) =>
        r.id === targetRackId ? { ...r, isDoorOpen } : r,
      );
      const activeRack = updatedRacks.find((r) => r.id === state.activeRackId)!;
      return {
        ...history,
        racks: updatedRacks,
        isDoorOpen: activeRack.isDoorOpen,
      };
    }),
}));
