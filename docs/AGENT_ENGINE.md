# GTM-360 Agent Engine — Outcome-Driven Architecture

> Status: **Adopted 2026-09-13.** Supersedes the product-scattered agent organization.
> This is the single contract for how agents are named, grouped, and delivered across
> Compass · Cockpit · Crew · Method · Content Engine.

## 1. Why this exists

The agent layer was assembled piece-by-piece across five products: Cockpit's A1–A10,
Crew's 16 specialists, Content Engine's 5-agent pipeline, Compass's dock, and HQ's
C-suite personas. That produced 40+ agents with heavy overlap (three content stacks,
two forecasts, two sales stacks, three orchestrators). This engine replaces
"agent per product" with **"agent per outcome"** — one catalog, one look, one runtime,
all driving the same business outcomes.

## 2. The engine model

Every agent earns its place by answering: *"what business outcome does this deliver?"*
There are five engines, arranged as a bowtie: Strategy and Operations are the support
envelopes around the customer journey (Attract → Convert → Grow). Functional names on
the surface; the journey is the story.

```
        STRATEGY (know · decide)        ← top envelope
   ATTRACT ── CONVERT ── GROW           ← the customer journey
        OPERATIONS (validate)          ← bottom envelope
        └── Enhance → back to Strategy
```

| # | Engine | Envelope/Journey | Outcome it delivers | Canonical agents (live) |
|---|---|---|---|---|
| 1 | **Strategy** | Top envelope | The right customer, the right goal, the honest plan | Diagnostic · Planning Cycle · Goal Designer · Goal Integrity |
| 2 | **Marketing** | Journey · Attract | The obvious choice before they ever talk to you | ICP Clarifier · Competitor Intel · Content Radar · Angle Validator · Researcher · Spec Builder · Writer · Editor · Distribute |
| 3 | **Sales** | Journey · Convert | Pipeline that fills and closes | Listener · Signals Scout · Sniper · Qualifier · Deal Room |
| 4 | **Expansion** | Journey · Grow | The book kept and grown | Health Monitor · Churn Predictor · Expansion Radar |
| 5 | **Operations** | Bottom envelope | Numbers you can bet the quarter on | Hygiene · Forecast Analyser · Workflow Builder · Win/Loss |

The loop is the operating rhythm: Strategy feeds the journey → the journey produces
revenue + learnings → Operations validates the numbers → forecast/win-loss feed back
into next quarter's Strategy.

## 3. Canonical catalog (41 live agents)

One canonical agent per job. Where several products shipped the same job, the best
implementation is canonical and the rest are **absorbed** (declared in `legacyIds`,
kept for traceability, retired from active UI).

| Canonical | Engine | Role | Absorbs (legacy) |
|---|---|---|---|
| `diagnostic` | Strategy | GTM health assessment | A2 Market Research |
| `planning-cycle` | Strategy | Quarterly operating loop | A1 Chief of Staff |
| `goal-designer` | Strategy | OKR + ambition design | Compass Confidence |
| `goal-integrity` | Strategy | OKR alignment + gaming detection | Compass Alignment, Compass Radar |
| `icp-clarifier` | Marketing | ICP sharpener | — |
| `competitor-intel` | Marketing | Competitive landscape monitor | — |
| `content-radar` | Marketing | Content whitespace scanner | — |
| `angle-validator` | Marketing | Angle proceed/pivot/kill | — |
| `researcher` | Marketing | Grounded evidence pipeline | A9 Customer Voice |
| `spec-builder` | Marketing | Writer specification | — |
| `writer` | Marketing | On-voice draft | Content Multiplier, Compass Enablement |
| `editor` | Marketing | Fact-check + quality gate | A10 Editor-in-Chief, Compass Coach |
| `distribute` | Marketing | LinkedIn / YouTube / Substack / email | — |
| `listener` | Sales | 52-trigger market monitor | — |
| `signals-scout` | Sales | Signal-to-intent owner | A3 Account Research |
| `sniper` | Sales | Precision outreach drafter | A4 Personalisation |
| `qualifier` | Sales | Deal qualification engine | A5 Reply Handler |
| `deal-room` | Sales | Live deal intelligence | A6 Deal Strategist, A7 Proposal |
| `health-monitor` | Expansion | Account health scoring | — |
| `churn-predictor` | Expansion | Retention risk engine | — |
| `expansion-radar` | Expansion | Upsell signal detection | — |
| `win-loss` | Operations | Win/loss analyst | WL |
| `hygiene` | Operations | CRM data integrity | — |
| `forecast-analyser` | Operations | Forecast confidence engine | A8 Revenue Forecast |
| `workflow-builder` | Operations | RevOps automation spec | — |

### Roadmap agents (planned, status `planned`)

15 forward-capability agents ship as `planned` and unlock through the roadmap:

| Engine | Roadmap agents |
|---|---|
| Strategy | Market Research · Roadmap Align |
| Marketing | SEO Analyzer · Campaign Builder · ABM Playbook · Account Planner |
| Sales | Video Outreach · Pricing Strategist · Negotiation Coach |
| Expansion | Onboarding Coach · Renewal Analyst · Cross-Sell Scout |
| Operations | Pipeline Auditor · Attribution · Comp & Quota |

## 4. Executive lenses (not agents)

HQ personas are views over the engine, not agents:

| Lens | Engines surfaced |
|---|---|
| Sam · Chief of Staff | Strategy + Operations |
| Rex · CRO | Sales + Operations |
| Andy · CMO | Marketing + Strategy |
| Finn · CFO | Operations |
| Ola · COO | Expansion + Operations |

## 5. Unified runtime & gateway

- **One registry** — `@gtm360/agent-registry` (this package): the single source of truth
  for group, inputs, outputs, logic gates, handoffs. Any app imports it.
- **One runtime** — Cloudflare Workers + DeepSeek (Content Engine already runs this).
  Cockpit's Express agents and Crew's Supabase Edge Functions migrate onto it.
- **One gateway** — `api.gtm-360.com/agent/*`, authenticated via the shared `.gtm-360.com`
  SSO cookie. Every product calls every agent through the same door.
- **One shared 4-step chain** on every agent: GATHER → VALIDATE → SYNTHESISE → VERIFY,
  with explicit logic gates and a confidence label. No black boxes.

## 6. Unified look & feel

One enterprise shell across all products: shared product switcher, one design-token set,
one agent-card component (name → role → inputs → run → output with confidence /
sources / gaps / handoffs). Engines carry a fixed color so any surface
immediately reads which part of the system an agent serves:

- Strategy `#2563eb` · Marketing `#10b981` · Sales `#d97706` · Expansion `#0d9488` · Operations `#475569`

## 6b. Research companion (Agent-Reach)

A local research companion (`scripts/research-companion.mjs`) wraps the
Agent-Reach channel stack (YouTube subtitles · GitHub · web via Jina Reader · RSS)
into an evidence brief for the Marketing·Researcher (expert-quote / named-example
proof), Marketing·Content Radar (trend / whitespace), and Sales·Listener (signal)
engines. It runs on a machine, not in the Worker — see AGENTS.md for usage and the
Phase-3 plan to expose it as an HTTP sidecar behind the gateway.

## 7. Execution phases

1. **Adopt this contract** — new agents must map to an engine before they ship.
2. **Registry live** — the catalog ships as `@gtm360/agent-registry`; Content Engine
   renders it as the Engine surface (done 2026-09-13; migrated to the 5-engine
   bowtie model 2026-09-20).
3. **Runtime migration** — port Crew + Cockpit + Compass agents onto Workers + DeepSeek
   behind the gateway; declare absorbs in the registry.
4. **Shell unification** — apply the enterprise shell + tokens to all five apps.
5. **Domain cleanup** — retire Cockpit duplicates (hq/app/outbound/signal360),
   dead workbench, and exposed `.pages.dev`/`.workers.dev` aliases.

## 8. The three surfaces (IA, adopted 2026-09-22)

The public face is three surfaces — **marketing site · agent portal · wiki** — plus
two engine workspaces. The engine taxonomy (the bowtie) is **internal**; it lives in
the Agent Portal, not in the marketing nav.

```
EXTERNAL (the buyer)
  gtm-360.com ............ marketing site
      Challenges · Offerings · Insights · About   (+ Talk to us CTA)
      [ Agent Portal ]  [ Knowledge ]  ← the two buttons

  agents.gtm-360.com ..... AGENT PORTAL  (the runtime; the bowtie lives here)
      the 41 agents, grouped by engine · Chief of Staff under Operations
      (the 40 agent landing pages + videos stay on gtm-360.com/agents for SEO)

  gtm-360.com/wiki ....... WIKI  (the knowledge base)
      Method (operating model) · Agent Guides · Playbooks · Glossary · Essays→Substack

INTERNAL (where work runs)
  brain.gtm-360.com ...... Operations surface (command center)
  okr.gtm-360.com ........ Strategy surface (OKRs / Compass)
```

**Redirects:** `gtm.gtm-360.com` → `/wiki` · `content.gtm-360.com` → `agents.gtm-360.com`
· `/system` + `/engine` → `/wiki` · `/learn` → `/wiki/guides` · `/services` → `/offerings`.

**Vocabulary (the thing that caused the confusion):** *System* = the whole thing (L0).
*Bowtie* = the **shape** of the five engines (a diagram, not a level). *Engine* = one of
the five (L2). *Agent* = one of the 41 jobs (L3). *Workspace* = where work runs.