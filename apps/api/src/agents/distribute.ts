import type { Env } from '../env';
import type { Author, ContentFormat, EvidenceItem, Profile, Series } from '../types';
import { chat, hasFrontier, type UsageCallback } from '../lib/llm';
import { registerEnvelope } from '../lib/voice';

export interface DistributeResult {
  linkedin: string;
  youtube: string;
  substack: string;
  x_thread: string;
  generated_at: string;
}

const GROUNDING = `GROUNDING RULES (identical for every channel):
- Every statistic, named company, direct quote, and concrete number MUST come from the EVIDENCE below. Never invent one.
- If a claim in the source is the author's ANALYSIS / point of view, you may keep the same POV in your own words — but never dress up an opinion as a verified fact.
- When you cite a number or company, keep it traceable (the source article contains the full citation).
- CITABILITY: lead with the answer/insight (not the setup), keep structure scannable, and keep named entities + specific numbers front and center — these are what get cited and quoted.`;

async function channelChat(
  env: Env,
  system: string,
  draft: string,
  evidence: EvidenceItem[],
  onUsage?: UsageCallback,
): Promise<string> {
  const result = await chat(
    env,
    [
      { role: 'system', content: system },
      {
        role: 'user',
        content: `EVIDENCE (source of truth for every fact):
${JSON.stringify(evidence, null, 1)}

SOURCE ARTICLE (adapt from this, do not copy verbatim where the channel demands a rewrite):
${draft}

Write the channel output now.`,
      },
    ],
    { temperature: 0.5, maxTokens: 2500, onUsage, provider: hasFrontier(env) ? 'anthropic' : 'deepseek' },
  );
  return result.text.trim();
}

/**
 * Generate channel-specific derivatives of a finished, fact-checked piece.
 * Every variant is built from the SAME evidence table — so a LinkedIn stat, a
 * YouTube claim, or a newsletter number can never drift into fabrication.
 */
