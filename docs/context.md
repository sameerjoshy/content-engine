# GTM-360 Voice System — Context for External Review (v1.1)

> **What this is:** the complete reasoning behind GTM-360's brand voice and its
> content engine. Read this together with `VOICE_SYSTEM.md` (the spec itself).
> We want your critique, your pushback, and the gaps you see — on the voice,
> the format adaptation, the engagement mechanics, the quality gate, and the
> Experience Layer.
>
> **How to use:** we'll ask specific questions at the end, but if you read this
> cold, you'll know the objective, the rationale for every choice, and the
> output contract. Critique from the specifics, not from abstraction.
>
> **v1.1 note:** this revision folded in the first external review — an
> Experience Layer (Proprietary POV) is now a first-class pipeline stage, the
> composite gate is deterministic-dominated, interaction devices are split from
> edge quality, and we added a so-what gate, a freshness rule, and a
> post-publish tuning loop.

---

## 1. Who we are (10 lines)

**GTM-360** is "The Revenue Operating System" — a product family (Compass for
OKRs, Cockpit for execution, Crew for specialist agents, Method for the
operating model, Content Engine for content) for B2B GTM teams. The **Content
Engine** turns a topic + angle into a grounded, fact-checked, human-voiced
article, then distributes it to Substack, LinkedIn, and X.

The pipeline (v1.1): **Question → Research → Evidence → Synthesis →
Proprietary POV → So-what gate → Draft → Format → Editor → Publish gate →
Ship.** Research review gate (human approve/steer) sits inside Research.
Revise / Refresh and Publish sit after the Editor.

Non-negotiables: **anti-hallucination** (every verifiable claim traces to real
research or a recorded Experience-Layer item; the editor removes fabricated
facts and keeps genuine analysis as brand POV), **proof-mix** (named
companies, expert quotes, stats are hunted and required), **named-expert
authorship** (AI search cites individuals ~3× more than brand pages), and
**freshness** (content stays recent via refresh).

## 2. The objective

What every piece must achieve, in one block:

- **Credibility** — named sources, dated stats, anti-fabrication, honest gap
  reporting.
- **Freshness** — current, "alive", tied to what's happening now.
- **Burning interest** — answers a question people are actually asking this
  week (search + community demand), not a topic we find interesting.
- **Interaction-first** — engineered to earn comments, not just reads.
- **Human voice** — reads like a person with scar tissue, not a machine.
- **Citable / AEO** — gets quoted by readers and AI search engines (structured,
  question-answering, named-entity-dense).
- **Recognizable** — the moat. Would someone who knows the operator recognize
  this as *their* thinking, not just good AI writing?

**The product promise:** "deep insights driven by deep research, that benefit
the reader — not flashy eyeball-grabbing."

## 3. The WHY — rationale behind every voice decision

These are the reasoning chains from our design conversation. Each element in
`VOICE_SYSTEM.md` exists because of the mechanism below.

### 3a. Experience hook (relatable ≠ generic)
**Why:** recognition → identification → comment. The reader comments when
content names their *lived experience*. A post that referenced a shared
cultural in-joke ("the song that must play at the wedding") pulled 30 replies
of banter and speculation — because everyone could add their own layer.
Relatability works when it's **specifically recognizable** ("you've sat in a
board meeting where you stopped believing your own valuation"), not generic
("leaders sometimes struggle"). The generic version gets scrolled past.

