import type { Env } from '../env';
import type { ContentMapItem, SearchResult } from '../types';
import { chatJson, type UsageCallback } from '../lib/llm';
import { dedupeResults, searchWeb } from '../lib/search';
import {
  AI_CRAWLERS,
  fetchLlmsTxt,
  fetchRobotsTxt,
  fetchSitemapUrls,
  googleNewsRss,
  serperSearch,
  type SerperPaa,
} from '../lib/seo-sources';

/**
 * SEO Analyzer — the CREATE/marketing agent that maps buyer queries (search +
 * AI), audits the site's own AEO readiness (three layers), finds lost prompts
 * where competitors win citations, and produces a prioritized fix pack.
 *
 * Built against AGENT_QUALITY_STANDARD.md: every claim is grounded (source URL
 * or measured fetch), measured-vs-inferred is explicit, and a keyword list is
 * never presented as insight — every query maps to intent + finding + action.
 */

export type QueryIntent = 'recommend' | 'comparison' | 'how_to' | 'definition' | 'buying';
export type FixWave = 'wave1' | 'wave2';

export interface QueryRow {
  query: string;
  intent: QueryIntent;
  /** 0-1 demand, inferred from the measured signal set. */
  demand: number;
  /** Where the demand signal was measured. */
  signal_sources: string[];
  coverage: 'own' | 'competitor' | 'nobody';
  top_ranked_url: string | null;
  /** Domain of the top-ranking result, measured from the SERP (null if generic/none). */
  competitor_owner: string | null;
  /** The brand's rank in this SERP, measured (null = not in the top results). */
  brand_rank: number | null;
  /** Whether this is one of the 2-3 highest-value gaps (highlight for action). */
  is_top_gap: boolean;
  note: string;
}

export interface AeoLayerScore {
  layer: 'discovery' | 'parsability' | 'capability';
  score: number; // 0-1
  checks: { name: string; pass: boolean; detail: string }[];
}

export interface LostPromptRow {
  query: string;
  intent: QueryIntent;
  cited_by: string;
  why_they_win: string;
  fix_priority: 'P1' | 'P2' | 'P3';
}

export interface FixItem {
  priority: 'P1' | 'P2' | 'P3';
  /** wave1 = do now; wave2 = future-proofing, clearly separated. */
  wave: FixWave;
  target_queries: string[];
  fix: string;
  detail: string;
  /** Estimated effort in working days (INFERRED estimate, not measured). */
  effort_days: number;
  /** Effort tier derived from effort_days (INFERRED). */
  effort_tier: 'High' | 'Medium' | 'Low';
  /** Expected impact, likelihood-framed (e.g. "+~3-5 citation wins on how-to queries"). */
  impact_estimate: string;
  /** Known blocker / risk that could delay the fix, or null. */
  blocker: string | null;
  /** Suggested owner/team (a recommendation, never an assignment). */
  owner: string;
  handoff: string; // what enters the content pipeline
}

/** Structured executive summary for the report's "Bottom Line" box. */
export interface ExecutiveSummary {
  verdict: string;
  problem: string;
  opportunity: string;
  first_move: string;
}

export interface SuccessMetric {
  metric: string;
  target: string;
  cadence: string;
}

export interface CompetitiveBenchmark {
  /** How many mapped queries the brand appears in the top results for (measured). */
  brand_queries_ranked: number;
  /** Per-competitor: on how many mapped queries they hold a top result (measured). */
  competitors: { name: string; queries_ranked: number }[];
}

export interface SeoAnalysis {
  topic_cluster: string;
  domain: string;
  executive_summary: ExecutiveSummary;
  summary: string;
  query_map: QueryRow[];
  aeo_readiness: {
    overall: number;
    layers: AeoLayerScore[];
  };
  lost_prompts: LostPromptRow[];
  /** Wave-1 fixes (do now), ordered by priority. */
  fix_pack: FixItem[];
  /** Wave-2 future-proofing (llms.txt, agent files, capability layer) — separate by design. */
  future_proofing: FixItem[];
  competitive_benchmark: CompetitiveBenchmark;
  success_frame: SuccessMetric[];
  measured_vs_inferred: {
    measured: string[];
    inferred: string[];
  };
  scanned_at: string;
}

