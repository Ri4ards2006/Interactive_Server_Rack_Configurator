/**
 * NAS.tsx
 *
 * 2U Network Attached Storage (NAS) chassis.
 * Rebuilt with high-fidelity detail:
 * - 12 individually interactive HDD caddies (4 rows of 3 columns).
 * - Clicking pulls the HDD out, clicking again completely removes it.
 * - Empty slots render a transparent "Ghost Sled" on hover.
 * - Clicking the empty slot inserts a healthy, fresh HDD.
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
import {
  SelectionOutline,
  SchematicBox,
  blueprintChassisMaterial,
  blueprintBezelMaterial,
  useIsBlueprint,
  RackMountDetails,
} from './shared';

// ---- Geometry constants ---------------------------------------------
const DRIVE_ROWS = 4;
const DRIVE_COLS = 3;
const DRIVE_W = 0.09;
const DRIVE_H = 0.014;
const DRIVE_GAP_X = 0.005;
const DRIVE_GAP_Y = 0.004;

// ---- PBR Materials --------------------------------------------------
const chassisMaterial = new THREE.MeshStandardMaterial({
  color: '#18181b', // Dark zinc
  metalness: 0.7,
  roughness: 0.55,
});

const bezelMaterial = new THREE.MeshStandardMaterial({
  color: '#09090b', // Deep zinc black
  metalness: 0.8,
  roughness: 0.35,
});

const caddyMaterial = new THREE.MeshStandardMaterial({
  color: '#131316', // Matte black caddy plastic
  metalness: 0.2,
  roughness: 0.7,
});

const caddyFaceMaterial = new THREE.MeshStandardMaterial({
  color: '#1a1a1f',
  metalness: 0.5,
  roughness: 0.55,
});

const metalLeverMaterial = new THREE.MeshStandardMaterial({
  color: '#3f3f46', // Brushed gray steel release lever
  metalness: 0.9,
  roughness: 0.25,
});

const oledScreenMaterial = new THREE.MeshStandardMaterial({
  color: '#083344', // Deep cyan
  emissive: '#06b6d4', // Glowing cyan OLED screen
  emissiveIntensity: 1.8,
  roughness: 0.1,
  metalness: 0.2,
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

const usbPortMaterial = new THREE.MeshStandardMaterial({
  color: '#71717a',
  metalness: 0.9,
  roughness: 0.2,
});

interface HddBayProps {
  index: number;
  r: number;
  c: number;
  xPos: number;
  yPos: number;
  bezelFrontZ: number;
  depth: number;
  isBlueprint: boolean;
  deviceId: string;
}

/**
 * Individual HDD caddy bay: manages click transitions (inserted -> extracted -> removed -> inserted),
 * failed blinking lights, and empty caddy ghost hover meshes.
 */
