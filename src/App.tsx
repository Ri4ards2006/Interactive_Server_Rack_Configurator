import { useEffect } from 'react';
import { Scene } from './components/canvas/Scene';
import { ConfiguratorPanel } from './components/ui/ConfiguratorPanel';
import { useConfiguratorStore } from './store/useConfiguratorStore';

export function App() {
  const selectHardware = useConfiguratorStore((s) => s.selectHardware);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectHardware(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectHardware]);

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
     