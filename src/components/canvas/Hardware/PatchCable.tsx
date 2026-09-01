/**
 * PatchCable.tsx
 *
 * Facade and backward compatibility layer for 3D patch cabling.
 * Modular implementations reside in `src/components/canvas/Cables/`
 * and `src/utils/cableGeometry.ts`.
 */

export { PortSocket as Port } from '../Cables/PortSocket';
export { RJ45Plug, LCDuplexPlug, SFPlusPlug, ConnectorPlug } from '../Cables/ConnectorPlugs';
export { CableMesh } from '../Cables/CableMesh';
export { DraggingCableMesh } from '../Cables/DraggingCableMesh';
export { CableLayer as CableMapper, CableLayer } from '../Cables/CableLayer';
export {
  getPortWorldPosition as getPortPosition,
  isPortConnectionValid as isConnectionValid,
  calculateCableCurve,
  calculateBendRadius,
  calculateSag,
} from '../../../utils/cableGeometry';
