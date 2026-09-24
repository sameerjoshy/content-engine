import type { Env } from '../env';
import type { ContentFormat, Depth, EvidenceItem, Profile, Series } from '../types';
import { getDb } from '../lib/db';
import { logEvent } from '../lib/events';
import { estimateCost, type UsageCallback } from '../lib/llm';
import { soWhatGate } from '../agents/sowhat';
import { buildProprietaryPov, matchExperienceEntries, povToMarkdown } from '../agents/pov';
import { editArticle, factCheckRewrite, matchEvidenceUsage, proofCoverageCheck, strengthenProofSection, type UnsupportedClaim } from '../agents/editor';
import { compositeGate } from '../lib/gate';
import type { ExperienceEntry } from '../types';
import type { ContentMapItem } from '../types';
import {
  decomposeQueries,
  extractEvidence,
  hasWebSearchKey,
  proofCoverage,
  parseProofRequirements,
  runFetchRound,
  runProofFollowUp,
  runSearchRound,
  scoreRelevance,
  synthesizeDossier,
  type ResearchRules,
} from '../agents/researcher';

/**
 * Internal pipeline endpoint. Runs the full Researcher stage (query planning,
 * web search, page fetch, relevance scoring, evidence extraction, dossier
 * synthesis, and persistence) inside a single Worker invocation.
 *
 * Why: on the Workers Free plan a Workflow instance shares ONE ~50-subrequest
 * budget across ALL its steps. The research pipeline alone needs ~40, so it is
 * delegated here via a self service binding — the workflow pays a single
 * subrequest for the call, and THIS invocation gets its own fresh budget.
 */

interface InternalCtx {
  env: Env;
  sessionId: string;
  userId: string;
}

