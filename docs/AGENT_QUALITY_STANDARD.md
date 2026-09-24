# GTM-360 Agent Quality Standard

> Status: **Adopted 2026-09-21.** The non-negotiable bar every agent in
> `@gtm360/agent-registry` must meet before it can be `live`. An agent that
> fails this standard does not ship — and if it already shipped, it gets
> rebuilt.
>
> Purpose: **nothing we build may be distinguishable from an agent on an
> agent marketplace.** If someone could swap our agent for a commodity one and
> not notice, it is not done. This standard is the contract that prevents that.

---

## 1. The differentiation test (the gate everything else hangs off)

Before any agent ships, ask one question:

> **"Would this agent's output be indistinguishable from a generic agent you
> could download from an agent marketplace?"**

If the answer is *"yes, it's generic"* — it does not ship. The output must
carry a point of view, an analytical spine, or a piece of judgment that a
commodity tool cannot produce because it does not have our operator's scar
tissue or our evidence discipline.

Three things make an output non-commodity:

1. **A spine, not a list.** The output argues something. It has a thesis, a
   ranking by *judgment* (not by a naive metric), and a recommendation a
   senior operator would defend.
2. **Grounding, not vibes.** Every claim carries a source URL or an
   Experience-Layer entry. No invented numbers, no "industry experts say…".
3. **The operator is present.** Where the operator's lived experience changes
   the interpretation, it shows up — explicitly, named as scar tissue, never
   as a generic platitude.

---

## 2. Grounding rules (anti-hallucination)

- Every verifiable claim in an agent's output must trace to a real source
  (search result, fetched document, evidence table, or Experience-Layer entry).
- An agent must **report the absence of evidence honestly** rather than
  padding with plausible-sounding filler. "Nothing significant found" is a
  valid, defensible output.
- No fabricated metrics, quotes, companies, or statistics. Ever.
- When a claim is *synthesized* (brand POV / judgment), it must be labeled as
  analysis, not fact.

## 3. Measured vs inferred (the honesty label)

Every agent output distinguishes two kinds of finding:

| Kind | Meaning | How it's labeled |
|---|---|---|
| **Measured** | Directly observed: real search results, SERP positions, fetched page content, schema presence, token counts | "Measured" / shown with its source |
| **Inferred** | Judgment drawn from the measured signals: demand heat, likely intent, citation likelihood, competitive gap | "Inferred" / explicitly a score or likelihood |

- Never present an inference as a measurement.
- No guarantees on non-deterministic outcomes. The AEO/Citation agents say
  **"improve citation likelihood"**, never **"get cited"**.
- State the volatility of the domain honestly (AI citation behavior is
  point-in-time; search positions move).

## 4. Output contract (no prose walls, no keyword lists)

- Every agent produces **named, structured deliverables** — tables, scorecards,
  ranked lists, fix packs, decision matrices — not a wall of paragraphs.
- A keyword list is **never** presented as insight. Every query/topic/entity
  must map to: intent + a finding + an action.
- Every deliverable is paired with **what to do next** (the handoff or fix).
  An observation without an action is incomplete.
- Outputs must be **scannable by a busy operator**: lead with the answer, use
  the group's own terminology, keep the density of named entities high.

## 5. Operator POV (the moat)

- Where the operator's Experience Layer has an entry relevant to the agent's
  domain, the agent uses it — it changes the interpretation, the framing, or
  the recommendation.
- Where the Experience Layer is empty, the agent says so honestly and
  produces an analytical POV (synthesis from the evidence), never a fabricated
  "operator" voice.
- The operator's judgment is never invented. If the layer has nothing, the
  agent's POV is explicitly "analytical, not from scar tissue."

## 6. Human gate

- Every agent output that leads to an external action (send, publish, spend,
  contact a prospect) requires human approval before that action fires.
- Agents recommend and prepare; the operator disposes. This is the core of
  "you confirm the moves."

## 7. Subrequest & resource discipline

- LLM- and search-heavy stages must run behind the self-bound internal
  endpoint pattern (`WORKER_SELF` + `AUTH_HOOK_SECRET`) — never inline in a
  Workflow instance, which shares one ~50-subrequest budget.
- Every LLM call is logged with tokens/cost/latency via the usage callback.
- Free/keyless sources are preferred; keys live in secrets, never in the
  frontend or in source.

## 8. The standard agent description (what every agent page says)

Every agent's public description follows ONE five-part format, outcome-first.
A user must understand what the agent does and what it delivers in 10 seconds —
mechanism details come second, never first.

| Part | Field | What it says |
|---|---|---|
| 1 | **What it does** | One line, outcome-led ("Maps the queries your buyers ask an AI, then hands you the fixes to win them"). A verb + a result, not a noun + a feature. |
| 2 | **What you get** | The concrete deliverable, named ("a prioritized fix plan — effort, impact, blocker, owner per fix"). |
| 3 | **What it needs** | The inputs, plain ("a topic cluster, your domain, optional competitors"). |
| 4 | **How it stays honest** | The method promise, one line ("every finding is measured or explicitly labeled as inferred"). |
| 5 | **What's next** | The handoff / next step ("each fix hands into the fact-checked content pipeline"). |

