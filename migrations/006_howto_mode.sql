-- Content Engine - 006_howto_mode.sql
-- Adds a content format dimension to sessions: articles vs. deep how-to
-- snippets (teach-one-move, series-aware). Optional series metadata lets the
-- engine produce and track multi-snippet playbooks.

alter table ce_sessions
  add column if not exists format  text not null default 'article'
    check (format in ('article','howto','best_practice')),
  add column if not exists series  jsonb;