export async function runResearchPipeline(
  ctx: InternalCtx,
  body: { session_id?: string; user_id?: string; format?: string },
): Promise<Response> {
  const { env, sessionId, userId } = ctx;
  const db = getDb(env);

  const log = (eventType: string, message: string, data?: unknown) =>
    logEvent(db, {
      session_id: sessionId,
      user_id: userId,
      stage: 'researcher',
      event_type: eventType,
      message,
      data: data as Record<string, unknown> | undefined,
    });

  const usageLogger: UsageCallback = (usage, latencyMs, model) =>
    logEvent(db, {
      session_id: sessionId,
      user_id: userId,
      stage: 'researcher',
      event_type: 'llm_call',
      message: `LLM call${model ? ` (${model})` : ''}`,
      tokens_in: usage.prompt_tokens,
      tokens_out: usage.completion_tokens,
      cost_usd: estimateCost(usage, model),
      latency_ms: latencyMs,
    });

  const setSession = (fields: Record<string, unknown>) =>
    db.from('ce_sessions').update(fields).eq('id', sessionId);

  try {
    const { data: s } = await db
      .from('ce_sessions')
      .select('topic,angle,depth,format,research_note,profile_snapshot')
      .eq('id', sessionId)
      .single();
    if (!s) return json({ ok: false, error: 'Session not found' }, 404);
    const topic = s.topic as string;
    const rawAngle = s.angle as string;
    const researchNote = (s.research_note as string | null) ?? '';
    // A human steer ("more stats", "find a real company example") is appended
    // to the angle so query planning + extraction bias toward the request.
    const angle = researchNote ? `${rawAngle} — RESEARCHER DIRECTIVE: ${researchNote}` : rawAngle;
    const depth = (s.depth ?? 'moderate') as Depth;
    const format = (s.format ?? body.format ?? 'article') as ContentFormat;
    const profile = s.profile_snapshot as Profile | null;

    await setSession({ current_stage: 'researcher', status: 'in_progress' });
    await log('stage_start', format === 'howto' ? 'Planning deep how-to research' : format === 'best_practice' ? 'Planning best-practice landscape research' : 'Planning research queries');
    const rules = ((profile?.research_rules ?? {}) as ResearchRules);
    const queries = await decomposeQueries(env, topic, angle, rules, depth, usageLogger, format);
    await log('step_progress', format === 'howto' ? `Planned ${queries.length} deep how-to research queries` : `Generated ${queries.length} search queries`, { queries });
    if (!hasWebSearchKey(env)) {
      await log(
        'step_progress',
        'No search API key configured (TAVILY_API_KEY). Research limited to open academic + Wikipedia sources.',
        { coverage: 'academic_only' },
      );
    }

    const results = await runSearchRound(env, queries, depth, async () => {});
    await log('step_progress', `Searched ${queries.length} queries — found ${results.length} candidate sources`);

    const docs = await runFetchRound(results, depth, async () => {});
    await log('step_progress', `Extracted text from ${docs.length} sources`);

    let kept = docs;
    if (docs.length > 0) {
      await log('step_progress', 'Scoring sources for relevance');
      const scored = await scoreRelevance(env, topic, angle, docs, usageLogger);
      const enriched = docs.map((d, i) => ({
        d,
        relevance: scored[i]?.relevance ?? 0.4,
        keep: scored[i]?.keep ?? true,
      }));
      kept = enriched
        .filter((r) => r.keep || r.relevance >= 0.3)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 7)
        .map((r) => r.d);
      if (kept.length < 2 && docs.length > 0) {
        kept = [...enriched]
          .sort((a, b) => b.relevance - a.relevance)
          .slice(0, Math.min(2, enriched.length))
          .map((r) => r.d);
      }
      await log('step_progress', `Keeping ${kept.length} relevant sources`);
    }

    await log('step_progress', 'Extracting claims and evidence');
    let evidence = await extractEvidence(env, topic, angle, kept, depth, usageLogger, format);
    await log('step_progress', `Extracted ${evidence.length} evidence items`);

    // Proof follow-up: if the profile requires named examples / expert quotes /
    // statistics and research is short of them, delegate a targeted round to a
    // FRESH self-binding invocation (own 50-subrequest budget) so the follow-up
    // never pushes this invocation over the limit.
    const requiredProof = parseProofRequirements(rules);
const { missing } = proofCoverage(evidence, requiredProof, format);
    if (missing.length && hasWebSearchKey(env) && env.WORKER_SELF && env.AUTH_HOOK_SECRET) {
      await log(
        'step_progress',
        `Proof gap detected — missing: ${missing.join(', ')}. Running targeted follow-up research.`,
        { required: requiredProof, missing },
      );
      const fu = await env.WORKER_SELF.fetch('https://WORKER_SELF/internal/research-followup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.AUTH_HOOK_SECRET}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          user_id: userId,
          topic,
          angle,
          depth,
          format,
          missing,
        }),
      });
      const extra = (await fu.json().catch(() => ({}))) as { ok?: boolean; evidence?: EvidenceItem[]; error?: string };
      if (fu.ok && extra.ok && extra.evidence?.length) {
        evidence = [...evidence, ...extra.evidence].slice(0, 20);
        await log('step_progress', `Proof follow-up complete — evidence now ${evidence.length} items`, {
counts: proofCoverage(evidence, requiredProof, format).counts,
        });
      } else {
        await log('step_progress', `Proof follow-up returned no additional evidence${extra.error ? ` (${extra.error})` : ''}`);
      }
    }

    const md = await synthesizeDossier(env, topic, angle, depth, evidence, usageLogger, format);
    const finalProof = proofCoverage(evidence, requiredProof, format);
    await db
      .from('ce_drafts')
      .upsert(
        {
          session_id: sessionId,
          user_id: userId,
          stage: 'researcher',
          content: md,
          meta: { evidence_count: evidence.length, proof_check: { found: finalProof.counts, missing: finalProof.missing } },
        },
        { onConflict: 'session_id,stage' },
      );
    await db.from('ce_evidence').delete().eq('session_id', sessionId);
    const rows = evidence.map((e: EvidenceItem) => ({
      session_id: sessionId,
      user_id: userId,
      claim_id: e.claim_id,
      claim: e.claim,
      source_url: e.source_url,
      source_title: e.source_title,
      publish_date: e.publish_date ?? null,
      source_type: e.source_type,
      proof_type: e.proof_type ?? null,
      trust_score: e.trust_score,
      evidence_snippet: e.evidence_snippet,
    }));
    if (rows.length) await db.from('ce_evidence').insert(rows);
    await log('stage_end', `Research complete: ${rows.length} evidence items`, {
proof: proofCoverage(evidence, requiredProof, format).counts,
    });

    return json({ ok: true, evidence_count: rows.length, doc_count: docs.length, queries: queries.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Research pipeline failed';
    await log('error', `Research failed: ${msg}`);
    await setSession({ status: 'error', error_message: msg });
    return json({ ok: false, error: msg }, 500);
  }
}

