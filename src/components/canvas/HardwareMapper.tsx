/**
 * HardwareMapper.tsx
 *
 * Dynamically resolves and renders each installed hardware item
 * by querying the extensible HardwareRegistry.
 *
 * Architectural notes:
 * - Decoupled from hardcoded switch statements.
 * - Supports dynamic runtime registration of new hardware plugins.
 * - Provides safe fallback rendering for unmapped / experimental hardware.
 */

import { useShallow } from 'zustand/react/shallow';
import { useConfiguratorStore, RACK_UNIT_HEIGHT, CHASSIS_WIDTH, EDGE_GAP } from '../../store/useConfiguratorStore';
import type { HardwareProps } from '../../types/rack.types';
import { hardwareRegistry } from '../../utils/hardwareRegistry';
import { useHardwareInteraction } from '../../hooks/useHardwareInteraction';
import { SelectionOutline, SchematicBox, blueprintChassisMaterial, useIsBlueprint, RackMountDetails } from './Hardware/shared';
import * as THREE from 'three';

const fallbackMaterial = new THREE.MeshStandardMaterial({
  color: '#3f3f46',
  metalness: 0.5,
  roughness: 0.5,
});

/**
 * Universal fallback renderer for custom or unregistered plugins.
 */
function GenericFallbackHardware({ hardware }: { hardware: HardwareProps }) {
  const interaction = useHardwareInteraction(hardware);
  const isBlueprint = useIsBlueprint();
  const height = hardware.rackUnits * RACK_UNIT_HEIGHT - EDGE_GAP;
  const zShift = 0.39 - hardware.depth / 2;

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
      <RackMountDetails height={height} depth={hardware.depth} isBlueprint={isBlueprint} />
      <mesh
        position={[0, 0, zShift]}
        castShadow={!isBlueprint}
        receiveShadow={!isBlueprint}
        material={isBlueprint ? blueprintChassisMaterial : fallbackMaterial}
      >
        <boxGeometry args={[CHASSIS_WIDTH, height, hardware.depth]} />
      </mesh>
      {isBlueprint && (
        <SchematicBox width={CHASSIS_WIDTH} height={height} depth={hardware.depth} position={[0, 0, zShift]} />
      )}
      {interaction.isSelected && (
        <SelectionOutline rackUnits={hardware.rackUnits} depth={hardware.depth} position={[0, 0, zShift]} />
      )}
    </group>
  );
}

export function HardwareMapper() {
  const installedHardware = useConfiguratorStore(
    useShallow((s) => s.installedHardware),
  );

  return (
    <>
      {installedHardware.map((h: HardwareProps) => {
        const Component = hardwareRegistry.getRenderer(h.type);
        if (Component) {
          return <Component key={h.id} hardware={h} />;
        }
        return <GenericFallbackHardware key={h.id} hardware={h} />;
      })}
    </>
  );
}
