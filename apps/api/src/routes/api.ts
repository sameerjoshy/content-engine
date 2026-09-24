import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../env';
import type { AuthUser } from '../lib/jwt';
import type { EvidenceItem } from '../types';
import { chat, estimateCost } from '../lib/llm';
import { logEvent } from '../lib/events';
import { syncUserToHubSpot } from '../lib/hubspot';
import { SEED_CONTENT_MAP } from '../data/existingContent';
import type { ContentFormat, RunArticleInput, Session, Profile, ContentMapItem, ExperienceEntry } from '../types';

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: string,
  ) {
    super(message);
  }
}

function badRequest(details: string): ApiError {
  return new ApiError(400, 'Invalid request', details);
}

function notFound(details: string): ApiError {
  return new ApiError(404, 'Not found', details);
}

async function body<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw badRequest('Request body must be valid JSON');
  }
}

/** Make sure a brand-new user has profiles copied from templates + seeded content map. */
async function ensureWorkspace(db: SupabaseClient, env: Env, user: AuthUser): Promise<void> {
  const userId = user.id;
  const { count } = await db.from('ce_profiles').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  if (!count) {
    const { data: templates } = await db
      .from('ce_profile_templates')
      .select('slug,name,description,brand_voice,icp,content_standards,research_rules');
    if (templates?.length) {
      await db.from('ce_profiles').insert(
        templates.map((t) => ({
          user_id: userId,
          name: t.name,
          description: t.description,
          slug: t.slug,
          brand_voice: t.brand_voice,
          icp: t.icp,
          content_standards: t.content_standards,
          research_rules: t.research_rules,
          source_template: t.slug,
          input_quality: { score: 0, flags: ['not_reviewed'], suggestions: [] },
        })),
      );
    }
  }
  const { count: cmCount } = await db
    .from('ce_content_map')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (!cmCount && SEED_CONTENT_MAP.length) {
    await db.from('ce_content_map').insert(
      SEED_CONTENT_MAP.map((c) => ({ ...c, user_id: userId })),
    );
  }

  await syncUserToHubSpot(db, env, userId, {
    email: user.email,
    first_name: (user.user_metadata?.first_name as string | undefined) ?? undefined,
    last_name: (user.user_metadata?.last_name as string | undefined) ?? undefined,
    company: (user.user_metadata?.company as string | undefined) ?? undefined,
  });
}