/**
 * Standalone proof follow-up: runs its own search + fetch + extract round in a
 * fresh Worker invocation (own 50-subrequest budget). Returns the extra
 * evidence items only — the caller merges and persists them.
 */
export async function runProofFollowUpEndpoint(
  env: Env,
  body: { session_id?: string; user_id?: string; topic?: string; angle?: string; depth?: string; format?: string; missing?: string[] },
): Promise<Response> {
  const sessionId = body.session_id ?? '';
  const userId = body.user_id ?? '';
  const db = getDb(env);
  const usageLogger: UsageCallback = (usage, latencyMs, model) =>
    logEvent(db, {
      session_id: sessionId,
      user_id: userId,
      stage: 'researcher',
      event_type: 'llm_call',
      message: `LLM call${model ? ` (${model})` : ''}`,
      tokens_in: usage.prompt_tokens,
      tokens_out: usage.completion_tokens,
      cost_usd: estimateCost(usage, model),
      latency_ms: latencyMs,
    });
  try {
    const topic = body.topic ?? '';
    const angle = body.angle ?? '';
    const depth = (body.depth ?? 'moderate') as Depth;
    const format = (body.format ?? 'article') as ContentFormat;
    const missing = body.missing ?? [];
const extra = await runProofFollowUp(env, topic, angle, missing, format);
    if (!extra.length) return json({ ok: true, evidence: [] });
    const docs = await runFetchRound(extra, depth, async () => {});
    const evidence = await extractEvidence(env, topic, angle, docs, depth, usageLogger, format);
    return json({ ok: true, evidence });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'Follow-up failed' }, 500);
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/**
 * Standalone so-what demand gate (VOICE_SYSTEM.md §8 step 6). Runs in its own
 * Worker invocation via the self service binding so its search subrequests
 * (up to ~10 on the keyless chain) never touch the workflow instance's
 * ~50-subrequest budget — same reason research is self-bound.
 */
export async function runSoWhatEndpoint(
  env: Env,
  body: { session_id?: string; user_id?: string; topic?: string; angle?: string },
): Promise<Response> {
  const sessionId = body.session_id ?? '';
  const userId = body.user_id ?? '';
  const db = getDb(env);
  const usageLogger: UsageCallback = (usage, latencyMs, model) =>
    logEvent(db, {
      session_id: sessionId,
      user_id: userId,
      stage: 'sowhat',
      event_type: 'llm_call',
      message: `LLM call${model ? ` (${model})` : ''}`,
      tokens_in: usage.prompt_tokens,
      tokens_out: usage.completion_tokens,
      cost_usd: estimateCost(usage, model),
      latency_ms: latencyMs,
    });
  try {
    const topic = body.topic ?? '';
    const angle = body.angle ?? '';
    if (!topic || !angle) return json({ ok: false, error: 'topic and angle required' }, 400);
    const verdict = await soWhatGate(env, topic, angle, usageLogger);
    return json({ ok: true, verdict });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'So-what gate failed' }, 500);
  }
}

/**
 * Standalone Proprietary POV stage (VOICE_SYSTEM.md §3/§8 step 5). Runs in its
 * own Worker invocation via the self service binding so its DB reads + LLM call
 * never touch the workflow instance's ~50-subrequest budget (same reason
 * research and the so-what gate are self-bound).
 */
