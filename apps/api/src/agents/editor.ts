import type { Env } from '../env';
import type { ContentFormat, EvidenceItem, Series } from '../types';
import { chat, chatJson, hasFrontier, type UsageCallback } from '../lib/llm';

export interface ClaimScore {
  claim: string;
  confidence: number;
  supported: boolean;
  source_url?: string;
  /** fact = verifiable assertion needing a source; analysis = brand POV/synthesis (no source needed) */
  kind?: 'fact' | 'analysis';
}

export interface UnsupportedClaim {
  claim: string;
  kind: 'fact' | 'analysis';
  reason?: string;
}

export interface EditResult {
  edits_markdown: string;
  edited_draft: string;
  quality_score: number;
  unsupported_claims: UnsupportedClaim[];
  strengths: string[];
  main_gap: string;
  claim_scores: ClaimScore[];
  /** v1.2 subjective voice scores (0-1) — tiebreaker only in the composite gate. */
  edge_authenticity_score?: number;
  earned_uncertainty_score?: number;
  human_voice_score?: number;
  changed_mind_strength?: number;
  /** v1.2 original moves present: new synthesis / new question map / new execution layer / new reported detail. */
  original_moves?: string[];
  /** v1.2 feed-format floor alternative: is the central claim genuinely disputable? */
  disputable_claim?: boolean;
  /** v1.2 decorative mechanics flagged by the human-voice review. */
  decorative_devices?: string[];
}

