# Content Engine — V2 Architecture & Decisions

**Date:** 2026-08-27 · **Status:** Implementation reference (supersedes decisions in SUPER_PROMPT.md where they conflict)

This doc records the design decisions agreed with the product owner and the target architecture.
`SUPER_PROMPT.md` remains the source for agent *prompting* detail; this doc is the source for
*plumbing*, *schema*, and *stack*.

---

## 1. Product decisions (locked)

| Decision | Choice |
|----------|--------|
| Research grounding | Researcher uses **real tools** (web search + page fetch). No "pure LLM research". |
| Input-building | **Profile/Input Studio is in the MVP** — guided profile editing, example/counter-example rules, quality score, live consistency check, content-map manager. |
| Feedback loop | **No version comparison / A/B** in MVP. Manual feedback only. Change input → rerun → see output. |
| Auth & multi-user | **Supabase Auth from day one**. Every user owns their profiles, content map, sessions, drafts, evidence. |
| Content map | Seeded from `existing-content.json`, editable in-app per user. |
| LLM | **DeepSeek for all 5 agents** (one key, cheap, ~$0.50/article). |
| Search | **Tavily primary → Brave fallback**, plus keyless academic (OpenAlex, Semantic Scholar) and Jina Reader scraping. |
| Backend host | **Cloudflare Workers + Workflows** (long-running orchestrator). |
| Database | **Supabase Postgres** (free tier) via service-role from the Worker, RLS for direct client access. |
| Publish | Markdown export (Phase 1). |

---

## 2. Stack (all free/free-tier)

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | React 18 + Vite + TypeScript | Plain CSS from `DESIGN_SYSTEM_TOKENS.json` + `react-markdown` + `@supabase/supabase-js` (auth only) |
| API | Cloudflare Worker (TypeScript) | Routes, JWT verify, workflow trigger |
| Orchestrator | **Cloudflare Workflow** | Durable multi-step; steps do the work; state persists in Supabase |
| DB | Supabase Postgres + Auth | Service-role used by the Worker; RLS protects direct access |
| LLM | DeepSeek (`deepseek-chat`) | REST call from Worker steps |
| Search | Tavily (free 1000/mo) → Brave (free 2000/mo) → OpenAlex / Semantic Scholar / Wikipedia (keyless) | Abstraction with graceful fallback |
| Scrape | Jina Reader (`r.jina.ai`) | Keyless low-rate; Tavily returns content already when possible |
| Deploy | `wrangler deploy` (API), Vercel (web) | |

### Keys required (free signups)
- `TAVILY_API_KEY` — https://tavily.com (free 1000 credits/mo)
- `BRAVE_API_KEY` — https://brave.com/search/api (free 2000 queries/mo)
- Existing: `DEEPSEEK_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` (Auth → JWT secret)
- Web needs: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (public, safe in client)

> Both search keys are optional: without them the Researcher still works via keyless academic + Jina + Wikipedia, with reduced general-web coverage.

---

## 3. Cloudflare constraints we design around

From Workers/Workflows limits (Free plan):

- **CPU per invocation/step: 10 ms.** All heavy work must be I/O (fetches, LLM calls). No heavy sync parsing/loops in steps. Cheap JSON ops are fine.
- **Wall-clock per step: unlimited.** The 2–4 min research pipeline is fine *if split into steps*.
- **External subrequests: 50 per step.** Each step must stay ≤ ~40 external fetches. Split search/fetch into batches.
- **Step result size: 1 MiB.** Return small acks from steps; persist large content (dossier, drafts) to Supabase *inside* the step.
- **Workflows free:** 3,000 steps/day, 100 concurrent instances — ample for this tool.

---

## 4. Orchestrator: Workflow steps

`ArticleWorkflow` — one instance per `session_id`. Steps (each `step.do` with retries):