export async function handleApi(
  request: Request,
  env: Env,
  user: AuthUser,
  path: string,
  method: string,
): Promise<Response> {
  const db = await import('../lib/db').then((m) => m.getDb(env));
  const userId = user.id;
  const parts = path.replace(/^\/api\//, '').split('/').filter(Boolean);

  try {
    await ensureWorkspace(db, env, user);

    // ---- GET /api/me ------------------------------------------------------
    if (method === 'GET' && path === '/api/me') {
      const [profiles, contentCount, sessions] = await Promise.all([
        db.from('ce_profiles').select('id,name,description,slug,is_active,input_quality,updated_at').eq('user_id', userId).order('created_at'),
        db.from('ce_content_map').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        db.from('ce_sessions').select('id,topic,angle,current_stage,status,created_at,completed_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      ]);
      return json({
        user: { id: userId, email: user.email ?? null },
        profiles: profiles.data ?? [],
        content_map_count: contentCount.count ?? 0,
        recent_sessions: sessions.data ?? [],
      });
    }

    // ---- POST /api/me/profile (complete profile after OAuth signup) ----------
    // Saves company/role/industry to user_metadata (via admin API, service-role)
    // and force-syncs the updated contact to HubSpot.
    if (method === 'POST' && path === '/api/me/profile') {
      const b = await body<{ company?: string; job_title?: string; industry?: string; first_name?: string; last_name?: string }>(request);
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const updated: Record<string, unknown> = { ...meta };
      if (b.company) updated.company = b.company;
      if (b.job_title) updated.job_title = b.job_title;
      if (b.industry) updated.industry = b.industry;
      if (b.first_name) updated.first_name = b.first_name;
      if (b.last_name) updated.last_name = b.last_name;

      const adminRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_metadata: updated }),
      });
      if (!adminRes.ok) throw new ApiError(500, 'Failed to save profile', await adminRes.text().catch(() => ''));

      await syncUserToHubSpot(
        db,
        env,
        userId,
        {
          email: user.email,
          first_name: updated.first_name as string | undefined,
          last_name: updated.last_name as string | undefined,
          company: updated.company as string | undefined,
          job_title: updated.job_title as string | undefined,
          industry: updated.industry as string | undefined,
        },
        true,
      );
      return json({ ok: true, user_metadata: updated });
    }

    // ---- GET /api/profiles ------------------------------------------------
    if (method === 'GET' && path === '/api/profiles') {
      const { data } = await db.from('ce_profiles').select('*').eq('user_id', userId).order('created_at');
      return json({ profiles: data ?? [] });
    }

    // ---- POST /api/profiles (create from scratch) --------------------------
    if (method === 'POST' && path === '/api/profiles') {
      const b = await body<Partial<Profile>>(request);
      if (!b.name || !b.name.trim()) throw badRequest('Profile name is required');
      const { data, error } = await db
        .from('ce_profiles')
        .insert({
          user_id: userId,
          name: b.name,
          description: b.description ?? null,
          brand_voice: b.brand_voice ?? {},
          icp: b.icp ?? {},
          content_standards: b.content_standards ?? {},
          research_rules: b.research_rules ?? {},
          author: b.author ?? null,
          input_quality: { score: 0, flags: ['not_reviewed'], suggestions: [] },
        })
        .select()
        .single();
      if (error) throw new ApiError(500, 'Failed to create profile', error.message);
      return json({ profile: data }, 201);
    }

    // ---- PUT /api/profiles/:id (update; also refreshes input_quality to stale) ---
    if (method === 'PUT' && parts[0] === 'profiles' && parts.length === 2) {
      const b = await body<Partial<Profile>>(request);
      const patch: Record<string, unknown> = {};
      for (const k of ['name', 'description', 'brand_voice', 'icp', 'content_standards', 'research_rules', 'author'] as const) {
        if (b[k] !== undefined) patch[k] = b[k];
      }
      patch.updated_at = new Date().toISOString();
      const { data, error } = await db
        .from('ce_profiles')
        .update(patch)
        .eq('id', parts[1])
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw new ApiError(500, 'Failed to update profile', error.message);
      return json({ profile: data });
    }

    // ---- DELETE /api/profiles/:id -------------------------------------------
    if (method === 'DELETE' && parts[0] === 'profiles' && parts.length === 2) {
      const { error } = await db.from('ce_profiles').delete().eq('id', parts[1]).eq('user_id', userId);
      if (error) throw new ApiError(500, 'Failed to delete profile', error.message);
      return json({ ok: true });
    }

    // ---- POST /api/profiles/:id/analyze (Input Studio quality analysis) ------
    if (method === 'POST' && parts[0] === 'profiles' && parts[2] === 'analyze') {
      const { data: profile } = await db
        .from('ce_profiles')
        .select('*')
        .eq('id', parts[1])
        .eq('user_id', userId)
        .single();
      if (!profile) throw notFound('Profile not found');
      const analysis = await analyzeProfile(env, profile);
      await db.from('ce_profiles').update({ input_quality: analysis }).eq('id', parts[1]);
      return json({ analysis });
    }

    // ---- Experience Layer (the Proprietary POV store) -------------------------
    // CRUD for the operator's recorded scar tissue (VOICE_SYSTEM.md §3). The
    // pipeline's Proprietary POV stage consumes these by topic tag match.
    if (method === 'GET' && path === '/api/experience') {
      const { data } = await db
        .from('ce_experience')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);
      return json({ entries: data ?? [] });
    }

    if (method === 'POST' && path === '/api/experience') {
      const b = await body<Partial<ExperienceEntry>>(request);
      if (!b.insight || !b.insight.trim()) throw badRequest('insight is required');
      const { data, error } = await db
        .from('ce_experience')
        .insert({
          user_id: userId,
          insight: b.insight.trim(),
          scar: b.scar ?? null,
          pattern: b.pattern ?? null,
          counter: b.counter ?? null,
          applicable_tags: Array.isArray(b.applicable_tags) ? b.applicable_tags : [],
          changed_mind_from: b.changed_mind_from ?? null,
          changed_mind_to: b.changed_mind_to ?? null,
          changed_mind_story: b.changed_mind_story ?? null,
          occurrences: Math.max(1, Number(b.occurrences) || 1),
          publishable: b.publishable !== false,
        })
        .select()
        .single();
      if (error) throw new ApiError(500, 'Failed to create experience entry', error.message);
      return json({ entry: data }, 201);
    }

    if (method === 'PUT' && parts[0] === 'experience' && parts.length === 2) {
      const b = await body<Partial<ExperienceEntry>>(request);
      const patch: Record<string, unknown> = {};
      for (const k of ['insight', 'scar', 'pattern', 'counter', 'changed_mind_from', 'changed_mind_to', 'changed_mind_story'] as const) {
        if (b[k] !== undefined) patch[k] = b[k];
      }
      if (b.applicable_tags !== undefined) patch.applicable_tags = Array.isArray(b.applicable_tags) ? b.applicable_tags : [];
      if (b.occurrences !== undefined) patch.occurrences = Math.max(1, Number(b.occurrences) || 1);
      if (b.publishable !== undefined) patch.publishable = b.publishable !== false;
      patch.updated_at = new Date().toISOString();
      const { data, error } = await db
        .from('ce_experience')
        .update(patch)
        .eq('id', parts[1])
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw new ApiError(500, 'Failed to update experience entry', error.message);
      return json({ entry: data });
    }

    if (method === 'DELETE' && parts[0] === 'experience' && parts.length === 2) {
      const { error } = await db.from('ce_experience').delete().eq('id', parts[1]).eq('user_id', userId);
      if (error) throw new ApiError(500, 'Failed to delete experience entry', error.message);
      return json({ ok: true });
    }

    // ---- POST /api/radar (Content Radar — opportunity scan) --------------------
    if (method === 'POST' && path === '/api/radar') {
      const b = await body<{ profile_id?: string; focus?: string }>(request);
      if (!b.profile_id) throw badRequest('profile_id is required');
      const { data: profile } = await db
        .from('ce_profiles')
        .select('*')
        .eq('id', b.profile_id)
        .eq('user_id', userId)
        .single();
      if (!profile) throw notFound('Profile not found');
      const { data: contentMap } = await db
        .from('ce_content_map')
        .select('id,title')
        .eq('user_id', userId)
        .limit(50);
      const { scanContentRadar } = await import('../agents/radar');
      const result = await scanContentRadar(env, {
        profile,
        contentMap: (contentMap ?? []) as ContentMapItem[],
        focus: b.focus?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: '',
            user_id: userId,
            stage: 'radar',
            event_type: 'llm_call',
            message: `Radar LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      });
      return json(result);
    }

    // ---- POST /api/seo-analyze (SEO Analyzer — AEO + search audit) ------------
    // A site audit does not need a content-voice profile — it needs the user's
    // content map (what the brand has already published) + the topic/domain.
    if (method === 'POST' && path === '/api/seo-analyze') {
      const b = await body<{ topic_cluster?: string; domain?: string; competitors?: string[]; focus?: string }>(request);
      if (!b.topic_cluster || b.topic_cluster.trim().length <= 3) throw badRequest('topic_cluster is required');
      const { data: contentMap } = await db
        .from('ce_content_map')
        .select('id,title')
        .eq('user_id', userId)
        .limit(50);
      const { runSeoAnalysis } = await import('../agents/seo');
      const result = await runSeoAnalysis(env, {
        topicCluster: b.topic_cluster.trim(),
        domain: b.domain?.trim() || 'gtm-360.com',
        competitors: (b.competitors ?? []).map((c) => c.trim()).filter(Boolean).slice(0, 4),
        contentMap: (contentMap ?? []) as ContentMapItem[],
        focus: b.focus?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: '',
            user_id: userId,
            stage: 'seo_analyzer',
            event_type: 'llm_call',
            message: `SEO Analyzer LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      });
      return json(result);
    }

    // ---- POST /api/qualify (Deal qualification review) ----------------------
    if (method === 'POST' && path === '/api/qualify') {
      const b = await body<{ deal_context?: string; deal_stage?: string; framework?: string; paper_process?: string }>(request);
      if (!b.deal_context || b.deal_context.trim().length < 20) throw badRequest('deal_context is required');
      if (!b.deal_stage) throw badRequest('deal_stage is required');
      const framework = (['MEDDIC', 'SPICED', 'BANT'].includes(b.framework ?? '') ? b.framework : 'MEDDIC') as 'MEDDIC' | 'SPICED' | 'BANT';
      const { runQualifier } = await import('../agents/qualifier');
      const result = await runQualifier(env, {
        dealContext: b.deal_context.trim(),
        dealStage: b.deal_stage,
        framework,
        paperProcess: b.paper_process?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: '',
            user_id: userId,
            stage: 'qualifier',
            event_type: 'llm_call',
            message: `Qualifier LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      });
      return json(result);
    }

    // ---- POST /api/diagnostic (GTM health assessment) -----------------------
    if (method === 'POST' && path === '/api/diagnostic') {
      const b = await body<{ company_url?: string; revenue_stage?: string; team_size?: number; notes?: string }>(request);
      if (!b.company_url || b.company_url.trim().length < 4) throw badRequest('company_url is required');
      const { runDiagnostic } = await import('../agents/diagnostic');
      const result = await runDiagnostic(env, {
        companyUrl: b.company_url.trim(),
        revenueStage: b.revenue_stage || 'not provided',
        teamSize: typeof b.team_size === 'number' ? b.team_size : undefined,
        notes: b.notes?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: '',
            user_id: userId,
            stage: 'diagnostic',
            event_type: 'llm_call',
            message: `Diagnostic LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      });
      return json(result);
    }

    // ---- POST /api/listen (Market signal monitor) ---------------------------
    if (method === 'POST' && path === '/api/listen') {
      const b = await body<{ signals?: string; icp?: string; watch_list?: string; sensitivity?: string }>(request);
      if (!b.signals || b.signals.trim().length < 10) throw badRequest('signals is required');
      const sensitivity = (['broad', 'buying_signals', 'custom'].includes(b.sensitivity ?? '') ? b.sensitivity : 'broad') as 'broad' | 'buying_signals' | 'custom';
      const { runListener } = await import('../agents/listener');
      const result = await runListener(env, {
        signals: b.signals.trim(),
        icp: b.icp?.trim() || 'B2B mid-market technology companies',
        watchList: b.watch_list?.trim() || undefined,
        sensitivity,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: '',
            user_id: userId,
            stage: 'listener',
            event_type: 'llm_call',
            message: `Listener LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      });
      return json(result);
    }

    // ---- POST /api/snipe (Precision outreach drafter) -----------------------
    if (method === 'POST' && path === '/api/snipe') {
      const b = await body<{ signal_brief?: string; persona?: string; channel?: string }>(request);
      const channel = (['email', 'linkedin_dm', 'call_script'].includes(b.channel ?? '') ? b.channel : 'email') as 'email' | 'linkedin_dm' | 'call_script';
      const { runSniper } = await import('../agents/sniper');
      const result = await runSniper(env, {
        signalBrief: (b.signal_brief ?? '').trim(),
        persona: b.persona?.trim() || 'a senior revenue leader',
        channel,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: '',
            user_id: userId,
            stage: 'sniper',
            event_type: 'llm_call',
            message: `Sniper LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      });
      return json(result);
    }

    // ---- POST /api/icp (ICP Clarifier) --------------------------------------
    if (method === 'POST' && path === '/api/icp') {
      const b = await body<{ deal_export?: string; stated_icp?: string; lookback?: string }>(request);
      if (!b.deal_export || b.deal_export.trim().length < 30) throw badRequest('deal_export is required');
      const { runIcpClarifier } = await import('../agents/icp');
      const result = await runIcpClarifier(env, {
        dealExport: b.deal_export.trim(),
        statedIcp: b.stated_icp?.trim() || 'Not stated',
        lookback: b.lookback?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: '',
            user_id: userId,
            stage: 'icp_clarifier',
            event_type: 'llm_call',
            message: `ICP Clarifier LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      });
      return json(result);
    }

    // ---- POST /api/deal-room (Live deal intelligence) -----------------------
    if (method === 'POST' && path === '/api/deal-room') {
      const b = await body<{ deal_notes?: string; stakeholders?: string; transcript?: string; paper_process?: string }>(request);
      if (!b.deal_notes || b.deal_notes.trim().length < 20) throw badRequest('deal_notes is required');
      const { runDealRoom } = await import('../agents/dealroom');
      const result = await runDealRoom(env, {
        dealNotes: b.deal_notes.trim(),
        stakeholders: b.stakeholders?.trim() || undefined,
        transcript: b.transcript?.trim() || undefined,
        paperProcess: b.paper_process?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: '',
            user_id: userId,
            stage: 'deal_room',
            event_type: 'llm_call',
            message: `Deal Room LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      });
      return json(result);
    }

    // ---- POST /api/hygiene (CRM data integrity) -----------------------------
    if (method === 'POST' && path === '/api/hygiene') {
      const b = await body<{ pipeline_export?: string; audit_scope?: string }>(request);
      if (!b.pipeline_export || b.pipeline_export.trim().length < 30) throw badRequest('pipeline_export is required');
      const { runHygiene } = await import('../agents/hygiene');
      const result = await runHygiene(env, {
        pipelineExport: b.pipeline_export.trim(),
        auditScope: b.audit_scope?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: '',
            user_id: userId,
            stage: 'hygiene',
            event_type: 'llm_call',
            message: `Hygiene LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      });
      return json(result);
    }

    // ---- POST /api/forecast (Forecast confidence engine) --------------------
    if (method === 'POST' && path === '/api/forecast') {
      const b = await body<{ pipeline_export?: string; target?: string; period?: string; hygiene_notes?: string }>(request);
      if (!b.pipeline_export || b.pipeline_export.trim().length < 30) throw badRequest('pipeline_export is required');
      const { runForecastAnalyser } = await import('../agents/forecast');
      const result = await runForecastAnalyser(env, {
        pipelineExport: b.pipeline_export.trim(),
        target: b.target?.trim() || undefined,
        period: b.period?.trim() || undefined,
        hygieneNotes: b.hygiene_notes?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: '',
            user_id: userId,
            stage: 'forecast_analyser',
            event_type: 'llm_call',
            message: `Forecast Analyser LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      });
      return json(result);
    }

    // ---- POST /api/win-loss (Pattern extraction) ----------------------------
    if (method === 'POST' && path === '/api/win-loss') {
      const b = await body<{ deal_export?: string; period?: string }>(request);
      if (!b.deal_export || b.deal_export.trim().length < 30) throw badRequest('deal_export is required');
      const { runWinLoss } = await import('../agents/winloss');
      const result = await runWinLoss(env, {
        dealExport: b.deal_export.trim(),
        period: b.period?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: '',
            user_id: userId,
            stage: 'win_loss',
            event_type: 'llm_call',
            message: `Win/Loss LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      });
      return json(result);
    }

    // ---- POST /api/goal-integrity (OKR alignment + gaming) ------------------
    if (method === 'POST' && path === '/api/goal-integrity') {
      const b = await body<{ okr_tree?: string; company_priorities?: string }>(request);
      if (!b.okr_tree || b.okr_tree.trim().length < 20) throw badRequest('okr_tree is required');
      const { runGoalIntegrity } = await import('../agents/goals');
      const result = await runGoalIntegrity(env, {
        okrTree: b.okr_tree.trim(),
        companyPriorities: b.company_priorities?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: '',
            user_id: userId,
            stage: 'goal_integrity',
            event_type: 'llm_call',
            message: `Goal Integrity LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      });
      return json(result);
    }

    // ---- POST /api/churn (Customer health + churn risk) ---------------------
    if (method === 'POST' && path === '/api/churn') {
      const b = await body<{ account_data?: string; period?: string }>(request);
      if (!b.account_data || b.account_data.trim().length < 30) throw badRequest('account_data is required');
      const { runChurnRadar } = await import('../agents/churn');
      const result = await runChurnRadar(env, {
        accountData: b.account_data.trim(),
        period: b.period?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: '',
            user_id: userId,
            stage: 'churn_radar',
            event_type: 'llm_call',
            message: `Churn Radar LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      });
      return json(result);
    }

    // ---- POST /api/expansion (Upsell readiness) -----------------------------
    if (method === 'POST' && path === '/api/expansion') {
      const b = await body<{ account_data?: string; offerings?: string }>(request);
      if (!b.account_data || b.account_data.trim().length < 30) throw badRequest('account_data is required');
      const { runExpansionRadar } = await import('../agents/expansion');
      const result = await runExpansionRadar(env, {
        accountData: b.account_data.trim(),
        offerings: b.offerings?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: '',
            user_id: userId,
            stage: 'expansion_radar',
            event_type: 'llm_call',
            message: `Expansion Radar LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      });
      return json(result);
    }

    // ---- POST /api/scout (Signal-to-intent, single account) -----------------
    if (method === 'POST' && path === '/api/scout') {
      const b = await body<{ company?: string; domain?: string; icp?: string; signals?: string; lookback?: string }>(request);
      if (!b.company || !b.company.trim()) throw badRequest('company is required');
      if (!b.icp || !b.icp.trim()) throw badRequest('icp is required');
      const { runSignalsScout } = await import('../agents/scout');
      const result = await runSignalsScout(env, {
        company: b.company.trim(),
        domain: b.domain?.trim() || undefined,
        icp: b.icp.trim(),
        signals: (b.signals ?? '').trim(),
        lookback: b.lookback?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: '',
            user_id: userId,
            stage: 'signals_scout',
            event_type: 'llm_call',
            message: `Signals Scout LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      });
      return json(result);
    }

    // ---- POST /api/competitor (Competitive intel brief) ---------------------
    if (method === 'POST' && path === '/api/competitor') {
      const b = await body<{ competitor?: string; source_material?: string; your_position?: string }>(request);
      if (!b.competitor || !b.competitor.trim()) throw badRequest('competitor is required');
      if (!b.source_material || b.source_material.trim().length < 30) throw badRequest('source_material is required');
      const { runCompetitorIntel } = await import('../agents/competitor');
      const result = await runCompetitorIntel(env, {
        competitor: b.competitor.trim(),
        sourceMaterial: b.source_material.trim(),
        yourPosition: b.your_position?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: '',
            user_id: userId,
            stage: 'competitor_intel',
            event_type: 'llm_call',
            message: `Competitor Intel LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      });
      return json(result);
    }

    // ---- POST /api/planning (Quarterly operating loop) ----------------------
    if (method === 'POST' && path === '/api/planning') {
      const b = await body<{ last_quarter_data?: string; context?: string; quarter?: string }>(request);
      if (!b.last_quarter_data || b.last_quarter_data.trim().length < 20) throw badRequest('last_quarter_data is required');
      const { runPlanningCycle } = await import('../agents/planning');
      const result = await runPlanningCycle(env, {
        lastQuarterData: b.last_quarter_data.trim(),
        context: b.context?.trim() || undefined,
        quarter: b.quarter?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: '',
            user_id: userId,
            stage: 'planning_cycle',
            event_type: 'llm_call',
            message: `Planning Cycle LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      });
      return json(result);
    }

    // ---- POST /api/goal-designer (OKR draft + ambition check) ---------------
    if (method === 'POST' && path === '/api/goal-designer') {
      const b = await body<{ focus_areas?: string; context?: string; baseline?: string; horizon?: string }>(request);
      if (!b.focus_areas || b.focus_areas.trim().length < 10) throw badRequest('focus_areas is required');
      const { runGoalDesigner } = await import('../agents/goaldesigner');
      const result = await runGoalDesigner(env, {
        focusAreas: b.focus_areas.trim(),
        context: b.context?.trim() || undefined,
        baseline: b.baseline?.trim() || undefined,
        horizon: b.horizon?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: '',
            user_id: userId,
            stage: 'goal_designer',
            event_type: 'llm_call',
            message: `Goal Designer LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      });
      return json(result);
    }

    // ---- POST /api/market (Market sizing + whitespace) ----------------------
    if (method === 'POST' && path === '/api/market') {
      const b = await body<{ segments?: string; geography?: string; your_position?: string; sources?: string }>(request);
      if (!b.segments || b.segments.trim().length < 5) throw badRequest('segments is required');
      const { runMarketResearch } = await import('../agents/market');
      const result = await runMarketResearch(env, {
        segments: b.segments.trim(),
        geography: b.geography?.trim() || undefined,
        yourPosition: b.your_position?.trim() || undefined,
        sources: b.sources?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: '',
            user_id: userId,
            stage: 'market_research',
            event_type: 'llm_call',
            message: `Market Research LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      });
      return json(result);
    }

    // ---- POST /api/roadmap-align (Goals vs pipeline reality) ----------------
    if (method === 'POST' && path === '/api/roadmap-align') {
      const b = await body<{ goals?: string; pipeline_shape?: string; capacity?: string; win_rate?: string }>(request);
      if (!b.goals || b.goals.trim().length < 5) throw badRequest('goals is required');
      if (!b.pipeline_shape || b.pipeline_shape.trim().length < 5) throw badRequest('pipeline_shape is required');
      const { runRoadmapAlign } = await import('../agents/roadmapalign');
      const result = await runRoadmapAlign(env, {
        goals: b.goals.trim(),
        pipelineShape: b.pipeline_shape.trim(),
        capacity: b.capacity?.trim() || undefined,
        winRate: b.win_rate?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: '',
            user_id: userId,
            stage: 'roadmap_align',
            event_type: 'llm_call',
            message: `Roadmap Align LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      });
      return json(result);
    }

    // ---- POST /api/campaign (Multi-channel campaign plan) -------------------
    if (method === 'POST' && path === '/api/campaign') {
      const b = await body<{ message?: string; segment?: string; window?: string; channels?: string }>(request);
      if (!b.message || b.message.trim().length < 5) throw badRequest('message is required');
      if (!b.segment || !b.segment.trim()) throw badRequest('segment is required');
      const { runCampaignBuilder } = await import('../agents/campaign');
      const result = await runCampaignBuilder(env, {
        message: b.message.trim(),
        segment: b.segment.trim(),
        window: b.window?.trim() || undefined,
        channels: b.channels?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: '',
            user_id: userId,
            stage: 'campaign_builder',
            event_type: 'llm_call',
            message: `Campaign Builder LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      });
      return json(result);
    }

    // ---- POST /api/account-planner (Target account tiering) -----------------
    if (method === 'POST' && path === '/api/account-planner') {
      const b = await body<{ account_universe?: string; icp?: string; fit_threshold?: string }>(request);
      if (!b.account_universe || b.account_universe.trim().length < 10) throw badRequest('account_universe is required');
      if (!b.icp || !b.icp.trim()) throw badRequest('icp is required');
      const { runAccountPlanner } = await import('../agents/accountplanner');
      const result = await runAccountPlanner(env, {
        accountUniverse: b.account_universe.trim(),
        icp: b.icp.trim(),
        fitThreshold: b.fit_threshold?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, { session_id: '', user_id: userId, stage: 'account_planner', event_type: 'llm_call', message: `Account Planner LLM call${model ? ` (${model})` : ''}`, tokens_in: usage.prompt_tokens, tokens_out: usage.completion_tokens, cost_usd: estimateCost(usage, model), latency_ms: latencyMs }),
      });
      return json(result);
    }

    // ---- POST /api/abm (Account-based positioning playbook) -----------------
    if (method === 'POST' && path === '/api/abm') {
      const b = await body<{ accounts?: string; account_context?: string; your_position?: string }>(request);
      if (!b.accounts || b.accounts.trim().length < 3) throw badRequest('accounts is required');
      const { runAbmPlaybook } = await import('../agents/abm');
      const result = await runAbmPlaybook(env, {
        accounts: b.accounts.trim(),
        accountContext: b.account_context?.trim() || '',
        yourPosition: b.your_position?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, { session_id: '', user_id: userId, stage: 'abm_playbook', event_type: 'llm_call', message: `ABM Playbook LLM call${model ? ` (${model})` : ''}`, tokens_in: usage.prompt_tokens, tokens_out: usage.completion_tokens, cost_usd: estimateCost(usage, model), latency_ms: latencyMs }),
      });
      return json(result);
    }

    // ---- POST /api/video-outreach (Personalised video brief) ----------------
    if (method === 'POST' && path === '/api/video-outreach') {
      const b = await body<{ signal_brief?: string; persona?: string; offer?: string }>(request);
      if (!b.persona || !b.persona.trim()) throw badRequest('persona is required');
      const { runVideoOutreach } = await import('../agents/videooutreach');
      const result = await runVideoOutreach(env, {
        signalBrief: (b.signal_brief ?? '').trim(),
        persona: b.persona.trim(),
        yourOffer: b.offer?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, { session_id: '', user_id: userId, stage: 'video_outreach', event_type: 'llm_call', message: `Video Outreach LLM call${model ? ` (${model})` : ''}`, tokens_in: usage.prompt_tokens, tokens_out: usage.completion_tokens, cost_usd: estimateCost(usage, model), latency_ms: latencyMs }),
      });
      return json(result);
    }

    // ---- POST /api/pricing (Deal pricing + packaging) -----------------------
    if (method === 'POST' && path === '/api/pricing') {
      const b = await body<{ deal_context?: string; price_history?: string; margin_floor?: string }>(request);
      if (!b.deal_context || b.deal_context.trim().length < 10) throw badRequest('deal_context is required');
      const { runPricingStrategist } = await import('../agents/pricing');
      const result = await runPricingStrategist(env, {
        dealContext: b.deal_context.trim(),
        priceHistory: b.price_history?.trim() || undefined,
        marginFloor: b.margin_floor?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, { session_id: '', user_id: userId, stage: 'pricing_strategist', event_type: 'llm_call', message: `Pricing Strategist LLM call${model ? ` (${model})` : ''}`, tokens_in: usage.prompt_tokens, tokens_out: usage.completion_tokens, cost_usd: estimateCost(usage, model), latency_ms: latencyMs }),
      });
      return json(result);
    }

    // ---- POST /api/negotiation (Concession map + call prep) -----------------
    if (method === 'POST' && path === '/api/negotiation') {
      const b = await body<{ deal_brief?: string; known_pressures?: string; margin_floor?: string }>(request);
      if (!b.deal_brief || b.deal_brief.trim().length < 10) throw badRequest('deal_brief is required');
      const { runNegotiationCoach } = await import('../agents/negotiation');
      const result = await runNegotiationCoach(env, {
        dealBrief: b.deal_brief.trim(),
        knownPressures: b.known_pressures?.trim() || undefined,
        marginFloor: b.margin_floor?.trim() || undefined,
        onUsage: (usage, latencyMs, model) =>
          logEvent(db, { session_id: '', user_id: userId, stage: 'negotiation_coach', event_type: 'llm_call', message: `Negotiation Coach LLM call${model ? ` (${model})` : ''}`, tokens_in: usage.prompt_tokens, tokens_out: usage.completion_tokens, cost_usd: estimateCost(usage, model), latency_ms: latencyMs }),
      });
      return json(result);
    }

    // ---- POST /api/onboarding (Time-to-value plan) --------------------------
    if (method === 'POST' && path === '/api/onboarding') {
      const b = await body<{ account_context?: string; product_surface?: string; window?: string }>(request);
      if (!b.account_context || b.account_context.trim().length < 10) throw badRequest('account_context is required');
      if (!b.product_surface || b.product_surface.trim().length < 5) throw badRequest('product_surface is required');
      const { runOnboardingCoach } = await import('../agents/onboarding');
      const result = await runOnboardingCoach(env, { accountContext: b.account_context.trim(), productSurface: b.product_surface.trim(), window: b.window?.trim() || undefined, onUsage: (usage, latencyMs, model) => logEvent(db, { session_id: '', user_id: userId, stage: 'onboarding_coach', event_type: 'llm_call', message: `Onboarding Coach LLM call${model ? ` (${model})` : ''}`, tokens_in: usage.prompt_tokens, tokens_out: usage.completion_tokens, cost_usd: estimateCost(usage, model), latency_ms: latencyMs }) });
      return json(result);
    }

    // ---- POST /api/renewal (Renewal plan) -----------------------------------
    if (method === 'POST' && path === '/api/renewal') {
      const b = await body<{ health_data?: string; renewal_date?: string }>(request);
      if (!b.health_data || b.health_data.trim().length < 10) throw badRequest('health_data is required');
      const { runRenewalAnalyst } = await import('../agents/renewal');
      const result = await runRenewalAnalyst(env, { healthData: b.health_data.trim(), renewalDate: b.renewal_date?.trim() || undefined, onUsage: (usage, latencyMs, model) => logEvent(db, { session_id: '', user_id: userId, stage: 'renewal_analyst', event_type: 'llm_call', message: `Renewal Analyst LLM call${model ? ` (${model})` : ''}`, tokens_in: usage.prompt_tokens, tokens_out: usage.completion_tokens, cost_usd: estimateCost(usage, model), latency_ms: latencyMs }) });
      return json(result);
    }

    // ---- POST /api/cross-sell (Multi-product readiness) ---------------------
    if (method === 'POST' && path === '/api/cross-sell') {
      const b = await body<{ health_score?: string; usage_support?: string; products?: string }>(request);
      if (!b.health_score || !b.health_score.trim()) throw badRequest('health_score is required');
      if (!b.usage_support || b.usage_support.trim().length < 10) throw badRequest('usage_support is required');
      const { runCrossSellScout } = await import('../agents/crosssell');
      const result = await runCrossSellScout(env, { healthScore: b.health_score.trim(), usageSupport: b.usage_support.trim(), products: b.products?.trim() || undefined, onUsage: (usage, latencyMs, model) => logEvent(db, { session_id: '', user_id: userId, stage: 'cross_sell_scout', event_type: 'llm_call', message: `Cross-Sell Scout LLM call${model ? ` (${model})` : ''}`, tokens_in: usage.prompt_tokens, tokens_out: usage.completion_tokens, cost_usd: estimateCost(usage, model), latency_ms: latencyMs }) });
      return json(result);
    }

    // ---- POST /api/pipeline-audit (Stage integrity) -------------------------
    if (method === 'POST' && path === '/api/pipeline-audit') {
      const b = await body<{ pipeline_data?: string; audit_depth?: string }>(request);
      if (!b.pipeline_data || b.pipeline_data.trim().length < 20) throw badRequest('pipeline_data is required');
      const { runPipelineAuditor } = await import('../agents/pipelineauditor');
      const result = await runPipelineAuditor(env, { pipelineData: b.pipeline_data.trim(), auditDepth: b.audit_depth?.trim() || undefined, onUsage: (usage, latencyMs, model) => logEvent(db, { session_id: '', user_id: userId, stage: 'pipeline_auditor', event_type: 'llm_call', message: `Pipeline Auditor LLM call${model ? ` (${model})` : ''}`, tokens_in: usage.prompt_tokens, tokens_out: usage.completion_tokens, cost_usd: estimateCost(usage, model), latency_ms: latencyMs }) });
      return json(result);
    }

    // ---- POST /api/attribution (Revenue attribution) ------------------------
    if (method === 'POST' && path === '/api/attribution') {
      const b = await body<{ closed_deals?: string; model?: string }>(request);
      if (!b.closed_deals || b.closed_deals.trim().length < 20) throw badRequest('closed_deals is required');
      const { runAttribution } = await import('../agents/attribution');
      const result = await runAttribution(env, { closedDeals: b.closed_deals.trim(), model: b.model?.trim() || undefined, onUsage: (usage, latencyMs, model) => logEvent(db, { session_id: '', user_id: userId, stage: 'attribution', event_type: 'llm_call', message: `Attribution LLM call${model ? ` (${model})` : ''}`, tokens_in: usage.prompt_tokens, tokens_out: usage.completion_tokens, cost_usd: estimateCost(usage, model), latency_ms: latencyMs }) });
      return json(result);
    }

    // ---- POST /api/comp-quota (Quota + comp design) -------------------------
    if (method === 'POST' && path === '/api/comp-quota') {
      const b = await body<{ territory_data?: string; comp_structure?: string; coverage?: string }>(request);
      if (!b.territory_data || b.territory_data.trim().length < 10) throw badRequest('territory_data is required');
      const { runCompQuota } = await import('../agents/compquota');
      const result = await runCompQuota(env, { territoryData: b.territory_data.trim(), compStructure: b.comp_structure?.trim() || undefined, coverage: b.coverage?.trim() || undefined, onUsage: (usage, latencyMs, model) => logEvent(db, { session_id: '', user_id: userId, stage: 'comp_quota', event_type: 'llm_call', message: `Comp & Quota LLM call${model ? ` (${model})` : ''}`, tokens_in: usage.prompt_tokens, tokens_out: usage.completion_tokens, cost_usd: estimateCost(usage, model), latency_ms: latencyMs }) });
      return json(result);
    }

    // ---- POST /api/workflow (CRM workflow spec) -----------------------------
    if (method === 'POST' && path === '/api/workflow') {
      const b = await body<{ process_description?: string; platform?: string }>(request);
      if (!b.process_description || b.process_description.trim().length < 10) throw badRequest('process_description is required');
      const { runWorkflowBuilder } = await import('../agents/workflowbuilder');
      const result = await runWorkflowBuilder(env, { processDescription: b.process_description.trim(), platform: b.platform?.trim() || undefined, onUsage: (usage, latencyMs, model) => logEvent(db, { session_id: '', user_id: userId, stage: 'workflow_builder', event_type: 'llm_call', message: `Workflow Builder LLM call${model ? ` (${model})` : ''}`, tokens_in: usage.prompt_tokens, tokens_out: usage.completion_tokens, cost_usd: estimateCost(usage, model), latency_ms: latencyMs }) });
      return json(result);
    }

    // ---- POST /api/command (Chief of Staff — cross-engine weekly brief) -----
    if (method === 'POST' && path === '/api/command') {
      const b = await body<{ engine_outputs?: string; priorities?: string; context?: string }>(request);
      if (!b.engine_outputs || b.engine_outputs.trim().length < 20) throw badRequest('engine_outputs is required');
      const { runChiefOfStaff } = await import('../agents/chiefofstaff');
      const result = await runChiefOfStaff(env, {
        engineOutputs: b.engine_outputs.trim(),
        priorities: b.priorities?.trim() || undefined,
        context: b.context?.trim() || undefined,
        onUsage: (usage, latencyMs, model) => logEvent(db, { session_id: '', user_id: userId, stage: 'chief_of_staff', event_type: 'llm_call', message: `Chief of Staff LLM call${model ? ` (${model})` : ''}`, tokens_in: usage.prompt_tokens, tokens_out: usage.completion_tokens, cost_usd: estimateCost(usage, model), latency_ms: latencyMs }),
      });
      return json(result);
    }

    // ---- POST /api/run-article ----------------------------------------------
    if (method === 'POST' && path === '/api/run-article') {
      const b = await body<RunArticleInput>(request);
      const { profile_id, topic, angle, depth, format = 'article', series, review_research = false, skip_sowhat = false } = b;
      if (!profile_id) throw badRequest('profile_id is required');
      if (!topic || topic.trim().length <= 3) throw badRequest('Topic must be longer than 3 characters');
      if (!angle || angle.trim().length <= 5) throw badRequest('Angle must be longer than 5 characters');
      if (!['light', 'moderate', 'deep'].includes(depth)) throw badRequest('depth must be light, moderate, or deep');
      if (!['article', 'howto', 'best_practice'].includes(format)) throw badRequest('format must be article, howto, or best_practice');

      const { data: profile } = await db
        .from('ce_profiles')
        .select('*')
        .eq('id', profile_id)
        .eq('user_id', userId)
        .single();
      if (!profile) throw badRequest(`Profile '${profile_id}' not found`);

      const { data: session, error } = await db
        .from('ce_sessions')
        .insert({
          user_id: userId,
          profile_id: profile.id,
          profile_snapshot: profile,
          topic: topic.trim(),
          angle: angle.trim(),
          depth,
          format,
          series: series ?? null,
          review_research: review_research,
          skip_sowhat: skip_sowhat,
          current_stage: 'validator',
          status: 'starting',
        })
        .select()
        .single();
      if (error || !session) throw new ApiError(500, 'Failed to create session', error?.message);

      await env.ARTICLE_WORKFLOW.create({
        id: session.id,
        params: { session_id: session.id, user_id: userId },
      });
      await logEvent(db, {
        session_id: session.id,
        user_id: userId,
        stage: 'validator',
        event_type: 'stage_start',
        message: 'Article run started',
      });

      return json({ session_id: session.id, status: 'starting' }, 201);
    }

    // ---- GET /api/workflow-status/:id ----------------------------------------
    if (method === 'GET' && parts[0] === 'workflow-status' && parts.length === 2) {
      const { data: s, error } = await db
        .from('ce_sessions')
        .select('*')
        .eq('id', parts[1])
        .eq('user_id', userId)
        .single();
      if (error || !s) throw notFound('Session not found');
      const { data: events } = await db
        .from('ce_stage_events')
        .select('stage,event_type,message,data,tokens_in,tokens_out,cost_usd,latency_ms,created_at')
        .eq('session_id', s.id)
        .order('created_at', { ascending: true })
        .limit(200);

      // Stall reconciliation: a Workflow instance that dies at the platform
      // level (e.g. "Too many subrequests" — the Free-plan ~50 subrequest
      // limit) never unwinds through the workflow's own error guard, so the
      // session would sit in_progress forever. If a run is still in_progress
      // with NO new events for 15+ minutes, it is dead — mark it so the UI
      // stops spinning and shows a real message.
      if (s.status === 'in_progress' && Array.isArray(events) && events.length > 0) {
        const last = events[events.length - 1];
        const lastAt = new Date(last.created_at).getTime();
        if (Date.now() - lastAt > 15 * 60 * 1000) {
          const msg = `The workflow instance stalled (no activity for 15+ minutes, last event: ${last.message}). The instance likely hit the Free-plan subrequest limit — start a fresh run.`;
          await db.from('ce_sessions').update({ status: 'error', error_message: msg }).eq('id', s.id);
          s.status = 'error';
          s.error_message = msg;
        }
      }

      return json({
        session_id: s.id,
        topic: s.topic,
        angle: s.angle,
        depth: s.depth,
        format: s.format ?? 'article',
        current_stage: s.current_stage,
        status: s.status,
        review_research: s.review_research ?? false,
        research_note: s.research_note ?? null,
        error_message: s.error_message,
        decision: s.decision,
        profile_name: (s.profile_snapshot as Profile | null)?.name ?? null,
        created_at: s.created_at,
        events: events ?? [],
      });
    }

    // ---- GET /api/draft/:id/:stage ----------------------------------------------
    if (method === 'GET' && parts[0] === 'draft' && parts.length === 3) {
      const stage = parts[2];
      const { data: s } = await db.from('ce_sessions').select('id,current_stage,status').eq('id', parts[1]).eq('user_id', userId).single();
      if (!s) throw notFound('Session not found');
      const { data } = await db.from('ce_drafts').select('content,meta,created_at').eq('session_id', s.id).eq('stage', stage).single();
      if (!data) {
        throw new ApiError(404, 'Draft not available yet', `The ${stage} stage has not produced output yet. Current stage: ${s.current_stage}.`);
      }
      return json({ session_id: s.id, stage, content: data.content, meta: data.meta, created_at: data.created_at });
    }

    // ---- POST /api/publish/:id ---------------------------------------------------
    if (method === 'POST' && parts[0] === 'publish' && parts.length === 2) {
      const b = await body<{ destination?: string }>(request).catch(() => ({} as { destination?: string }));
      const destination = b.destination === 'linkedin' ? 'linkedin' : 'markdown';
      const { data: s } = await db.from('ce_sessions').select('*').eq('id', parts[1]).eq('user_id', userId).single();
      if (!s) throw notFound('Session not found');
      if (s.status !== 'complete') throw new ApiError(400, 'Article not ready', 'The editor stage has not finished.');
      const { data: d } = await db.from('ce_drafts').select('content').eq('session_id', s.id).eq('stage', 'editor').single();
      if (!d) throw notFound('Edited draft missing');

      const content =
        destination === 'linkedin'
          ? toLinkedInPost(d.content, (s.profile_snapshot as Profile | null)?.name ?? null)
          : d.content;
      const ext = destination === 'linkedin' ? 'txt' : 'md';
      const slug = slugify(s.topic);
      const filename = `${slug}-${new Date().toISOString().slice(0, 10)}.${ext}`;
      await ensureBucket(db);
      const { error: upErr } = await db.storage.from('exports').upload(filename, content, {
        contentType: destination === 'linkedin' ? 'text/plain' : 'text/markdown',
        upsert: true,
      });
      if (upErr) throw new ApiError(500, 'Publish failed', upErr.message);
      await db.from('ce_published_files').insert({
        session_id: s.id,
        user_id: userId,
        filename,
        storage_path: `exports/${filename}`,
      });
      const fileUrl = `${env.SUPABASE_URL}/storage/v1/object/public/exports/${filename}`;

      // Keep the content map honest: publishing is the moment the piece is
      // "said" — add it so the Radar's whitespace scoring stops re-suggesting it.
      await db.from('ce_content_map').insert({
        user_id: userId,
        title: s.topic,
        angle: s.angle,
        publish_date: new Date().toISOString().slice(0, 10),
        profile: (s.profile_snapshot as Profile | null)?.name ?? null,
        status: 'published',
        url: fileUrl,
      });

      return json({
        session_id: s.id,
        filename,
        file_url: fileUrl,
        destination,
        content,
        published_at: new Date().toISOString(),
      });
    }

    // ---- POST /api/distribute/:id (channel variants of the finished draft) --------
    // Generates LinkedIn / YouTube / Substack derivatives from the SAME fact-checked
    // draft + evidence — no variant can drift into fabrication.
    if (method === 'POST' && parts[0] === 'distribute' && parts.length === 2) {
      const { data: s } = await db.from('ce_sessions').select('*').eq('id', parts[1]).eq('user_id', userId).single();
      if (!s) throw notFound('Session not found');
      if (s.status !== 'complete') throw new ApiError(400, 'Article not ready', 'The editor stage has not finished.');
      const [{ data: draftRow }, { data: evidenceRows }] = await Promise.all([
        db.from('ce_drafts').select('content').eq('session_id', s.id).eq('stage', 'editor').single(),
        db.from('ce_evidence').select('claim,source_url,source_title,evidence_snippet,proof_type').eq('session_id', s.id),
      ]);
      const draft = (draftRow as unknown as { content: string } | null)?.content;
      if (!draft) throw notFound('Edited draft missing');
      const evidence = (evidenceRows ?? []) as unknown as EvidenceItem[];
      const profile = s.profile_snapshot as Profile | null;
      const { generateDistribution } = await import('../agents/distribute');
      const result = await generateDistribution(
        env,
        draft,
        evidence,
        profile?.name ?? 'Unknown',
        (s.format ?? 'article') as ContentFormat,
        (s.series as { name: string; part?: number; total?: number } | null) ?? null,
        (profile?.author as { name: string; title?: string; bio?: string; company?: string; linkedin_url?: string } | null) ?? null,
        (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: s.id,
            user_id: userId,
            stage: 'editor',
            event_type: 'llm_call',
            message: `Distribution LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      );
      return json(result);
    }

    // ---- POST /api/email/:id (send the newsletter edition) -------------------------
    // Generates the Substack variant (if not cached) and emails it via Resend
    // to the requested recipients. Uses the same evidence-grounded variant.
    if (method === 'POST' && parts[0] === 'email' && parts.length === 2) {
      const b = await body<{ to?: string[] }>(request);
      const to = (b.to ?? []).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
      if (!to.length) throw badRequest('Provide at least one valid recipient email');
      const { data: s } = await db.from('ce_sessions').select('*').eq('id', parts[1]).eq('user_id', userId).single();
      if (!s) throw notFound('Session not found');
      if (s.status !== 'complete') throw new ApiError(400, 'Article not ready', 'The editor stage has not finished.');
      const [{ data: draftRow }, { data: evidenceRows }] = await Promise.all([
        db.from('ce_drafts').select('content').eq('session_id', s.id).eq('stage', 'editor').single(),
        db.from('ce_evidence').select('claim,source_url,source_title,evidence_snippet,proof_type').eq('session_id', s.id),
      ]);
      const draft = (draftRow as unknown as { content: string } | null)?.content;
      if (!draft) throw notFound('Edited draft missing');
      const evidence = (evidenceRows ?? []) as unknown as EvidenceItem[];
      const profile = s.profile_snapshot as Profile | null;

      const { generateDistribution } = await import('../agents/distribute');
      const dist = await generateDistribution(
        env,
        draft,
        evidence,
        profile?.name ?? 'Unknown',
        (s.format ?? 'article') as ContentFormat,
        (s.series as { name: string; part?: number; total?: number } | null) ?? null,
        (profile?.author as { name: string; title?: string; bio?: string; company?: string; linkedin_url?: string } | null) ?? null,
        (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: s.id,
            user_id: userId,
            stage: 'editor',
            event_type: 'llm_call',
            message: `Newsletter email LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
      );

      const { sendEmail, markdownToEmailHtml } = await import('../lib/email');
      const subject = dist.substack.split('\n').find((l: string) => l.startsWith('#'))?.replace(/^#+\s*/, '')?.slice(0, 90) ?? s.topic.slice(0, 90);
      const sent = await sendEmail(env, {
        to,
        subject,
        html: markdownToEmailHtml(dist.substack),
        text: dist.substack,
      });
      if (!sent.ok) throw new ApiError(500, 'Email send failed', sent.error);
      return json({ ok: true, to, subject, emailed_at: new Date().toISOString() });
    }

    // ---- POST /api/refresh/:id (fresh run of a completed piece) ---------------------
    // Re-runs the same topic/angle/profile with current research so the piece
    // stays citable (AI search favors content <3 months old). New session points
    // back to the original via refresh_of.
    if (method === 'POST' && parts[0] === 'refresh' && parts.length === 2) {
      const { data: orig } = await db.from('ce_sessions').select('*').eq('id', parts[1]).eq('user_id', userId).single();
      if (!orig) throw notFound('Session not found');
      if (orig.status !== 'complete') throw new ApiError(400, 'Original not ready', 'Only completed articles can be refreshed.');
      const { data: profile } = await db
        .from('ce_profiles')
        .select('*')
        .eq('id', orig.profile_id)
        .eq('user_id', userId)
        .single();
      if (!profile) throw badRequest('Source profile not found');

      const { data: session, error } = await db
        .from('ce_sessions')
        .insert({
          user_id: userId,
          profile_id: profile.id,
          profile_snapshot: profile,
          topic: orig.topic,
          angle: orig.angle,
          depth: orig.depth,
          format: orig.format ?? 'article',
          series: orig.series ?? null,
          refresh_of: orig.id,
          current_stage: 'validator',
          status: 'starting',
        })
        .select()
        .single();
      if (error || !session) throw new ApiError(500, 'Failed to create refresh session', error?.message);

      await env.ARTICLE_WORKFLOW.create({
        id: session.id,
        params: { session_id: session.id, user_id: userId },
      });
      await logEvent(db, {
        session_id: session.id,
        user_id: userId,
        stage: 'validator',
        event_type: 'stage_start',
        message: `Refresh of ${orig.id.slice(0, 8)} started`,
      });
      return json({ session_id: session.id, status: 'starting', refresh_of: orig.id }, 201);
    }

    // ---- GET /api/research-brief/:id (research review deliverable) ---------------
    // Returns the dossier + confidence-scored evidence + proof/gap report, so a
    // human can review research before it is written up.
    if (method === 'GET' && parts[0] === 'research-brief' && parts.length === 2) {
      const { data: s } = await db.from('ce_sessions').select('*').eq('id', parts[1]).eq('user_id', userId).single();
      if (!s) throw notFound('Session not found');
      const [{ data: dossierRow }, { data: evidenceRows }, { data: researcherMeta }] = await Promise.all([
        db.from('ce_drafts').select('content').eq('session_id', s.id).eq('stage', 'researcher').single(),
        db.from('ce_evidence')
          .select('claim,source_url,source_title,publish_date,source_type,proof_type,trust_score,evidence_snippet')
          .eq('session_id', s.id)
          .order('trust_score', { ascending: false }),
        db.from('ce_drafts').select('meta').eq('session_id', s.id).eq('stage', 'researcher'),
      ]);
      const evidence = ((evidenceRows ?? []) as unknown as EvidenceItem[]).map((e) => ({
        claim: e.claim,
        source_url: e.source_url,
        source_title: e.source_title,
        publish_date: e.publish_date ?? null,
        source_type: e.source_type,
        proof_type: e.proof_type ?? null,
        trust_score: e.trust_score,
        evidence_snippet: e.evidence_snippet,
        confidence: e.trust_score,
        recency: e.publish_date ? yearsSince(e.publish_date) : null,
      }));
      return json({
        session_id: s.id,
        topic: s.topic,
        angle: s.angle,
        format: s.format ?? 'article',
        status: s.status,
        current_stage: s.current_stage,
        research_note: s.research_note ?? null,
        dossier: (dossierRow as unknown as { content: string } | null)?.content ?? '',
        evidence,
        gap_report: (researcherMeta?.[0] as { meta: Record<string, unknown> | null } | null)?.meta?.proof_check ?? null,
      });
    }

    // ---- POST /api/research-approve/:id (approve research → proceed to write) -----
    if (method === 'POST' && parts[0] === 'research-approve' && parts.length === 2) {
      const { data: s } = await db.from('ce_sessions').select('*').eq('id', parts[1]).eq('user_id', userId).single();
      if (!s) throw notFound('Session not found');
      if (s.status !== 'awaiting_review') throw new ApiError(400, 'Not awaiting review', 'This session is not waiting for research approval.');
      const instance = await env.ARTICLE_WORKFLOW.get(s.id);
      await instance.sendEvent({ type: 'research_approval', payload: { approved: true } });
      return json({ ok: true, session_id: s.id });
    }

    // ---- POST /api/research-steer/:id (steer research, then approve) ----------------
    // Saves a directive, re-runs research with it, then releases the workflow to write.
    if (method === 'POST' && parts[0] === 'research-steer' && parts.length === 2) {
      const b = await body<{ instruction?: string }>(request);
      const instruction = (b.instruction ?? '').trim();
      if (instruction.length < 3) throw badRequest('Write a research directive (e.g. "Find more statistics", "Add a real company example").');
      const { data: s } = await db.from('ce_sessions').select('*').eq('id', parts[1]).eq('user_id', userId).single();
      if (!s) throw notFound('Session not found');
      if (s.status !== 'awaiting_review') throw new ApiError(400, 'Not awaiting review', 'This session is not waiting for research approval.');

      await db.from('ce_sessions').update({ research_note: instruction }).eq('id', s.id);

      // Re-run the research pipeline with the directive (fresh self-binding budget).
      if (!env.WORKER_SELF || !env.AUTH_HOOK_SECRET) throw new ApiError(500, 'Research re-run unavailable');
      const res = await env.WORKER_SELF.fetch('https://WORKER_SELF/internal/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.AUTH_HOOK_SECRET}`,
        },
        body: JSON.stringify({ session_id: s.id, user_id: userId, format: s.format ?? 'article' }),
      });
      const bodyRes = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !bodyRes.ok) {
        throw new ApiError(500, 'Research re-run failed', bodyRes.error ?? `status ${res.status}`);
      }
      await logEvent(db, {
        session_id: s.id,
        user_id: userId,
        stage: 'research_review',
        event_type: 'step_progress',
        message: `Research steered: ${instruction}`,
        data: { instruction },
      });
      const instance = await env.ARTICLE_WORKFLOW.get(s.id);
      await instance.sendEvent({ type: 'research_approval', payload: { approved: true, steered: true } });
      return json({ ok: true, session_id: s.id, research_note: instruction });
    }

    // ---- POST /api/revise/:id -----------------------------------------------------
    if (method === 'POST' && parts[0] === 'revise' && parts.length === 2) {
      const b = await body<{ instruction?: string }>(request);
      const instruction = (b.instruction ?? '').trim();
      if (instruction.length < 3) throw badRequest('Write a revision instruction (e.g. "Make the opening punchier").');
      const { data: s } = await db.from('ce_sessions').select('*').eq('id', parts[1]).eq('user_id', userId).single();
      if (!s) throw notFound('Session not found');
      if (s.status !== 'complete') throw new ApiError(400, 'Article not ready', 'The editor stage has not finished.');
      const [{ data: draftRow }, { data: dossierRow }, { data: evidenceRows }] = await Promise.all([
        db.from('ce_drafts').select('content').eq('session_id', s.id).eq('stage', 'editor').single(),
        db.from('ce_drafts').select('content').eq('session_id', s.id).eq('stage', 'researcher').single(),
        db.from('ce_evidence').select('claim,source_url,source_title,evidence_snippet').eq('session_id', s.id),
      ]);
      const evidence = (evidenceRows ?? []) as unknown as EvidenceItem[];
      const { editArticle, factCheckRewrite } = await import('../agents/editor');
      const result = await editArticle(
        env,
        (draftRow as unknown as { content: string } | null)?.content ?? '',
        (dossierRow as unknown as { content: string } | null)?.content ?? '',
        evidence,
        (s.profile_snapshot as Profile | null)?.name ?? 'Unknown',
        (usage, latencyMs, model) =>
          logEvent(db, {
            session_id: s.id,
            user_id: userId,
            stage: 'editor',
            event_type: 'llm_call',
            message: `Revision LLM call${model ? ` (${model})` : ''}`,
            tokens_in: usage.prompt_tokens,
            tokens_out: usage.completion_tokens,
            cost_usd: estimateCost(usage, model),
            latency_ms: latencyMs,
          }),
        instruction,
      );
      let finalDraft = result.edited_draft;
      const unsupported = (result.unsupported_claims ?? []).map((c) =>
        typeof c === 'string' ? { claim: c, kind: 'fact' as const } : c,
      ) as { claim: string; kind?: 'fact' | 'analysis'; reason?: string }[];
      const factClaims = unsupported.filter((c) => c.kind === 'fact' || !c.kind);
      if (factClaims.length) {
        finalDraft = await factCheckRewrite(
          env,
          finalDraft,
          (dossierRow as unknown as { content: string } | null)?.content ?? '',
          evidence,
          factClaims as never,
          (usage, latencyMs, model) =>
            logEvent(db, {
              session_id: s.id,
              user_id: userId,
              stage: 'editor',
              event_type: 'llm_call',
              message: `Revision fact-check LLM call${model ? ` (${model})` : ''}`,
              tokens_in: usage.prompt_tokens,
              tokens_out: usage.completion_tokens,
              cost_usd: estimateCost(usage, model),
              latency_ms: latencyMs,
            }),
        );
      }
      await db.from('ce_drafts').upsert(
        { session_id: s.id, user_id: userId, stage: 'editor', content: finalDraft, meta: {
          quality_score: result.quality_score,
          edits: result.edits_markdown,
          unsupported_claims: unsupported,
          strengths: result.strengths,
          main_gap: result.main_gap,
          claim_scores: result.claim_scores ?? [],
          revision_instruction: instruction,
          revised_at: new Date().toISOString(),
        } },
        { onConflict: 'session_id,stage' },
      );
      return json({
        session_id: s.id,
        content: finalDraft,
        meta: {
          quality_score: result.quality_score,
          edits: result.edits_markdown,
          unsupported_claims: unsupported,
          strengths: result.strengths,
          main_gap: result.main_gap,
          claim_scores: result.claim_scores ?? [],
        },
      });
    }

    // ---- GET /api/content-map ---------------------------------------------------
    if (method === 'GET' && path === '/api/content-map') {
      const { data } = await db.from('ce_content_map').select('*').eq('user_id', userId).order('publish_date', { ascending: false });
      return json({ items: data ?? [] });
    }

    // ---- POST /api/content-map ---------------------------------------------------
    if (method === 'POST' && path === '/api/content-map') {
      const b = await body<Partial<ContentMapItem>>(request);
      if (!b.title || !b.title.trim()) throw badRequest('Title is required');
      const { data, error } = await db
        .from('ce_content_map')
        .insert({
          user_id: userId,
          title: b.title,
          angle: b.angle ?? null,
          publish_date: b.publish_date ?? null,
          profile: b.profile ?? null,
          status: b.status ?? 'published',
          url: b.url ?? null,
        })
        .select()
        .single();
      if (error) throw new ApiError(500, 'Failed to add content', error.message);
      return json({ item: data }, 201);
    }

    // ---- DELETE /api/content-map/:id -------------------------------------------------
    if (method === 'DELETE' && parts[0] === 'content-map' && parts.length === 2) {
      const { error } = await db.from('ce_content_map').delete().eq('id', parts[1]).eq('user_id', userId);
      if (error) throw new ApiError(500, 'Failed to remove content', error.message);
      return json({ ok: true });
    }

    // ---- GET /api/sessions ------------------------------------------------------------
    if (method === 'GET' && path === '/api/sessions') {
      const { data } = await db.from('ce_sessions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
      return json({ sessions: data ?? [] });
    }

    return json({ error: 'Not found' }, 404);
  } catch (e) {
    if (e instanceof ApiError) return json({ error: e.message, details: e.details }, e.status);
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    return json({ error: 'Server error', details: msg }, 500);
  }
}