const SYSTEM = `You are a senior editor. Review a draft and improve it.

DRAFT is the raw article. DOSSIER is the research. EVIDENCE is the verified evidence table.

REVIEW FOR:
1. FACTS: every VERIFIABLE claim (statistics, named companies, dates, events, quotes) must be supported by the dossier/evidence. Flag unsupported factual claims explicitly. A claim is SUPPORTED if it is stated in OR directly CALCULABLE from the dossier/evidence (e.g. "2.3x ARR" is supported when the dossier gives a $1.36B deal on ~$600M ARR), even when worded differently. Do NOT flag the author's own underwriting standards or industry-wide benchmarks ("I treat 90% as the floor", "best-in-class holds 115-125% NRR", "concentration over 10% prices as a discount") as facts needing a source — those are analysis/POV (see rule 2).
2. ANALYSIS vs HALLUCINATION: distinguish claims that are the author's REASONED ANALYSIS / POINT OF VIEW (judgments, predictions, interpretations, synthesis — these are valuable and need NO source) from HALLUCINATED FACTS (specific verifiable assertions presented as true with no source — these must be flagged for removal). Do NOT flag analysis as unsupported just because it has no source. Flag ONLY fabricated facts, invented numbers, invented quotes, invented companies, or unverifiable specific claims presented as fact.
3. STRUCTURE: does it follow a logical build (problem -> why -> proof -> action -> close)?
4. TONE: does it match confident, non-hedging voice? Flag hedging/jargon.
5. FLOW and CLARITY: flag abrupt transitions and confusing sentences.
6. PROOF MIX: does the article contain the required credibility elements (named-company examples, direct expert quotes, statistics)? Flag if missing.
7. FRONTIER VERIFICATION: for how-to pieces, the forward-looking "what's next" section is mandatory. Every trend, prediction, and forecast in it MUST trace to a dossier/evidence item. Brand opinion and synthesis are fine, but invented trends, forecasts, or experts are hallucinations — flag them as unsupported claims.
8. HUMAN VOICE (v1.2): does it read like a person with scar tissue, or a machine? Flag machine tells: uniform sentence rhythm, "in today's fast-paced world", "it's important to note", "delve/unlock/seamless/leverage", robotic parallel structure, vague abstract claims where a specific number/company/trade-off is available, no stakes, no point of view, no gotcha. Flag the specific AI tells: the "It's not X, it's Y" contrast formula, staged openers ("Let's dive in", "To be clear", "Don't get me wrong"), aphorism-dressing ("at its core", "X is the Y of Z"), forced triads, one-line closer clichés ("Read that again", "Let that sink in"), dash-dense prose. In your edits, make prose specific, varied in rhythm, and opinionated — without inventing any fact.
9. SCOPED CERTAINTY (v1.2): facts stated firmly, then the boundary where they stop being true. Flag facts hedged out of cowardice AND flag overclaiming where the boundary is missing.
10. EDGE-AUTHENTICITY (v1.2): is any edge EARNED (specificity before opinion, stakes not takes, understatement) or performed (meta-labels like "Let's be brutally honest"/"Contrarian take:", performative "X is dead" without mechanism)? ONE earned edge moment max — flag attempts to multiply it. Score 0-1 in edge_authenticity_score.
11. DECORATIVE MECHANICS (v1.2): does every interaction device or edge moment feel like it grew out of the argument, or is it bolted on to satisfy a gate? List bolted-on devices in decorative_devices.
12. ORIGINAL MOVES (v1.2): the piece must contain AT LEAST ONE of: a new synthesis (a connection not traceable to any single source), a new question map, a new execution layer, or a new reported detail not in the source. If it only paraphrases the dossier, list no original_moves and say so in main_gap. List the original moves present in original_moves.
13. DISPUTABLE CLAIM (v1.2, feed formats): is the central claim genuinely disputable — would a reasonable practitioner argue with it? (Alternative to a bolted-on interaction device.)
14. CHANGED-MIND (v1.2): if the POV block supplies a changed-mind flip, did the piece use the chronological pattern with mechanism + timeframe? Score 0-1 in changed_mind_strength. NEVER invent one that isn't in the POV block.
15. EARNED UNCERTAINTY vs CHECKLIST (v1.2.1): is the uncertainty genuine puzzlement or a verification checklist? Flag "what would have to be true" as bulleted verification (testing, not wondering). Real earned uncertainty ends in ONE thing the author can't settle, stated as confusion ("the part I genuinely can't make sense of is whether X or Y"). Penalize earned_uncertainty_score when the piece tests the thesis instead of puzzling over the variable that matters most.
16. STEELMAN FORMULA (v1.2.1): flag the fixed three-beat — objection → concession → "here's why the thesis survives" — when it appears as a repeated predictable shape. The steelman should vary: sometimes concede fully and leave the hole, sometimes BE the puzzlement. If a section's shape is predictable before reading it, rewrite it.
17. META-DEFENSIVENESS (v1.2.1): flag "I cannot verify this", "as far as I can tell", "reportedly", "if that number is accurate", "nobody publishing X as fact" when used to undercut a claim the dossier/evidence supports, or to hedge the author's own POV. Confidence on facts, curiosity on meaning: a supported fact is stated firmly, then scope-limited. Flag over-hedging that reads as apology rather than rigor.

OUTPUT (JSON only):
- edits_markdown: prioritized edit notes (PRIORITY 1 critical / 2 important / 3 nice-to-have) in markdown
- edited_draft: the FULL corrected article with all critical edits applied
- quality_score: 1-10
- unsupported_claims: array of objects, each with {claim (text), kind ("fact" for fabricated facts that must be removed, "analysis" for analysis claims you recommend framing as opinion), reason (one line why)} — leave empty if all supported
- strengths: 2-3 things that work
- main_gap: the single biggest issue
- claim_scores: array of objects, one per notable claim in the draft, each with: claim (text), confidence (0-1), supported (true/false), source_url (the matching evidence source URL, or null), kind ("fact" or "analysis")
- edge_authenticity_score: 0-1 (how earned the edge is; 0 = slop)
- earned_uncertainty_score: 0-1 (genuine earned puzzlement vs fake rhetorical questions)
- human_voice_score: 0-1
- changed_mind_strength: 0-1 (only if the POV block supplied a flip; else 0.5 = n/a)
- original_moves: array of the original moves present (empty if none — this FAILS the gate)
- disputable_claim: true/false (is the central claim one a practitioner would argue with?)
- decorative_devices: array of bolted-on devices (empty if none)

Do not invent facts. If the draft cites something not in the evidence, remove or soften it and list it in unsupported_claims. If a claim is the author's clear analysis/POV, keep it and do not list it.`;

/**
 * Pass 2: fact-check rewrite. Given the draft and the judge's unsupported-claim
 * findings, rewrite ONLY the HALLUCINATED FACTS (kind: 'fact') so every factual
 * claim traces to real evidence. Analysis/POV claims (kind: 'analysis') are the
 * brand's judgment — they are KEPT, not rewritten.
 */
