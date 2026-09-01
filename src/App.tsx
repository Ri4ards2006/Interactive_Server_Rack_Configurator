import { useEffect } from 'react';
import { Scene } from './components/canvas/Scene';
import { ConfiguratorPanel } from './components/ui/ConfiguratorPanel';
import { useConfiguratorStore } from './store/useConfiguratorStore';

export function App() {
  const selectHardware = useConfiguratorStore((s) => s.selectHardware);
  const undo = useConfiguratorStore((s) => s.undo);
  const redo = useConfiguratorStore((s) => s.redo);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        selectHardware(null);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectHardware, undo, redo]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-zinc-950 font-sans antialiased text-zinc-100">
      <div className="absolute inset-0 z-0">
        <Scene />
      </div>
      <div className="relative z-10 pointer-events-none h-full w-full">
        <ConfiguratorPanel />
      </div>
    </div>
  );
}
           