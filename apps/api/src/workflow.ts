import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep, type WorkflowStepConfig } from 'cloudflare:workers';
import type { Env } from './env';
import type { Depth, ContentFormat, EvidenceItem, Profile, Series, WorkflowParams } from './types';
import { getDb } from './lib/db';
import { logEvent } from './lib/events';
import { estimateCost, type UsageCallback } from './lib/llm';
import { validateAngle, type ValidationResult } from './agents/validator';
import { buildSpec } from './agents/spec';
import { writeArticle } from './agents/writer';
import type { SoWhatResult as SoWhatVerdict } from './agents/sowhat';

interface LoadedSession {
  id: string;
  user_id: string;
  topic: string;
  angle: string;
  depth: Depth;
  format?: 'article' | 'howto' | 'best_practice';
  series?: { name: string; part?: number; total?: number } | null;
  review_research?: boolean;
  skip_sowhat?: boolean;
  profile_snapshot: any;
}

const MIN = 60_000;
const cfg = (timeoutMs: number): WorkflowStepConfig => ({
  retries: { limit: 2, delay: 3000, backoff: 'exponential' },
  timeout: timeoutMs,
});

/**
 * Durable orchestrator. One instance per article session.
 * Steps are idempotent (drafts upserted, evidence deleted+reinserted) so retries
 * are safe. Heavy content lives in Supabase, not in workflow state.
 */
