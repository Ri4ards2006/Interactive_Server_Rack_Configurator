/**
 * RackLabels.tsx
 *
 * Renders U1..U42 markers along the rack's inner rails. Visible
 * ONLY in `viewMode === 'blueprint'` — in 3D mode they'd smother
 * the chassis with floating text and add no value.
 *
 * Implementation notes
 * --------------------
 * - 42 markers per rail × 2 rails = 84 `<Text>` instances from drei.
 *   Drei's `<Text>` is backed by troika SDF rendering — fast at this
 *   scale, sharp at any zoom level, no atlas baking required.
 * - Each label sits at its slot's vertical centre (`(u - 0.5) * U`).
 *   At slot-centre, the label reads as "this is the centre of U_n"
 *   — a more conventional schematic annotation than placing labels
 *   at slot TOP edges (the convention many photos use is "U_n marks
 *   the slot below it", which is harder to scan when reading top
 *   to bottom).
 * - Black outline (`outlineWidth: 0.005`) provides a high-contrast
 *   halo so labels stay readable against bright wireframe edges
 *   crossing directly behind them — crucial in blueprint mode where
 *   the chassis's cyan edges would otherwise drown a plain white
 *   label in visual noise.
 * - No rotation: both rails render labels facing the front so the
 *   camera (which is z-aligned in blueprint mode) reads both sides
 *   left-to-right normally. There's a minor visual repeating-
 *   text aesthetic on the left rail, but readable beats pretty here.
 */

import { Text } from '@react-three/drei';
import {
  RACK_UNIT_HEIGHT,
  useConfiguratorStore,
} from '../../../store/useConfiguratorStore';
import { useIsBlueprint } from '../Hardware/shared';

// Distance from rack centre to each rail — matches RackScrews so the
// label column visually aligns with the screws anchoring each U-slot.
const RAIL_X = 0.27;
// Slightly forward of the rail's z so the label doesn't z-fight the
// post-mesh that lives at z ≈ 0.36.
const LABEL_OFFSET_Z = 0.39;
// 0.025 ≈ 25 mm at scene scale. Crisp at the default 1.4 m camera
// distance and still readable when zoomed in.
const FONT_SIZE = 0.025;

export function RackLabels() {
  const isBlueprint = useIsBlueprint();
  const capacity = useConfiguratorStore((s) => s.capacity);

  // Hide entirely in 3D mode — blueprint is where labels earn their
  // keep. They dominate the realistic view and add no value there.
  if (!isBlueprint) return null;

  // Build 42 × 2 label array. Each label is its own `<Text>` so drei
  // can sort + GPU-upload them independently; troika handles batching
  // internally.
  const labels = [];
  for (let u = 1; u <= capacity; u++) {
    const y = (u - 0.5) * RACK_UNIT_HEIGHT;
    const labelText = `U${u}`;

    labels.push(
      <Text
        key={`right-${u}`}
        position={[RAIL_X, y, LABEL_OFFSET_Z]}
        fontSize={FONT_SIZE}
        color="#e5e7eb"
        outlineColor="#000000"
        outlineWidth={0.005}
        anchorX="center"
        anchorY="middle"
      >
        {labelText}
      </Text>,
      <Text
        key={`left-${u}`}
        position={[-RAIL_X, y, LABEL_OFFSET_Z]}
        fontSize={FONT_SIZE}
        color="#e5e7eb"
        outlineColor="#000000"
        outlineWidth={0.005}
        anchorX="center"
        anchorY="middle"
      >
        {labelText}
      </Text>,
    );
  }

  return <group>{labels}</group>;
}
