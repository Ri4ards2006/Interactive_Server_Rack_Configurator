/**
 * Scene.tsx
 *
 * Root of the R3F tree. Composes the lighting, environment, rack,
 * hardware, and orbit controls inside a single <Canvas>.
 *
 * Architectural notes:
 * - `HardwareMapper` lives INSIDE the Canvas tree because it uses R3F's
 *   store. Reading `installedHardware` via `useShallow` ensures the
 *   mapper only re-renders when an item is added / removed / its data
 *   actually changes, not on every store mutation.
 * - Only `server` is fully implemented for now. Other HardwareTypes
 *   (`switch`, `router`, `patch-panel`) return `null`. Adding them is
 *   a single switch arm each.
 * - Lights + Environment + ContactShadows give us cheap-but-convincing
 *   PBR: warehouse HDR supplies reflections on the brushed-metal chassis.
 */

import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  ContactShadows,
  Grid,
} from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';

import { useConfiguratorStore } from '../../store/useConfiguratorStore';
import type { HardwareProps } from '../../types/rack.types';

import { RackFrame } from './Rack/RackFrame';
import { RackScrews } from './Rack/RackScrews';
import { Server } from './Hardware/Server';

/**
 * HardwareMapper
 *
 * Reads the installed-hardware array and dispatches each item to the
 * appropriate 3D component. Selector uses `useShallow` so re-renders
 * only happen when array contents actually change.
 */
function HardwareMapper() {
  const installedHardware = useConfiguratorStore(
    useShallow((s) => s.installedHardware),
  );

  return (
    <>
      {installedHardware.map((h: HardwareProps) => {
        switch (h.type) {
          case 'server':
            return <Server key={h.id} hardware={h} />;
          // TODO: implement Switch, Router, PatchPanel components.
          default:
            return null;
        }
      })}
    </>
  );
}

export function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [1.5, 1.2, 1.5], fov: 50, near: 0.05 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      {/* Dark scene background so the rack reads against it. */}
      <color attach="background" args={['#0a0a0a']} />

      {/* -- Lighting ----------------------------------------------------*/}
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[2.5, 4, 3]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-camera-near={0.1}
        shadow-camera-far={20}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />
      {/* Warehouse HDR — provides reflections on PBR metals. */}
      <Environment preset="warehouse" />

      {/* -- Scene contents ----------------------------------------------*/}
      <RackFrame />
      <RackScrews />
      <HardwareMapper />

      {/* -- Helpers -----------------------------------------------------*/}
      <ContactShadows
        position={[0, -0.001, 0]}
        opacity={0.55}
        scale={3}
        blur={2.4}
        far={1}
        resolution={1024}
      />
      <Grid
        position={[0, -0.001, 0]}
        args={[6, 6]}
        cellColor="#27272a"
        sectionColor="#52525b"
        cellSize={0.5}
        cellThickness={0.5}
        sectionSize={1}
        sectionThickness={1}
        fadeDistance={6}
        fadeStrength={1}
        infiniteGrid
      />

      {/* -- Controls ----------------------------------------------------*/}
      <OrbitControls
        makeDefault
        target={[0, 0.8, 0]}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={0.6}
        maxDistance={6}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}