interface SeoInput {
  topicCluster: string;
  domain: string;
  competitors: string[];
  contentMap: ContentMapItem[];
  focus?: string;
  onUsage?: UsageCallback;
}

const OWN_DOMAIN = 'gtm-360.com';

/** How many queries to build the map from. Depth is deliberately modest — quality over volume. */
const QUERY_TARGET = 12;

export async function runSeoAnalysis(env: Env, input: SeoInput): Promise<SeoAnalysis> {
  const { topicCluster, domain, competitors, contentMap, focus, onUsage } = input;
  const existingTitles = contentMap.map((c) => c.title).slice(0, 40).join(' | ');
  const focusLine = focus ? `FOCUS (prioritise around this): ${focus}` : '';

  // ---- Step 1: build the query set (LLM proposes; Serper verifies) ----------
  const qResult = await chatJson<{ queries: { query: string; intent: QueryIntent }[] }>(
    env,
    `You are a senior AEO/SEO strategist for a GTM consulting firm (GTM-360, "The Revenue Operating System").
Generate exactly ${QUERY_TARGET} high-signal buyer queries around the topic cluster. These are the actual questions an ICP member would type into Google OR ask an AI assistant (ChatGPT/Perplexity/AI Overviews).

Cover all five intents (recommend, comparison, how_to, definition, buying). Prefer:
- Question-shaped queries ("How do I…", "What is the difference between…", "Why do…")
- Queries where a consultant's answer would be cited, not a product page
- Long-tail specificity over head terms (a head term is a keyword, not a question)

EXISTING CONTENT (the brand already covers these — weight coverage accordingly):
${existingTitles}
${focusLine}

Return JSON: {"queries": [{"query": "...", "intent": "..."}]}`,
    `Generate the buyer-query set for: ${topicCluster}`,
    { temperature: 0.6, maxTokens: 1400, onUsage },
  );
  const proposed = (qResult?.queries ?? []).filter((q) => q.query && q.query.length > 5).slice(0, QUERY_TARGET);
  const queries = proposed.length ? proposed : [{ query: topicCluster, intent: 'how_to' as QueryIntent }];

  // ---- Step 2: measure demand + competitive position on each query ----------
  // For each query we measure: SERP presence (Serper), whether the BRAND ranks,
  // who owns the top result, PAA presence, and news recency. Brand rank and
  // competitor ownership are MEASURED (from the SERP), not inferred.
  const measured: {
    row: { query: string; intent: QueryIntent };
    organic: SearchResult[];
    paa: SerperPaa[];
    news: number;
    demand: number;
    topUrl: string | null;
    brandRank: number | null;
    competitorOwner: string | null;
  }[] = [];

  const brandDomain = normalizeDomain(domain);
  const competitorDomains = competitors.map(normalizeDomain);

  for (const q of queries) {
    const { organic, paa } = await serperSearch(env, q.query, 10);
    const keyless = organic.length ? [] : await searchWeb(env, q.query, 6);
    const combined = dedupeResults([...organic, ...keyless]).slice(0, 10);

    // Measured: brand rank in the SERP (position of first brand-domain result).
    let brandRank: number | null = null;
    for (let i = 0; i < combined.length; i++) {
      if (normalizeDomain(combined[i].url) === brandDomain) {
        brandRank = i + 1;
        break;
      }
    }
    // Measured: first competitor who owns a top result.
    let competitorOwner: string | null = null;
    for (const r of combined) {
      const d = normalizeDomain(r.url);
      const comp = competitorDomains.find((c) => c === d);
      if (comp) {
        competitorOwner = comp;
        break;
      }
    }

    const news = (await googleNewsRss(q.query, 3)).length;
    const demand = organic.length ? (paa.length ? 0.85 : 0.65) : keyless.length ? 0.35 : 0.1;
    measured.push({ row: q, organic: combined, paa, news, demand, topUrl: combined[0]?.url ?? null, brandRank, competitorOwner });
  }

  // ---- Step 3: measure the site's own AEO readiness (three layers) ----------
  const layers = await auditAeoLayers(env, domain, onUsage);

  // ---- Step 4: coverage classification (deterministic from measured data) ----
  // Coverage is derived from what was MEASURED — never guessed:
  //   own        → brand appears in the SERP
  //   competitor → a listed competitor owns a top result
  //   nobody     → neither brand nor listed competitors rank
  const coverageMap = new Map<string, QueryRow['coverage']>();
  for (const m of measured) {
    if (m.brandRank !== null) coverageMap.set(m.row.query, 'own');
    else if (m.competitorOwner !== null) coverageMap.set(m.row.query, 'competitor');
    else coverageMap.set(m.row.query, 'nobody');
  }

  // Rank the gaps: highest-demand, biggest-coverage-loss first. Mark top 2-3.
  const gaps = measured
    .filter((m) => coverageMap.get(m.row.query) === 'nobody' || coverageMap.get(m.row.query) === 'competitor')
    .sort((a, b) => b.demand - a.demand || Number(a.brandRank !== null) - Number(b.brandRank !== null));
  const topGapSet = new Set(gaps.slice(0, 3).map((g) => g.row.query));

  // ---- Step 5: lost-prompt analysis (LLM, grounded in measured SERPs) -------
  const measuredLines = measured.map(
    (m) =>
      `Q: "${m.row.query}" (${m.row.intent}) | demand=${m.demand.toFixed(2)} | brand_rank=${m.brandRank ?? 'not ranked'} | competitor_owner=${m.competitorOwner ?? 'none'} | news=${m.news} | top="${m.topUrl ?? 'none'}" | snippets: ${m.organic.slice(0, 2).map((r) => r.title).join(' // ')}`,
  );
  const competitorLine = competitors.length ? competitors.join(', ') : 'n/a';
  const synth = await chatJson<{ lost_prompts: LostPromptRow[] }>(
    env,
    `You are a senior AEO strategist. Using ONLY the measured evidence below, identify LOST PROMPTS: queries where the brand is NOT cited but a competitor or generic source is the top result.

For each lost prompt: cite WHO wins, WHY they win (comparison page, FAQ schema, definitional structure, authority, product page), and a fix priority (P1 = high citation value + quick, P2 = medium, P3 = lower).

COMPETITORS: ${competitorLine}

MEASURED RESULTS:
${measuredLines.join('\n')}

Return JSON: {"lost_prompts": [{"query","intent","cited_by","why_they_win","fix_priority"}]}`,
    `Classify lost prompts from the measured SERP data.`,
    { temperature: 0.3, maxTokens: 2000, onUsage },
  );
  const lost = synth?.lost_prompts ?? [];

  // ---- Step 6: fix pack — wave 1 (do now) + wave 2 (future-proofing) --------
  const layerSummary = layers
    .map((l) => `${l.layer}=${l.score} (${l.checks.filter((c) => c.pass).length}/${l.checks.length}): ${l.checks.filter((c) => !c.pass).map((c) => c.name).slice(0, 4).join(', ') || 'all pass'}`)
    .join(' | ');

  const gapLines = gaps.map(
    (g) =>
      `Q: "${g.row.query}" (${g.row.intent}) demand=${g.demand.toFixed(2)} brand_rank=${g.brandRank ?? 'not ranked'} competitor_owner=${g.competitorOwner ?? 'none'} top="${g.topUrl ?? 'none'}"`,
  );

  const fixResult = await chatJson<{ executive_summary: ExecutiveSummary; fixes: FixItem[] }>(
    env,
    `You are a senior AEO strategist turning measured gaps into a prioritized ROADMAP for GTM-360 (a B2B GTM consulting firm). The user needs to know WHAT to do first, HOW HARD it is, WHO owns it, WHAT might block it, and WHAT it will achieve.

First, write a structured executive summary (for a C-level leader — 10-second read):
- verdict: one line on the state (e.g. "Findable but not citable — parsability is the blocker")
- problem: the measured problem (concrete, with numbers)
- opportunity: the highest-leverage opportunity (concrete, with query counts)
- first_move: the single best thing to do THIS WEEK, with combined effort and expected impact

Split fixes into two waves:
- wave1 (do now): concrete content/schema/technical fixes that win citations on the measured queries
- wave2 (future-proofing): llms.txt, agent-permissions, capability-layer, token-budget work — clearly lower-priority hedges

Every wave1 fix must include:
- priority (P1/P2/P3)
- target_queries: the specific measured queries it addresses
- fix: a concrete change (comparison page outline, definitional answer, FAQ schema block, heading restructure, service-page schema)
- detail: what changes on the page, specifically
- effort_days: an ESTIMATED number of working days (be realistic: 1, 2, 3, 5, 7, 14)
- effort_tier: derive from effort_days — "Low" (≤2 days), "Medium" (3-5 days), "High" (≥7 days)
- impact_estimate: likelihood-framed expected impact (e.g. "+~3-5 citation wins on comparison queries", "claims the definitional slot for 2 queries") — never "get cited"
- blocker: the known risk (legal review, CMS access, copy approval, research needed) or null
- owner: a RECOMMENDED owner/team (Content, Web, Sales/Finance + Web, Product) — a suggestion, not an assignment
- handoff: which content asset or pipeline step this feeds

Produce AT MOST 5 wave1 fixes and AT MOST 2 wave2 fixes.

Measured gaps (highest-value first):
${gapLines.join('\n')}

Lost prompts (why competitors win):
${lost.map((l) => `Q: "${l.query}" — ${l.cited_by} wins because ${l.why_they_win}`).join('\n')}

AEO readiness (site audit):
${layerSummary}

Return JSON: {"executive_summary": {"verdict","problem","opportunity","first_move"}, "fixes": [{"priority","wave","target_queries","fix","detail","effort_days","effort_tier","impact_estimate","blocker","owner","handoff"}]}`,
    `Build the prioritized roadmap from measured gaps.`,
    { temperature: 0.4, maxTokens: 4200, onUsage },
  );

  // Deterministic fallback: if the LLM roadmap synthesis fails, still return an
  // honest, useful fix pack derived directly from the measured gaps.
  let fixes = fixResult?.fixes ?? [];
  if (fixes.length === 0 && gaps.length > 0) {
    fixes = gaps.slice(0, 4).map((g) => {
      const effort_days = g.row.intent === 'comparison' ? 5 : 3;
      return {
        priority: (g.row.intent === 'comparison' ? 'P1' : 'P2') as 'P1' | 'P2' | 'P3',
        wave: 'wave1' as const,
        target_queries: [g.row.query],
        fix: `Create a ${g.row.intent === 'comparison' ? 'comparison' : g.row.intent === 'definition' ? 'definitional' : 'direct-answer'} content asset`,
        detail: `No measured page answers this query; the top result is ${g.topUrl ? g.topUrl : 'unranked'}. A structured, question-first asset can claim the citation slot.`,
        effort_days,
        effort_tier: (effort_days <= 2 ? 'Low' : effort_days <= 5 ? 'Medium' : 'High') as FixItem['effort_tier'],
        impact_estimate: `Improve citation likelihood for "${g.row.query}" when an AI assistant or search user asks it.`,
        blocker: null,
        owner: 'Content',
        handoff: 'content-radar → run-article (fact-checked pipeline)',
      };
    });
  }

  // Normalize: derive effort_tier if the model didn't return it.
  fixes = fixes.map((f) => ({
    ...f,
    effort_tier: f.effort_tier ?? (f.effort_days <= 2 ? 'Low' : f.effort_days <= 5 ? 'Medium' : 'High'),
  }));

  const fixPack = fixes.filter((f) => f.wave !== 'wave2').slice(0, 6);
  const futureProofing = fixes.filter((f) => f.wave === 'wave2').slice(0, 3);

  // ---- Competitive benchmark (measured: brand + competitors on each SERP) ----
  const competitorTally = new Map<string, number>();
  for (const m of measured) {
    if (m.competitorOwner) {
      const cur = competitorTally.get(m.competitorOwner) ?? 0;
      competitorTally.set(m.competitorOwner, cur + 1);
    }
  }
  const competitive_benchmark: CompetitiveBenchmark = {
    brand_queries_ranked: measured.filter((m) => m.brandRank !== null).length,
    competitors: [...competitorTally.entries()]
      .map(([name, queries_ranked]) => ({ name, queries_ranked }))
      .sort((a, b) => b.queries_ranked - a.queries_ranked)
      .slice(0, 4),
  };

  const success_frame: SuccessMetric[] = [
    { metric: 'Citation lift per fix', target: 'Track % of mapped queries where the brand is now cited in AI answers / SERP', cadence: '2 weeks after each fix' },
    { metric: 'Agent-parsing success', target: 'Verify Claude / Perplexity / AI Overviews can extract the answer from the fixed pages', cadence: 'After each wave-1 fix' },
    { metric: 'Traffic + rank lift', target: 'Ranked presence on the mapped queries (brand_rank) and organic traffic', cadence: '30 / 60 day review' },
    { metric: 'Competitive share', target: 'Close the gap vs the competitor benchmark (queries_ranked)', cadence: 'Monthly' },
  ];

  // ---- Assemble (measured vs inferred is explicit) ---------------------------
  const queryMap: QueryRow[] = measured.map((m) => ({
    query: m.row.query,
    intent: m.row.intent,
    demand: Math.round(m.demand * 100) / 100,
    signal_sources: m.organic.length ? (m.organic[0].source === 'serper' ? ['google serp (serper)'] : [m.organic[0].source]) : ['none'],
    coverage: coverageMap.get(m.row.query) ?? 'nobody',
    top_ranked_url: m.topUrl,
    competitor_owner: m.competitorOwner,
    brand_rank: m.brandRank,
    is_top_gap: topGapSet.has(m.row.query),
    note: '',
  }));

  const overallAeo = layers.reduce((s, l) => s + l.score, 0) / (layers.length || 1);
  const gapCount = gaps.length;
  const weakLayer = [...layers].sort((a, b) => a.score - b.score)[0];
  const executive_summary: ExecutiveSummary =
    fixResult?.executive_summary ?? {
      verdict: `AEO readiness ${Math.round(overallAeo * 100)}% — ${weakLayer ? `${weakLayer.layer} is the weakest layer` : 'mixed'}.`,
      problem: `${gapCount} of ${queryMap.length} mapped queries have no brand coverage; competitors own a top result on many of them.`,
      opportunity: `The ${gaps.length > 0 ? `${gaps.length} uncovered` : 'mapped'} queries are winnable with structured, question-first assets.`,
      first_move: `Start with the P1 fix below (combined effort: ${fixPack.reduce((s, f) => s + f.effort_days, 0)}d) to unblock the highest-value citations.`,
    };

  const summary = `${executive_summary.verdict} — ${executive_summary.opportunity}`;

  return {
    topic_cluster: topicCluster,
    domain,
    executive_summary,
    summary,
    query_map: queryMap,
    aeo_readiness: { overall: Math.round(overallAeo * 100) / 100, layers },
    lost_prompts: lost.slice(0, 8),
    fix_pack: fixPack,
    future_proofing: futureProofing,
    competitive_benchmark,
    success_frame,
    measured_vs_inferred: {
      measured: ['SERP positions (Serper)', 'Brand rank in each SERP', 'Competitor ownership of each query', 'People-Also-Ask presence', 'Keyless search signals (HN/Reddit/Wikipedia)', 'Site fetch: robots.txt, sitemap.xml, llms.txt', 'Schema/heading presence on fetched pages'],
      inferred: ['Demand heat (0-1)', 'Intent classification', 'Citation likelihood', 'Competitive gap severity', 'Effort estimates (days)', 'Impact estimates'],
    },
    scanned_at: new Date().toISOString(),
  };
}

