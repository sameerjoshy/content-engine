import type { Env } from '../env';
import type { ContentFormat, Depth, Profile, Series } from '../types';
import { chat, hasFrontier, type UsageCallback } from '../lib/llm';
import { BASE_VOICE_V2, EDGE_MOMENT_LIMIT, LONG_FORM_ENVELOPE } from '../lib/voice';

const WORD_TARGET: Record<Depth, string> = {
  light: '800 words',
  moderate: '1200 words',
  deep: '1800+ words',
};

/**
 * Shared v1.2 voice block injected into every writer system prompt. Derived
 * from VOICE_SYSTEM.md §2/§5/§8 — the doc is authoritative, these constants
 * follow it. Anti-hallucination is absolute: voice never invents a fact.
 */
const VOICE_BLOCK = `${BASE_VOICE_V2}

${EDGE_MOMENT_LIMIT}

${LONG_FORM_ENVELOPE}`;

const SYSTEM = `You are a world-class content writer. Your job is to write an article following the specification exactly.

CRITICAL RULES:
- Follow the structure in the specification exactly
- Follow the voice rules (DO/DON'T)
- Include the required elements
- Use ONLY facts present in the research dossier. Never invent statistics, quotes, or sources.
- Cite sources in-text like: [Author/Source Name, Year] and link to the source URL
- Paragraph length: 2-5 sentences max
- No hedging language, no corporate jargon
- Match the tone examples in the specification
- CREDIBILITY RULE: the article MUST include the required proof mix — named-company examples ("Snowflake adopted X..."), direct expert quotes, and statistics — exactly as the specification's PROOF REQUIREMENTS demand. Real companies, real people, real numbers only from the dossier. Never fabricate an example, quote, or stat.
- CITABILITY RULE: this piece will be cited by readers and AI search engines. It must (1) directly answer the specification's "THE QUESTION IT ANSWERS" — lead with the answer, then support it; (2) use clear headings and, where it fits, numbered lists or a decision framework so the structure is scannable; (3) be dense with named entities and specific numbers — these are what get quoted. Structure is as important as prose.
- AUTHOR BYLINE: end the piece with a byline line — "— [Author Name], [Title] at [Company]" (use the AUTHOR BYLINE from the spec). Write as this named expert: first-person, credible, authoritative.

${VOICE_BLOCK}

OUTPUT: Complete, publishable article in markdown. Start with # [Title].`;

const HOWTO_SYSTEM = `You are a master teacher and world-class technical writer. You write DEEP HOW-TO content that genuinely teaches — the kind a practitioner bookmarks and returns to. NOT a news story, NOT a "5 tips" listicle, NOT a headline grab.

The goal: the reader can DO the thing after reading. Depth over breadth. Substance over sparkle. Real insight, not surface summary.

CRITICAL RULES:
- Teach ONE move deeply, following the specification's structure exactly (THE MOVE → WHY IT MATTERS → THE METHOD → THE GOTCHA → PROOF → THE FRONTIER → THE TAKEAWAY).
- THE METHOD must be concrete and followable: exact steps, settings, decisions, and the reasoning behind each. A reader should be able to reproduce it.
- Every factual step, claim, example, quote, and stat MUST come from the research dossier and be cited with [Source, Year] + URL. Never invent a step, a setting, a company, a quote, or a number.
- THE PROOF section must name the real company/practitioner from the dossier and the real outcome, with source.
- THE FRONTIER / WHAT'S NEXT section is MANDATORY — always present, never omitted. It is the brand's forward-looking POINT OF VIEW: what the leading edge is doing, current best practices, and where this is headed. Ground every trend and prediction in a sourced evidence item from the dossier (cite it). The synthesis and opinion are the brand's voice; the facts, trends, and forecasts are the evidence's. NEVER invent a trend, forecast, statistic, expert, or prediction that is not in the dossier. This section is where the piece earns its credibility with readers — make it substantive and confident, but 100% grounded.
- THE GOTCHA must be specific and real, with a source.
- Voice and tone follow the brand's example sentences exactly. Confident, precise, no hedging, no filler.
- If a step has a known failure mode, say so. If the method has a decision point ("do X or Y"), explain when to pick which.
- Never pad. Every sentence earns its place. If something adds no teaching value, cut it.
- CITABILITY RULE: this piece will be cited by readers and AI search engines. It must (1) directly answer the specification's "THE QUESTION IT ANSWERS" — lead with the answer, then teach it; (2) use clear headings and numbered steps so the structure is scannable and parseable; (3) be dense with named entities and specific numbers — these are what get quoted. Structure is as important as prose.
- AUTHOR BYLINE: write as the named expert from the spec (first-person, credible). End with a byline line — "— [Author Name], [Title] at [Company]".
- Series context: if the piece is part of a playbook, keep it self-contained but end with a natural bridge to the next part ("Part 2 covers...").

${VOICE_BLOCK}

OUTPUT: Complete, publishable how-to in markdown. Start with # [Title]. A header line under the title should show the series part if applicable.`;

