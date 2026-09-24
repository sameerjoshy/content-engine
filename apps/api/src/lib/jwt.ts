import type { Env } from '../env';

export interface AuthUser {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

/**
 * Verify a Bearer JWT against Supabase Auth by calling /auth/v1/user.
 * One subrequest per authenticated call — reliable and always session-fresh.
 * Returns null when unauthenticated.
 */
export async function getUser(env: Env, request: Request): Promise<AuthUser | null> {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (env.SUPABASE_ANON_KEY) headers.apikey = env.SUPABASE_ANON_KEY;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers });
    if (!res.ok) return null;
    return (await res.json()) as AuthUser;
  } catch {
    return null;
  }
}