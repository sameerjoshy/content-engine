import type { SupabaseClient } from '@supabase/supabase-js';

export interface EventInput {
  session_id: string;
  user_id: string;
  stage: string;
  event_type: string;
  message: string;
  data?: Record<string, unknown>;
  tokens_in?: number;
  tokens_out?: number;
  cost_usd?: number;
  latency_ms?: number;
}

/** Append a row to ce_stage_events. Never throws (logging must not break the run). */
export async function logEvent(db: SupabaseClient, ev: EventInput): Promise<void> {
  try {
    await db.from('ce_stage_events').insert({
      session_id: ev.session_id,
      user_id: ev.user_id,
      stage: ev.stage,
      event_type: ev.event_type,
      message: ev.message,
      data: ev.data ?? null,
      tokens_in: ev.tokens_in ?? null,
      tokens_out: ev.tokens_out ?? null,
      cost_usd: ev.cost_usd ?? null,
      latency_ms: ev.latency_ms ?? null,
    });
  } catch {
    // ignore
  }
}