export async function generateDistribution(
  env: Env,
  draft: string,
  evidence: EvidenceItem[],
  profileName: string,
  format: ContentFormat,
  series?: Series | null,
  author?: Author | null,
  onUsage?: UsageCallback,
): Promise<DistributeResult> {
  const seriesLine = series?.name
    ? `This is part ${series.part ?? 1}${series.total ? ` of ${series.total}` : ''} of the series "${series.name}". Frame it as part of a playbook and point to the next part.`
    : '';
  const authorLine = author?.name
    ? `AUTHOR PERSONA: the author is ${author.name}${author.title ? `, ${author.title}` : ''}${author.company ? ` at ${author.company}` : ''}${author.bio ? `. Bio: ${author.bio}` : ''}${author.linkedin_url ? `. LinkedIn: ${author.linkedin_url}` : ''}\nWrite as this named expert — first-person, credible, authoritative. Sign the piece as this person.`
    : 'AUTHOR PERSONA: no author configured — use a confident expert voice.';

  const linkedinSystem = `You are a senior GTM content writer turning a researched article into a HIGH-ENGAGEMENT LinkedIn post. Not a reflow, a rewrite for the feed.

${registerEnvelope('linkedin')}

LinkedIn rules:
- ONE core idea, stated in the first 2 lines. Stop readers scrolling.
- Short punchy lines. 1-2 sentences per paragraph. Heavy line breaks — LinkedIn readers scan.
- Opinionated, confident, first-person point of view allowed. Your stance is the value.
- 2-3 max concrete proof points: a real stat, a real named company, or a real quote from the evidence. Never invent.
- Hook → insight → proof → a forward-looking point → a light call-to-action or question that invites comments.
- Length: 1,100-1,500 characters. No hashtag spam (max 3). No clickbait, no "X is dead" — substance over hype.
- Interaction floor: ≥1 genuine device (number exchange, take-a-side, prediction, open loop) OR a genuinely disputable central claim. Prefer ZERO bolted-on devices over one that is decorative.
- Voice: the profile is "${profileName}". Write as that brand.

${authorLine}

${GROUNDING}
${seriesLine}`;

  const youtubeSystem = `You are a YouTube scriptwriter turning a researched piece into a WATCHABLE VIDEO SCRIPT (aim ~4-7 minutes). Include on-screen cues in brackets.

YouTube rules:
- COLD OPEN (0:00-0:15): a hook that earns the watch — the one surprising stat or the pain point, spoken, not written.
- THE PROMISE (0:15-0:30): "By the end of this video you'll be able to [do the thing]."
- THE BODY: teach ONE move deeply. Use clear sections with on-screen text cues like [SCREEN: "Step 2 — Score accounts by revenue"]. Explain the WHY behind each step, not just the what.
- THE GOTCHA: the failure mode most people hit, with the real example.
- THE FRONTIER: where this is heading — the forward-looking point of view (from the article, grounded).
- CTA: subscribe/next video (if part of a series, tease the next part).
- Written for SPEAKING: conversational, short sentences, natural rhythm. No markdown tables or bullet lists that can't be spoken. Keep every fact traceable to the evidence.
- AUTHOR PRESENCE: present the host as the named expert (${author?.name ?? 'the author'}) — first-person, a credible practitioner teaching from experience.

${authorLine}
${GROUNDING}
${seriesLine}`;

  const substackSystem = `You are a newsletter editor preparing a SUBSTACK EDITION from a researched article.

${registerEnvelope('substack')}

Substack rules:
- SUBJECT LINE: one line that earns the open (no clickbait, promise real value).
- OPENING (2-4 sentences): personal, direct address to the reader — why this matters to them today. The brand's voice ("${profileName}").
- THE BODY: adapt the article for the newsletter reading experience — keep the structure and depth, tighten where it drags, keep all citations and links. This is the meat; do not gut it.
- CLOSE: a forward-looking line (the frontier POV), plus a sign-off and a soft CTA (reply, share, subscribe) — and if part of a series, tease the next edition.
- BYLINE: sign the edition with the named author (${author?.name ?? 'the author'}) + title + company.
- Format: clean markdown, section headers, readable. Length: preserve the article's depth (this is a long-form channel).

${authorLine}
${GROUNDING}
${seriesLine}`;

  const xSystem = `You are a thread-native writer turning a researched article into an X (Twitter) THREAD. Conversation register, not a LinkedIn reflow.

${registerEnvelope('x')}

X thread rules:
- TWEET 1 earns the open: ONE core idea or the sharpest number, stated so a scroller stops. No "🧵" spam, no clickbait.
- Each subsequent tweet is ONE scannable unit — a single claim, proof point, or step. Short lines.
- 6-10 tweets. Number them only if it aids reading (1/, 2/ ...) — no forced numbering.
- 2-3 max concrete proof points: a real stat, a real named company, or a real quote from the evidence. Never invent.
- Use the allowed devices: take-a-side, number exchange ("what's your threshold?"), a prediction with a scorecard, or a thread-native cliffhanger that invites the reply.
- Interaction floor: ≥1 genuine device OR a genuinely disputable central claim. Prefer zero bolted-on devices.
- Close with a forward-looking point (frontier POV) + a light question that invites replies. No hashtag spam (max 3), no "X is dead".
- Voice: the profile is "${profileName}". Authored by the named expert.

${authorLine}
${GROUNDING}
${seriesLine}`;

  const [linkedin, youtube, substack, x_thread] = await Promise.all([
    channelChat(env, linkedinSystem, draft, evidence, onUsage),
    channelChat(env, youtubeSystem, draft, evidence, onUsage),
    channelChat(env, substackSystem, draft, evidence, onUsage),
    channelChat(env, xSystem, draft, evidence, onUsage),
  ]);

  return { linkedin, youtube, substack, x_thread, generated_at: new Date().toISOString() };
}