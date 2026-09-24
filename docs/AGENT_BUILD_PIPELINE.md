# Agent Build Pipeline — one agent, end-to-end

> The unit of work is **one agent, complete** — not batch. Templates are ready;
> the build sequence is: capability → landing page → video → review. Only then
> the next agent.

## The pipeline (per agent)

1. **Build the capability** — a real runtime screen + API route in Content
   Engine (the agent actually works, like SEO Analyzer's `/seo`).
2. **Landing page** — the canonical `/agents/<engine>/<agent>` page on
   gtm-360.com (outcome-first description, Takes→Gives, engine context,
   JSON-LD, video slot). Already templated — fills in automatically.
3. **Video** — the story video. **Templated** (one command via
   `build-agent-videos.mjs --agent=<id>`) for the long tail; **bespoke** for
   flagships (unique composition, like SEO Analyzer's).
4. **Wire the runtime** — add the CE screen route + the agent's "Try it" deep
   link on the landing page points to it.
5. **Review** — build + QA + the user watches the video + tries the tool.
6. **Next agent.**

## What's already done (reference implementations)

| Agent | Capability | Landing page | Video | Status |
|---|---|---|---|---|
| **SEO Analyzer** | `/seo` screen + `/api/seo-analyze` | ✅ live | ✅ bespoke 32s | **The flagship template** |
| **Content Radar** | `/radar` screen | ✅ live | ✅ templated 24s | Reference 2 |
| **Qualifier** (Sales) | `/qualify` + `/api/qualify` | ✅ live | ✅ templated 24s | **Deep build done** |
| **Diagnostic** (Strategy) | `/diagnostic` + `/api/diagnostic` | ✅ live | ✅ templated 24s | **Deep build done** |
| **Listener** (Sales) | `/listen` + `/api/listen` | ✅ live | ✅ templated 24s | **Deep build done** |
| **Sniper** (Sales) | `/snipe` + `/api/snipe` | ✅ live | ✅ templated 24s | **Deep build done** |
| **ICP Clarifier** (Marketing) | `/icp` + `/api/icp` | ✅ live | ✅ templated 24s | **Deep build done** |
| **Deal Room** (Sales) | `/deal-room` + `/api/deal-room` | ✅ live | ✅ templated 24s | **Deep build done** |
| **Hygiene** (Operations) | `/hygiene` + `/api/hygiene` | ✅ live | ✅ templated 24s | **Deep build done** |
| **Forecast Analyser** (Operations) | `/forecast` + `/api/forecast` | ✅ live | ✅ templated 24s | **Deep build done** |
| **Win/Loss** (Operations) | `/win-loss` + `/api/win-loss` | ✅ live | ✅ templated 24s | **Deep build done** |
| **Churn Radar** (Sustain) | `/churn` + `/api/churn` | ✅ live | ✅ templated 24s | **Deep build done** |
| **Expansion Radar** (Sustain) | `/expansion` + `/api/expansion` | ✅ live | ✅ templated 24s | **Deep build done** |
| **Signals Scout** (Sales) | `/scout` + `/api/scout` | ✅ live | ✅ templated 24s | **Deep build done** |
| **Competitor Intel** (Market) | `/competitor` + `/api/competitor` | ✅ live | ✅ templated 24s | **Deep build done** |
| **Planning Cycle** (Strategy) | `/planning` + `/api/planning` | ✅ live | ✅ templated 24s | **Deep build done** |
| **Goal Designer** (Strategy) | `/goal-designer` + `/api/goal-designer` | ✅ live | ✅ templated 24s | **Deep build done** |
| **Health Monitor / Churn Predictor** (Sustain) | `/churn` (shared) | ✅ live | ✅ templated 24s | **Deep build done** |
| **Content pipeline** — Angle Validator, Researcher, Spec Builder, Writer, Editor, Distribute (Marketing) | `/create` (the article workflow) | ✅ live | ✅ templated 24s | **The deepest implementation** |

**All 25 agents resolve** — 19 to dedicated deep runtimes, 6 (the content pipeline) to the flagship `/create` workflow.

**Night batch (this session):** all 25 agent videos rendered + wired; **16 dedicated deep runtimes built end-to-end** (SEO Analyzer flagship + Qualifier, Diagnostic, Listener, Sniper, ICP Clarifier, Deal Room, Hygiene, Forecast Analyser, Win/Loss, Goal Integrity, Churn Radar, Expansion Radar, Signals Scout, Competitor Intel, Planning Cycle, Goal Designer) to the SEO Analyzer bar; deployed (CE API + CE web + website). Every runtime passes the canon (operator voice, grounded, measured-vs-inferred, honest gates).

## Engine coverage (all deep)

| Engine | Deep runtimes |
|---|---|
| **ORIENT / Strategy** | Diagnostic · Planning Cycle · Goal Designer · Goal Integrity · **Market Research** · **Roadmap Align** |
| **CREATE / Marketing** | SEO Analyzer · ICP Clarifier · Content Radar · Competitor Intel · **Campaign Builder** · **Account Planner** · **ABM Playbook** + the full content pipeline (`/create`) |
| **SELL / Sales** | Listener · Signals Scout · Sniper · Qualifier · Deal Room · **Video Outreach** · **Pricing Strategist** · **Negotiation Coach** |
| **SUSTAIN / Expansion** | Churn Radar · Expansion Radar · **Onboarding Coach** · **Renewal Analyst** · **Cross-Sell Scout** |
| **GOVERN / Operations** | Hygiene · Forecast Analyser · Win/Loss · **Pipeline Auditor** · **Attribution** · **Comp & Quota** · **Workflow Builder** |

## Roadmap agents (promoted planned → live)

The registry (`packages/agent-registry/src/agents.ts`) carries `status: 'planned'`
agents with full definitions. Promoting one = build its runtime + guide, flip its
status to `live`, and move it from `roadmap` to `agents` in `website/src/data/engines.js`.

**Done (15/15) — ALL COMPLETE:**
- ✅ **Market Research** (Strategy) — `/market` · **Roadmap Align** (Strategy) — `/roadmap-align` → **Strategy complete**
- ✅ **Campaign Builder** (Marketing) — `/campaign` · **Account Planner** (Marketing) — `/account-planner` · **ABM Playbook** (Marketing) — `/abm` → **Marketing complete**
- ✅ **Video Outreach** (Sales) — `/video-outreach` · **Pricing Strategist** (Sales) — `/pricing` · **Negotiation Coach** (Sales) — `/negotiation` → **Sales complete**
- ✅ **Onboarding Coach** (Expansion) — `/onboarding` · **Renewal Analyst** (Expansion) — `/renewal` · **Cross-Sell Scout** (Expansion) — `/cross-sell` → **Expansion complete**
- ✅ **Pipeline Auditor** (Operations) — `/pipeline-audit` · **Attribution** (Operations) — `/attribution` · **Comp & Quota** (Operations) — `/comp-quota` · **Workflow Builder** (Operations) — `/workflow` → **Operations complete**

**Registry: 40 agents defined, 40 live, 0 planned. Every agent has a runtime + guide.**

## The guide / wiki layer (2026-09-22)

Every runtime output links to a **plain-English guide** for that agent, and the
site has a wiki hub. This is step 2b of the pipeline — a runtime isn't finished
until its output explains itself.

- **Wiki hub:** `gtm-360.com/learn` — every guided agent, grouped by engine.
- **Per-agent guide:** `gtm-360.com/agents/<engine>/<agent>/guide` — how to read
  the output (section by section), the glossary, how it stays honest
  (measured vs inferred), and an FAQ with `FAQPage` JSON-LD.
- **Content source:** `website/src/data/agentGuides.js` (one entry per agent —
  keep in sync with the runtime's output shape). **Coverage: 25/25 agents**
  (the 6 content-pipeline agents explain their stage inside `/create`).
- **Wired three ways:** the agent landing page links to its guide; the nav has a
  "Guides" entry (`/learn`); and every runtime output carries a
  "Read the plain-English guide →" line via
  `content-engine/apps/web/src/components/GuideLink.tsx` (route → guide map,
  rendered once in `Layout.tsx`).
- **Prerendered + sitemap generated from data.** `prerender.mjs` now writes
  `dist/sitemap.xml` from the same route list it prerenders — the sitemap can no
  longer drift from what exists (no more hand-maintained URL list). 25 guide
  pages + `/learn`, 89 URLs total.

**To add a guide for a new agent:** add its entry to `agentGuides.js`, and (if
it's a new route) add the `ROUTE_GUIDE` mapping in `GuideLink.tsx`. Prerender
picks up the page and the sitemap entry automatically.

## Rules

- **Never batch videos before agents are real.** A video advertises a capability
  that must exist first.
- **Bespoke for flagships, templated for the long tail.** The SEO Analyzer
  video is the bespoke bar; the template is the long-tail bar.
- The script's `--all` exists but is **not the default flow** — it's for a
  final refresh after agents are built, and it skips bespoke agents
  (`BESPOKE` set).
- Each agent's landing page + registry entry auto-appear; the work is the
  capability, then the video.

## Next candidates (by customer value)

1. **Qualifier** (sales) — "show me it works" product value
2. **Diagnostic** (strategy) — the entry point / funnel opener
3. **Listener** (sales) — signal monitoring

Each gets the full pipeline: capability → page → video → review.