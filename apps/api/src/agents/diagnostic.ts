import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';
import { fetchContent } from '../lib/search';

/**
 * Diagnostic — the Strategy-engine agent and the funnel entry. It runs the
 * GTM-360 five-question planning cycle against independent context (a real
 * scrape of the company site) and surfaces where the system is under strain.
 *
 * Gates (registry): an unscrapable source drops confidence to low — the agent
 * does not guess. Contradicting signals are both surfaced, never resolved
 * silently.
 *
 * Built against AGENT_QUALITY_STANDARD.md: grounded, measured-vs-inferred
 * explicit, honest absence, operator voice (sell the dream, not the decimal).
 */

/** The canon's five planning-cycle questions (TONE_AND_POV_CANON §7). */
export const PLANNING_QUESTIONS = [
  'Where are we?',
  'How did we get here?',
  'Where could we be?',
  'How do we get there?',
  'Are we getting there?',
] as const;

export type ConstraintDomain = 'strategy' | 'marketing' | 'sales' | 'expansion' | 'operations';

export interface Constraint {
  domain: ConstraintDomain;
  /** The friction point, stated plainly. */
  constraint: string;
  /** 0-1 confidence — drops when the independent evidence is thin. */
  confidence: number;
  /** What the scrape found that points here, or null if inferred. */
  evidence: string | null;
}

export interface DiagnosticResult {
  company: string;
  revenue_stage: string;
  team_size: number | null;
  state_summary: { question: string; finding: string }[];
  constraints: Constraint[];
  headline: string;
  /** Gates surfaced to the reader. */
  gates: { gate: string; note: string }[];
  source_scraped: boolean;
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface DiagnosticInput {
  companyUrl: string;
  revenueStage: string;
  teamSize?: number;
  notes?: string;
  onUsage?: UsageCallback;
}

function domainFromUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
}

export async function runDiagnostic(env: Env, input: DiagnosticInput): Promise<DiagnosticResult> {
  const { companyUrl, revenueStage, teamSize, notes, onUsage } = input;
  const company = domainFromUrl(companyUrl);

  // ---- Step 1: gather independent context (real scrape, gate if it fails) ----
  const doc = await fetchContent(companyUrl);
  const source_scraped = !!doc && doc.text.trim().length > 200;
  const siteContext = source_scraped ? doc!.text.slice(0, 5000) : '';

  // ---- Step 2: run the planning-cycle questions against the context --------
  const result = await chatJson<{
    headline: string;
    state_summary: { question: string; finding: string }[];
    constraints: { domain: ConstraintDomain; constraint: string; confidence: number; evidence: string | null }[];
  }>(
    env,
    `You are a senior GTM operator running a diagnostic. You are calm, direct, and you respect the operator's competence — this is a health check, not a scolding.

Run the GTM-360 five-question planning cycle against the context below:
${PLANNING_QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join('\n')}

For each question, give a brief finding ("finding") grounded in the evidence — if the evidence does not address it, say what is unknown rather than guessing.

Then produce a "constraint map" — the 3–5 friction points where the system is most likely under strain. For each:
- domain: one of strategy | marketing | sales | expansion | operations
- constraint: the friction, stated plainly (no jargon)
- confidence: 0–1. Drop to ≤0.35 when the evidence is thin — do NOT guess high.
- evidence: the exact quote from the scraped site that points here, or null if it is your inference.

GATES:
- If the site could not be scraped, confidence across all constraints must be low (≤0.35) and findings must say the independent context was unavailable. Never fabricate site details.
- If the evidence contradicts the stated inputs, surface BOTH — never silently resolve.

COMPANY: ${company}
REVENUE STAGE: ${revenueStage}
GTM TEAM SIZE: ${teamSize ?? 'not provided'}
${notes ? `OPERATOR NOTES: ${notes}` : ''}

SCRAPED SITE CONTEXT:
${source_scraped ? siteContext : '[UNAVAILABLE — the site could not be scraped. Lower all confidence and say so.]'}

Return JSON: {"headline": "one-line read of where they are", "state_summary": [{"question","finding"}], "constraints": [{"domain","constraint","confidence","evidence"}]}`,
    `Run the GTM-360 diagnostic on ${company}.`,
    { temperature: 0.3, maxTokens: 2800, onUsage },
  );

  const headline = result?.headline ?? `Diagnosis for ${company}: insufficient independent evidence — treat the constraint map as directional only.`;

  const state_summary = PLANNING_QUESTIONS.map((q) => ({
    question: q,
    finding: result?.state_summary?.find((s) => s.question?.toLowerCase().includes(q.toLowerCase().replace('?', '')))?.finding ?? 'Not addressed by the available evidence.',
  }));

  const constraints: Constraint[] = (result?.constraints ?? [])
    .slice(0, 5)
    .map((c) => ({
      domain: (['strategy', 'marketing', 'sales', 'expansion', 'operations'].includes(c.domain) ? c.domain : 'strategy') as ConstraintDomain,
      constraint: c.constraint,
      // Gate: if unscraped, cap confidence low — never let a guess read as high-confidence.
      confidence: source_scraped ? Math.max(0, Math.min(1, c.confidence ?? 0.4)) : Math.min(0.35, Math.max(0, c.confidence ?? 0.3)),
      evidence: c.evidence ?? null,
    }));

  const gates: { gate: string; note: string }[] = [];
  if (!source_scraped) {
    gates.push({ gate: 'Evidence threshold', note: 'The site could not be scraped — confidence is capped low across the map. Share the site or notes and re-run for sharper constraints.' });
  }
  if ((notes ?? '').trim() && !source_scraped) {
    gates.push({ gate: 'Contradiction check', note: 'The stated notes were not cross-checked against independent context — treat the map as the operator’s framing, not a verified read.' });
  }

  return {
    company,
    revenue_stage: revenueStage,
    team_size: teamSize ?? null,
    state_summary,
    constraints,
    headline,
    gates,
    source_scraped,
    measured_vs_inferred: {
      measured: source_scraped
        ? ['Company site content (scraped via Jina Reader)', 'Stated revenue stage, team size, notes', 'Confidence caps (computed)']
        : ['Stated revenue stage, team size, notes', 'Scrape failure (recorded, not hidden)'],
      inferred: ['Planning-cycle findings', 'Constraint domains', 'Constraint confidence'],
    },
  };
}