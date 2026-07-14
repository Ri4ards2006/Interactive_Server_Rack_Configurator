/**
 * Global Zustand store for the Interactive Server Rack Configurator.
 *
 * Architectural notes:
 * - The data shape (`capacity`, `installedHardware`) is inherited from
 *   `RackState` — the documented persistence shape — so the runtime
 *   store and any future save/load format cannot drift apart.
 * - UI-only state (`selectedHardwareId`) and mutators live on
 *   `ConfiguratorState`. They are NOT persisted by design.
 * - Transient drag state is intentionally kept OUT of this store. R3F
 *   pointer events update local component state 60×/sec, while finalized
 *   position commits go through `updateHardwarePosition`. This prevents
 *   the entire canvas tree from re-rendering on every drag frame.
 * - `RACK_UNIT_HEIGHT` is exported as the single source of truth for 1U
 *   geometry math. Components import this instead of redefining locally.
 */

import { create } from 'zustand';
import {
  HardwareType,
  RackState,
  Vec3,
  CableProps,
  PortProps,
} from '../types/rack.types';

export interface DraggingCableProps {
  cableId: string | null; // null if creating a new cable
  fromDevice: string;
  fromPort: string;
  color: string;
  startPortGlobalPos: Vec3;
  currentMouseWorldPos: Vec3;
}

/** 1U height in meters (~4.445 cm, the EIA-310 standard). */
export const RACK_UNIT_HEIGHT = 0.04445;

/**
 * Shared chassis geometry constants. These are the source of truth for
 * every piece of hardware in the rack so adjacent chassis line up
 * perfectly regardless of type.
 *
 * - `CHASSIS_WIDTH` is the outer width of a 19" mounted chassis.
 * - `EDGE_GAP` is a tiny vertical inset subtracted from the chassis
 *   height so stacked units have a thin visible rail-seam between them.
 * - `SELECTION_OUTLINE_WIDTH` / `SELECTION_OUTLINE_INSET` describe a
 *   bounding box slightly LARGER than the chassis, used to render the
 *   cyan selection halo. Keeping these constants here means the
 *   halo can't drift away from the chassis dimensions.
 */
export const CHASSIS_WIDTH = 0.44;
export const EDGE_GAP = 0.005;
export const SELECTION_OUTLINE_WIDTH = 0.47;
export const SELECTION_OUTLINE_INSET = 0.01;

/**
 * Runtime Zustand state: persisted rack data + ephemeral UI state + mutators.
 * Extends `RackState` to keep the data shape in lockstep across the codebase.
 */
export interface ConfiguratorState extends RackState {
  /** ID of the hardware currently selected (clicked) by the user, if any. */
  selectedHardwareId: string | null;

  /** ID of the cable currently selected, if any. */
  selectedCableId: string | null;

  /** Set / clear the active cable selection. */
  selectCable: (id: string | null) => void;

  /**
   * Visual presentation mode for the canvas:
   *   - `'3D'`: realistic PBR rendering (default) — chassis show
   *     brushed metal, environment reflections, accent emissives.
   *   - `'blueprint'`: technical / schematic view — flat fills,
   *     sharp cyan edge outlines, no environment reflections,
   *     explicit U-tick labeling on the rails.
   *
   * UI-only state — deliberately NOT part of `RackState` so the
   * blueprint preference never leaks into a save/load format.
   */
  viewMode: '3D' | 'blueprint';

  /** Active dragging state for interactive cable routing. */
  activeDraggingCable: DraggingCableProps | null;

  // -- Mutators ----------------------------------------------------------

  /** Append a new piece of hardware at a sensible default location. */
  addHardware: (type: HardwareType, rackUnits: number) => void;

  /** Remove a piece of hardware. Clears selection if it was the selected item. */
  removeHardware: (id: string) => void;

  /** Commit a new position (e.g. after a drag). Expects already-snapped coords. */
  updateHardwarePosition: (id: string, position: Vec3) => void;

  /** Set / clear the active selection (used by click + Escape). */
  selectHardware: (id: string | null) => void;

  /**
   * Flip the visual presentation mode. `Scene.tsx` subscribes to
   * `viewMode` and re-positions the camera + toggles OrbitControls
   * accordingly. Each chassis component reads it to swap PBR
   * materials for the schematic palette.
   */
  toggleViewMode: () => void;

