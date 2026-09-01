/**
 * CableLayer.tsx
 *
 * Scene-level patch cable manager:
 * - Renders all 3D patch cable meshes across all racks
 * - Renders active in-flight drag preview (`<DraggingCableMesh />`)
 * - Provides pointer capture plane during cable dragging
 * - Listens for global Delete/Backspace key to remove selected cable
 */

import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import * as THREE from 'three';
import { useConfiguratorStore } from '../../../store/useConfiguratorStore';
import { CableMesh } from './CableMesh';
import { DraggingCableMesh } from './DraggingCableMesh';

export function CableLayer() {
  const {
    cables,
    activeDraggingCable,
    updateDraggingCable,
    stopDraggingCable,
    selectedCableId,
    removeCable,
    selectCable,
  } = useConfiguratorStore(
    useShallow((s) => ({
      cables: s.cables,
      activeDraggingCable: s.activeDraggingCable,
      updateDraggingCable: s.updateDraggingCable,
      stopDraggingCable: s.stopDraggingCable,
      selectedCableId: s.selectedCableId,
      removeCable: s.removeCable,
      selectCable: s.selectCable,
    })),
  );

  const isDragging = !!activeDraggingCable;

  // Keyboard shortcut: Delete / Backspace to unpatch selected cable
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedCableId &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        removeCable(selectedCableId);
      } else if (e.key === 'Escape') {
        if (isDragging) {
          stopDraggingCable();
        } else if (selectedCableId) {
          selectCable(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCableId, isDragging, removeCable, selectCable, stopDraggingCable]);

  return (
    <group name="CableLayer">
      {/* Installed Patch Cables */}
      {cables.map((cable) => (
        <CableMesh key={cable.id} cable={cable} />
      ))}

      {/* Dynamic in-flight dragging cable */}
      {activeDraggingCable && <DraggingCableMesh />}

      {/* Invisible pointer capture plane while routing cables */}
      {isDragging && (
        <mesh
          position={[0, 1.0, 0.45]}
          onPointerMove={(e) => {
            e.stopPropagation();
            updateDraggingCable([e.point.x, e.point.y, e.point.z]);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            stopDraggingCable();
          }}
          visible={false}
        >
          <planeGeometry args={[20, 20]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

