/**
 * CableMesh.tsx
 *
 * 3D TubeGeometry renderer for installed patch cables.
 * Supports:
 * - Medium-specific tube thickness and jacket PBR shaders (Cat6, OM4, DAC)
 * - Blueprint CAD mode flat renderers
 * - Interactive selection and hover deletion pill
 * - Real-time bend radius violation warning shader
 * - Modular connector plug terminations (RJ45, LC Duplex, SFP+)
 */

import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import { useConfiguratorStore } from '../../../store/useConfiguratorStore';
import type { CableProps, HardwareProps } from '../../../types/rack.types';
import {
  calculateCableCurve,
  getCableMediumSpec,
  getPortWorldPosition,
} from '../../../utils/cableGeometry';
import { useIsBlueprint } from '../Hardware/shared';
import { ConnectorPlug } from './ConnectorPlugs';

interface CableMeshProps {
  cable: CableProps;
}

export function CableMesh({ cable }: CableMeshProps) {
  const [hovered, setHovered] = useState(false);
  const isBlueprint = useIsBlueprint();

  const {
    installedHardware,
    selectedCableId,
    selectCable,
    selectHardware,
    removeCable,
  } = useConfiguratorStore(
    useShallow((s) => ({
      installedHardware: s.installedHardware,
      selectedCableId: s.selectedCableId,
      selectCable: s.selectCable,
      selectHardware: s.selectHardware,
      removeCable: s.removeCable,
    })),
  );

  const fromDev = useMemo(
    () => installedHardware.find((h) => h.id === cable.fromDevice),
    [installedHardware, cable.fromDevice],
  );
  const toDev = useMemo(
    () => installedHardware.find((h) => h.id === cable.toDevice),
    [installedHardware, cable.toDevice],
  );

  const p1 = useMemo(
    () => (fromDev ? getPortWorldPosition(fromDev, cable.fromPort) : null),
    [fromDev, cable.fromPort],
  );
  const p2 = useMemo(
    () => (toDev ? getPortWorldPosition(toDev, cable.toPort) : null),
    [toDev, cable.toPort],
  );

  const spec = useMemo(
    () => getCableMediumSpec(cable.type || 'copper-cat6'),
    [cable.type],
  );

  const curveData = useMemo(() => {
    if (!p1 || !p2) return null;
    return calculateCableCurve(p1, p2, cable.type || 'copper-cat6');
  }, [p1, p2, cable.type]);

  if (!p1 || !p2 || !curveData) return null;

  const isSelected = selectedCableId === cable.id;
  const isViolating = curveData.evaluation.hasBendViolation;
  const radius = spec.outerDiameterMm / 2000; // millimeters to radius in meters

  // Center point along the curve for the floating Html badge
  const midPoint = curveData.curve.getPoint(0.5);

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    selectCable(cable.id);
    selectHardware(null);
  };

  return (
    <group>
      {/* Terminating Connector Plugs */}
      <ConnectorPlug type={spec.plugType} position={p1} color={cable.color} />
      <ConnectorPlug type={spec.plugType} position={p2} color={cable.color} />

      {/* Main 3D Cable Tube */}
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
        onPointerDown={handlePointerDown}
      >
        <tubeGeometry args={[curveData.curve, 48, radius, 8, false]} />
        {isBlueprint ? (
          <meshBasicMaterial
            color={isSelected ? '#22d3ee' : isViolating ? '#ef4444' : cable.color}
          />
        ) : (
          <meshStandardMaterial
            color={isViolating ? '#ef4444' : cable.color}
            roughness={spec.jacketRoughness}
            metalness={spec.jacketMetalness}
            emissive={
              isSelected
                ? '#06b6d4'
                : isViolating
                ? '#dc2626'
                : hovered
                ? cable.color
                : '#000000'
            }
            emissiveIntensity={isSelected ? 0.6 : isViolating ? 0.8 : hovered ? 0.3 : 0}
          />
        )}
      </mesh>

      {/* Selection / Warning Highlight Halo */}
      {(isSelected || isViolating) && (
        <mesh>
          <tubeGeometry args={[curveData.curve, 48, radius * 1.6, 6, false]} />
          <meshBasicMaterial
            color={isViolating ? '#ef4444' : '#22d3ee'}
            wireframe
            transparent
            opacity={0.4}
            depthTest={false}
          />
        </mesh>
      )}

      {/* Hover / Selection Interactive Floating Pill */}
      {(hovered || isSelected) && (
        <Html position={[midPoint.x, midPoint.y + 0.03, midPoint.z]} center>
          <div className="flex items-center gap-1.5 bg-zinc-950/95 border border-zinc-700 text-zinc-100 px-2 py-1 rounded shadow-xl text-[10px] font-mono whitespace-nowrap pointer-events-auto backdrop-blur-sm select-none">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: cable.color }}
            />
            <span className="font-bold text-zinc-200">{spec.shortLabel}</span>
            <span className="text-zinc-400">({curveData.evaluation.lengthMeters}m)</span>

            {isViolating && (
              <span className="text-red-400 font-bold ml-0.5" title="Bend radius violated!">
                ⚠️ BEND
              </span>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                removeCable(cable.id);
              }}
              title="Delete Patch Cable"
              className="ml-1 px-1.5 py-0.5 bg-red-950/80 hover:bg-red-800 border border-red-600/40 text-red-200 hover:text-white rounded cursor-pointer transition-all active:scale-95 text-[9px]"
            >
              ✕ UNPATCH
            </button>
          </div>
        </Html>
      )}
    </group>
  );
}

