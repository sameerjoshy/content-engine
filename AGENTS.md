# Content Engine — Memory & Environment Handoff

Written 2026-08-27 so a fresh chat in this folder starts with full context.

## Voice System v1.2 — implemented (2026-09-15)

**Docs (authoritative):** `docs/VOICE_SYSTEM.md` (v1.2 spec) · `docs/context.md`
(reasoning for external review) · `docs/EXTERNAL_REVIEW_v1.1.md` (my critique —
folded into v1.2) · `docs/EXPERIENCE_LAYER.md` (the Proprietary POV store).

**New code:**
- `apps/api/src/lib/voice.ts` — code-side derivation of the spec: `BASE_VOICE_V2`,
  `BAN_RULES` (machine/slop-edge/brand-violation regexes), `banListViolations`,
  `countEdgeTells`, `interactionDeviceCheck`, `registerEnvelope(channel)`,
  `EDGE_MOMENT_LIMIT`, `POV_QUESTION`. **Keep in sync when the doc changes.**
- `apps/api/src/lib/gate.ts` — `compositeGate()`: deterministic-dominated score
  (grounding·proof·ban-clean·device·freshness·original-moves = 65%, subjective =
  35% tiebreaker; pass = composite ≥0.75 AND deterministic ≥0.45).
- `apps/api/src/agents/pov.ts` — **Proprietary POV stage**: `buildProprietaryPov`
  (asks the one Experience-Layer question; honest analytical POV when empty),
  `matchExperienceEntries` (tag-overlap matching), `povToMarkdown`.
- `apps/api/src/agents/sowhat.ts` — **so-what gate**: `soWhatGate` (PASS/STEER/KILL
  vs live search+community signal). Runs via **self-bound `/internal/sowhat`**
  (fresh 50-subrequest budget — the search chain is keyless-heavy; do NOT inline it).
- `apps/api/src/routes/internal.ts` + `index.ts` — self-bound internal endpoints
  `POST /internal/research`, `/internal/research-followup`, `/internal/sowhat`,
  `/internal/pov`, `/internal/editor` (all WORKER_SELF + AUTH_HOOK_SECRET guarded).
