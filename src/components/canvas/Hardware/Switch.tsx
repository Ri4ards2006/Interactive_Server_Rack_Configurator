/**
 * Switch.tsx
 *
 * Network switch chassis: dense 2×24 grid of RJ45 ports on the front
 * bezel and a per-port status LED (link/activity) tinted green/amber.
 *
 * Visual signature
 * ----------------
 * Dark chassis + thin cyan accent stripe at the top of the bezel
 * (reads as an enterprise 48-port 1U switch).
 *
 * Implementation
 * --------------
 * - The port grid AND the LEDs both use `<instancedMesh>` so a 48-port
 *   switch costs ~2 draw calls instead of ~96. Per-instance LED color
 *   is set via `setColorAt` using `MeshBasicMaterial` with
 *   `toneMapped: false` — gives "self-illuminated" LEDs without any
 *   lights or emissive-shader gymnastics.
 * - Every material is module-scoped (allocated once at import time).
 *   The instance matrices / colors are seeded in `useLayoutEffect` so
 *   the chassis never renders at the origin frame on mount.
 * - Drag / select / cursor / window-release contract is byte-for-byte
 *   identical to Server.tsx — see that file's long-form JSDoc for the
 *   rationale; the rest of the configurator treats every piece of
 *   equipment the same way.
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

// ---- Geometry constants shared with Server.tsx ------------------------
const CHASSIS_WIDTH = 0.85;
const EDGE_GAP = 0.005;

const PORT_COLS = 24; // columns of RJ45 ports — 24 cols × 2 rows = 48 = classic 1U switch
const PORT_W = 0.014;
const PORT_H = 0.008;
const PORT_GAP_X = 0.012;
const PORT_GAP_Y = 0.008;
const ACCENT_STRIPE_HEIGHT = 0.002;
const ACCENT_STRIPE_WIDTH = 0.5;

// ---- Hoisted materials (allocated once at import time) ---------------
const chassisMaterial = new THREE.MeshStandardMaterial({
  color: '#1a1a1c',
  metalness: 0.7,
  roughness: 0.45,
});

const bezelMaterial = new THREE.MeshStandardMaterial({
  color: '#050505',
  metalness: 0.4,
  roughness: 0.25,
});

const selectionMaterial = new THREE.MeshBasicMaterial({
  color: '#22d3ee', // cyan-400 — matches Server.tsx selection outline
  wireframe: true,
  transparent: true,
  opacity: 0.55,
  depthTest: false, // stay visible behind other hardware
});

const accentMaterial = new THREE.MeshStandardMaterial({
  color: '#22d3ee',
  emissive: '#0e7490',
  emissiveIntensity: 0.8,
  metalness: 0.4,
  roughness: 0.5,
});

const portMaterial = new THREE.MeshStandardMaterial({
  color: '#9ca3af', // zinc-400 — typical RJ45 housing
  metalness: 0.85,
  roughness: 0.3,
});

// MeshBasicMaterial lets `instanceColor` drive each LED's hue directly.
// `toneMapped: false` keeps the saturated LED color from being dimmed by
// the scene's exposure — pure self-illuminated look, no shader needed.
const ledMaterial = new THREE.MeshBasicMaterial({
  toneMapped: false,
  transparent: true,
  opacity: 0.95,
});

// Reused per-instance — `new Color` is cheap but we only need two.
const LED_GREEN = new THREE.Color('#10b981');
const LED_AMBER = new THREE.Color('#f59e0b');

interface SwitchProps {
  hardware: HardwareProps;
}

export function Switch({ hardware }: SwitchProps) {
  const groupRef = useRef<THREE.Group>(null);
  const portRef = useRef<THREE.InstancedMesh>(null);
  const ledRef = useRef<THREE.InstancedMesh>(null);

  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const { gl } = useThree();

  // Tight selector — re-render only on this hardware's own selection flip.
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

  // Belt-and-braces: if the cursor leaves the mesh mid-drag, R3F's
  // onPointerUp stops firing, so we also listen on `window`.
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

  // Tile the port rows vertically to fit whatever rackUnits the user
  // picked; a 1U chassis comfortably fits 2 rows.
  const chassisHeight = hardware.rackUnits * RACK_UNIT_HEIGHT - EDGE_GAP;
  const portRows = Math.max(
    1,
    Math.floor((chassisHeight - ACCENT_STRIPE_HEIGHT - 0.004) / (PORT_H + PORT_GAP_Y)),
  );

  const totalPorts = portRows * PORT_COLS;

  // Total horizontal span of the grid (used to center it on the bezel).
  const totalGridW =
    PORT_COLS * PORT_W + (PORT_COLS - 1) * PORT_GAP_X;
  const totalGridH =
    portRows * PORT_H + (portRows - 1) * PORT_GAP_Y;

  // Origin of the first port (top-left of grid). Centered horizontally,
  // sits in the lower portion of the bezel (top reserved for the accent).
  const startX = -totalGridW / 2 + PORT_W / 2;
  const startY =
    -totalGridH / 2 +
    PORT_H / 2 -
    (ACCENT_STRIPE_HEIGHT / 2) -
    0.001;

  const portDepthOffset = hardware.depth / 2 + 0.002;
  const ledXOffset = PORT_W / 2 + 0.005;

  // -- Seed RJ45 port instances ---------------------------------------
  useLayoutEffect(() => {
    const mesh = portRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let r = 0; r < portRows; r++) {
      for (let c = 0; c < PORT_COLS; c++) {
        dummy.position.set(
          startX + c * (PORT_W + PORT_GAP_X),
          startY + r * (PORT_H + PORT_GAP_Y),
          portDepthOffset,
        );
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
    }
    mesh.count = totalPorts;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [startX, startY, portDepthOffset, totalPorts, portRows, hardware.depth]);

  // -- Seed LED instances (with per-instance colour) -------------------
  // Deterministic per-index: every 5th column is amber (10G uplink
  // convention), the rest are green link-up. This gives a stable,
  // reproducible pattern that visibly differs from the second Switch
  // installed next to it.
  useLayoutEffect(() => {
    const mesh = ledRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let r = 0; r < portRows; r++) {
      for (let c = 0; c < PORT_COLS; c++) {
        dummy.position.set(
          startX + c * (PORT_W + PORT_GAP_X) + ledXOffset,
          startY + r * (PORT_H + PORT_GAP_Y),
          portDepthOffset,
        );
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i++, c % 5 === 0 ? LED_AMBER : LED_GREEN);
      }
    }
    mesh.count = totalPorts;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [startX, startY, portDepthOffset, totalPorts, portRows, hardware.depth]);

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
        position={[0, 0, hardware.depth / 2 + 0.0015]}
        material={bezelMaterial}
      >
        <boxGeometry args={[0.83, chassisHeight, 0.003]} />
      </mesh>

      {/* Cyan accent stripe (brand-style marker) */}
      <mesh
        position={[
          0,
          chassisHeight / 2 - ACCENT_STRIPE_HEIGHT - 0.001,
          hardware.depth / 2 + 0.002,
        ]}
        material={accentMaterial}
      >
        <boxGeometry args={[ACCENT_STRIPE_WIDTH, ACCENT_STRIPE_HEIGHT, 0.001]} />
      </mesh>

      {/* RJ45 ports (instanced — 1 draw call) */}
      <instancedMesh
        ref={portRef}
        args={[undefined, undefined, totalPorts]}
        material={portMaterial}
        castShadow={false}
      >
        <boxGeometry args={[PORT_W, PORT_H, 0.003]} />
      </instancedMesh>

      {/* Per-port status LEDs (instanced, per-instance colour) */}
      <instancedMesh
        ref={ledRef}
        args={[undefined, undefined, totalPorts]}
        material={ledMaterial}
      >
        <boxGeometry args={[0.004, 0.004, 0.001]} />
      </instancedMesh>

      {/* Selection outline (single mesh — selection state only re-renders this switch) */}
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
