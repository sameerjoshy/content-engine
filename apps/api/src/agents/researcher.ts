import type { Env } from '../env';
import type { ContentFormat, Depth, EvidenceItem, FetchedDoc, SearchResult } from '../types';
import { chatJson, type UsageCallback } from '../lib/llm';
import { dedupeResults, fetchContent, searchWeb } from '../lib/search';

/**
 * Researcher = grounded, tool-using pipeline. Runs as several workflow steps
 * so each step stays well under the 50-subrequest limit and emits real progress.
 */

const QUERY_COUNT: Record<Depth, number> = { light: 4, moderate: 6, deep: 8 };
export const MAX_DOCS: Record<Depth, number> = { light: 4, moderate: 7, deep: 12 };
const MAX_FETCH: Record<Depth, number> = { light: 4, moderate: 6, deep: 9 };

export interface ResearchRules {
  trusted_sources?: unknown;
  sources_to_avoid?: unknown;
  depth_requirements?: unknown;
  recency?: unknown;
  required_proof?: {
    named_examples?: number;
    expert_quotes?: number;
    statistics?: number;
  };
}

export interface ProofRequirements {
  named_examples: number;
  expert_quotes: number;
  statistics: number;
}

export function parseProofRequirements(rules: ResearchRules | undefined): ProofRequirements {
  const p = rules?.required_proof;
  return {
    named_examples: Math.max(0, Number(p?.named_examples) || 0),
    expert_quotes: Math.max(0, Number(p?.expert_quotes) || 0),
    statistics: Math.max(0, Number(p?.statistics) || 0),
  };
}

/** Count evidence coverage per proof type. */
export function proofCoverage(
  evidence: EvidenceItem[],
  required: ProofRequirements,
  format: ContentFormat = 'article',
): { counts: Record<string, number>; missing: string[] } {
  const counts: Record<string, number> = {
    case_study: 0,
    expert_quote: 0,
    statistic: 0,
    frontier: 0,
  };
  for (const e of evidence) {
    const t = e.proof_type ?? e.source_type;
    if (t in counts) counts[t]++;
  }
  const missing: string[] = [];
  if (required.named_examples > 0 && counts.case_study < required.named_examples) missing.push('case_study');
  if (required.expert_quotes > 0 && counts.expert_quote < required.expert_quotes) missing.push('expert_quote');
  if (required.statistics > 0 && counts.statistic < required.statistics) missing.push('statistic');
  // Frontier insight is REQUIRED for how-to content — the forward-looking POV
  // that carries credibility. It is always demanded, never optional.
  if (format === 'howto' && counts.frontier < 1) missing.push('frontier');
  return { counts, missing };
}

/** True when a general-web search key (Tavily) is configured. */
export function hasWebSearchKey(env: Env): boolean {
  return Boolean(env.TAVILY_API_KEY);
}