function HddBay({ index, r, c, xPos, yPos, bezelFrontZ, depth, isBlueprint, deviceId }: HddBayProps) {
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
        position={[xPos, yPos, bezelFrontZ]}
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
          <boxGeometry args={[DRIVE_W - 0.002, DRIVE_H - 0.002, 0.01]} />
          <meshBasicMaterial color="#050505" />
        </mesh>
        
        {/* Ghost drive faceplate suggestion on hover */}
        {hovered && !isBlueprint && (
          <mesh position={[0, 0, 0.001]}>
            <boxGeometry args={[DRIVE_W, DRIVE_H, 0.002]} />
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
      position={[xPos, yPos, bezelFrontZ + sledZOffset]}
      onClick={handleClick}
    >
      {/* HDD Caddy Sled Body (extends back into chassis) */}
      {!isBlueprint && (
        <mesh
          position={[0, 0, -depth / 2 + 0.01]}
          castShadow
          material={caddyMaterial}
        >
          <boxGeometry args={[DRIVE_W - 0.004, DRIVE_H - 0.002, depth - 0.02]} />
        </mesh>
      )}

      {/* Front Bezel Faceplate */}
      <mesh
        position={[0, 0, 0.001]}
        material={isBlueprint ? blueprintChassisMaterial : caddyFaceMaterial}
        castShadow={!isBlueprint}
      >
        <boxGeometry args={[DRIVE_W, DRIVE_H, 0.003]} />
      </mesh>

      {/* Vent slots on caddy front */}
      {!isBlueprint && (
        <group position={[-0.01, 0, 0.0022]}>
          <mesh material={bezelMaterial}>
            <boxGeometry args={[0.038, 0.002, 0.0006]} />
          </mesh>
          <mesh material={bezelMaterial} position={[0, 0.003, 0]}>
            <boxGeometry args={[0.038, 0.002, 0.0006]} />
          </mesh>
          <mesh material={bezelMaterial} position={[0, -0.003, 0]}>
            <boxGeometry args={[0.038, 0.002, 0.0006]} />
          </mesh>
        </group>
      )}

      {/* Metal release latch lever */}
      {!isBlueprint && (
        <mesh
          position={[-DRIVE_W / 2 + 0.016, 0, 0.0026]}
          material={metalLeverMaterial}
          castShadow
        >
          <boxGeometry args={[0.014, DRIVE_H - 0.004, 0.0015]} />
        </mesh>
      )}

      {/* Solid power LED (Turns red if disk failed) */}
      {!isBlueprint && (
        <mesh position={[DRIVE_W / 2 - 0.015, 0.002, 0.0026]} material={isFailed ? ledRed : ledSolidGreen}>
          <sphereGeometry args={[0.0012, 8, 8]} />
        </mesh>
      )}

      {/* Flickering Disk Activity LED */}
      {!isBlueprint && (
        <ActivityLED r={r} c={c} isFailed={isFailed} />
      )}

      {isBlueprint && (
        <SchematicBox
          width={DRIVE_W}
          height={DRIVE_H}
          depth={0.003}
          position={[0, 0, 0.001]}
        />
      )}
    </group>
  );
}

/**
 * A helper component that drives the flickering activity LED of an HDD caddy.
 * Keeps re-renders isolated to just the LED mesh itself.
 * If disk has failed, it blinks red rapidly instead of green activity flashes.
 */
function ActivityLED({ r, c, isFailed }: { r: number; c: number; isFailed: boolean }) {
  const ledRef = useRef<THREE.MeshStandardMaterial>(null);
  
  // Custom blinking speed coefficients based on row/column
  const freq = 12 + r * 5 + c * 4;
  const pulseOffset = r * 0.4 + c * 0.7;

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
      // Complex noise-like wave representing active reading
      const val = Math.sin(t * freq + pulseOffset) * Math.cos(t * (freq * 0.6)) + Math.sin(t * 2);
      const isLit = val > 0.4;
      
      if (isLit) {
        ledRef.current.color.set('#10b981');
        ledRef.current.emissive.set('#10b981');
        ledRef.current.emissiveIntensity = 1.5;
      } else {
        ledRef.current.emissiveIntensity = 0.0;
        ledRef.current.color.set('#064e3b');
      }
    }
  });

  return (
    <mesh position={[DRIVE_W / 2 - 0.008, 0.002, 0.0026]}>
      <sphereGeometry args={[0.0012, 8, 8]} />
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

interface NASProps {
  hardware: HardwareProps;
}

export function NAS({ hardware }: NASProps) {
  const RACK_UNITS = 2;
  const DEPTH = 0.55;

  const interaction = useHardwareInteraction({
    ...hardware,
    rackUnits: RACK_UNITS,
    depth: DEPTH,
  });

  const isBlueprint = useIsBlueprint();
  const chassisHeight = RACK_UNITS * RACK_UNIT_HEIGHT - EDGE_GAP;
  const zShift = 0.39 - DEPTH / 2;

  const totalGridW = DRIVE_COLS * DRIVE_W + (DRIVE_COLS - 1) * DRIVE_GAP_X;
  const totalGridH = DRIVE_ROWS * DRIVE_H + (DRIVE_ROWS - 1) * DRIVE_GAP_Y;

  // Position caddy grid centered-right on the front face
  const startX = -totalGridW / 2 + DRIVE_W / 2 + 0.05;
  const startY = -totalGridH / 2 + DRIVE_H / 2;
  const bezelFrontZ = 0.39 + 0.003;

  // Generate list of drive indexes
  const driveIndices = useMemo(() => {
    const list: Array<{ r: number; c: number; index: number }> = [];
    let driveCount = 0;
    for (let r = 0; r < DRIVE_ROWS; r++) {
      for (let c = 0; c < DRIVE_COLS; c++) {
        list.push({ r, c, index: driveCount++ });
      }
    }
    return list;
  }, []);

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
      <RackMountDetails height={chassisHeight} depth={DEPTH} isBlueprint={isBlueprint} />

      {/* Main chassis - shifted back */}
      <mesh
        position={[0, 0, zShift]}
        castShadow={!isBlueprint}
        receiveShadow={!isBlueprint}
        material={isBlueprint ? blueprintChassisMaterial : chassisMaterial}
      >
        <boxGeometry args={[CHASSIS_WIDTH, chassisHeight, DEPTH]} />
      </mesh>
      {isBlueprint && (
        <SchematicBox
          width={CHASSIS_WIDTH}
          height={chassisHeight}
          depth={DEPTH}
          position={[0, 0, zShift]}
        />
      )}

      {/* Front bezel */}
      <mesh
        position={[0, 0, 0.39 + 0.0015]}
        material={isBlueprint ? blueprintBezelMaterial : bezelMaterial}
      >
        <boxGeometry args={[CHASSIS_WIDTH - 0.02, chassisHeight, 0.003]} />
      </mesh>
      {isBlueprint && (
        <SchematicBox
          width={CHASSIS_WIDTH - 0.02}
          height={chassisHeight}
          depth={0.003}
          position={[0, 0, 0.39 + 0.0015]}
        />
      )}

      {/* Controller panel on the left bezel */}
      {!isBlueprint && (
        <group position={[-CHASSIS_WIDTH / 2 + 0.055, 0, bezelFrontZ]}>
          {/* Panel background recess */}
          <mesh>
            <boxGeometry args={[0.08, chassisHeight - 0.016, 0.0015]} />
            <meshStandardMaterial color="#070708" metalness={0.7} roughness={0.4} />
          </mesh>

          {/* Cyan OLED Display */}
          <group position={[-0.012, 0.012, 0.001]}>
            <mesh>
              <boxGeometry args={[0.045, 0.022, 0.001]} />
              <meshBasicMaterial color="#020202" />
            </mesh>
            <mesh position={[0, 0, 0.0006]} material={oledScreenMaterial}>
              <boxGeometry args={[0.04, 0.018, 0.0002]} />
            </mesh>
            {/* OLED simulated stats display */}
            <group position={[0, 0, 0.001]}>
              <mesh position={[-0.01, 0.004, 0]}>
                <boxGeometry args={[0.016, 0.002, 0.0001]} />
                <meshBasicMaterial color="#22d3ee" />
              </mesh>
              <mesh position={[-0.005, 0, 0]}>
                <boxGeometry args={[0.026, 0.002, 0.0001]} />
                <meshBasicMaterial color="#22d3ee" />
              </mesh>
              <mesh position={[0.002, -0.004, 0]}>
                <boxGeometry args={[0.032, 0.002, 0.0001]} />
                <meshBasicMaterial color="#22d3ee" />
              </mesh>
            </group>
          </group>

          {/* Power Button */}
          <group position={[0.024, 0.012, 0.001]}>
            <mesh material={metalLeverMaterial} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.0035, 0.0035, 0.002, 8]} />
            </mesh>
            <mesh position={[0, 0, 0.0012]} material={ledSolidGreen}>
              <sphereGeometry args={[0.0012, 8, 8]} />
            </mesh>
          </group>

          {/* Micro-USB Console Port */}
          <mesh position={[0.022, -0.014, 0.001]} material={usbPortMaterial}>
            <boxGeometry args={[0.007, 0.004, 0.002]} />
          </mesh>
          <mesh position={[0.022, -0.014, 0.0022]}>
            <boxGeometry args={[0.003, 0.0015, 0.0002]} />
            <meshBasicMaterial color="#020202" />
          </mesh>

          {/* System status LEDs */}
          <group position={[-0.015, -0.018, 0.001]}>
            <mesh position={[-0.008, 0, 0]} material={ledSolidGreen}>
              <sphereGeometry args={[0.0015, 8, 8]} />
            </mesh>
            <mesh position={[0.004, 0, 0]}>
              <sphereGeometry args={[0.0015, 8, 8]} />
              <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.2} />
            </mesh>
          </group>
        </group>
      )}

      {/* Render HDD Caddies */}
      {driveIndices.map(({ r, c, index }) => {
        const xPos = startX + c * (DRIVE_W + DRIVE_GAP_X);
        const yPos = startY + r * (DRIVE_H + DRIVE_GAP_Y);

        return (
          <HddBay
            key={index}
            index={index}
            r={r}
            c={c}
            xPos={xPos}
            yPos={yPos}
            bezelFrontZ={bezelFrontZ}
            depth={DEPTH}
            isBlueprint={isBlueprint}
            deviceId={hardware.id}
          />
        );
      })}

      {/* Selection outline */}
      {interaction.isSelected && (
        <SelectionOutline
          rackUnits={RACK_UNITS}
          depth={DEPTH}
          position={[0, 0, zShift]}
        />
      )}
    </group>
  );
}
