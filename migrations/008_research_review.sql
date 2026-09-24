-- Content Engine - 008_research_review.sql
-- Human-in-the-loop research review: after research completes the workflow can
-- pause and wait for human approval before writing. Adds:
--   * status value 'awaiting_review' (workflow paused for human)
--   * review_research flag (per-run, whether to pause for review)
--   * research_note (a human steer applied to the next research round)

alter table ce_sessions
  drop constraint if exists ce_sessions_status_check;
alter table ce_sessions
  add constraint ce_sessions_status_check
  check (status in ('starting','in_progress','awaiting_review','complete','error','pivot','killed'));

alter table ce_sessions
  add column if not exists review_research boolean not null default false,
  add column if not exists research_note text;