-- Content Engine - 001_schema.sql
-- V2 schema. NOTE: this Supabase project is SHARED with the GTM/OKR system,
-- so all tables are prefixed `ce_` to avoid collisions with existing tables
-- (e.g. public.profiles, public.users, public.accounts).
-- Auth-scoped, multi-user, research-grounded. Idempotent-friendly.

create extension if not exists "pgcrypto";

create table if not exists ce_profile_templates (
  slug              text primary key,
  name              text not null,
  description       text,
  brand_voice       jsonb not null,
  icp               jsonb not null,
  content_standards jsonb not null,
  research_rules    jsonb not null,
  created_at        timestamptz default now()
);

create table if not exists ce_profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  description       text,
  slug              text,
  brand_voice       jsonb not null default '{}'::jsonb,
  icp               jsonb not null default '{}'::jsonb,
  content_standards jsonb not null default '{}'::jsonb,
  research_rules    jsonb not null default '{}'::jsonb,
  input_quality     jsonb,
  source_template   text,
  is_active         boolean not null default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create table if not exists ce_content_map (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  angle        text,
  publish_date date,
  profile      text,
  status       text default 'published',
  url          text,
  created_at   timestamptz default now()
);

create table if not exists ce_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  profile_id       uuid references ce_profiles(id) on delete set null,
  profile_snapshot jsonb,
  topic            text not null,
  angle            text not null,
  depth            text not null check (depth in ('light','moderate','deep')),
  current_stage    text not null default 'validator',
  status           text not null default 'starting'
                   check (status in ('starting','in_progress','complete','error','pivot','killed')),
  error_message    text,
  decision         jsonb,
  workflow_id      text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  completed_at     timestamptz
);

create table if not exists ce_drafts (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references ce_sessions(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  stage      text not null,
  content    text not null,
  meta       jsonb,
  created_at timestamptz default now(),
  unique (session_id, stage)
);

create table if not exists ce_evidence (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references ce_sessions(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  claim_id         text,
  claim            text not null,
  source_url       text,
  source_title     text,
  publish_date     text,
  source_type      text,
  trust_score      numeric,
  evidence_snippet text,
  usage            text default 'unused',
  created_at       timestamptz default now()
);

create table if not exists ce_stage_events (
  id         bigserial primary key,
  session_id uuid not null references ce_sessions(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  stage      text,
  event_type text not null,
  message    text,
  data       jsonb,
  tokens_in  int,
  tokens_out int,
  cost_usd   numeric,
  latency_ms int,
  created_at timestamptz default now()
);

create table if not exists ce_published_files (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references ce_sessions(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  filename     text not null,
  storage_path text not null,
  published_at timestamptz default now()
);

create index if not exists idx_ce_profiles_user    on ce_profiles(user_id);
create index if not exists idx_ce_content_map_user on ce_content_map(user_id);
create index if not exists idx_ce_sessions_user    on ce_sessions(user_id, created_at desc);
create index if not exists idx_ce_sessions_status  on ce_sessions(status);
create index if not exists idx_ce_drafts_session   on ce_drafts(session_id);
create index if not exists idx_ce_evidence_session on ce_evidence(session_id);
create index if not exists idx_ce_events_session   on ce_stage_events(session_id, created_at);
create index if not exists idx_ce_published_user   on ce_published_files(user_id);

alter table ce_profiles        enable row level security;
alter table ce_content_map     enable row level security;
alter table ce_sessions        enable row level security;
alter table ce_drafts          enable row level security;
alter table ce_evidence        enable row level security;
alter table ce_stage_events    enable row level security;
alter table ce_published_files enable row level security;

drop policy if exists ce_profiles_own on ce_profiles;
create policy ce_profiles_own on ce_profiles for all
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists ce_content_map_own on ce_content_map;
create policy ce_content_map_own on ce_content_map for all
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists ce_sessions_own on ce_sessions;
create policy ce_sessions_own on ce_sessions for all
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists ce_drafts_own on ce_drafts;
create policy ce_drafts_own on ce_drafts for all
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists ce_evidence_own on ce_evidence;
create policy ce_evidence_own on ce_evidence for all
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists ce_events_own on ce_stage_events;
create policy ce_events_own on ce_stage_events for all
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists ce_published_own on ce_published_files;
create policy ce_published_own on ce_published_files for all
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());