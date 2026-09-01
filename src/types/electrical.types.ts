/**
 * electrical.types.ts
 *
 * TypeScript domain models for 3-Phase PDU load balancing,
 * electrical redundancy, phase imbalance, and failover simulation.
 */

export type PDUFeedId = 'feed-a' | 'feed-b';

export type PDUPhase = 'L1' | 'L2' | 'L3';

export type VoltageStandard = 'EU-230V-400V' | 'US-120V-208V';

export type BreakerRating = 16 | 20 | 30 | 32 | 63; // Amperes

export type FeedStatus = 'online' | 'tripped' | 'failed';

export type FeedFailoverMode =
  | 'normal'
  | 'failover-feed-a-down'
  | 'failover-feed-b-down';

export interface VoltageSpec {
  id: VoltageStandard;
  label: string;
  phaseVoltage: number; // Line-to-Neutral (e.g. 230V in EU, 120V in US)
  lineVoltage: number;  // Line-to-Line (e.g. 400V in EU, 208V in US)
  nominalFrequencyHz: number;
}

export const VOLTAGE_STANDARDS: Record<VoltageStandard, VoltageSpec> = {
  'EU-230V-400V': {
    id: 'EU-230V-400V',
    label: 'EU / Global (230V L-N / 400V 3Φ)',
    phaseVoltage: 230,
    lineVoltage: 400,
    nominalFrequencyHz: 50,
  },
  'US-120V-208V': {
    id: 'US-120V-208V',
    label: 'US / NEMA (120V L-N / 208V 3Φ)',
    phaseVoltage: 120,
    lineVoltage: 208,
    nominalFrequencyHz: 60,
  },
};

export interface PDUPhaseReport {
  phase: PDUPhase;
  powerWatts: number;
  currentAmps: number;
  utilizationPct: number;
  isContinuousOverload: boolean; // >80% breaker rating per NEC rule
  isBreakerTripped: boolean;     // >100% breaker rating
}

export interface PDUFeedReport {
  feedId: PDUFeedId;
  label: string;
  status: FeedStatus;
  totalPowerWatts: number;
  phases: Record<PDUPhase, PDUPhaseReport>;
  phaseImbalancePct: number; // IEEE/ANSI max deviation from average
  maxPhaseAmps: number;
  isFeedOverloaded: boolean;
  hasTrip: boolean;
}

export interface RackElectricalEvaluation {
  rackId: string;
  voltageStandard: VoltageStandard;
  phaseVoltage: number;
  lineVoltage: number;
  breakerRating: BreakerRating;
  continuousCurrentLimitAmps: number; // 0.80 * breakerRating
  failoverMode: FeedFailoverMode;
  totalRackPowerWatts: number;
  feedA: PDUFeedReport;
  feedB: PDUFeedReport;
  isRedundancyIntact: boolean;
  worstImbalancePct: number;
  hasOverloadWarning: boolean;
  hasBreakerTrip: boolean;
}
