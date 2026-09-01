/**
 * Scene.tsx
 *
 * Top-level Three.js Canvas container for the configurator.
 *
 * System responsibilities:
 * - Scene graph root: lighting, environment, cameras, materials, floor chrome.
 * - Multi-rack baying orchestration (renders multiple side-by-side RackFrames at BAY_SPACING offsets).
 * - Dual-presentation modes:
 *     1. '3D' (default): PBR MeshStandardMaterial, HDR warehouse environment,
 *        soft contact shadows, procedural grid, free orbital camera.
 *     2. 'blueprint': Flat unlit MeshBasicMaterial palette, sharp cyan wireframes,
 *        2D vector grid, locked orthogonal front-facing camera.
 */

import { useRef, useEffect, useMemo, type RefObject } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  ContactShadows,
  Grid,
} from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';

import { RackFrame } from './Rack/RackFrame';
import { RackScrews } from './Rack/RackScrews';
import { RackLabels } from './Rack/RackLabels';
import { HardwareMapper } from './HardwareMapper';
import { CableMapper } from './Hardware/PatchCable';
import { DropIndicator } from './interactions/DropIndicator';
import { ThermalHeatmapOverlay } from './Thermal/ThermalHeatmapOverlay';
import { NetworkTopologyView } from './Topology/NetworkTopologyView';
import { exportSceneToGLTF } from '../../utils/exporters/gltfExporter';
import {
  useConfiguratorStore,
  RACK_UNIT_HEIGHT,
} from '../../store/useConfiguratorStore';
import { useIsBlueprint } from './Hardware/shared';

const BLUEPRINT_CAMERA_Z = 2.2;

interface OrbitControlsHandle {
  target: THREE.Vector3;
  enableRotate: boolean;
  update: () => void;
}

interface SceneContentsProps {
  orbitRef: RefObject<OrbitControlsHandle | null>;
}

export function SceneContents({ orbitRef }: SceneContentsProps) {
  const isBlueprint = useIsBlueprint();
  const viewMode = useConfiguratorStore((s) => s.viewMode);
  const racks = useConfiguratorStore(useShallow((s) => s.racks));
  const activeRackId = useConfiguratorStore((s) => s.activeRackId);
  const { camera, scene } = useThree();

  useEffect(() => {
    const handleExport = (e: Event) => {
      const customEvent = e as CustomEvent<{ filename?: string }>;
      const filename = customEvent.detail?.filename || 'datacenter_layout.glb';
      exportSceneToGLTF(scene, filename);
    };
    window.addEventListener('export-gltf', handleExport);
    return () => window.removeEventListener('export-gltf', handleExport);
  }, [scene]);

  const activeRack = useMemo(
    () => racks.find((r) => r.id === activeRackId) || racks[0],
    [racks, activeRackId],
  );

  const capacity = activeRack.capacity;
  const rackCenterX = activeRack.position[0];

  useEffect(() => {
    const controls = orbitRef.current;
    if (viewMode === 'blueprint') {
      const midY = (capacity * RACK_UNIT_HEIGHT) / 2;
      camera.position.set(rackCenterX, midY, BLUEPRINT_CAMERA_Z);
      if (controls) {
        controls.target.set(rackCenterX, midY, 0);
        controls.enableRotate = false;
        controls.update();
      }
    } else {
      camera.position.set(rackCenterX + 1.5, 1.2, 1.5);
      if (controls) {
        controls.target.set(rackCenterX, 0.8, 0);
        controls.enableRotate = true;
        controls.update();
      }
    }
  }, [viewMode, capacity, rackCenterX, camera, orbitRef]);

  return (
    <>
      <color attach="background" args={['#0a0a0a']} />

      {/* -- Lighting ---------------------------------------------------- */}
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
            shadow-camera-left={-6}
            shadow-camera-right={6}
            shadow-camera-top={4}
            shadow-camera-bottom={-4}
          />
          <Environment preset="warehouse" />
        </>
      )}

      {/* -- Multi-Rack Bayed Enclosures --------------------------------- */}
      {racks.map((rack) => {
        const isActive = rack.id === activeRackId;
        return (
          <group
            key={rack.id}
            position={rack.position}
            onClick={(e) => {
              e.stopPropagation();
              useConfiguratorStore.getState().setActiveRackId(rack.id);
            }}
          >
            {/* Active Bay Floor Highlight in 3D Mode */}
            {!isBlueprint && isActive && racks.length > 1 && (
              <mesh position={[0, -0.0005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.7, 1.1]} />
                <meshBasicMaterial
                  color="#06b6d4"
                  transparent
                  opacity={0.12}
                  depthWrite={false}
                />
              </mesh>
            )}

            <RackFrame
              capacity={rack.capacity}
              rackType={rack.rackType}
              isDoorOpen={rack.isDoorOpen}
            />
            <RackScrews capacity={rack.capacity} />
            <RackLabels capacity={rack.capacity} />
            <HardwareMapper rackId={rack.id} />
          </group>
        );
      })}

      {/* Global Patch Cables spanning any bays */}
      <CableMapper />

      {/* 3D Thermal Heatmap Overlay */}
      <ThermalHeatmapOverlay />

      {/* Ghost preview during drag */}
      <DropIndicator />

      {/* -- Floor chrome ------------------------------------------------ */}
      {!isBlueprint && (
        <>
          <ContactShadows
            position={[0, -0.001, 0]}
            opacity={0.55}
            scale={10}
            blur={2.4}
            far={1}
            resolution={1024}
          />
          <Grid
            position={[0, -0.001, 0]}
            args={[12, 12]}
            cellColor="#27272a"
            sectionColor="#52525b"
            cellSize={0.5}
            sectionSize={1}
            fadeDistance={10}
            fadeStrength={1}
          />
        </>
      )}
    </>
  );
}

export function Scene() {
  const orbitRef = useRef<OrbitControlsHandle | null>(null);
  const viewMode = useConfiguratorStore((s) => s.viewMode);

  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows
        camera={{ position: [1.5, 1.2, 1.5], fov: 50 }}
        gl={{ antialias: true }}
      >
        <SceneContents orbitRef={orbitRef} />
        <OrbitControls
          ref={orbitRef as any}
          makeDefault
          minDistance={0.5}
          maxDistance={10}
          target={[0, 0.8, 0]}
          maxPolarAngle={Math.PI / 2 + 0.05}
        />
      </Canvas>
      {viewMode === 'topology' && <NetworkTopologyView />}
    </div>
  );
}
