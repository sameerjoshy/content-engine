import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../env';

let _db: SupabaseClient | null = null;

/** Singleton service-role client. Bypasses RLS (server-side only). */
export function getDb(env: Env): SupabaseClient {
  if (!_db) {
    _db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _db;
}