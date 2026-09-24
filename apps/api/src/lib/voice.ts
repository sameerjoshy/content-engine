import type { ContentFormat } from '../types';

/**
 * Code-side derivation of VOICE_SYSTEM.md v1.2. The doc is authoritative;
 * these constants are derived from it. Keep them in sync when the doc changes.
 */

// ── Format registers (VOICE_SYSTEM.md §5) ──────────────────────────────────
// Content formats (article/howto/best_practice) are all LONG-FORM → the
// Operator register. The channel registers below apply at distribution time.
export interface Register {
  name: string;
  hardSoft: [number, number]; // hard : soft
  interactionFloor: '0-1' | 'device-or-disputable';
  allowedDevices: string[];
}

export const CHANNEL_REGISTERS: Record<string, Register> = {
  article: { name: 'Operator', hardSoft: [65, 35], interactionFloor: '0-1', allowedDevices: ['earned puzzlement', 'one real closing question', 'steelman'] },
  substack: { name: 'Editorial', hardSoft: [55, 45], interactionFloor: '0-1', allowedDevices: ['open loop + reply CTA', 'direct address'] },
  linkedin: { name: 'Feed', hardSoft: [45, 55], interactionFloor: 'device-or-disputable', allowedDevices: ['take-a-side', 'number exchange', 'provocation hook', 'prediction', 'open loop'] },
  x: { name: 'Conversation', hardSoft: [40, 60], interactionFloor: 'device-or-disputable', allowedDevices: ['take-a-side', 'number exchange', 'prediction', 'open loop', 'thread-native cliffhangers'] },
};

// v1.2: hard is defined per register. Long-form hard = sourced evidence +
// citation density; feed hard = claim specificity + named detail + stakes.
export function hardDefinition(register: Register): string {
  const isFeed = register.hardSoft[1] > 50;
  return isFeed
    ? 'hard intelligence on this channel = claim specificity + named detail + stakes (this is NOT a soft channel — your hard intel is specificity, not citation density)'
    : 'hard intelligence on this channel = sourced evidence + citation density + proof mix';
}

export function registerEnvelope(channel: 'article' | 'substack' | 'linkedin' | 'x'): string {
  const r = CHANNEL_REGISTERS[channel];
  return `REGISTER (${r.name} — hard:soft ${r.hardSoft[0]}:${r.hardSoft[1]}):
- ${hardDefinition(r)}
- Interaction floor: ${r.interactionFloor === '0-1' ? '0–1 device, optional — never decorative' : '≥1 genuine interaction device OR a central claim that is genuinely disputable. Prefer ZERO bolted-on devices over one that is decorative.'}
- Allowed devices: ${r.allowedDevices.join(', ')}
- One device that grows out of the argument's actual tension beats three bolted-on triggers. The strongest engagement comes from the insight itself creating disagreement; devices are scaffolding, never the goal.`;
}

// ── Base voice v2 (VOICE_SYSTEM.md §2) ──────────────────────────────────────
export const BASE_VOICE_V2 = `BASE VOICE v2 (how to write so it reads like a person with scar tissue, not a machine):
- SPECIFIC OVER VAGUE. Name the actual number, the actual company, the actual trade-off. Vague = machine. "Reps in low-potential territories are set up to fail regardless of skill" beats "Territory design impacts performance."
- VARY RHYTHM. A long observation, then a short punch. Machines write in uniform rhythm; humans breathe.
- SHOW TENSION AND STAKES. Say what's at risk and what it costs. "Your best rep quits" beats "retention matters".
- HAVE A POV; TAKE SIDES. "Both camps are wrong" is human; "there are different perspectives" is machine. Every strong claim gets a because and a named detail.
- INCLUDE THE GOTCHA / TRADE-OFF. A person who's done it knows where it breaks. Say "here's where this falls apart".
- SCOPED CERTAINTY (v1.2). State the number firmly, then give the boundary where it stops being true ("2.3x ARR — in a market with exactly one buyer"). Cowardice hedges; operators scope-limit. Never hedge a fact out of caution.
- CHANGED-MIND PATTERN (v1.2, only when provided in the POV block). The chronological flip: "In 2021 I wrote that X. Three portfolio companies later, I watched X fail the same way each time. Here's what I got wrong." Self-correction on record. NEVER fabricate the flip.
- EDGE IS EARNED, NOT PERFORMED (ONE edge moment MAX — hard limit, never announced). Specificity before opinion; stakes, not takes; understatement for the biggest claims ("It's worth noting no strategic buyer showed up" is more damning than "Miro is dead"). No meta-labels ("Let's be brutally honest", "Contrarian take:"), no performative hotness ("X is dead").
- EARNED UNCERTAINTY. Confidence on facts, curiosity on meaning. State the numbers firmly; be genuinely puzzled about the interpretation. Puzzlement must be earned (first show the homework). One honest open loop per piece, at the interpretation level — never the facts.
- UNCERTAINTY IS A FEELING, NOT A CHECKLIST (v1.2.1). "What would have to be true" as a bulleted verification list is TESTING, not puzzlement — it reads like an audit trail. Real earned uncertainty ends in one specific thing you can't settle, stated as confusion: "The part I genuinely can't make sense of is whether one exit actually shifts buyer behavior, or whether this is cap-table pressure wearing a market-narrative costume." Test the thesis in your head, then publish the ONE variable that genuinely confuses you.
- STEELMAN VARIES, NEVER A FIXED THREE-BEAT (v1.2.1). The objection → concession → "here's why the thesis survives" structure repeated is a machine tell. Sometimes concede fully and leave the hole in the argument; sometimes the steelman IS the puzzlement. If a section's shape is predictable before you read it, rewrite it.
- NO META-DEFENSIVENESS (v1.2.1). "I cannot verify this", "as far as I can tell", "reportedly", "if that number is accurate" — used to undercut a claim the dossier supports, or to hedge your own POV — read as apology, not rigor. State the fact confidently, then scope-limit (say where it stops being true). Scoped certainty, never caveat-stacking.
- EXPERIENCE HOOK. Specifically recognizable, never generic: "If you've had a board meeting where you stopped believing your own valuation" — not "leaders sometimes struggle with valuation".
- First-person judgment only when earned — from the evidence or from the POV block, never from a fabricated personal story.
- ANTI-HALLUCINATION IS ABSOLUTE: never fake a statistic, quote, company, or personal anecdote. All specificity comes from the dossier or the POV block.`;

