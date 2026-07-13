/**
 * HardwareMapper.tsx
 *
 * Dispatches each entry of `installedHardware` to the right 3D
 * component based on its `type`. Lives inside the R3F <Canvas> tree
 * because the dispatch reads from Zustand via `useShallow`.
 *
 * Architectural notes
 * -------------------
 * - Coupled tightly to the `HardwareType` union in
 *   `src/types/rack.types.ts`. Adding a new hardware type requires:
 *     1. Adding the literal to `HardwareType`.
 *     2. Adding a component import + an arm to the switch below.
 *     3. Handling the type in `ConfiguratorPanel.tsx` UI (button list).
 * - Selector uses `useShallow` so re-renders only happen when an item
 *   is added / removed / its data actually changes — NOT on every
 *   store mutation (e.g. selection flip, drag-target mutation).
 */

import { useShallow } from 'zustand/react/shallow';
import { useConfiguratorStore } from '../../store/useConfiguratorStore';
import type { HardwareProps } from '../../types/rack.types';

import { Server } from './Hardware/Server';
import { Switch } from './Hardware/Switch';
import { Router } from './Hardware/Router';
import { PatchPanel } from './Hardware/PatchPanel';
import { UPS } from './Hardware/UPS';
import { KVMConsole } from './Hardware/KVMConsole';
import { JBOD } from './Hardware/JBOD';
import { BlankingPanel } from './Hardware/BlankingPanel';

export function HardwareMapper() {
  const installedHardware = useConfiguratorStore(
    useShallow((s) => s.installedHardware),
  );

  return (
    <>
      {installedHardware.map((h: HardwareProps) => {
        switch (h.type) {
          case 'server':
            return <Server key={h.id} hardware={h} />;
          case 'switch':
            return <Switch key={h.id} hardware={h} />;
          case 'router':
            return <Router key={h.id} hardware={h} />;
          case 'patch-panel':
            return <PatchPanel key={h.id} hardware={h} />;
          case 'ups':
            return <UPS key={h.id} hardware={h} />;
          case 'kvm':
            return <KVMConsole key={h.id} hardware={h} />;
          case 'jbod':
            return <JBOD key={h.id} hardware={h} />;
          case 'blank':
            return <BlankingPanel key={h.id} hardware={h} />;
          default: {
            // Exhaustiveness guard — TS narrows `h.type` to `never` here
            // so adding a new HardwareType without updating this switch
            // becomes a compile error instead of a silent render skip.
            const _exhaustive: never = h.type;
            void _exhaustive;
            return null;
          }
        }
      })}
    </>
  );
}
