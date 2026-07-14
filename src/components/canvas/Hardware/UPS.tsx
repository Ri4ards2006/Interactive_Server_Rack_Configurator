/**
 * UPS.tsx
 *
 * 2U Uninterruptible Power Supply (UPS) chassis.
 * Rebuilt with high-fidelity detailing including hot-swap battery bays,
 * glowing yellow-green status LCD, heavy duty toggle controls, and venting details.
 */

import * as THREE from 'three';
import {
  RACK_UNIT_HEIGHT,
  CHASSIS_WIDTH,
  EDGE_GAP,
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

// ---- Materials ------------------------------------------------------
const chassisMaterial = new THREE.MeshStandardMaterial({
  color: '#18181b', // Dark zinc color
  metalness: 0.7,
  roughness: 0.5,
});

const bezelMaterial = new THREE.MeshStandardMaterial({
  color: '#09090b', // Deep zinc black
  metalness: 0.8,
  roughness: 0.3,
});

const metalGripMaterial = new THREE.MeshStandardMaterial({
  color: '#52525b', // Brushed nickel/silver
  metalness: 0.9,
  roughness: 0.25,
});

const batteryBayFaceMaterial = new THREE.MeshStandardMaterial({
  color: '#111113', // Slightly different matte finish for contrast
  metalness: 0.4,
  roughness: 0.6,
});

const batteryBayVentMaterial = new THREE.MeshStandardMaterial({
  color: '#020202', // Vent shadow
  metalness: 0.1,
  roughness: 0.9,
});

// Emissive LCD display
const lcdDisplayMaterial = new THREE.MeshStandardMaterial({
  color: '#4d7c0f', // Base dark olive green
  emissive: '#84cc16', // Glowing lime green
  emissiveIntensity: 1.6,
  roughness: 0.1,
  metalness: 0.2,
});

const lcdGlassMaterial = new THREE.MeshStandardMaterial({
  color: '#052e16',
  transparent: true,
  opacity: 0.4,
  roughness: 0.05,
});

const powerBtnMaterial = new THREE.MeshStandardMaterial({
  color: '#ef4444', // Red power switch
  emissive: '#991b1b',
  emissiveIntensity: 0.4,
  metalness: 0.2,
  roughness: 0.4,
});

interface UPSProps {
  hardware: HardwareProps;
}

export function UPS({ hardware }: UPSProps) {
  const interaction = useHardwareInteraction(hardware);
  const isBlueprint = useIsBlueprint();

  const RACK_UNITS = 2;
  const DEPTH = 0.6;
  const chassisHeight = RACK_UNITS * RACK_UNIT_HEIGHT - EDGE_GAP;
  const zShift = 0.39 - DEPTH / 2;

  // Front panel layout coordinates (relative to bezel)
  const bezelFrontZ = 0.39 + 0.003;

  // Battery bays coordinates (left-to-center region)
  const batteryBays = [
    { id: 0, x: -0.145, status: 'ok' },
    { id: 1, x: -0.075, status: 'ok' },
    { id: 2, x: -0.005, status: 'ok' },
    { id: 3, x: 0.065, status: 'warning' }, // Visual storytelling: one bay is degraded
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

      {/* Main chassis body - shifted back */}
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

      {/* Front Bezel */}
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

      {/* High-fidelity Front Panel Details (LCD, Battery Bays, Buttons) */}
      {!isBlueprint && (
        <group position={[0, 0, bezelFrontZ]}>
          
          {/* Section 1: 4 Hot-Swap Battery Bays */}
          {batteryBays.map((bay) => (
            <group key={bay.id} position={[bay.x, 0, 0.001]}>
              {/* Outer slot housing */}
              <mesh castShadow>
                <boxGeometry args={[0.064, chassisHeight - 0.016, 0.002]} />
                <meshStandardMaterial color="#1f1f23" roughness={0.7} metalness={0.5} />
              </mesh>

              {/* Recessed bay face */}
              <mesh position={[0, 0, 0.001]} material={batteryBayFaceMaterial}>
                <boxGeometry args={[0.06, chassisHeight - 0.02, 0.001]} />
              </mesh>

              {/* Indicated battery vent slots (horizontal cutouts) */}
              <group position={[0, 0.015, 0.0012]}>
                <mesh material={batteryBayVentMaterial} position={[0, 0, 0]}>
                  <boxGeometry args={[0.045, 0.003, 0.0005]} />
                </mesh>
                <mesh material={batteryBayVentMaterial} position={[0, -0.006, 0]}>
                  <boxGeometry args={[0.045, 0.003, 0.0005]} />
                </mesh>
                <mesh material={batteryBayVentMaterial} position={[0, -0.012, 0]}>
                  <boxGeometry args={[0.045, 0.003, 0.0005]} />
                </mesh>
              </group>

              {/* Sled Grip Handle */}
              <mesh position={[0, -0.018, 0.003]} material={metalGripMaterial} castShadow>
                <boxGeometry args={[0.035, 0.004, 0.004]} />
              </mesh>
              {/* Left and right handle mounts */}
              <mesh position={[-0.016, -0.018, 0.001]} material={metalGripMaterial}>
                <boxGeometry args={[0.003, 0.004, 0.004]} />
              </mesh>
              <mesh position={[0.016, -0.018, 0.001]} material={metalGripMaterial}>
                <boxGeometry args={[0.003, 0.004, 0.004]} />
              </mesh>

              {/* Tiny Status LED for Battery Cartridge */}
              <mesh position={[-0.022, 0.028, 0.0015]}>
                <sphereGeometry args={[0.0018, 8, 8]} />
                <meshStandardMaterial
                  color={bay.status === 'ok' ? '#10b981' : '#f59e0b'}
                  emissive={bay.status === 'ok' ? '#10b981' : '#f59e0b'}
                  emissiveIntensity={1.2}
                />
              </mesh>
            </group>
          ))}

          {/* Section 2: UPS Controller Interface (on the right) */}
          <group position={[0.14, 0, 0.001]}>
            {/* Control panel background area */}
            <mesh>
              <boxGeometry args={[0.11, chassisHeight - 0.016, 0.002]} />
              <meshStandardMaterial color="#0b0b0d" metalness={0.75} roughness={0.4} />
            </mesh>

            {/* Glowing Yellow-Green LCD screen */}
            <group position={[-0.015, 0.01, 0.0015]}>
              {/* LCD Frame */}
              <mesh>
                <boxGeometry args={[0.068, 0.038, 0.001]} />
                <meshStandardMaterial color="#1e1b4b" metalness={0.8} roughness={0.3} />
              </mesh>
              {/* LCD Screen itself */}
              <mesh position={[0, 0, 0.0006]} material={lcdDisplayMaterial}>
                <boxGeometry args={[0.062, 0.032, 0.0005]} />
              </mesh>
              
              {/* Simulated pixels/lines on screen (voltage, charge bars) */}
              <group position={[0, 0, 0.0012]}>
                {/* Voltage text box */}
                <mesh position={[-0.015, 0.006, 0]}>
                  <boxGeometry args={[0.02, 0.003, 0.0002]} />
                  <meshBasicMaterial color="#3f6212" />
                </mesh>
                <mesh position={[-0.015, 0, 0]}>
                  <boxGeometry args={[0.022, 0.003, 0.0002]} />
                  <meshBasicMaterial color="#3f6212" />
                </mesh>

                {/* Battery percentage level bar indicator (simulated blocks) */}
                <mesh position={[0.015, 0.006, 0]}>
                  <boxGeometry args={[0.018, 0.004, 0.0002]} />
                  <meshBasicMaterial color="#1e3a1e" />
                </mesh>
                <mesh position={[0.015, 0.001, 0]}>
                  <boxGeometry args={[0.018, 0.004, 0.0002]} />
                  <meshBasicMaterial color="#3f6212" />
                </mesh>
                <mesh position={[0.015, -0.004, 0]}>
                  <boxGeometry args={[0.018, 0.004, 0.0002]} />
                  <meshBasicMaterial color="#3f6212" />
                </mesh>
              </group>

              {/* Protective glass reflection panel overlay */}
              <mesh position={[0, 0, 0.0018]} material={lcdGlassMaterial}>
                <boxGeometry args={[0.062, 0.032, 0.0002]} />
              </mesh>
            </group>

            {/* Heavy-duty power switch */}
            <group position={[0.035, -0.016, 0.0015]}>
              {/* Button bezel */}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.007, 0.007, 0.002, 16]} />
                <meshStandardMaterial color="#27272a" metalness={0.8} roughness={0.3} />
              </mesh>
              {/* Power button plunger */}
              <mesh position={[0, 0, 0.001]} rotation={[Math.PI / 2, 0, 0]} material={powerBtnMaterial}>
                <cylinderGeometry args={[0.005, 0.005, 0.002, 16]} />
              </mesh>
            </group>

            {/* General system status LEDs */}
            <group position={[-0.035, -0.018, 0.0015]}>
              {/* Online LED */}
              <mesh position={[-0.01, 0, 0]}>
                <sphereGeometry args={[0.0018, 8, 8]} />
                <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1.2} />
              </mesh>
              {/* Bypass/Alert LED */}
              <mesh position={[0.005, 0, 0]}>
                <sphereGeometry args={[0.0018, 8, 8]} />
                <meshStandardMaterial color="#d97706" emissive="#d97706" emissiveIntensity={0.2} />
              </mesh>
              {/* Fault LED */}
              <mesh position={[0.02, 0, 0]}>
                <sphereGeometry args={[0.0018, 8, 8]} />
                <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={0.0} />
              </mesh>
            </group>
          </group>

        </group>
      )}

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
