-- Content Engine - 009_experience_layer.sql
-- The Experience Layer (VOICE_SYSTEM.md §3): the Proprietary POV store.
-- Holds what the operator knows that isn't in any dossier. Consumed by the
-- Proprietary POV pipeline stage; every entry is raw material for the
-- operator's POV in content.
--
-- * applicable_tags  -> text[] of topic tags so the engine can match entries
--                       to a topic at synthesis time.
-- * changed_mind_*   -> the changed-mind voice pattern (v1.2): what the
--                       operator believed, what happened, what they believe now.
-- * occurrences      -> how many times the pattern was observed (3+ = pattern,
--                       not anecdote; the honesty gate for publishing).
-- * publishable      -> false keeps an entry internal (shapes thinking, never
--                       written verbatim into content).

create table if not exists ce_experience (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  insight          text not null,
  scar             text,
  pattern          text,
  counter          text,
  applicable_tags  text[] not null default '{}',
  changed_mind_from text,
  changed_mind_to   text,
  changed_mind_story text,
  occurrences      integer not null default 1,
  publishable      boolean not null default true,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists ce_experience_user_idx on ce_experience (user_id);
create index if not exists ce_experience_tags_idx on ce_experience using gin (applicable_tags);

-- RLS: users only ever see/edit their own entries. (Server routes use the
-- service-role client and bypass this; the policy protects direct client use.)
alter table ce_experience enable row level security;

drop policy if exists ce_experience_select_own on ce_experience;
create policy ce_experience_select_own on ce_experience
  for select using (auth.uid() = user_id);

drop policy if exists ce_experience_insert_own on ce_experience;
create policy ce_experience_insert_own on ce_experience
  for insert with check (auth.uid() = user_id);

drop policy if exists ce_experience_update_own on ce_experience;
create policy ce_experience_update_own on ce_experience
  for update using (auth.uid() = user_id);

drop policy if exists ce_experience_delete_own on ce_experience;
create policy ce_experience_delete_own on ce_experience
  for delete using (auth.uid() = user_id);

-- Operator override for the so-what demand gate (VOICE_SYSTEM.md §8 step 6):
-- the operator may know something the data doesn't, so a run can skip the gate.
alter table ce_sessions
  add column if not exists skip_sowhat boolean not null default false;