/**
 * Server.tsx
 *
 * Single server instance: chassis mesh, front bezel, optional selection
 * outline, and drag-to-snap interaction delegated to
 * `useHardwareInteraction`.
 *
 * Rebuilt with high-fidelity detail:
 * - Individually interactive HDD caddies (grid based on height: 1U has 4 bays, 2U has 8 bays).
 * - Click HDD caddy to slide it out; click again to remove it completely.
 * - Empty slots render a translucent cyan "Ghost Sled" faceplate on hover.
 * - Click empty slots to insert a fresh, healthy drive caddy.
 * - Simulates drive failures (LED blinks red rapidly).
 */

import { useState, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import {
  RACK_UNIT_HEIGHT,
  CHASSIS_WIDTH,
  EDGE_GAP,
  useConfiguratorStore,
} from '../../../store/useConfiguratorStore';
import type { HardwareProps } from '../../../types/rack.types';
import { useHardwareInteraction } from '../../../hooks/useHardwareInteraction';
import { Port } from './PatchCable';
import {
  SelectionOutline,
  SchematicBox,
  blueprintChassisMaterial,
  blueprintBezelMaterial,
  useIsBlueprint,
  RackMountDetails,
} from './shared';

// -- Hoisted PBR materials ---------------------------------------------
const chassisMaterial = new THREE.MeshStandardMaterial({
  color: '#222224', // Matte textured dark steel
  metalness: 0.5,
  roughness: 0.6,
});

const bezelMaterial = new THREE.MeshStandardMaterial({
  color: '#1a1a1c', // Anodized/brushed dark grey aluminum
  metalness: 0.8,
  roughness: 0.3,
});

const driveMaterial = new THREE.MeshStandardMaterial({
  color: '#0f0f10', // Dark polymer drive bay
  metalness: 0.6,
  roughness: 0.4,
});

const leverMaterial = new THREE.MeshStandardMaterial({
  color: '#4a4a4e', // Silver-brushed lever
  metalness: 0.9,
  roughness: 0.2,
});

const ledBlueMaterial = new THREE.MeshBasicMaterial({
  color: '#06b6d4', // Glowing cyan locator LED
  toneMapped: false,
});

const ledGreenMaterial = new THREE.MeshBasicMaterial({
  color: '#10b981', // Glowing green power LED
  toneMapped: false,
});

const ledSolidGreen = new THREE.MeshStandardMaterial({
  color: '#10b981',
  emissive: '#10b981',
  emissiveIntensity: 1.2,
});

const ledRed = new THREE.MeshStandardMaterial({
  color: '#ef4444',
  emissive: '#ef4444',
  emissiveIntensity: 1.2,
});

interface ServerHddBayProps {
  index: number;
  r: number;
  c: number;
  dx: number;
  dy: number;
  driveW: number;
  driveH: number;
  bezelFrontZ: number;
  depth: number;
  isBlueprint: boolean;
  deviceId: string;
}

/**
 * Individual Server HDD caddy bay: manages click transitions (inserted -> extracted -> removed -> inserted),
 * failed blinking lights, and empty caddy ghost hover meshes.
 */
function ServerHddBay({ index, r, c, dx, dy, driveW, driveH, bezelFrontZ, depth, isBlueprint, deviceId }: ServerHddBayProps) {
  const [hovered, setHovered] = useState(false);
  
  const bay = useConfiguratorStore(
    (s) => s.hddBays[deviceId]?.[index] || { status: 'inserted', isFailed: false }
  );
  
  const toggleHddBay = useConfiguratorStore((s) => s.toggleHddBay);
  const insertHddIntoBay = useConfiguratorStore((s) => s.insertHddIntoBay);

  const isExtracted = bay.status === 'extracted';
  const isRemoved = bay.status === 'removed';
  const isFailed = bay.isFailed;

  const sledZOffset = isExtracted ? 0.08 : 0.0;

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (isRemoved) {
      insertHddIntoBay(deviceId, index);
    } else {
      toggleHddBay(deviceId, index);
    }
  };

  if (isRemoved) {
    return (
      <group
        position={[dx, dy, bezelFrontZ]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
        }}
        onClick={handleClick}
      >
        {/* Dark slot recess */}
        <mesh position={[0, 0, -0.005]}>
          <boxGeometry args={[driveW - 0.002, driveH - 0.002, 0.01]} />
          <meshBasicMaterial color="#050505" />
        </mesh>
        
        {/* Ghost drive faceplate suggestion on hover */}
        {hovered && !isBlueprint && (
          <mesh position={[0, 0, 0.001]}>
            <boxGeometry args={[driveW, driveH, 0.002]} />
            <meshStandardMaterial
              color="#22d3ee"
              transparent
              opacity={0.25}
              roughness={0.5}
              metalness={0.1}
            />
          </mesh>
        )}
      </group>
    );
  }

  return (
    <group
      position={[dx, dy, bezelFrontZ + sledZOffset]}
      onClick={handleClick}
    >
      {/* HDD Caddy Sled Body (extends back into chassis) */}
      {!isBlueprint && (
        <mesh
          position={[0, 0, -depth / 2 + 0.01]}
          castShadow
          material={driveMaterial}
        >
          <boxGeometry args={[driveW - 0.004, driveH - 0.002, depth - 0.02]} />
        </mesh>
      )}

      {/* Front Bezel Faceplate */}
      <mesh
        position={[0, 0, 0.001]}
        material={isBlueprint ? blueprintChassisMaterial : driveMaterial}
        castShadow={!isBlueprint}
      >
        <boxGeometry args={[driveW, driveH - 0.002, 0.002]} />
      </mesh>

      {/* Release lever */}
      {!isBlueprint && (
        <mesh position={[-driveW / 2 + 0.008, 0, 0.0015]} material={leverMaterial}>
          <boxGeometry args={[0.008, driveH - 0.006, 0.0008]} />
        </mesh>
      )}

      {/* Solid green power LED (Turns red if disk failed) */}
      {!isBlueprint && (
        <mesh position={[driveW / 2 - 0.012, 0.001, 0.0015]} material={isFailed ? ledRed : ledSolidGreen}>
          <sphereGeometry args={[0.001, 8, 8]} />
        </mesh>
      )}

      {/* Flickering Disk Activity LED */}
      {!isBlueprint && (
        <ServerActivityLED r={r} c={c} isFailed={isFailed} driveW={driveW} />
      )}
    </group>
  );
}

