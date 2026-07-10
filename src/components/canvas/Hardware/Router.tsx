/**
 * Router.tsx
 *
 * Network router chassis: dual PSU bays on the left third of the
 * front bezel, a centre vent grille, and high-density SFP+ cages on
 * the right two-thirds. A few status LEDs sit above the SFP cages
 * (system / fan / alarm).
 *
 * Visual signature
 * ----------------
 * - Amber accent stripe at the top (heavier industrial look than the
 *   switch's cyan).
 * - Two clearly-defined PSU outline rectangles on the left.
 * - SFP+ cages are smaller than RJ45 ports and silver-coloured, with
 *   a few amber/red system LEDs floating above the array.
 *
 * Implementation
 * --------------
 * - PSU outlines + accent stripe are individual meshes (only a handful,
 *   no instancing needed).
 * - Vent bars + SFP cages + LEDs use `<instancedMesh>` for cheap
 *   batching. Vent bars share a single material (uniform black); SFP
 *   cages share a single material (silver); status LEDs use
 *   `instanceColor` for per-instance hue via `MeshBasicMaterial`
 *   (`toneMapped: false` so they read as self-illuminated).
 * - Drag / select / cursor / window-release contract matches
 *   Server.tsx and Switch.tsx byte-for-byte.
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import {
  useConfiguratorStore,
  RACK_UNIT_HEIGHT,
} from '../../../store/useConfiguratorStore';
import type { HardwareProps } from '../../../types/rack.types';
import { useDragStore } from '../../../store/useDragStore';

// ---- Geometry constants ----------------------------------------------
const CHASSIS_WIDTH = 0.85;
const EDGE_GAP = 0.005;

const ACCENT_STRIPE_WIDTH = 0.5;
const ACCENT_STRIPE_HEIGHT = 0.002;

// PSU outline dimensions (outer rectangles).
const PSU_WIDTH = 0.16;
const PSU_GAP_X = 0.04; // gap between the two PSUs
const PSU_TOP_MARGIN = 0.012;

// Vent grille: thin vertical bars between the PSUs and the SFP area.
const VENT_BAR_WIDTH = 0.005;
const VENT_BAR_COUNT = 8;
const VENT_BAR_GAP = 0.003;
const VENT_SECTION_WIDTH =
  VENT_BAR_COUNT * VENT_BAR_WIDTH +
  (VENT_BAR_COUNT - 1) * VENT_BAR_GAP;

// SFP+ cages: smaller pitch and higher column count than RJ45 so the
// right side reads as a true high-density cage array (16 columns ×
// multiple rows depending on chassis height, not a sparse 1-row layout).
const SFP_COLS = 16;
const SFP_W = 0.010;
const SFP_H = 0.010;
const SFP_GAP_X = 0.008;
const SFP_GAP_Y = 0.008;

// Status LEDs row above the SFP array.
const STATUS_LED_COUNT = 4;

// ---- Hoisted materials (allocated once) -----------------------------
const chassisMaterial = new THREE.MeshStandardMaterial({
  color: '#1c1c1f',
  metalness: 0.75,
  roughness: 0.4,
});

const bezelMaterial = new THREE.MeshStandardMaterial({
  color: '#050505',
  metalness: 0.4,
  roughness: 0.25,
});

const selectionMaterial = new THREE.MeshBasicMaterial({
  color: '#22d3ee',
  wireframe: true,
  transparent: true,
  opacity: 0.55,
  depthTest: false,
});

const accentMaterial = new THREE.MeshStandardMaterial({
  color: '#f59e0b', // amber-500
  emissive: '#b45309',
  emissiveIntensity: 0.7,
  metalness: 0.4,
  roughness: 0.5,
});

const psuMaterial = new THREE.MeshStandardMaterial({
  color: '#374151', // gray-700 housing
  metalness: 0.6,
  roughness: 0.45,
});

const ventMaterial = new THREE.MeshStandardMaterial({
  color: '#111827', // near-black to look recessed
  metalness: 0.7,
  roughness: 0.6,
});

const sfpMaterial = new THREE.MeshStandardMaterial({
  color: '#cbd5e1', // silver cage
  metalness: 0.9,
  roughness: 0.2,
});

const ledMaterial = new THREE.MeshBasicMaterial({
  toneMapped: false,
  transparent: true,
  opacity: 0.95,
});

// Two reusable colour instances for per-instance LED tints.
const LED_GREEN = new THREE.Color('#10b981');
const LED_RED = new THREE.Color('#ef4444');

interface RouterProps {
  hardware: HardwareProps;
}

export function Router({ hardware }: RouterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ventRef = useRef<THREE.InstancedMesh>(null);
  const sfpRef = useRef<THREE.InstancedMesh>(null);
  const ledRef = useRef<THREE.InstancedMesh>(null);

  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const { gl } = useThree();

  const isSelected = useConfiguratorStore(
    (s) => s.selectedHardwareId === hardware.id,
  );
  const selectHardware = useConfiguratorStore((s) => s.selectHardware);
  const updateHardwarePosition = useConfiguratorStore(
    (s) => s.updateHardwarePosition,
  );

  const cursorStyle = isDragging
    ? 'grabbing'
    : isHovered
      ? 'grab'
      : 'auto';
  useCursor(isHovered || isDragging, cursorStyle);

  useEffect(() => {
    if (!isDragging) return;
    const endDrag = () => {
      setIsDragging(false);
      useDragStore.getState().endDrag();
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    window.addEventListener('blur', endDrag);
    return () => {
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      window.removeEventListener('blur', endDrag);
    };
  }, [isDragging]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    selectHardware(hardware.id);
    setIsDragging(true);
    useDragStore.getState().beginDrag({
      id: hardware.id,
      rackUnits: hardware.rackUnits,
      depth: hardware.depth,
    });
    gl.domElement.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging) return;
    e.stopPropagation();
    const snappedY =
      Math.round(e.point.y / RACK_UNIT_HEIGHT) * RACK_UNIT_HEIGHT;
    updateHardwarePosition(hardware.id, [
      hardware.position[0],
      snappedY,
      hardware.position[2],
    ]);
    useDragStore.getState().updateDropPosition([
      hardware.position[0],
      snappedY,
      hardware.position[2],
    ]);
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setIsDragging(false);
    useDragStore.getState().endDrag();
    if (gl.domElement.hasPointerCapture(e.pointerId)) {
      gl.domElement.releasePointerCapture(e.pointerId);
    }
  };

  const chassisHeight = hardware.rackUnits * RACK_UNIT_HEIGHT - EDGE_GAP;

  // PSU area sits in the left ~third of the bezel.
  const psuAreaLeftX = -CHASSIS_WIDTH / 2 + 0.03;
  const psu1X = psuAreaLeftX + PSU_WIDTH / 2;
  const psu2X = psu1X + PSU_WIDTH / 2 + PSU_GAP_X + PSU_WIDTH / 2;

  // Vent grille sits to the right of the PSU pair.
  const ventSectionLeftEdge = psu2X + PSU_WIDTH / 2 + 0.04;
  const ventSectionLeftX = ventSectionLeftEdge + VENT_SECTION_WIDTH / 2;

  // SFP+ array occupies the right ~half of the bezel.
  const sfpRows = Math.max(
    1,
    Math.floor(
      (chassisHeight - ACCENT_STRIPE_HEIGHT - 0.020) /
        (SFP_H + SFP_GAP_Y),
    ),
  );
  const totalSfpGridW =
    SFP_COLS * SFP_W + (SFP_COLS - 1) * SFP_GAP_X;
  const totalSfpGridH =
    sfpRows * SFP_H + (sfpRows - 1) * SFP_GAP_Y;
  const sfpStartX =
    CHASSIS_WIDTH / 2 - 0.03 - totalSfpGridW + SFP_W / 2;
  // Sink SFP down so the status LEDs (above) have room.
  const sfpStartY =
    -chassisHeight / 2 +
    totalSfpGridH / 2 +
    0.012;

  const bezelDepthOffset = hardware.depth / 2 + 0.0015;
  const portDepthOffset = hardware.depth / 2 + 0.003;

  const totalSfps = sfpRows * SFP_COLS;

  // -- Vent grille bars ------------------------------------------------
  useLayoutEffect(() => {
    const mesh = ventRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const ventStartX =
      ventSectionLeftX - VENT_SECTION_WIDTH / 2 + VENT_BAR_WIDTH / 2;
    for (let i = 0; i < VENT_BAR_COUNT; i++) {
      dummy.position.set(
        ventStartX + i * (VENT_BAR_WIDTH + VENT_BAR_GAP),
        0,
        portDepthOffset,
      );
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.count = VENT_BAR_COUNT;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ventSectionLeftX, portDepthOffset, hardware.depth]);

  // -- SFP+ cages ------------------------------------------------------
  useLayoutEffect(() => {
    const mesh = sfpRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let r = 0; r < sfpRows; r++) {
      for (let c = 0; c < SFP_COLS; c++) {
        dummy.position.set(
          sfpStartX + c * (SFP_W + SFP_GAP_X),
          sfpStartY + r * (SFP_H + SFP_GAP_Y),
          portDepthOffset,
        );
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
    }
    mesh.count = totalSfps;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [sfpStartX, sfpStartY, portDepthOffset, totalSfps, sfpRows, hardware.depth]);

  // -- Status LEDs (per-instance hue via instanceColor) ----------------
  useLayoutEffect(() => {
    const mesh = ledRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const ledsStartX =
      sfpStartX + SFP_W / 2 - 0.005;
    const ledY = sfpStartY + totalSfpGridH / 2 + 0.006;
    for (let i = 0; i < STATUS_LED_COUNT; i++) {
      dummy.position.set(
        ledsStartX + i * 0.018,
        ledY,
        portDepthOffset,
      );
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      // Index 2 is "alarm" — red; the other three are status / fan /
      // activity — green.
      mesh.setColorAt(i, i === 2 ? LED_RED : LED_GREEN);
    }
    mesh.count = STATUS_LED_COUNT;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [sfpStartX, sfpStartY, portDepthOffset, hardware.depth]);

  // PSU rectangles are sized to chassis height minus a top + bottom margin.
  const psuHeight = chassisHeight - 2 * PSU_TOP_MARGIN;
  const psuY = 0;

  return (
    <group
      ref={groupRef}
      position={hardware.position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setIsHovered(true);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setIsHovered(false);
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Main chassis */}
      <mesh castShadow receiveShadow material={chassisMaterial}>
        <boxGeometry args={[CHASSIS_WIDTH, chassisHeight, hardware.depth]} />
      </mesh>

      {/* Front bezel — slightly inset, very dark */}
      <mesh
        position={[0, 0, bezelDepthOffset]}
        material={bezelMaterial}
      >
        <boxGeometry args={[0.83, chassisHeight, 0.003]} />
      </mesh>

      {/* Amber accent stripe (heavier industrial look) */}
      <mesh
        position={[
          0,
          chassisHeight / 2 - ACCENT_STRIPE_HEIGHT - 0.001,
          bezelDepthOffset + 0.0005,
        ]}
        material={accentMaterial}
      >
        <boxGeometry args={[ACCENT_STRIPE_WIDTH, ACCENT_STRIPE_HEIGHT, 0.001]} />
      </mesh>

      {/* Dual PSU outline rectangles */}
      <mesh
        position={[psu1X, psuY, bezelDepthOffset + 0.0005]}
        material={psuMaterial}
      >
        <boxGeometry args={[PSU_WIDTH, psuHeight, 0.004]} />
      </mesh>
      <mesh
        position={[psu2X, psuY, bezelDepthOffset + 0.0005]}
        material={psuMaterial}
      >
        <boxGeometry args={[PSU_WIDTH, psuHeight, 0.004]} />
      </mesh>

      {/* Vent grille (instanced bars) */}
      <instancedMesh
        ref={ventRef}
        args={[undefined, undefined, VENT_BAR_COUNT]}
        material={ventMaterial}
      >
        <boxGeometry args={[VENT_BAR_WIDTH, psuHeight, 0.003]} />
      </instancedMesh>

      {/* SFP+ cages (instanced) */}
      <instancedMesh
        ref={sfpRef}
        args={[undefined, undefined, totalSfps]}
        material={sfpMaterial}
      >
        <boxGeometry args={[SFP_W, SFP_H, 0.003]} />
      </instancedMesh>

      {/* Status LEDs (instanced, per-instance colour) */}
      <instancedMesh
        ref={ledRef}
        args={[undefined, undefined, STATUS_LED_COUNT]}
        material={ledMaterial}
      >
        <boxGeometry args={[0.005, 0.005, 0.001]} />
      </instancedMesh>

      {/* PSU label slits — two thin dark cuts to read as PSU identity */}
      <mesh
        position={[psu1X, psuY + psuHeight / 2 - 0.01, bezelDepthOffset + 0.001]}
        material={bezelMaterial}
      >
        <boxGeometry args={[PSU_WIDTH * 0.6, 0.002, 0.001]} />
      </mesh>
      <mesh
        position={[psu2X, psuY + psuHeight / 2 - 0.01, bezelDepthOffset + 0.001]}
        material={bezelMaterial}
      >
        <boxGeometry args={[PSU_WIDTH * 0.6, 0.002, 0.001]} />
      </mesh>

      {/* Selection outline */}
      {isSelected && (
        <mesh
          position={[0, 0, 0]}
          material={selectionMaterial}
          renderOrder={999}
        >
          <boxGeometry
            args={[
              0.88,
              hardware.rackUnits * RACK_UNIT_HEIGHT + 0.01,
              hardware.depth + 0.01,
            ]}
          />
        </mesh>
      )}
    </group>
  );
}
