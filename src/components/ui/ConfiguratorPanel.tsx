/**
 * ConfiguratorPanel.tsx
 *
 * Overlay UI panel rendered above the R3F <Canvas>. Lists installed
 * hardware, exposes add/remove actions, and reports rack utilization
 * plus total power draw.
 *
 * Architectural notes:
 * - The `installedHardware` array is read with `useShallow` so the panel
 *   only re-renders when hardware actually changes (not on every store
 *   mutation, which creates a fresh array reference).
 * - Mutator references returned by Zustand are stable across renders, so
 *   they can be selected with simple `===` selectors.
 * - `powerDraw` and `usedUnits` are derived locally via `useMemo` — they
 *   only need to be recomputed when `installedHardware` changes.
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useConfiguratorStore, RACK_UNIT_HEIGHT } from '../../store/useConfiguratorStore';
import type { HardwareProps, HardwareType } from '../../types/rack.types';
import { checkDropValidity } from '../../utils/rackLayout';

/** Static catalog of hardware types that can be added. Kept here for UI locality. */
const HARDWARE_OPTIONS: ReadonlyArray<{
  type: HardwareType;
  label: string;
  accent: string; // tailwind text color, e.g. 'text-sky-400'
}> = [
  { type: 'server', label: 'Server', accent: 'bg-sky-400' },
  { type: 'switch', label: 'Switch', accent: 'bg-emerald-400' },
  { type: 'router', label: 'Router', accent: 'bg-amber-400' },
  { type: 'patch-panel', label: 'Patch Panel', accent: 'bg-violet-400' },
];