export async function factCheckRewrite(
  env: Env,
  draft: string,
  dossierMarkdown: string,
  evidence: EvidenceItem[],
  unsupportedClaims: UnsupportedClaim[],
  onUsage?: UsageCallback,
): Promise<string> {
  const facts = (unsupportedClaims ?? []).filter((c) => c.kind === 'fact' || !c.kind);
  const analysis = (unsupportedClaims ?? []).filter((c) => c.kind === 'analysis');
  if (!facts.length) return draft;
  const result = await chat(
    env,
    [
      {
        role: 'system',
        content:
          'You are a meticulous fact-checker. Your ONLY job: fix the fabricated facts in a draft so every verifiable claim traces to the provided evidence. Never invent facts, companies, quotes, or statistics. If evidence does not support a fabricated claim, replace it with what the evidence actually shows, or delete it. Keep ALL analysis, opinion, and point-of-view intact — do not touch the author\'s reasoning. Keep everything else in the article identical.\n\nTONE GUARD (critical): never add meta-hedges — "I cannot verify this", "as far as I can tell", "reportedly", "if that number is accurate", "nobody publishing X as fact" — to any claim. A claim supported by the dossier/evidence (including figures directly calculable from it) is stated firmly. An unsupported specific is replaced with what the dossier shows OR reframed as the author\'s confident analytical POV with scoped certainty (state the claim, then the boundary where it stops being true) — never caveat-stacked. Confidence on facts, curiosity on meaning.',
      },
      {
        role: 'user',
        content: `EVIDENCE:
${JSON.stringify(evidence, null, 1)}

DOSSIER:
${dossierMarkdown}

FABRICATED FACTS TO FIX:
${facts.map((c) => `- ${c.claim}${c.reason ? ` (${c.reason})` : ''}`).join('\n')}

DRAFT:
${draft}

Return the COMPLETE corrected article (markdown), with only the fabricated facts corrected and all analysis preserved.`,
      },
    ],
    { temperature: 0.2, maxTokens: 5000, onUsage, provider: hasFrontier(env) ? 'anthropic' : 'deepseek' },
  );
  const text = result.text.trim();
  return text.length > draft.length / 2 ? text : draft;
}

/**
 * Pass 3: active proof-strengthen loop. When the deterministic proof gate finds
 * a missing requirement (e.g. thin frontier section), feed the draft + evidence
 * back to a rewriter that strengthens exactly the weak area. Bounded to one pass.
 */
export async function strengthenProofSection(
  env: Env,
  draft: string,
  dossierMarkdown: string,
  evidence: EvidenceItem[],
  missing: string[],
  onUsage?: UsageCallback,
): Promise<string> {
  if (!missing.length) return draft;
  const result = await chat(
    env,
    [
      {
        role: 'system',
        content:
          'You are a senior editor strengthening a piece of content. The piece has a credibility gap. Rewrite ONLY the weak area(s) so the piece is more substantive and better grounded. Never invent facts, companies, quotes, or statistics — use the evidence provided. Keep the rest of the article identical. Return the COMPLETE revised article.',
      },
      {
        role: 'user',
        content: `GAPS TO FIX (missing credibility elements):
${missing.map((m) => `- ${m}`).join('\n')}

EVIDENCE (use these — the frontier/best-practice items are ideal for the "what's next" outlook):
${JSON.stringify(evidence, null, 1)}

DOSSIER:
${dossierMarkdown}

DRAFT:
${draft}

If "frontier insight" or "named-company example" is missing, write a substantive, forward-looking section grounded in the evidence — the brand's point of view on where this is heading, citing sources. Do not pad; every added sentence must add value.`,
      },
    ],
    { temperature: 0.3, maxTokens: 5000, onUsage, provider: hasFrontier(env) ? 'anthropic' : 'deepseek' },
  );
  const text = result.text.trim();
  return text.length > draft.length / 2 ? text : draft;
}

/** Deterministic proof-mix check: which required proof kinds appear in the draft. */
export function proofCoverageCheck(
  draft: string,
  evidence: EvidenceItem[],
  required: { named_examples?: number; expert_quotes?: number; statistics?: number },
  format: ContentFormat = 'article',
): { found: Record<string, number>; missing: string[] } {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const draftNorm = normalize(draft);
  const found: Record<string, number> = { case_study: 0, expert_quote: 0, statistic: 0, frontier: 0 };
  for (const e of evidence) {
    const t = e.proof_type ?? e.source_type;
    if (t !== 'case_study' && t !== 'expert_quote' && t !== 'statistic' && t !== 'frontier') continue;
    const snippet = normalize(e.evidence_snippet ?? '');
    const claim = normalize(e.claim);
    if (
      (e.source_url && draft.toLowerCase().includes(e.source_url.toLowerCase())) ||
      (snippet.length > 25 && draftNorm.includes(snippet)) ||
      (claim.length > 20 && draftNorm.includes(claim))
    ) {
      found[t]++;
    }
  }
  const missing: string[] = [];
  if ((required.named_examples ?? 0) > 0 && found.case_study < (required.named_examples ?? 0)) missing.push('named-company example');
  if ((required.expert_quotes ?? 0) > 0 && found.expert_quote < (required.expert_quotes ?? 0)) missing.push('expert quote');
  if ((required.statistics ?? 0) > 0 && found.statistic < (required.statistics ?? 0)) missing.push('statistic');
  // Frontier POV is always required for how-to content. The gate checks the
  // section actually exists (a "Frontier"/"What's Next"-style heading) and
  // cites at least one source — evidence may be tagged 'frontier' OR the
  // section may be grounded in other tagged evidence.
  if (format === 'howto') {
    const lower = draft.toLowerCase();
    const hasSection =
      /the frontier|what'?s next|where this is (heading|going)|the outlook|forward-?looking/.test(lower);
    const citesSource = /\[[^\]]+\]\(https?:\/\/[^)]+\)/.test(draft) || /\bhttps?:\/\/[^\s\)]+/.test(draft);
    if (!hasSection || !citesSource) missing.push('frontier insight');
  }
  // Best-practice scans REQUIRE named players in the draft — the format is
  // meaningless without them. Require at least 2 named companies cited.
  if (format === 'best_practice' && found.case_study < 2) {
    if (!missing.includes('named-company example')) missing.push('named-company example');
  }
  return { found, missing };
}

