import type { Env } from '../env';
import type { Author, ContentFormat, Profile, Series } from '../types';
import { chat, type UsageCallback } from '../lib/llm';
import { LONG_FORM_ENVELOPE } from '../lib/voice';

// Shared tail injected into every spec prompt (long-form Operator register +
// Proprietary-POV honesty rule). The writer must follow the envelope; operator
// insight must come ONLY from the POV object, never invented in the spec.
const REGISTER_NOTE = `

REGISTER ENVELOPE (the writer must follow this — long-form Operator register, hard:soft 65:35):
${LONG_FORM_ENVELOPE}

The piece is written from a PROPRIETARY POV object produced before drafting. If the writer brief references an operator insight, it must come ONLY from that object. Do not invent an operator insight in the spec.`;

const SYSTEM = `You are a content strategist building a specification for writers.

TASK: Create an explicit specification that tells a writer EXACTLY how to write a piece of content.

Build a specification containing:
1. ARTICLE BRIEF (suggested title, hook, target reader, core message)
2. THE QUESTION IT ANSWERS (ALWAYS REQUIRED): state the exact buyer question this piece answers — the query a reader (or an AI assistant) would ask. Frame the whole piece as a direct, authoritative answer to that question. AI search engines and readers alike favor content that answers a specific question.
3. STRUCTURE (exact sections in order, what each proves, what to avoid; prefer clear headings, lists, and a numbered/decision-framework structure where it fits — AI systems parse structured content best)
4. VOICE RULES (explicit DOs and DON'Ts from the brand voice; include the example sentences as tone reference)
5. AUTHOR BYLINE (ALWAYS REQUIRED): the piece is authored by a named expert — include their name, title, and company as the byline, and shape the voice as a credible individual expert (first-person authority) rather than an anonymous brand.
6. CONTENT RULES (must include, must prove, weight heavily, can skip)
7. PROOF REQUIREMENTS (a REQUIRED section): the exact mix of evidence the article MUST contain to earn credibility — named-company examples, direct expert quotes, and statistics, each with how many and where to place them. Named entities, numbers, and specific details are what get quoted/cited — prioritize them.
8. EXAMPLES (how to open - 1 sentence, how to cite data - 1 example, how to close - 1 sentence)

The specification must remove all ambiguity. It is the single source of truth for the writer.${REGISTER_NOTE}`;

const HOWTO_SYSTEM = `You are a content strategist building a specification for a writer producing a DEEP HOW-TO / teaching snippet — not a news story, not a listicle.

TASK: Create an explicit specification that teaches the reader to DO one thing properly. Depth over breadth. The reader must be able to apply the method afterward.

The how-to must teach ONE move and teach it deeply:
1. THE MOVE (1 line — the exact skill/technique being taught; pick the single most useful sub-skill of the topic)
2. WHY IT MATTERS (the mechanism — why this technique works, grounded in the research, not generic motivation)
3. THE METHOD (the exact steps, settings, and decisions — specific enough that a reader can follow them. Each step must be traceable to the dossier.)
4. THE GOTCHA (the specific failure mode / where most people get this wrong, with the real example from research)
5. PROOF (a real named company or practitioner who did this and the outcome, from the dossier — cite the source. Always include this even if it is the strongest available example.)
6. THE FRONTIER / WHAT'S NEXT (ALWAYS MANDATORY): the brand's forward-looking point of view on where this is heading, built on the dossier's frontier evidence — current best practices, cutting-edge approaches, and expert/analyst predictions. This section MUST exist in every how-to regardless of whether a named company example exists. Ground every trend and prediction in a sourced evidence item; the synthesis and opinion are the brand's, the facts are the evidence's. Never invent a trend, a forecast, a statistic, or an expert who is not in the dossier.
7. THE TAKEAWAY (one reusable line the reader keeps)

Voice and proof requirements from the brand profile apply. Cite every factual step to a source. If the dossier lacks a step or proof, say so in the spec rather than inventing it.

AUTHOR BYLINE (ALWAYS REQUIRED): the piece is authored by a named expert — include their name, title, and company as the byline, and shape the voice as a credible individual expert (first-person authority) rather than an anonymous brand.

Build the specification containing: ARTICLE BRIEF, THE MOVE, STRUCTURE (sections in order), VOICE RULES (from brand voice, with example sentences), AUTHOR BYLINE, PROOF REQUIREMENTS (named companies, quotes, stats, AND frontier insight — all mandatory), and the HOW-TO sections above.${REGISTER_NOTE}`;

