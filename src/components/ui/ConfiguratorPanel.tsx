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
import { checkDropValidity } from '../../utils/rackLayout';

export function ConfiguratorPanel() {
  const [isZen, setIsZen] = useState(false);

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
    useConfiguratorStore.setState((state) => ({
      installedHardware: state.installedHardware.map((h) =>
        h.id === id ? { ...h, ...updates } : h
      ),
    }));
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
    updateHardwarePosition(selectedHardware.id, [x, nextY, z]);
  };

  return (
    <div className="absolute inset-0 pointer-events-none font-mono text-zinc-300 z-10">
      
      {/* ----------------------------------------------------------------- */}
      {/* ZEN MODE TOGGLE (Top Center HUD Trigger)                          */}
      {/* ----------------------------------------------------------------- */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-4 z-50 pointer-events-auto">
        <button
          onClick={() => setIsZen(!isZen)}
          className="px-4 py-2 border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-xs font-mono tracking-widest text-cyan-400 uppercase rounded cursor-pointer"
        >
          {isZen ? '[ SHOW CONTROL PANEL ]' : '[ TOGGLE CONTROL PANEL ]'}
        </button>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* LEFT SIDEBAR: Configurator, Mode, Specs, Hardware Catalog         */}
      {/* ----------------------------------------------------------------- */}
      <aside
        className={`fixed top-4 left-4 bottom-4 w-96 flex flex-col border border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md p-6 overflow-y-auto z-40 pointer-events-auto rounded-lg transition-all duration-300 ${
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

        {/* View Mode */}
        <div className="py-4 border-b border-zinc-800/60 flex flex-col gap-2">
          <label className="text-[9px] uppercase tracking-wider text-zinc-500">
            [ VIEWPORT_SETTING ]
          </label>
          <div className="grid grid-cols-2 p-0.5 bg-zinc-950 rounded border border-zinc-800/60">
            <button
              type="button"
              onClick={() => viewMode === 'blueprint' && toggleViewMode()}
              className={`py-1.5 text-center text-xs font-mono rounded transition-all focus:outline-none cursor-pointer ${
                viewMode === '3D'
                  ? 'bg-zinc-850 text-zinc-100 border border-zinc-700/50 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              3D RENDER
            </button>
            <button
              type="button"
              onClick={() => viewMode === '3D' && toggleViewMode()}
              className={`py-1.5 text-center text-xs font-mono rounded transition-all focus:outline-none cursor-pointer ${
                viewMode === 'blueprint'
                  ? 'bg-cyan-950/20 text-cyan-400 border border-cyan-800/40 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              BLUEPRINT
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
        </div>

        {/* Add hardware catalog */}
        <div className="py-4 flex flex-col gap-4">
          <div>
            <label className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-2">
              [ INJECT COMPUTE ]
            </label>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => addHardware('server', 1)}
                className="flex items-center gap-2.5 py-2.5 px-3 text-left font-mono text-[10px] uppercase border border-zinc-800/80 bg-zinc-950/40 hover:border-cyan-500 hover:text-cyan-400 hover:bg-cyan-950/10 active:scale-95 transition-all text-zinc-300 focus:outline-none rounded cursor-pointer w-full"
              >
                <svg className="w-4 h-4 text-sky-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="2" y="5" width="20" height="6" rx="1" />
                  <line x1="6" y1="8" x2="8" y2="8" strokeLinecap="round" />
                  <circle cx="16" cy="8" r="0.75" fill="currentColor" />
                  <circle cx="18" cy="8" r="0.75" fill="currentColor" />
                </svg>
                <span>SERVER 1U</span>
              </button>
              <button
                type="button"
                onClick={() => addHardware('server', 2)}
                className="flex items-center gap-2.5 py-2.5 px-3 text-left font-mono text-[10px] uppercase border border-zinc-800/80 bg-zinc-950/40 hover:border-cyan-500 hover:text-cyan-400 hover:bg-cyan-950/10 active:scale-95 transition-all text-zinc-300 focus:outline-none rounded cursor-pointer w-full"
              >
                <svg className="w-4 h-4 text-sky-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="2" y="5" width="20" height="6" rx="1" />
                  <line x1="6" y1="8" x2="8" y2="8" strokeLinecap="round" />
                  <rect x="2" y="13" width="20" height="6" rx="1" />
                  <line x1="6" y1="16" x2="8" y2="16" strokeLinecap="round" />
                </svg>
                <span>SERVER 2U</span>
              </button>
              <button
                type="button"
                onClick={() => addHardware('server', 4)}
                className="flex items-center gap-2.5 py-2.5 px-3 text-left font-mono text-[10px] uppercase border border-zinc-800/80 bg-zinc-950/40 hover:border-cyan-500 hover:text-cyan-400 hover:bg-cyan-950/10 active:scale-95 transition-all text-zinc-300 focus:outline-none rounded cursor-pointer w-full"
              >
                <svg className="w-4 h-4 text-sky-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="2" y="2" width="20" height="20" rx="1" />
                  <line x1="6" y1="6" x2="8" y2="6" strokeLinecap="round" />
                  <line x1="6" y1="12" x2="8" y2="12" strokeLinecap="round" />
                  <line x1="6" y1="18" x2="8" y2="18" strokeLinecap="round" />
                </svg>
                <span>SERVER 4U</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-2">
              [ INJECT NETWORKING ]
            </label>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => addHardware('switch', 1)}
                className="flex items-center gap-2.5 py-2.5 px-3 text-left font-mono text-[10px] uppercase border border-zinc-800/80 bg-zinc-950/40 hover:border-cyan-500 hover:text-cyan-400 hover:bg-cyan-950/10 active:scale-95 transition-all text-zinc-300 focus:outline-none rounded cursor-pointer w-full"
              >
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
                <span>SWITCH.NET 1U</span>
              </button>
              <button
                type="button"
                onClick={() => addHardware('router', 1)}
                className="flex items-center gap-2.5 py-2.5 px-3 text-left font-mono text-[10px] uppercase border border-zinc-800/80 bg-zinc-950/40 hover:border-cyan-500 hover:text-cyan-400 hover:bg-cyan-950/10 active:scale-95 transition-all text-zinc-300 focus:outline-none rounded cursor-pointer w-full"
              >
                <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="2" y="6" width="20" height="12" rx="1" />
                  <circle cx="6" cy="12" r="1.5" />
                  <line x1="10" y1="12" x2="20" y2="12" />
                  <circle cx="14" cy="12" r="1" />
                  <circle cx="18" cy="12" r="1" />
                </svg>
                <span>CORE-RTR.1 1U</span>
              </button>
              <button
                type="button"
                onClick={() => addHardware('router', 2)}
                className="flex items-center gap-2.5 py-2.5 px-3 text-left font-mono text-[10px] uppercase border border-zinc-800/80 bg-zinc-950/40 hover:border-cyan-500 hover:text-cyan-400 hover:bg-cyan-950/10 active:scale-95 transition-all text-zinc-300 focus:outline-none rounded cursor-pointer w-full"
              >
                <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="2" y="4" width="20" height="16" rx="1" />
                  <line x1="12" y1="4" x2="12" y2="20" />
                  <circle cx="6" cy="12" r="2" />
                  <circle cx="18" cy="12" r="2" />
                </svg>
                <span>CORE-RTR.2 2U</span>
              </button>
              <button
                type="button"
                onClick={() => addHardware('patch-panel', 1)}
                className="flex items-center gap-2.5 py-2.5 px-3 text-left font-mono text-[10px] uppercase border border-zinc-800/80 bg-zinc-950/40 hover:border-cyan-500 hover:text-cyan-400 hover:bg-cyan-950/10 active:scale-95 transition-all text-zinc-300 focus:outline-none rounded cursor-pointer w-full"
              >
                <svg className="w-4 h-4 text-violet-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="2" y="6" width="20" height="12" rx="1" />
                  <circle cx="5" cy="12" r="1" />
                  <circle cx="8" cy="12" r="1" />
                  <circle cx="11" cy="12" r="1" />
                  <circle cx="14" cy="12" r="1" />
                  <circle cx="17" cy="12" r="1" />
                  <circle cx="20" cy="12" r="1" />
                </svg>
                <span>CABLE-MNG.P 1U</span>
              </button>
              <button
                type="button"
                onClick={() => addHardware('firewall', 1)}
                className="flex items-center gap-2.5 py-2.5 px-3 text-left font-mono text-[10px] uppercase border border-zinc-800/80 bg-zinc-950/40 hover:border-cyan-500 hover:text-cyan-400 hover:bg-cyan-950/10 active:scale-95 transition-all text-zinc-300 focus:outline-none rounded cursor-pointer w-full"
              >
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="2" y="6" width="20" height="12" rx="1" />
                  <circle cx="6" cy="12" r="1.5" />
                  <line x1="10" y1="10" x2="12" y2="10" />
                  <line x1="10" y1="14" x2="12" y2="14" />
                  <rect x="15" y="9" width="4" height="6" />
                </svg>
                <span>FIREWALL APPLIANCE 1U</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-2">
              [ INJECT AUXILIARY ]
            </label>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => addHardware('ups', 2)}
                className="flex items-center gap-2.5 py-2.5 px-3 text-left font-mono text-[10px] uppercase border border-zinc-800/80 bg-zinc-950/40 hover:border-cyan-500 hover:text-cyan-400 hover:bg-cyan-950/10 active:scale-95 transition-all text-zinc-300 focus:outline-none rounded cursor-pointer w-full"
              >
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="2" y="4" width="20" height="16" rx="1" />
                  <rect x="5" y="8" width="6" height="4" />
                  <circle cx="16" cy="10" r="1.5" />
                </svg>
                <span>UPS POWER BACKUP 2U</span>
              </button>
              <button
                type="button"
                onClick={() => addHardware('kvm', 1)}
                className="flex items-center gap-2.5 py-2.5 px-3 text-left font-mono text-[10px] uppercase border border-zinc-800/80 bg-zinc-950/40 hover:border-cyan-500 hover:text-cyan-400 hover:bg-cyan-950/10 active:scale-95 transition-all text-zinc-300 focus:outline-none rounded cursor-pointer w-full"
              >
                <svg className="w-4 h-4 text-teal-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="2" y="6" width="20" height="12" rx="1" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <rect x="7" y="8" width="10" height="2" />
                </svg>
                <span>KVM DRAWER 1U</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-2">
              [ INJECT STORAGE ]
            </label>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => addHardware('jbod', 4)}
                className="flex items-center gap-2.5 py-2.5 px-3 text-left font-mono text-[10px] uppercase border border-zinc-800/80 bg-zinc-950/40 hover:border-cyan-500 hover:text-cyan-400 hover:bg-cyan-950/10 active:scale-95 transition-all text-zinc-300 focus:outline-none rounded cursor-pointer w-full"
              >
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
                <span>JBOD STORAGE 4U</span>
              </button>
              <button
                type="button"
                onClick={() => addHardware('nas', 2)}
                className="flex items-center gap-2.5 py-2.5 px-3 text-left font-mono text-[10px] uppercase border border-zinc-800/80 bg-zinc-950/40 hover:border-cyan-500 hover:text-cyan-400 hover:bg-cyan-950/10 active:scale-95 transition-all text-zinc-300 focus:outline-none rounded cursor-pointer w-full"
              >
                <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="2" y="4" width="20" height="16" rx="1" />
                  <rect x="5" y="8" width="6" height="8" />
                  <circle cx="16" cy="10" r="1" />
                  <circle cx="18" cy="10" r="1" />
                </svg>
                <span>NAS STORAGE 2U</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-2">
              [ INJECT AIRFLOW ]
            </label>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => addHardware('blank', 1)}
                className="flex items-center gap-2.5 py-2.5 px-3 text-left font-mono text-[10px] uppercase border border-zinc-800/80 bg-zinc-950/40 hover:border-cyan-500 hover:text-cyan-400 hover:bg-cyan-950/10 active:scale-95 transition-all text-zinc-300 focus:outline-none rounded cursor-pointer w-full"
              >
                <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="2" y="6" width="20" height="12" rx="1" />
                  <line x1="4" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="20" y2="12" />
                </svg>
                <span>BLANKING PANEL 1U</span>
              </button>
              <button
                type="button"
                onClick={() => addHardware('blank', 2)}
                className="flex items-center gap-2.5 py-2.5 px-3 text-left font-mono text-[10px] uppercase border border-zinc-800/80 bg-zinc-950/40 hover:border-cyan-500 hover:text-cyan-400 hover:bg-cyan-950/10 active:scale-95 transition-all text-zinc-300 focus:outline-none rounded cursor-pointer w-full"
              >
                <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="2" y="4" width="20" height="16" rx="1" />
                  <line x1="4" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="20" y2="12" />
                </svg>
                <span>BLANKING PANEL 2U</span>
              </button>
              <button
                type="button"
                onClick={() => addHardware('brush', 1)}
                className="flex items-center gap-2.5 py-2.5 px-3 text-left font-mono text-[10px] uppercase border border-zinc-800/80 bg-zinc-950/40 hover:border-cyan-500 hover:text-cyan-400 hover:bg-cyan-950/10 active:scale-95 transition-all text-zinc-300 focus:outline-none rounded cursor-pointer w-full"
              >
                <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="2" y="6" width="20" height="12" rx="1" />
                  <line x1="4" y1="12" x2="20" y2="12" strokeDasharray="2, 2" />
                </svg>
                <span>CABLE BRUSH PANEL 1U</span>
              </button>
            </div>
          </div>
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
        className={`fixed top-4 right-4 bottom-4 w-80 flex flex-col border border-zinc-800/60 bg-zinc-950/88 backdrop-blur-md p-6 overflow-y-auto z-40 pointer-events-auto rounded-lg transition-all duration-300 ${
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
                  className={`group flex flex-col p-2.5 rounded border cursor-pointer transition-all relative ${
                    isItemLocallySelected
                      ? 'border-cyan-500 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                      : 'border-zinc-800/60 bg-zinc-950/40 hover:border-zinc-750 hover:bg-zinc-900/40'
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
      </aside>

    </div>
  );
}
