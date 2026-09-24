import type { EvidenceItem } from '../types';
import { banListViolations, countEdgeTells, interactionDeviceCheck } from './voice';

/**
 * Composite hard gate (VOICE_SYSTEM.md §9, v1.2). Deterministic-dominated:
 * the deterministic share must clear its own bar for a piece to pass,
 * regardless of subjective brilliance. The composite is a REJECT filter, not a
 * ranker — the anti-slop wall is the human publish gate (claim-confirmation).
 */

export interface DeterministicChecks {
  evidence_grounding: number; // 1 = zero unsupported facts
  proof_coverage: number;     // 1 = full required proof mix present
  ban_clean: number;          // 1 = zero ban-list hits
  device_presence: number;    // 1 = interaction floor met (or long-form where 0-1 is fine)
  freshness: number;          // 1 = sources recent (<=90 days)
  original_moves: number;     // 1 = at least one original move present (v1.2)
}

export interface CompositeResult {
  deterministic: number;
  subjective: number;
  composite: number;
  pass: boolean;
  breakdown: DeterministicChecks & { subjective: number };
}

const DAY = 86_400_000;

function recencyScore(dates: (string | undefined)[]): number {
  const parsed = dates
    .map((d) => (d ? new Date(d).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));
  if (!parsed.length) return 0.5;
  const oldest = Math.min(...parsed);
  const newest = Math.max(...parsed);
  const age = Date.now() - newest;
  if (age <= 90 * DAY) return 1;
  if (age <= 365 * DAY) return 0.5;
  return 0.3;
}

export interface CompositeInput {
  format: string;
  draft: string;
  evidence: EvidenceItem[];
  factClaims: number;                 // count of unsupported factual claims found
  proofMissing: number;               // count of missing required proof kinds
  proofTotal: number;                 // count of required proof kinds
  originalMoves: string[];            // from the editor judge
  voiceScores?: {
    edge_authenticity?: number;
    earned_uncertainty?: number;
    human_voice?: number;
    changed_mind_strength?: number;
  };
  quality_score?: number;             // LLM 1-10 fallback for subjective
  channel?: 'article' | 'substack' | 'linkedin' | 'x'; // for device presence
}

export function compositeGate(input: CompositeInput): CompositeResult {
  const { format, draft, evidence, factClaims, proofMissing, proofTotal, originalMoves } = input;
  const channel: 'article' | 'substack' | 'linkedin' | 'x' =
    (input.channel as 'article' | 'substack' | 'linkedin' | 'x') ?? 'article';

  const violations = banListViolations(draft);
  const edgeTells = countEdgeTells(draft);
  const device = interactionDeviceCheck(draft, channel);

  // Deterministic dimensions.
  const evidence_grounding = Math.max(0, 1 - Math.min(1, factClaims * 0.4));
  const proof_coverage = proofTotal === 0 ? 1 : proofMissing === 0 ? 1 : proofMissing < proofTotal ? 0.5 : 0;
  const ban_clean = Math.max(0, 1 - Math.min(1, (violations.length + edgeTells) * 0.25));
  // Feed formats require a device (or a disputable claim — the editor judge
  // supplies that as an original move; long-form needs nothing).
  const needsDevice = channel === 'linkedin' || channel === 'x';
  const device_presence = !needsDevice || device.present || originalMoves.length > 0 ? 1 : 0;
  const freshness = recencyScore(evidence.map((e) => e.publish_date));
  const original_moves = originalMoves.length > 0 ? 1 : 0;

  const det: DeterministicChecks = {
    evidence_grounding,
    proof_coverage,
    ban_clean,
    device_presence,
    freshness,
    original_moves,
  };

  const detWeights: Record<keyof DeterministicChecks, number> = {
    evidence_grounding: 0.25,
    proof_coverage: 0.2,
    ban_clean: 0.2,
    device_presence: 0.1,
    freshness: 0.1,
    original_moves: 0.15,
  };
  const deterministic = (Object.keys(det) as (keyof DeterministicChecks)[]).reduce(
    (sum, k) => sum + det[k] * detWeights[k],
    0,
  );

  // Subjective dimensions (≤40%, tiebreaker only).
  const v = input.voiceScores ?? {};
  const rawSubjective = [
    v.edge_authenticity ?? 0.5,
    v.earned_uncertainty ?? 0.5,
    v.human_voice ?? (input.quality_score ?? 5) / 10,
    v.changed_mind_strength ?? 0.5,
  ];
  const subjective = rawSubjective.reduce((a, b) => a + b, 0) / rawSubjective.length;

  // v1.2 weighting: deterministic 65%, subjective 35% (deterministic ≥60%).
  const composite = 0.65 * deterministic + 0.35 * subjective;
  const pass = composite >= 0.75 && deterministic >= 0.45;

  return { deterministic, subjective, composite, pass, breakdown: { ...det, subjective } };
}