export async function editArticle(
  env: Env,
  draft: string,
  dossierMarkdown: string,
  evidence: EvidenceItem[],
  profileName: string,
  onUsage?: UsageCallback,
  revisionInstruction?: string,
  format: ContentFormat = 'article',
  series?: Series | null,
  povMarkdown?: string | null,
): Promise<EditResult> {
  const howto = format === 'howto';
  const bestPractice = format === 'best_practice';
  const reviewExtras = howto
    ? `6. TEACHING QUALITY: is the how-to genuinely teachable? Can a reader reproduce the method from the text alone? Flag any step that is vague, missing a decision point, or lacks the reasoning behind it. Flag anything that reads like a listicle or a headline grab instead of a deep teaching unit.`
    : bestPractice
      ? `6. NAMED-PLAYER ACCURACY: this is a best-practice scan. Verify every named company/vendor is REAL and its described approach is traceable to the evidence. Flag any named company, practice, or stat that is not in the dossier as an unsupported fact. Ensure the piece names at least 2 distinct companies and clearly separates commoditized consensus from genuine differentiation and whitespace.`
      : '';
  const user = `PROFILE: ${profileName}
${series?.name ? `SERIES: "${series.name}" part ${series.part ?? 1}${series.total ? ` of ${series.total}` : ''}\n` : ''}
FORMAT: ${howto ? 'deep how-to / teaching snippet' : bestPractice ? 'best-practice / competitive scan' : 'article'}

DOSSIER:
${dossierMarkdown}

EVIDENCE TABLE:
${JSON.stringify(evidence, null, 1)}

${povMarkdown ? `PROPRIETARY POV (the operator's intellectual asset — changed-mind pattern lives here, never invent one outside it):\n${povMarkdown}\n` : ''}
DRAFT:
${draft}
${revisionInstruction ? `\n\nREVISION REQUEST FROM AUTHOR:\n${revisionInstruction}\n\nApply this specific change, then run the full review again and return the complete revised article in edited_draft.` : ''}`;

  const systemWithExtras = `${SYSTEM}\n${reviewExtras}`;
  const result = await chatJson<EditResult>(
    env,
    systemWithExtras,
    user,
    { temperature: 0.3, maxTokens: 5000, onUsage, provider: hasFrontier(env) ? 'anthropic' : 'deepseek' },
  );

  const fallback: EditResult = {
    edits_markdown: 'Editor output could not be parsed. Draft returned unchanged.',
    edited_draft: draft,
    quality_score: 5,
    unsupported_claims: [],
    strengths: [],
    main_gap: 'Editor failed to produce a structured result.',
    claim_scores: [],
  };
  const merged = { ...fallback, ...(result ?? {}) };
  // Normalize unsupported_claims to structured form (tolerate plain strings from older models).
  merged.unsupported_claims = (merged.unsupported_claims ?? []).map((c: unknown) =>
    typeof c === 'string'
      ? { claim: c, kind: 'fact' as const, reason: undefined }
      : (c as UnsupportedClaim),
  );
  // v1.2 judge fields: tolerate older models that omit them (composite gate falls back).
  merged.original_moves = Array.isArray(merged.original_moves) ? merged.original_moves : [];
  merged.decorative_devices = Array.isArray(merged.decorative_devices) ? merged.decorative_devices : [];
  return merged;
}

/**
 * Deterministic fact-check pass: flag evidence items whose claim text does not
 * appear (roughly) anywhere in the final draft, so the UI can show which
 * research was used vs. dropped. Updates the usage flags via caller.
 */
export function matchEvidenceUsage(draft: string, evidence: EvidenceItem[]): {
  cited: EvidenceItem[];
  dropped: EvidenceItem[];
} {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80);
  const draftNorm = normalize(draft);
  const cited: EvidenceItem[] = [];
  const dropped: EvidenceItem[] = [];
  for (const e of evidence) {
    const claim = normalize(e.claim);
    const snippet = normalize(e.evidence_snippet);
    const hit =
      (claim.length > 20 && draftNorm.includes(claim)) ||
      (snippet.length > 25 && draftNorm.includes(snippet)) ||
      (e.source_url && draft.toLowerCase().includes(e.source_url.toLowerCase()));
    (hit ? cited : dropped).push(e);
  }
  return { cited, dropped };
}