export async function decomposeQueries(
  env: Env,
  topic: string,
  angle: string,
  researchRules: ResearchRules,
  depth: Depth,
  onUsage?: UsageCallback,
  format: ContentFormat = 'article',
): Promise<string[]> {
  const n = QUERY_COUNT[depth];
  const required = parseProofRequirements(researchRules);
  const proofDirectives = [
    required.named_examples > 0
      ? `Exactly ${required.named_examples} query MUST target named companies/vendors with real examples (e.g. "<CompanyName> <topic> case study" / "how <CompanyName> used <topic>").`
      : '',
    required.expert_quotes > 0
      ? `Exactly ${required.expert_quotes} query MUST target direct quotes from named experts/executives on ${topic} (e.g. "<ExpertName> on <topic>" / "executive quote ${topic}").`
      : '',
    required.statistics > 0
      ? `Exactly ${required.statistics} query MUST target hard statistics and survey data on ${topic} (e.g. "${topic} statistics" / "${topic} survey data").`
      : '',
  ].filter(Boolean);

  const howtoDirectives =
    format === 'howto'
      ? [
          'You are planning research for a DEEP HOW-TO / TEACHING piece — not a news story. The reader must be able to DO the thing afterward.',
          'Your queries must unearth: (1) the EXACT method/technique practitioners actually use (specific steps, settings, configurations, templates), (2) a real named company or practitioner who did this and the outcome, (3) the specific GOTCHA / failure mode (where most people get this wrong), (4) the MECHANISM — WHY the technique works, not just what to do, and (5) ALWAYS the FRONTIER — what the leading edge is doing, current best practices, and where this is heading (future predictions from named experts, reports, or analysts). The frontier material is REQUIRED, not optional.',
          'Prefer primary sources: practitioner write-ups, official docs, vendor guides, expert interviews. Avoid listicles and generic "5 tips" content.',
        ].join('\n')
      : '';
  const bestPracticeDirectives =
    format === 'best_practice'
      ? [
          'You are planning research for a BEST-PRACTICE / COMPETITIVE-SCAN piece — the map of who is doing this well and what the real playbook is.',
          'Your queries MUST surface: (1) the named companies/vendors/teams actively doing this and HOW each does it (specific, distinct approaches), (2) what most people copy-paste (the commoditized consensus), (3) who is DIFFERENTIATING (real evidence of an edge), (4) the WHITESPACE — what nobody is doing well yet, and (5) hard statistics and expert quotes that make the landscape credible.',
          'Every query should favor concrete named examples over abstract advice. We need to name names with sources.',
        ].join('\n')
      : '';
  const frontierDirective =
    format === 'howto'
      ? `Exactly ${Math.max(1, Math.ceil(n / 4))} query MUST target the frontier of this topic: current best practices, cutting-edge approaches, expert predictions about where ${topic} is heading, and analyst outlooks.`
      : '';
  const namedDirective =
    format === 'best_practice'
      ? `At least half the queries MUST target named companies/vendors doing ${topic} — e.g. "<CompanyName> <topic>", "<CompanyName> how it works", "<topic> case study company".`
      : '';
  const result = await chatJson<{ queries: string[] }>(
    env,
    `You are a research planner. Generate exactly ${n} diverse web search queries to research an article.
${howtoDirectives}
${bestPracticeDirectives}
${frontierDirective ? frontierDirective : ''}
${namedDirective ? namedDirective : ''}
Queries must cover: the core claim, supporting data/statistics, case studies, expert opinions, and counter-arguments.
Prefer queries likely to surface primary sources (reports, studies, interviews).
${proofDirectives.length ? proofDirectives.join('\n') : ''}
Rules from the profile: trusted sources = ${JSON.stringify(
      researchRules.trusted_sources ?? 'default',
    )}; sources to avoid = ${JSON.stringify(
      researchRules.sources_to_avoid ?? 'default',
    )}; recency = ${JSON.stringify(researchRules.recency ?? 'default')}.
Return JSON: {"queries": ["...", ...]}`,
    `TOPIC: ${topic}
ANGLE: ${angle}`,
    { temperature: 0.4, maxTokens: 800, onUsage },
  );
  const queries = (result?.queries ?? []).filter((q) => q && q.length > 3).slice(0, n);
  return queries.length ? queries : [`${topic} ${angle}`.slice(0, 200)];
}

export async function runSearchRound(
  env: Env,
  queries: string[],
  depth: Depth,
  onProgress: (done: number, total: number, query: string) => void,
): Promise<SearchResult[]> {
  const all: SearchResult[] = [];
  for (let i = 0; i < queries.length; i++) {
    onProgress(i + 1, queries.length, queries[i]);
    const results = await searchWeb(env, queries[i], 8);
    all.push(...results);
  }
  return dedupeResults(all).slice(0, MAX_DOCS[depth] * 3);
}

