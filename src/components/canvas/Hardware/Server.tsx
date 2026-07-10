/**
 * Server.tsx
 *
 * Single server instance: chassis mesh, front bezel, optional selection
 * outline, and drag-to-snap interaction.
 *
 * Interaction contract:
 * - `onPointerDown`: starts a drag, selects this hardware, and captures
 *   the pointer on the *canvas DOM element* (NOT the THREE target) so
 *   subsequent move/up events keep firing even if the cursor leaves
 *   the mesh. The blueprint's `(e.target as Element).setPointerCapture`
 *   is broken because `e.target` here is a THREE Object3D, not a DOM
 *   element — fixed below via `gl.domElement.setPointerCapture`.
 * - `onPointerMove`: snaps the server's vertical position to the nearest
 *   U-tick using RACK_UNIT_HEIGHT. X / Z are preserved.
 * - `onPointerUp`: ends the drag and releases the captured pointer.
 *
 * Performance:
 * - Reads `selectedHardwareId === id` via a tight selector, so this
 *   component ONLY re-renders when its own selection state changes
 *   (not on every store mutation).
 * - Drag state is kept local — never round-trips through Zustand.
 *
 * Convention: `hardware.position[1]` = server's vertical CENTER in
 * rack-local coordinates (y=0 is the floor). This matches the store's
 * `addHardware` default of `position: [0, rackUnits * RACK_UNIT_HEIGHT / 2, 0]`.
 */

import { useEffect, useRef, useState } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { useConfiguratorStore, RACK_UNIT_HEIGHT } from '../../../store/useConfiguratorStore';
import type { HardwareProps } from '../../../types/rack.types';
import { useDragStore } from '../../../store/useDragStore';

// -- Hoisted PBR materials ---------------------------------------------
// Module-scoped so they're allocated once and shared across every server.
const chassisMaterial = new THREE.MeshStandardMaterial({
  color: '#2b2b2b',
  metalness: 0.85,
  roughness: 0.4,
});

const bezelMaterial = new THREE.MeshStandardMaterial({
  color: '#050505',
  metalness: 0.5,
  roughness: 0.2,
});

const selectionMaterial = new THREE.MeshBasicMaterial({
  color: '#22d3ee', // cyan-400
  wireframe: true,
  transparent: true,
  opacity: 0.55,
  depthTest: false, // always visible, even when behind other meshes
});

// Small inset so chassis edges read as physical bezel chamfers.
const EDGE_GAP = 0.005;

interface ServerProps {
  hardware: HardwareProps;
}

export function Server({ hardware }: ServerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const { gl } = useThree();

  // Tight selector: re-render ONLY when this specific server's selection
  // state changes. Other servers' selection changes are invisible to us.
  const isSelected = useConfiguratorStore(
    (s) => s.selectedHardwareId === hardware.id,
  );
  const selectHardware = useConfiguratorStore((s) => s.selectHardware);
  const updateHardwarePosition = useConfiguratorStore(
    (s) => s.updateHardwarePosition,
  );

  // Cursor feedback: 'grab' on hover, 'grabbing' mid-drag.
  // drei's useCursor auto-resolves the R3F canvas DOM element from
  // context, so the third arg is not needed (and on this drei version
  // it's typed as `string`, which mismatches HTMLCanvasElement).
  const cursorStyle = isDragging
    ? 'grabbing'
    : isHovered
      ? 'grab'
      : 'auto';
  useCursor(isHovered || isDragging, cursorStyle);

  // Belt-and-braces drag release: if the cursor leaves the server mesh
  // mid-drag, R3F's onPointerUp no longer fires (raycaster misses), so
  // isDragging would stay stuck at `true`. We also listen on `window`
  // for any `pointerup`/`pointercancel` to force the release.
  useEffect(() => {
    if (!isDragging) return;
    // End BOTH the local drag state AND the transient drag store so
    // the DropIndicator doesn't get stuck visible if the user releases
    // the pointer outside the server's mesh.
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
    // Publish the drag snapshot to the transient store so scene-level
    // helpers (DropIndicator) can render a ghost without coupling to
    // this component's local `isDragging` state.
    useDragStore.getState().beginDrag({
      id: hardware.id,
      rackUnits: hardware.rackUnits,
      depth: hardware.depth,
    });
    // Capture the pointer on the canvas DOM element so drag motion
    // continues to fire even if the cursor leaves the server's mesh.
    gl.domElement.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging) return;
    e.stopPropagation();
    // Snap the intersection Y to the nearest U-tick.
    const snappedY =
      Math.round(e.point.y / RACK_UNIT_HEIGHT) * RACK_UNIT_HEIGHT;
    updateHardwarePosition(hardware.id, [
      hardware.position[0],
      snappedY,
      hardware.position[2],
    ]);
    // Mirror the snap target into the transient drag store so the
    // DropIndicator can preview where the chassis will land.
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

  // The chassis height is `(U × rackUnits) - gap` so adjacent units have
  // a tiny visible seam.
  const chassisHeight = hardware.rackUnits * RACK_UNIT_HEIGHT - EDGE_GAP;

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
        <boxGeometry
          args={[0.85, chassisHeight, hardware.depth]}
        />
      </mesh>

      {/* Front bezel — slightly inset, very dark */}
      <mesh
        position={[0, 0, hardware.depth / 2 + 0.001]}
        material={bezelMaterial}
      >
        <boxGeometry
          args={[0.83, chassisHeight, 0.002]}
        />
      </mesh>

      {/* Selection outline (drawn last so depth-test off keeps it on top) */}
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
