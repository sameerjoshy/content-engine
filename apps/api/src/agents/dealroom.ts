import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Deal Room — the Sales-engine live deal intelligence agent. It aggregates deal
 * notes, stakeholders, and qualification into one brief with buyer readiness, a
 * risk log, and a suggested next action — the whole deal in one page, minutes
 * before the call.
 *
 * Gates (registry): economic buyer not mentioned in 21 days = top of the risk
 * log. Procurement/legal not mapped = top of the risk log.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the operator's notes,
 * risk ordered by severity, no invented stakeholders.
 */

export interface RiskItem {
  severity: 'critical' | 'high' | 'medium';
  risk: string;
  why: string;
}

export interface Stakeholder {
  name: string;
  role: string | null;
  sentiment: string | null;
}

export interface DealRoomResult {
  brief: string;
  stakeholders: Stakeholder[];
  readiness: { score: number; label: string };
  risk_log: RiskItem[];
  next_action: string;
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface DealRoomInput {
  dealNotes: string;
  stakeholders?: string;
  transcript?: string;
  paperProcess?: string;
  onUsage?: UsageCallback;
}

export async function runDealRoom(env: Env, input: DealRoomInput): Promise<DealRoomResult> {
  const { dealNotes, stakeholders, transcript, paperProcess, onUsage } = input;

  const result = await chatJson<{
    brief: string;
    stakeholders: { name: string; role: string | null; sentiment: string | null }[];
    readiness_label: string;
    economic_buyer_identified: boolean;
    paper_process_mapped: boolean;
    risk_log: { severity: 'critical' | 'high' | 'medium'; risk: string; why: string }[];
    next_action: string;
  }>(
    env,
    `You are a senior deal strategist preparing a pre-call brief. Aggregates the notes, stakeholders, and any transcript into ONE page the seller reads minutes before the call.

RULES:
- Only name stakeholders who appear in the notes/transcript. Never invent people.
- economic_buyer_identified: true ONLY if a person who can reallocate budget (CFO/CEO/owner/VP with budget authority) is named AND engaged. If the notes merely mention the phrase "no economic buyer" or leave it unknown, this must be false.
- paper_process_mapped: true ONLY if legal/procurement/security review is actively underway with a known path. "not started"/"unknown"/absent = false.
- Risk log: order by severity (critical → high → medium). Each risk states what could kill the deal and why.
- brief: a tight paragraph — where the deal is, what changed, what's unresolved.
- next_action: the single best next move, stated plainly.
- Do not soften the truth; do not invent detail the notes don't support.

DEAL NOTES:
${dealNotes}
${stakeholders ? `\nSTAKEHOLDERS:\n${stakeholders}` : ''}
${transcript ? `\nLAST CALL TRANSCRIPT:\n${transcript.slice(0, 4000)}` : ''}
${paperProcess ? `\nPAPER PROCESS:\n${paperProcess}` : ''}

Return JSON: {"brief": "...", "stakeholders": [{"name","role","sentiment"}], "readiness_label": "one of: Strong / Progressing / At risk / Stalled", "economic_buyer_identified": bool, "paper_process_mapped": bool, "risk_log": [{"severity","risk","why"}], "next_action": "..."}`,
    `Build the deal brief and risk log.`,
    { temperature: 0.3, maxTokens: 2600, onUsage },
  );

  const risk_log: RiskItem[] = (result?.risk_log ?? [])
    .map((r) => ({ severity: (['critical', 'high', 'medium'].includes(r.severity) ? r.severity : 'medium') as RiskItem['severity'], risk: r.risk ?? '', why: r.why ?? '' }))
    .sort((a, b) => ({ critical: 0, high: 1, medium: 2 }[a.severity] - { critical: 0, high: 1, medium: 2 }[b.severity]));

  const gates: { gate: string; note: string }[] = [];
  if (result?.economic_buyer_identified === false) {
    if (!risk_log.some((r) => /economic buyer/i.test(r.risk))) {
      risk_log.unshift({ severity: 'critical', risk: 'Economic buyer not identified', why: 'No one who can reallocate budget is engaged. Until they are, the deal can stall without warning.' });
    }
    gates.push({ gate: 'Escalation gate', note: 'No economic buyer engaged — this stays the top risk until a budget holder is in the room.' });
  }
  if (result?.paper_process_mapped === false) {
    if (!risk_log.some((r) => /paper|procurement|legal/i.test(r.risk))) {
      risk_log.unshift({ severity: 'critical', risk: 'Paper process not mapped', why: 'Legal/procurement/security review not underway is a hidden multi-week cycle.' });
    }
    gates.push({ gate: 'Procurement gate', note: 'Procurement/legal review is not mapped — timeline risk is unquantified.' });
  }
  risk_log.sort((a, b) => ({ critical: 0, high: 1, medium: 2 }[a.severity] - { critical: 0, high: 1, medium: 2 }[b.severity]));

  const label = result?.readiness_label ?? 'Progressing';
  const scoreMap: Record<string, number> = { Strong: 85, Progressing: 60, 'At risk': 35, Stalled: 15 };
  const score = scoreMap[label] ?? 55;

  return {
    brief: result?.brief ?? 'Deal brief unavailable.',
    stakeholders: (result?.stakeholders ?? []).slice(0, 10),
    readiness: { score, label },
    risk_log: risk_log.slice(0, 6),
    next_action: result?.next_action ?? 'Review the notes and confirm the next step.',
    gates,
    measured_vs_inferred: {
      measured: ['Deal notes, stakeholders, transcript (as provided)', 'Economic-buyer + paper-process gates (computed)'],
      inferred: ['Readiness label', 'Risk severity ordering', 'Next action'],
    },
  };
}