/**
 * A helper component that drives the flickering activity LED of an HDD caddy.
 * If disk has failed, it blinks red rapidly.
 */
function ServerActivityLED({ r, c, isFailed, driveW }: { r: number; c: number; isFailed: boolean; driveW: number }) {
  const ledRef = useRef<THREE.MeshStandardMaterial>(null);
  
  const freq = 10 + r * 4 + c * 3;
  const pulseOffset = r * 0.3 + c * 0.5;

  useFrame((state) => {
    if (!ledRef.current) return;
    const t = state.clock.getElapsedTime();
    
    if (isFailed) {
      // Rapid failed alarm blinking (8Hz red flash)
      const isLit = Math.floor(t * 8.0) % 2 === 0;
      ledRef.current.color.set('#ef4444');
      ledRef.current.emissive.set('#ef4444');
      ledRef.current.emissiveIntensity = isLit ? 1.6 : 0.05;
    } else {
      // Normal activity green blinking
      const val = Math.sin(t * freq + pulseOffset) * Math.cos(t * (freq * 0.6)) + Math.sin(t * 2);
      const isLit = val > 0.4;
      
      if (isLit) {
        ledRef.current.color.set('#10b981');
        ledRef.current.emissive.set('#10b981');
        ledRef.current.emissiveIntensity = 1.4;
      } else {
        ledRef.current.emissiveIntensity = 0.0;
        ledRef.current.color.set('#064e3b');
      }
    }
  });

  return (
    <mesh position={[driveW / 2 - 0.006, 0.001, 0.0015]}>
      <sphereGeometry args={[0.001, 8, 8]} />
      <meshStandardMaterial
        ref={ledRef}
        color="#064e3b"
        emissive="#10b981"
        emissiveIntensity={0.0}
        roughness={0.1}
      />
    </mesh>
  );
}

interface ServerProps {
  hardware: HardwareProps;
}

