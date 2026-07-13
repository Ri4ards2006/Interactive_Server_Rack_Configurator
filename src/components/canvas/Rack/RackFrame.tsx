/**
 * RackFrame.tsx
 *
 * The outer metal frame of the server rack.
 *
 * Refined Cabinet Geometry:
 * - Cabinet outer width: exactly 0.6m (600mm).
 * - Cabinet outer depth: exactly 1.0m (1000mm) to prevent chassis clipping.
 * - Internal vertical rails: locked at standard 19-inch width (0.482m center-to-center).
 *   Creates a realistic 6cm gap on each side between rails and cabinet walls.
 * - Front glass door: spans full 0.6m width, pivoting from left hinge (X = -0.3, Z = 0.5).
 */

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useConfiguratorStore, RACK_UNIT_HEIGHT } from '../../../store/useConfiguratorStore';
import {
  SchematicBox,
  blueprintFrameFillMaterial,
  useIsBlueprint,
} from '../Hardware/shared';

// -- Geometry constants -----------------------------------------
const CABINET_WIDTH = 0.6;
const CABINET_DEPTH = 1.0;
const POST_SIZE = 0.04;
const BEAM_HEIGHT = 0.04;

// Standard 19-inch mounting posts (center-to-center distance)
const MOUNT_WIDTH = 0.482; 
const MOUNT_DEPTH = 0.78;  // Spans Z = -0.39 to +0.39

const frameMaterial = new THREE.MeshStandardMaterial({
  color: '#1c1c1e',
  metalness: 0.7,
  roughness: 0.7,
});

const cabinetWallMaterial = new THREE.MeshStandardMaterial({
  color: '#0e0e10',
  transparent: true,
  opacity: 0.9,
  metalness: 0.5,
  roughness: 0.65,
});

const glassMaterial = new THREE.MeshStandardMaterial({
  color: '#2d333b',
  transparent: true,
  opacity: 0.3,
  roughness: 0.1,
  metalness: 0.9,
});

