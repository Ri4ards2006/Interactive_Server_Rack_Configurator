/**
 * RackFrame.tsx
 *
 * The outer metal frame of the server rack.
 *
 * Dynamic Frame Styling:
 * - '2-post': Renders only two central vertical rails/posts.
 * - '4-post': Renders four corner posts (open frame).
 * - 'cabinet': Renders four corner posts with side panels and a front glass door.
 *
 * Glass Door Animation:
 * - If the cabinet door is open, rotates 90 degrees (Math.PI / 2) pivoted
 *   on the left hinge post using a smooth lerp transition in useFrame.
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

// -- Static geometry constants -----------------------------------------
const FRAME_WIDTH = 0.6;
const FRAME_DEPTH = 0.8;
const POST_SIZE = 0.04;
const BEAM_HEIGHT = 0.04;

const frameMaterial = new THREE.MeshStandardMaterial({
  color: '#151515',
  metalness: 0.7,
  roughness: 0.75,
});

const cabinetWallMaterial = new THREE.MeshStandardMaterial({
  color: '#121212',
  transparent: true,
  opacity: 0.85,
  metalness: 0.6,
  roughness: 0.5,
});

const glassMaterial = new THREE.MeshStandardMaterial({
  color: '#3a3f44',
  transparent: true,
  opacity: 0.35,
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

  // Smooth lerp rotation for the cabinet glass door in R3F loop
  useFrame((state, delta) => {
    if (!doorGroupRef.current) return;
    const targetRot = isDoorOpen ? Math.PI / 2 : 0;
    doorGroupRef.current.rotation.y = THREE.MathUtils.lerp(
      doorGroupRef.current.rotation.y,
      targetRot,
      1 - Math.exp(-8 * delta) // smooth time-independent lerp
    );
  });

  const postX = FRAME_WIDTH / 2 - POST_SIZE / 2;
  const postZ = FRAME_DEPTH / 2 - POST_SIZE / 2;

  // Determine post position coordinates based on rack frame type
  const postPositions: Array<[number, number, number]> = [];
  if (rackType === '2-post') {
    // Only two center-mast posts
    postPositions.push([-postX, 0, 0], [postX, 0, 0]);
  } else {
    // Four corner posts for 4-post and cabinet
    postPositions.push(
      [-postX, 0, -postZ],
      [postX, 0, -postZ],
      [-postX, 0, postZ],
      [postX, 0, postZ]
    );
  }

  return (
    <group position={[0, height / 2, 0]}>
      {/* corner posts */}
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
        // Beams for 2-post: bottom and top heavy support feet
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
              <boxGeometry args={[FRAME_WIDTH, BEAM_HEIGHT, 0.15]} />
            </mesh>
            {isBlueprint && (
              <SchematicBox
                width={FRAME_WIDTH}
                height={BEAM_HEIGHT}
                depth={0.15}
              />
            )}
          </group>
        ))
      ) : (
        // Beams for 4-post and cabinet
        [
          { y: height / 2 - BEAM_HEIGHT / 2, label: 'top' },
          { y: -height / 2 + BEAM_HEIGHT / 2, label: 'bottom' },
        ].flatMap((row) =>
          [-postZ, postZ].map((z) => (
            <group
              key={`beam-4post-${row.label}-${z}`}
              position={[0, row.y, z]}
            >
              <mesh
                castShadow={!isBlueprint}
                receiveShadow={!isBlueprint}
                material={isBlueprint ? blueprintFrameFillMaterial : frameMaterial}
              >
                <boxGeometry args={[FRAME_WIDTH, BEAM_HEIGHT, POST_SIZE]} />
              </mesh>
              {isBlueprint && (
                <SchematicBox
                  width={FRAME_WIDTH}
                  height={BEAM_HEIGHT}
                  depth={POST_SIZE}
                />
              )}
            </group>
          ))
        )
      )}

      {/* Cabinet enclosure walls (Side panels + top cover) */}
      {!isBlueprint && rackType === 'cabinet' && (
        <group>
          {/* Left panel */}
          <mesh position={[-FRAME_WIDTH / 2 + 0.001, 0, 0]}>
            <boxGeometry args={[0.002, height - 0.08, FRAME_DEPTH - 0.04]} />
            <meshStandardMaterial {...cabinetWallMaterial} />
          </mesh>
          {/* Right panel */}
          <mesh position={[FRAME_WIDTH / 2 - 0.001, 0, 0]}>
            <boxGeometry args={[0.002, height - 0.08, FRAME_DEPTH - 0.04]} />
            <meshStandardMaterial {...cabinetWallMaterial} />
          </mesh>
          {/* Top cover roof */}
          <mesh position={[0, height / 2 - 0.001, 0]}>
            <boxGeometry args={[FRAME_WIDTH - 0.01, 0.002, FRAME_DEPTH - 0.01]} />
            <meshStandardMaterial {...cabinetWallMaterial} />
          </mesh>
        </group>
      )}

      {/* Sleek Translucent Glass Door for cabinet */}
      {!isBlueprint && rackType === 'cabinet' && (
        <group
          ref={doorGroupRef}
          position={[-FRAME_WIDTH / 2, 0, FRAME_DEPTH / 2]} // left hinge pivot
        >
          <group position={[FRAME_WIDTH / 2, 0, 0.01]}>
            {/* Outer door frame */}
            <mesh castShadow>
              <boxGeometry args={[FRAME_WIDTH, height - 0.02, 0.015]} />
              <meshStandardMaterial color="#0c0c0e" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Translucent glass pane */}
            <mesh position={[0, 0, 0.001]} material={glassMaterial}>
              <boxGeometry args={[FRAME_WIDTH - 0.06, height - 0.08, 0.005]} />
            </mesh>
            {/* Door latch handle */}
            <mesh position={[FRAME_WIDTH / 2 - 0.03, 0, 0.01]} castShadow>
              <boxGeometry args={[0.015, 0.12, 0.008]} />
              <meshStandardMaterial color="#3f3f46" metalness={0.95} roughness={0.2} />
            </mesh>
          </group>
        </group>
      )}
    </group>
  );
}
