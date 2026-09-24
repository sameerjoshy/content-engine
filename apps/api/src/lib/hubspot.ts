import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../env';

const HUBSPOT_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';

export interface HubSpotContactInput {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  jobTitle?: string;
  industry?: string;
}

/**
 * Upsert a contact into HubSpot by email (idempotent). Uses a Service Key.
 * Never throws on HubSpot errors — the caller decides what to do.
 * Returns the HubSpot contact id when the call succeeded.
 */
export async function upsertHubSpotContact(
  env: Env,
  input: HubSpotContactInput,
): Promise<{ id?: string; ok: boolean; error?: string }> {
  if (!env.HUBSPOT_API_KEY) return { ok: false, error: 'HUBSPOT_API_KEY not configured' };
  const props: Record<string, string> = { email: input.email };
  if (input.firstName) props.firstname = input.firstName;
  if (input.lastName) props.lastname = input.lastName;
  if (input.company) props.company = input.company;
  if (input.jobTitle) props.jobtitle = input.jobTitle;
  if (input.industry) props.industry = input.industry;

  try {
    const res = await fetch(HUBSPOT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: props,
      }),
    });
    // If the contact already exists, HubSpot returns 409 with the existing id.
    if (res.status === 409) {
      const existing = (await res.json().catch(() => ({}))) as { message?: string };
      const idMatch = /Existing ID: (\d+)/.exec(existing.message ?? '');
      if (idMatch) {
        const upd = await fetch(`${HUBSPOT_URL}/${idMatch[1]}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${env.HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ properties: props }),
        });
        if (!upd.ok) {
          const text = await upd.text().catch(() => '');
          return { ok: false, error: `HubSpot PATCH ${upd.status}: ${text.slice(0, 200)}` };
        }
        const data = (await upd.json()) as { id?: string };
        return { id: data.id, ok: true };
      }
      const text = await res.text().catch(() => '');
      return { ok: false, error: `HubSpot 409: ${text.slice(0, 200)}` };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `HubSpot ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id?: string };
    return { id: data.id, ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'HubSpot request failed' };
  }
}

/**
 * Sync a user to HubSpot if not already synced. Safe to call on every request:
 * the ce_hubspot_syncs row makes it a no-op after the first success.
 */
export async function syncUserToHubSpot(db: SupabaseClient, env: Env, userId: string, user: {
  email?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  job_title?: string;
  industry?: string;
}, force = false): Promise<void> {
  if (!env.HUBSPOT_API_KEY) return;
  const email = user.email;
  if (!email) return;

  const { data: existing } = await db
    .from('ce_hubspot_syncs')
    .select('id,status')
    .eq('user_id', userId)
    .single();
  if (!force && existing && (existing.status === 'synced' || existing.status === 'pending')) return;

  const result = await upsertHubSpotContact(env, {
    email,
    firstName: user.first_name,
    lastName: user.last_name,
    company: user.company,
    jobTitle: user.job_title,
    industry: user.industry,
  });

  await db.from('ce_hubspot_syncs').upsert(
    {
      user_id: userId,
      email,
      hubspot_id: result.id ?? null,
      status: result.ok ? 'synced' : 'failed',
      error: result.ok ? null : result.error ?? null,
      synced_at: result.ok ? new Date().toISOString() : null,
    },
    { onConflict: 'user_id,email' },
  );
}