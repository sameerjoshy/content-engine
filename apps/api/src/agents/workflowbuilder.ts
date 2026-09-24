import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Workflow Builder — the Operations-engine RevOps automation architect. Turns a
 * plain-language process decision into an implementation-ready CRM workflow
 * specification: trigger, conditions, actions, and edge cases.
 *
 * Gate (registry): Ambiguity gate — an ambiguous description surfaces clarifying
 * questions rather than guessing.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the described process,
 * the spec complete enough to build, honest when the ask is unclear.
 */

export interface WorkflowResult {
  verdict: string;
  platform: string;
  spec: { trigger: string; conditions: string[]; actions: string[]; edge_cases: string[] };
  clarifying_questions: string[];
  ready_to_build: boolean;
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface WorkflowInput {
  processDescription: string;
  platform?: string;
  onUsage?: UsageCallback;
}

export async function runWorkflowBuilder(env: Env, input: WorkflowInput): Promise<WorkflowResult> {
  const { processDescription, platform, onUsage } = input;

  const result = await chatJson<{
    verdict: string;
    trigger: string;
    conditions: string[];
    actions: string[];
    edge_cases: string[];
    clarifying_questions: string[];
    ambiguous: boolean;
  }>(
    env,
    `You are a RevOps automation architect. Turn the plain-language process into an implementation-ready ${platform || 'CRM'} workflow spec.

RULES:
- spec: trigger (the exact event that starts it), conditions (the if-logic), actions (the do-this, in order), edge_cases (what breaks it and how to handle it).
- If the description is AMBIGUOUS — missing the trigger, unclear who owns a step, undefined thresholds — set ambiguous to true and list the specific clarifying questions. Do NOT guess at the gaps.
- clarifying_questions: the questions that must be answered before this can be built. Empty if the description is complete.
- Be concrete enough that a RevOps admin could build it without asking you anything. Use real field names where the platform implies them.
- Work ONLY from the description provided.

PLATFORM: ${platform || 'not specified'}

PROCESS DESCRIPTION:
${processDescription}

Return JSON: {"verdict": "...", "trigger": "...", "conditions": ["..."], "actions": ["..."], "edge_cases": ["..."], "clarifying_questions": ["..."], "ambiguous": bool}`,
    `Produce the CRM workflow specification, or the questions that block it.`,
    { temperature: 0.25, maxTokens: 2600, onUsage },
  );

  const questions = (result?.clarifying_questions ?? []).slice(0, 8);
  const ambiguous = result?.ambiguous === true || questions.length > 0;
  const readyToBuild = !ambiguous;

  const gates: { gate: string; note: string }[] = [];
  if (ambiguous) {
    gates.push({ gate: 'Ambiguity gate', note: `${questions.length || 'The'} open question${questions.length === 1 ? '' : 's'} must be answered before this is buildable — the spec is surfaced with the gaps, not guessed around.` });
  }
  if (!platform) {
    gates.push({ gate: 'Platform gate', note: 'No CRM platform specified — field names and actions are generic. Name the platform (HubSpot / Salesforce) for a buildable spec.' });
  }

  return {
    verdict: result?.verdict ?? 'Spec unavailable.',
    platform: platform || 'unspecified',
    spec: {
      trigger: result?.trigger ?? '',
      conditions: (result?.conditions ?? []).slice(0, 10),
      actions: (result?.actions ?? []).slice(0, 12),
      edge_cases: (result?.edge_cases ?? []).slice(0, 8),
    },
    clarifying_questions: questions,
    ready_to_build: readyToBuild,
    gates,
    measured_vs_inferred: {
      measured: ['Process description + platform (as provided)', 'Ambiguity + readiness (computed)'],
      inferred: ['Trigger/conditions/actions', 'Edge cases', 'Clarifying questions'],
    },
  };
}