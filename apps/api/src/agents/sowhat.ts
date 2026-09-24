import type { Env } from '../env';
import { chatJson, hasFrontier, type UsageCallback } from '../lib/llm';
import { searchWeb } from '../lib/search';

/**
 * So-what gate (VOICE_SYSTEM.md §8 step 6): after spec-building, before the
 * writer — is this question actually burning right now? Checked against live
 * search + community signal. Cold demand → KILL or STEER before the writer
 * spends words. The operator can override (skip_sowhat) because they may know
 * something the data doesn't.
 */
export interface SoWhatResult {
  decision: 'PASS' | 'STEER' | 'KILL';
  demand_score: number; // 0-1, higher = burning
  signal: string; // what the searches actually show (named communities / queries)
  steer_suggestion: string | null;
  recency_note: string;
}

const SYSTEM = `You are the demand gate of a B2B content engine. Before any words are written, judge whether the question a piece would answer is actually being asked RIGHT NOW.

Inputs: topic, angle, and the live search/community signals gathered for it (web results with titles/snippets/sources/dates).

Judge:
1. Is there real, current demand (people asking/searching/discussing this week)? Search volume proxy: the count and recency of live results and whether the snippets reflect genuine questions, not stale SEO pages.
2. Is the specific ANGLE already saturated (top 5 results are the same take) or is there an open gap?
3. Is the question time-sensitive (news-driven, decays in weeks) vs evergreen (durable)?

Decide:
- PASS: real, current demand + the angle can add something.
- STEER: the topic has demand but the angle is wrong/saturated/cold — give a concrete steer_suggestion (a sharper, current angle).
- KILL: no real demand, or the angle is dead and can't be steered. KILL before the writer spends words.

demand_score 0-1. signal = a 2-3 line factual summary of what the searches showed (name the communities/sources). recency_note = how current the signals are.

Return ONLY JSON: {"decision":"PASS|STEER|KILL","demand_score":0-1,"signal":string,"steer_suggestion":string|null,"recency_note":string}`;

export async function soWhatGate(
  env: Env,
  topic: string,
  angle: string,
  onUsage?: UsageCallback,
): Promise<SoWhatResult> {
  // Gather live signals: 2 targeted searches, ~1 subrequest each.
  const queries = [topic, `${topic} ${angle.split(' ').slice(0, 4).join(' ')}`];
  const results = await Promise.all(queries.map((q) => searchWeb(env, q, 5)));

  const flat = results.flat().slice(0, 12).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.snippet?.slice(0, 180),
    source: r.source,
  }));

  const fallback: SoWhatResult = {
    decision: 'PASS',
    demand_score: 0.5,
    signal: 'Search signal could not be gathered — proceeding on the operator\'s request (gate treated as neutral).',
    steer_suggestion: null,
    recency_note: 'unknown',
  };
  if (!flat.length) return fallback;

  const result = await chatJson<SoWhatResult>(
    env,
    SYSTEM,
    JSON.stringify({ topic, angle, live_signals: flat }, null, 1),
    { temperature: 0.2, maxTokens: 600, onUsage, provider: hasFrontier(env) ? 'anthropic' : 'deepseek' },
  );
  if (!result?.decision) return { ...fallback, signal: 'Demand gate produced no usable verdict — treated as PASS.' };

  const score = Math.max(0, Math.min(1, Number(result.demand_score) || 0.5));
  return { ...result, demand_score: score };
}