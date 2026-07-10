/**
 * RackFrame.tsx
 *
 * The outer metal chassis of the server rack.
 *
 * - Height is derived from `RACK_UNIT_HEIGHT × capacity` so the frame
 *   always matches whatever U-capacity is in the store.
 * - Four vertical corner posts span the full height.
 * - Four horizontal beams (top + bottom, front + back) tie the posts
 *   together so the frame reads structurally.
 *
 * The frame is centered around the world Y axis (i.e. its midpoint is at
 * y=0 and its bottom at y = -height/2). Hardware positions in the store
 * are interpreted relative to the rack floor (y=0), so this assumes the
 * Store's `addHardware` default — `position[1] = rackUnits*U/2` — for a
 * 1U mount flush with the bottom of the frame.
 *
 * To put the floor at y=0 instead, change the group's `position` to
 * `[0, height/2, 0]`. Hardware positions stay the same either way
 * because the store uses rack-local coordinates.
 */

import { useConfiguratorStore, RACK_UNIT_HEIGHT } from '../../../store/useConfiguratorStore';

// -- Static geometry constants -----------------------------------------
const FRAME_WIDTH = 0.6; // 19" rails ≈ 0.48m internal, ~0.6m external
const FRAME_DEPTH = 0.8;
const POST_SIZE = 0.04; // corner-post thickness
const BEAM_HEIGHT = 0.04; // top/bottom beam thickness

// Hoist material to module scope so all frame meshes share it (allocates
// once at import time, not on every render).
const frameMaterial = {
  color: '#151515',
  metalness: 0.7,
  roughness: 0.75,
};

export function RackFrame() {
  const capacity = useConfiguratorStore((s) => s.capacity);
  const height = capacity * RACK_UNIT_HEIGHT;

  // Posts are placed at the four inner corners of the frame.
  const postX = FRAME_WIDTH / 2 - POST_SIZE / 2;
  const postZ = FRAME_DEPTH / 2 - POST_SIZE / 2;
  const postPositions: Array<[number, number, number]> = [
    [-postX, 0, -postZ],
    [postX, 0, -postZ],
    [-postX, 0, postZ],
    [postX, 0, postZ],
  ];

  return (
    <group position={[0, height / 2, 0]}>
      {/* Corner posts */}
      {postPositions.map((pos, idx) => (
        <mesh
          key={`post-${idx}`}
          position={pos}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[POST_SIZE, height, POST_SIZE]} />
          <meshStandardMaterial {...frameMaterial} />
        </mesh>
      ))}

      {/* Top + bottom beams (front, back) */}
      {[
        { y: height / 2 - BEAM_HEIGHT / 2, label: 'top-front' },
        { y: -height / 2 + BEAM_HEIGHT / 2, label: 'bottom-front' },
      ].flatMap((row) =>
        [-postZ, postZ].map((z) => (
          <mesh
            key={`${row.label}-${z}`}
            position={[0, row.y, z]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[FRAME_WIDTH, BEAM_HEIGHT, POST_SIZE]} />
            <meshStandardMaterial {...frameMaterial} />
          </mesh>
        )),
      )}

      </group>
  );
}