- **⚠️ Free-plan subrequest budget — HARD LESSON (verified in prod 2026-09-15):**
  the ~50-subrequest limit is **cumulative per Workflow INSTANCE** (step.sleep
  gaps do NOT reset it). Adding the POV stage inline (~9 subreqs) + the editor
  inline (chatJson retries + fact-check rewrite + strengthen + writes, ~15+)
  pushed a real run over the limit → instance **Errored** with "Too many
  subrequests by single Worker invocation", leaving the session stuck
  `in_progress` (the infra error bypasses run()'s try/catch). FIX: POV + Editor
  are now self-bound like research (`/internal/pov`, `/internal/editor`) — the
  instance pays ~3 subrequests each, the callee gets a fresh budget. Keep ALL
  LLM-heavy/DB-heavy stages self-bound. Also added a **stall-reconciler** in
  GET /api/workflow-status: an in_progress session with no events for 15+ min
  is auto-marked `error` so the UI never spins forever.
- `migrations/009_experience_layer.sql` — `ce_experience` table (insight/scar/
  pattern/counter/applicable_tags[]/changed_mind_*/occurrences/publishable, RLS
  user-scoped) + `ce_sessions.skip_sowhat`. **⚠️ NOT yet applied to production.**
- `scripts/experience-elicitation.mjs` — operator-facing CLI to surface scar tissue
  → writes `ce_experience` via service-role key. `--prompts` / interactive /
  `--list` / `--export` / `--import`.

**Pipeline change (workflow.ts):** validator → researcher → (review gate) →
spec_builder → **so-what gate** (kills cold demand; STEER appends to the writer's
angle; skip via `skip_sowhat`) → **proprietary POV** (stores draft stage `pov`) →
writer (injects POV block) → editor (v1.2 judge fields: original_moves,
edge_authenticity_score, earned_uncertainty_score, human_voice_score,
changed_mind_strength, disputable_claim, decorative_devices; stores `composite` +
`voice_scores` in draft meta) → complete. Editor SYSTEM now carries the v1.2 voice
dimensions + original-move requirement. Distribute adds **X thread** variant +
register envelopes (LinkedIn 45:55, X 40:60, Substack 55:45). Web: new stages in
StageTimeline/Workflow/Draft, QualityGate panel on Draft (composite breakdown +
the 2 publish-gate questions), `skip_sowhat` checkbox on New Article, X tab in
Distribute modal.

**To go live:** apply migration 009, deploy API + web. Then run one piece to
verify the POV + so-what stages against real data. Seed the Experience Layer with
`node scripts/experience-elicitation.mjs --email <you>@gtm-360.com`.

## Repo consolidation + infra finish (2026-09-14)

- **All GTM-360 repos live under `D:\GTM-Engine\`** (single root): `content-engine`
  (this repo), `compass` (was `D:\OKR-planner`), `cockpit` (was `D:\GTM-Brain`),
  `crew` (was `C:\Users\DELL\GTM-360-agents`), `method` (was `D:\GTM-Operating-Model`),
  `website` (was `C:\Users\DELL\gtm-360-website`). Old absolute paths updated here +
  in `scripts/smoke.mjs` (playwright now at `D:/GTM-Engine/compass/node_modules/playwright`).
  Run npm from `D:\GTM-Engine\content-engine` after any move that breaks workspace links
  (`npm install`).
- **Deleted (retired):** `C:\GTM360`, `C:\Users\DELL\_gtm360-archive`,
  `C:\Users\DELL\gtm360`, `D:\GTM-OS`, and the Supabase project `gtm360-hq`
  (`dtqsnojfatzjsklsjzwj`). ⚠️ **Stale leftovers to delete manually after the session**
  (opencode held these, so moves had to copy): `D:\content-engine` and
  `D:\GTM-360` (contains only a stale `content-engine` copy). Same for any orphaned
  `node` preview/dev processes on ports 4173/5173.
- **Supabase auth config DONE via API** (token `sbp_fce2…`): Site URL →
  `https://gtm-360.com`; redirect allow-list now wildcards across
  `gtm-360.com/okr/brain/agents/gtm/content` + `content-engine-9eq.pages.dev` + localhost.
- **Cloudflare DONE:** `api.gtm-360.com` CNAME → `content-engine-api.sameerjoshy.workers.dev`
  + worker route `api.gtm-360.com/*` (verified `https://api.gtm-360.com/health` = 200).
  Orphaned `workbench.gtm-360.com` DNS record deleted.
- **✅ DONE:** 307-redirect `hq`, `app`, `outbound`, `signal360.gtm-360.com` →
  `brain.gtm-360.com` via a **zone-level Redirect Rule** (`http_request_dynamic_redirect`,
  path + query preserved) — token `cfut_s4SG…` with `Zone > Single Redirect > Edit`.
  (Account-level Bulk Redirects were unreliable on Pages custom domains — created then
  deleted.)

## Showcase homepage (2026-09-14, live at `/`)

Logged-out `/` now renders the flashy **Showcase** (`apps/web/src/screens/Showcase.tsx`):
shader-gradient hero, GSAP ScrollTrigger reveals, Lenis smooth scroll, products, the 6
outcome groups + 25 agents (live from `@gtm360/agent-registry`), "built with" open-source
grid, outcomes, FAQ (AEO). Lazy-loaded as its own chunk (the old `Landing.tsx` was
deleted). **Dep pins (hard-won):** `shadergradient` + `three@0.160.0` (NOT 0.186 — newer
three crashes at module eval) + `@react-three/fiber@8` (NOT v9 — same crash). Hero has a
WebGL pre-check + CSS-gradient fallback so it never blanks on GL-less browsers. Full QA
green (showcase 22/22 local, prod 21/22 with only the expected fake-token `/create`
error-state artifact). **Tone + copy (2026-09-14):** hero shader muted (darker
colors, `brightness 0.45`, `uStrength 0.1`, + a dark `showcase-hero-veil` overlay; CTA
band now deep teal→ink; accents `#6ee7b7`→`#34d399`). Copy humanized across showcase /
lobby / engine / spaces / registry: killed "canonical", "outcome-driven",
"Enter the engine" (→ "Get started"), "The product family", "pressure-testing",
"Served by…" → "Runs on…". Write human-to-human from now on.

## Who this is for
Any agent session starting in `D:\GTM-Engine\content-engine`. Read this first, then read
`SUPER_PROMPT.md` (system spec) before writing code.

## Machine environment (Windows, win32, PowerShell)

**API keys / env vars — ALREADY persisted as User-scoped env vars.** Any new
terminal or agent session on this machine reads them automatically. Never
hardcode them.

| Var | Purpose | Persisted |
|-----|---------|-----------|
| `CLOUDFLARE_API_TOKEN` | Workers/Pages deploys (wrangler) | ✅ User |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account | ✅ User |
| `SUPABASE_ACCESS_TOKEN` | Supabase management API (migrations/queries) | ✅ User |
| `SUPABASE_URL` | `https://agrnbsaaxdbvlcdqtnwo.supabase.co` | ✅ User |
| `SUPABASE_SERVICE_ROLE_KEY` | server-side (bypass RLS) | ✅ User |
| `DEEPSEEK_API_KEY` | LLM calls | ✅ User |
| `DATABASE_URL` | Direct PG connection | ✅ User |
| `SUPABASE_PROJECT_REF` | `agrnbsaaxdbvlcdqtnwo` | ✅ User (set 2026-08-27) |
| `GTM360_SSO_SECRET` | cross-product SSO (only for GTM-360 apps) | ✅ User (set 2026-08-27) |

⚠️ **`GTM360_SSO_SECRET` caveat**: a new 48-char value was generated and
persisted locally, but the deployed `okr-api` Worker already has its own secret
(Cloudflare secrets are write-only — cannot be read back). The local value does
**not** match production. For cross-product SSO work, set the deployed value;
for this Content Engine project it is not needed at all.

Use `$env:VAR` in PowerShell, `process.env.VAR` in Node.

## Proven tooling patterns (from prior work)

- **Wrangler / Cloudflare Workers + Pages**: `npx wrangler deploy` (API),
  `npx wrangler pages deploy dist --project-name X --branch main` (static).
- **Supabase migrations**: SQL files applied via Management API
  (`POST /v1/projects/{ref}/database/query`). Escape function bodies in single
  quotes (the API cannot parse `$$`). A working apply script exists in
  `D:\GTM-Engine\method\scripts\deck\` lineage — reuse that approach.
- **DeepSeek API**: `DEEPSEEK_API_KEY` env var; JSON-only responses enforced via
  system prompt + strip markdown fences (`replace(/```json|```/g,'')`).
- **PPTX generation**: `pptxgenjs` (Node, pure JS, Windows-safe). Fonts must be
  installed on the machine — PowerPoint does not embed by default.
- **Fonts now installed on this machine**: **Lexend** (headings) and
  **Source Sans 3** (body) — the enterprise/consulting pair, registered in
  user fonts. Use them for any polished output (docs, decks, UI export).
  Also available: Calibri, Arial, Georgia, Consolas.
- **Visual QA without eyes**: render PPTX/PDF → PNG via PowerPoint COM
  (`New-Object -ComObject PowerPoint.Application; $pres.Export(dir,"PNG",w,h)`)
  then measure ink-density bands with Python PIL to detect empty/overflowing
  regions. This repo has no images in code — verify structurally.
- **Playwright**: installed in `D:\GTM-Engine\compass\apps\web` — e2e against live
  sites, and headless Chromium for scraping/QA.

## The Content Engine project itself

- **Spec**: `SUPER_PROMPT.md` — architecture, agents, API, DB schema, roadmap.
- **Checklist**: `DEVELOPER_CHECKLIST.md` — Phase 1 MVP boxes.
- **Profiles**: `PROFILES.yaml` (Thought Leader / Educator / Contrarian /
  Researcher voices + ICP + research rules).
- **Existing content map**: `existing-content.json` — feeds Angle Validator.
- **Tone reference**: `EXAMPLE_ARTICLES.md`.
- **Design**: `DESIGN_SYSTEM_TOKENS.json` — import directly into frontend.

**MVP shape (from README/checklist):** Frontend (React+TS) → API → Orchestrator
→ 5 agents (Angle Validator, Researcher, Spec Builder, Writer, Editor) → DB
(profiles, sessions, drafts, logs). 5 screens. Deploy: Vercel + Railway/Heroku,
or reuse the Cloudflare stack above.

**LLM cost note**: each article ≈ $0.50–1.00; log every LLM call (tokens) from
day one.

## Prior context that may be relevant

- The user's broader system is **GTM-360** (The Revenue Operating System):
  Compass (OKRs), Cockpit (execution), Crew (agents), Operating Model
  (`D:\GTM-Engine\method` — 10 layers / 128 processes data). The Content
  Engine likely feeds or complements that ecosystem — ask before assuming.
- If asked to build a book/deck from GTM data, there's a working deck generator
  at `D:\GTM-Engine\method\scripts\deck\` (tokens/layouts/chevron/tree +
  `build-deck.mjs`, `npm run deck:verify`).

## Working rules
- Keep responses concise. Verify builds (`npm run build`/typecheck) after
  changes. Never commit secrets. Ask before deploying.

## Current build state (2026-08-29) — DEPLOYED to production

**This folder is now a working monorepo, not just specs.** Read `docs/V2_ARCHITECTURE.md`
for the implemented architecture (supersedes SUPER_PROMPT.md where they conflict).

**Stack (all free tier):** Cloudflare Workers + **Workflows** (durable orchestrator) ·
Supabase Postgres + Auth + Storage · DeepSeek (all 5 agents) · React+Vite web · Resend SMTP.

**Layout:**
- `apps/api` — Cloudflare Worker. `wrangler dev` (port 8787) locally; `.dev.vars` holds
  secrets (copy `.dev.vars.example`). Typecheck: `npx tsc --noEmit` in `apps/api`.
- `apps/web` — React+Vite. `npm run dev` (port 5173, proxies `/api` → 8787). Build:
  `npm run build -w apps/web`.
- `migrations/` — SQL. Apply via `node scripts/apply-migration.mjs <file>` (Management API).
  **Tables are prefixed `ce_`** — this Supabase project is SHARED with GTM/OKR (existing
  `profiles`, `users`, `okrs` tables). Never create unprefixed tables.
- `scripts/sql.mjs` — ad-hoc SQL runner; `scripts/smoke.mjs` — Playwright UI smoke test
  (uses `D:\GTM-Engine\compass\node_modules\playwright`; needs vite + wrangler dev running).

**Deployed URLs:** API `https://content-engine-api.sameerjoshy.workers.dev` · web
`https://content-engine-9eq.pages.dev` (alias `content.gtm-360.com`). Re-deploy: `npm run
deploy:api` (needs `CLOUDFLARE_API_TOKEN` — currently the `cfut_yfbI56…` token in User env,
has Workers+Pages write but NOT DNS; the `cfut_Spqezau…` token has DNS read but no write).
Web: `npm run build -w apps/web` then `npx wrangler pages deploy dist --project-name
content-engine --branch main`. `apps/web/public/_redirects` gives SPA fallback.
`apps/web/.env.production` bakes `VITE_API_URL` + Supabase keys at build time.

**Key endpoints:** POST /api/run-article · GET /api/workflow-status/:id (polls events) ·
GET /api/draft/:id/:stage · POST /api/publish/:id (Supabase Storage `exports` bucket) ·
POST /api/revise/:id (re-edit with an instruction) · /api/profiles CRUD +
POST /api/profiles/:id/analyze (Input Studio) · /api/content-map CRUD. JWT verified via
Supabase `/auth/v1/user` (no JWT secret needed). `POST /auth-hook/after-user-created`
(public webhook, guarded by `AUTH_HOOK_SECRET`) → HubSpot sync. `POST /internal/research`
(workflow-only, guarded by `AUTH_HOOK_SECRET`) → research pipeline.

**Researcher is grounded, not pure-LLM:** search Tavily → OpenAlex → Semantic Scholar →
Wikipedia (keyless fallback), scrape via Jina Reader, evidence table in `ce_evidence`,
Editor fact-checks draft claims against evidence. **TAVILY_API_KEY is SET** in production.

**⚠️ Two hard-won production lessons:**
1. **Workers Free subrequest limit is ~50 per Workflow INSTANCE** (cumulative across all
   steps, not per step — `step.sleep()` gaps do NOT reset it). The research pipeline alone
   needs ~40, so the whole article flow (~70+) blows it. Fix: research runs inside
   `src/routes/internal.ts` called via the `WORKER_SELF` self service binding — the workflow
   pays 1 subrequest and the callee gets a fresh 50-budget. **URL MUST be
   `https://WORKER_SELF/internal/research`** (binding name as host; `https://internal/...`
   fails with "Not found"). Editor batches evidence-usage updates (2 calls, not N).
2. **LLM fetches now have `AbortSignal.timeout`** (120s default) in `src/lib/llm.ts` —
   previously a hung DeepSeek/Anthropic call blocked the workflow step until Workflow timeout
   then retried the same hang. Do not remove the signal.

**Email (confirmed working):** Resend SMTP `smtp.resend.com:465` / user `resend` / key =
Resend API key, sender `Content <sameer@gtm-360.com>`. DNS on gtm-360.com (Cloudflare zone):
`send` MX → `feedback-smtp.ap-northeast-1.amazonses.com`, `send` TXT SPF
`v=spf1 include:amazonses.com ~all`, `resend._domainkey` TXT. Supabase redirect allow-list
includes `content-engine-9eq.pages.dev` + `content.gtm-360.com`. Signup form
(`apps/web/src/screens/Login.tsx`) collects first name, last name, company → stored in
`user_metadata` + passed as `emailRedirectTo`.

**Verified in production (2026-08-29):** full article run end-to-end in ~100s (quality 7/10,
8 LLM calls, $0.017/article), publish to public Storage URL, LLM cost logged per call to
`ce_stage_events` (tokens_in/out, cost_usd, latency_ms), Resend confirmation email delivered.

**Quality / proof-mix layer (2026-08-29):** profiles can require a proof mix in
`research_rules.required_proof` = `{named_examples, expert_quotes, statistics}` (editable in
Studio → Research tab). Flow: Researcher tags evidence `proof_type` (case_study /
expert_quote / statistic / other) + runs a targeted follow-up round if the mix is short;
Spec + Writer mandate the mix; Editor runs a two-pass flow (`editArticle` judge →
`factCheckRewrite` rewriter for unsupported claims → `proofCoverageCheck` deterministic gate),
storing `proof_check` in the draft meta. Verified in prod: required 2 companies/1 quote/1 stat
→ draft contained Slack, Dropbox, Notion, Calendly + OpenView quote + 4 stats, proof_check
missing: []. Migration `005_evidence_proof_type.sql` added `ce_evidence.proof_type`.
Cost impact ~+1 LLM call (~$0.003/article).

**How-to mode (2026-08-31):** `POST /api/run-article` accepts `format: 'article' | 'howto'`
+ optional `series {name, part, total}` (migration 006 added `ce_sessions.format` + `series`).
How-to = teach ONE move deeply (THE MOVE → WHY → METHOD → GOTCHA → PROOF → THE FRONTIER →
TAKEAWAY), series-aware, `proof_type` adds `frontier` (best practices / cutting-edge /
predictions). Frontier POV is MANDATORY in how-tos — brand opinion synthesized from sourced
evidence, never invented. UI: NewArticle has format + series fields; Workflow shows format.
⚠️ Free-plan subrequest budget: the proof-follow-up round runs in a SEPARATE
`/internal/research-followup` self-binding call (fresh 50-budget), NOT inline — inline would
exhaust the main research invocation's budget.

**Fact-check classification (2026-08-31):** the editor now distinguishes `kind: 'fact'`
(fabricated verifiable claims — REWRITTEN/removed by factCheckRewrite) from `kind: 'analysis'`
(brand POV/synthesis — KEPT, no source needed). This preserves the forward-looking frontier
voice while killing hallucinations. A third pass `strengthenProofSection` runs when the proof
gate finds gaps (bounded to 1 iteration) — it rebuilds weak areas (e.g. thin frontier) from
evidence. `/api/revise/:id` (Revise button) uses the same classification. Verified in prod:
3 fabricated facts removed, frontier section present+grounded, quality 8/10, and honest
reporting when named examples can't be found for niche topics.

**AI-citation optimization (2026-08-31):** writer/spec require "THE QUESTION IT ANSWERS"
framing (lead with the answer), scannable structured headings/lists, density of named
entities + numbers (these get quoted), and an AUTHOR BYLINE. Insights from Meltwater's
9.5M-citation study (de-slanted): structured + question-answering + named-data content wins
AI search citations; individual experts are cited 3× more than brand pages.

**Distribution (2026-08-31):** `POST /api/distribute/:id` generates LinkedIn / YouTube /
Substack variants from the SAME fact-checked draft + evidence (no variant can fabricate).
`apps/api/src/agents/distribute.ts`. UI: Distribute button + modal on Draft screen.
Verified: LinkedIn post (hook→insight→proof→question), full YouTube script with screen cues,
Substack edition — all author-stamped.

**Author persona + refresh (2026-08-31):** `ce_profiles.author` jsonb (name/title/company/
bio/linkedin_url) — editable in Studio → Author tab; stamped as byline on articles + all
channel variants (AI cites individuals, not brands). `POST /api/refresh/:id` re-runs a
completed piece with fresh research; new session tracks `ce_sessions.refresh_of` lineage
(migration 007). UI: Refresh button on Draft. Verified: author stamp on all 3 variants,
refresh produced a new researched run linked to the original.

**Content Radar (2026-08-31):** `POST /api/radar` (profile_id + optional focus) runs a
signal scan: LLM generates 8 queries (buyer questions, trending, contra-consensus, frontier,
named-example), searches via Tavily/keyless, then synthesizes 5-7 ranked opportunities —
each with archetype (quiet_shift / signal_vs_noise / third_way / long_game /
decision_framework / howto / best_practice / frontier), a topic+angle+question, scores
(demand/whitespace/insight_density/durability/frontier) + overall, why_now, real source URLs.
Whitespace is measured against the user's `ce_content_map`. UI: `/radar` screen with
profile/focus inputs, ranked cards, score bars, "Generate this piece" → runs the normal
pipeline. `apps/api/src/agents/radar.ts`. Verified: 7 grounded opportunities for the
territory-planning niche; radar→generate→complete article loop works.

**Best-practice scan format (2026-08-31):** `format: 'best_practice'` — the "who's doing
what" competitive map. Structure: THE QUESTION → THE LANDSCAPE (named players, each with its
specific approach + source) → THE COMMODITIZED (the copy-paste consensus) → THE
DIFFERENTIATION → THE WHITESPACE → THE STATS & QUOTES → THE MOVE. Researcher runs named-
company-heavy queries, extracts case_study-heavy evidence, dossier is landscape-structured.
Spec/Writer/Editor have dedicated `best_practice` prompts; editor REQUIRES ≥2 named companies
cited and fact-checks that every named player is real. Migration 006's format CHECK updated to
`('article','howto','best_practice')`. Radar `best_practice` archetype maps to this format.
Verified in prod: Figma/Notion/Calendly landscape with real revenue + NDR numbers, 0
unsupported claims.

