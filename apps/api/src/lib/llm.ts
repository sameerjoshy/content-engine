import type { Env } from '../env';
import type { LlmResult, LlmUsage } from '../types';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL_DEEPSEEK = 'deepseek-chat';
const MODEL_ANTHROPIC = 'claude-sonnet-4-5';
// Approx pricing USD per 1M tokens. Used for cost logging.
const PRICING: Record<string, { input: number; output: number }> = {
  [MODEL_DEEPSEEK]: { input: 0.27, output: 1.1 },
  [MODEL_ANTHROPIC]: { input: 3, output: 15 },
};

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type Provider = 'deepseek' | 'anthropic';

export type UsageCallback = (usage: LlmUsage, latencyMs: number, model?: string) => void;

export interface ChatOptions {
  provider?: Provider;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
  /** Called after each successful LLM response with token usage + latency. */
  onUsage?: UsageCallback;
}

export class LlmError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export function estimateCost(usage: LlmUsage, model: string = MODEL_DEEPSEEK): number {
  const p = PRICING[model] ?? PRICING[MODEL_DEEPSEEK];
  return (usage.prompt_tokens * p.input + usage.completion_tokens * p.output) / 1_000_000;
}

/** True when a frontier (Anthropic) key is present, so Writer/Editor can use Claude. */
export function hasFrontier(env: Env): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

export async function chat(
  env: Env,
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<LlmResult> {
  const provider: Provider = opts.provider ?? 'deepseek';
  return provider === 'anthropic' ? chatAnthropic(env, messages, opts) : chatDeepseek(env, messages, opts);
}

async function chatDeepseek(
  env: Env,
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<LlmResult> {
  const body: Record<string, unknown> = {
    model: opts.model ?? MODEL_DEEPSEEK,
    messages,
    stream: false,
    max_tokens: opts.maxTokens ?? 4000,
    temperature: opts.temperature ?? 0.7,
  };
  if (opts.jsonMode) body.response_format = { type: 'json_object' };

  const startedAt = Date.now();
  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new LlmError(`DeepSeek ${res.status}: ${text.slice(0, 300)}`, res.status);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
    usage: LlmUsage;
  };
  const text = data.choices?.[0]?.message?.content ?? '';
  const usage = data.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const model = opts.model ?? MODEL_DEEPSEEK;
  opts.onUsage?.(usage, Date.now() - startedAt, model);
  return { text, usage, model };
}

async function chatAnthropic(
  env: Env,
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<LlmResult> {
  const model = opts.model ?? MODEL_ANTHROPIC;
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const msgs = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens ?? 4000,
    temperature: opts.temperature ?? 0.7,
    messages: msgs,
  };
  if (system) body.system = system;

  const startedAt = Date.now();
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new LlmError(`Anthropic ${res.status}: ${text.slice(0, 300)}`, res.status);
  }

  const data = (await res.json()) as {
    content: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = (data.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('');
  const usage: LlmUsage = {
    prompt_tokens: data.usage?.input_tokens ?? 0,
    completion_tokens: data.usage?.output_tokens ?? 0,
    total_tokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
  };
  opts.onUsage?.(usage, Date.now() - startedAt, model);
  return { text, usage, model };
}

export async function chatWithRetry(
  env: Env,
  messages: ChatMessage[],
  opts: ChatOptions = {},
  retries = 2,
): Promise<LlmResult> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await chat(env, messages, opts);
    } catch (e) {
      lastErr = e;
      if (i < retries) await sleep(800 * (i + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('LLM call failed');
}

/**
 * Call the LLM and get a JSON object back, with repair + retry logic.
 * Returns null if it cannot produce valid JSON after repairs.
 */
export async function chatJson<T>(
  env: Env,
  system: string,
  user: string,
  opts: ChatOptions = {},
): Promise<T | null> {
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
  const first = await chatWithRetry(env, messages, { ...opts, jsonMode: true });
  const parsed = parseJson<T>(first.text);
  if (parsed) return parsed;

  // Repair pass: ask the model to fix malformed JSON.
  const repair = await chatWithRetry(
    env,
    [
      ...messages,
      { role: 'assistant', content: first.text },
      {
        role: 'user',
        content:
          'Your previous output was not valid JSON. Return ONLY valid JSON matching the requested schema. Do not wrap in markdown fences.',
      },
    ],
    { ...opts, jsonMode: true },
  );
  return parseJson<T>(repair.text);
}

export function parseJson<T>(text: string): T | null {
  const cleaned = stripFences(text).trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to extract the outermost JSON object / array substring.
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    const arrStart = cleaned.indexOf('[');
    const arrEnd = cleaned.lastIndexOf(']');
    const candidates: string[] = [];
    if (start !== -1 && end !== -1 && end > start) candidates.push(cleaned.slice(start, end + 1));
    if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart)
      candidates.push(cleaned.slice(arrStart, arrEnd + 1));
    for (const c of candidates) {
      try {
        return JSON.parse(c) as T;
      } catch {
        // continue
      }
    }
    return null;
  }
}

function stripFences(text: string): string {
  return text.replace(/```json|```/g, '');
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}