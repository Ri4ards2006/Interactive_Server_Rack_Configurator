/**
 * ThermalHeatmapOverlay.tsx
 *
 * 3D Thermal visualizer for R3F Canvas:
 * - Color-coded inlet front & exhaust rear heatmaps per chassis
 * - Visual hot-air recirculation bypass highlights on unblanked U-slots
 * - Thermal exhaust plume volume rendering in hot aisle
 * - 3D Thermal Legend & temperature callouts
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import {
  useConfiguratorStore,
  RACK_UNIT_HEIGHT,
  CHASSIS_WIDTH,
  EDGE_GAP,
} from '../../../store/useConfiguratorStore';
import {
  evaluateRackThermal,
  getThermalColor,
} from '../../../utils/thermalCalculations';
import type { RackInstance } from '../../../types/rack.types';

export function RackThermalVisualizer({ rack }: { rack: RackInstance }) {
  const ambientTemperatureC = useConfiguratorStore((s) => s.ambientTemperatureC);

  const report = useMemo(() => {
    return evaluateRackThermal(rack.installedHardware, {
      rackId: rack.id,
      capacity: rack.capacity,
      ambientColdAisleTempC: ambientTemperatureC,
    });
  }, [rack.installedHardware, rack.id, rack.capacity, ambientTemperatureC]);

  return (
    <group position={rack.position}>
      {/* 1. Chassis Inlet & Exhaust Thermal Overlays */}
      {report.chassisThermals.map((ct) => {
        const hardware = rack.installedHardware.find((h) => h.id === ct.hardwareId);
        if (!hardware) return null;

        const height = hardware.rackUnits * RACK_UNIT_HEIGHT - EDGE_GAP;
        const [hx, hy, hz] = hardware.position;
        const frontZ = 0.392;
        const rearZ = 0.39 - hardware.depth - 0.002;
        const zMid = 0.39 - hardware.depth / 2;

        const inletColor = getThermalColor(ct.inletTempC);
        const exhaustColor = getThermalColor(ct.exhaustTempC);

        return (
          <group key={ct.hardwareId} position={[hx, hy, hz]}>
            {/* Front Inlet Heatmap Face */}
            <mesh position={[0, 0, frontZ]}>
              <planeGeometry args={[CHASSIS_WIDTH, height]} />
              <meshBasicMaterial
                color={inletColor}
                transparent
                opacity={0.65}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Rear Exhaust Heatmap Face */}
            <mesh position={[0, 0, rearZ]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[CHASSIS_WIDTH, height]} />
              <meshBasicMaterial
                color={exhaustColor}
                transparent
                opacity={0.75}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Floating Temperature Tooltip on Chassis Front */}
            <Html
              position={[0, 0, frontZ + 0.02]}
              center
              distanceFactor={3}
              className="pointer-events-none select-none"
            >
              <div
                className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold whitespace-nowrap shadow-md border backdrop-blur-sm"
                style={{
                  backgroundColor: `${inletColor}25`,
                  borderColor: inletColor,
                  color: '#ffffff',
                }}
              >
                {ct.inletTempC}°C → {ct.exhaustTempC}°C
              </div>
            </Html>

            {/* Thermal Throttling Warning Halo */}
            {ct.isThermalThrottling && (
              <mesh position={[0, 0, zMid]}>
                <boxGeometry args={[CHASSIS_WIDTH + 0.02, height + 0.01, hardware.depth + 0.02]} />
                <meshBasicMaterial
                  color="#ef4444"
                  wireframe
                  transparent
                  opacity={0.8}
                />
              </mesh>
            )}
          </group>
        );
      })}

      {/* 2. Hot-Air Recirculation Gaps (Open unblanked U-slots) */}
      {report.uGradients.map((uSlot) => {
        if (uSlot.isOccupied || uSlot.isCoveredByBlank) return null;
        const y = (uSlot.uSlot - 0.5) * RACK_UNIT_HEIGHT;
        const height = RACK_UNIT_HEIGHT - 0.002;

        return (
          <group key={`gap-${uSlot.uSlot}`} position={[0, y, 0]}>
            {/* Front open bypass mesh */}
            <mesh position={[0, 0, 0.39]}>
              <planeGeometry args={[CHASSIS_WIDTH, height]} />
              <meshBasicMaterial
                color="#f59e0b"
                transparent
                opacity={0.3}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Rear open bypass mesh */}
            <mesh position={[0, 0, -0.39]}>
              <planeGeometry args={[CHASSIS_WIDTH, height]} />
              <meshBasicMaterial
                color="#ef4444"
                transparent
                opacity={0.35}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        );
      })}

      {/* 3. Rear Hot Aisle Exhaust Plume Volume */}
      <mesh position={[0, (rack.capacity * RACK_UNIT_HEIGHT) / 2, -0.6]}>
        <boxGeometry args={[0.55, rack.capacity * RACK_UNIT_HEIGHT, 0.35]} />
        <meshBasicMaterial
          color={getThermalColor(report.maxExhaustTempC)}
          transparent
          opacity={0.12}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function ThermalHeatmapOverlay() {
  const viewMode = useConfiguratorStore((s) => s.viewMode);
  const racks = useConfiguratorStore(useShallow((s) => s.racks));

  if (viewMode !== 'thermal') return null;

  return (
    <group name="ThermalHeatmapOverlay">
      {racks.map((rack) => (
        <RackThermalVisualizer key={rack.id} rack={rack} />
      ))}
    </group>
  );
}