**Publish → content map (2026-08-31):** `POST /api/publish/:id` now inserts the published
piece into `ce_content_map` (title/angle/date/profile/url), so Radar whitespace scoring stops
re-suggesting what you've already said.

**Newsletter email (2026-08-31):** `POST /api/email/:id` (body `{to: [emails]}`) generates
the Substack variant via `generateDistribution` and sends it through Resend
(`lib/email.ts`: `sendEmail` + `markdownToEmailHtml`), subject taken from the edition's H1.
Requires `RESEND_API_KEY` worker secret (set). UI: Distribute modal → Substack tab has a
"Send email" recipient field.

**Human-voice layer (2026-08-31):** shared `HUMAN_VOICE` block injected into all three writer
system prompts (article/howto/best_practice): specific concrete language, varied sentence
rhythm, explicit stakes, a point of view, the gotcha/trade-off, no machine tells ("in today's
fast-paced world", delve/unlock/seamless/leverage, robotic parallelism). Voice comes from the
evidence's concrete details — NEVER fabricated anecdotes/stats (anti-hallucination still
enforced). Editor SYSTEM adds a HUMAN VOICE review dimension. Verified: territory how-to
reads like a person with scar tissue (POV + stakes + worked example) while staying 100% sourced.

**Research review gate (2026-08-31):** `run-article` accepts `review_research: true` → after
research the workflow pauses (status `awaiting_review`, stage `research_review`) via
`step.waitForEvent('research_approval', {type:'research_approval', timeout:'7 days'})`.
Human sees the research brief (GET /api/research-brief/:id: dossier + evidence with
confidence/recency/proof_type + gap_report) on `/research/:id`, then either approves
(`POST /api/research-approve/:id`) or steers (`POST /api/research-steer/:id` — saves
`research_note`, re-runs the self-binding research pipeline with the directive appended to
the angle, then releases the event). Event sent via `await env.ARTICLE_WORKFLOW.get(id)` then
`instance.sendEvent({type,payload})` — `.get()` returns a Promise, must be awaited. On timeout
the gate auto-proceeds (quality gate, not blocker). Migration 008 added status value
`awaiting_review` + `research_note` + `review_research`. ⚠️ An instance paused on an OLD
deployed version can fail to resume after redeploy — approve fresh instances with the current
code. Verified: run→pause→brief→approve→write→complete (7/10); steer→re-research→complete.

