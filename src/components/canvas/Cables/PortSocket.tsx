/**
 * PortSocket.tsx
 *
 * Interactive port socket collider and snap target.
 * Renders on hardware faceplates and handles patch routing interactions.
 */

import { useState, useMemo } from 'react';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { useConfiguratorStore } from '../../../store/useConfiguratorStore';
import { isPortConnectionValid } from '../../../utils/cableGeometry';

export interface PortSocketProps {
  deviceId: string;
  portId: string;
  relativePos: [number, number, number];
  devicePosition: [number, number, number];
  cableId: string | null;
  label: string;
}

export function PortSocket({
  deviceId,
  portId,
  relativePos,
  devicePosition,
  cableId,
  label,
}: PortSocketProps) {
  const [hovered, setHovered] = useState(false);
  const installedHardware = useConfiguratorStore(
    useShallow((s) => s.installedHardware),
  );

  const {
    startDraggingCable,
    unpatchPort,
    activeDraggingCable,
    activeCableColor,
    activeCableType,
    addCable,
    stopDraggingCable,
  } = useConfiguratorStore(
    useShallow((s) => ({
      startDraggingCable: s.startDraggingCable,
      unpatchPort: s.unpatchPort,
      activeDraggingCable: s.activeDraggingCable,
      activeCableColor: s.activeCableColor,
      activeCableType: s.activeCableType,
      addCable: s.addCable,
      stopDraggingCable: s.stopDraggingCable,
    })),
  );

  const globalPos = useMemo(() => {
    return [
      devicePosition[0] + relativePos[0],
      devicePosition[1] + relativePos[1],
      relativePos[2],
    ] as [number, number, number];
  }, [devicePosition, relativePos]);

  // Determine if this port is a valid drop target for the in-flight cable
  const isValidDropTarget = useMemo(() => {
    if (!activeDraggingCable) return false;
    if (activeDraggingCable.fromDevice === deviceId) return false; // cannot connect to self
    if (cableId) return false; // already occupied

    const sourceDev = installedHardware.find((h) => h.id === activeDraggingCable.fromDevice);
    const targetDev = installedHardware.find((h) => h.id === deviceId);
    if (!sourceDev || !targetDev) return false;

    return isPortConnectionValid(sourceDev.type, targetDev.type);
  }, [activeDraggingCable, cableId, deviceId, installedHardware]);

  const isOccupied = Boolean(cableId);

  const handlePointerDown = (e: any) => {
    e.stopPropagation();

    // If already patched, double-click/shift click or drag can unplug
    if (isOccupied) {
      if (e.shiftKey || e.detail === 2) {
        unpatchPort(deviceId, portId);
      }
      return;
    }

    // Start a new patch cable drag
    startDraggingCable(
      deviceId,
      portId,
      globalPos,
      activeCableColor,
      activeCableType,
    );
  };

  const handlePointerUp = (e: any) => {
    e.stopPropagation();

    if (activeDraggingCable && isValidDropTarget) {
      addCable(
        activeDraggingCable.fromDevice,
        activeDraggingCable.fromPort,
        deviceId,
        portId,
        activeDraggingCable.color,
        activeDraggingCable.type,
      );
      stopDraggingCable();
    }
  };

  return (
    <group position={relativePos}>
      {/* Invisible expanded hit-box for easy targeting */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (isOccupied) unpatchPort(deviceId, portId);
        }}
      >
        <boxGeometry args={[0.016, 0.016, 0.012]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Snap Target Indicator Ring (when in-flight cable is valid) */}
      {isValidDropTarget && (
        <mesh position={[0, 0, 0.003]}>
          <ringGeometry args={[0.005, 0.008, 16]} />
          <meshBasicMaterial
            color={hovered ? '#10b981' : '#06b6d4'}
            side={THREE.DoubleSide}
            transparent
            opacity={hovered ? 0.95 : 0.65}
          />
        </mesh>
      )}

      {/* Hover ring */}
      {hovered && !isValidDropTarget && (
        <mesh position={[0, 0, 0.002]}>
          <ringGeometry args={[0.0045, 0.007, 16]} />
          <meshBasicMaterial
            color={isOccupied ? '#ef4444' : '#38bdf8'}
            side={THREE.DoubleSide}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}
    </group>
  );
}

// Backward compatibility export
export const Port = PortSocket;