### 3b. Earned uncertainty / "don't be the know-it-all"
**Why:** open uncertainty invites participation; closed certainty ends the
conversation. When a credible writer admits "this genuinely puzzles me" after
showing they've done the homework, the reader is invited to be the one who
solves it — and people love being the smart one. The mechanism is a **curiosity
gap**: an itch the reader scratches by commenting.
**The balance:** **confidence on facts, curiosity on meaning.** State the
numbers firmly (Miro sold at 2.3x ARR, profitable, $435M cash — no hedging);
be genuinely puzzled about the *interpretation* ("why did the board take it
when no strategic buyer stepped in?"). Flip it and you break it: hedging facts
reads weak/sloppy; certain interpretation reads preachy.
**The critical rule:** puzzlement must be *earned*. "I've read the press
releases, done the comps, and even then — I don't understand why X" is
powerful. "I don't understand this topic" is just weak.

### 3c. Edge-authenticity (real edge, not AI-slop edge)
**Why:** "standard AI edge slop" is **form**; real edge is **substance**. Slop
edge *performs* a position ("Let's be brutally honest — Miro was never worth
$17.5B. SaaS is over.") with meta-labels ("Contrarian take:"), performative
hotness ("X is dead"), and no mechanism. Real edge *earns* it: specificity
before opinion ("Bending Spoons will raise Miro's price" only when followed by
*how* — the Evernote playbook, the timeline), stakes not takes, and
**understatement** ("It's worth noting no strategic buyer showed up" is more
damning than "Miro is dead"). **One earned edge moment per piece — hard
limit** — because the pattern is exactly what an LLM will drift into
multiplying.

### 3d. Interaction devices are structural; edge is voice (v1.1 split)
**Why we split them:** they're different muscles. Interaction devices are
*structural choices* — the hook, the question at the end, the open loop. They
are binary-presence checkable per format. Edge-authenticity is *voice and
substance* — whether the edge is earned. A piece can have perfect device
placement and still have slop edge. So: devices are a **presence gate**, edge
is a **quality dimension** with heavier weight. And the interaction floor is a
floor, not a quota — **one genuine device organic to the argument beats three
bolted-on triggers**. The strongest engagement comes from the insight itself
creating disagreement; devices are scaffolding.

### 3e. Credibility floor (hard intelligence)
**Why:** named people + named companies + surveys/whitepapers + dated stats are
the proof that earns trust — and they're what AI search quotes. This came from
two data points: (1) the engine honestly refused to invent a quote when none
existed — readers trust that more than fabrication; (2) Meltwater's 9.5M-
citation study: **content with specific names, pricing, and statistics gets
quoted far more than generic thought leadership; 75% of AI citations come from
individual experts, not brand pages.** So the proof mix (named companies,
expert quotes, stats) is a pipeline requirement, not a style choice — and every
piece is authored by a named expert.

### 3f. The Experience Layer / Proprietary POV (v1.1 — the moat)
**Why:** the biggest missing ingredient. We had encoded *how an experienced
operator sounds* but not *what they know that isn't in the research*. Research
discovers "companies with X characteristic tend to experience Y." Scar tissue
says "I've watched this happen three times. The official explanation was X.
The actual failure happened six weeks earlier, when nobody owned Y." That is
the defensible moat — no dossier contains it.
**The rule:** the engine asks one explicit question per run — *"Do we have an
experience-based observation that changes the interpretation?"* If the layer
has one, it uses it; **if not, it says so and does not fabricate one.** The
Proprietary POV object answers: *"What do we believe that isn't obvious from
the sources — and what would we still believe if every citation vanished
tomorrow?"* This is the intellectual asset every format is generated from, and
it operationalizes ">50% original": **original = new synthesis, new question
map, new execution layer, or new reported detail not in the source** — not
paraphrase.

### 3g. Question-intent (proven demand)
**Why:** search and community data are proven demand. Search picks the
questions people are actually asking; our analysis picks the answers. Never
keyword-farm. The engine's "THE QUESTION IT ANSWERS" framing exists because AI
search engines and readers both favor content that answers a specific question
— and Meltwater confirms it: "think 'what might my buyer ask an AI tool?'".
This feeds the **so-what gate**: after the spec is built, the engine checks
whether the question is actually burning right now (search volume + community
signal) and **kills or steers before the writer spends words** if it's cold —
operator override allowed, because the operator may know something the data
doesn't.

### 3h. Big-dog / news-event model (anchor + payload)
**Why:** when McKinsey/BCG/HBR/a major vendor publishes something fresh, there's
a ~72-hour window where search + social + AI-citation traffic is hottest. The
play: use the big-dog report as the *anchor* (credibility + traffic hook) and
our synthesis/POV/execution as the *payload*. The value chain that wins: big-dog
report → our synthesis (the connection nobody made) → our POV → our execution
layer → our voice. **>50% of the piece must be original to us** (defined in
3f) — the report is the citation and the hook, never the body. (The
Miro/Bending Spoons deep-dive was the proof case.)

### 3i. Format registers (same POV, different distance)
**Why:** LinkedIn and X *are* interaction games; Substack *is* a letter; the
article *is* the authority. Forcing one voice into four channels fails all
four. So: same POV, different **register** — an interaction floor and a
hard:soft calibration per platform. The long-form can be more
one-way/authoritative; the feed must be interactive. **Whitepaper: left open**
(v1.1) — if an Article + Substack piece would clearly work better as a
downloadable, evergreen document, we write it; Substack is intimate and
time-bound, a document is discoverable and citable.

### 3j. Composite hard gate, deterministic-dominated (v1.1)
**Why:** the original gate was a weighted composite (better than a checklist),
but the external review surfaced the central architectural risk: **an LLM
scoring its own writing can converge on satisfying the rubric** — excellent
evidence, correct structure, correct voice, correct mechanics = *extremely
sophisticated AI slop*, with a 0.82 score that means "satisfied the rubric,"
not "excellent."
**The v1.1 answer, three layers:**
1. **Deterministic checks dominate (≥60% of the score):** evidence grounding,
   proof-mix counts, ban-list pattern matches, interaction-device presence,
   so-what freshness, structure, source recency. A piece that fails the
   deterministic share cannot pass, regardless of subjective brilliance.
2. **Subjective dimensions (≤40%, tiebreaker only):** edge-authenticity,
   earned uncertainty, human-voice, experience-hook, gotcha quality.
3. **A human publish gate** — the one test no model can run: *"Would someone
   who knows the operator recognize this as their thinking?"* Only the
   operator can answer. This is the anti-slop firewall.
**Why not a separate judge model:** a second LLM reads the same rubric and
still doesn't know the operator — costlier version of the same bias. The
judge who knows the operator is the operator.

### 3k. Feedback loop (v1.1 — data over feel)
**Why:** hard:soft ratios and weights are hypotheses until real engagement
data exists. After ~30–50 pieces we measure: comments (are devices working?),
citations (is proof-mix working?), "you got this wrong" vs "same here" ratios
(edge vs slop), and which pieces age fast. Then we tune the weights and ratios
and log it in the changelog. If the highest-engagement LinkedIn posts turn out
50:50, the spec changes. Also: a piece strong on every dimension but boring
traces to the so-what gate or the Proprietary POV, not the voice — no
interaction device saves an uninteresting claim.

## 4. The OUTPUT — what each piece produces, platform by platform

| Platform | Register | Hard:soft | Interaction floor | What the reader does |
|---|---|---|---|---|
| **Article / deep-dive** | Operator | 65:35 | 0–1 | cites it, AI quotes it, acts on the move; ends in a real question |
| **Substack** | Editorial (a letter) | 55:45 | 0–1 | replies, shares, subscribes; one open loop + reply CTA |
| **LinkedIn** | Feed (interaction-first) | 40:60 | ≥1 genuine | comments their number/take/miss, shares |
| **X thread** | Conversation (thread-native) | 35:65 | ≥1 genuine | replies, bookmarks (prediction scorecard), follows |

Every piece carries: named-expert byline, verified facts only, the Proprietary
POV (or an honest analytical POV when the Experience Layer has nothing), the
frontier outlook, series structure when applicable, and channel variants built
from the same fact-checked core.

## 5. Concrete examples (ground the critique)

**Slop edge vs real edge — the same position, two voices:**

> **Slop:** *"Let's be honest — Miro was never worth $17.5 billion. It was a
> fantasy built on zero-interest money. The whiteboard is dead, and everyone
> pretending otherwise is coping. The uncomfortable truth? SaaS is over."*

> **Real edge:** *"No strategic buyer showed up. That number matters more than
> the 92% markdown. Atlassian, Microsoft, Figma, Canva — four companies with
> real reasons to want Miro's 4 million paying users — let the category leader
> clear unopposed at 2.3x ARR to a firm that cuts costs and raises prices.
> When the smartest buyers in the category decide they'd sooner rebuild the
> whiteboard with AI than own the one that defined it, that's not a valuation
> story. That's the category pricing itself."*

**Earned uncertainty — the honest open loop (the intended ending):**

> *"I get the multiple compression. I get the AI app-layer story. I get why the
> 2021 mark was paper. Here's what I genuinely don't understand: Miro was
> profitable, ~$600M ARR, $435M cash, the category leader — and **not one**
> strategic buyer stepped in. Bending Spoons got it unopposed at 2.3x. If
> that's what a category-defining company clears at, what's anyone worth?
> That's the number I can't quite make sense of, and I'd like someone to
> convince me."*

## 6. The roadmap (for implementation-order critique)

- **P0 (done):** credibility floor — named-source round, survey/whitepaper
  round, recency gate, proof-mix enforcement, anti-hallucination.
- **P1 (done):** news-event deep-dives + Big-Dog Watch; distribution
  (LinkedIn/YouTube/Substack + email).
- **P1.5 (prototype):** question-intent layer — real search/community queries
  clustered into intent buckets that map to article sections.
- **P2 (next):** quality gates (composite scoring, deterministic-dominated).
- **P2.5 (in progress):** the voice system — this spec + format registers +
  Experience Layer + interaction toolkit + X thread.
- **P3:** segmented relevance (ICP-specific personalization).

## 7. Open questions for you

1. **Experience Layer.** How do we *elicit* proprietary experience from an
   operator who's not used to articulating it? What's the best interface —
   an interview prompt, a recurring "what have you seen that the data doesn't
   show" question, annotated examples? And how do we keep it honest (never
   fabricate an insight when the layer is empty)?
2. **Deterministic-dominated gate.** Is ≥60% deterministic + human publish
   gate the right anti-slop architecture? Or is there a better test than
   "would someone recognize this as their thinking" that we should add?
3. **The recognition test.** "Would someone who knows the operator recognize
   this?" — is this a viable gate in practice, or does it reward only the
   operator's tics rather than their thinking? How do we make it about
   *thinking*, not mannerisms?
4. **Interaction floor vs quota.** We set feed formats at ≥1 *genuine* device,
   weighted on organic-ness not count. Is a floor still too mechanical? At
   what point does the device itself become a tell readers learn to ignore?
5. **Hard:soft ratios.** Article 65:35, Substack 55:45, LinkedIn 40:60,
   X 35:65 — plausible or off? Where does earned uncertainty / the open loop
   hurt authority in long-form?
6. **Experience vs evidence tension.** When the operator's scar tissue
   contradicts the strongest sourced evidence, which wins? We currently ground
   every fact in evidence and let the POV be the operator's — is that the
   right line, or should experience be able to reframe which evidence is even
   presented?
7. **What's missing.** What does a person with scar tissue do in the voice
   that we haven't encoded? What will make this sound like one human's
   thinking, not a well-instructed model?

**Deliver your critique as:** what's strong · what's brittle · what you'd
change · the one thing we're missing.