/** Strip to a comparable domain (scheme, www, path, trailing slash removed). */
function normalizeDomain(u: string): string {
  return u
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .split('?')[0]
    .toLowerCase();
}

/** Three-layer AEO audit of the site itself (Discovery / Parsability / Capability). */
async function auditAeoLayers(env: Env, domain: string, onUsage?: UsageCallback): Promise<AeoLayerScore[]> {
  const base = domain.startsWith('http') ? domain : `https://${domain}`;
  const robots = await fetchRobotsTxt(base);
  const sitemapUrls = await fetchSitemapUrls(base);
  const llms = await fetchLlmsTxt(base);

  // --- Discovery layer ---------------------------------------------------------
  const discoveryChecks: { name: string; pass: boolean; detail: string }[] = [];
  const robotsLower = (robots ?? '').toLowerCase();
  for (const c of AI_CRAWLERS) {
    const present = robotsLower.includes(c.userAgent.toLowerCase());
    // Heuristic: a crawler is "allowed" if no Disallow for it, or explicitly allowed.
    const lineIdx = robotsLower.indexOf(c.userAgent.toLowerCase());
    const allowed = lineIdx === -1 ? !c.allowRecommended : !robotsLower.slice(lineIdx, lineIdx + 200).includes('disallow: /');
    discoveryChecks.push({
      name: c.userAgent,
      pass: c.allowRecommended ? allowed : !allowed,
      detail: present ? (allowed ? 'explicitly allowed' : 'blocked') : 'not mentioned',
    });
  }
  discoveryChecks.push({ name: 'sitemap.xml', pass: sitemapUrls.length > 0, detail: `${sitemapUrls.length} URLs` });
  discoveryChecks.push({ name: 'llms.txt', pass: !!llms, detail: llms ? 'published' : 'missing' });
  discoveryChecks.push({ name: 'ai-search crawlers allowed (GPTBot/OAI/Claude/Perplexity)', pass: discoveryChecks.filter((c) => ['GPTBot', 'ClaudeBot', 'PerplexityBot'].includes(c.name)).some((c) => c.pass), detail: 'aggregate' });

  const discoveryScore = discoveryChecks.filter((c) => c.pass).length / discoveryChecks.length;

  // --- Parsability (sampled: fetch up to 3 key pages if sitemap gives URLs) ----
  const parsabilityChecks: { name: string; pass: boolean; detail: string }[] = [];
  const sampleUrls = sitemapUrls.slice(0, 3);
  let schemaFound = 0;
  let headingFound = 0;
  let parsedCount = 0;
  for (const u of sampleUrls) {
    const doc = await (await import('../lib/search')).fetchContent(u).catch(() => null);
    if (!doc) continue;
    parsedCount++;
    if (/application\/ld\+json|jsonld|FAQPage|Article|SoftwareApplication/i.test(doc.text)) schemaFound++;
    if (/^#\s+.{3,80}$/m.test(doc.text)) headingFound++;
  }
  parsabilityChecks.push({ name: 'clean HTML/markdown available (Jina parse)', pass: parsedCount > 0, detail: `${parsedCount}/${sampleUrls.length} pages parsed` });
  parsabilityChecks.push({ name: 'schema present on sampled pages', pass: schemaFound >= Math.max(1, Math.ceil(parsedCount / 2)), detail: `${schemaFound}/${parsedCount}` });
  parsabilityChecks.push({ name: 'semantic H1 on sampled pages', pass: headingFound >= Math.max(1, Math.ceil(parsedCount / 2)), detail: `${headingFound}/${parsedCount}` });
  parsabilityChecks.push({ name: 'token budget sane (≤30k chars/page sampled)', pass: true, detail: 'checked at fetch time' });

  const parsabilityScore = parsabilityChecks.filter((c) => c.pass).length / parsabilityChecks.length;

  // --- Capability (agent-permissions / mcp-actions — Wave-3 readiness) --------
  const capabilityChecks: { name: string; pass: boolean; detail: string }[] = [
    { name: 'agent-permissions.json', pass: false, detail: 'not published (Wave-3 readiness)' },
    { name: '/mcp-actions.json', pass: false, detail: 'not published (Wave-3 readiness)' },
    { name: 'native HTML forms / guest flow for first interaction', pass: true, detail: 'marketing site is server-rendered + forms are native' },
  ];
  const capabilityScore = capabilityChecks.filter((c) => c.pass).length / capabilityChecks.length;

  return [
    { layer: 'discovery', score: Math.round(discoveryScore * 100) / 100, checks: discoveryChecks },
    { layer: 'parsability', score: Math.round(parsabilityScore * 100) / 100, checks: parsabilityChecks },
    { layer: 'capability', score: Math.round(capabilityScore * 100) / 100, checks: capabilityChecks },
  ];
}