export async function runPovEndpoint(
  env: Env,
  body: { session_id?: string; user_id?: string },
): Promise<Response> {
  const sessionId = body.session_id ?? '';
  const userId = body.user_id ?? '';
  const db = getDb(env);
  const log = (eventType: string, message: string, data?: unknown) =>
    logEvent(db, {
      session_id: sessionId,
      user_id: userId,
      stage: 'pov',
      event_type: eventType,
      message,
      data: data as Record<string, unknown> | undefined,
    });
  const usageLogger: UsageCallback = (usage, latencyMs, model) =>
    logEvent(db, {
      session_id: sessionId,
      user_id: userId,
      stage: 'pov',
      event_type: 'llm_call',
      message: `LLM call${model ? ` (${model})` : ''}`,
      tokens_in: usage.prompt_tokens,
      tokens_out: usage.completion_tokens,
      cost_usd: estimateCost(usage, model),
      latency_ms: latencyMs,
    });
  try {
    const [{ data: s }, { data: dossierRow }, { data: evidenceRows }, { data: entries }] = await Promise.all([
      db.from('ce_sessions').select('topic,angle').eq('id', sessionId).single(),
      db.from('ce_drafts').select('content').eq('session_id', sessionId).eq('stage', 'researcher').single(),
      db.from('ce_evidence').select('claim,source_url,source_title,evidence_snippet,proof_type').eq('session_id', sessionId),
      db.from('ce_experience').select('*').eq('user_id', userId).limit(100),
    ]);
    if (!s) return json({ ok: false, error: 'Session not found' }, 404);
    const topic = s.topic as string;
    const angle = s.angle as string;
    const dossierMd = (dossierRow as unknown as { content: string } | null)?.content ?? '';
    const evidence = (evidenceRows ?? []) as unknown as EvidenceItem[];
    const matched = matchExperienceEntries((entries ?? []) as unknown as ExperienceEntry[], topic, angle);
    const pov = await buildProprietaryPov(env, topic, angle, dossierMd, evidence, matched, usageLogger);
    const md = povToMarkdown(pov);
    await db
      .from('ce_drafts')
      .upsert({ session_id: sessionId, user_id: userId, stage: 'pov', content: md, meta: { pov } }, { onConflict: 'session_id,stage' });
    await log('thinking', pov.belief, {
      has_experience: pov.has_experience,
      entries_used: pov.entries_used,
      changed_mind: pov.changed_mind,
      tension: pov.tension,
    });
    await log('stage_end', pov.has_experience ? `POV from Experience Layer (${pov.entries_used.length} entry/ies)` : 'POV analytical — Experience Layer had nothing on this topic');
    return json({ ok: true, has_experience: pov.has_experience, entries_used: pov.entries_used });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'POV stage failed';
    await log('error', `POV stage failed: ${msg}`);
    return json({ ok: false, error: msg }, 500);
  }
}

/**
 * Standalone Editor stage (fact-check + polish + composite gate). Runs in its
 * own Worker invocation so its LLM calls (judge + fact-check rewrite +
 * strengthen) and DB writes never exhaust the workflow instance's shared
 * ~50-subrequest budget.
 */