// ---- Input Studio: quality analysis -----------------------------------------------
async function analyzeProfile(env: Env, profile: Profile): Promise<Record<string, unknown>> {
  const flags: string[] = [];
  const suggestions: string[] = [];
  const bv = (profile.brand_voice ?? {}) as Record<string, unknown>;
  const icp = (profile.icp ?? {}) as Record<string, unknown>;
  const cs = (profile.content_standards ?? {}) as Record<string, unknown>;
  const rr = (profile.research_rules ?? {}) as Record<string, unknown>;

  const has = (v: unknown) => {
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'string') return v.trim().length > 0;
    if (v && typeof v === 'object') return Object.keys(v as object).length > 0;
    return Boolean(v);
  };

  if (!has(bv.example_sentences)) {
    flags.push('no_example_sentences');
    suggestions.push('Add 2-3 example sentences. The writer copies your rhythm, not your adjectives.');
  }
  if (!has(bv.forbidden_words)) {
    flags.push('no_forbidden_words');
    suggestions.push('List words that should never appear (e.g. "might", "possibly" if you want confidence).');
  }
  if (!has(bv.tone)) {
    flags.push('no_tone_definition');
    suggestions.push('Describe the tone in one sentence (e.g. "Confident, data-driven, no hedging.").');
  }
  if (!has(icp.title)) {
    flags.push('no_icp_title');
    suggestions.push('Name the exact buyer (e.g. "VP Product, B2B SaaS").');
  }
  if (!has(cs.must_have)) {
    flags.push('no_must_have');
    suggestions.push('List 2-4 things every article must include (data point, case study, recommendation).');
  }
  if (!has(cs.structure)) {
    flags.push('no_structure');
    suggestions.push('Define the article skeleton (e.g. Problem → Why → Proof → Action → Close).');
  }
  if (!has(rr.trusted_sources)) {
    flags.push('no_trusted_sources');
    suggestions.push('Name trusted source types (industry reports, primary research, academic papers).');
  }

  let score = Math.max(0, 100 - flags.length * 14);

  let llmCritique = '';
  try {
    const { text } = await chat(
      env,
      [
        {
          role: 'system',
          content:
            'You are an expert content strategist auditing a brand profile. Be specific and brutal. Give the single biggest weakness and the single highest-leverage fix.',
        },
        {
          role: 'user',
          content: `Audit this profile for input quality. Vague inputs = generic output.\n\n${JSON.stringify(profile, null, 1)}`,
        },
      ],
      { temperature: 0.3, maxTokens: 500 },
    );
    llmCritique = text.trim();
    const tmpScore = /[0-9]{1,3}\s*\/\s*100|\b(score|rating)[^0-9]{0,10}([0-9]{1,3})/i.exec(text)?.[2];
    if (tmpScore) score = Math.min(100, Math.max(0, parseInt(tmpScore, 10)));
  } catch {
    // LLM optional; rule-based score stands
  }

  return {
    score,
    flags,
    suggestions,
    llm_critique: llmCritique || null,
    analyzed_at: new Date().toISOString(),
  };
}