Rules:
- **Outcome first.** Never open with the mechanism ("it audits discovery/parsability/capability").
- **A user who has never seen the tool** must understand part 1 and 2. If they'd need a glossary, rewrite.
- The five parts are visible on the agent's surface (page intro + registry `whatItDoes`); the mechanism lives in the deliverable, not the pitch.
- The `vibe` field is the one-line personality; it complements, never replaces, the description.

## 9. The agent output page (every agent's surface)

Every agent's output page ships four mandatory pieces. The report may be dense
with domain terms — the guide is the accessibility layer over the intelligence
layer. Reference implementation: the SEO Analyzer's report page.

1. **Outcome-first intro** (§8) — the five-part description as the page's H1 + lead.
2. **Plain-English guide** — a collapsible "What am I looking at?" panel that
   explains, in plain consultant-grade language (tone canon, no hype, no jargon
   soup): what this agent's report is, why it matters, and how to read each
   section. Hidden on print.
3. **Glossary** — every term that appears on the page defined in one line each
   (e.g. AEO, SERP, PAA, measured-vs-inferred). Written for a user who has never
   seen the domain.
4. **Method note** — the honesty line, visible on the surface: what is measured,
   what is inferred, and that likelihood is never a guarantee.
5. **Story video** (when the agent's surface ships) — a marketing-quality video
   on the agent's public page that tells its story: the problem, the one job,
   what it delivers, and the confident close. Rules:
   - **Bespoke for flagship agents** (a unique composition, rendered with the
     HyperFrames/brag tooling); **templated** (the reusable brand composition,
     parameterized per agent) for the rest. A bespoke agent demands a bespoke
     video — no two flagships share frames.
   - Marketing quality, not screencast: dark ink + emerald, the bowtie visual
     language, calm confident pacing.
   - **The voice is marketer and seller, never accountant.** Aspirational,
     humanlike, offensive. The ad sells the dream; the product proves it.
   - **Sell the dream, not the decimal** — hype the vision hard, never attach a
     number. "Be the answer when the question matters" is in; "we'll make you
     #1" is out. An aspirational claim shapes perception; a specific figure can
     be falsified in the demo.
   - **No defensive register.** No "we never promise X", no "we can't
     guarantee", no "measured, not guessed" as a caveat. Honesty is implicit in
     the voice — the confidence *is* the truth.
   - **No academic/AI vocabulary**: citation, likelihood, optimize, leverage,
     unlock, "AI-powered". Say it the way an operator would over a coffee.
   - **No machine-tell patterns** (canon §11): no "It's not X, it's Y", no
     forced triads, no forced rhyme ("Map the questions. Win the answers.").
   - The video slot exists on every agent page from day one; it fills in as the
     video ships. Reference implementation: the SEO Analyzer story video.

Rules:
- The guide must be collapsible and closed by default — it helps when needed, never crowds the output.
- The glossary must define the actual terms on the page, not a generic list.
- Print output excludes the guide (the exported report stays clean and scannable).
- A user who lands on the page cold must be able to understand what they're looking at within one expand of the guide.

## 10. The checklist (applied to every agent, live or planned)

- [ ] Output passes the **differentiation test** (§1)
- [ ] Every verifiable claim has a source or Experience-Layer entry (§2)
- [ ] Absence of evidence reported honestly (§2)
- [ ] Measured vs inferred explicitly labeled (§3)
- [ ] No guarantees on non-deterministic outcomes (§3)
- [ ] Named structured deliverables, not prose walls (§4)
- [ ] Every query/entity maps to intent + finding + action (§4)
- [ ] Agent page has the **plain-English guide + glossary** (§9)
- [ ] Agent page shows the **method note** (measured vs inferred) (§9)
- [ ] Agent page has a **story video** when its surface ships (§9)
- [ ] Operator POV used when the layer has it; honest-empty otherwise (§5)
- [ ] Human gate on any external action (§6)
- [ ] Self-bound if LLM/search heavy (§7); usage logged (§7)

An agent is `live` only when **all thirteen** pass.

---

## 11. Retroactive application

All 15 planned agents (Market Research, Roadmap Align, SEO Analyzer, Campaign
Builder, ABM Playbook, Account Planner, Video Outreach, Pricing Strategist,
Negotiation Coach, Onboarding Coach, Renewal Analyst, Cross-Sell Scout,
Pipeline Auditor, Attribution, Comp & Quota) are held to this standard. Those
that currently exist only as registry stubs must be built to §1–§9 before
they flip to `live`. The build order is by business value, with SEO Analyzer
as the flagship reference implementation.

## 12. The operator's signature

Nothing with the GTM-360 name on it ships without meeting this bar. If a
model-produced agent reads like AI slop, it is not our agent — it is scrap.
The standard is the firewall between the two.