export async function runEditorEndpoint(
  env: Env,
  body: { session_id?: string; user_id?: string },
): Promise<Response> {
  const sessionId = body.session_id ?? '';
  const userId = body.user_id ?? '';
  const db = getDb(env);
  const log = (eventType: string, message: string, data?: unknown) =>
    logEvent(db, {
      session_id: sessionId,
      user_id: userId,
      stage: 'editor',
      event_type: eventType,
      message,
      data: data as Record<string, unknown> | undefined,
    });
  const usageLogger: UsageCallback = (usage, latencyMs, model) =>
    logEvent(db, {
      session_id: sessionId,
      user_id: userId,
      stage: 'editor',
      event_type: 'llm_call',
      message: `LLM call${model ? ` (${model})` : ''}`,
      tokens_in: usage.prompt_tokens,
      tokens_out: usage.completion_tokens,
      cost_usd: estimateCost(usage, model),
      latency_ms: latencyMs,
    });
  try {
    const [{ data: s }, { data: draftRow }, { data: dossierRow }, { data: evidenceRows }, { data: povRow }] = await Promise.all([
      db.from('ce_sessions').select('profile_snapshot,format,series').eq('id', sessionId).single(),
      db.from('ce_drafts').select('content').eq('session_id', sessionId).eq('stage', 'writer').single(),
      db.from('ce_drafts').select('content').eq('session_id', sessionId).eq('stage', 'researcher').single(),
      db.from('ce_evidence').select('claim,source_url,evidence_snippet,proof_type,publish_date').eq('session_id', sessionId),
      db.from('ce_drafts').select('content').eq('session_id', sessionId).eq('stage', 'pov').single(),
    ]);
    if (!s) return json({ ok: false, error: 'Session not found' }, 404);
    const profile = s.profile_snapshot as unknown as Profile;
    const format = (s.format ?? 'article') as ContentFormat;
    const evidence = (evidenceRows ?? []) as unknown as EvidenceItem[];
    const povMd = (povRow as unknown as { content: string } | null)?.content ?? null;

    await log('stage_start', 'Fact-checking and polishing');
    const result = await editArticle(
      env,
      (draftRow as unknown as { content: string } | null)?.content ?? '',
      (dossierRow as unknown as { content: string } | null)?.content ?? '',
      evidence,
      profile?.name ?? 'Unknown profile',
      usageLogger,
      undefined,
      format,
      (s.series ?? null) as Series | null,
      povMd,
    );

    let finalDraft = result.edited_draft;
    const unsupported = (result.unsupported_claims ?? []) as UnsupportedClaim[];
    const factClaims = unsupported.filter((c) => c.kind === 'fact' || !c.kind);
    const analysisClaims = unsupported.filter((c) => c.kind === 'analysis');
    if (factClaims.length) {
      await log('step_progress', `Removing/fixing ${factClaims.length} fabricated fact(s) — preserving ${analysisClaims.length} analysis claim(s)`);
      finalDraft = await factCheckRewrite(
        env,
        finalDraft,
        (dossierRow as unknown as { content: string } | null)?.content ?? '',
        evidence,
        factClaims,
        usageLogger,
      );
      await log('step_progress', 'Fact-check pass complete');
    }

    const requiredProof = parseProofRequirements((profile?.research_rules ?? {}) as ResearchRules);
    let proofCheck = proofCoverageCheck(finalDraft, evidence, requiredProof, format);
    const hasProofRequirement =
      format === 'howto' ||
      (requiredProof.named_examples ?? 0) > 0 ||
      (requiredProof.expert_quotes ?? 0) > 0 ||
      (requiredProof.statistics ?? 0) > 0;
    if (proofCheck.missing.length && hasProofRequirement) {
      await log('step_progress', `Strengthening weak areas: ${proofCheck.missing.join(', ')}`);
      finalDraft = await strengthenProofSection(
        env,
        finalDraft,
        (dossierRow as unknown as { content: string } | null)?.content ?? '',
        evidence,
        proofCheck.missing,
        usageLogger,
      );
      proofCheck = proofCoverageCheck(finalDraft, evidence, requiredProof, format);
      await log('step_progress', `Proof strengthen pass complete — remaining: ${proofCheck.missing.length ? proofCheck.missing.join(', ') : 'none'}`);
    }

    const proofTotal =
      (requiredProof.named_examples ?? 0) > 0 || format === 'best_practice' || format === 'howto'
        ? (requiredProof.named_examples ?? (format === 'best_practice' ? 2 : 1)) +
          (requiredProof.expert_quotes ?? 0) +
          (requiredProof.statistics ?? 0) +
          (format === 'howto' ? 1 : 0)
        : 0;
    const composite = compositeGate({
      format,
      draft: finalDraft,
      evidence,
      factClaims: factClaims.length,
      proofMissing: proofCheck.missing.length,
      proofTotal,
      originalMoves: result.original_moves ?? [],
      voiceScores: {
        edge_authenticity: result.edge_authenticity_score,
        earned_uncertainty: result.earned_uncertainty_score,
        human_voice: result.human_voice_score,
        changed_mind_strength: result.changed_mind_strength,
      },
      quality_score: result.quality_score,
    });
    if (!composite.pass) {
      await log('step_progress', `Composite gate ${composite.composite.toFixed(2)} (deterministic ${composite.deterministic.toFixed(2)}) — below bar; flagged for human publish gate`);
    }
    await log('thinking', `Composite ${composite.composite.toFixed(2)} (deterministic ${composite.deterministic.toFixed(2)}, subjective ${composite.subjective.toFixed(2)}) · ${(result.original_moves ?? []).length ? `original moves: ${(result.original_moves ?? []).join(', ')}` : 'NO original move found — flagged'}`, composite as unknown as Record<string, unknown>);

    await db
      .from('ce_drafts')
      .upsert(
        {
          session_id: sessionId,
          user_id: userId,
          stage: 'editor',
          content: finalDraft,
          meta: {
            quality_score: result.quality_score,
            edits: result.edits_markdown,
            unsupported_claims: unsupported,
            strengths: result.strengths,
            main_gap: result.main_gap,
            claim_scores: result.claim_scores ?? [],
            proof_check: hasProofRequirement ? { found: proofCheck.found, missing: proofCheck.missing } : null,
            original_moves: result.original_moves ?? [],
            voice_scores: {
              edge_authenticity: result.edge_authenticity_score,
              earned_uncertainty: result.earned_uncertainty_score,
              human_voice: result.human_voice_score,
              changed_mind_strength: result.changed_mind_strength,
            },
            decorative_devices: result.decorative_devices ?? [],
            composite,
          },
        },
        { onConflict: 'session_id,stage' },
      );

    const { cited } = matchEvidenceUsage(finalDraft, evidence);
    const citedUrls = new Set(cited.map((c) => c.source_url));
    const citedList = evidence.filter((r) => citedUrls.has(r.source_url)).map((r) => r.source_url);
    const droppedList = evidence.filter((r) => !citedUrls.has(r.source_url)).map((r) => r.source_url);
    if (citedList.length) {
      await db.from('ce_evidence').update({ usage: 'cited' }).eq('session_id', sessionId).in('source_url', citedList);
    }
    if (droppedList.length) {
      await db.from('ce_evidence').update({ usage: 'dropped' }).eq('session_id', sessionId).in('source_url', droppedList);
    }

    await db
      .from('ce_sessions')
      .update({ current_stage: 'complete', status: 'complete', completed_at: new Date().toISOString() })
      .eq('id', sessionId);
    await log('stage_end', `Edited draft ready (quality ${result.quality_score}/10)`);

    return json({ ok: true, quality_score: result.quality_score, composite });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Editor stage failed';
    await log('error', `Editor stage failed: ${msg}`);
    await db.from('ce_sessions').update({ status: 'error', error_message: msg }).eq('id', sessionId);
    return json({ ok: false, error: msg }, 500);
  }
}