  /** The type of rack frame: 2-post, 4-post open frame, or enclosed cabinet. */
  rackType: '2-post' | '4-post' | 'cabinet';

  /** Whether the cabinet's front glass door is open (applicable to 'cabinet' type). */
  isDoorOpen: boolean;

  /** Set the active rack type. */
  setRackType: (type: '2-post' | '4-post' | 'cabinet') => void;

  /** Set whether the cabinet door is open. */
  setDoorOpen: (isOpen: boolean) => void;

  /** Patches a cable between ports. */
  addCable: (fromDevice: string, fromPort: string, toDevice: string, toPort: string, color: string) => void;

  /** Unpatches a cable connection. */
  removeCable: (id: string) => void;

  /** Unplugs a connection from a specific port. */
  unpatchPort: (deviceId: string, portId: string) => void;

  /** Starts interactive cable dragging from a port. */
  startDraggingCable: (fromDevice: string, fromPort: string, startPortGlobalPos: Vec3, color?: string) => void;

  /** Updates the current drag position. */
  updateDraggingCable: (currentMouseWorldPos: Vec3) => void;

  /** Cancels or finishes drag action. */
  stopDraggingCable: () => void;
}

/**
 * Safe UUID generator. Falls back gracefully in environments without
 * `crypto.randomUUID` (older Safari, some SSR runtimes, older Node).
 */
const generateId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Generates relative 3D port positions on the chassis plate based on the device type.
 * Server and NAS ports are positioned on the backplate (Z = 0.39 - depth).
 * Network device ports are on the frontplate (Z = 0.39).
 */
const generatePortsForDevice = (type: HardwareType, depth: number = 0.6): PortProps[] | undefined => {
  const ports: PortProps[] = [];
  
  if (type === 'switch') {
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
      } else {
        return base + groupCol * (PORT_W + PORT_GAP_X) + PORT_W / 2;
      }
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
    // 8 copper ports
    const copperPortsX = [-0.06, -0.046, -0.032, -0.018, 0.002, 0.016, 0.030, 0.044];
    copperPortsX.forEach((x, idx) => {
      ports.push({
        id: `port-${idx + 1}`,
        label: `GE ${idx + 1}`,
        position: [x, -0.002, 0.39 + 0.003],
        cableId: null,
      });
    });
    // 4 SFP ports
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
    const sfpRows = 1;
    const SFP_COLS = 16;
    const SFP_W = 0.009;
    const SFP_GAP_X = 0.006;
    const SFP_GAP_Y = 0.006;
    const SFP_H = 0.009;
    const chassisHeight = 1 * RACK_UNIT_HEIGHT - EDGE_GAP;
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
            0.39 + 0.003 // Front plate bezel face
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
    serverPortsX.forEach((x, idx) => {
      ports.push({
        id: `port-${idx + 1}`,
        label: `LAN ${idx + 1}`,
        // Server ports sit at the back panel (Z = 0.39 - depth)
        position: [x, -0.008, 0.39 - depth],
        cableId: null,
      });
    });
    return ports;
  }

  if (type === 'patch-panel') {
    const patchPanelPortsX = Array.from({ length: 24 }, (_, idx) => -0.16 + idx * (0.32 / 23));
    patchPanelPortsX.forEach((x, idx) => {
      ports.push({
        id: `port-${idx + 1}`,
        label: `Port ${idx + 1}`,
        position: [x, 0, 0.39 + 0.002],
        cableId: null,
      });
    });
    return ports;
  }
  
  return undefined;
};

// Seed default ports
const defaultServerPorts = generatePortsForDevice('server', 0.6)!;
defaultServerPorts.find(p => p.id === 'port-4')!.cableId = 'default-cable-1';
defaultServerPorts.find(p => p.id === 'port-3')!.cableId = 'default-cable-2'; // port-3 is LAN 3

const defaultSwitchPorts = generatePortsForDevice('switch', 0.3)!;
defaultSwitchPorts.find(p => p.id === 'port-1')!.cableId = 'default-cable-1';
defaultSwitchPorts.find(p => p.id === 'port-12')!.cableId = 'default-cable-2';

