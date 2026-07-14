/**
 * PatchCable.tsx
 *
 * Renders 3D Ethernet/fiber patch cables between hardware chassis ports.
 * Implements an interactive RJ45 port snapping system:
 * - <Port /> components render collision volumes over RJ45 sockets.
 * - Click & drag from a port to pull a patch cable.
 * - Cable sags under gravity and snaps to any free port within 5cm.
 * - Double-click on any port or cable connector to unplug/unpatch.
 * - Renders realistic RJ45 plastic plugs with locking clips at connection endpoints.
 */

import { useMemo, useState, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useConfiguratorStore } from '../../../store/useConfiguratorStore';
import type { CableProps, HardwareProps } from '../../../types/rack.types';
import { useIsBlueprint } from './shared';

// Available cable colors for random selection on new drags
const CABLE_COLORS = ['#eab308', '#3b82f6', '#ef4444', '#10b981', '#f97316'];

/**
 * Calculates the front-panel 3D port coordinate for a given device.
 * Distributes port numbers horizontally and aligns them vertically based on device type.
 */
export function getPortPosition(device: HardwareProps, portStr: string): THREE.Vector3 {
  const [dx, dy] = device.position;
  
  // Look up port relative position from the device's ports array
  const port = device.ports?.find(p => p.id === portStr);
  if (port) {
    return new THREE.Vector3(dx + port.position[0], dy + port.position[1], port.position[2]);
  }

  // Fallback to old dynamic math if port not found
  const portIndex = parseInt(portStr, 10) || 1;
  const maxPorts = 24;
  const width = 0.32;
  const step = width / (maxPorts - 1);
  const xOffset = -width / 2 + ((portIndex - 1) % maxPorts) * step;
  return new THREE.Vector3(dx + xOffset, dy, 0.395);
}

/**
 * RJ45 plastic plug head component with contact pins and locking clip.
 */
