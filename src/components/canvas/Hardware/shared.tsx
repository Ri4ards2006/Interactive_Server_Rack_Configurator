/**
 * shared.tsx
 *
 * Hardware-level shared resources used by every chassis component
 * (Server, Switch, Router, PatchPanel). Anything that would otherwise
 * be a copy-pasted block across the four files lives here so that a
 * single change to e.g. the selection halo material updates them all
 * in lockstep.
 *
 * Included:
 *   - `selectionMaterial` + `SelectionOutline`: the cyan wireframe
 *     material + helper component for the selection halo.
 *   - `useIsBlueprint`: a Zustand selector hook returning whether
 *     the canvas is in `'blueprint'` mode. Used by every chassis to
 *     branch its PBR-vs-flat material choice.
 *   - `blueprintChassisMaterial` / `blueprintBezelMaterial` /
 *     `blueprintAccentMaterial`: flat `MeshBasicMaterial` palette
 *     shared by all four chassis components in blueprint mode.
 *   - `blueprintEdgeMaterial` + `SchematicBox`: a memoized edge-
 *     geometry overlay component that draws sharp cyan outlines
 *     around a chassis body in blueprint mode.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import {
  RACK_UNIT_HEIGHT,
  SELECTION_OUTLINE_INSET,
  SELECTION_OUTLINE_WIDTH,
} from '../../../store/useConfiguratorStore';
import { useConfiguratorStore } from '../../../store/useConfiguratorStore';

// -----------------------------------------------------------------------
// Selection halo (cyan wireframe box) — unchanged from original.
// -----------------------------------------------------------------------

// Cyan-400 wireframe halo. `depthTest: false` keeps the halo visible
// even when the chassis is partly occluded by the rack frame or other
// hardware, and the translucent wireframe reads as "interactive
// affordance" rather than a solid selection box.
export const selectionMaterial = new THREE.MeshBasicMaterial({
  color: '#22d3ee',
  wireframe: true,
  transparent: true,
  opacity: 0.55,
  depthTest: false,
});

interface SelectionOutlineProps {
  /** Vertical extent of the parent chassis, in rack units. */
  rackUnits: number;
  /** Depth of the parent chassis, in meters. */
  depth: number;
}

/**
 * Renders the cyan selection halo sized to match a chassis of the
 * given `rackUnits` × `depth`. Render order 999 keeps it visually on
 * top of other meshes; combined with the material's `depthTest: false`
 * this guarantees the halo never disappears behind the chassis body.
 */
export function SelectionOutline({ rackUnits, depth }: SelectionOutlineProps) {
  return (
    <mesh
      position={[0, 0, 0]}
      material={selectionMaterial}
      renderOrder={999}
    >
      <boxGeometry
        args={[
          SELECTION_OUTLINE_WIDTH,
          rackUnits * RACK_UNIT_HEIGHT + SELECTION_OUTLINE_INSET,
          depth + SELECTION_OUTLINE_INSET,
        ]}
      />
    </mesh>
  );
}

// -----------------------------------------------------------------------
// Blueprint mode — flat palette + wireframe outline overlay.
// -----------------------------------------------------------------------

/**
 * Selector hook — true iff the canvas is currently in `'blueprint'`
 * mode. Zustand returns a stable boolean for stable inputs so this
 * hook re-renders only when `viewMode` actually flips.
 */
export function useIsBlueprint(): boolean {
  return useConfiguratorStore((s) => s.viewMode === 'blueprint');
}

/**
 * Flat `MeshBasicMaterial` palette for blueprint mode. Module-scoped
 * so every chassis shares the same material instance, and switches
 * happen via reference assignment (a pure pointer swap in the
 * conditional inside each chassis component — no allocations on
 * `viewMode` flip, no per-frame re-mount).
 */
export const blueprintChassisMaterial = new THREE.MeshBasicMaterial({
  color: '#151515', // matches the rack-frame PBR chassis color
});

/**
 * Same colour as `blueprintChassisMaterial` but kept as a separate
 * instance so the swap in `RackFrame.tsx` reads symmetrically:
 * "rack-frame fill material" rather than "chassis material reused
 * for the frame". Allocated once at import time.
 */
export const blueprintFrameFillMaterial = new THREE.MeshBasicMaterial({
  color: '#151515',
});

export const blueprintBezelMaterial = new THREE.MeshBasicMaterial({
  color: '#050505', // matches the PBR bezel color, slightly darker
});

/**
 * Cyan flat-fill accent material used by Switch and Router for their
 * thin "company brand" stripe in the bezel area. Replaces the PBR
 * cyan accent (Switch) and amber accent (Router) with a unified
 * cyan flat fill so blueprint mode reads consistently: dark chassis
 * + flat accent + cyan edge wireframes + black outlines.
 */
export const blueprintAccentMaterial = new THREE.MeshBasicMaterial({
  color: '#22d3ee',
});

/**
 * Cyan-300 wireframe material specifically tuned for schematic
 * outlines. Pairs with `<SchematicBox>` to draw a 1-pixel-ish edge
 * stroke around a chassis body. Per-instance meshes can declare a
 * sibling `<SchematicBox>` and the geometry cache will be shared if
 * dimensions match.
 */
export const blueprintEdgeMaterial = new THREE.LineBasicMaterial({
  color: '#67e8f9',
});

interface SchematicBoxProps {
  /** Box width along X (meters). */
  width: number;
  /** Box height along Y (meters). */
  height: number;
  /** Box depth along Z (meters). */
  depth: number;
  /** Optional world-space position. Defaults to `[0, 0, 0]`. */
  position?: [number, number, number];
}

/**
 * Outline-only schematic renderer: a `<lineSegments>` overlay that
 * draws the box's edges as cyan strokes. Memoizes the
 * `EdgesGeometry` on dimensions so repeated renders don't allocate
 * and identical chassis (e.g. many 1U servers) share the same
 * geometry instance.
 *
 * Usage:
 *   ```
 *   <mesh material={chassisMat}>
 *     <boxGeometry args={[w, h, d]} />
 *   </mesh>
 *   <SchematicBox width={w} height={h} depth={d} />
 *   ```
 *
 * The optional `position` prop lets a chassis outline an
 * off-origin sub-mesh (e.g. the two PSU rectangles inside Router's
 * bezel area that aren't centred on the chassis origin).
 */
export function SchematicBox({
  width,
  height,
  depth,
  position = [0, 0, 0],
}: SchematicBoxProps) {
  const edges = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth)),
    [width, height, depth],
  );
  return (
    <lineSegments
      geometry={edges}
      material={blueprintEdgeMaterial}
      position={position}
    />
  );
}