// ── Ban lists (VOICE_SYSTEM.md §7, deterministic, checkable) ───────────────
export interface BanRule {
  category: 'machine_tell' | 'slop_edge' | 'brand_violation' | 'defensive_hedge';
  label: string;
  re: RegExp;
}

const re = (s: string | RegExp, flags = 'i') => new RegExp(s, flags);

export const BAN_RULES: BanRule[] = [
  // 7a machine tells
  { category: 'machine_tell', label: 'fast-paced-world', re: re(/in today'?s fast-?paced world/) },
  { category: 'machine_tell', label: 'important-to-note', re: re(/it'?s important to note/) },
  { category: 'machine_tell', label: 'delve', re: re(/\bdelve\b/) },
  { category: 'machine_tell', label: 'unlock', re: re(/\bunlock\b/) },
  { category: 'machine_tell', label: 'seamless', re: re(/\bseamless(ly)?\b/) },
  { category: 'machine_tell', label: 'leverage', re: re(/\bleverage\b/) },
  { category: 'machine_tell', label: 'elevate', re: re(/\belevate\b/) },
  { category: 'machine_tell', label: 'game-changer', re: re(/\bgame-?changer\b/) },
  { category: 'machine_tell', label: 'at-its-core', re: re(/at its core/) },
  { category: 'machine_tell', label: 'deeper-issue', re: re(/the deeper issue/) },
  { category: 'machine_tell', label: 'heart-of-matter', re: re(/the heart of the matter/) },
  { category: 'machine_tell', label: 'lets-dive-in', re: re(/let'?s dive in/) },
  { category: 'machine_tell', label: 'lets-explore', re: re(/let'?s explore/) },
  { category: 'machine_tell', label: 'what-you-need-to-know', re: re(/here'?s what you need to know/) },
  { category: 'machine_tell', label: 'to-be-clear', re: re(/to be clear/) },
  { category: 'machine_tell', label: 'dont-get-me-wrong', re: re(/don'?t get me wrong/) },
  { category: 'machine_tell', label: 'honestly', re: re(/^honestly,?\s/i) },
  { category: 'machine_tell', label: 'the-thing-is', re: re(/the thing is/) },
  { category: 'machine_tell', label: 'read-that-again', re: re(/read that again/) },
  { category: 'machine_tell', label: 'let-that-sink-in', re: re(/let that sink in/) },
  { category: 'machine_tell', label: 'thats-the-real-win', re: re(/that'?s the real win/) },
  { category: 'machine_tell', label: 'it-is-also-possible', re: re(/it'?s also possible/) },
  { category: 'machine_tell', label: 'might-arguably', re: re(/might arguably/) },
  { category: 'machine_tell', label: 'could-potentially', re: re(/could potentially/) },
  { category: 'machine_tell', label: 'to-be-fair', re: re(/to be fair/) },
  { category: 'machine_tell', label: 'not-just-but', re: re(/not just [^.]{1,80},? (but|rather|yet) /) },
  // 7b AI-edge-slop tells
  { category: 'slop_edge', label: 'brutally-honest', re: re(/let'?s be brutally honest/) },
  { category: 'slop_edge', label: 'contrarian-take', re: re(/contrarian take:/) },
  { category: 'slop_edge', label: 'hot-take', re: re(/hot take:/) },
  { category: 'slop_edge', label: 'unpopular-opinion', re: re(/unpopular opinion/) },
  { category: 'slop_edge', label: 'uncomfortable-truth', re: re(/the uncomfortable truth/) },
  { category: 'slop_edge', label: 'x-is-dead', re: re(/[^.!?]+\bis dead\b/) },
  { category: 'slop_edge', label: 'x-is-over', re: re(/[^.!?]+\bis over\b/) },
  { category: 'slop_edge', label: 'x-is-broken', re: re(/[^.!?]+\bis broken\b/) },
  { category: 'slop_edge', label: 'contrast-formula', re: re(/it'?s not [^.]{1,90},\s*it'?s [^.]+/) },
  { category: 'slop_edge', label: 'split-contrast', re: re(/this does not mean [^.]{1,60}\. It means [^.]+/) },
  // 7d brand violations
  { category: 'brand_violation', label: 'doing-it-wrong', re: re(/you'?re doing it wrong|you lack strategy|you need education/) },
  { category: 'brand_violation', label: 'ai-powered', re: re(/ai-?powered growth|autonomous revenue|ai-?driven magic/) },
  { category: 'brand_violation', label: 'book-a-demo', re: re(/book a demo|unlock growth/) },
  { category: 'brand_violation', label: 'scare-tactic', re: re(/\b(bleeding|chaos|disaster)\b/) },
  // v1.2.1 meta-defensiveness: apology-tone hedges that undercut the author's
  // own claims or supported facts. Counted in the composite; the editor flags
  // when they undercut a supported claim rather than scope-limiting.
  { category: 'defensive_hedge', label: 'i-cannot-verify', re: re(/i (cannot|cannot|can'?t) verify/) },
  { category: 'defensive_hedge', label: 'as-far-as-i-can-tell', re: re(/as far as i can tell/) },
  { category: 'defensive_hedge', label: 'reportedly', re: re(/\breportedly\b/) },
  { category: 'defensive_hedge', label: 'if-accurate', re: re(/if (that number|this|the figure) is accurate/) },
  { category: 'defensive_hedge', label: 'nobody-publishing', re: re(/nobody publishing/) },
];

export interface BanViolation {
  category: BanRule['category'];
  label: string;
  snippet: string;
}

export function banListViolations(text: string): BanViolation[] {
  const out: BanViolation[] = [];
  for (const rule of BAN_RULES) {
    const m = text.match(rule.re);
    if (m) {
      const start = Math.max(0, (m.index ?? 0) - 30);
      out.push({ category: rule.category, label: rule.label, snippet: text.slice(start, start + 90).replace(/\s+/g, ' ').trim() });
    }
  }
  return out;
}

export function countEdgeTells(text: string): number {
  return BAN_RULES.filter((r) => r.category === 'slop_edge').reduce((n, r) => {
    const ms = text.match(new RegExp(r.re.source, 'gi'));
    return n + (ms ? ms.length : 0);
  }, 0);
}

// ── Interaction devices (VOICE_SYSTEM.md §6) ───────────────────────────────
export interface DeviceCheck {
  present: boolean;
  devices: string[];
}

export function interactionDeviceCheck(text: string, channel: 'article' | 'substack' | 'linkedin' | 'x'): DeviceCheck {
  const t = text.trim();
  const devices: string[] = [];
  if (/(what'?s (yours|your [^.?]{0,40}))|what (number|multiple|threshold) (do|is)/i.test(t)) devices.push('number exchange');
  else if (/\?[”"']?$/.test(t) && /\b(your|you)\b/i.test(t)) devices.push('number exchange / question');
  if (/(by (q[1-4]|20\d\d|the end of)|over the next \d+ (months|quarters))/i.test(t) && /\bwill\b/i.test(t)) devices.push('prediction');
  if (/i was wrong|i'?ve changed my mind|i used to think/i.test(t)) devices.push('i-was-wrong');
  if (/if you'?re wondering|everyone is (doing|asking)|you'?re not alone/i.test(t)) devices.push('normalizing');
  if (/steelman|the other side (has|makes|would)|argument for the (other|opposite)/i.test(t)) devices.push('steelman');
  if (/(is|are|was|were)\s+(dead|over|wrong|underrated|overrated|not worth)/i.test(t)) devices.push('take-a-side');
  if (/if you'?ve (sat|been|watched|had|built|led|priced|sold)|you'?ve (sat|been|watched)/i.test(t)) devices.push('relatable hook');
  if (/\?[”"']?$/.test(t)) devices.push('open loop');
  const feed = channel === 'linkedin' || channel === 'x';
  const present = feed ? devices.length > 0 : true;
  return { present, devices };
}

// ── Edge-moment constraint (VOICE_SYSTEM.md §2b) ───────────────────────────
export const EDGE_MOMENT_LIMIT = `EDGE MOMENT LIMIT (hard constraint): ONE earned edge moment max per piece — never announced, never meta-labeled ("Let's be brutally honest", "Contrarian take:"), never performative ("X is dead"). Edge is earned via mechanism: specificity before opinion, stakes not takes, understatement for the biggest claims. Flag any attempt to perform multiple edge moments.`;

export const POV_QUESTION = `Do we have an experience-based observation that changes the interpretation of this evidence? If yes, use it (it is the proprietary POV). If no, say so and do not fabricate one.`;

// ── Long-form register for the writer (all content formats) ────────────────
export const LONG_FORM_ENVELOPE = registerEnvelope('article');