export function RackFrame() {
  const capacity = useConfiguratorStore((s) => s.capacity);
  const rackType = useConfiguratorStore((s) => s.rackType);
  const isDoorOpen = useConfiguratorStore((s) => s.isDoorOpen);
  const isBlueprint = useIsBlueprint();
  
  const height = capacity * RACK_UNIT_HEIGHT;
  const doorGroupRef = useRef<THREE.Group>(null);

  // Smooth pivoting door animation in R3F render loop
  useFrame((state, delta) => {
    if (!doorGroupRef.current) return;
    const targetRot = isDoorOpen ? Math.PI / 2 : 0;
    doorGroupRef.current.rotation.y = THREE.MathUtils.lerp(
      doorGroupRef.current.rotation.y,
      targetRot,
      1 - Math.exp(-8 * delta)
    );
  });

  const postX = MOUNT_WIDTH / 2;
  const postZ = MOUNT_DEPTH / 2;

  // Position vertical mounting posts
  const postPositions: Array<[number, number, number]> = [];
  if (rackType === '2-post') {
    postPositions.push([-postX, 0, 0], [postX, 0, 0]);
  } else {
    // 4-post and cabinet
    postPositions.push(
      [-postX, 0, -postZ],
      [postX, 0, -postZ],
      [-postX, 0, postZ],
      [postX, 0, postZ]
    );
  }

  return (
    <group position={[0, height / 2, 0]}>
      {/* Vertical rails / mounting posts */}
      {postPositions.map((pos, idx) => (
        <group key={`post-${idx}`} position={pos}>
          <mesh
            castShadow={!isBlueprint}
            receiveShadow={!isBlueprint}
            material={isBlueprint ? blueprintFrameFillMaterial : frameMaterial}
          >
            <boxGeometry args={[POST_SIZE, height, POST_SIZE]} />
          </mesh>
          {isBlueprint && (
            <SchematicBox
              width={POST_SIZE}
              height={height}
              depth={POST_SIZE}
            />
          )}
        </group>
      ))}

      {/* Horizontal structural beams */}
      {rackType === '2-post' ? (
        // Bottom and top base plates for 2-post
        [
          { y: height / 2 - BEAM_HEIGHT / 2, label: 'top' },
          { y: -height / 2 + BEAM_HEIGHT / 2, label: 'bottom' },
        ].map((row) => (
          <group key={`beam-2post-${row.label}`} position={[0, row.y, 0]}>
            <mesh
              castShadow={!isBlueprint}
              receiveShadow={!isBlueprint}
              material={isBlueprint ? blueprintFrameFillMaterial : frameMaterial}
            >
              <boxGeometry args={[MOUNT_WIDTH, BEAM_HEIGHT, 0.2]} />
            </mesh>
            {isBlueprint && (
              <SchematicBox
                width={MOUNT_WIDTH}
                height={BEAM_HEIGHT}
                depth={0.2}
              />
            )}
          </group>
        ))
      ) : (
        // Width and depth beams for 4-post and cabinet
        <group>
          {/* Horizontal Width Beams (Parallel to X) */}
          {[
            { y: height / 2 - BEAM_HEIGHT / 2, label: 'top' },
            { y: -height / 2 + BEAM_HEIGHT / 2, label: 'bottom' },
          ].flatMap((row) =>
            [-postZ, postZ].map((z) => (
              <group
                key={`beam-w-${row.label}-${z}`}
                position={[0, row.y, z]}
              >
                <mesh
                  castShadow={!isBlueprint}
                  receiveShadow={!isBlueprint}
                  material={isBlueprint ? blueprintFrameFillMaterial : frameMaterial}
                >
                  <boxGeometry args={[MOUNT_WIDTH, BEAM_HEIGHT, POST_SIZE]} />
                </mesh>
                {isBlueprint && (
                  <SchematicBox
                    width={MOUNT_WIDTH}
                    height={BEAM_HEIGHT}
                    depth={POST_SIZE}
                  />
                )}
              </group>
            ))
          )}

          {/* Horizontal Depth Beams (Parallel to Z) */}
          {[
            { y: height / 2 - BEAM_HEIGHT / 2, label: 'top' },
            { y: -height / 2 + BEAM_HEIGHT / 2, label: 'bottom' },
          ].flatMap((row) =>
            [-postX, postX].map((x) => (
              <group
                key={`beam-d-${row.label}-${x}`}
                position={[x, row.y, 0]}
              >
                <mesh
                  castShadow={!isBlueprint}
                  receiveShadow={!isBlueprint}
                  material={isBlueprint ? blueprintFrameFillMaterial : frameMaterial}
                >
                  <boxGeometry args={[POST_SIZE, BEAM_HEIGHT, MOUNT_DEPTH]} />
                </mesh>
                {isBlueprint && (
                  <SchematicBox
                    width={POST_SIZE}
                    height={BEAM_HEIGHT}
                    depth={MOUNT_DEPTH}
                  />
                )}
              </group>
            ))
          )}
        </group>
      )}

      {/* Cabinet enclosure walls (Side panels, top roof, back plate) */}
      {!isBlueprint && rackType === 'cabinet' && (
        <group>
          {/* Left panel (spaced out to CABINET_WIDTH = 0.6m) */}
          <mesh position={[-CABINET_WIDTH / 2 + 0.001, 0, 0]}>
            <boxGeometry args={[0.002, height, CABINET_DEPTH]} />
            <meshStandardMaterial {...cabinetWallMaterial} />
          </mesh>
          {/* Right panel (spaced out to CABINET_WIDTH = 0.6m) */}
          <mesh position={[CABINET_WIDTH / 2 - 0.001, 0, 0]}>
            <boxGeometry args={[0.002, height, CABINET_DEPTH]} />
            <meshStandardMaterial {...cabinetWallMaterial} />
          </mesh>
          {/* Top cover roof */}
          <mesh position={[0, height / 2 - 0.001, 0]}>
            <boxGeometry args={[CABINET_WIDTH, 0.002, CABINET_DEPTH]} />
            <meshStandardMaterial {...cabinetWallMaterial} />
          </mesh>
          {/* Back enclosure panel */}
          <mesh position={[0, 0, -CABINET_DEPTH / 2 + 0.001]}>
            <boxGeometry args={[CABINET_WIDTH - 0.004, height - 0.02, 0.002]} />
            <meshStandardMaterial color="#0c0c0d" metalness={0.7} roughness={0.6} />
          </mesh>
        </group>
      )}

      {/* Sleek Translucent Glass Door (covers full CABINET_WIDTH = 0.6m) */}
      {!isBlueprint && rackType === 'cabinet' && (
        <group
          ref={doorGroupRef}
          position={[-CABINET_WIDTH / 2, 0, CABINET_DEPTH / 2]} // pivoted on left hinge post
        >
          <group position={[CABINET_WIDTH / 2, 0, 0.008]}>
            {/* Outer door frame */}
            <mesh castShadow>
              <boxGeometry args={[CABINET_WIDTH, height - 0.02, 0.015]} />
              <meshStandardMaterial color="#0c0c0e" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Translucent glass pane */}
            <mesh position={[0, 0, 0.001]} material={glassMaterial}>
              <boxGeometry args={[CABINET_WIDTH - 0.06, height - 0.08, 0.005]} />
            </mesh>
            {/* Latch handle */}
            <mesh position={[CABINET_WIDTH / 2 - 0.025, 0, 0.01]} castShadow>
              <boxGeometry args={[0.012, 0.12, 0.008]} />
              <meshStandardMaterial color="#3f3f46" metalness={0.95} roughness={0.2} />
            </mesh>
          </group>
        </group>
      )}
    </group>
  );
}