1. `validator` — Angle Validator (1 LLM). Kills/Pivots stop the run.
2. `research:queries` — 1 LLM: topic+angle → 6–10 search queries (per profile research rules).
3. `research:search` — for each query, search (Tavily → Brave → OpenAlex → Semantic Scholar). Batched, ≤40 subrequests/step. Logs "query 4/8".
4. `research:fetch` — fetch promising URLs via Jina Reader (batched ≤10/step), extract text.
5. `research:relevance` — 1 LLM: score docs vs angle, keep top N.
6. `research:extract` — 1–2 LLM: pull evidence items `{claim, quote, source_url, title, date}`.
7. `research:synth` — 1 LLM: assemble dossier (JSON). Persist dossier to `drafts`, evidence rows to `evidence`.
8. `spec` — Spec Builder (1 LLM). Persist.
9. `writer` — Writer (1 LLM). Persist.
10. `editor` — Editor (1 LLM) + **fact-check pass**: every claim in draft must map to an `evidence` row; unresolved claims flagged. Persist edits summary + edited draft.

Every step: update `sessions.current_stage/status` and write a `stage_events` row. Frontend polls `GET /workflow-status/:id` (reads DB) every 2 s.

---

## 5. Agent output contracts (structured JSON)

All agents return typed JSON (validated + repaired). The LLM writes JSON; we never parse free-form markdown for logic. Dossier, evidence, spec, and edits are JSON; the final article is markdown content.

---

## 6. Database schema (Supabase)

Tables (all owner-scoped via `user_id`):

- **profiles** — user's profiles. Seeded by copying the 4 templates on signup. Holds `brand_voice`, `icp`, `content_standards`, `research_rules` (JSONB) + `input_quality` (score/flags from Studio).
- **profile_templates** — read-only seed of the 4 templates (from `PROFILES.yaml`).
- **content_map** — user's published articles (`title`, `angle`, `publish_date`, `profile`, `status`, `url`). Seed: `existing-content.json`.
- **sessions** — one per run: `profile_id`, `topic`, `angle`, `depth`, `current_stage`, `status`, `error_message`, `workflow_id`.
- **stage_events** — timeline: stage start/end, step progress, llm_call (tokens/cost), evidence, error. Drives Workflow Monitor + cost tracking.
- **drafts** — per stage content: `session_id, stage, content` (unique).
- **evidence** — claim → source rows from the Researcher; used by Writer (cite) and Editor (fact-check).

RLS: `to authenticated using (user_id = auth.uid())` on all user tables. Worker uses service-role (bypasses RLS).

Full SQL: `migrations/001_init.sql`.

---

## 7. API surface (Worker)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/*` | — | proxied by Supabase client in the web app (not our API) |
| GET | `/health` | — | liveness |
| GET | `/api/me` | JWT | current user + workspace summary |
| POST | `/api/run-article` | JWT | validate inputs → create session → start Workflow → `{session_id}` |
| GET | `/api/workflow-status/:id` | JWT | live progress (reads sessions + last stage_events) |
| GET | `/api/draft/:id/:stage` | JWT | draft markdown + meta |
| POST | `/api/publish/:id` | JWT | export final draft to `.md` (stored in Supabase `published_files` + returns download URL) |
| GET | `/api/profiles` | JWT | user's profiles (Studio uses this + CRUD) |
| POST/PUT/DELETE | `/api/profiles/:id?` | JWT | create/update/delete profile |
| POST | `/api/profiles/:id/analyze` | JWT | Input Studio quality analysis (LLM) → score + flags + suggestions |
| GET/POST/DELETE | `/api/content-map` | JWT | read/add/remove published articles |
| GET | `/api/sessions` | JWT | history list |

Errors: `{ error, details, request_id }`. Statuses: 400/401/404/500.

---

## 8. Publish

`POST /api/publish/:id` writes `article-<slug>-<date>.md` to Supabase Storage bucket `exports` (public read) and returns the URL. Web offers Markdown download / copy-to-clipboard.

---

## 9. What's explicitly out (kept manual)

- Version comparison / A/B between runs
- In-app draft editing
- Multiple publish destinations (WordPress/Medium)
- Human gates between stages