**Module status + system overview (2026-08-31):** Workflow screen shows a live module-status
panel (each agent: ✓ done / spinner active / ○ queued) + a highlighted "Research review"
row with a Review button when awaiting. Home page (`/`) renders `SystemOverview.tsx` — a
CSS-only graphical readme (no image assets per repo convention): inputs → 5-agent chain →
distribute/freshness, plus connector/data-layer grid (DeepSeek, Cloudflare Workflows,
Supabase, Tavily·Jina, Resend, HubSpot).

**QA fixes (2026-09-01):** (1) `ArticleWorkflow.run()` now wraps the pipeline in try/catch —
if a step throws past its retries the session is marked `error` with the message so the UI
stops polling forever (previously a hard-failed instance left `ce_sessions.status =
in_progress` forever). (2) `GET /api/research-brief/:id` gap_report was read from the
`editor` draft meta (not yet written during review) — now computed at research time in the
internal pipeline and stored in the `researcher` draft meta. ⚠️ Operationally: a Workflow
instance paused on an older deployed version can fail to resume after redeploy — terminate
it and approve a fresh run. `wrangler workflows instances terminate article-workflow <id>`.
(3) StageTimeline now includes the `research_review` stage (shown pending when the run
doesn't pause for review). (4) All Content Engine test data cleaned: test users, sessions,
drafts, evidence, events, content map, HubSpot test contacts, and exported storage files
removed — DB is pristine. ⚠️ The shared Supabase project contains `pw*.@okr.dev` and other
users from the GTM/OKR projects — never delete those.

**Enterprise QA pass (2026-09-14, autonomous):** full product QA against best-in-class
tooling (Linear/Asana/HubSpot/Salesforce patterns). **Fixed a critical bug**: web
`auth.tsx` had `persistSession:false, autoRefreshToken:false` (mistakenly copied from
the service-role client) — users were logged out on every refresh and tokens broke
after 1h. Now `true` + PKCE. **API CORS**: 401 Unauthorized responses lacked CORS
headers (browser saw a CORS error instead of a clean 401) — fixed via `withCors()`
helper, deployed. **SEO/AEO**: index.html now has SEO title/meta/canonical/favicon
(inline SVG data-URI)/OG/Twitter + 3 JSON-LD blocks (SoftwareApplication, WebSite,
FAQPage); landing has a 5-item FAQ (`<details>`) matching the FAQPage schema.
**IA/UX**: Lobby (single entrance) → 6 outcome spaces with breadcrumbs, tools-first;
removed redundant SystemOverview from `/create` + "Lobby" nav item (brand is home);
added empty state on `/create`; **Cmd/Ctrl+K command palette** (jump to any
space/tool); `usePageTitle` hook on every screen. All links audited (none broken).
Verification: SSR render tests (Engine 6/25, Space), 16-check Playwright suite, and a
prod Playwright pass (SEO meta, JSON-LD, FAQ, lobby persist, engine 6 groups/25
agents, space/create render, no console errors) — all green. **Known test gap**: the
smoke script needs a seeded test user (test users were cleaned from the shared DB);
can't be run headlessly without one.

**Open-source tool evaluations (2026-09-14):** `codebase-memory-mcp` **installed** for
opencode (v0.10.8, checksum-verified, stdio MCP wired into `~/.config/opencode/opencode.jsonc`;
restart opencode to load). `agency-agents` distilled → `docs/AGENT_PROMPT_REFERENCES.md`.
`Recordly` (AGPL-3.0) downloaded to `C:\Users\DELL\Downloads\Recordly-windows-x64.exe`
(demo-video tool for CREATE; not embedded). `public-apis` mined → `docs/FREE_DATA_SOURCES.md`.
`last30days-skill` (MIT, 62k★, security-hardened) = strong local research/radar channel
(engagement-scored Reddit/X/YT/HN/Polymarket → JSON) — **not installed yet**; wire it
alongside Agent-Reach in the research-companion layer. (Twenty CRM was cloned then
dropped 2026-09-14 — user declined; open-source self-hosted only was not pursued.)

**Value-adds built from the repo scan (2026-09-14, deployed):**
1. **AEO discovery layer** (`apps/web/public/robots.txt` + `llms.txt`): AI-aware robots
   policy (allow GPTBot/ClaudeBot/PerplexityBot/Bingbot/Amazonbot, block AhrefsBot/
   SemrushBot/DataForSeoBot/MJ12bot) + an llms.txt agent manifest. Live on
   content.gtm-360.com.
2. **Researcher source** (`apps/api/src/lib/search.ts`): keyless **Hacker News**
   (Algolia API) added to the fallback chain → `hacker_news` in `SearchResult`.
3. **SELL gates** (registry): `paper-process` input + `Procurement gate` on
   `qualifier` + `deal-room` (from agency-agents deal-strategist).
4. **Registry `vibe`** field on all 25 agents (one-line personalities) + shown on
   `/engine` + space cards.
5. **Human-voice upgrade (humanizer)**: `blader/humanizer` (MIT, 47k★) AI-tell patterns
   folded into `HUMAN_VOICE` (writer.ts) + Editor review dimension (editor.ts) — the
   "It's not X it's Y" contrast, staged openers, aphorism-dressing, triads, one-line
   closers, dash density. Deployed.
6. **Design/marketing scan (16 repos)**: motion libs (GSAP/Lenis/R3F/liquid-*/shadergradient)
   **skipped** (enterprise+SEO conflict); `impeccable` (61 AI-slop design rules),
   `awesome-design-md`, `anthropics frontend-design` skill, `coreyhaines31/marketingskills`,
   `alirezarezvani/claude-skills`, `n8n-mcp`, `open-seo` → **ADAPT/REFERENCE** —
   documented in `docs/AGENT_PROMPT_REFERENCES.md` addendum.
7. **B2B-sales/marketing discovery scan**: `subscope` (keyless Reddit buyer-intent →
   SELL·Listener ADAPT), `crawlie` (SEO/AEO crawler → AEO QA ADAPT), `OpenClaudia` skills
   (commercially-clean prompt mine), discovery hubs `awesome-claude-skills` +
   `awesome-agent-skills`; fluff/ToS-risk repos flagged SKIP — addendum 2 in the same doc.
8. **More research + SEO (deployed 2026-09-14)**: keyless **Reddit RSS** added to the
   Researcher fallback chain (`reddit` in `SearchResult`); `research-companion.mjs` now
   gathers **HN + Reddit signal channels** (engagement-scored, keyless) into the brief;
   `public/sitemap.xml` added + robots.txt `Sitemap:` line fixed. Full QA re-run: registry,
   SSR render, browser suite (landing/lobby/engine/spaces/palette/persist/titles) + prod
   8/8 — all green; the only browser "console error" in authed tests is the expected clean
   401 from the fake-token probe (proves the CORS fix).

**Open items for the user (from 2026-09-13/14):**
1. Seed a test user (e.g. `test-ce@example.com`) so `scripts/smoke.mjs` runs headlessly.
2. Supabase dashboard ("Open signal"): Site URL → `https://gtm-360.com` + wildcard
   allow-list (`https://content.gtm-360.com/*`, etc.) — token is read-only.
3. Cloudflare zone: 307-redirect `hq/app/outbound/signal360.gtm-360.com` →
   `brain.gtm-360.com`; delete orphaned `workbench.gtm-360.com` DNS record.
4. DNS: `api.gtm-360.com` CNAME (then I wire the worker route + gateway).
5. Google Cloud Console: publish OAuth app to "In production" + resubmit brand
   verification (homepage + `/privacy` now live).
6. Optional: Agent-Reach X/Reddit/LinkedIn cookie channels (burner accounts).
7. Install Recordly (downloaded installer) when ready to make demo videos.
8. Optional: install `last30days-skill` as a research/radar channel.
**Domain & config cleanup runbook (2026-09-13):** `docs/DOMAIN_CLEANUP.md` is the
enterprise cleanup plan: (1) fix shared-Supabase Site URL (`outbound.gtm-360.com` →
`https://gtm-360.com`) + add allow-list wildcards — ⚠️ token is read-only, needs
dashboard; (2) 307-redirect Cockpit aliases `hq/app/outbound/signal360.gtm-360.com`
→ `brain.gtm-360.com` (canonical); (3) delete dead `gtm-360-workbench`; (4) create
`api.gtm-360.com` worker route (DNS write needed) for the Phase-3 gateway; (5) hide
`.workers.dev`/`.pages.dev`; (6) consolidate keep-alives (deploy the Content Engine
API cron, retire `gtm-keepalive`/`gtm360-keepalive`). Ordering rationale + rollback
per step in the doc. Engine UI now shows each agent's **Takes / Delivers** line
(inputs→outputs) on the `/engine` cards.

**Research companion + Agent-Reach (2026-09-13):** **Panniantong/Agent-Reach**
(32k★, MIT, local Python CLI) installed on this machine (`agent-reach v1.5.0`,
pip-installed from the GitHub archive — NOT the PyPI package). Zero-config
channels active: YouTube subtitles (yt-dlp, `--js-runtimes node` set in
`~/.config/yt-dlp/config`), GitHub (`gh`), web (Jina Reader), RSS, V2EX,
Bilibili. Cookie channels (X/Reddit/LinkedIn/Facebook/Instagram/小红书) NOT
configured — need burner-account cookies via Cookie-Editor. Exa semantic search
needs `npm i -g mcporter` + MCP (deferred). New **`scripts/research-companion.mjs`**
wraps the channels into an evidence brief (expert quotes / named examples /
trends / gaps, traceable URLs, DeepSeek extraction with honesty gate): run
`node scripts/research-companion.mjs --topic "..." --angle "..." --videos N
--repos N --urls "u1,u2" --llm --out brief.md`. Fit: CREATE·Researcher
(expert-quote proof), ORIENT·Content Radar (trend/whitespace), SELL·Listener
(signal monitoring). Constraint: it's a **local CLI** — cannot run inside the
Cloudflare Worker; for serverless use, wrap it as an HTTP sidecar in the
Phase-3 gateway. Registry validation: `node scripts/validate-registry.mts`.

**Agent Engine — outcome-driven architecture (2026-09-13):** The whole GTM-360
ecosystem (Compass · Cockpit · Crew · Method · Content Engine) was audited — 40+
agents scattered across 5 products with heavy overlap. The unification contract is
`docs/AGENT_ENGINE.md`. New canonical package **`packages/agent-registry`
(`@gtm360/agent-registry`)** is the single source of truth: 6 outcome groups (ORIENT
· PLAN · CREATE · SELL · SUSTAIN · GOVERN, each with a fixed color + outcome), 25
canonical agents, product twins folded in via `legacyIds` (e.g. A1–A10, Content
Multiplier, Compass dock → absorbed). Web: new **`/engine`** screen renders the
groups + agents + executive lenses; SystemOverview + Landing now show the outcome
loop. Enterprise look: engine CSS classes in `styles.css`, `Card` accepts `style`.
Deployed to production 2026-09-13. Next phases (per the doc): runtime migration onto
Workers+DeepSeek behind one gateway (`api.gtm-360.com/agent/*`), shell unification,
domain cleanup.

**Supabase pause incident (2026-09-13):** the shared Supabase project
`agrnbsaaxdbvlcdqtnwo` auto-paused (free tier, ~7 days idle) → `*.supabase.co`
stopped resolving → Google OAuth failed with "site cannot be reached". Restored via
dashboard. Root cause of the related "login bounced to hq.gtm-360.com": Supabase
redirect allow-list globs are **exact-match**, so `redirectTo` with a trailing slash
fails and gotrue falls back to the project **Site URL** (`outbound.gtm-360.com`),
which 301s to `hq.gtm-360.com` — and browsers preserve the URL fragment across
redirects, so tokens ride along. Fix: `auth.tsx` now sends `redirectTo:
window.location.origin` (no trailing slash) + **PKCE** flow (`flowType: 'pkce'`) so
the address bar carries a short `?code=` instead of a huge `#access_token=` fragment.
⚠️ Management token (`sbp_…`) is read-only (403 on restore/config PATCH) — allow-list
wildcards (`https://content.gtm-360.com/*`) still need a dashboard edit. A keep-alive
cron (daily `ce_sessions` ping, `src/index.ts` scheduled handler + wrangler.jsonc
cron `0 3 * * *`) is written but **NOT deployed** — deploy it to stop recurring
auto-pause.

**Not done yet:** none blocking. HubSpot sync is fully live — see "HubSpot (live)" below.

**HubSpot (live, 2026-08-29):** Contact sync on signup is automatic. Since Supabase's
"After User Created" auth hook is NOT GA in the dashboard (only Before User Created /
Send Email / Send SMS exist), we use a **Postgres trigger** instead:
`migrations/004_hubspot_signup_trigger.sql` creates `public.ce_notify_user_created()`
(security definer, `pg_net.http_post`) on `auth.users` INSERT → POSTs to
`/auth-hook/after-user-created` (guarded by `AUTH_HOOK_SECRET`) → `src/lib/hubspot.ts`
upserts a contact via HubSpot **Service Key** (new 2026 credential type, replaces
private-app tokens; same `Authorization: Bearer <key>` usage). `ce_hubspot_syncs`
tracks per-user sync state. Also a lazy sync in `ensureWorkspace` covers any user who
signs in before/without the trigger. Service Key `pat-na2-****` (value redacted — set
as the `HUBSPOT_API_KEY` worker secret). Verified: new signup → HubSpot contact
created automatically (firstname/lastname/company/email). ⚠️ The Service Key can only
grant scopes the creating HubSpot user holds (`crm.objects.contacts.write/read`).
**Google OAuth login is also live** (Client ID in Supabase auth config; "Continue with
Google" button in Login.tsx). Google signups skip the signup form, so `CompleteProfile.tsx`
shows a company/job-title/industry prompt until filled → `POST /api/me/profile` writes
user_metadata via the service-role admin API and force-syncs HubSpot (`force=true`).
⚠️ HubSpot upsert: POST without `idProperty`; on 409 Conflict, PATCH
`/crm/v3/objects/contacts/{id}` parsed from the "Existing ID:" message (the `idProperty:
'email'` create did NOT update existing contacts — it 409s).