export async function runFetchRound(
  candidates: SearchResult[],
  depth: Depth,
  onProgress: (done: number, total: number, url: string) => void,
): Promise<FetchedDoc[]> {
  const limit = MAX_FETCH[depth];
  // Prefer candidates that already carry substantive text (abstracts/snippets),
  // then the rest. This keeps keyless research usable without a scraper.
  const withText = candidates.filter((c) => c.snippet && c.snippet.trim().length >= 80);
  const withoutText = candidates.filter((c) => !(c.snippet && c.snippet.trim().length >= 80));
  const ordered = [...withText, ...withoutText].slice(0, limit);
  const docs: FetchedDoc[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const c = ordered[i];
    onProgress(i + 1, ordered.length, c.url);
    let doc = await fetchContent(c.url);
    // Fallback: when scraping fails, use the search snippet as source text.
    if (!doc && c.snippet && c.snippet.trim().length >= 80) {
      doc = { url: c.url, title: c.title, text: c.snippet };
    }
    if (doc && doc.text.trim().length >= 80) docs.push(doc);
  }
  return docs;
}

export interface ScoredDoc {
  url: string;
  title: string;
  relevance: number;
  keep: boolean;
}

export async function scoreRelevance(
  env: Env,
  topic: string,
  angle: string,
  docs: FetchedDoc[],
  onUsage?: UsageCallback,
): Promise<ScoredDoc[]> {
  if (!docs.length) return [];
  const compact = docs.map((d) => ({ url: d.url, text: d.text.slice(0, 1500) }));
  const result = await chatJson<{ docs: ScoredDoc[] }>(
    env,
    `You are a research analyst. Score each source for relevance to an article.
TOPIC: ${topic}
ANGLE: ${angle}
For each source return: url, title, relevance (0-1), keep (true if relevant and from a credible primary source; false if irrelevant, spam, or low-quality).
Return JSON: {"docs": [...]}`,
    JSON.stringify(compact),
    { temperature: 0.1, maxTokens: 1500, onUsage },
  );
  const scored = result?.docs ?? [];
  const byUrl = new Map(scored.map((d) => [d.url, d]));
  return docs.map((d) => {
    const s = byUrl.get(d.url);
    return {
      url: d.url,
      title: d.title,
      relevance: s?.relevance ?? 0.3,
      keep: s?.keep ?? true,
    };
  });
}

