/**
 * Scene.tsx
 *
 * Root of the R3F tree. Composes the lighting, environment, rack,
 * hardware, and orbit controls inside a single <Canvas>.
 *
 * Architectural notes:
 * - `HardwareMapper` reads `installedHardware` via `useShallow` so it
 *   only re-renders when an item is added / removed / its data
 *   actually changes, not on every store mutation.
 * - All four HardwareTypes are dispatched by `HardwareMapper`:
 *   server, switch, router, patch-panel.
 * - Lights + Environment + ContactShadows give us cheap-but-convincing
 *   PBR: warehouse HDR supplies reflections on the brushed-metal chassis.
 *
 * Blueprint mode (added):
 * - `viewMode === 'blueprint'` from `useConfiguratorStore` triggers:
 *     1. Camera snap to `[0, capacity*U/2, 2.2]` looking at the rack
 *        centre (z-aligned, perpendicular to the rack face).
 *     2. OrbitControls `enableRotate = false` — pan + zoom preserved.
 *     3. Each hardware / rack component renders in flat-shaded
 *        materials with cyan wireframe edges (see `Hardware/shared.tsx`
 *        + each chassis component).
 *     4. `<RackLabels>` renders U1..U42 markers along both rails
 *        (it self-hides in 3D mode via `useIsBlueprint`).
 * - Re-entering 3D mode restores the original camera position + the
 *   OrbitControls rotation-enabled state, so the user's previous 3D
 *   orbit is gone (we reset to the default `[1.5, 1.2, 1.5]` view)
 *   but they can orbit again immediately.
 */

import { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  ContactShadows,
  Grid,
} from '@react-three/drei';

import { RackFrame } from './Rack/RackFrame';
import { RackScrews } from './Rack/RackScrews';
import { RackLabels } from './Rack/RackLabels';
import { HardwareMapper } from './HardwareMapper';
import { DropIndicator } from './interactions/DropIndicator';
import {
  useConfiguratorStore,
  RACK_UNIT_HEIGHT,
} from '../../store/useConfiguratorStore';

/** Z distance from the rack face in blueprint mode. Far enough that
 *  the full 42U rack fits comfortably in a 50° FOV (about 1.86 m of
 *  visible vertical at z=2.2). */
const BLUEPRINT_CAMERA_Z = 2.2;

// Imported and used purely so we can pass `camera` to the
// view-mode useEffect without dragging a separate <PerspectiveCamera>
// element into the tree (the <Canvas camera={...}> already provides
// one). The hook is invoked inside a child <SceneContents> component
// because `useThree` only works inside the R3F canvas tree — calling
// it in `Scene` itself would error with "R3F context not found".
interface SceneContentsProps {
  orbitRef: React.MutableRefObject<any>;
}

function SceneContents({ orbitRef }: SceneContentsProps) {
  // Hook into the R3F-managed camera so we can imperatively snap +
  // reset it on `viewMode` changes.
  const { camera } = useThree();
  const viewMode = useConfiguratorStore((s) => s.viewMode);
  const capacity = useConfiguratorStore((s) => s.capacity);

  useEffect(() => {
    const controls = orbitRef.current;
    if (viewMode === 'blueprint') {
      const midY = (capacity * RACK_UNIT_HEIGHT) / 2;
      // Camera looks straight along the -z axis at the rack centre.
      camera.position.set(0, midY, BLUEPRINT_CAMERA_Z);
      if (controls) {
        controls.target.set(0, midY, 0);
        controls.enableRotate = false;
        controls.update();
      }
    } else {
      // Restore the default 3D-mode orbit position. The previous
      // user-set orbit is overwritten — acceptable because blueprint
      // mode is a "framing tool" not a "scratch state".
      camera.position.set(1.5, 1.2, 1.5);
      if (controls) {
        controls.target.set(0, 0.8, 0);
        controls.enableRotate = true;
        controls.update();
      }
    }
  }, [viewMode, capacity, camera, orbitRef]);

  return (
    <>
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
      <Environment preset="warehouse" />

      {/* -- Scene contents ----------------------------------------------*/}
      <RackFrame />
      <RackScrews />
      {/* RackLabels renders nothing in 3D mode — useIsBlueprint gate
          inside the component returns null until blueprint mode. */}
      <RackLabels />
      <HardwareMapper />
      {/* Ghost preview rendered only while a drag is in progress.
          DropIndicator's valid/invalid colour swap is intact in both
          viewModes — the only thing that changes is whether the
          chassis it overlays is PBR or schematic. */}
      <DropIndicator />

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
        ref={orbitRef}
        makeDefault
        target={[0, 0.8, 0]}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={0.6}
        maxDistance={6}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}

export function Scene() {
  // `any` because drei's OrbitControls ref type is `OrbitControlsImpl`
  // from three-stdlib, which isn't in scope here. The shape is well
  // understood at the call sites (`target.set`, `enableRotate`,
  // `update`) so a typed alias would be cosmetic-only.
  const orbitRef = useRef<any>(null);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [1.5, 1.2, 1.5], fov: 50, near: 0.05 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <SceneContents orbitRef={orbitRef} />
    </Canvas>
  );
}
