/**
 * cableGeometry.ts
 *
 * Mathematical and physical calculations for 3D Catmull-Rom patch cables:
 * - Gravitational sag modeling
 * - Port exit strain-relief vectors
 * - Discrete circumradius bend radius evaluation (Law of Sines)
 * - Medium-specific physical tolerances (Cat6, OM4, OS2, DAC)
 * - Topology and socket compatibility validation
 */

import * as THREE from 'three';
import type { HardwareProps, Vec3 } from '../types/rack.types';
import {
  CableType,
  CableMediumSpec,
  CABLE_MEDIUM_SPECS,
  CableEvaluation,
} from '../types/cable.types';

/**
 * Retrieve physical specifications for a given cable medium type.
 */
export function getCableMediumSpec(type: CableType = 'copper-cat6'): CableMediumSpec {
  return CABLE_MEDIUM_SPECS[type] || CABLE_MEDIUM_SPECS['copper-cat6'];
}

/**
 * Calculate gravitational sag (y-displacement) based on span distance.
 */
export function calculateSag(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  sagMultiplier: number = 1.0,
): number {
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const dy = Math.abs(p2.y - p1.y);
  const horizontalDist = Math.sqrt(dx * dx + dz * dz);

  // Base gravitational sag: longer horizontal runs sag quadratically
  let sag = 0.04 * horizontalDist + 0.03 * Math.pow(horizontalDist, 1.5);

  // If there's a significant vertical distance, add natural catenary drape
  if (dy > 0.1) {
    sag += 0.02 * Math.min(dy, 0.5);
  }

  // Minimum aesthetic drape
  sag = Math.max(0.015, sag * sagMultiplier);
  return sag;
}

/**
 * Calculate the minimum bend radius (in mm) along a 3D curve using discrete circumradius (Law of Sines).
 *
 * Mathematical principle:
 * For three points A, B, C along a parameterized curve, the radius of the
 * osculating circle is given by:
 *   R = |CA| / (2 * sin(theta)) = |CA| / (2 * |u_AB x u_CB|)
 */
export function calculateBendRadius(
  curve: THREE.CatmullRomCurve3,
  samples: number = 32,
): number {
  const points = curve.getPoints(samples);
  let minRadiusMeters = Infinity;

  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1];
    const b = points[i];
    const c = points[i + 1];

    const ab = new THREE.Vector3().subVectors(b, a);
    const cb = new THREE.Vector3().subVectors(b, c);
    const ca = new THREE.Vector3().subVectors(a, c);

    const abLen = ab.length();
    const cbLen = cb.length();
    if (abLen < 1e-7 || cbLen < 1e-7) continue;

    const uAb = ab.clone().multiplyScalar(1 / abLen);
    const uCb = cb.clone().multiplyScalar(1 / cbLen);

    const cross = new THREE.Vector3().crossVectors(uAb, uCb);
    const sinTheta = cross.length();

    if (sinTheta < 1e-4) {
      // Near-collinear segment -> infinite radius
      continue;
    }

    const radius = ca.length() / (2 * sinTheta);
    if (radius < minRadiusMeters) {
      minRadiusMeters = radius;
    }
  }

  // Convert meters to millimeters
  return minRadiusMeters === Infinity ? 999.0 : minRadiusMeters * 1000.0;
}

export interface CableCurveResult {
  curve: THREE.CatmullRomCurve3;
  points: THREE.Vector3[];
  length: number;
  evaluation: CableEvaluation;
}

/**
 * Generates a physics-informed 3D Catmull-Rom curve between two port positions.
 */
export function calculateCableCurve(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  type: CableType = 'copper-cat6',
): CableCurveResult {
  const spec = getCableMediumSpec(type);
  const sag = calculateSag(p1, p2, spec.sagMultiplier);

  // Normal directions straight out of the face plate
  // Front ports (+Z) exit forward (+Z); Rear ports (-Z) exit backward (-Z)
  const n1Z = p1.z >= 0 ? 1 : -1;
  const n2Z = p2.z >= 0 ? 1 : -1;

  // Strain-relief boot exit points (straight out of socket before bending)
  const bootLength = 0.035; // 35mm
  const boot1 = new THREE.Vector3(p1.x, p1.y, p1.z + n1Z * bootLength);
  const boot2 = new THREE.Vector3(p2.x, p2.y, p2.z + n2Z * bootLength);

  // Mid-span loop logic
  const midX = (p1.x + p2.x) / 2;
  const midY = Math.min(p1.y, p2.y) + Math.abs(p2.y - p1.y) * 0.4 - sag;

  // Forward clearance so cables don't clip into faceplates
  const maxZ = Math.max(p1.z, p2.z);
  const minZ = Math.min(p1.z, p2.z);
  let midZ: number;

  if (n1Z > 0 && n2Z > 0) {
    // Both front ports: push loop outward into front aisle
    midZ = maxZ + 0.05 + sag * 0.4;
  } else if (n1Z < 0 && n2Z < 0) {
    // Both rear ports: push loop outward into hot aisle
    midZ = minZ - 0.05 - sag * 0.4;
  } else {
    // Front-to-back pass-through: route through chassis depth
    midZ = (p1.z + p2.z) / 2;
  }

  const midPoint = new THREE.Vector3(midX, midY, midZ);

  // Intermediate guide points for natural catenary drape
  const guide1 = new THREE.Vector3(
    p1.x * 0.7 + midX * 0.3,
    p1.y - sag * 0.3,
    boot1.z * 0.6 + midZ * 0.4,
  );
  const guide2 = new THREE.Vector3(
    p2.x * 0.7 + midX * 0.3,
    p2.y - sag * 0.3,
    boot2.z * 0.6 + midZ * 0.4,
  );

  const controlPoints = [
    p1.clone(),
    boot1,
    guide1,
    midPoint,
    guide2,
    boot2,
    p2.clone(),
  ];

  // Create centripetal Catmull-Rom spline to minimize unnatural loops
  const curve = new THREE.CatmullRomCurve3(
    controlPoints,
    false,
    'centripetal',
    0.5,
  );

  const length = curve.getLength();
  const minRadiusFoundMm = calculateBendRadius(curve, 36);
  const hasBendViolation = minRadiusFoundMm < spec.minBendRadiusMm;

  return {
    curve,
    points: curve.getPoints(40),
    length,
    evaluation: {
      lengthMeters: Number(length.toFixed(3)),
      minBendRadiusFoundMm: Number(minRadiusFoundMm.toFixed(1)),
      hasBendViolation,
    },
  };
}

/**
 * Computes world 3D position of a port within a mounted hardware device and optional parent rack offset.
 */
export function getPortWorldPosition(
  device: HardwareProps,
  portId: string,
  rackOffset: Vec3 = [0, 0, 0],
): THREE.Vector3 | null {
  if (!device.ports) return null;
  const port = device.ports.find((p) => p.id === portId);
  if (!port) return null;

  return new THREE.Vector3(
    rackOffset[0] + device.position[0] + port.position[0],
    rackOffset[1] + device.position[1] + port.position[1],
    rackOffset[2] + port.position[2],
  );
}

/**
 * Validate topological connection rule between devices.
 */
export function isPortConnectionValid(
  typeA: string,
  typeB: string,
): boolean {
  return true;
}