const BEST_PRACTICE_SYSTEM = `You are a content strategist building a specification for a writer producing a BEST-PRACTICE / COMPETITIVE SCAN — the map of who is doing this well. Not a listicle, not vendor PR, not "10 brands to watch." A decision document that names names.

The piece must map the landscape and tell the reader where to play:
1. THE QUESTION IT ANSWERS: the exact buyer question — "Who's actually doing X well, and what's the real playbook vs. the copy-paste consensus?"
2. THE LANDSCAPE: the named players doing this — each with HOW they specifically do it (distinct approach, from the dossier). Name names with sources.
3. THE COMMODITIZED: what most of the market copy-pastes — the generic consensus playbook that no longer differentiates.
4. THE DIFFERENTIATION: who is genuinely diverging and why it works — real evidence, not vibes.
5. THE WHITESPACE: the open gap nobody is filling well yet — the reader's opportunity.
6. THE STATS & QUOTES: hard numbers and expert quotes that size the space.
7. THE MOVE: what the reader should actually do given the landscape (the actionable takeaway).

Voice and proof requirements from the brand profile apply. EVERY named company, number, and quote MUST trace to the dossier — this format lives and dies on naming real companies with real sources. Never invent a player, a practice, or a stat.

AUTHOR BYLINE (ALWAYS REQUIRED): the piece is authored by a named expert — include their name, title, and company as the byline, and shape the voice as a credible individual expert (first-person authority) rather than an anonymous brand.

Build the specification containing: ARTICLE BRIEF, THE QUESTION IT ANSWERS, STRUCTURE (sections in order), VOICE RULES (from brand voice, with example sentences), AUTHOR BYLINE, PROOF REQUIREMENTS (named companies are MANDATORY here — this is the core of the format), and the BEST-PRACTICE sections above.${REGISTER_NOTE}`;

export async function buildSpec(
  env: Env,
  profile: Profile,
  dossierMarkdown: string,
  topic: string,
  angle: string,
  onUsage?: UsageCallback,
  format: ContentFormat = 'article',
  series?: Series | null,
): Promise<string> {
  const system =
    format === 'howto' ? HOWTO_SYSTEM : format === 'best_practice' ? BEST_PRACTICE_SYSTEM : SYSTEM;
  const seriesLine = series?.name
    ? `SERIES CONTEXT: this is part "${series.part ?? 1}"${series.total ? ` of ${series.total}` : ''} of the series "${series.name}". Frame the piece as a self-contained unit of a larger playbook — useful alone, but clearly part of a sequence.`
    : '';
  const authorLine = profile.author?.name
    ? `AUTHOR BYLINE: ${profile.author.name}${profile.author.title ? `, ${profile.author.title}` : ''}${profile.author.company ? ` at ${profile.author.company}` : ''}${profile.author.bio ? `\nAUTHOR BIO: ${profile.author.bio}` : ''}`
    : 'AUTHOR BYLINE: (no author configured — use a generic confident expert voice)';
  const { text } = await chat(
    env,
    [
      { role: 'system', content: system },
      {
        role: 'user',
        content: `PROFILE BRAND VOICE:
${JSON.stringify(profile.brand_voice)}

PROFILE ICP:
${JSON.stringify(profile.icp)}

CONTENT STANDARDS:
${JSON.stringify(profile.content_standards)}

RESEARCH RULES (including required proof mix — treat this as mandatory):
${JSON.stringify(profile.research_rules)}

${authorLine}

RESEARCH DOSSIER:
${dossierMarkdown}

TOPIC: ${topic}
ANGLE: ${angle}
${seriesLine}
FORMAT: ${format === 'howto' ? 'deep how-to / teaching snippet' : format === 'best_practice' ? 'best-practice / competitive scan' : 'article'}

Write the writer specification in markdown.`,
      },
    ],
    { temperature: 0.4, maxTokens: 2500, onUsage },
  );
  return text;
}