/**
 * CableLayer.tsx
 *
 * Scene-level Cable Manager.
 * Orchestrates rendering of all patched cables, active drag preview,
 * and mouse-tracking interaction planes.
 */

import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useConfiguratorStore } from '../../../store/useConfiguratorStore';
import { CableMesh } from './CableMesh';
import { DraggingCableMesh } from './DraggingCableMesh';
import type { Vec3 } from '../../../types/rack.types';

export function CableLayer() {
  const {
    cables,
    activeDraggingCable,
    updateDraggingCable,
    stopDraggingCable,
    selectedCableId,
    removeCable,
  } = useConfiguratorStore(
    useShallow((s) => ({
      cables: s.cables,
      activeDraggingCable: s.activeDraggingCable,
      updateDraggingCable: s.updateDraggingCable,
      stopDraggingCable: s.stopDraggingCable,
      selectedCableId: s.selectedCableId,
      removeCable: s.removeCable,
    })),
  );

  // Keyboard shortcut: Delete/Backspace removes selected cable
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCableId) {
        removeCable(selectedCableId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCableId, removeCable]);

  const isDragging = Boolean(activeDraggingCable);
  const dragZ = activeDraggingCable?.startPortGlobalPos[2] ?? 0.39;

  return (
    <group>
      {/* All Installed Patch Cables */}
      {cables.map((cable) => (
        <CableMesh key={cable.id} cable={cable} />
      ))}

      {/* In-Flight Dragging Cable */}
      {isDragging && <DraggingCableMesh />}

      {/* Full-Rack Pointer Tracking Plane during Active Drag */}
      {isDragging && (
        <mesh
          position={[0, 1.0, dragZ]}
          onPointerMove={(e) => {
            e.stopPropagation();
            updateDraggingCable([e.point.x, e.point.y, e.point.z] as Vec3);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            stopDraggingCable();
          }}
          onPointerCancel={(e) => {
            e.stopPropagation();
            stopDraggingCable();
          }}
        >
          <planeGeometry args={[3, 4]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

// Backward compatibility export
export const CableMapper = CableLayer;
