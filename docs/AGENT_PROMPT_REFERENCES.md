# Agent Prompt References (agency-agents) — SELL + CREATE refinements

> Source: `msitarzewski/agency-agents` (MIT, 152k★) — a library of ~500 agent
> "personality" markdown files. **Reference only, not a dependency.** We adapt the
> craft; we do not import the files. License requires attribution — see the links
> below for each source file.
>
> Relevant to the Agent Engine (docs/AGENT_ENGINE.md) groups **SELL** and **CREATE**.

## 1. The reusable prompt structure

Every agency-agents file follows the same skeleton. Adopt this shape when refining
`@gtm360/agent-registry` agent definitions:

| agency-agents field | Maps to our registry | Notes |
|---|---|---|
| frontmatter: `name, description, color, vibe` | `name, role`, + (new) `vibe` | One-line personality ("Qualifies deals like a surgeon and kills happy ears on contact") — enterprise flavor |
| Role Definition | `whatItDoes` | Sharp, stated-as-a-job, not a vague summary |
| Core Capabilities | `whatItDoes` bullets | Enumerate exactly what the agent can do |
| Deep framework sections | `gates` + `handoffs` | The framework's failure checks become gates; next-owner steps become handoffs |
| Critical Rules | `gates` | Hard limits — "never invent numbers", "no happy ears" |
| Technical Deliverables | `outputs` | Named output formats, ready to render |
| Success metrics | (future) `successMetrics` | e.g. win-rate delta, forecast variance |

## 2. SELL-group refinements

### `deal-room` + `qualifier` ← `sales/sales-deal-strategist.md`
The MEDDPICC deep-dive maps 1:1 onto our qualification gates:
- **Economic buyer test**: "Can this person reallocate budget from another initiative? If no, you haven't found them" → gate for `qualifier`.
- **Decision criteria/process**: "Walk me through what happens between choosing a vendor and going live. Every unmapped step is a place the deal can die silently." → `deal-room` output: unmapped-step list.
- **Paper process**: legal/procurement/security gauntlet — "A 6-week procurement cycle discovered in week 11 kills the quarter." → add a `paper-process` input + gate (procurement stage known?).
- **Champion test**: power + access + motivation, "ask them to do something hard; if they won't, they're a coach" → `deal-room` risk flag.
- **Winning / battling / losing zones**: "the winning move on losing zones is to shrink their importance, not to lie" → anti-hallucination gate for competitive claims.

### `listener` + `signals-scout` + `sniper` ← `sales/sales-outbound-strategist.md`
- **Signal categories ranked by intent strength** → strengthens our Listener's 52-trigger ordering (currently unranked).
- **Speed-to-signal** as the critical metric → add as a `signals-scout` output.
- **Tiered account model** (A/B/C/D by intent) → matches our existing Fit Tier; align naming.
- **Multi-channel sequence design + channel-by-persona** → `sniper` output: channel selection rationale.
- Cold-email rules (one signal per message, reference a specific real event, no generic copy) → already in our Sniper gates; keep.

### `forecast-analyser` + `hygiene` ← `sales/sales-pipeline-analyst.md`
- **Analytical integrity / diagnostic discipline** ("never invent a number; a gap is a gap") → formalize as a `forecast-analyser` gate; aligns with our rep-called vs evidence-adjusted output.
- **Pipeline velocity, coverage/health, deal health scoring** → candidate outputs for `forecast-analyser`.

## 3. CREATE-group refinements (AEO)

### Writer / site AEO ← `marketing/marketing-aeo-foundations.md`
Three-layer AEO model we can operationalize next (beyond the JSON-LD + FAQ already shipped):
1. **Discovery layer** — llms.txt, AI-aware robots.txt (allow search-augmented crawlers like GPTBot/BingBot, allow/deny training crawlers deliberately, block scrapers).
2. **Parsability layer** — clean HTML, semantic headings, FAQ schema (done).
3. **Capability layer** — actions AI agents can take on the site.

### Writer AI-citation ← `marketing/marketing-ai-citation-strategist.md`
Operational audit workflow for the Meltwater study we already adopted:
- **Citation audit scorecard** → measure how often our content gets cited in AI answers.
- **Lost-prompt analysis** → which questions we SHOULD be cited for but aren't.
- **Fix packs** (FAQ schema, comparison content, question-answering structure) → our Writer's "THE QUESTION IT ANSWERS" framing is the same idea; formalize as a `writer` gate + a monthly audit.

## 4. Recommended follow-ups

1. Add a `vibe` field to the `Agent` type in `@gtm360/agent-registry` (one-line personality per agent) — enterprise polish, zero risk.
2. Add `paper-process` input + procurement gate to `qualifier`/`deal-room`.
3. Ship llms.txt + AI-aware robots.txt on `content.gtm-360.com` (AEO discovery layer).
4. Monthly AI-citation audit using the strategist's scorecard + fix-pack workflow.

