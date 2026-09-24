-- Content Engine - 003_hubspot_syncs.sql
-- Tracks which users have been synced to HubSpot (idempotent upsert by email).

create table if not exists ce_hubspot_syncs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  email           text not null,
  hubspot_id      text,
  status          text not null default 'pending',
  error           text,
  synced_at       timestamptz,
  created_at      timestamptz default now(),
  unique (user_id, email)
);

alter table ce_hubspot_syncs enable row level security;

drop policy if exists ce_hubspot_syncs_own on ce_hubspot_syncs;
create policy ce_hubspot_syncs_own on ce_hubspot_syncs for all
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());