export function RJ45Plug({ position }: { position: THREE.Vector3 }) {
  const isBlueprint = useIsBlueprint();
  if (isBlueprint) return null;

  return (
    <group position={position}>
      {/* Translucent clear/gray RJ45 shell */}
      <mesh castShadow receiveShadow position={[0, 0, 0.006]}>
        <boxGeometry args={[0.007, 0.007, 0.012]} />
        <meshStandardMaterial
          color="#d4d4d8"
          transparent
          opacity={0.65}
          roughness={0.15}
          metalness={0.1}
        />
      </mesh>
      
      {/* Gold pins recess */}
      <mesh position={[0, -0.0012, 0.0006]}>
        <boxGeometry args={[0.005, 0.0008, 0.0012]} />
        <meshStandardMaterial color="#d97706" metalness={0.95} roughness={0.05} />
      </mesh>

      {/* Locking Tab / Clip (Angled Box) */}
      <mesh position={[0, 0.0048, 0.007]} rotation={[-0.22, 0, 0]}>
        <boxGeometry args={[0.0018, 0.0015, 0.007]} />
        <meshStandardMaterial color="#cbd5e1" transparent opacity={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

interface PortComponentProps {
  deviceId: string;
  portId: string;
  relativePos: [number, number, number];
  devicePosition: [number, number, number];
  cableId: string | null;
  label: string;
}

/**
 * Interactive Port collision mesh overlay.
 * Handles drag start, hover highlighting, snapped glow, and double-click unpatching.
 */
export function Port({ deviceId, portId, relativePos, devicePosition, cableId, label }: PortComponentProps) {
  const [hovered, setHovered] = useState(false);
  
  const { startDraggingCable, unpatchPort, activeDraggingCable } = useConfiguratorStore(
    useShallow((s) => ({
      startDraggingCable: s.startDraggingCable,
      unpatchPort: s.unpatchPort,
      activeDraggingCable: s.activeDraggingCable,
    }))
  );

  const globalPos = useMemo(() => {
    return new THREE.Vector3(
      devicePosition[0] + relativePos[0],
      devicePosition[1] + relativePos[1],
      relativePos[2]
    );
  }, [devicePosition, relativePos]);

  // Check if we are currently dragging a cable from another device
  const isDragTarget = activeDraggingCable && activeDraggingCable.fromDevice !== deviceId;
  
  // Calculate if the dragged end is snapped to this port
  const isSnapped = useMemo(() => {
    if (!isDragTarget || cableId) return false;
    const mousePos = new THREE.Vector3(...activeDraggingCable.currentMouseWorldPos);
    return globalPos.distanceTo(mousePos) < 0.05;
  }, [isDragTarget, cableId, activeDraggingCable?.currentMouseWorldPos, globalPos]);

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    
    // Double click to unplug
    if (e.detail === 2) {
      if (cableId) {
        unpatchPort(deviceId, portId);
      }
      return;
    }

    // Drag start
    if (!cableId) {
      const color = CABLE_COLORS[Math.floor(Math.random() * CABLE_COLORS.length)];
      startDraggingCable(deviceId, portId, globalPos.toArray() as [number, number, number], color);
    }
  };

  return (
    <group position={relativePos}>
      {/* Collision volume & hover overlay */}
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
      >
        <boxGeometry args={[0.012, 0.01, 0.008]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={hovered ? 0.35 : 0.0} // Hidden unless hovered
        />
      </mesh>

      {/* Snap Indicator (Glowing Ring) */}
      {isSnapped && (
        <mesh position={[0, 0, 0.001]}>
          <boxGeometry args={[0.014, 0.012, 0.004]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.65} />
        </mesh>
      )}
    </group>
  );
}

interface PatchCableProps {
  cable: CableProps;
  fromDevice: HardwareProps;
  toDevice: HardwareProps;
}

/**
 * Standard patched cable component (static connection).
 */
export function PatchCable({ cable, fromDevice, toDevice }: PatchCableProps) {
  const isBlueprint = useIsBlueprint();
  const unpatchPort = useConfiguratorStore((s) => s.unpatchPort);

  // 1. Calculate spline points
  const { p1, p1Forward, midPoint, p2Forward, p2 } = useMemo(() => {
    const start = getPortPosition(fromDevice, cable.fromPort);
    const end = getPortPosition(toDevice, cable.toPort);

    // Cable emerges straight out for 2.5cm first
    const startForward = start.clone().setZ(start.z + 0.025);
    const endForward = end.clone().setZ(end.z + 0.025);

    // Midpoint calculations with gravity sag
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const dist = start.distanceTo(end);
    const sag = Math.max(0.06, dist * 0.38);
    mid.y -= sag;

    // Push curve forward to prevent bezel clipping
    mid.z += Math.max(0.05, dist * 0.22);

    return {
      p1: start,
      p1Forward: startForward,
      midPoint: mid,
      p2Forward: endForward,
      p2: end,
    };
  }, [fromDevice, toDevice, cable.fromPort, cable.toPort]);

  // 2. Generate curve
  const curve = useMemo(() => {
    return new THREE.CatmullRomCurve3([p1, p1Forward, midPoint, p2Forward, p2]);
  }, [p1, p1Forward, midPoint, p2Forward, p2]);

  const handleDoubleClick = (e: any) => {
    e.stopPropagation();
    if (e.detail === 2) {
      unpatchPort(fromDevice.id, cable.fromPort);
    }
  };

  return (
    <group onPointerDown={handleDoubleClick}>
      {/* 3D Cable tube */}
      <mesh castShadow={!isBlueprint} receiveShadow={!isBlueprint}>
        <tubeGeometry args={[curve, 48, 0.0028, 8, false]} />
        {isBlueprint ? (
          <meshBasicMaterial color={cable.color} />
        ) : (
          <meshStandardMaterial
            color={cable.color}
            roughness={0.4}
            metalness={0.15}
          />
        )}
      </mesh>

      {/* RJ45 Head Plugs */}
      <RJ45Plug position={p1} />
      <RJ45Plug position={p2} />
    </group>
  );
}

/**
 * Dynamically rendered cable in "dragging" state.
 * Connects the start port to the snapped port (if within 5cm) or to the mouse world position.
 */
function DraggingCable({ active }: { active: any }) {
  const installedHardware = useConfiguratorStore((s) => s.installedHardware);
  
  const fromDevice = useMemo(() => {
    return installedHardware.find(h => h.id === active.fromDevice);
  }, [installedHardware, active.fromDevice]);

  if (!fromDevice) return null;

  const startPos = new THREE.Vector3(...active.startPortGlobalPos);
  const mousePos = new THREE.Vector3(...active.currentMouseWorldPos);

  // Scan for nearby ports to snap
  const snapped = (() => {
    let closest: { deviceId: string; portId: string; globalPos: THREE.Vector3 } | null = null;
    let minDistance = Infinity;

    for (const dev of installedHardware) {
      if (dev.id === active.fromDevice || !dev.ports) continue;
      
      for (const port of dev.ports) {
        if (port.cableId) continue; // Free ports only
        const portPos = new THREE.Vector3(
          dev.position[0] + port.position[0],
          dev.position[1] + port.position[1],
          port.position[2]
        );
        const d = portPos.distanceTo(mousePos);
        if (d < minDistance) {
          minDistance = d;
          closest = {
            deviceId: dev.id,
            portId: port.id,
            globalPos: portPos
          };
        }
      }
    }

    if (closest && minDistance < 0.05) return closest;
    return null;
  })();

  const endPos = snapped ? snapped.globalPos : mousePos;

  // Catmull spline curve coordinates
  const p1Forward = startPos.clone().setZ(startPos.z + 0.025);
  const p2Forward = endPos.clone().setZ(endPos.z + 0.025);
  
  const mid = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
  const dist = startPos.distanceTo(endPos);
  const sag = Math.max(0.04, dist * 0.3);
  mid.y -= sag;
  mid.z += Math.max(0.04, dist * 0.18);

  const curve = new THREE.CatmullRomCurve3([startPos, p1Forward, mid, p2Forward, endPos]);

  return (
    <group>
      {/* Dragging cable wire */}
      <mesh>
        <tubeGeometry args={[curve, 32, 0.0028, 8, false]} />
        <meshStandardMaterial
          color={active.color}
          roughness={0.4}
          metalness={0.1}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Cable connector heads */}
      <RJ45Plug position={startPos} />
      <RJ45Plug position={endPos} />
    </group>
  );
}

/**
 * Maps the global cables list from Zustand store to individual 3D PatchCable meshes.
 * Also holds the invisible drag-move plane and dragging cables.
 */
export function CableMapper() {
  const installedHardware = useConfiguratorStore(useShallow((s) => s.installedHardware));
  const cables = useConfiguratorStore(useShallow((s) => s.cables));
  const activeDraggingCable = useConfiguratorStore(useShallow((s) => s.activeDraggingCable));
  
  const updateDraggingCable = useConfiguratorStore((s) => s.updateDraggingCable);
  const stopDraggingCable = useConfiguratorStore((s) => s.stopDraggingCable);
  const addCable = useConfiguratorStore((s) => s.addCable);

  // Scan current mouse pos relative to all ports for release snapping
  const snappedPort = useMemo(() => {
    if (!activeDraggingCable) return null;
    const mousePos = new THREE.Vector3(...activeDraggingCable.currentMouseWorldPos);
    let closest: { deviceId: string; portId: string; distance: number } | null = null;
    let minDistance = Infinity;

    for (const dev of installedHardware) {
      if (dev.id === activeDraggingCable.fromDevice || !dev.ports) continue;
      
      for (const port of dev.ports) {
        if (port.cableId) continue;
        const portPos = new THREE.Vector3(
          dev.position[0] + port.position[0],
          dev.position[1] + port.position[1],
          port.position[2]
        );
        const d = portPos.distanceTo(mousePos);
        if (d < minDistance) {
          minDistance = d;
          closest = {
            deviceId: dev.id,
            portId: port.id,
            distance: d
          };
        }
      }
    }

    if (closest && closest.distance < 0.05) return closest;
    return null;
  }, [activeDraggingCable?.currentMouseWorldPos, installedHardware, activeDraggingCable?.fromDevice]);

  const handlePointerMove = (e: any) => {
    if (!activeDraggingCable) return;
    e.stopPropagation();
    updateDraggingCable(e.point.toArray() as [number, number, number]);
  };

  const handlePointerUp = (e: any) => {
    if (!activeDraggingCable) return;
    e.stopPropagation();
    
    if (snappedPort) {
      // Connect!
      addCable(
        activeDraggingCable.fromDevice,
        activeDraggingCable.fromPort,
        snappedPort.deviceId,
        snappedPort.portId,
        activeDraggingCable.color
      );
    }
    
    stopDraggingCable();
  };

  return (
    <group>
      {/* Existing fully patched cables */}
      {cables.map((c) => {
        const fromDev = installedHardware.find((h) => h.id === c.fromDevice);
        const toDev = installedHardware.find((h) => h.id === c.toDevice);

        if (!fromDev || !toDev) return null;

        return (
          <PatchCable
            key={c.id}
            cable={c}
            fromDevice={fromDev}
            toDevice={toDev}
          />
        );
      })}

      {/* Render the cable currently being dragged */}
      {activeDraggingCable && <DraggingCable active={activeDraggingCable} />}

      {/* Full-viewport drag-move catcher plane */}
      {activeDraggingCable && (
        <mesh
          position={[0, 0.8, 0.41]} // Positioned slightly in front of front panels (0.39 + delta)
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <planeGeometry args={[5.0, 5.0]} />
          <meshBasicMaterial transparent opacity={0.0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