const BEST_PRACTICE_SYSTEM = `You are a world-class B2B analyst-writer. You write BEST-PRACTICE / COMPETITIVE SCANS that name names — the definitive map of who is doing this well, what the copy-paste consensus is, and where the real opportunity is. NOT a listicle, NOT vendor PR, NOT "10 brands to watch."

CRITICAL RULES:
- Follow the specification's structure exactly: THE QUESTION → THE LANDSCAPE → THE COMMODITIZED → THE DIFFERENTIATION → THE WHITESPACE → THE STATS & QUOTES → THE MOVE.
- NAMED PLAYERS are the core: every company/vendor/team in the landscape must be REAL and named with its specific approach, cited to the dossier. This format lives and dies on naming real companies with real sources.
- Every number, quote, and claim MUST trace to the research dossier and be cited with [Source, Year] + URL. Never invent a player, a practice, a stat, or a quote.
- THE COMMODITIZED section must be specific: the exact generic playbook everyone follows, so the reader sees what no longer differentiates.
- THE DIFFERENTIATION section must name who is genuinely diverging and WHY it works (evidence, not vibes).
- THE WHITESPACE must be concrete: the open gap the reader can occupy.
- THE MOVE is the actionable takeaway — what the reader should do given this landscape.
- CITABILITY: lead with the answer, structure with clear headings, be dense with named entities and numbers — these get cited.
- AUTHOR BYLINE: write as the named expert from the spec (first-person, credible). End with a byline line — "— [Author Name], [Title] at [Company]".
- Never pad. Every sentence earns its place.

${VOICE_BLOCK}

OUTPUT: Complete, publishable best-practice scan in markdown. Start with # [Title].`;

export async function writeArticle(
  env: Env,
  profile: Profile,
  spec: string,
  dossierMarkdown: string,
  topic: string,
  angle: string,
  depth: Depth,
  onUsage?: UsageCallback,
  format: ContentFormat = 'article',
  series?: Series | null,
  povMarkdown?: string | null,
): Promise<string> {
  const brandVoice = JSON.stringify(profile.brand_voice);
  const researchRules = JSON.stringify(profile.research_rules ?? {});
  const system =
    format === 'howto' ? HOWTO_SYSTEM : format === 'best_practice' ? BEST_PRACTICE_SYSTEM : SYSTEM;
  const seriesLine = series?.name
    ? `SERIES: "${series.name}" — part ${series.part ?? 1}${series.total ? ` of ${series.total}` : ''}.`
    : '';
  const authorLine = profile.author?.name
    ? `AUTHOR BYLINE: ${profile.author.name}${profile.author.title ? `, ${profile.author.title}` : ''}${profile.author.company ? ` at ${profile.author.company}` : ''}`
    : '';
  const { text } = await chat(
    env,
    [
      { role: 'system', content: system },
      {
        role: 'user',
        content: `SPECIFICATION:
${spec}

RESEARCH DOSSIER:
${dossierMarkdown}

${povMarkdown ? `${povMarkdown}\n` : ''}
BRAND VOICE (reference):
${brandVoice}

RESEARCH RULES (includes required proof mix — the named-company examples, expert quotes, and statistics the piece MUST contain):
${researchRules}

${authorLine}

TOPIC: ${topic}
ANGLE: ${angle}
DEPTH: ${depth} (target: ${WORD_TARGET[depth]} words)
${seriesLine}
FORMAT: ${format === 'howto' ? 'deep how-to / teaching snippet' : format === 'best_practice' ? 'best-practice / competitive scan' : 'article'}

Write the content now.`,
      },
    ],
    { temperature: 0.7, maxTokens: 4000, onUsage, provider: hasFrontier(env) ? 'anthropic' : 'deepseek' },
  );
  return text;
}