export class ArticleWorkflow extends WorkflowEntrypoint<Env, WorkflowParams> {
  async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep) {
    const { session_id: sessionId, user_id: userId } = event.payload;
    const env = this.env;
    const db = getDb(env);

    try {
      await this.execute(event, step);
    } catch (e) {
      // Last-resort failure guard: if any step throws past its retries, mark
      // the session errored so the UI stops polling and shows a real message
      // instead of spinning forever on 'in_progress'.
      const msg = e instanceof Error ? e.message : 'Workflow failed';
      try {
        await db
          .from('ce_sessions')
          .update({ status: 'error', error_message: msg, updated_at: new Date().toISOString() })
          .eq('id', sessionId);
        await logEvent(db, {
          session_id: sessionId,
          user_id: userId,
          stage: 'error',
          event_type: 'error',
          message: `Workflow failed: ${msg}`,
        });
      } catch {
        // even logging failed — nothing more we can do
      }
      throw e;
    }
  }

  private async execute(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep) {
    const { session_id: sessionId, user_id: userId } = event.payload;
    const env = this.env;
    const db = getDb(env);

const log = (stage: string, eventType: string, message: string, data?: unknown) =>
      logEvent(db, {
        session_id: sessionId,
        user_id: userId,
        stage,
        event_type: eventType,
        message,
        data: data as Record<string, unknown> | undefined,
      });

    // Log every LLM call (tokens + cost) for the current stage.
    const usageLogger = (stage: string): UsageCallback => (usage, latencyMs, model) =>
      logEvent(db, {
        session_id: sessionId,
        user_id: userId,
        stage,
        event_type: 'llm_call',
        message: `LLM call${model ? ` (${model})` : ''}`,
        tokens_in: usage.prompt_tokens,
        tokens_out: usage.completion_tokens,
        cost_usd: estimateCost(usage, model),
        latency_ms: latencyMs,
      });

    const setSession = (fields: Record<string, unknown>) =>
      db.from('ce_sessions').update(fields).eq('id', sessionId);

    const upsertDraft = (stage: string, content: string, meta?: Record<string, unknown>) =>
      db
        .from('ce_drafts')
        .upsert(
          { session_id: sessionId, user_id: userId, stage, content, meta: meta ?? null },
          { onConflict: 'session_id,stage' },
        );

    const session = await step.do(
      'load session',
      cfg(1 * MIN),
      async () => {
const { data, error } = await db
          .from('ce_sessions')
          .select('id,user_id,topic,angle,depth,format,series,review_research,skip_sowhat,profile_snapshot,current_stage,status')
          .eq('id', sessionId)
          .single();
        if (error || !data) throw new Error('Session not found');
        return data as unknown as LoadedSession;
      },
    );

const topic = session.topic;
    const angle = session.angle;
    const depth = session.depth;
    const format = session.format ?? 'article';
    const series = session.series ?? null;
    const profile = session.profile_snapshot;
    if (!profile) throw new Error('Profile snapshot missing');

    // ---- Stage 1: Angle Validator -----------------------------------------
    const validation = await step.do(
      'validate angle',
      cfg(5 * MIN),
      async () => {
        await setSession({ current_stage: 'validator', status: 'in_progress' });
        await log('validator', 'stage_start', 'Checking angle against existing content');
        const { data: existing } = await db
          .from('ce_content_map')
          .select('id,title,angle,publish_date,profile,status,url')
          .eq('user_id', userId)
          .limit(100);
        const decision = await validateAngle(env, topic, angle, existing ?? [], usageLogger('validator'));
        await log('validator', 'thinking', decision.reasoning, {
          decision: decision.decision,
          confidence: decision.confidence,
          suggested_pivot: decision.suggested_pivot,
        });
        await upsertDraft(
          'validator',
          `## Angle Validator Decision\n\n**Decision:** ${decision.decision}\n\n**Reasoning:** ${decision.reasoning}\n\n**Confidence:** ${decision.confidence}${
            decision.suggested_pivot ? `\n\n**Suggested pivot:** ${decision.suggested_pivot}` : ''
          }`,
          { decision },
        );
        await setSession({
          decision,
          status: decision.decision === 'PROCEED' ? 'in_progress' : decision.decision.toLowerCase(),
        });
        await log(
          'validator',
          decision.decision === 'PROCEED' ? 'stage_end' : 'error',
          decision.decision === 'PROCEED'
            ? 'Angle is distinct. Proceeding to research.'
            : `Angle rejected: ${decision.reasoning}`,
          decision as unknown as Record<string, unknown>,
        );
        return { decision: decision.decision } as const;
      },
    );

if (validation.decision === 'PIVOT' || validation.decision === 'KILL') return;

    // Hibernate between stages so each stage runs in a fresh Worker invocation.
    // On the Workers Free plan the subrequest budget (50) is per invocation;
    // without these gaps consecutive steps would share one budget and exhaust
    // it partway through the pipeline.
    const gap = () => step.sleep('stage gap', '1 second');

// ---- Stage 2: Researcher ----------------------------------------------
    // Delegated to the internal self-binding endpoint so the whole research
    // pipeline (queries → search → fetch → relevance → extract → synthesize →
    // persist) runs in ONE fresh Worker invocation with its own subrequest
    // budget. The Workflows Free plan shares a ~50-subrequest budget across
    // ALL steps in an instance; running research inline would exhaust it.
    const research = await step.do(
      'research pipeline',
      cfg(12 * MIN),
      async () => {
        if (!env.WORKER_SELF || !env.AUTH_HOOK_SECRET) {
          throw new Error('WORKER_SELF binding or AUTH_HOOK_SECRET not configured');
        }
        const res = await env.WORKER_SELF.fetch('https://WORKER_SELF/internal/research', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.AUTH_HOOK_SECRET}`,
          },
          body: JSON.stringify({ session_id: sessionId, user_id: userId, format }),
        });
        const result = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          evidence_count?: number;
          doc_count?: number;
          queries?: number;
        };
        if (!res.ok || !result.ok) {
          throw new Error(result.error ?? `Research pipeline failed (${res.status})`);
        }
        await log('researcher', 'stage_end', `Research complete: ${result.evidence_count ?? 0} evidence items`);
        return result;
      },
    );

void research;

    // ---- Research review gate (human-in-the-loop) ---------------------------
    // When review_research is set, pause after research and wait for a human to
    // review the dossier + evidence before writing. The workflow hibernates
    // (free, no subrequests) until POST /api/research-approve/:id or
    // /api/research-steer/:id fires the event. On timeout (7 days) we proceed —
    // review is a quality gate, not a blocker.
    if (session.review_research) {
      await gap();
      await step.do(
        'research review',
        cfg(1 * MIN),
        async () => {
          await setSession({ current_stage: 'research_review', status: 'awaiting_review' });
          await log('research_review', 'stage_start', 'Research ready — waiting for your review');
          return { ok: true } as const;
        },
      );
      try {
        await step.waitForEvent('research_approval', {
          type: 'research_approval',
          timeout: '7 days',
        });
        await log('research_review', 'stage_end', 'Research approved — proceeding to write');
      } catch {
        await log('research_review', 'stage_end', 'Review timed out — proceeding with current research');
      }
      await setSession({ current_stage: 'spec_builder', status: 'in_progress' });
    }

// ---- Stage 3: Spec Builder ---------------------------------------------
    await gap();
    await step.do(
      'spec builder',
      cfg(5 * MIN),
      async () => {
        await setSession({ current_stage: 'spec_builder', status: 'in_progress' });
        await log('spec_builder', 'stage_start', 'Building writer specification');
        const { data } = await db
          .from('ce_drafts')
          .select('content')
          .eq('session_id', sessionId)
          .eq('stage', 'researcher')
          .single();
const dossierMd = (data as unknown as { content: string } | null)?.content ?? '';
        const md = await buildSpec(env, profile as unknown as Profile, dossierMd, topic, angle, usageLogger('spec_builder'), format, series);
        await upsertDraft('spec_builder', md);
        await log('spec_builder', 'stage_end', 'Specification ready');
        return { ok: true } as const;
      },
    );

// ---- Stage 3.5: So-what gate (demand check before the writer spends words) --
// VOICE_SYSTEM.md §8 step 6. Kills/steers cold demand; operator override via
// skip_sowhat. STEER carries a suggestion into the writer's angle.
    let soWhatSteer: string | null = null;
    if (!session.skip_sowhat) {
      await gap();
      const gateResult = await step.do(
        'so-what gate',
        cfg(6 * MIN),
        async () => {
          if (!env.WORKER_SELF || !env.AUTH_HOOK_SECRET) {
            throw new Error('WORKER_SELF binding or AUTH_HOOK_SECRET not configured');
          }
          await setSession({ current_stage: 'sowhat', status: 'in_progress' });
          await log('sowhat', 'stage_start', 'Checking whether the question is actually burning right now');
          // Self-bound so the gate's search subrequests run in a fresh Worker
          // invocation with its own ~50-subrequest budget (same pattern as research).
          const res = await env.WORKER_SELF.fetch('https://WORKER_SELF/internal/sowhat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${env.AUTH_HOOK_SECRET}`,
            },
            body: JSON.stringify({ session_id: sessionId, user_id: userId, topic, angle }),
          });
          const data = (await res.json().catch(() => ({}))) as { ok?: boolean; verdict?: SoWhatVerdict; error?: string };
          if (!res.ok || !data.ok || !data.verdict) {
            throw new Error(data.error ?? `So-what gate failed (${res.status})`);
          }
          const verdict = data.verdict;
          await log('sowhat', 'thinking', verdict.signal, {
            decision: verdict.decision,
            demand_score: verdict.demand_score,
            recency: verdict.recency_note,
            steer: verdict.steer_suggestion,
          });
          await upsertDraft(
            'sowhat',
            `## So-what gate\n\n**Decision:** ${verdict.decision}\n\n**Demand score:** ${verdict.demand_score.toFixed(2)}\n\n**Signal:** ${verdict.signal}\n\n**Recency:** ${verdict.recency_note}${verdict.steer_suggestion ? `\n\n**Steer suggestion:** ${verdict.steer_suggestion}` : ''}`,
            { decision: verdict.decision, demand_score: verdict.demand_score, steer_suggestion: verdict.steer_suggestion },
          );
          if (verdict.decision === 'KILL') {
            await setSession({ status: 'killed', error_message: `So-what gate: no live demand for this question. ${verdict.signal}` });
            await log('sowhat', 'error', `Killed — demand is cold: ${verdict.signal}`, verdict as unknown as Record<string, unknown>);
            return { killed: true } as const;
          }
          if (verdict.decision === 'STEER') soWhatSteer = verdict.steer_suggestion ?? null;
          await log('sowhat', 'stage_end', `Demand gate: ${verdict.decision} (score ${verdict.demand_score.toFixed(2)})`, verdict as unknown as Record<string, unknown>);
          return { killed: false } as const;
        },
      );
      if (gateResult.killed) return;
    }

    // ---- Stage 3.6: Proprietary POV (the Experience Layer question) ---------
    // VOICE_SYSTEM.md §3/§8 step 5. Self-bound to /internal/pov so its DB reads
    // + LLM call run in a fresh invocation (own ~50-subrequest budget) — the
    // writer reads the resulting draft stage 'pov' from the DB.
    await gap();
    await step.do(
      'proprietary pov',
      cfg(6 * MIN),
      async () => {
        if (!env.WORKER_SELF || !env.AUTH_HOOK_SECRET) {
          throw new Error('WORKER_SELF binding or AUTH_HOOK_SECRET not configured');
        }
        await setSession({ current_stage: 'pov', status: 'in_progress' });
        await log('pov', 'stage_start', 'Asking the Experience Layer question');
        const res = await env.WORKER_SELF.fetch('https://WORKER_SELF/internal/pov', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.AUTH_HOOK_SECRET}`,
          },
          body: JSON.stringify({ session_id: sessionId, user_id: userId }),
        });
        const result = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; has_experience?: boolean };
        if (!res.ok || !result.ok) {
          throw new Error(result.error ?? `POV stage failed (${res.status})`);
        }
        await log('pov', 'stage_end', result.has_experience ? 'POV from Experience Layer' : 'POV analytical — Experience Layer had nothing on this topic');
        return { has_experience: result.has_experience ?? false } as const;
      },
    );

// ---- Stage 4: Writer ----------------------------------------------------
    await gap();
    await step.do(
      'writer',
      cfg(8 * MIN),
      async () => {
await setSession({ current_stage: 'writer', status: 'in_progress' });
        await log('writer', 'stage_start', 'Writing draft');
        const [{ data: specRow }, { data: dossierRow }, { data: povRow }] = await Promise.all([
          db.from('ce_drafts').select('content').eq('session_id', sessionId).eq('stage', 'spec_builder').single(),
          db.from('ce_drafts').select('content').eq('session_id', sessionId).eq('stage', 'researcher').single(),
          db.from('ce_drafts').select('content').eq('session_id', sessionId).eq('stage', 'pov').single(),
        ]);
        const effectiveAngle = soWhatSteer ? `${angle} — ${soWhatSteer}` : angle;
const md = await writeArticle(
          env,
          profile as unknown as Profile,
          (specRow as unknown as { content: string } | null)?.content ?? '',
          (dossierRow as unknown as { content: string } | null)?.content ?? '',
          topic,
          effectiveAngle,
          depth,
          usageLogger('writer'),
          format,
          series,
          (povRow as unknown as { content: string } | null)?.content ?? null,
        );
        await upsertDraft('writer', md);
        const wordCount = md.split(/\s+/).length;
        await log('writer', 'thinking', `Drafted ${wordCount} words from the spec${povRow?.content ? ' + the Proprietary POV' : ''}${soWhatSteer ? ' (demand steer applied)' : ''}.`);
        await log('writer', 'stage_end', 'Draft complete');
        return { words: wordCount };
      },
    );

// ---- Stage 5: Editor (fact-check + polish + composite gate) --------------
    // Self-bound to /internal/editor: the judge + fact-check + strengthen LLM
    // calls and evidence-usage writes run in a FRESH Worker invocation with its
    // own ~50-subrequest budget. Inline, these (chatJson retries + rewrite +
    // strengthen) push the workflow instance's shared budget over the Free-plan
    // limit (verified in production: instance errored with "Too many
    // subrequests by single Worker invocation").
    await gap();
    await step.do(
      'editor',
      cfg(12 * MIN),
      async () => {
        if (!env.WORKER_SELF || !env.AUTH_HOOK_SECRET) {
          throw new Error('WORKER_SELF binding or AUTH_HOOK_SECRET not configured');
        }
        await setSession({ current_stage: 'editor', status: 'in_progress' });
        await log('editor', 'stage_start', 'Fact-checking and polishing');
        const res = await env.WORKER_SELF.fetch('https://WORKER_SELF/internal/editor', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.AUTH_HOOK_SECRET}`,
          },
          body: JSON.stringify({ session_id: sessionId, user_id: userId }),
        });
        const result = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          quality_score?: number;
        };
        if (!res.ok || !result.ok) {
          throw new Error(result.error ?? `Editor stage failed (${res.status})`);
        }
        await log('editor', 'stage_end', `Edited draft ready (quality ${result.quality_score ?? '?'}/10)`);
        return { ok: true } as const;
      },
    );
  }
}
