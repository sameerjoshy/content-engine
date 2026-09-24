import type { Env } from '../env';
import type { ContentFormat, ContentMapItem, Profile, SearchResult } from '../types';
import { chatJson, type UsageCallback } from '../lib/llm';
import { dedupeResults, searchWeb } from '../lib/search';

/**
 * Content Radar — surfaces content opportunities the brand should write next.
 *
 * Signals: what buyers ask AI/search tools, what's trending, what's contra-
 * trending, what's coming next (frontier). Outputs a ranked list of angles with
 * scores, each ready to feed the normal article/howto pipeline.
 *
 * Everything is profile-scoped: the ICP defines "who are we writing for", the
 * content map defines "what have we already said" (whitespace), and the brand
 * voice defines how the opportunity should be framed.
 */

export type RadarArchetype =
  | 'quiet_shift' // nobody's talking about it yet — leading indicator
  | 'signal_vs_noise' // everyone's talking; what actually changes vs hype
  | 'third_way' // consensus frames A vs B; here's C most miss
  | 'long_game' // what people will wish they understood
  | 'decision_framework' // a reusable way to choose
  | 'howto' // teach one move deeply
  | 'best_practice' // who's doing X well + the whitespace
  | 'frontier'; // where this is heading, grounded in evidence

export interface RadarOpportunity {
  id: string;
  archetype: RadarArchetype;
  topic: string;
  angle: string;
  question: string; // the buyer question it answers (what AI search would ask)
  suggested_format: ContentFormat;
  suggested_depth: 'light' | 'moderate' | 'deep';
  /** 0-1 scores from the scan. */
  scores: {
    demand: number; // are people actively asking this?
    whitespace: number; // is the brand's angle distinct from existing content?
    insight_density: number; // can research unearth named entities + data?
    durability: number; // still valuable in 6-12 months?
    frontier: number; // is it forward-looking / contra-consensus?
  };
  overall: number;
  why_now: string; // one line: the signal that makes this timely
  signals: string[]; // what the scan found (real search results)
  source_urls: string[];
}

export interface RadarResult {
  opportunities: RadarOpportunity[];
  scan_summary: string;
  scanned_at: string;
}

interface RadarInput {
  profile: Profile;
  contentMap: ContentMapItem[];
  focus?: string;
  onUsage?: UsageCallback;
}

export async function scanContentRadar(env: Env, input: RadarInput): Promise<RadarResult> {
  const { profile, contentMap, focus, onUsage } = input;
  const icp = JSON.stringify(profile.icp ?? {});
  const brand = JSON.stringify(profile.brand_voice ?? {});
  const existing = contentMap
    .map((c) => c.title)
    .slice(0, 30)
    .join(' | ');

  // ---- Step 1: generate research queries from ICP + focus -------------------
  const focusLine = focus ? `FOCUS TOPIC (scan primarily around this): ${focus}` : 'Scan across the ICP\'s top pain points and decisions.';
  const qResult = await chatJson<{ queries: string[] }>(
    env,
    `You are a B2B content strategist running a signal scan. Generate exactly 8 diverse search queries to surface CONTENT OPPORTUNITIES the brand should write next.

Queries must cover:
1. What buyers are ASKING (search-style questions — the actual queries an ICP member would type into Google/AI)
2. What's TRENDING in the space right now
3. What's CONTRADICTING the consensus (evidence against the mainstream take)
4. What's COMING NEXT (frontier: new tools, new rules, early signals)
5. Named-company examples / case studies that exist (so the piece can be grounded)

ICP: ${icp}
BRAND: ${brand}
${focusLine}
EXISTING CONTENT (the brand has already covered — avoid re-deriving these):
${existing}

Return JSON: {"queries": ["...", ...]}`,
    `Run the scan queries. 8 diverse, high-signal queries.`,
    { temperature: 0.5, maxTokens: 900, onUsage },
  );
  const queries = (qResult?.queries ?? []).filter((q) => q && q.length > 4).slice(0, 8);
  const safeQueries = queries.length ? queries : [`${focus ?? profile.name} trends 2026`, `${focus ?? profile.name} buyer questions`];

  // ---- Step 2: search the web for signals ----------------------------------
  const all: SearchResult[] = [];
  for (const q of safeQueries) {
    const results = await searchWeb(env, q, 6);
    all.push(...results);
  }
  const signals = dedupeResults(all).slice(0, 30);

  // ---- Step 3: synthesize opportunities from the signal set -----------------
  const synth = await chatJson<{ summary: string; opportunities: RadarOpportunity[] }>(
    env,
    `You are a senior content strategist turning raw search signals into ranked CONTENT OPPORTUNITIES for a specific brand.

For each opportunity, define:
- archetype: one of quiet_shift | signal_vs_noise | third_way | long_game | decision_framework | howto | best_practice | frontier
- topic: the subject (short, concrete)
- angle: the SPECIFIC non-obvious take the brand should advance (a claim, not a subject)
- question: the exact buyer question this piece answers (what someone would ask an AI tool — lead with the answer in the article)
- suggested_format: 'article' or 'howto'
- suggested_depth: light/moderate/deep based on how much substance the signals support
- scores (0-1): demand (are people actively asking?), whitespace (is the angle distinct from existing content and the crowded consensus?), insight_density (can research unearth named companies, quotes, stats?), durability (valuable in 6-12 months, not a 48h news event), frontier (forward-looking / contra-consensus)
- overall: 0-1 composite (the highest-leverage opportunities score highest)
- why_now: ONE line naming the signal that makes this timely
- signals: 2-3 short quotes/snippets from the scan that support this
- source_urls: the real URLs from the scan that ground this

REJECT (do not output) opportunities that are: pure breaking news that dies in days, generic listicles with no angle, topics the brand already covered, or angles with no evidentiary basis in the signals.

ICP: ${icp}
BRAND: ${brand}
${focusLine}
EXISTING CONTENT (avoid overlap): ${existing}

SCAN SIGNALS (real search results — ground every opportunity in these):
${JSON.stringify(signals, null, 1)}

Return JSON: {"summary": "one-line scan summary", "opportunities": [ ... 5-7 opportunities ... ]}`,
    `Synthesize the highest-leverage content opportunities.`,
    { temperature: 0.4, maxTokens: 3000, onUsage },
  );

  const ops: RadarOpportunity[] = (synth?.opportunities ?? [])
    .map((o) => {
      const fmt: ContentFormat =
        o.suggested_format === 'best_practice' || o.archetype === 'best_practice'
          ? 'best_practice'
          : o.suggested_format === 'howto' || o.archetype === 'howto'
            ? 'howto'
            : 'article';
      return {
        ...o,
        suggested_format: fmt,
        id: slug(o.angle || o.topic),
      };
    })
    .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));

  return {
    opportunities: ops,
    scan_summary: synth?.summary ?? 'Scan complete.',
    scanned_at: new Date().toISOString(),
  };
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'opportunity'
  );
}