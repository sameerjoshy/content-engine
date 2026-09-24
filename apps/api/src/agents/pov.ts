import type { Env } from '../env';
import type { EvidenceItem, ExperienceEntry } from '../types';
import { chatJson, hasFrontier, type UsageCallback } from '../lib/llm';
import { POV_QUESTION } from '../lib/voice';

/**
 * Proprietary POV stage (VOICE_SYSTEM.md §3 + §8 step 5).
 * Asks the one Experience-Layer question and produces the Proprietary POV
 * object — the intellectual asset every format is generated from. If the layer
 * has nothing on this topic, it says so and the POV is analytical (no
 * fabrication). v1.2: experience may reframe which evidence matters and must
 * PRESENT the tension when it contradicts a published fact — never resolve
 * silently.
 */
export interface PovResult {
  has_experience: boolean;
  belief: string;
  rationale: string;
  /** Which evidence the experience demotes/contextualizes, and why (null if none). */
  evidence_reframe: string | null;
  /** A sourced fact the experience contradicts — presented as a tension, never resolved silently. */
  tension: { evidence_says: string; experience_says: string } | null;
  changed_mind: { from: string; to: string; what_happened: string } | null;
  publishable_note: string;
  /** Entry ids used, so the layer can log which scar tissue actually got used. */
  entries_used: string[];
}

const SYSTEM = `You are the Synthesis stage of a content engine. You produce the PROPRIETARY POV: what the operator/brand believes that is NOT obvious from the sources — the intellectual asset the article is generated from.

ASK ONE QUESTION per run: "${POV_QUESTION}"

You receive:
- TOPIC + ANGLE
- RESEARCH DOSSIER (what is publicly knowable)
- EXPERIENCE LAYER ENTRIES (the operator's recorded scar tissue: real observations, patterns, mistakes, counterexamples, changed minds)

RULES:
1. If a matching experience entry genuinely changes the interpretation, USE it — it is the proprietary POV. Cite which entry by its ID.
2. If no entry matches, has_experience=false. Do NOT fabricate an operator insight. The POV becomes an analytical one (a genuine synthesis of the evidence) — say the layer had nothing.
3. v1.2 — experience may REFRAME which evidence matters: if an entry shows a source is being over-weighted (e.g. "the 2021 comps are noise because the category repriced"), set evidence_reframe to explain what to demote/contextualize and why. This is not fact-disagreement.
4. v1.2 — if an entry CONTRADICTS a published fact, set tension = {evidence_says, experience_says}. NEVER resolve it silently. The piece presents the tension honestly.
5. If an entry has changed_mind fields, surface it as changed_mind {from, to, what_happened} — the strongest voice pattern available.
6. publishable_note: how this POV may be used in public content. Mark non-publishable entries (raw/client-specific scar tissue) as shaping-thinking-only.
7. The belief must pass the test: "What would we still believe if every cited article disappeared tomorrow?"

Return ONLY JSON: {"has_experience":bool,"belief":string,"rationale":string,"evidence_reframe":string|null,"tension":{"evidence_says":string,"experience_says":string}|null,"changed_mind":{"from":string,"to":string,"what_happened":string}|null,"publishable_note":string,"entries_used":[string]}`;

export async function buildProprietaryPov(
  env: Env,
  topic: string,
  angle: string,
  dossierMarkdown: string,
  evidence: EvidenceItem[],
  entries: ExperienceEntry[],
  onUsage?: UsageCallback,
): Promise<PovResult> {
  const sys = hasFrontier(env) ? 'anthropic' : 'deepseek';
  const result = await chatJson<PovResult>(env, SYSTEM, JSON.stringify(
    {
      topic,
      angle,
      dossier: dossierMarkdown.slice(0, 12000),
      evidence: evidence.map((e) => ({ claim: e.claim, source_url: e.source_url, proof_type: e.proof_type })),
      experience_entries: entries.map((e) => ({
        id: e.id,
        insight: e.insight,
        scar: e.scar,
        pattern: e.pattern,
        counter: e.counter,
        applicable_tags: e.applicable_tags,
        changed_mind_from: e.changed_mind_from,
        changed_mind_to: e.changed_mind_to,
        changed_mind_story: e.changed_mind_story,
        occurrences: e.occurrences,
        publishable: e.publishable,
      })),
    },
    null,
    2,
  ), { temperature: 0.3, maxTokens: 1200, onUsage, provider: sys });

  const fallback: PovResult = {
    has_experience: false,
    belief: `The most defensible synthesis of the research on "${topic}".`,
    rationale: 'The Experience Layer had no matching entry; the POV is analytical, built from evidence alone.',
    evidence_reframe: null,
    tension: null,
    changed_mind: null,
    publishable_note: 'Analytical POV — safe to publish as brand synthesis.',
    entries_used: [],
  };
  return { ...fallback, ...(result ?? {}), entries_used: result?.entries_used ?? [] };
}

/** Serialize the POV object into the block the Writer injects into its brief. */
export function povToMarkdown(p: PovResult): string {
  const lines: string[] = [];
  lines.push('## PROPRIETARY POV (the operator\'s intellectual asset)');
  if (!p.has_experience) {
    lines.push(`- **Status:** the Experience Layer has no matching entry for this topic — the POV is **analytical**, built from evidence alone. Do NOT fabricate an operator insight.`);
  } else {
    lines.push(`- **Status:** from the Experience Layer (entries: ${p.entries_used.join(', ') || 'listed above'}).`);
  }
  lines.push(`- **Belief:** ${p.belief}`);
  lines.push(`- **Why:** ${p.rationale}`);
  if (p.evidence_reframe) lines.push(`- **Evidence reframe:** ${p.evidence_reframe}`);
  if (p.tension) lines.push(`- **Tension (present it, never resolve it):** the data says — ${p.tension.evidence_says} | the operator's experience says — ${p.tension.experience_says}`);
  if (p.changed_mind) {
    lines.push(`- **Changed mind (use the chronological flip — mechanism + timeframe):** I used to believe ${p.changed_mind.from}. Then ${p.changed_mind.what_happened}. Now I believe ${p.changed_mind.to}.`);
  }
  lines.push(`- **Publishable note:** ${p.publishable_note}`);
  return lines.join('\n');
}

/** Match Experience Layer entries to a topic/angle by tag overlap. */
export function matchExperienceEntries(
  entries: ExperienceEntry[],
  topic: string,
  angle: string,
): ExperienceEntry[] {
  const hay = `${topic} ${angle}`.toLowerCase();
  const scored = entries.map((e) => {
    const tags = (e.applicable_tags ?? []).join(' ').toLowerCase();
    let score = 0;
    for (const tag of tags.split(/[\s,]+/).filter(Boolean)) {
      if (hay.includes(tag)) score += 3;
    }
    // lenient: any entry with a tag word appearing as a substring of a hay token
    if (score === 0) {
      for (const tag of tags.split(/[\s,]+/).filter((t) => t.length > 4)) {
        if (hay.includes(tag.slice(0, 6))) { score += 1; break; }
      }
    }
    return { e, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((s) => s.e);
}