Source files (MIT): [deal-strategist](https://github.com/msitarzewski/agency-agents/blob/main/sales/sales-deal-strategist.md) · [outbound-strategist](https://github.com/msitarzewski/agency-agents/blob/main/sales/sales-outbound-strategist.md) · [pipeline-analyst](https://github.com/msitarzewski/agency-agents/blob/main/sales/sales-pipeline-analyst.md) · [aeo-foundations](https://github.com/msitarzewski/agency-agents/blob/main/marketing/marketing-aeo-foundations.md) · [ai-citation-strategist](https://github.com/msitarzewski/agency-agents/blob/main/marketing/marketing-ai-citation-strategist.md)
---

# Addendum (2026-09-14) — writing, design & marketing references

## Human voice — folded into Writer/Editor (ADOPTED)

\lader/humanizer\ (MIT, 47k★) — 25 AI-writing-tell patterns. The strongest ones are
now part of \HUMAN_VOICE\ in \pps/api/src/agents/writer.ts\ and the Editor's human-voice
review dimension (\editor.ts\): the "It's not X, it's Y" contrast formula, staged
openers / fake candor ("Let's dive in", "To be clear"), aphorism-dressing ("at its
core", "X is the Y of Z"), forced triads, one-line closer clichés ("Read that again"),
defensive hedging leftovers, and dash density. Anti-hallucination rule preserved: voice
never invents a fact.

## Design & UI quality (REFERENCE / future QA)

- \pbakaus/impeccable\ (Apache-2.0, 67k★) — 61 deterministic "AI-slop" design rules
  (inter-everything fonts, purple gradients, card-nesting, gray-on-color). ADAPT the
  rule *content* into future UI QA; do not install its Rust binary/hooks into the repo.
- \VoltAgent/awesome-design-md\ (MIT, 115k★) — DESIGN.md files extracted from
  Linear/Stripe/Supabase/Notion. Reference to harden \DESIGN_SYSTEM_TOKENS.json\.
- \nthropics/skills\ \rontend-design\ (MIT) — Anthropic's canonical design skill;
  install for coding agents; borrow its self-critique structure.
- Motion libs (GSAP, Lenis, react-three-fiber, liquid-glass, liquid-logo,
  shadergradient) were evaluated and **skipped** — marketing-showcase WebGL/scroll
  effects contradict the enterprise, SEO-critical, CSS-first direction.

## Marketing skills mines (for refining CREATE/SELL prompts)

- \coreyhaines31/marketingskills\ (MIT, 50k★) — best-in-class, maps 1:1 to our CREATE
  (copywriting, ai-seo, content-strategy) and SELL (prospecting, revops,
  sales-enablement) agents; its \product-marketing\ shared-context dependency pattern
  is a model for \@gtm360/agent-registry\.
- \lirezarezvani/claude-skills\ (MIT, 25k★) — 388 skills incl. AEO/citation tracking;
  mine the AEO/commercial skills; audit before any install (ships \curl | bash\).
- \BrianRWagner/ai-marketing-claude-code-skills\ (415★) — compact references
  (\de-ai-ify\ ≈ HUMAN_VOICE, \i-discoverability-audit\ ≈ AEO, \social-card-gen\ ≈
  \distribute\).

## Infra candidates (Phase-3/4, not now)

- \czlonkowski/n8n-mcp\ (MIT, 22k★) — self-hosted n8n + MCP as a complementary,
  human-gated automation layer for SELL/GOVERN alongside Cloudflare Workflows.
- \every-app/open-seo\ (MIT, 18k★) — self-hostable keyword/rank/audit backend for
  Content Radar; note the paid DataForSEO key dependency.

---

# Addendum 2 (2026-09-14) — B2B-sales / marketing discovery scan

Sources: GitHub topics 2b-sales + marketing-tools, hyperfx.ai + Medium "best
marketing skills" articles. Cross-referenced against everything already covered.

## Worth incorporating

| Repo | What | Value | Rec |
|---|---|---|---|
| dancolta/subscope | Keyless Reddit buyer-intent scanner (RSS, 8 buying-signal patterns, ranked) | **SELL·Listener / ORIENT·Radar** — the cookie-gap fill Agent-Reach leaves open | **ADAPT** (channel in research-companion / Listener) |
| spronta/crawlie | Rust technical SEO + GEO/AEO crawler, exposes MCP | **GOVERN** — AEO QA on robots/llms.txt/JSON-LD; Researcher crawl channel | **ADAPT** (dev-tool; review Rust/MCP surface first) |
| OpenClaudia/openclaudia-skills | 34 community marketing skills (SEO/content/email/ads/analytics) | **CREATE** — commercially-clean (Apache/MIT) prompt mine | **ADAPT** (mine prompts) |
| zubair-trabzada/ai-marketing-claude | 15 marketing skills using parallel subagents + client-ready PDF reports | **Runtime** — parallel-subagent orchestration pattern for the agent engine | **REFERENCE** |
| ComposioHQ/awesome-claude-skills (59.6k★) + VoltAgent/awesome-agent-skills (21.6k★) | Curated skill hubs with Business/Marketing sections | **Discovery** — the systematic place to scan future skill repos | **REFERENCE** |

Also noted: marketinguys/awesome-gtm-engineering, iPythoning/b2b-sdr-agent-template,
julienamorgan/signal-prospecting-kit, Prospeda/gtm-skills (2,500+ GTM prompts) as
SELL prompt mines.

## Skip (fluff / risk)

- hyperfx.ai article = ad for its own paid **Hyper MCP (/mo)**; claims self-reported.
- explorium-ai/vibeprospecting-plugin (paid data funnel), Google-Maps/LinkedIn lead-gen
  "50k leads" systems (ToS/ban risk), Facebook/LinkedIn auto-responder bots (ToS risk),
  thin lead-magnet skill packs.
- mautic (GPL, overkill vs Workers+Resend), grouparoo (unmaintained since 2022).
