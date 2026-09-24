import type { Env } from './env';
import { ArticleWorkflow } from './workflow';
import { getUser, type AuthUser } from './lib/jwt';
import { handleApi, json } from './routes/api';
import { runResearchPipeline, runProofFollowUpEndpoint, runSoWhatEndpoint, runPovEndpoint, runEditorEndpoint, runSeoAnalyzerEndpoint } from './routes/internal';
import { syncUserToHubSpot } from './lib/hubspot';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (method === 'GET' && path === '/health') {
      return json({ ok: true, service: 'content-engine-api', time: new Date().toISOString() });
    }

    // Supabase Auth hook: "After User Created". Fires on every signup
    // (even before email confirmation) — syncs the contact to HubSpot.
    if (method === 'POST' && path === '/auth-hook/after-user-created') {
      const secret = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
      if (!env.AUTH_HOOK_SECRET || secret !== env.AUTH_HOOK_SECRET) {
        return json({ error: 'Unauthorized' }, 401);
      }
      try {
        const body = (await request.json()) as {
          user?: { id?: string; email?: string; user_metadata?: Record<string, unknown> };
        };
        const u = body.user;
        if (u?.id && u.email) {
          const db = await import('./lib/db').then((m) => m.getDb(env));
          await syncUserToHubSpot(db, env, u.id, {
            email: u.email,
            first_name: (u.user_metadata?.first_name as string | undefined) ?? undefined,
            last_name: (u.user_metadata?.last_name as string | undefined) ?? undefined,
            company: (u.user_metadata?.company as string | undefined) ?? undefined,
          });
        }
        return json({ ok: true });
      } catch {
        return json({ ok: false, error: 'Invalid payload' }, 400);
      }
    }

    // Internal self-binding endpoint (workflow → WORKER_SELF). The workflow
    // pays one subrequest for the call; this invocation gets its own fresh
    // subrequest budget, which keeps the whole pipeline under the Free-plan
    // ~50 subrequests per instance. Guarded by the same hook secret.
    if (method === 'POST' && path === '/internal/research') {
      const secret = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
      if (!env.AUTH_HOOK_SECRET || secret !== env.AUTH_HOOK_SECRET) {
        return json({ error: 'Unauthorized' }, 401);
      }
      const body = (await request.json().catch(() => ({}))) as { session_id?: string; user_id?: string; format?: string };
      if (!body.session_id || !body.user_id) return json({ error: 'session_id and user_id required' }, 400);
      return await runResearchPipeline({ env, sessionId: body.session_id, userId: body.user_id }, body);
    }

    // Internal proof follow-up (research pipeline → WORKER_SELF). Fresh
    // invocation = fresh 50-subrequest budget so the targeted follow-up round
    // never pushes the main research invocation over the limit.
    if (method === 'POST' && path === '/internal/research-followup') {
      const secret = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
      if (!env.AUTH_HOOK_SECRET || secret !== env.AUTH_HOOK_SECRET) {
        return json({ error: 'Unauthorized' }, 401);
      }
      const body = (await request.json().catch(() => ({}))) as {
        session_id?: string;
        user_id?: string;
        topic?: string;
        angle?: string;
        depth?: string;
        format?: string;
        missing?: string[];
      };
      if (!body.session_id || !body.user_id || !body.topic || !body.angle) {
        return json({ error: 'session_id, user_id, topic and angle required' }, 400);
      }
      return await runProofFollowUpEndpoint(env, body);
    }

    // Internal so-what demand gate (workflow → WORKER_SELF). Fresh invocation
    // = fresh 50-subrequest budget; the gate's search subrequests never touch
    // the workflow instance's shared budget.
    if (method === 'POST' && path === '/internal/sowhat') {
      const secret = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
      if (!env.AUTH_HOOK_SECRET || secret !== env.AUTH_HOOK_SECRET) {
        return json({ error: 'Unauthorized' }, 401);
      }
      const body = (await request.json().catch(() => ({}))) as {
        session_id?: string;
        user_id?: string;
        topic?: string;
        angle?: string;
      };
      if (!body.session_id || !body.user_id || !body.topic || !body.angle) {
        return json({ error: 'session_id, user_id, topic and angle required' }, 400);
      }
      return await runSoWhatEndpoint(env, body);
    }

    // Internal Proprietary POV stage (workflow → WORKER_SELF). Fresh invocation
    // = fresh ~50-subrequest budget for its DB reads + LLM call.
    if (method === 'POST' && path === '/internal/pov') {
      const secret = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
      if (!env.AUTH_HOOK_SECRET || secret !== env.AUTH_HOOK_SECRET) {
        return json({ error: 'Unauthorized' }, 401);
      }
      const body = (await request.json().catch(() => ({}))) as { session_id?: string; user_id?: string };
      if (!body.session_id || !body.user_id) return json({ error: 'session_id and user_id required' }, 400);
      return await runPovEndpoint(env, body);
    }

    // Internal Editor stage (workflow → WORKER_SELF). Fresh invocation = fresh
    // ~50-subrequest budget for the judge/fact-check/strengthen LLM calls +
    // evidence-usage writes.
    if (method === 'POST' && path === '/internal/editor') {
      const secret = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
      if (!env.AUTH_HOOK_SECRET || secret !== env.AUTH_HOOK_SECRET) {
        return json({ error: 'Unauthorized' }, 401);
      }
      const body = (await request.json().catch(() => ({}))) as { session_id?: string; user_id?: string };
      if (!body.session_id || !body.user_id) return json({ error: 'session_id and user_id required' }, 400);
      return await runEditorEndpoint(env, body);
    }

    // Internal SEO Analyzer (standalone or pipeline → WORKER_SELF). Fresh
    // invocation = fresh ~50-subrequest budget for the Serper + keyless
    // search chain + LLM synthesis.
    if (method === 'POST' && path === '/internal/seo-analyzer') {
      const secret = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
      if (!env.AUTH_HOOK_SECRET || secret !== env.AUTH_HOOK_SECRET) {
        return json({ error: 'Unauthorized' }, 401);
      }
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      if (!body.user_id || !body.topic_cluster) {
        return json({ error: 'user_id and topic_cluster required' }, 400);
      }
      return await runSeoAnalyzerEndpoint(env, body);
    }

    if (!path.startsWith('/api/')) {
      return json({ error: 'Not found' }, 404);
    }

    const user: AuthUser | null = await getUser(env, request);
    if (!user) {
      // CORS must be present on auth failures too — otherwise a cross-origin
      // client (the web app) sees a CORS error instead of a readable 401.
      return withCors(json({ error: 'Unauthorized', details: 'Sign in to continue.' }, 401));
    }

    return withCors(await handleApi(request, env, user, path, method));
  },

  // Daily keep-alive ping. Supabase free-tier projects auto-pause after ~7
  // days without DB activity, and a paused project drops its API subdomain
  // from DNS — which made Google OAuth (and every auth call) fail with
  // "site cannot be reached". A single cheap read per day resets the timer.
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(keepSupabaseAlive(env));
  },
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

async function keepSupabaseAlive(env: Env): Promise<void> {
  try {
    const db = await import('./lib/db').then((m) => m.getDb(env));
    await db.from('ce_sessions').select('id').limit(1);
    console.log('[keepalive] supabase ping ok', new Date().toISOString());
  } catch (e) {
    console.error('[keepalive] supabase ping failed', (e as Error).message);
  }
}

export { ArticleWorkflow };