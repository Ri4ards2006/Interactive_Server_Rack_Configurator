/**
 * ConfiguratorPanel.tsx
 *
 * Overlay UI panel rendered above the R3F <Canvas>. Lists installed
 * hardware, exposes add/remove actions, and reports rack utilization
 * plus total power draw.
 *
 * Design Language:
 * - Minimalist video-game/SaaS HUD matching richardzuikov.com
 *   (zinc-950/80 backdrop, razor-thin tech borders, font-mono readouts).
 * - Fixed floating panels to prevent layout breaks on short viewports.
 * - Zen Mode: toggles sidebar visibility with transition-all duration-300.
 */

import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useConfiguratorStore, RACK_UNIT_HEIGHT } from '../../store/useConfiguratorStore';
import type { HardwareProps, HardwareType } from '../../types/rack.types';
import {
  VOLTAGE_STANDARDS,
  VoltageStandard,
  BreakerRating,
  FeedFailoverMode,
} from '../../types/electrical.types';
import { evaluateRackElectrical } from '../../utils/electricalCalculations';
import { evaluateRackThermal } from '../../utils/thermalCalculations';
import {
  CABLE_COLOR_PRESETS,
  CABLE_MEDIUM_SPECS,
  CableType,
} from '../../types/cable.types';
import {
  generateBOMReport,
  exportBOMToJSON,
  exportBOMToCSV,
  downloadFile,
} from '../../utils/exporters/bomExporter';
import { exportRackElevationSVG } from '../../utils/exporters/elevationExporter';
import { NetBoxClient } from '../../utils/netbox/netboxClient';
import type { NetBoxSite, NetBoxRack } from '../../types/netbox.types';
import {
  MOCK_NETBOX_SITES,
  MOCK_NETBOX_RACKS,
} from '../../utils/netbox/mockNetboxData';
import { checkDropValidity } from '../../utils/rackLayout';

interface CatalogItem {
  type: HardwareType;
  rackUnits: number;
  name: string;
  category: 'compute' | 'networking' | 'storage' | 'airflow' | 'auxiliary';
  svg: React.ReactNode;
}

const categories = [
  { id: 'compute', label: 'COMPUTE' },
  { id: 'networking', label: 'NETWORKING' },
  { id: 'storage', label: 'STORAGE' },
  { id: 'airflow', label: 'AIRFLOW & CABLE MNG' },
  { id: 'auxiliary', label: 'AUXILIARY' }
] as const;

const catalogItems: CatalogItem[] = [
  {
    type: 'server',
    rackUnits: 1,
    name: 'Server 1U',
    category: 'compute',
    svg: (
      <svg className="w-4 h-4 text-sky-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="2" y="5" width="20" height="6" rx="1" />
        <line x1="6" y1="8" x2="8" y2="8" strokeLinecap="round" />
        <circle cx="16" cy="8" r="0.75" fill="currentColor" />
        <circle cx="18" cy="8" r="0.75" fill="currentColor" />
      </svg>
    )
  },
  {
    type: 'server',
    rackUnits: 2,
    name: 'Server 2U',
    category: 'compute',
    svg: (
      <svg className="w-4 h-4 text-sky-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="2" y="5" width="20" height="6" rx="1" />
        <line x1="6" y1="8" x2="8" y2="8" strokeLinecap="round" />
        <rect x="2" y="13" width="20" height="6" rx="1" />
        <line x1="6" y1="16" x2="8" y2="16" strokeLinecap="round" />
      </svg>
    )
  },
  {
    type: 'server',
    rackUnits: 4,
    name: 'Server 4U',
    category: 'compute',
    svg: (
      <svg className="w-4 h-4 text-sky-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="1" />
        <line x1="6" y1="6" x2="8" y2="6" strokeLinecap="round" />
        <line x1="6" y1="12" x2="8" y2="12" strokeLinecap="round" />
        <line x1="6" y1="18" x2="8" y2="18" strokeLinecap="round" />
      </svg>
    )
  },
  {
    type: 'switch',
    rackUnits: 1,
    name: 'Switch.Net 1U',
    category: 'networking',
    svg: (
      <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="2" y="6" width="20" height="12" rx="1" />
        <rect x="5" y="9" width="2" height="2" />
        <rect x="9" y="9" width="2" height="2" />
        <rect x="13" y="9" width="2" height="2" />
        <rect x="17" y="9" width="2" height="2" />
        <rect x="5" y="13" width="2" height="2" />
        <rect x="9" y="13" width="2" height="2" />
        <rect x="13" y="13" width="2" height="2" />
        <rect x="17" y="13" width="2" height="2" />
      </svg>
    )
  },
  {
    type: 'router',
    rackUnits: 1,
    name: 'Core-Rtr.1 1U',
    category: 'networking',
    svg: (
      <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="2" y="6" width="20" height="12" rx="1" />
        <circle cx="6" cy="12" r="1.5" />
        <line x1="10" y1="12" x2="20" y2="12" />
        <circle cx="14" cy="12" r="1" />
        <circle cx="18" cy="12" r="1" />
      </svg>
    )
  },
  {
    type: 'router',
    rackUnits: 2,
    name: 'Core-Rtr.2 2U',
    category: 'networking',
    svg: (
      <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="2" y="4" width="20" height="16" rx="1" />
        <line x1="12" y1="4" x2="12" y2="20" />
        <circle cx="6" cy="12" r="2" />
        <circle cx="18" cy="12" r="2" />
      </svg>
    )
  },
  {
    type: 'patch-panel',
    rackUnits: 1,
    name: 'Cable-Mng.P 1U',
    category: 'networking',
    svg: (
      <svg className="w-4 h-4 text-violet-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="2" y="6" width="20" height="12" rx="1" />
        <circle cx="5" cy="12" r="1" />
        <circle cx="8" cy="12" r="1" />
        <circle cx="11" cy="12" r="1" />
        <circle cx="14" cy="12" r="1" />
        <circle cx="17" cy="12" r="1" />
        <circle cx="20" cy="12" r="1" />
      </svg>
    )
  },
  {
    type: 'firewall',
    rackUnits: 1,
    name: 'Firewall Appliance 1U',
    category: 'networking',
    svg: (
      <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="2" y="6" width="20" height="12" rx="1" />
        <circle cx="6" cy="12" r="1.5" />
        <line x1="10" y1="10" x2="12" y2="10" />
        <line x1="10" y1="14" x2="12" y2="14" />
        <rect x="15" y="9" width="4" height="6" />
      </svg>
    )
  },
  {
    type: 'jbod',
    rackUnits: 4,
    name: 'JBOD Storage 4U',
    category: 'storage',
    svg: (
      <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="1" />
        <line x1="2" y1="8" x2="22" y2="8" />
        <line x1="2" y1="14" x2="22" y2="14" />
        <circle cx="6" cy="5" r="1.5" />
        <circle cx="18" cy="5" r="1.5" />
        <circle cx="6" cy="11" r="1.5" />
        <circle cx="18" cy="11" r="1.5" />
        <circle cx="6" cy="17" r="1.5" />
        <circle cx="18" cy="17" r="1.5" />
      </svg>
    )
  },
  {
    type: 'nas',
    rackUnits: 2,
    name: 'NAS Storage 2U',
    category: 'storage',
    svg: (
      <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="2" y="4" width="20" height="16" rx="1" />
        <rect x="5" y="8" width="6" height="8" />
        <circle cx="16" cy="10" r="1" />
        <circle cx="18" cy="10" r="1" />
      </svg>
    )
  },
  {
    type: 'blank',
    rackUnits: 1,
    name: 'Blanking Panel 1U',
    category: 'airflow',
    svg: (
      <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="2" y="6" width="20" height="12" rx="1" />
        <line x1="4" y1="12" x2="6" y2="12" />
        <line x1="18" y1="12" x2="20" y2="12" />
      </svg>
    )
  },
  {
    type: 'blank',
    rackUnits: 2,
    name: 'Blanking Panel 2U',
    category: 'airflow',
    svg: (
      <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="2" y="4" width="20" height="16" rx="1" />
        <line x1="4" y1="12" x2="6" y2="12" />
        <line x1="18" y1="12" x2="20" y2="12" />
      </svg>
    )
  },
  {
    type: 'brush',
    rackUnits: 1,
    name: 'Cable Brush Panel 1U',
    category: 'airflow',
    svg: (
      <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="2" y="6" width="20" height="12" rx="1" />
        <line x1="4" y1="12" x2="20" y2="12" strokeDasharray="2, 2" />
      </svg>
    )
  },
  {
    type: 'cable-manager',
    rackUnits: 2,
    name: 'Cable Management 2U',
    category: 'airflow',
    svg: (
      <svg className="w-4 h-4 text-violet-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="2" y="4" width="20" height="16" rx="1" />
        <line x1="6" y1="8" x2="18" y2="8" />
        <line x1="6" y1="12" x2="18" y2="12" />
        <line x1="6" y1="16" x2="18" y2="16" />
        <line x1="9" y1="6" x2="9" y2="18" />
        <line x1="15" y1="6" x2="15" y2="18" />
      </svg>
    )
  },
  {
    type: 'ups',
    rackUnits: 2,
    name: 'UPS Power Backup 2U',
    category: 'auxiliary',
    svg: (
      <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="2" y="4" width="20" height="16" rx="1" />
        <rect x="5" y="8" width="6" height="4" />
        <circle cx="16" cy="10" r="1.5" />
      </svg>
    )
  },
  {
    type: 'kvm',
    rackUnits: 1,
    name: 'KVM Drawer 1U',
    category: 'auxiliary',
    svg: (
      <svg className="w-4 h-4 text-teal-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="2" y="6" width="20" height="12" rx="1" />
        <line x1="5" y1="12" x2="19" y2="12" />
        <rect x="7" y="8" width="10" height="2" />
      </svg>
    )
  }
];

