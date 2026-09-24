import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Competitor Intel — the Market-engine monitor. From sourced material about one
 * competitor, it produces an intel brief: what changed, what it means for you,
 * and what to do — with every claim attributed to a source.
 *
 * Gate (registry): every claim carries attribution. Unattributed intelligence is
 * marked unverified, and a claim without a source is never stated as fact.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in supplied source material,
 * attribution enforced per claim, honest when the source is thin.
 */

export interface IntelClaim {
  claim: string;
  attribution: string | null;
  verified: boolean;
}

export interface CompetitorIntelResult {
  competitor: string;
  verdict: string;
  timeline: { when: string; move: string; attribution: string | null }[];
  implications: { area: string; impact: 'high' | 'medium' | 'low'; why: string }[];
  claims: IntelClaim[];
  moves: { do_now: string[]; watch: string[] };
  coverage: { sourced_claims: number; unsourced_claims: number };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface CompetitorIntelInput {
  competitor: string;
  sourceMaterial: string;
  yourPosition?: string;
  onUsage?: UsageCallback;
}

export async function runCompetitorIntel(env: Env, input: CompetitorIntelInput): Promise<CompetitorIntelResult> {
  const { competitor, sourceMaterial, yourPosition, onUsage } = input;

  const result = await chatJson<{
    verdict: string;
    timeline: { when: string; move: string; attribution: string | null }[];
    implications: { area: string; impact: 'high' | 'medium' | 'low'; why: string }[];
    claims: { claim: string; attribution: string | null }[];
    do_now: string[];
    watch: string[];
  }>(
    env,
    `You are a competitive intelligence analyst. From the source material below, produce an intel brief on the competitor.

RULES:
- Work ONLY from the source material provided. Never invent a move, date, or fact.
- timeline: the moves in order, with "attribution" = the source (URL/title/date) it came from. If no source, null.
- claims: every factual claim about the competitor, each with its attribution. If a claim has no attribution, it is UNSOURCED — mark attribution null and it will be flagged unverified. Never dress an unsourced claim as fact.
- implications: what each change means FOR YOU, tied to your position if given. impact = high/medium/low.
- do_now / watch: concrete moves — grounded in the intelligence, not generic competitive advice.
- verdict: one honest operator-voice line on what this competitor is actually up to.

COMPETITOR: ${competitor}
${yourPosition ? `YOUR POSITION: ${yourPosition}` : ''}

SOURCE MATERIAL:
${sourceMaterial}

Return JSON: {"verdict": "...", "timeline": [{"when","move","attribution"}], "implications": [{"area","impact","why"}], "claims": [{"claim","attribution"}], "do_now": ["..."], "watch": ["..."]}`,
    `Produce the competitive intel brief on ${competitor}.`,
    { temperature: 0.25, maxTokens: 2800, onUsage },
  );

  const claims: IntelClaim[] = (result?.claims ?? []).map((c) => ({
    claim: c.claim ?? '',
    attribution: c.attribution ?? null,
    verified: !!c.attribution,
  }));
  const sourced = claims.filter((c) => c.verified).length;
  const unsourced = claims.length - sourced;

  const gates: { gate: string; note: string }[] = [];
  if (unsourced > 0) {
    gates.push({ gate: 'Attribution gate', note: `${unsourced} claim${unsourced > 1 ? 's' : ''} carry no source — treat as unverified until you can attribute ${unsourced > 1 ? 'them' : 'it'}.` });
  }
  if (claims.length === 0) {
    gates.push({ gate: 'Coverage gate', note: 'No attributable claims were extracted — the source material was too thin to brief on.' });
  }

  return {
    competitor,
    verdict: result?.verdict ?? 'Brief unavailable.',
    timeline: (result?.timeline ?? []).slice(0, 10).map((t) => ({ when: t.when ?? '', move: t.move ?? '', attribution: t.attribution ?? null })),
    implications: (result?.implications ?? []).slice(0, 6).map((i) => ({
      area: i.area ?? '',
      impact: (['high', 'medium', 'low'].includes(i.impact) ? i.impact : 'medium') as 'high' | 'medium' | 'low',
      why: i.why ?? '',
    })),
    claims: claims.slice(0, 12),
    moves: { do_now: (result?.do_now ?? []).slice(0, 5), watch: (result?.watch ?? []).slice(0, 5) },
    coverage: { sourced_claims: sourced, unsourced_claims: unsourced },
    gates,
    measured_vs_inferred: {
      measured: ['Moves + attributions (from your sources)', 'Sourced vs unsourced counts (computed)'],
      inferred: ['Implications', 'Moves to make', 'Impact ratings'],
    },
  };
}