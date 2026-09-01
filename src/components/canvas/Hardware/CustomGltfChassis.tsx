/**
 * CustomGltfChassis.tsx
 *
 * 3D component that dynamically loads and displays user-supplied .glb / .gltf vendor assets.
 * Automatically computes bounding-box dimensions (THREE.Box3) to normalize width, height, and depth.
 */

import { useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  RACK_UNIT_HEIGHT,
  CHASSIS_WIDTH,
  EDGE_GAP,
} from '../../../store/useConfiguratorStore';
import type { HardwareProps } from '../../../types/rack.types';
import { useIsBlueprint } from './shared';

export interface CustomGltfChassisProps {
  hardware: HardwareProps;
  isSelected?: boolean;
}

export function CustomGltfChassis({ hardware, isSelected = false }: CustomGltfChassisProps) {
  const isBlueprint = useIsBlueprint();
  const [modelScene, setModelScene] = useState<THREE.Group | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const targetHeight = hardware.rackUnits * RACK_UNIT_HEIGHT - EDGE_GAP;
  const targetDepth = hardware.depth || 0.6;

  useEffect(() => {
    if (!hardware.customModelUrl) return;

    let isMounted = true;
    const loader = new GLTFLoader();

    loader.load(
      hardware.customModelUrl,
      (gltf) => {
        if (!isMounted) return;

        const scene = gltf.scene;

        // Compute original bounding box
        const bbox = new THREE.Box3().setFromObject(scene);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const center = new THREE.Vector3();
        bbox.getCenter(center);

        // Normalize model geometry: center at origin
        scene.position.x -= center.x;
        scene.position.y -= center.y;
        scene.position.z -= center.z;

        // Auto-scale to fit 19" rack width (0.45m) and target height
        const scaleX = size.x > 0 ? CHASSIS_WIDTH / size.x : 1;
        const scaleY = size.y > 0 ? targetHeight / size.y : 1;
        const scaleZ = size.z > 0 ? targetDepth / size.z : 1;

        // Apply scale
        const wrapperGroup = new THREE.Group();
        scene.scale.set(scaleX, scaleY, scaleZ);
        wrapperGroup.add(scene);

        setModelScene(wrapperGroup);
      },
      undefined,
      (err) => {
        if (!isMounted) return;
        console.error('Failed to load custom GLTF chassis model:', err);
        setLoadError('Failed to load custom 3D model');
      },
    );

    return () => {
      isMounted = false;
    };
  }, [hardware.customModelUrl, targetHeight, targetDepth]);

  // Fallback procedural chassis mesh if GLTF is loading or has error
  const fallbackMesh = useMemo(() => {
    return (
      <mesh position={[0, 0, 0.39 - targetDepth / 2]}>
        <boxGeometry args={[CHASSIS_WIDTH, targetHeight, targetDepth]} />
        <meshStandardMaterial
          color={isSelected ? '#0284c7' : '#1e293b'}
          metalness={0.8}
          roughness={0.3}
          wireframe={isBlueprint}
        />
      </mesh>
    );
  }, [isSelected, targetDepth, targetHeight, isBlueprint]);

  return (
    <group position={hardware.position}>
      {modelScene ? (
        <group position={[0, 0, 0.39 - targetDepth / 2]}>
          <primitive object={modelScene} />
          {/* Selection Wireframe Outline */}
          {isSelected && (
            <mesh>
              <boxGeometry args={[CHASSIS_WIDTH + 0.01, targetHeight + 0.005, targetDepth + 0.01]} />
              <meshBasicMaterial color="#38bdf8" wireframe />
            </mesh>
          )}
        </group>
      ) : (
        fallbackMesh
      )}
    </group>
  );
}

