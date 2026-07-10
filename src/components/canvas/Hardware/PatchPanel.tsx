/**
 * PatchPanel.tsx
 *
 * Passive punch-down patch panel: a tight, high-density row (or grid)
 * of keystone port housings spanning the front bezel. No LEDs — this
 * is purely passive infrastructure so a connected-but-not-linked panel
 * is still visually distinct from an active switch.
 *
 * Visual signature
 * ----------------
 * No accent stripe, slightly lighter chassis than the others, and a
 * port form factor slightly larger than RJ45 (keystone jacks are a
 * hair wider/taller than standard RJ45 sockets).
 *
 * Implementation
 * --------------
 * - Single `<instancedMesh>` for the entire port grid. Single shared
 *   material; no per-instance colour. This is the cheapest of the
 *   three hardware types — no LEDs at all.
 * - Drag / select / cursor / window-release contract is identical to
 *   Server.tsx / Switch.tsx / Router.tsx.
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

// Keystone jacks are a touch larger than RJ45 sockets.
const PORT_COLS = 24;                         // wide rows of keystone ports
const PORT_W = 0.024;
const PORT_H = 0.014;
const PORT_GAP_X = 0.006;
const PORT_GAP_Y = 0.010;
const PORT_INSET_DEPTH = 0.003;               // how far the jack sits proud of the bezel

// ---- Hoisted materials (allocated once at import time) ---------------
const chassisMaterial = new THREE.MeshStandardMaterial({
  color: '#0f0f10',                          // very dark matte — passive hardware
  metalness: 0.6,
  roughness: 0.55,
});

const bezelMaterial = new THREE.MeshStandardMaterial({
  color: '#050505',
  metalness: 0.4,
  roughness: 0.3,
});

const selectionMaterial = new THREE.MeshBasicMaterial({
  color: '#22d3ee',
  wireframe: true,
  transparent: true,
  opacity: 0.55,
  depthTest: false,
});

// Keystone housing is plastic — light, slightly off-white.
const portMaterial = new THREE.MeshStandardMaterial({
  color: '#e5e7eb',
  metalness: 0.4,
  roughness: 0.55,
});

interface PatchPanelProps {
  hardware: HardwareProps;
}

export function PatchPanel({ hardware }: PatchPanelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const portRef = useRef<THREE.InstancedMesh>(null);

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

  // Tile the keystone rows vertically to fill whatever chassisHeight we have.
  const portRows = Math.max(
    1,
    Math.floor((chassisHeight - 0.006) / (PORT_H + PORT_GAP_Y)),
  );

  const totalPorts = portRows * PORT_COLS;
  const totalGridW = PORT_COLS * PORT_W + (PORT_COLS - 1) * PORT_GAP_X;
  const totalGridH = portRows * PORT_H + (portRows - 1) * PORT_GAP_Y;

  const startX = -totalGridW / 2 + PORT_W / 2;
  const startY = -totalGridH / 2 + PORT_H / 2;

  const portDepthOffset = hardware.depth / 2 + 0.002;

  useLayoutEffect(() => {
    const mesh = portRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let r = 0; r < portRows; r++) {
      for (let c = 0; c < PORT_COLS; c++) {
        dummy.position.set(
          startX + c * (PORT_W + PORT_GAP_X),
          startY - r * (PORT_H + PORT_GAP_Y),
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

      {/* Keystone port grid (instanced — 1 draw call for the entire array) */}
      <instancedMesh
        ref={portRef}
        args={[undefined, undefined, totalPorts]}
        material={portMaterial}
        castShadow={false}
      >
        <boxGeometry args={[PORT_W, PORT_H, PORT_INSET_DEPTH]} />
      </instancedMesh>

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
