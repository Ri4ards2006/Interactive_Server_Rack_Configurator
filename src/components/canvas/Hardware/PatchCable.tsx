/**
 * PatchCable.tsx
 *
 * Renders 3D Ethernet/fiber patch cables between hardware chassis ports.
 * Implements:
 * - Dynamic curvature and relief paths for ports on front and rear plates.
 * - Selection highlighting (glows red) and delete via keypress ("Delete" / "Backspace").
 * - Hover "✕" overlay button using R3F Html projected elements.
 * - Logical routing validations (no Server-to-Server, no Switch-to-Switch patching).
 */

import { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { Html } from '@react-three/drei';
import { useConfiguratorStore } from '../../../store/useConfiguratorStore';
import type { CableProps, HardwareProps } from '../../../types/rack.types';
import { useIsBlueprint } from './shared';

// Available cable colors for random selection on new drags
const CABLE_COLORS = ['#eab308', '#3b82f6', '#ef4444', '#10b981', '#f97316'];

/**
 * Connection validity rules:
 * - Server/NAS-to-Server/NAS is forbidden (hosts don't connect directly).
 * - Switch-to-Switch is forbidden (as requested; stack links not allowed in this simple rule).
 * - Only Network-to-Server or Network-to-Network (uplinks like switch-to-firewall) connections allowed.
 */
export function isConnectionValid(typeA: string, typeB: string): boolean {
  const isHostA = typeA === 'server' || typeA === 'nas';
  const isHostB = typeB === 'server' || typeB === 'nas';
  if (isHostA && isHostB) return false;

  if (typeA === 'switch' && typeB === 'switch') return false;

  return true;
}

/**
 * Calculates the 3D port coordinate for a given device in rack space.
 * Recognizes if the ports sit on the front face (Z >= 0.2) or rear face (Z < 0.2).
 */
export function getPortPosition(device: HardwareProps, portStr: string): THREE.Vector3 {
  const [dx, dy] = device.position;
  
  const port = device.ports?.find(p => p.id === portStr);
  if (port) {
    return new THREE.Vector3(dx + port.position[0], dy + port.position[1], port.position[2]);
  }

  // Fallback
  return new THREE.Vector3(dx, dy, 0.395);
}

/**
 * RJ45 plastic plug head component.
 * Rotates 180 degrees if plugged into the back panel of a server to face inward.
 */
export function RJ45Plug({ position }: { position: THREE.Vector3 }) {
  const isBlueprint = useIsBlueprint();
  if (isBlueprint) return null;

  // Front bezel sits around Z = 0.39, rear plate around Z = 0.39 - depth
  const isBack = position.z < 0.2;

  return (
    <group position={position} rotation={[0, isBack ? Math.PI : 0, 0]}>
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
  const installedHardware = useConfiguratorStore(useShallow((s) => s.installedHardware));
  
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

  // Validate connection rules before allowing snapping
  const isDragTarget = useMemo(() => {
    if (!activeDraggingCable || activeDraggingCable.fromDevice === deviceId) return false;
    const fromDev = installedHardware.find(h => h.id === activeDraggingCable.fromDevice);
    const toDev = installedHardware.find(h => h.id === deviceId);
    if (!fromDev || !toDev) return false;
    
    return isConnectionValid(fromDev.type, toDev.type);
  }, [activeDraggingCable, deviceId, installedHardware]);

  // Calculate if the dragged end is snapped to this port
  const isSnapped = useMemo(() => {
    if (!isDragTarget || !activeDraggingCable || cableId) return false;
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

  // Determine if port is on the rear plate
  const isBack = relativePos[2] < 0.2;

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
          opacity={hovered ? 0.35 : 0.0}
        />
      </mesh>

      {/* Snap Indicator (Glowing Ring positioned just outside the socket opening) */}
      {isSnapped && (
        <mesh position={[0, 0, isBack ? -0.002 : 0.002]}>
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
 * Glows red when selected. Shows a hoverable HTML "✕" button to delete with one click.
 */
export function PatchCable({ cable, fromDevice, toDevice }: PatchCableProps) {
  const isBlueprint = useIsBlueprint();
  const [hovered, setHovered] = useState(false);

  const { selectedCableId, selectCable, removeCable } = useConfiguratorStore(
    useShallow((s) => ({
      selectedCableId: s.selectedCableId,
      selectCable: s.selectCable,
      removeCable: s.removeCable
    }))
  );

  const isSelected = selectedCableId === cable.id;

  // 1. Calculate spline points
  const { p1, p1Forward, midPoint, p2Forward, p2 } = useMemo(() => {
    const start = getPortPosition(fromDevice, cable.fromPort);
    const end = getPortPosition(toDevice, cable.toPort);

    // Determine direction out of the port: -1 for back face (Z < 0.2), +1 for front face (Z >= 0.2)
    const startDir = start.z < 0.2 ? -1 : 1;
    const endDir = end.z < 0.2 ? -1 : 1;

    // Cable emerges straight out for 2.5cm first before curving
    const startForward = start.clone().setZ(start.z + 0.025 * startDir);
    const endForward = end.clone().setZ(end.z + 0.025 * endDir);

    // Midpoint calculations with gravity sag
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const dist = start.distanceTo(end);
    const sag = Math.max(0.06, dist * 0.38);
    mid.y -= sag;

    // Cable routing through rack or exterior
    if (start.z >= 0.2 && end.z >= 0.2) {
      // Both front: push outward in front of bezel to avoid clipping
      mid.z += Math.max(0.05, dist * 0.22);
    } else if (start.z < 0.2 && end.z < 0.2) {
      // Both back: push backward
      mid.z -= Math.max(0.05, dist * 0.22);
    } else {
      // Cross-rack: naturally goes through inside center of rack
    }

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

  const handleClick = (e: any) => {
    e.stopPropagation();
    selectCable(isSelected ? null : cable.id);
  };

  return (
    <group>
      {/* 3D Cable tube */}
      <mesh
        castShadow={!isBlueprint}
        receiveShadow={!isBlueprint}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
        }}
        onPointerDown={handleClick}
      >
        <tubeGeometry args={[curve, 48, 0.0028, 8, false]} />
        {isBlueprint ? (
          <meshBasicMaterial color={isSelected ? '#ef4444' : cable.color} />
        ) : (
          <meshStandardMaterial
            color={isSelected ? '#ef4444' : cable.color}
            roughness={0.4}
            metalness={0.15}
            emissive={isSelected ? '#ef4444' : '#000000'}
            emissiveIntensity={isSelected ? 0.5 : 0.0}
          />
        )}
      </mesh>

      {/* RJ45 Head Plugs */}
      <group onPointerDown={handleClick}>
        <RJ45Plug position={p1} />
        <RJ45Plug position={p2} />
      </group>

      {/* Hover delete handler button (HTML overlay in 3D Space) */}
      {hovered && (
        <Html position={midPoint} center distanceFactor={1.2}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeCable(cable.id);
              selectCable(null);
            }}
            className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] font-bold shadow-md border border-red-500 hover:bg-red-500 cursor-pointer pointer-events-auto transition-transform hover:scale-110 active:scale-95"
            style={{ padding: 0 }}
            title="Kabel entfernen"
          >
            ✕
          </button>
        </Html>
      )}
    </group>
  );
}

/**
 * Dynamically rendered cable in "dragging" state.
 * Connects the start port to the snapped port (if within 5cm) or to the mouse world position.
 */
function DraggingCable({ active }: { active: any }) {
  const installedHardware = useConfiguratorStore(useShallow((s) => s.installedHardware));
  
  const fromDevice = useMemo(() => {
    return installedHardware.find(h => h.id === active.fromDevice);
  }, [installedHardware, active.fromDevice]);

  if (!fromDevice) return null;

  const startPos = new THREE.Vector3(...active.startPortGlobalPos);
  const mousePos = new THREE.Vector3(...active.currentMouseWorldPos);

  // Scan for nearby ports that pass connection rule checks
  const snapped = (() => {
    let closest: { deviceId: string; portId: string; globalPos: THREE.Vector3 } | null = null;
    let minDistance = Infinity;

    for (const dev of installedHardware) {
      if (dev.id === active.fromDevice || !dev.ports) continue;
      
      // Logical connection rule validation
      if (!isConnectionValid(fromDevice.type, dev.type)) continue;

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
            globalPos: portPos
          };
        }
      }
    }

    if (closest && minDistance < 0.05) return closest;
    return null;
  })();

  const endPos = snapped ? snapped.globalPos : mousePos;

  // Catmull spline curve coordinates with relative direction support
  const startDir = startPos.z < 0.2 ? -1 : 1;
  const endDir = endPos.z < 0.2 ? -1 : 1;

  const p1Forward = startPos.clone().setZ(startPos.z + 0.025 * startDir);
  const p2Forward = endPos.clone().setZ(endPos.z + 0.025 * endDir);
  
  const mid = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
  const dist = startPos.distanceTo(endPos);
  const sag = Math.max(0.04, dist * 0.3);
  mid.y -= sag;

  if (startPos.z >= 0.2 && endPos.z >= 0.2) {
    mid.z += Math.max(0.04, dist * 0.18);
  } else if (startPos.z < 0.2 && endPos.z < 0.2) {
    mid.z -= Math.max(0.04, dist * 0.18);
  }

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
  const selectCable = useConfiguratorStore((s) => s.selectCable);

  // Global keydown listener for "Delete" or "Backspace" shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selected = useConfiguratorStore.getState().selectedCableId;
        if (selected) {
          useConfiguratorStore.getState().removeCable(selected);
          useConfiguratorStore.getState().selectCable(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectCable]);

  // Scan current mouse pos relative to all ports for release snapping and connection rules
  const snappedPort = useMemo(() => {
    if (!activeDraggingCable) return null;
    const fromDev = installedHardware.find(h => h.id === activeDraggingCable.fromDevice);
    if (!fromDev) return null;

    const mousePos = new THREE.Vector3(...activeDraggingCable.currentMouseWorldPos);
    let closest: { deviceId: string; portId: string; distance: number } | null = null;
    let minDistance = Infinity;

    for (const dev of installedHardware) {
      if (dev.id === activeDraggingCable.fromDevice || !dev.ports) continue;
      
      // Connection validation rule check
      if (!isConnectionValid(fromDev.type, dev.type)) continue;

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
          position={[0, 0.8, 0.41]}
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