export function ConfiguratorPanel() {
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
    <div className="flex h-full w-full justify-between pointer-events-none font-sans text-zinc-200">
      
      {/* ----------------------------------------------------------------- */}
      {/* LEFT SIDEBAR: Header, Controls, Add Assets, Diagnostics           */}
      {/* ----------------------------------------------------------------- */}
      <aside className="w-[380px] h-full bg-zinc-950/85 border-r border-zinc-800/80 backdrop-blur-md pointer-events-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800/80 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold tracking-[0.16em] uppercase text-zinc-100">
              Rack Configurator
            </h1>
            <span className="text-[10px] text-zinc-500 font-mono tracking-normal block mt-0.5">
              rz-cloud.work · lab environment
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">ONLINE</span>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="px-6 py-4 border-b border-zinc-800/80 flex flex-col gap-2">
          <label className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">
            Viewport mode
          </label>
          <div className="grid grid-cols-2 p-0.5 bg-zinc-900/60 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => viewMode === 'blueprint' && toggleViewMode()}
              className={`py-1.5 text-center text-xs rounded-md transition-all font-medium focus:outline-none ${
                viewMode === '3D'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/50'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              3D Render
            </button>
            <button
              type="button"
              onClick={() => viewMode === '3D' && toggleViewMode()}
              className={`py-1.5 text-center text-xs rounded-md transition-all font-medium focus:outline-none ${
                viewMode === 'blueprint'
                  ? 'bg-cyan-950/40 text-cyan-400 border border-cyan-800/50'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Blueprint
            </button>
          </div>
        </div>

        {/* System Stats Widget */}
        <div className="px-6 py-5 border-b border-zinc-800/80 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px] font-mono uppercase text-zinc-500 tracking-wider">
              <span>Capacity utilization</span>
              <span className={`font-semibold ${utilizationPct > 90 ? 'text-red-400' : 'text-zinc-300'}`}>
                {utilizationPct.toFixed(0)}%
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-zinc-100 font-mono">
                {usedUnits}
              </span>
              <span className="text-xs text-zinc-500 font-mono">/ {capacity}U Used</span>
            </div>
            <div className="w-full h-2 bg-zinc-900 rounded-full mt-2 overflow-hidden border border-zinc-800/50">
              <div
                className={`h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300 ${
                  utilizationPct > 90 ? 'from-red-500 to-orange-500' : ''
                }`}
                style={{ width: `${utilizationPct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-1">
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-lg p-3">
              <span className="text-[9px] font-mono uppercase text-zinc-500 tracking-wider block">
                Total Power
              </span>
              <span className="text-md font-semibold font-mono text-emerald-400 block mt-1">
                {totalPowerDraw.toLocaleString()} W
              </span>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-lg p-3">
              <span className="text-[9px] font-mono uppercase text-zinc-500 tracking-wider block">
                Asset Count
              </span>
              <span className="text-md font-semibold font-mono text-cyan-400 block mt-1">
                {installedHardware.length} Units
              </span>
            </div>
          </div>
        </div>

        {/* Add Assets Panel */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          <div>
            <label className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider block mb-2">
              Add compute units
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => addHardware('server', 1)}
                className="py-2.5 px-1 text-center text-[10px] rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-sky-500/50 hover:bg-zinc-850 hover:-translate-y-0.5 active:scale-95 transition-all font-medium focus:outline-none"
              >
                Server 1U
              </button>
              <button
                type="button"
                onClick={() => addHardware('server', 2)}
                className="py-2.5 px-1 text-center text-[10px] rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-sky-500/50 hover:bg-zinc-850 hover:-translate-y-0.5 active:scale-95 transition-all font-medium focus:outline-none"
              >
                Server 2U
              </button>
              <button
                type="button"
                onClick={() => addHardware('server', 4)}
                className="py-2.5 px-1 text-center text-[10px] rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-sky-500/50 hover:bg-zinc-850 hover:-translate-y-0.5 active:scale-95 transition-all font-medium focus:outline-none"
              >
                Server 4U
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider block mb-2">
              Add networking components
            </label>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => addHardware('switch', 1)}
                className="py-3 px-4 text-left text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 hover:border-emerald-500/50 hover:bg-zinc-850 hover:-translate-y-0.5 active:scale-95 transition-all flex justify-between items-center font-medium focus:outline-none"
              >
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>Ethernet Switch</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">1U</span>
              </button>
              
              <button
                type="button"
                onClick={() => addHardware('router', 1)}
                className="py-3 px-4 text-left text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 hover:border-amber-500/50 hover:bg-zinc-850 hover:-translate-y-0.5 active:scale-95 transition-all flex justify-between items-center font-medium focus:outline-none"
              >
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span>Core Router (1U)</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">1U</span>
              </button>

              <button
                type="button"
                onClick={() => addHardware('router', 2)}
                className="py-3 px-4 text-left text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 hover:border-amber-500/50 hover:bg-zinc-850 hover:-translate-y-0.5 active:scale-95 transition-all flex justify-between items-center font-medium focus:outline-none"
              >
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span>Core Router (2U)</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">2U</span>
              </button>

              <button
                type="button"
                onClick={() => addHardware('patch-panel', 1)}
                className="py-3 px-4 text-left text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 hover:border-violet-500/50 hover:bg-zinc-850 hover:-translate-y-0.5 active:scale-95 transition-all flex justify-between items-center font-medium focus:outline-none"
              >
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                  <span>Patch Panel</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">1U</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800/80 font-mono text-[9px] text-zinc-500 text-center">
          Interactive Web Rack System HUD
        </div>
      </aside>

      {/* ----------------------------------------------------------------- */}
      {/* CENTER SPACE: Allows pointer events to pass to canvas             */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex-1 pointer-events-none" />

      {/* ----------------------------------------------------------------- */}
      {/* RIGHT SIDEBAR: Hardware Inventory & Property Inspector            */}
      {/* ----------------------------------------------------------------- */}
      <aside className="w-[320px] h-full bg-zinc-950/85 border-l border-zinc-800/80 backdrop-blur-md pointer-events-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800/80 flex justify-between items-baseline">
          <div>
            <h2 className="text-sm font-semibold tracking-wider uppercase text-zinc-100">
              Rack Inventory
            </h2>
            <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
              Manage installed hardware
            </span>
          </div>
          <span className="text-xs font-mono text-zinc-400 font-bold bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
            {installedHardware.length} units
          </span>
        </div>

        {/* Inventory list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">
          {installedHardware.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-xs italic text-zinc-500 flex flex-col gap-1 justify-center h-48 bg-zinc-900/10">
              <span>No hardware mounted.</span>
              <span className="text-[10px] text-zinc-600 not-italic">Pick a unit on the left to install.</span>
            </div>
          ) : (
            [...installedHardware].reverse().map((h, idx) => {
              const opt = HARDWARE_OPTIONS.find((o) => o.type === h.type);
              const isItemLocallySelected = h.id === selectedHardwareId;
              const originalIndex = installedHardware.findIndex((item) => item.id === h.id);
              
              return (
                <div
                  key={h.id}
                  onClick={() => selectHardware(isItemLocallySelected ? null : h.id)}
                  className={`group flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                    isItemLocallySelected
                      ? 'border-cyan-500/80 bg-cyan-950/15 shadow-md shadow-cyan-950/20'
                      : 'border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        opt?.accent ?? 'bg-zinc-500'
                      } ${isItemLocallySelected ? 'ring-2 ring-cyan-500/40' : ''}`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-100 capitalize truncate flex items-center gap-1.5">
                        <span>{h.type.replace('-', ' ')}</span>
                        <span className="text-[9px] font-normal text-zinc-500 font-mono">#{originalIndex + 1}</span>
                      </div>
                      <div className="font-mono text-[9px] text-zinc-500 flex items-center gap-2 mt-0.5">
                        <span className="text-zinc-400 font-medium">{getSlotRange(h)}</span>
                        <span>·</span>
                        <span>{h.rackUnits}U</span>
                        <span>·</span>
                        <span>{h.powerDraw}W</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeHardware(h.id);
                    }}
                    aria-label={`Remove unit`}
                    className="h-6 w-6 shrink-0 grid place-items-center rounded-md border border-transparent text-zinc-500 transition-all hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none"
                  >
                    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                      <path
                        d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Property Inspector Panel */}
        {selectedHardware && (
          <div className="border-t border-zinc-800/80 p-5 bg-zinc-900/60 backdrop-blur-md flex flex-col gap-4 shrink-0 shadow-[0_-12px_24px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <span className="text-[9px] font-mono uppercase text-zinc-500 tracking-wider">
                  Selected Asset
                </span>
                <h3 className="text-xs font-bold text-zinc-100 capitalize flex items-center gap-1.5 mt-0.5">
                  <span>{selectedHardware.type.replace('-', ' ')}</span>
                  <span className="text-[10px] text-cyan-400 font-mono font-medium">
                    ({getSlotRange(selectedHardware)})
                  </span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => selectHardware(null)}
                className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 focus:outline-none"
              >
                DESELECT
              </button>
            </div>

            {/* Shift U Position controls */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">
                Mount position
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => shiftHardware('down')}
                  disabled={!canShiftDown}
                  className={`py-1.5 px-2 text-center text-xs rounded-md border font-medium transition-all focus:outline-none flex justify-center items-center gap-1.5 ${
                    canShiftDown
                      ? 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700 active:scale-95'
                      : 'bg-zinc-900/40 border-zinc-900 text-zinc-700 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                  <span>Shift Down</span>
                </button>
                <button
                  type="button"
                  onClick={() => shiftHardware('up')}
                  disabled={!canShiftUp}
                  className={`py-1.5 px-2 text-center text-xs rounded-md border font-medium transition-all focus:outline-none flex justify-center items-center gap-1.5 ${
                    canShiftUp
                      ? 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700 active:scale-95'
                      : 'bg-zinc-900/40 border-zinc-900 text-zinc-700 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                  </svg>
                  <span>Shift Up</span>
                </button>
              </div>
            </div>

            {/* Power Draw Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[10px] font-mono uppercase text-zinc-500 tracking-wider">
                <span>Power consumption</span>
                <span className="text-zinc-300 font-semibold tracking-tight">
                  {selectedHardware.powerDraw} W
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={1200}
                step={10}
                value={selectedHardware.powerDraw}
                onChange={(e) => updateHardwareProperty(selectedHardware.id, { powerDraw: parseInt(e.target.value, 10) })}
                className="w-full accent-cyan-400 h-1 bg-zinc-950 rounded-lg appearance-none cursor-pointer border border-zinc-800"
              />
            </div>

            {/* Depth Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[10px] font-mono uppercase text-zinc-500 tracking-wider">
                <span>Chassis depth</span>
                <span className="text-zinc-300 font-semibold tracking-tight">
                  {(selectedHardware.depth * 100).toFixed(0)} cm
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={selectedHardware.depth}
                onChange={(e) => updateHardwareProperty(selectedHardware.id, { depth: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 h-1 bg-zinc-950 rounded-lg appearance-none cursor-pointer border border-zinc-800"
              />
            </div>
          </div>
        )}
      </aside>

    </div>
  );
}