async function ensureBucket(db: SupabaseClient): Promise<void> {
  try {
    const { error } = await db.storage.getBucket('exports');
    if (error) {
      await db.storage.createBucket('exports', { public: true });
    }
  } catch {
    await db.storage.createBucket('exports', { public: true }).catch(() => undefined);
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'article';
}

/** Approximate years since a publish date string (e.g. "2024-03-01" or "2024"). */
function yearsSince(dateStr: string): number | null {
  const y = parseInt(dateStr.slice(0, 4), 10);
  if (!y) return null;
  const now = new Date().getFullYear();
  return Math.max(0, now - y);
}

/**
 * Convert a markdown article into a LinkedIn-ready post:
 * no markdown syntax, short punchy lines, single spacing, and a hard cap
 * (~1,500 chars) so the post is scannable in the LinkedIn feed.
 */
function toLinkedInPost(markdown: string, profileName?: string | null): string {
  const lines = markdown
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const line of lines) {
    // Skip markdown heading markers, bold-only lines collapse to text.
    const clean = line
      .replace(/^#{1,6}\s*/, '')
      .replace(/^\s*[-*]\s+/, '• ')
      .replace(/^\s*\d+\.\s+/, '• ')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
      .trim();
    if (!clean) continue;
    out.push(clean);
  }

  let post = out.join('\n');

  // Collapse >1 blank line to a single one.
  post = post.replace(/\n{2,}/g, '\n\n');

  // LinkedIn sweet spot ~1,300 chars; hard cap with a graceful cut.
  if (post.length > 1500) {
    const cut = post.slice(0, 1480);
    const lastBreak = cut.lastIndexOf('\n');
    post = cut.slice(0, lastBreak > 800 ? lastBreak : 1500).trim() + '\n\n[Read the full article →]';
  }

  if (profileName) post = post + `\n\n— ${profileName}`;
  return post;
}