export async function extractEvidence(
  env: Env,
  topic: string,
  angle: string,
  docs: FetchedDoc[],
  depth: Depth,
  onUsage?: UsageCallback,
  format: ContentFormat = 'article',
): Promise<EvidenceItem[]> {
  const maxEvidence: Record<Depth, number> = { light: 5, moderate: 9, deep: 14 };
  const limit = maxEvidence[depth];
  const compact = docs.map((d) => ({
    url: d.url,
    title: d.title,
    text: d.text.slice(0, 2500),
  }));
  const howto = format === 'howto' ? true : false;
  const bestPractice = format === 'best_practice' ? true : false;
  const formatDirective = howto
    ? 'This is a DEEP HOW-TO. Prioritize extracting: (1) the EXACT steps/method/settings practitioners use (evidence_snippet should capture the specific how-to detail), (2) a real named company/practitioner who did this and the measurable outcome, (3) explicit GOTCHAS/failure modes people hit, (4) the mechanism/why it works, and (5) FRONTIER evidence — current best practices, cutting-edge approaches, and predictions about where this is heading. Tag ANY statement about trends, outlook, or future direction as proof_type "frontier" (not "other"). A how-to with no teachable technique is useless.'
    : bestPractice
      ? 'This is a BEST-PRACTICE / COMPETITIVE-SCAN piece — the map of who is doing this well. Prioritize extracting: (1) NAMED companies/vendors/teams and the SPECIFIC approach each one takes (this is the core of the piece — capture distinct approaches, not generic advice), (2) statistics that size the landscape, (3) expert quotes, (4) evidence of DIFFERENTIATION (who is doing something genuinely different) and (5) WHITESPACE (what nobody is covering well). Tag named-company evidence as proof_type "case_study", quotes as "expert_quote", numbers as "statistic", and differentiation/whitespace/frontier statements as "frontier".'
      : '';
  const result = await chatJson<{ evidence: EvidenceItem[] }>(
    env,
    `You are a research extractor building an evidence table for an article.
TOPIC: ${topic}
ANGLE: ${angle}
Extract at most ${limit} factual evidence items that directly support the article angle.
${formatDirective}
Each item:
- claim: one factual assertion (a stat, finding, or direct quote) - be specific and verbatim to the source where possible
- source_url: the exact URL the claim came from
- source_title: the title of the source
- publish_date: publication year/date if visible in text, else null
- source_type: "study" | "report" | "news" | "case_study" | "expert_quote" | "academic"
- proof_type: classify the EVIDENCE KIND — "case_study" when it names a specific company/vendor doing the thing (e.g. "Snowflake adopted X"), "expert_quote" when it is a direct quote from a named person, "statistic" when it is a hard number/data point, "frontier" when it is a best practice, cutting-edge approach, differentiation, whitespace, or forward-looking prediction about where this is heading (from a named expert, report, or source), or "other"${
      howto ? ' (a specific technique/step also qualifies as "other" — but keep it concrete and traceable)' : ''
    }
- trust_score: 0-1 (higher = more authoritative/primary)
- evidence_snippet: the exact quote/paragraph the claim came from (max 300 chars)
IMPORTANT: Do not invent claims. Every claim must be traceable to the provided text. Prefer named-company examples and direct expert quotes when present in the text — they add credibility. Capture forward-looking / best-practice / differentiation statements as "frontier" — what the leading edge is doing and where this is headed.
Return ONLY JSON, no fences, complete and un-truncated: {"evidence": [...]}`,
    JSON.stringify(compact),
    // High maxTokens: extraction with 14 items + snippets runs ~3-5k output
    // tokens. A response truncated mid-JSON silently yields ZERO evidence
    // (parse fails → empty), which starves the entire fact-check later.
    { temperature: 0.2, maxTokens: 8000, onUsage },
  );

  let evidence = (result?.evidence ?? []).filter((e) => e.claim && e.source_url).slice(0, limit);

  // Fallback: extraction failed (null/empty — e.g. a bad parse or a truncated
  // response). NEVER leave the fact-check empty-handed when sources were
  // fetched: retry once with a trimmed prompt, then degrade to provenance
  // anchors from the docs themselves so the editor still has evidence to
  // verify against (an empty evidence table makes the editor flag every
  // claim as fabricated, which produces a defensively hedged draft).
  if (evidence.length === 0 && docs.length > 0) {
    const trimmed = docs.slice(0, 4).map((d) => ({
      url: d.url,
      title: d.title,
      text: d.text.slice(0, 1200),
    }));
    const retry = await chatJson<{ evidence: EvidenceItem[] }>(
      env,
      `Extract up to 6 factual evidence items from these sources for an article about: "${topic}" (angle: ${angle}). Be concise. Return ONLY JSON, no fences: {"evidence": [{"claim": string, "source_url": string, "source_title": string, "source_type": string, "proof_type": "case_study"|"expert_quote"|"statistic"|"frontier"|"other", "trust_score": number, "evidence_snippet": string}]}. Every claim must be traceable to the source text.`,
      JSON.stringify(trimmed),
      { temperature: 0.1, maxTokens: 4000, onUsage },
    );
    evidence = (retry?.evidence ?? []).filter((e) => e.claim && e.source_url).slice(0, limit);
  }

  if (evidence.length === 0 && docs.length > 0) {
    evidence = docs.slice(0, limit).map((d) => ({
      claim_id: `h-${d.url.split('/').pop()?.slice(0, 24) ?? 'src'}`,
      claim: `Source finding: ${d.title}`,
      source_url: d.url,
      source_title: d.title,
      source_type: 'other',
      proof_type: 'other',
      trust_score: 0.5,
      evidence_snippet: d.text.slice(0, 300),
    }));
  }

  return evidence;
}

/**
 * Follow-up research round: given the evidence so far and the required proof
 * mix, run targeted searches for whatever is still missing and return new docs.
 * For how-to content, missing named examples falls back to frontier insight
 * (best practices, cutting-edge approaches, future predictions).
 */
