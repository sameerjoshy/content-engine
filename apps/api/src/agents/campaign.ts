import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Campaign Builder — the Marketing-engine campaign architect. Turns one message
 * and one segment into a multi-channel plan: a narrative arc, a channel mix, a
 * dated content calendar, and the asset list to produce.
 *
 * Gate (registry): Segment gate — a campaign must target a defined segment,
 * never everyone. A vague "target market" gets flagged, not planned around.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the message and segment,
 * dated and concrete, honest when the segment is too broad to aim at.
 */

export interface CampaignResult {
  verdict: string;
  segment: string;
  arc: { phase: string; message: string; goal: string }[];
  calendar: { when: string; channel: string; asset: string; cta: string }[];
  assets: { asset: string; channel: string; due: string }[];
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface CampaignInput {
  message: string;
  segment: string;
  window?: string;
  channels?: string;
  onUsage?: UsageCallback;
}

// Words that mean "no real segment" — the Segment gate fires on these.
const BROAD = /^(everyone|everybody|all|anyone|all businesses|the market|general|broad|smb|b2b|all companies|any company)$/i;

export async function runCampaignBuilder(env: Env, input: CampaignInput): Promise<CampaignResult> {
  const { message, segment, window: win, channels, onUsage } = input;

  const result = await chatJson<{
    verdict: string;
    arc: { phase: string; message: string; goal: string }[];
    calendar: { when: string; channel: string; asset: string; cta: string }[];
    assets: { asset: string; channel: string; due: string }[];
  }>(
    env,
    `You are a campaign architect. Turn ONE message and ONE segment into a multi-channel campaign: a narrative arc, a dated calendar, and the asset list.

RULES:
- The campaign targets the DEFINED segment. If the segment is broad ("everyone", "all businesses"), say so in the verdict and plan for the narrowest credible cut — never plan a campaign for everyone.
- arc: the narrative across the campaign — 3-4 phases, each with the message at that stage and its goal (e.g. Hook → Proof → Objection → Ask). The message must stay one message, told in stages.
- calendar: dated entries across the window — when, which channel, which asset, which CTA. Concrete dates/weeks, not "week 1-4".
- assets: what to produce, its channel, and when it's due (working back from the calendar).
- Only propose channels that fit the segment. Do not default to "post everywhere".
- verdict: one operator line on whether this campaign can reach the segment.

MESSAGE: ${message}
SEGMENT: ${segment}
WINDOW: ${win || 'not specified — assume a 6-week campaign'}
${channels ? `PREFERRED CHANNELS: ${channels}` : ''}

Return JSON: {"verdict": "...", "arc": [{"phase","message","goal"}], "calendar": [{"when","channel","asset","cta"}], "assets": [{"asset","channel","due"}]}`,
    `Design the campaign arc, calendar, and asset list for this message and segment.`,
    { temperature: 0.35, maxTokens: 3000, onUsage },
  );

  const gates: { gate: string; note: string }[] = [];
  const seg = segment.trim();
  if (!seg || BROAD.test(seg) || seg.split(/\s+/).length <= 2) {
    gates.push({ gate: 'Segment gate', note: `"${seg || 'no segment given'}" is not a defined segment — a campaign for everyone reaches no one. Narrow it before building assets.` });
  }
  if (!win) {
    gates.push({ gate: 'Timing gate', note: 'No campaign window given — the calendar is illustrative, not scheduled.' });
  }

  return {
    verdict: result?.verdict ?? 'Campaign plan unavailable.',
    segment: seg || 'undefined',
    arc: (result?.arc ?? []).slice(0, 5).map((a) => ({ phase: a.phase ?? '', message: a.message ?? '', goal: a.goal ?? '' })),
    calendar: (result?.calendar ?? []).slice(0, 20).map((c) => ({ when: c.when ?? '', channel: c.channel ?? '', asset: c.asset ?? '', cta: c.cta ?? '' })),
    assets: (result?.assets ?? []).slice(0, 15).map((a) => ({ asset: a.asset ?? '', channel: a.channel ?? '', due: a.due ?? '' })),
    gates,
    measured_vs_inferred: {
      measured: ['Message + segment + window (as provided)', 'Segment-definition gate (computed)'],
      inferred: ['Narrative arc', 'Calendar dates', 'Asset list'],
    },
  };
}