export const useConfiguratorStore = create<ConfiguratorState>((set) => ({
  capacity: 42,
  installedHardware: [
    {
      id: "default-chassis-1",
      type: "server",
      rackUnits: 2,
      powerDraw: 250,
      depth: 0.6,
      position: [0, 0.04445, 0], // Centered perfectly on slot 0 floor
      ports: defaultServerPorts,
    },
    {
      id: "default-switch-1",
      type: "switch",
      rackUnits: 1,
      powerDraw: 50,
      depth: 0.3,
      position: [0, 0.111125, 0], // U3 (offset = 2.5 * RACK_UNIT_HEIGHT)
      ports: defaultSwitchPorts,
    },
  ],
  cables: [
    {
      id: "default-cable-1",
      fromDevice: "default-chassis-1",
      fromPort: "port-4",
      toDevice: "default-switch-1",
      toPort: "port-1",
      color: "#eab308", // Ethernet yellow
    },
    {
      id: "default-cable-2",
      fromDevice: "default-chassis-1",
      fromPort: "port-3",
      toDevice: "default-switch-1",
      toPort: "port-12",
      color: "#3b82f6", // Ethernet blue
    },
  ],
  selectedHardwareId: null,
  selectedCableId: null,
  selectCable: (id) => set({ selectedCableId: id }),
  viewMode: '3D',
  activeDraggingCable: null,

  addHardware: (type, rackUnits) =>
    set((state) => {
      const currentHighestY = state.installedHardware.reduce((acc, h) => {
        const top = h.position[1] + (h.rackUnits * RACK_UNIT_HEIGHT) / 2;
        return Math.max(acc, top);
      }, 0);
      const centerY = currentHighestY + (rackUnits * RACK_UNIT_HEIGHT) / 2;

      let defaultPowerDraw = 150;
      let defaultDepth = 0.6;

      switch (type) {
        case 'server':
          defaultPowerDraw = rackUnits === 1 ? 150 : rackUnits === 2 ? 300 : 500;
          defaultDepth = 0.6;
          break;
        case 'switch':
          defaultPowerDraw = 50;
          defaultDepth = 0.3;
          break;
        case 'router':
          defaultPowerDraw = rackUnits === 1 ? 80 : 150;
          defaultDepth = 0.4;
          break;
        case 'patch-panel':
          defaultPowerDraw = 0;
          defaultDepth = 0.1;
          break;
        case 'ups':
          defaultPowerDraw = -1500;
          defaultDepth = 0.6;
          break;
        case 'kvm':
          defaultPowerDraw = 30;
          defaultDepth = 0.4;
          break;
        case 'jbod':
          defaultPowerDraw = 600;
          defaultDepth = 0.65;
          break;
        case 'blank':
          defaultPowerDraw = 0;
          defaultDepth = 0.02;
          break;
        case 'nas':
          defaultPowerDraw = 150;
          defaultDepth = 0.55;
          break;
        case 'firewall':
          defaultPowerDraw = 40;
          defaultDepth = 0.3;
          break;
        case 'brush':
          defaultPowerDraw = 0;
          defaultDepth = 0.02;
          break;
        case 'cable-manager':
          defaultPowerDraw = 0;
          defaultDepth = 0.08;
          break;
      }

      return {
        installedHardware: [
          ...state.installedHardware,
          {
            id: generateId(),
            type,
            rackUnits,
            powerDraw: defaultPowerDraw,
            depth: defaultDepth,
            position: [0, centerY, 0],
            ports: generatePortsForDevice(type, defaultDepth),
          },
        ],
      };
    }),

  removeHardware: (id) =>
    set((state) => {
      const remainingCables = state.cables.filter((c) => c.fromDevice !== id && c.toDevice !== id);
      const isSelectedCableRemoved = state.selectedCableId && remainingCables.every(c => c.id !== state.selectedCableId);
      return {
        installedHardware: state.installedHardware.filter((h) => h.id !== id),
        cables: remainingCables,
        selectedHardwareId:
          state.selectedHardwareId === id ? null : state.selectedHardwareId,
        selectedCableId: isSelectedCableRemoved ? null : state.selectedCableId,
      };
    }),

  addCable: (fromDevice, fromPort, toDevice, toPort, color) =>
    set((state) => {
      const cableId = generateId();
      return {
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
      return {
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

      return {
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

  rackType: '2-post',
  isDoorOpen: false,

  setRackType: (rackType) => set({ rackType }),
  setDoorOpen: (isDoorOpen) => set({ isDoorOpen }),
}));
