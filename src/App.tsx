/**
 * App.tsx
 *
 * Root component for the Interactive Server Rack Configurator.
 *
 * Layout:
 *  - The R3F <Scene> fills the viewport via absolute positioning.
 *  - The HTML <ConfiguratorPanel> overlays on top.
 *  - Escape clears the active hardware selection.
 *
 * Typography:
 *  - font-sans (Inter / system) for headings & body
 *  - font-mono  (system mono)   for technical readouts
 *  Tailwind defaults cover both. If you want Inter, add
 *      <link rel="stylesheet" href="...fonts.googleapis.com/css2?family=Inter">
 *  to index.html and extend `fontFamily.sans` in tailwind.config.
 */

import { useEffect } from 'react';
import { ConfiguratorPanel } from './components/ui/ConfiguratorPanel';
import { Scene } from './components/canvas/Scene';
import { useConfiguratorStore } from './store/useConfiguratorStore';

export function App() {
  // Escape clears the active selection.
  // `selectHardware` is a stable reference returned by Zustand, so the
  // effect runs once on mount and cleans up on unmount.
  const selectHardware = useConfiguratorStore((s) => s.selectHardware);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        selectHardware(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectHardware]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-zinc-950 font-sans text-zinc-100 antialiased">
      {/* The R3F Canvas — fills the entire viewport behind the overlay. */}
      <div className="absolute inset-0">
        <Scene />
      </div>

      {/* HTML overlay — sits above the canvas via z-index + absolute pos. */}
      <ConfiguratorPanel />
    </div>
  );
}