export function Server({ hardware }: ServerProps) {
  const interaction = useHardwareInteraction(hardware);
  const chassisHeight = hardware.rackUnits * RACK_UNIT_HEIGHT - EDGE_GAP;
  const isBlueprint = useIsBlueprint();

  // Shift chassis body back so front aligns to Z = 0.39
  const zShift = 0.39 - hardware.depth / 2;
  const bezelFrontZ = 0.39 + 0.002;

  // Dynamic drive grid based on U size
  const driveRows = hardware.rackUnits;
  const driveCols = 4;
  const driveW = (CHASSIS_WIDTH - 0.1) / driveCols;
  const driveH = (chassisHeight - 0.01) / driveRows;

  // Generate list of drive indexes
  const driveIndices = useMemo(() => {
    const list: Array<{ r: number; c: number; index: number }> = [];
    let driveCount = 0;
    for (let r = 0; r < driveRows; r++) {
      for (let c = 0; c < driveCols; c++) {
        list.push({ r, c, index: driveCount++ });
      }
    }
    return list;
  }, [driveRows, driveCols]);

  return (
    <group
      position={hardware.position}
      onPointerOver={interaction.onPointerOver}
      onPointerOut={interaction.onPointerOut}
      onPointerDown={interaction.onPointerDown}
      onPointerMove={interaction.onPointerMove}
      onPointerUp={interaction.onPointerUp}
      onPointerCancel={interaction.onPointerCancel}
    >
      {/* Universal Rack Ears & Extension Support Rails */}
      <RackMountDetails height={chassisHeight} depth={hardware.depth} isBlueprint={isBlueprint} />

      {/* Main chassis body - shifted back */}
      <mesh
        position={[0, 0, zShift]}
        castShadow={!isBlueprint}
        receiveShadow={!isBlueprint}
        material={isBlueprint ? blueprintChassisMaterial : chassisMaterial}
      >
        <boxGeometry args={[CHASSIS_WIDTH, chassisHeight, hardware.depth]} />
      </mesh>
      {isBlueprint && (
        <SchematicBox
          width={CHASSIS_WIDTH}
          height={chassisHeight}
          depth={hardware.depth}
          position={[0, 0, zShift]}
        />
      )}

      {/* Front bezel - placed flush at Z = 0.39 */}
      <mesh
        position={[0, 0, 0.39 + 0.001]}
        material={isBlueprint ? blueprintBezelMaterial : bezelMaterial}
      >
        <boxGeometry args={[CHASSIS_WIDTH - 0.02, chassisHeight, 0.002]} />
      </mesh>
      {isBlueprint && (
        <SchematicBox
          width={CHASSIS_WIDTH - 0.02}
          height={chassisHeight}
          depth={0.002}
          position={[0, 0, 0.39 + 0.001]}
        />
      )}

      {/* High-density drive bays & status LEDs */}
      {driveIndices.map(({ r, c, index }) => {
        const dx = -CHASSIS_WIDTH / 2 + 0.05 + c * (driveW + 0.005) + driveW / 2;
        const dy = -chassisHeight / 2 + 0.005 + r * (driveH + 0.002) + driveH / 2;
        return (
          <ServerHddBay
            key={index}
            index={index}
            r={r}
            c={c}
            dx={dx}
            dy={dy}
            driveW={driveW}
            driveH={driveH}
            bezelFrontZ={bezelFrontZ}
            depth={hardware.depth}
            isBlueprint={isBlueprint}
            deviceId={hardware.id}
          />
        );
      })}

      {/* Diagnostic indicators on the right wing */}
      {!isBlueprint && (
        <group position={[0, 0, bezelFrontZ]}>
          <mesh position={[CHASSIS_WIDTH / 2 - 0.02, 0, 0.0015]} material={ledGreenMaterial}>
            <sphereGeometry args={[0.0025, 8, 8]} />
          </mesh>
          <mesh position={[CHASSIS_WIDTH / 2 - 0.012, 0, 0.0015]} material={ledBlueMaterial}>
            <sphereGeometry args={[0.0025, 8, 8]} />
          </mesh>
        </group>
      )}

      {/* Interactive Ports Overlay */}
      {hardware.ports?.map((p) => (
        <Port
          key={p.id}
          deviceId={hardware.id}
          portId={p.id}
          relativePos={p.position}
          devicePosition={hardware.position}
          cableId={p.cableId}
          label={p.label}
        />
      ))}

      {/* Selection outline - matches the shifted chassis position */}
      {interaction.isSelected && (
        <SelectionOutline
          rackUnits={hardware.rackUnits}
          depth={hardware.depth}
          position={[0, 0, zShift]}
        />
      )}
    </group>
  );
}
