import type { Env } from '../env';
import type { ContentMapItem } from '../types';
import { chatJson, type UsageCallback } from '../lib/llm';

export interface ValidationResult {
  decision: 'PROCEED' | 'PIVOT' | 'KILL';
  reasoning: string;
  suggested_pivot: string | null;
  confidence: number;
}

const SYSTEM = `You are an expert content strategist. Your job is to evaluate whether an article angle is distinct from existing published content.

TASK: Analyze if the proposed angle is NEW and VALUABLE compared to existing articles.

ANALYSIS:
1. Identify the core claim/insight of the proposed angle
2. Compare to existing articles
3. Determine if it is truly novel OR if it is derivative

OUTPUT (JSON only):
- decision: "PROCEED" (distinct, proceed to research) | "PIVOT" (overlaps; suggest a different angle) | "KILL" (too generic or similar)
- reasoning: short explanation (1-2 sentences)
- suggested_pivot: if PIVOT, a concrete alternative angle string; otherwise null
- confidence: 0.0-1.0

Be strict. Do not green-light generic takes.`;

export async function validateAngle(
  env: Env,
  topic: string,
  angle: string,
  existing: ContentMapItem[],
  onUsage?: UsageCallback,
): Promise<ValidationResult> {
  const list = existing
    .slice(0, 60)
    .map((c) => `- [${c.profile ?? 'unknown profile'}] "${c.title}" (angle: ${c.angle ?? 'n/a'}, ${c.publish_date ?? 'no date'})`)
    .join('\n');

  const user = `TOPIC: ${topic}
PROPOSED ANGLE: ${angle}

EXISTING CONTENT:
${list || '(none yet)'}`;

  const result = await chatJson<ValidationResult>(
    env,
    SYSTEM,
    user,
    { temperature: 0.2, maxTokens: 600, onUsage },
  );

  return (
    result ?? {
      decision: 'PROCEED',
      reasoning: 'Validator output was unparseable; defaulting to proceed for resilience.',
      suggested_pivot: null,
      confidence: 0.5,
    }
  );
}