/**
 * Internal SEO Analyzer endpoint. Runs the full AEO + search audit inside one
 * Worker invocation (fresh ~50-subrequest budget), so a future pipeline stage
 * can call it via WORKER_SELF without exhausting the workflow instance's budget.
 *
 * Body: { user_id, topic_cluster, domain?, competitors?, focus? }
 */
export async function runSeoAnalyzerEndpoint(env: Env, body: Record<string, unknown>) {
  const userId = String(body.user_id ?? '');
  const topicCluster = String(body.topic_cluster ?? '').trim();
  if (!userId || topicCluster.length < 4) {
    return json({ ok: false, error: 'user_id and topic_cluster (≥4 chars) required' }, 400);
  }
  const db = getDb(env);
  const { data: contentMap } = await db
    .from('ce_content_map')
    .select('id,title')
    .eq('user_id', userId)
    .limit(50);

  const { runSeoAnalysis } = await import('../agents/seo');
  const result = await runSeoAnalysis(env, {
    topicCluster,
    domain: String(body.domain ?? 'gtm-360.com').trim() || 'gtm-360.com',
    competitors: Array.isArray(body.competitors) ? body.competitors.map((c) => String(c).trim()).filter(Boolean).slice(0, 4) : [],
    contentMap: (contentMap ?? []) as ContentMapItem[],
    focus: String(body.focus ?? '').trim() || undefined,
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
  return json({ ok: true, ...result });
}
