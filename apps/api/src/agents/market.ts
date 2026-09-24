import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Market Research — the Strategy-engine TAM analyst. Sizes the segments you care
 * about, maps the competitive field, and scores the whitespace so Strategy aims
 * at a prize that is real and reachable.
 *
 * Gate (registry): Evidence gate — segment sizes must trace to cited sources,
 * not estimates dressed as facts. Any size without a source is flagged.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the operator's sources,
 * sizes attributed or flagged unverified, honest when the data is thin.
 */

export interface MarketSegment {
  segment: string;
  size: string;
  size_source: string | null;
  verified: boolean;
  growth: string | null;
  fit: string;
}

export interface MarketResearchResult {
  verdict: string;
  segments: MarketSegment[];
  whitespace: { area: string; why: string; evidence: string | null }[];
  competitors: { name: string; position: string; note: string }[];
  entry_priority: { rank: number; segment: string; why: string; evidence: string }[];
  coverage: { sized_with_source: number; sized_without_source: number };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface MarketResearchInput {
  segments: string;
  geography?: string;
  yourPosition?: string;
  sources?: string;
  onUsage?: UsageCallback;
}

export async function runMarketResearch(env: Env, input: MarketResearchInput): Promise<MarketResearchResult> {
  const { segments, geography, yourPosition, sources, onUsage } = input;

  const result = await chatJson<{
    verdict: string;
    segments: { segment: string; size: string; size_source: string | null; growth: string | null; fit: string }[];
    whitespace: { area: string; why: string; evidence: string | null }[];
    competitors: { name: string; position: string; note: string }[];
    entry_priority: { segment: string; why: string; evidence: string }[];
  }>(
    env,
    `You are a market analyst sizing segments and mapping whitespace. Work ONLY from the sources provided.

RULES:
- Never invent a market size. Every size must carry size_source = the specific source it came from (report/URL/title). If you have no source for a size, set size_source to null and the size will be flagged unverified — state it as an estimate, not a fact.
- growth: the growth rate/direction if a source supports it, else null.
- fit: how well the segment matches the stated position (if given), else how attractive it looks.
- whitespace: where demand exists but credible coverage does not — each with its evidence (or null if it is a judgment).
- entry_priority: rank the segments 1..n with the reason and the evidence behind the ranking. Only rank segments you have information on.
- Be honest when a segment cannot be sized from the sources — say so rather than reach for a number.

SEGMENTS TO SIZE: ${segments}
GEOGRAPHY: ${geography || 'not specified'}
${yourPosition ? `YOUR POSITION: ${yourPosition}` : ''}

SOURCES:
${sources || 'No sources provided.'}

Return JSON: {"verdict": "...", "segments": [{"segment","size","size_source","growth","fit"}], "whitespace": [{"area","why","evidence"}], "competitors": [{"name","position","note"}], "entry_priority": [{"segment","why","evidence"}]}`,
    `Size the segments, map whitespace, and rank entry priority.`,
    { temperature: 0.25, maxTokens: 2800, onUsage },
  );

  const segRows: MarketSegment[] = (result?.segments ?? []).map((s) => ({
    segment: s.segment ?? '',
    size: s.size ?? 'not sized',
    size_source: s.size_source ?? null,
    verified: !!s.size_source,
    growth: s.growth ?? null,
    fit: s.fit ?? '',
  }));

  const withSource = segRows.filter((s) => s.verified).length;
  const withoutSource = segRows.length - withSource;

  const gates: { gate: string; note: string }[] = [];
  if (withoutSource > 0) {
    gates.push({ gate: 'Evidence gate', note: `${withoutSource} segment size${withoutSource > 1 ? 's' : ''} carry no cited source — treat as estimates, not facts, until you can source ${withoutSource > 1 ? 'them' : 'it'}.` });
  }
  if (!sources) {
    gates.push({ gate: 'Input gate', note: 'No sources were provided — the whole map rests on judgment. Add reports or analyst data for a grounded read.' });
  }
  if (segRows.length === 0) {
    gates.push({ gate: 'Coverage gate', note: 'No segments could be sized from the material provided.' });
  }

  return {
    verdict: result?.verdict ?? 'Market map unavailable.',
    segments: segRows.slice(0, 12),
    whitespace: (result?.whitespace ?? []).slice(0, 6).map((w) => ({ area: w.area ?? '', why: w.why ?? '', evidence: w.evidence ?? null })),
    competitors: (result?.competitors ?? []).slice(0, 8).map((c) => ({ name: c.name ?? '', position: c.position ?? '', note: c.note ?? '' })),
    entry_priority: (result?.entry_priority ?? []).slice(0, 8).map((e, i) => ({ rank: i + 1, segment: e.segment ?? '', why: e.why ?? '', evidence: e.evidence ?? '' })),
    coverage: { sized_with_source: withSource, sized_without_source: withoutSource },
    gates,
    measured_vs_inferred: {
      measured: ['Segment sizes + their sources (as provided)', 'Sourced vs unsourced counts (computed)'],
      inferred: ['Whitespace areas', 'Entry ranking', 'Fit assessment'],
    },
  };
}