/**
 * Firewall.tsx
 *
 * 1U Next-Generation Firewall (NGFW) Security Gateway.
 * Rebuilt with high-fidelity detailing and aggressive styling:
 * - Aggressive red/dark polymer split bezel with diagonal vent grille styling.
 * - SFP+ cages designed as hollow metal cavities with dark recesses.
 * - RJ45 copper ports with tiny integrated indicator lights.
 * - Multi-segment status LED cluster (Power, HA, Status, Alarm, WAN, LAN) with glowing emissives.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  RACK_UNIT_HEIGHT,
  CHASSIS_WIDTH,
  EDGE_GAP,
} from '../../../store/useConfiguratorStore';
import type { HardwareProps } from '../../../types/rack.types';
import { Port } from './PatchCable';
import { useHardwareInteraction } from '../../../hooks/useHardwareInteraction';
import {
  SelectionOutline,
  SchematicBox,
  blueprintChassisMaterial,
  blueprintBezelMaterial,
  useIsBlueprint,
  RackMountDetails,
} from './shared';

// ---- Materials ------------------------------------------------------
const chassisMaterial = new THREE.MeshStandardMaterial({
  color: '#1a1a1c',
  metalness: 0.6,
  roughness: 0.55,
});

const darkBezelMaterial = new THREE.MeshStandardMaterial({
  color: '#080809',
  metalness: 0.8,
  roughness: 0.35,
});

const redBezelMaterial = new THREE.MeshStandardMaterial({
  color: '#991b1b', // Anodized aggressive deep red
  metalness: 0.8,
  roughness: 0.3,
});

const metalPortFrameMaterial = new THREE.MeshStandardMaterial({
  color: '#71717a', // Metallic port housing
  metalness: 0.95,
  roughness: 0.15,
});

const darkPortRecessMaterial = new THREE.MeshBasicMaterial({
  color: '#020202', // Black inner hollow area
});

const sfpCageMaterial = new THREE.MeshStandardMaterial({
  color: '#d4d4d8', // Shiny silver metal for SFP+ cages
  metalness: 0.95,
  roughness: 0.1,
});

const sfpLedGreen = new THREE.MeshStandardMaterial({
  color: '#10b981',
  emissive: '#10b981',
  emissiveIntensity: 1.2,
});

const sfpLedYellow = new THREE.MeshStandardMaterial({
  color: '#eab308',
  emissive: '#eab308',
  emissiveIntensity: 1.0,
});

const blueprintRedMaterial = new THREE.MeshBasicMaterial({
  color: '#7f1d1d', // flat deep red for blueprints
});

interface FirewallProps {
  hardware: HardwareProps;
}

export function Firewall({ hardware }: FirewallProps) {
  const RACK_UNITS = 1;
  const DEPTH = 0.3;

  const interaction = useHardwareInteraction({
    ...hardware,
    rackUnits: RACK_UNITS,
    depth: DEPTH,
  });

  const isBlueprint = useIsBlueprint();
  const chassisHeight = RACK_UNITS * RACK_UNIT_HEIGHT - EDGE_GAP;
  const zShift = 0.39 - DEPTH / 2;

  // Front bezel coordinates
  const bezelFrontZ = 0.39 + 0.003;

  // Port and SFP arrays for clean rendering
  const copperPorts = [
    { id: 1, x: -0.06 }, { id: 2, x: -0.046 },
    { id: 3, x: -0.032 }, { id: 4, x: -0.018 },
    { id: 5, x: 0.002 }, { id: 6, x: 0.016 },
    { id: 7, x: 0.030 }, { id: 8, x: 0.044 }
  ];

  const sfpPorts = [
    { id: 1, x: 0.076 },
    { id: 2, x: 0.092 },
    { id: 3, x: 0.108 },
    { id: 4, x: 0.124 }
  ];

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

      {/* Front Bezel Base (Dark carbon/zinc background) */}
      <mesh
        position={[0, 0, 0.39 + 0.0015]}
        material={isBlueprint ? blueprintBezelMaterial : darkBezelMaterial}
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

      {/* Aggressive Red Accents (V-shape or angled side panels on the front bezel) */}
      {!isBlueprint && (
        <group position={[0, 0, 0.39 + 0.002]}>
          {/* Left Red wing */}
          <mesh position={[-0.175, 0, 0.001]} castShadow>
            <boxGeometry args={[0.06, chassisHeight - 0.006, 0.002]} />
            <meshStandardMaterial {...redBezelMaterial} />
          </mesh>
          {/* Right Red wing */}
          <mesh position={[0.175, 0, 0.001]} castShadow>
            <boxGeometry args={[0.06, chassisHeight - 0.006, 0.002]} />
            <meshStandardMaterial {...redBezelMaterial} />
          </mesh>

          {/* Aggressive ventilation vents (dark slashes on red wings) */}
          <group position={[-0.175, 0, 0.0022]}>
            <mesh rotation={[0, 0, Math.PI / 4]}>
              <boxGeometry args={[0.015, 0.002, 0.0005]} />
              <meshBasicMaterial color="#020202" />
            </mesh>
            <mesh position={[0, 0.008, 0]} rotation={[0, 0, Math.PI / 4]}>
              <boxGeometry args={[0.015, 0.002, 0.0005]} />
              <meshBasicMaterial color="#020202" />
            </mesh>
            <mesh position={[0, -0.008, 0]} rotation={[0, 0, Math.PI / 4]}>
              <boxGeometry args={[0.015, 0.002, 0.0005]} />
              <meshBasicMaterial color="#020202" />
            </mesh>
          </group>

          <group position={[0.175, 0, 0.0022]}>
            <mesh rotation={[0, 0, -Math.PI / 4]}>
              <boxGeometry args={[0.015, 0.002, 0.0005]} />
              <meshBasicMaterial color="#020202" />
            </mesh>
            <mesh position={[0, 0.008, 0]} rotation={[0, 0, -Math.PI / 4]}>
              <boxGeometry args={[0.015, 0.002, 0.0005]} />
              <meshBasicMaterial color="#020202" />
            </mesh>
            <mesh position={[0, -0.008, 0]} rotation={[0, 0, -Math.PI / 4]}>
              <boxGeometry args={[0.015, 0.002, 0.0005]} />
              <meshBasicMaterial color="#020202" />
            </mesh>
          </group>
        </group>
      )}

      {isBlueprint && (
        <mesh position={[-0.175, 0, 0.39 + 0.002]}>
          <boxGeometry args={[0.06, chassisHeight - 0.006, 0.002]} />
          <meshBasicMaterial color="#7f1d1d" />
        </mesh>
      )}
      {isBlueprint && (
        <mesh position={[0.175, 0, 0.39 + 0.002]}>
          <boxGeometry args={[0.06, chassisHeight - 0.006, 0.002]} />
          <meshBasicMaterial color="#7f1d1d" />
        </mesh>
      )}

      {/* Front Panel Details (Ports, LEDs) */}
      {!isBlueprint && (
        <group position={[0, 0, bezelFrontZ]}>
          
          {/* Section 1: Detailed Status LED Cluster (Left bezel area) */}
          <group position={[-0.125, 0, 0.001]}>
            {/* Status Panel Label Background */}
            <mesh>
              <boxGeometry args={[0.035, chassisHeight - 0.012, 0.001]} />
              <meshStandardMaterial color="#0c0c0e" metalness={0.7} roughness={0.3} />
            </mesh>

            {/* PWR LED (Green) */}
            <mesh position={[-0.01, 0.012, 0.0008]}>
              <sphereGeometry args={[0.0015, 8, 8]} />
              <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1.2} />
            </mesh>
            {/* HA Status LED (Yellow) */}
            <mesh position={[-0.01, 0.004, 0.0008]}>
              <sphereGeometry args={[0.0015, 8, 8]} />
              <meshStandardMaterial color="#eab308" emissive="#eab308" emissiveIntensity={1.0} />
            </mesh>
            {/* Status/Active LED (Green) */}
            <mesh position={[-0.01, -0.004, 0.0008]}>
              <sphereGeometry args={[0.0015, 8, 8]} />
              <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.8} />
            </mesh>
            {/* ALARM LED (Aggressive Blinking Red) */}
            <AlarmLED />
            
            {/* Right column of LEDs in cluster */}
            {/* WAN LED (Blue) */}
            <mesh position={[0.008, 0.012, 0.0008]}>
              <sphereGeometry args={[0.0015, 8, 8]} />
              <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={1.0} />
            </mesh>
            {/* LAN LED (Green) */}
            <mesh position={[0.008, 0.004, 0.0008]}>
              <sphereGeometry args={[0.0015, 8, 8]} />
              <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.8} />
            </mesh>
            {/* SFP+ Active LED (Green) */}
            <mesh position={[0.008, -0.004, 0.0008]}>
              <sphereGeometry args={[0.0015, 8, 8]} />
              <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.8} />
            </mesh>
            {/* VPN Link LED (Green) */}
            <mesh position={[0.008, -0.012, 0.0008]}>
              <sphereGeometry args={[0.0015, 8, 8]} />
              <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.8} />
            </mesh>
          </group>

          {/* Section 2: Copper RJ45 ports (Center region) */}
          <group position={[-0.01, -0.002, 0.0015]}>
            {copperPorts.map((port) => (
              <group key={port.id} position={[port.x, 0, 0]}>
                {/* Port metallic outer housing */}
                <mesh castShadow>
                  <boxGeometry args={[0.011, 0.009, 0.003]} />
                  <meshStandardMaterial {...metalPortFrameMaterial} />
                </mesh>
                {/* Port inner hollow cavity */}
                <mesh position={[0, 0, 0.001]} material={darkPortRecessMaterial}>
                  <boxGeometry args={[0.009, 0.007, 0.0012]} />
                </mesh>
                {/* Tiny orange/green LED pins on top corners of the port */}
                <mesh position={[-0.0035, 0.0036, 0.0016]}>
                  <boxGeometry args={[0.0015, 0.001, 0.0005]} />
                  <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1.0} />
                </mesh>
                <mesh position={[0.0035, 0.0036, 0.0016]}>
                  <boxGeometry args={[0.0015, 0.001, 0.0005]} />
                  <meshStandardMaterial
                    color="#f97316"
                    emissive="#f97316"
                    emissiveIntensity={port.id % 3 === 0 ? 0.0 : 0.8} // Blinking or steady state
                  />
                </mesh>
              </group>
            ))}
          </group>

          {/* Section 3: Hollow SFP+ Slots (Right-center region) */}
          <group position={[0, -0.002, 0.0015]}>
            {sfpPorts.map((port) => (
              <group key={port.id} position={[port.x, 0, 0]}>
                {/* Outer SFP+ Cage frame */}
                <mesh castShadow>
                  <boxGeometry args={[0.013, 0.011, 0.004]} />
                  <meshStandardMaterial {...sfpCageMaterial} />
                </mesh>
                {/* Hollow connector cavity */}
                <mesh position={[0, 0, 0.0012]} material={darkPortRecessMaterial}>
                  <boxGeometry args={[0.011, 0.009, 0.002]} />
                </mesh>
                {/* Gold connector pins inside the hollow cavity */}
                <mesh position={[0, -0.0035, 0.0006]}>
                  <boxGeometry args={[0.008, 0.001, 0.0015]} />
                  <meshStandardMaterial color="#d97706" metalness={0.9} roughness={0.1} />
                </mesh>
                {/* Active LED for SFP+ Slot */}
                <mesh position={[0, 0.007, -0.0005]} material={port.id % 2 === 0 ? sfpLedGreen : sfpLedYellow}>
                  <sphereGeometry args={[0.001, 8, 8]} />
                </mesh>
              </group>
            ))}
          </group>

          {/* Section 4: Local Console port (Right end) */}
          <group position={[0.145, -0.002, 0.0015]}>
            {/* RJ45 Console Port */}
            <mesh castShadow>
              <boxGeometry args={[0.011, 0.009, 0.003]} />
              <meshStandardMaterial color="#3b82f6" metalness={0.5} roughness={0.4} /> {/* Blue console port color */}
            </mesh>
            <mesh position={[0, 0, 0.001]} material={darkPortRecessMaterial}>
              <boxGeometry args={[0.009, 0.007, 0.0012]} />
            </mesh>
          </group>

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

/**
 * Isolated Alarm LED to blink red dynamically.
 */
function AlarmLED() {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    const t = clock.getElapsedTime();
    // Quick blink: 3 times per second
    const isLit = Math.floor(t * 5.0) % 2 === 0;
    matRef.current.emissiveIntensity = isLit ? 1.6 : 0.1;
  });

  return (
    <mesh position={[-0.01, -0.012, 0.0008]}>
      <sphereGeometry args={[0.0015, 8, 8]} />
      <meshStandardMaterial
        ref={matRef}
        color="#dc2626"
        emissive="#dc2626"
        emissiveIntensity={0.1}
        roughness={0.1}
      />
    </mesh>
  );
}
