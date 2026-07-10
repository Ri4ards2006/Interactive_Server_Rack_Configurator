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
import { useConfiguratorStore } from '../../store/useConfiguratorStore';
import type { HardwareType } from '../../types/rack.types';

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

/** Default rack-units to insert when the user clicks an "add" button. */
const DEFAULT_RACK_UNITS = 1;

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

  const { usedUnits, totalPowerDraw } = useMemo(() => {
    let used = 0;
    let power = 0;
    for (const h of installedHardware) {
      used += h.rackUnits;
      power += h.powerDraw;
    }
    return { usedUnits: used, totalPowerDraw: power };
  }, [installedHardware]);

  const utilizationPct =
    capacity > 0 ? Math.min(100, (usedUnits / capacity) * 100) : 0;

  return (
    <aside
      aria-label="Rack configurator panel"
      className="pointer-events-auto absolute right-6 top-6 z-10 flex w-[360px] max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/85 text-zinc-100 shadow-2xl shadow-black/50 backdrop-blur-md font-sans"
    >
      <header className="flex items-baseline justify-between border-b border-zinc-800/80 px-5 py-4">
        <h1 className="text-[0.95rem] font-semibold uppercase tracking-[0.18em]">
          Rack Configurator
        </h1>
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          EIA-310
        </span>
      </header>

      {/* Stats: capacity utilization + total power draw */}
      <section className="grid grid-cols-2 gap-x-5 gap-y-1 border-b border-zinc-800/80 px-5 py-3 font-mono">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            Utilization
          </div>
          <div className="mt-1 text-lg leading-none">
            <span className="tabular-nums">{usedUnits}</span>
            <span className="text-xs text-zinc-500">
              {' '}
              / {capacity}U
            </span>
          </div>
          <div
            className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-800/80"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={capacity}
            aria-valuenow={usedUnits}
          >
            <div
              className="h-full bg-emerald-400 transition-[width] duration-300 ease-out"
              style={{ width: `${utilizationPct}%` }}
            />
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            Power Draw
          </div>
          <div className="mt-1 text-lg leading-none">
            <span className="tabular-nums">
              {totalPowerDraw.toLocaleString()}
            </span>
            <span className="text-xs text-zinc-500"> W</span>
          </div>
          <div className="mt-2 text-[10px] text-zinc-500">
            {installedHardware.length}{' '}
            device{installedHardware.length === 1 ? '' : 's'}
          </div>
        </div>
      </section>

      {/* Add hardware */}
      <section className="border-b border-zinc-800/80 px-5 py-3">
        <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
          + Add Hardware
        </div>
        <div className="grid grid-cols-2 gap-2">
          {HARDWARE_OPTIONS.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              onClick={() => addHardware(type, DEFAULT_RACK_UNITS)}
              className="group flex items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800 active:bg-zinc-900 focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/60"
            >
              <span>{label}</span>
              <span className="font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400">
                {DEFAULT_RACK_UNITS}U
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Installed hardware list */}
      <section className="flex-1 overflow-y-auto px-5 py-3">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            Installed ({installedHardware.length})
          </span>
        </div>

        {installedHardware.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-800 px-3 py-6 text-center text-xs italic text-zinc-600">
            No hardware installed.
            <br />
            Pick a unit above to begin.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {installedHardware.map((h, idx) => {
              const accent = HARDWARE_OPTIONS.find((o) => o.type === h.type);
              return (
                <li
                  key={h.id}
                  className="group flex items-center gap-3 rounded-md border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
                >
                  <span
                    aria-hidden
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                      accent?.accent ?? 'bg-zinc-500'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium capitalize text-zinc-100">
                      {h.type} #{idx + 1}
                    </div>
                    <div className="font-mono text-[10px] text-zinc-500 tabular-nums">
                      {h.rackUnits}U · {h.powerDraw}W
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeHardware(h.id)}
                    aria-label={`Remove ${h.type} ${idx + 1}`}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded text-zinc-500 opacity-60 transition-all hover:bg-red-500/15 hover:text-red-400 hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-red-400"
                  >
                    <svg
                      viewBox="0 0 12 12"
                      className="h-3 w-3"
                      aria-hidden
                      fill="none"
                    >
                      <path
                        d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <footer className="border-t border-zinc-800/80 px-5 py-3 font-mono text-[10px] text-zinc-500">
        Press{' '}
        <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-zinc-300">
          Esc
        </kbd>{' '}
        to deselect · click to focus
      </footer>
    </aside>
  );
}
