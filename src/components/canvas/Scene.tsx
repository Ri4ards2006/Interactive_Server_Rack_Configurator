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
 *     5. `<Grid>` and `<ContactShadows>` are unmounted entirely so
 *        the schematic reads as a clean unlit 2D vector canvas —
 *        no procedural floor grid, no soft contact shadows below
 *        the rack.
 * - Re-entering 3D mode restores the original camera position + the
 *   OrbitControls rotation-enabled state, so the user's previous 3D
 *   orbit is gone (we reset to the default `[1.5, 1.2, 1.5]` view)
 *   but they can orbit again immediately.
 */

import { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
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
import { useIsBlueprint } from './Hardware/shared';

/** Z distance from the rack face in blueprint mode. Far enough that
 *  the full 42U rack fits comfortably in a 50° FOV (about 1.86 m of
 *  visible vertical at z=2.2). */
const BLUEPRINT_CAMERA_Z = 2.2;

// Imperative ref shape consumed by the camera-snap `useEffect`. The
// three-stdlib `OrbitControls` class has many more properties, but
// we only touch these three — so the explicit narrowing reads cleanly
// at the call site (no `any` escape).
type OrbitControlsRef = OrbitControlsImpl | null;

interface SceneContentsProps {
  orbitRef: React.MutableRefObject<OrbitControlsRef>;
}

function SceneContents({ orbitRef }: SceneContentsProps) {
  // Hook into the R3F-managed camera so we can imperatively snap +
  // reset it on `viewMode` changes.
  const { camera } = useThree();
  const viewMode = useConfiguratorStore((s) => s.viewMode);
  const capacity = useConfiguratorStore((s) => s.capacity);
  const isBlueprint = useIsBlueprint();

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

      {/* -- Lighting ----------------------------------------------------
          3D mode only. Hidden in blueprint mode because the
          schematic palette is flat-lit by design — no HDR reflections,
          no ambient/directional falloff. The chassis + racks use
          MeshBasicMaterial in blueprint, so lights have no effect
          anyway, but unmounting them keeps the render tree minimal
          and removes the shadow pass cost.
      ------------------------------------------------------------------- */}
      {!isBlueprint && (
        <>
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
        </>
      )}

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

      {/* -- Floor chrome ------------------------------------------------
          Procedural grid + soft contact shadows are 3D-mode-only.
          The blueprint view reads as a clean unlit 2D vector canvas —
          conditioned out via `!isBlueprint`.
      ------------------------------------------------------------------- */}
      {!isBlueprint && (
        <>
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
        </>
      )}

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
  // Strongly typed against `three-stdlib`'s `OrbitControls` class —
  // the imperative methods we touch (target.set, enableRotate,
  // update) are all checked at the call site. Replaces the prior
  // `any` escape hatch flagged in the post-blueprint review.
  const orbitRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <div className="absolute inset-0 w-full h-full min-h-screen z-0 overflow-hidden">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [1.5, 1.2, 1.5], fov: 45, near: 0.05 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        style={{ width: '100vw', height: '100vh' }}
      >
        <SceneContents orbitRef={orbitRef} />
      </Canvas>
    </div>
  );
}