export async function runProofFollowUp(
  env: Env,
  topic: string,
  angle: string,
  missing: string[],
  format: ContentFormat = 'article',
): Promise<SearchResult[]> {
  const map: Record<string, string> = {
    case_study: `real company example ${topic} ${angle} case study`,
    expert_quote: `expert quote on ${topic} ${angle}`,
    statistic: `${topic} statistics survey data`,
    frontier: `${topic} future trends predictions best practices`,
  };
  const queries = missing.map((m) => map[m] ?? `${topic} ${m}`).slice(0, 3);
  const results = await runSearchRound(env, queries, 'light', () => {});
  return results;
}

export async function synthesizeDossier(
  env: Env,
  topic: string,
  angle: string,
  depth: Depth,
  evidence: EvidenceItem[],
  onUsage?: UsageCallback,
  format: ContentFormat = 'article',
): Promise<string> {
  const howto = format === 'howto';
  const bestPractice = format === 'best_practice';
  const formatName = howto
    ? 'deep how-to / teaching snippet (teach ONE move properly)'
    : bestPractice
      ? 'best-practice / competitive scan (the map of who is doing this well)'
      : 'article';
  const formatSection = howto
    ? `For this HOW-TO dossier, structure it so a writer can teach the reader to DO the thing:
1. THE MOVE (1 line — the single technique/skill being taught)
2. THE METHOD (the exact steps/settings/workflow practitioners use, each with its source)
3. PROOF (a real named company/practitioner who did this and the outcome, with source URL)
4. THE GOTCHA (the specific failure mode / where most people get this wrong, with source)
5. THE MECHANISM (why it works — the underlying logic, not just the steps)
6. Evidence Table (all items)
7. Sources Used (numbered list with URLs)`
    : bestPractice
      ? `For this BEST-PRACTICE SCAN dossier, structure it so a writer can map the landscape and name names:
1. THE LANDSCAPE (the players — every named company/team doing this, each with HOW they do it and its source)
2. THE CONSENSUS / COMMODITIZED (what most people copy-paste — the generic playbook everyone follows)
3. THE DIFFERENTIATION (who is genuinely diverging and why it works, with sources)
4. THE WHITESPACE (what nobody is covering well yet — the open gap)
5. THE STATS & QUOTES (hard numbers and expert quotes that size the space)
6. Evidence Table (all items)
7. Sources Used (numbered list with URLs)`
      : `Using ONLY the provided evidence items (which all have real sources), write a markdown dossier containing:
1. Executive Summary (1 paragraph - the key insight and how it supports the angle)
2. Key Claims (list the strongest claims, each with supporting evidence and its source)
3. Evidence Table (all items)
4. Counter-arguments (what someone would disagree with, from the evidence or general knowledge flagged as opinion)
5. Sources Used (numbered list with URLs)`;
  const result = await chatJson<{ dossier_markdown: string }>(
    env,
    `You are a research lead writing a research dossier for a content piece.
TOPIC: ${topic}
ANGLE: ${angle}
DEPTH: ${depth}
FORMAT: ${formatName}

${formatSection}
Rules: cite the exact source URL for every factual statement. Do not introduce facts that are not in the evidence. Flag anything not directly supported as "NOTE: needs verification".
Return JSON: {"dossier_markdown": "..."}`,
    JSON.stringify(evidence, null, 1),
    { temperature: 0.3, maxTokens: 3000, onUsage },
  );
  return result?.dossier_markdown ?? buildFallbackDossier(topic, angle, evidence);
}

function buildFallbackDossier(topic: string, angle: string, evidence: EvidenceItem[]): string {
  const lines = [
    `# Research Dossier: ${topic}`,
    '',
    `## Executive Summary`,
    `Evidence gathered for: ${angle}`,
    '',
    '## Evidence Table',
    '',
  ];
  for (const e of evidence) {
    lines.push(`- **${e.claim}** — ${e.source_title} (${e.source_url})`);
  }
  lines.push('', '## Sources');
  for (const e of evidence) lines.push(`- ${e.source_title}: ${e.source_url}`);
  return lines.join('\n');
}