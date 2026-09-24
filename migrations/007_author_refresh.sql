-- Content Engine - 007_author_refresh.sql
-- 1) Author persona per profile (AI search engines cite individual experts,
--    not brands). Editable in Studio, stamped on articles + all channel variants.
-- 2) Refresh lineage: a refresh run reuses an original session's inputs and
--    points back to it, so freshness stays tracked.

alter table ce_profiles
  add column if not exists author jsonb;

alter table ce_sessions
  add column if not exists refresh_of uuid references ce_sessions(id) on delete set null;

create index if not exists idx_ce_sessions_refresh_of on ce_sessions(refresh_of);