export function ConfiguratorPanel() {
  const [isZen, setIsZen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // NetBox DCIM State
  const [isNetBoxModalOpen, setIsNetBoxModalOpen] = useState(false);
  const [netboxUrl, setNetboxUrl] = useState('https://netbox.company.internal');
  const [netboxToken, setNetboxToken] = useState('demo-token-0123456789abcdef');
  const [netboxMockMode, setNetboxMockMode] = useState(true);
  const [selectedSiteId, setSelectedSiteId] = useState<number>(1);
  const [selectedRackId, setSelectedRackId] = useState<number>(101);
  const [netboxSites] = useState<NetBoxSite[]>(MOCK_NETBOX_SITES);
  const [netboxRacks] = useState<NetBoxRack[]>(MOCK_NETBOX_RACKS);
  const [netboxLogs, setNetboxLogs] = useState<string[]>([
    'DCIM client initialized (Mock offline mode ready).',
  ]);
  const [isNetBoxSyncing, setIsNetBoxSyncing] = useState(false);

  // Array → useShallow so a fresh reference but identical contents does
  // NOT re-render the panel.
  const installedHardware = useConfiguratorStore(
    useShallow((s) => s.installedHardware),
  );

  // Scalars and function references from Zustand are stable references,
  // so plain `===` selectors are optimal here.
  const capacity = useConfiguratorStore((s) => s.capacity);
  const addHardware = useConfiguratorStore((s) => s.addHardware);
  const removeHardware = useConfiguratorStore((s) => s.removeHardware);
  const viewMode = useConfiguratorStore((s) => s.viewMode);
  const toggleViewMode = useConfiguratorStore((s) => s.toggleViewMode);
  const selectedHardwareId = useConfiguratorStore((s) => s.selectedHardwareId);
  const selectHardware = useConfiguratorStore((s) => s.selectHardware);
  const updateHardwarePosition = useConfiguratorStore((s) => s.updateHardwarePosition);
  const rackType = useConfiguratorStore((s) => s.rackType);
  const isDoorOpen = useConfiguratorStore((s) => s.isDoorOpen);
  const setRackType = useConfiguratorStore((s) => s.setRackType);
  const setDoorOpen = useConfiguratorStore((s) => s.setDoorOpen);
  const undo = useConfiguratorStore((s) => s.undo);
  const redo = useConfiguratorStore((s) => s.redo);
  const canUndo = useConfiguratorStore((s) => s.canUndo);
  const canRedo = useConfiguratorStore((s) => s.canRedo);

  // Multi-Rack baying state & actions
  const racks = useConfiguratorStore(useShallow((s) => s.racks));
  const activeRackId = useConfiguratorStore((s) => s.activeRackId);
  const addRack = useConfiguratorStore((s) => s.addRack);
  const removeRack = useConfiguratorStore((s) => s.removeRack);
  const setActiveRackId = useConfiguratorStore((s) => s.setActiveRackId);
  const importNetBoxRack = useConfiguratorStore((s) => s.importNetBoxRack);

  // Cabling state & actions
  const cables = useConfiguratorStore(useShallow((s) => s.cables));
  const activeCableType = useConfiguratorStore((s) => s.activeCableType);
  const activeCableColor = useConfiguratorStore((s) => s.activeCableColor);
  const setActiveCableType = useConfiguratorStore((s) => s.setActiveCableType);
  const setActiveCableColor = useConfiguratorStore((s) => s.setActiveCableColor);
  const updateCableColor = useConfiguratorStore((s) => s.updateCableColor);
  const updateCableType = useConfiguratorStore((s) => s.updateCableType);
  const selectedCableId = useConfiguratorStore((s) => s.selectedCableId);
  const selectCable = useConfiguratorStore((s) => s.selectCable);
  const removeCable = useConfiguratorStore((s) => s.removeCable);
  const clearAllCables = useConfiguratorStore((s) => s.clearAllCables);

  // 3-Phase Electrical Simulation State
  const voltageStandard = useConfiguratorStore((s) => s.voltageStandard);
  const breakerRating = useConfiguratorStore((s) => s.breakerRating);
  const feedFailoverMode = useConfiguratorStore((s) => s.feedFailoverMode);
  const setVoltageStandard = useConfiguratorStore((s) => s.setVoltageStandard);
  const setBreakerRating = useConfiguratorStore((s) => s.setBreakerRating);
  const setFeedFailoverMode = useConfiguratorStore((s) => s.setFeedFailoverMode);

  // Thermal Simulation State
  const setViewMode = useConfiguratorStore((s) => s.setViewMode);
  const ambientTemperatureC = useConfiguratorStore((s) => s.ambientTemperatureC);
  const setAmbientTemperature = useConfiguratorStore((s) => s.setAmbientTemperature);

  // Derived states
  const { usedUnits, totalPowerDraw } = useMemo(() => {
    let used = 0;
    let power = 0;
    for (const h of installedHardware) {
      used += h.rackUnits;
      power += h.powerDraw;
    }
    return { usedUnits: used, totalPowerDraw: power };
  }, [installedHardware]);

  // Electrical report for active rack
  const electricalReport = useMemo(() => {
    return evaluateRackElectrical(installedHardware, {
      rackId: activeRackId,
      voltageStandard,
      breakerRating,
      failoverMode: feedFailoverMode,
    });
  }, [installedHardware, activeRackId, voltageStandard, breakerRating, feedFailoverMode]);

  // Thermal report for active rack
  const thermalReport = useMemo(() => {
    return evaluateRackThermal(installedHardware, {
      rackId: activeRackId,
      capacity,
      ambientColdAisleTempC: ambientTemperatureC,
    });
  }, [installedHardware, activeRackId, capacity, ambientTemperatureC]);

  const { rowPower, rowUsedUnits, rowCapacity, rowHardwareCount } = useMemo(() => {
    let p = 0;
    let u = 0;
    let c = 0;
    let hCount = 0;
    for (const r of racks) {
      c += r.capacity;
      for (const h of r.installedHardware) {
        p += h.powerDraw;
        u += h.rackUnits;
        hCount++;
      }
    }
    return {
      rowPower: p,
      rowUsedUnits: u,
      rowCapacity: c,
      rowHardwareCount: hCount,
    };
  }, [racks]);

  const totalCableDistance = useMemo(() => {
    return cables.reduce((acc, c) => acc + (c.lengthMeters || 0.4), 0);
  }, [cables]);

  const bendViolationsCount = useMemo(() => {
    return cables.filter((c) => c.hasBendViolation).length;
  }, [cables]);

  const selectedCable = useMemo(() => {
    return cables.find((c) => c.id === selectedCableId) || null;
  }, [cables, selectedCableId]);

  const utilizationPct = capacity > 0 ? Math.min(100, (usedUnits / capacity) * 100) : 0;

  // Selected hardware reference
  const selectedHardware = useMemo(() => {
    return installedHardware.find((h) => h.id === selectedHardwareId) || null;
  }, [installedHardware, selectedHardwareId]);

  // Dynamic slot range calculations (1-indexed for human readability)
  const getSlotRange = (h: HardwareProps) => {
    const bottom = h.position[1] - (h.rackUnits * RACK_UNIT_HEIGHT) / 2;
    const uStart = Math.round(bottom / RACK_UNIT_HEIGHT) + 1;
    const uEnd = uStart + h.rackUnits - 1;
    return uStart === uEnd ? `U${uStart}` : `U${uStart}-${uEnd}`;
  };

  // Property inspector mutator using Zustand internal setState
  const updateHardwareProperty = (id: string, updates: Partial<HardwareProps>) => {
    useConfiguratorStore.getState().recordHistorySnapshot();
    useConfiguratorStore.setState((state) => ({
      installedHardware: state.installedHardware.map((h) =>
        h.id === id ? { ...h, ...updates } : h
      ),
    }));
  };

  // Multi-format export actions
  const handleExportCSV = () => {
    const report = generateBOMReport(racks, cables);
    const csv = exportBOMToCSV(report);
    downloadFile(`datacenter_bom_${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8');
  };

  const handleExportJSON = () => {
    const report = generateBOMReport(racks, cables);
    const json = exportBOMToJSON(report);
    downloadFile(`datacenter_bom_${new Date().toISOString().slice(0, 10)}.json`, json, 'application/json;charset=utf-8');
  };

  const handleExportSVG = () => {
    const activeRack = racks.find((r) => r.id === activeRackId) || racks[0];
    const filename = `${activeRack.name.toLowerCase().replace(/\s+/g, '_')}_elevation.svg`;
    exportRackElevationSVG(activeRack, filename);
  };

  const handleExportGLTF = () => {
    const filename = `datacenter_scene_${new Date().toISOString().slice(0, 10)}.glb`;
    window.dispatchEvent(new CustomEvent('export-gltf', { detail: { filename } }));
  };

  // NetBox DCIM Synchronization Handlers
  const handleNetBoxImport = async () => {
    setIsNetBoxSyncing(true);
    setNetboxLogs((prev) => [
      ...prev,
      `[NETBOX] Connecting to ${netboxMockMode ? 'Mock DCIM' : netboxUrl}...`,
      `[NETBOX] Fetching rack ${selectedRackId} layout and device elevation...`,
    ]);

    try {
      const client = new NetBoxClient({
        url: netboxUrl,
        token: netboxToken,
        mockMode: netboxMockMode,
      });
      const { rack, cables: importedCables } = await client.importRack(selectedRackId);
      importNetBoxRack(rack, importedCables);
      setNetboxLogs((prev) => [
        ...prev,
        `[NETBOX] SUCCESS: Imported "${rack.name}" (${rack.installedHardware.length} devices, ${importedCables.length} cables).`,
      ]);
    } catch (err: any) {
      setNetboxLogs((prev) => [...prev, `[NETBOX ERROR] ${err?.message || String(err)}`]);
    } finally {
      setIsNetBoxSyncing(false);
    }
  };

  const handleNetBoxPush = async () => {
    setIsNetBoxSyncing(true);
    const activeRack = racks.find((r) => r.id === activeRackId) || racks[0];
    setNetboxLogs((prev) => [
      ...prev,
      `[NETBOX] Pushing "${activeRack.name}" to DCIM inventory...`,
    ]);

    try {
      const client = new NetBoxClient({
        url: netboxUrl,
        token: netboxToken,
        mockMode: netboxMockMode,
      });
      const result = await client.syncRackToNetBox(activeRack);
      setNetboxLogs((prev) => [...prev, ...result.logs]);
    } catch (err: any) {
      setNetboxLogs((prev) => [...prev, `[NETBOX ERROR] ${err?.message || String(err)}`]);
    } finally {
      setIsNetBoxSyncing(false);
    }
  };

  // Stacking shifter controls
  const canShiftUp = useMemo(() => {
    if (!selectedHardware) return false;
    const [x, y, z] = selectedHardware.position;
    const nextY = y + RACK_UNIT_HEIGHT;
    return checkDropValidity(
      selectedHardware.id,
      nextY,
      selectedHardware.rackUnits,
      capacity,
      installedHardware
    );
  }, [selectedHardware, capacity, installedHardware]);

  const canShiftDown = useMemo(() => {
    if (!selectedHardware) return false;
    const [x, y, z] = selectedHardware.position;
    const nextY = y - RACK_UNIT_HEIGHT;
    return checkDropValidity(
      selectedHardware.id,
      nextY,
      selectedHardware.rackUnits,
      capacity,
      installedHardware
    );
  }, [selectedHardware, capacity, installedHardware]);

  const shiftHardware = (direction: 'up' | 'down') => {
    if (!selectedHardware) return;
    const [x, y, z] = selectedHardware.position;
    const nextY = direction === 'up' ? y + RACK_UNIT_HEIGHT : y - RACK_UNIT_HEIGHT;
    useConfiguratorStore.getState().recordHistorySnapshot();
    updateHardwarePosition(selectedHardware.id, [x, nextY, z]);
  };

  return (
    <div className="absolute inset-0 pointer-events-none font-mono text-zinc-300 z-10">
      
      {/* ----------------------------------------------------------------- */}
      {/* ZEN MODE, RACK BAY SWITCHER & HISTORY (Top Center HUD)           */}
      {/* ----------------------------------------------------------------- */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2.5 z-50 pointer-events-auto flex-wrap justify-center max-w-[95vw]">
        <button
          type="button"
          onClick={() => setIsZen(!isZen)}
          className="px-3.5 py-1.5 border border-zinc-700 bg-zinc-900/90 hover:bg-zinc-800 text-[11px] font-mono tracking-widest text-cyan-400 uppercase rounded cursor-pointer transition-all shadow-md active:scale-95 shrink-0"
        >
          {isZen ? '[ SHOW PANEL ]' : '[ TOGGLE PANEL ]'}
        </button>

        {/* Rack Bay Switcher Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-700 rounded p-1 shadow-md">
          {racks.map((r, idx) => {
            const isActive = r.id === activeRackId;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveRackId(r.id)}
                className={`px-2.5 py-1 text-[10px] font-mono rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-cyan-950/70 border border-cyan-500 text-cyan-300 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-transparent'
                }`}
              >
                <span>{r.name || `Bay ${idx + 1}`}</span>
                {racks.length > 1 && isActive && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRack(r.id);
                    }}
                    className="ml-0.5 text-[9px] text-zinc-500 hover:text-red-400 hover:scale-125"
                    title="Remove this bay"
                  >
                    ✕
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => addRack()}
            title="Add adjacent bay (+800mm)"
            className="px-2 py-1 text-[10px] font-mono rounded text-emerald-400 hover:bg-emerald-950/40 border border-emerald-600/40 cursor-pointer transition-all active:scale-95"
          >
            + ADD BAY
          </button>
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-700 rounded p-1 shadow-md shrink-0">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z / Cmd+Z)"
            className={`px-2.5 py-1 text-[10px] font-mono rounded flex items-center gap-1.5 transition-all ${
              canUndo
                ? 'text-zinc-200 hover:text-cyan-400 hover:bg-zinc-800 cursor-pointer active:scale-95'
                : 'text-zinc-600 cursor-not-allowed opacity-40'
            }`}
          >
            <span>↶</span>
            <span>UNDO</span>
          </button>
          <div className="h-3 w-px bg-zinc-800" />
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y / Cmd+Shift+Z)"
            className={`px-2.5 py-1 text-[10px] font-mono rounded flex items-center gap-1.5 transition-all ${
              canRedo
                ? 'text-zinc-200 hover:text-cyan-400 hover:bg-zinc-800 cursor-pointer active:scale-95'
                : 'text-zinc-600 cursor-not-allowed opacity-40'
            }`}
          >
            <span>↷</span>
            <span>REDO</span>
          </button>
        </div>

        {/* Export Modal Trigger */}
        <button
          type="button"
          onClick={() => setIsExportModalOpen(true)}
          title="Export BOM (CSV/JSON), 3D GLB, or 2D Vector SVG Elevation"
          className="px-3 py-1.5 text-[10px] font-mono rounded bg-cyan-950/60 text-cyan-300 hover:bg-cyan-900/80 border border-cyan-500/60 shadow-[0_0_10px_rgba(6,182,212,0.2)] flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0"
        >
          <span>💾</span>
          <span className="font-bold">EXPORT</span>
        </button>

        {/* NetBox DCIM Modal Trigger */}
        <button
          type="button"
          onClick={() => setIsNetBoxModalOpen(true)}
          title="NetBox DCIM REST API Import & Sync"
          className="px-3 py-1.5 text-[10px] font-mono rounded bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/80 border border-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.2)] flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0"
        >
          <span>🌐</span>
          <span className="font-bold">NETBOX DCIM</span>
        </button>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* LEFT SIDEBAR: Configurator, Mode, Specs, Hardware Catalog         */}
      {/* ----------------------------------------------------------------- */}
      <aside
        className={`fixed top-4 left-4 bottom-4 w-96 flex flex-col border border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md p-6 overflow-y-auto z-40 pointer-events-auto rounded-lg transition-all duration-300 custom-scrollbar ${
          isZen ? 'opacity-0 -translate-x-12 pointer-events-none' : 'opacity-100 translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="pb-4 border-b border-zinc-800/60 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-zinc-100 font-mono">
              SYSTEM.SYS
            </h2>
            <span className="text-[9px] text-zinc-500 font-mono tracking-wider block mt-0.5">
              LOC-ID: RZ-LAB-01
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[9px] text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 rounded">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>ONLINE</span>
          </div>
        </div>

        {/* Terminal-Style Search Bar */}
        <div className="py-3 border-b border-zinc-800/60">
          <div className="relative flex items-center bg-zinc-950 border border-zinc-850 rounded overflow-hidden focus-within:border-cyan-500/80 focus-within:shadow-[0_0_8px_rgba(6,182,212,0.15)] transition-all duration-200">
            <span className="pl-3 font-mono text-cyan-500/70 text-xs select-none pr-1.5">&gt;</span>
            <input
              type="text"
              placeholder="SEARCH_HARDWARE..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent py-2 pr-3 text-xs font-mono text-zinc-100 placeholder-zinc-650 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 text-[8px] font-mono text-zinc-500 hover:text-zinc-300 focus:outline-none rounded"
              >
                ESC
              </button>
            )}
          </div>
        </div>

        {/* View Mode */}
        <div className="py-4 border-b border-zinc-800/60 flex flex-col gap-2">
          <label className="text-[9px] uppercase tracking-wider text-zinc-500">
            [ VIEWPORT_SETTING ]
          </label>
          <div className="grid grid-cols-3 p-0.5 bg-zinc-950 rounded border border-zinc-800/60">
            <button
              type="button"
              onClick={() => setViewMode('3D')}
              className={`py-1 text-center text-[10px] font-mono rounded transition-all focus:outline-none cursor-pointer ${
                viewMode === '3D'
                  ? 'bg-zinc-850 text-zinc-100 border border-zinc-700/50 shadow-sm font-bold'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              3D
            </button>
            <button
              type="button"
              onClick={() => setViewMode('blueprint')}
              className={`py-1 text-center text-[10px] font-mono rounded transition-all focus:outline-none cursor-pointer ${
                viewMode === 'blueprint'
                  ? 'bg-cyan-950/40 text-cyan-400 border border-cyan-800/40 shadow-sm font-bold'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              BLUEPRINT
            </button>
            <button
              type="button"
              onClick={() => setViewMode('thermal')}
              className={`py-1 text-center text-[10px] font-mono rounded transition-all focus:outline-none cursor-pointer ${
                viewMode === 'thermal'
                  ? 'bg-red-950/50 text-red-300 border border-red-800/60 shadow-sm font-bold animate-pulse'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              THERMAL
            </button>
          </div>
        </div>

        {/* Rack Type Selector */}
        <div className="py-4 border-b border-zinc-800/60 flex flex-col gap-2">
          <label className="text-[9px] uppercase tracking-wider text-zinc-500">
            [ RACK_TYPE ]
          </label>
          <div className="grid grid-cols-3 p-0.5 bg-zinc-950 rounded border border-zinc-800/60">
            <button
              type="button"
              onClick={() => setRackType('2-post')}
              className={`py-1 text-center text-[10px] font-mono rounded transition-all focus:outline-none cursor-pointer ${
                rackType === '2-post'
                  ? 'bg-zinc-850 text-zinc-100 border border-zinc-700/50 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              2-POST
            </button>
            <button
              type="button"
              onClick={() => setRackType('4-post')}
              className={`py-1 text-center text-[10px] font-mono rounded transition-all focus:outline-none cursor-pointer ${
                rackType === '4-post'
                  ? 'bg-zinc-850 text-zinc-100 border border-zinc-700/50 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              4-POST
            </button>
            <button
              type="button"
              onClick={() => setRackType('cabinet')}
              className={`py-1 text-center text-[10px] font-mono rounded transition-all focus:outline-none cursor-pointer ${
                rackType === 'cabinet'
                  ? 'bg-zinc-850 text-zinc-100 border border-zinc-700/50 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              CABINET
            </button>
          </div>
          {rackType === 'cabinet' && (
            <button
              type="button"
              onClick={() => setDoorOpen(!isDoorOpen)}
              className="mt-2 py-1.5 px-3 text-center font-mono text-[10px] uppercase border border-zinc-800/80 bg-zinc-950/40 hover:border-cyan-500 hover:text-cyan-400 hover:bg-cyan-950/10 active:scale-95 transition-all text-zinc-300 focus:outline-none rounded cursor-pointer w-full"
            >
              {isDoorOpen ? '[ CLOSE DOOR ]' : '[ OPEN DOOR ]'}
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="py-4 border-b border-zinc-800/60 flex flex-col gap-3 font-mono">
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>CAPACITY_USE</span>
            <span className="text-zinc-300 font-semibold">{utilizationPct.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xl font-bold tracking-tight text-zinc-100">{usedUnits}U</span>
            <span className="text-[10px] text-zinc-500">/ {capacity}U MAX</span>
          </div>
          <div className="w-full h-1 bg-zinc-900 border border-zinc-800/60 overflow-hidden">
            <div
              className={`h-full bg-cyan-500 transition-all duration-300 shadow-[0_0_10px_rgba(6,182,212,0.5)] ${
                utilizationPct > 90 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : ''
              }`}
              style={{ width: `${utilizationPct}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="bg-zinc-950/50 border border-zinc-800/60 rounded p-2.5">
              <span className="text-[8px] uppercase text-zinc-500 block">TOTAL_DRAW</span>
              <span className="text-xs font-bold text-emerald-400 block mt-1">
                {totalPowerDraw.toLocaleString()} W
              </span>
            </div>
            <div className="bg-zinc-950/50 border border-zinc-800/60 rounded p-2.5">
              <span className="text-[8px] uppercase text-zinc-500 block">NODE_COUNT</span>
              <span className="text-xs font-bold text-cyan-400 block mt-1">
                {installedHardware.length} CHASSIS
              </span>
            </div>
          </div>

          {racks.length > 1 && (
            <div className="mt-1 p-2 bg-cyan-950/20 border border-cyan-800/40 rounded text-[8px] font-mono flex flex-col gap-1">
              <span className="text-cyan-400 font-bold uppercase">[ DATA HALL ROW TOTALS ]</span>
              <div className="flex justify-between text-zinc-300">
                <span>ROW BAYS: {racks.length}</span>
                <span>POWER: {rowPower.toLocaleString()} W</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>UNITS: {rowUsedUnits}U / {rowCapacity}U</span>
                <span>ASSETS: {rowHardwareCount}</span>
              </div>
            </div>
          )}
        </div>

        {/* Patching & Cabling Control Panel */}
        <div className="py-4 border-b border-zinc-800/60 flex flex-col gap-3 font-mono">
          <div className="flex justify-between items-center">
            <label className="text-[9px] uppercase tracking-wider text-zinc-500">
              [ PATCHING & CABLING ]
            </label>
            {cables.length > 0 && (
              <button
                type="button"
                onClick={clearAllCables}
                className="text-[8px] text-zinc-600 hover:text-red-400 font-mono uppercase transition-colors cursor-pointer"
                title="Unpatch all cables"
              >
                [ PURGE ALL ]
              </button>
            )}
          </div>

          {/* Medium Selector */}
          <div className="grid grid-cols-3 gap-1">
            {(Object.keys(CABLE_MEDIUM_SPECS) as CableType[]).map((key) => {
              const spec = CABLE_MEDIUM_SPECS[key];
              const isSelected = activeCableType === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setActiveCableType(key);
                    setActiveCableColor(spec.defaultColor);
                  }}
                  className={`px-1.5 py-1 text-[9px] font-mono rounded border text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300 font-bold'
                      : 'border-zinc-800/80 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {spec.shortLabel}
                </button>
              );
            })}
          </div>

          {/* Color Palette Picker */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[8px] uppercase text-zinc-500 mr-1">COLOR:</span>
            {CABLE_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.hex}
                type="button"
                onClick={() => setActiveCableColor(preset.hex)}
                title={preset.name}
                className={`w-3.5 h-3.5 rounded-full border transition-transform cursor-pointer ${
                  activeCableColor === preset.hex
                    ? 'border-white scale-125 shadow-[0_0_6px_rgba(255,255,255,0.6)]'
                    : 'border-zinc-700 hover:scale-110'
                }`}
                style={{ backgroundColor: preset.hex }}
              />
            ))}
          </div>

          {/* Cabling Telemetry */}
          <div className="grid grid-cols-3 gap-1.5 pt-1 text-[8px]">
            <div className="bg-zinc-950/60 border border-zinc-850 rounded p-1.5">
              <span className="text-zinc-500 block">PATCHED</span>
              <span className="text-[10px] font-bold text-zinc-200 block mt-0.5">{cables.length} RUNS</span>
            </div>
            <div className="bg-zinc-950/60 border border-zinc-850 rounded p-1.5">
              <span className="text-zinc-500 block">LENGTH</span>
              <span className="text-[10px] font-bold text-cyan-400 block mt-0.5">{totalCableDistance.toFixed(2)}m</span>
            </div>
            <div className="bg-zinc-950/60 border border-zinc-850 rounded p-1.5">
              <span className="text-zinc-500 block">BEND STATUS</span>
              <span className={`text-[10px] font-bold block mt-0.5 ${bendViolationsCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {bendViolationsCount > 0 ? `⚠️ ${bendViolationsCount} VIOL.` : 'HEALTHY'}
              </span>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* THERMAL & AIRFLOW SIMULATION                                     */}
        {/* ----------------------------------------------------------------- */}
        <div className="py-4 border-b border-zinc-800/60 flex flex-col gap-3 font-mono">
          <div className="flex justify-between items-center">
            <label className="text-[9px] uppercase tracking-wider text-zinc-500">
              [ THERMAL & AIRFLOW ]
            </label>
            <span
              className={`text-[8px] px-1.5 py-0.5 rounded border font-bold uppercase ${
                thermalReport.hasThrottlingCritical
                  ? 'bg-red-950/80 border-red-500 text-red-300 animate-pulse'
                  : thermalReport.hasRecirculationWarning
                  ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                  : 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
              }`}
            >
              {thermalReport.hasThrottlingCritical
                ? '🔥 THERMAL THROTTLE'
                : thermalReport.hasRecirculationWarning
                ? '⚠️ HOT RECIRCULATION'
                : '✓ COOL AIRFLOW'}
            </span>
          </div>

          {/* Cold Aisle Ambient Temperature Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[8px] uppercase text-zinc-500">
              <span>COLD_AISLE_INTAKE:</span>
              <span className="text-zinc-200 font-bold">{ambientTemperatureC.toFixed(1)}°C</span>
            </div>
            <input
              type="range"
              min={15}
              max={32}
              step={0.5}
              value={ambientTemperatureC}
              onChange={(e) => setAmbientTemperature(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 h-1 bg-zinc-900 rounded appearance-none cursor-pointer border border-zinc-800/80"
            />
          </div>

          {/* Thermal Telemetry Gauges */}
          <div className="grid grid-cols-3 gap-1.5 text-[8px]">
            <div className="bg-zinc-950/60 border border-zinc-850 rounded p-1.5">
              <span className="text-zinc-500 block">MAX EXHAUST</span>
              <span
                className={`text-[10px] font-bold block mt-0.5 ${
                  thermalReport.maxExhaustTempC > 50
                    ? 'text-red-400'
                    : thermalReport.maxExhaustTempC > 40
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {thermalReport.maxExhaustTempC}°C
              </span>
            </div>
            <div className="bg-zinc-950/60 border border-zinc-850 rounded p-1.5">
              <span className="text-zinc-500 block">TOTAL AIRFLOW</span>
              <span className="text-[10px] font-bold text-cyan-400 block mt-0.5">
                {thermalReport.totalAirflowCFM.toLocaleString()} CFM
              </span>
            </div>
            <div className="bg-zinc-950/60 border border-zinc-850 rounded p-1.5">
              <span className="text-zinc-500 block">BYPASS GAPS</span>
              <span
                className={`text-[10px] font-bold block mt-0.5 ${
                  thermalReport.openUnblankedSlotsCount > 0 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {thermalReport.openUnblankedSlotsCount > 0
                  ? `${thermalReport.openUnblankedSlotsCount} OPEN U`
                  : 'SEALED'}
              </span>
            </div>
          </div>

          {/* Recirculation Warning Alert Box */}
          {thermalReport.hasRecirculationWarning && (
            <div className="p-2 bg-amber-950/20 border border-amber-800/40 rounded text-[8px] text-amber-300/90 leading-tight">
              ⚠️ <span className="font-bold">Hot-air bypass recirculation detected:</span> {thermalReport.openUnblankedSlotsCount} unpopulated U-slots allow exhaust hot air to loop into front server inlets. Install blanking panels to prevent thermal throttling.
            </div>
          )}
        </div>

        {/* Add hardware catalog */}
        <div className="py-4 flex flex-col gap-4">
          {(() => {
            const q = searchQuery.toLowerCase().trim();
            const filtered = catalogItems.filter((item) =>
              item.name.toLowerCase().includes(q) ||
              item.type.toLowerCase().includes(q)
            );

            if (filtered.length === 0) {
              return (
                <div className="rounded border border-dashed border-zinc-800/60 px-3 py-10 text-center font-mono text-[10px] text-zinc-600 flex flex-col justify-center select-none uppercase">
                  <span>NO MATCHING HARDWARE</span>
                  <span className="text-[8px] text-zinc-700 mt-1">TRY ANOTHER QUERY</span>
                </div>
              );
            }

            return categories.map((cat) => {
              const catItems = filtered.filter((item) => item.category === cat.id);
              if (catItems.length === 0) return null;

              return (
                <div key={cat.id} className="flex flex-col gap-2">
                  <label className="text-[9px] uppercase tracking-wider text-zinc-500 block">
                    [ INJECT {cat.label} ]
                  </label>
                  <div className="flex flex-col gap-2">
                    {catItems.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => addHardware(item.type, item.rackUnits)}
                        className="flex items-center gap-2.5 py-2.5 px-3 text-left font-mono text-[10px] uppercase border border-zinc-800/80 bg-zinc-950/40 hover:border-cyan-500 hover:text-cyan-400 hover:bg-cyan-950/10 active:scale-95 transition-all text-zinc-300 focus:outline-none rounded cursor-pointer w-full tech-card-hover"
                      >
                        {item.svg}
                        <span>{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* Footer */}
        <div className="mt-auto pt-3 border-t border-zinc-800/60 text-center text-[8px] text-zinc-600 uppercase tracking-widest font-mono select-none">
          SYS-STATUS: OK
        </div>
      </aside>

      {/* ----------------------------------------------------------------- */}
      {/* RIGHT SIDEBAR: Hardware Inventory & Sleek Inspector               */}
      {/* ----------------------------------------------------------------- */}
      <aside
        className={`fixed top-4 right-4 bottom-4 w-80 flex flex-col border border-zinc-800/60 bg-zinc-950/88 backdrop-blur-md p-6 overflow-y-auto z-40 pointer-events-auto rounded-lg transition-all duration-300 custom-scrollbar ${
          isZen ? 'opacity-0 translate-x-12 pointer-events-none' : 'opacity-100 translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="pb-4 border-b border-zinc-800/60 flex justify-between items-baseline">
          <div>
            <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-zinc-100 font-mono">
              INVENTORY.LOG
            </h2>
            <span className="text-[9px] text-zinc-500 font-mono tracking-wider block mt-0.5">
              INSTALLED_UNITS
            </span>
          </div>
          <span className="font-mono text-[9px] text-zinc-400 bg-zinc-900 border border-zinc-800/60 px-1.5 py-0.5 rounded">
            {installedHardware.length}
          </span>
        </div>

        {/* Inventory list */}
        <div className="py-4 flex flex-col gap-1.5">
          {installedHardware.length === 0 ? (
            <div className="rounded border border-dashed border-zinc-800 px-3 py-10 text-center font-mono text-[10px] text-zinc-600 flex flex-col justify-center h-48 bg-zinc-950/20 select-none">
              <span>NO MOUNTED CHASSIS</span>
              <span className="text-[8px] text-zinc-700 mt-1">LOAD UNIT IN LEFT PANEL</span>
            </div>
          ) : (
            [...installedHardware].reverse().map((h, idx) => {
              const isItemLocallySelected = h.id === selectedHardwareId;
              const originalIndex = installedHardware.findIndex((item) => item.id === h.id);
              
              return (
                <div
                  key={h.id}
                  onClick={() => selectHardware(isItemLocallySelected ? null : h.id)}
                  className={`group flex flex-col p-2.5 rounded border cursor-pointer transition-all relative tech-card-hover ${
                    isItemLocallySelected
                      ? 'tech-card-active'
                      : 'border-zinc-800/60 bg-zinc-950/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] tracking-wider uppercase text-zinc-300 font-bold pr-2 truncate">
                      {h.type.replace('-', ' ')} <span className="text-zinc-500 font-normal">#{originalIndex + 1}</span>
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-[8px] text-zinc-400 bg-zinc-900/80 px-1.5 py-0.5 border border-zinc-800/60 rounded">
                        {getSlotRange(h)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeHardware(h.id);
                        }}
                        className="text-zinc-650 hover:text-red-400 transition-colors p-0.5 rounded text-[8px] font-mono select-none focus:outline-none cursor-pointer"
                        title="Decommission Asset"
                      >
                        [X]
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2.5 font-mono text-[9px] text-zinc-500">
                    <span>{h.rackUnits}U</span>
                    <span>{(h.depth * 100).toFixed(0)}cm DEPTH</span>
                    <span className="text-emerald-500/80 font-bold">{h.powerDraw}W</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Hardware Diagnostics Inspector */}
        {selectedHardware && (
          <div className="border-t border-zinc-800/60 pt-4 mt-auto flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2 flex-wrap gap-2">
              <div>
                <span className="text-[8px] font-mono uppercase text-zinc-500 tracking-widest block">
                  ASSET DIAGNOSTICS
                </span>
                <h3 className="text-[10px] font-bold text-zinc-200 capitalize flex items-center gap-1.5 mt-0.5">
                  <span>{selectedHardware.type.replace('-', ' ')}</span>
                  <span className="text-[9px] text-cyan-400 font-mono font-medium bg-cyan-950/20 px-1 border border-cyan-800/30">
                    {getSlotRange(selectedHardware)}
                  </span>
                </h3>
              </div>
              
              {/* Shifters embedded into chassis title */}
              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded p-0.5">
                <button
                  type="button"
                  onClick={() => shiftHardware('down')}
                  disabled={!canShiftDown}
                  className={`p-1 rounded transition-colors focus:outline-none cursor-pointer ${
                    canShiftDown ? 'text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800' : 'text-zinc-800 cursor-not-allowed'
                  }`}
                  title="Shift Position Down"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => shiftHardware('up')}
                  disabled={!canShiftUp}
                  className={`p-1 rounded transition-colors focus:outline-none cursor-pointer ${
                    canShiftUp ? 'text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800' : 'text-zinc-800 cursor-not-allowed'
                  }`}
                  title="Shift Position Up"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Power draw slider */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[9px] uppercase text-zinc-500 font-mono">
                <span>PWR_TARGET</span>
                <span className="text-zinc-300 font-bold">{selectedHardware.powerDraw}W</span>
              </div>
              <input
                type="range"
                min={50}
                max={1200}
                step={10}
                value={selectedHardware.powerDraw}
                onChange={(e) => updateHardwareProperty(selectedHardware.id, { powerDraw: parseInt(e.target.value, 10) })}
                className="w-full accent-cyan-500 h-1 bg-zinc-900 rounded appearance-none cursor-pointer border border-zinc-800/80"
              />
            </div>

            {/* Depth slider */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[9px] uppercase text-zinc-500 font-mono">
                <span>DEPTH_SPEC</span>
                <span className="text-zinc-300 font-bold">{(selectedHardware.depth * 100).toFixed(0)}cm</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={selectedHardware.depth}
                onChange={(e) => updateHardwareProperty(selectedHardware.id, { depth: parseFloat(e.target.value) })}
                className="w-full accent-cyan-500 h-1 bg-zinc-900 rounded appearance-none cursor-pointer border border-zinc-800/80"
              />
            </div>

            <div className="mt-1">
              <button
                type="button"
                onClick={() => selectHardware(null)}
                className="w-full py-1.5 text-center font-mono text-[9px] border border-zinc-800 hover:border-zinc-650 hover:text-zinc-200 transition-colors uppercase focus:outline-none cursor-pointer rounded"
              >
                [ DESELECT ASSET ]
              </button>
            </div>
          </div>
        )}

        {/* Cable Diagnostics Inspector */}
        {selectedCable && (
          <div className="border-t border-zinc-800/60 pt-4 mt-auto flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div>
                <span className="text-[8px] font-mono uppercase text-zinc-500 tracking-widest block">
                  CABLE DIAGNOSTICS
                </span>
                <h3 className="text-[10px] font-bold text-zinc-200 capitalize flex items-center gap-1.5 mt-0.5">
                  <span
                    className="w-2 h-2 rounded-full inline-block shrink-0"
                    style={{ backgroundColor: selectedCable.color }}
                  />
                  <span>{selectedCable.type || 'copper-cat6'}</span>
                  <span className="text-[9px] text-cyan-400 font-mono bg-cyan-950/20 px-1 border border-cyan-800/30">
                    {selectedCable.lengthMeters ? `${selectedCable.lengthMeters}m` : '0.4m'}
                  </span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => removeCable(selectedCable.id)}
                className="text-[9px] px-2 py-1 bg-red-950/60 border border-red-800 text-red-300 hover:bg-red-900 rounded cursor-pointer transition-all active:scale-95"
              >
                UNPATCH
              </button>
            </div>

            {/* Type selector for selected cable */}
            <div className="flex flex-col gap-1">
              <span className="text-[8px] uppercase text-zinc-500 font-mono">MEDIUM_TYPE</span>
              <div className="grid grid-cols-3 gap-1">
                {(Object.keys(CABLE_MEDIUM_SPECS) as CableType[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => updateCableType(selectedCable.id, key)}
                    className={`px-1 py-0.5 text-[8px] font-mono rounded border transition-all cursor-pointer ${
                      selectedCable.type === key
                        ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300 font-bold'
                        : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {CABLE_MEDIUM_SPECS[key].shortLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker for selected cable */}
            <div className="flex flex-col gap-1">
              <span className="text-[8px] uppercase text-zinc-500 font-mono">JACKET_COLOR</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {CABLE_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => updateCableColor(selectedCable.id, preset.hex)}
                    title={preset.name}
                    className={`w-3.5 h-3.5 rounded-full border transition-transform cursor-pointer ${
                      selectedCable.color === preset.hex
                        ? 'border-white scale-125 shadow-[0_0_6px_rgba(255,255,255,0.6)]'
                        : 'border-zinc-700 hover:scale-110'
                    }`}
                    style={{ backgroundColor: preset.hex }}
                  />
                ))}
              </div>
            </div>

            {/* Bend status info */}
            <div className="text-[8px] font-mono p-1.5 bg-zinc-950/60 border border-zinc-850 rounded flex justify-between items-center">
              <span className="text-zinc-500">BEND RADIUS TOLERANCE:</span>
              <span className={selectedCable.hasBendViolation ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                {selectedCable.hasBendViolation ? '⚠️ VIOLATION (< MIN RADIUS)' : 'COMPLIANT (OK)'}
              </span>
            </div>

            <div>
              <button
                type="button"
                onClick={() => selectCable(null)}
                className="w-full py-1 text-center font-mono text-[9px] border border-zinc-800 hover:border-zinc-650 hover:text-zinc-200 transition-colors uppercase focus:outline-none cursor-pointer rounded"
              >
                [ DESELECT CABLE ]
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ----------------------------------------------------------------- */}
      {/* EXPORT MODAL DIALOG                                               */}
      {/* ----------------------------------------------------------------- */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-700/80 rounded-lg max-w-xl w-full p-6 font-mono text-zinc-200 shadow-2xl flex flex-col gap-5">
            <div className="flex justify-between items-start border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold tracking-widest text-cyan-400 uppercase">
                  [ DATA CENTER EXPORT ENGINE ]
                </h3>
                <span className="text-[10px] text-zinc-500 block mt-0.5">
                  MULTI-FORMAT CAD, BOM & VECTOR DRAWING SERIALIZER
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="text-zinc-500 hover:text-red-400 text-xs px-2 py-1 rounded border border-zinc-800 hover:border-red-500/50 cursor-pointer transition-colors"
              >
                [ ESC / CLOSE ]
              </button>
            </div>

            {/* Summary Telemetry Card */}
            <div className="grid grid-cols-4 gap-2 bg-zinc-900/80 border border-zinc-800 p-3 rounded text-[9px]">
              <div>
                <span className="text-zinc-500 block">TOTAL BAYS</span>
                <span className="text-xs font-bold text-zinc-200 block mt-0.5">{racks.length} RACKS</span>
              </div>
              <div>
                <span className="text-zinc-500 block">TOTAL POWER</span>
                <span className="text-xs font-bold text-emerald-400 block mt-0.5">{rowPower.toLocaleString()} W</span>
              </div>
              <div>
                <span className="text-zinc-500 block">HEAT OUTPUT</span>
                <span className="text-xs font-bold text-amber-400 block mt-0.5">{Math.round(rowPower * 3.41214).toLocaleString()} BTU/h</span>
              </div>
              <div>
                <span className="text-zinc-500 block">PATCH RUNS</span>
                <span className="text-xs font-bold text-cyan-400 block mt-0.5">{cables.length} RUNS</span>
              </div>
            </div>

            {/* Export Actions Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* 1. BOM CSV */}
              <button
                type="button"
                onClick={() => {
                  handleExportCSV();
                  setIsExportModalOpen(false);
                }}
                className="p-4 bg-zinc-900/60 hover:bg-zinc-850 border border-zinc-800 hover:border-cyan-500 rounded text-left transition-all group cursor-pointer flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-400 group-hover:text-cyan-300">📄 BOM (CSV)</span>
                  <span className="text-[8px] bg-cyan-950 border border-cyan-800 text-cyan-400 px-1.5 py-0.5 rounded">SPREADSHEET</span>
                </div>
                <span className="text-[9px] text-zinc-400 mt-1">
                  Export complete Bill of Materials as RFC-4180 CSV with chassis, power, phase, and port schedule.
                </span>
              </button>

              {/* 2. BOM JSON */}
              <button
                type="button"
                onClick={() => {
                  handleExportJSON();
                  setIsExportModalOpen(false);
                }}
                className="p-4 bg-zinc-900/60 hover:bg-zinc-850 border border-zinc-800 hover:border-emerald-500 rounded text-left transition-all group cursor-pointer flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 group-hover:text-emerald-300">📋 BOM (JSON)</span>
                  <span className="text-[8px] bg-emerald-950 border border-emerald-800 text-emerald-400 px-1.5 py-0.5 rounded">SCHEMA</span>
                </div>
                <span className="text-[9px] text-zinc-400 mt-1">
                  Export full structured datacenter JSON object for DCIM and automation pipeline ingestion.
                </span>
              </button>

              {/* 3. 2D SVG Elevation */}
              <button
                type="button"
                onClick={() => {
                  handleExportSVG();
                  setIsExportModalOpen(false);
                }}
                className="p-4 bg-zinc-900/60 hover:bg-zinc-850 border border-zinc-800 hover:border-purple-500 rounded text-left transition-all group cursor-pointer flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-400 group-hover:text-purple-300">📐 RACK ELEVATION (SVG)</span>
                  <span className="text-[8px] bg-purple-950 border border-purple-800 text-purple-400 px-1.5 py-0.5 rounded">2D VECTOR</span>
                </div>
                <span className="text-[9px] text-zinc-400 mt-1">
                  Vector 2D rack elevation drawing with EIA-310-D rail markers, mounting holes, and title block.
                </span>
              </button>

              {/* 4. 3D GLTF / GLB */}
              <button
                type="button"
                onClick={() => {
                  handleExportGLTF();
                  setIsExportModalOpen(false);
                }}
                className="p-4 bg-zinc-900/60 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500 rounded text-left transition-all group cursor-pointer flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 group-hover:text-amber-300">🧊 3D SCENE (.GLB)</span>
                  <span className="text-[8px] bg-amber-950 border border-amber-800 text-amber-400 px-1.5 py-0.5 rounded">CAD / 3D</span>
                </div>
                <span className="text-[9px] text-zinc-400 mt-1">
                  Export complete 3D scene meshes, server bezels, and 3D patch cable curves for CAD / Blender.
                </span>
              </button>
            </div>

            <div className="text-[8px] text-zinc-600 text-center border-t border-zinc-800/80 pt-2">
              All exports generated locally with zero cloud telemetry transmission.
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* NETBOX DCIM SYNCHRONIZATION MODAL DIALOG                          */}
      {/* ----------------------------------------------------------------- */}
      {isNetBoxModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-700/80 rounded-lg max-w-2xl w-full p-6 font-mono text-zinc-200 shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-start border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold tracking-widest text-emerald-400 uppercase flex items-center gap-2">
                  <span>🌐</span> [ NETBOX DCIM REST API SYNC ]
                </h3>
                <span className="text-[10px] text-zinc-500 block mt-0.5">
                  BIDIRECTIONAL RACK ELEVATIONS, HARDWARE ASSETS & PATCH CABLING
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsNetBoxModalOpen(false)}
                className="text-zinc-500 hover:text-red-400 text-xs px-2 py-1 rounded border border-zinc-800 hover:border-red-500/50 cursor-pointer transition-colors"
              >
                [ ESC / CLOSE ]
              </button>
            </div>

            {/* Connection Configuration */}
            <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded flex flex-col gap-2.5 text-[9px]">
              <div className="flex justify-between items-center">
                <span className="font-bold text-zinc-300 uppercase">SERVER CONFIGURATION</span>
                <label className="flex items-center gap-1.5 cursor-pointer text-cyan-400">
                  <input
                    type="checkbox"
                    checked={netboxMockMode}
                    onChange={(e) => setNetboxMockMode(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  <span>MOCK / OFFLINE DEMO MODE</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-zinc-500 block mb-0.5">ENDPOINT URL:</label>
                  <input
                    type="text"
                    disabled={netboxMockMode}
                    value={netboxUrl}
                    onChange={(e) => setNetboxUrl(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-200 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 block mb-0.5">API TOKEN:</label>
                  <input
                    type="password"
                    disabled={netboxMockMode}
                    value={netboxToken}
                    onChange={(e) => setNetboxToken(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-200 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Site and Rack Selection */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  <label className="text-zinc-500 block mb-0.5">TARGET DATACENTER SITE:</label>
                  <select
                    value={selectedSiteId}
                    onChange={(e) => setSelectedSiteId(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-200"
                  >
                    {netboxSites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-zinc-500 block mb-0.5">TARGET RACK BAY:</label>
                  <select
                    value={selectedRackId}
                    onChange={(e) => setSelectedRackId(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-200"
                  >
                    {netboxRacks.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.u_height}U)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Sync Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isNetBoxSyncing}
                onClick={handleNetBoxImport}
                className="p-3 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/60 rounded text-left transition-all cursor-pointer flex flex-col gap-1 active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300">⬇ IMPORT FROM NETBOX</span>
                  <span className="text-[8px] bg-emerald-900 border border-emerald-700 text-emerald-300 px-1 rounded">PULL DCIM</span>
                </div>
                <span className="text-[9px] text-zinc-400">
                  Load selected rack elevation, hardware assets, and patch cables directly into the 3D scene.
                </span>
              </button>

              <button
                type="button"
                disabled={isNetBoxSyncing}
                onClick={handleNetBoxPush}
                className="p-3 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/60 rounded text-left transition-all cursor-pointer flex flex-col gap-1 active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300">⬆ SYNC ACTIVE RACK TO NETBOX</span>
                  <span className="text-[8px] bg-cyan-900 border border-cyan-700 text-cyan-300 px-1 rounded">PUSH DCIM</span>
                </div>
                <span className="text-[9px] text-zinc-400">
                  Serialize and push currently active 3D layout modifications to the NetBox inventory.
                </span>
              </button>
            </div>

            {/* Live Sync Logs Terminal */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-[8px] text-zinc-500">
                <span>DCIM SYNC CONSOLE LOG:</span>
                <button
                  type="button"
                  onClick={() => setNetboxLogs([])}
                  className="hover:text-zinc-300 underline cursor-pointer"
                >
                  CLEAR
                </button>
              </div>
              <div className="bg-black/90 border border-zinc-850 rounded p-2.5 h-28 overflow-y-auto font-mono text-[9px] text-zinc-400 flex flex-col gap-1 custom-scrollbar">
                {netboxLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className={
                      log.includes('ERROR')
                        ? 'text-red-400'
                        : log.includes('SUCCESS')
                        ? 'text-emerald-400 font-bold'
                        : 'text-zinc-400'
                    }
                  >
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
