# GTM-360 Voice System (v1.2.1)

> The single source of truth for how GTM-360 content sounds. Brand identity →
> base voice → Experience Layer → format registers → interaction toolkit →
> ban lists → scoring → feedback. This is the **base case**; it evolves as we
> learn. Every change gets a changelog entry here, not a rewrite of the
> philosophy.

**Status:** LOCKED v1.2.1 · **Date:** 2026-09-15
**Scope:** Content Engine output across Article/deep-dive, Substack, LinkedIn, X.
**Canonical inputs:** `website/src/branding/TONE_AND_POV_CANON.md` (brand
identity) + `HUMAN_VOICE` block in `apps/api/src/agents/writer.ts` + this spec.
This doc is authoritative; the code constants are derived from it.

---

## Changelog

| Version | Date | Change |
|---|---|---|
| v1.0 | 2026-09-15 | Base case: brand identity wired in, base voice v2, 4 format registers, interaction toolkit, composite scoring model. |
| v1.1 | 2026-09-15 | Review feedback folded in: **Experience Layer (Proprietary POV)** as a first-class pipeline stage · interaction tools split from edge-authenticity (presence gate vs quality dimension) · composite gate reweighted (deterministic ≥60%, subjective = tiebreaker) + human publish-gate question · **so-what demand gate** after spec-building · **freshness decay** (60–90 day check) · **post-publish tuning loop** (weights vs real engagement data after ~30–50 pieces) · "original" defined operationally · edge-moment hard limit in writer brief · whitepaper door left open. |
| v1.2 | 2026-09-15 | Second external review folded in (`docs/EXTERNAL_REVIEW_v1.1.md`): **scoped certainty** added to the base voice (state the number, then the boundary where it stops being true) · **changed-mind voice pattern** added — the chronological flip ("I used to believe X, then I watched it fail, now I believe Y") is now a first-class voice pattern wired to the Experience Layer's `changed_mind` field · **hard redefined per register** — long-form hard = sourced evidence + citation density; feed hard = claim specificity + named detail + stakes; feed ratios moved (LinkedIn 45:55, X 40:60) · **interaction floor relaxed to "≥1 genuine device OR a genuinely disputable central claim"** · **human publish gate upgraded to claim-confirmation** — two mandatory questions, "would you defend this claim without a citation" (thinking test) + "would this change what the reader does next" (actionability test), answered against the 2–3 original moves the engine believes it made · **experience may reframe which evidence matters** (demote/contextualize a source, stating so) and must *present the tension* when scar tissue contradicts a published fact — never resolve silently · composite gate caveat recorded: deterministic checks filter *tells*, the anti-slop wall is the human gate. |
| v1.2.1 | 2026-09-15 | Operator calibration run (the Miro reset piece): **earned uncertainty is a feeling, not a checklist** — "what would have to be true" as a bulleted verification list is TESTING, not puzzlement; real uncertainty ends in ONE variable stated as confusion · **steelman varies, never a fixed objection→concede→survives three-beat** (a predictable section shape is a machine tell) · **no meta-defensiveness** — "I cannot verify / as far as I can tell / reportedly / if accurate" undercutting a supported claim or the author's POV reads as apology; scoped certainty, never caveat-stacking (banned: `defensive_hedge` category, counted in the composite). Also: extraction robustness — an evidence table that comes back empty starves the fact-check, which then flags every claim and produces defensively hedged prose (this was the root cause of the defensive run). |

---

## 1. Brand identity (non-negotiable)

From `TONE_AND_POV_CANON.md` — operators, not gurus.

- **We are:** operators who have sat in the seat. Calm, structured thinkers at
  inflection points. Outside perspective that respects internal competence.
- **We are not:** gurus, tool vendors, AI evangelists, efficiency consultants,
  "growth hackers".
- **The customer is the hero.** We are the mirror, the system, the outside
  judgment. Copy that makes GTM-360 look smarter than the customer **fails**;
  copy that makes the customer feel smarter **passes**.
- **No scare tactics.** "Broken / failing / bleeding / chaos / disaster"
  banned. Allowed: "stalled", "straining", "noise creeping in", "quiet
  stalls", "feels harder than it should".
- **AI is infrastructure, never the headline.** Say "signals, evidence,
  judgment, decision support". Never "AI-powered growth", "autonomous
  revenue", "let AI run it". The operator diagnoses and designs; the system
  executes; the human confirms every move.
- **Core belief:** growth doesn't stall from lack of effort — it stalls
  because the way growth decisions get made hasn't evolved with scale.
- **CTA = next steps, not conversions.** "Start here", "Have a conversation",
  "See how we work". Never "Book a demo", "Unlock growth", "Get started now"
  (product CTAs only where they are genuinely the next step).
- **The customer is never "doing it wrong".** We say "what worked earlier
  starts to strain", "the operating model hasn't caught up yet" — never "you
  lack strategy" or "you need education".

---

## 2. The base voice (holds in every format)

The constants that are true everywhere. Derived from `HUMAN_VOICE` + the design
conversation. Anti-hallucination is absolute: **voice never invents a fact.**
All specificity comes from the evidence or the Experience Layer (section 3).

### 2a. The constants

1. **Specific over vague.** Name the actual number, the actual company, the
   actual trade-off. "Reps in low-potential territories are set up to fail
   regardless of skill" beats "Territory design impacts performance."
2. **Vary rhythm.** A long observation, then a short punch. Machines write in
   uniform rhythm; humans breathe.
3. **Show tension and stakes.** Concrete stakes ("your best rep quits") beat
   abstract ones ("retention matters").
4. **Have a POV; take sides.** "Both camps are wrong" is human; "there are
   different perspectives" is machine. Every strong claim gets a *because* and
   a named detail.
5. **Include the gotcha / trade-off.** A person who's done it knows where it
   breaks. Say "here's where this falls apart".
6. **Scoped certainty (v1.2).** State the number firmly, then give the boundary
   of where it stops being true. "2.3x ARR — in a market with exactly one
   buyer." The boundary is a hard-intel feature, not hedging; cowardice hedges,
   operators scope-limit.
7. **First-person judgment only when earned** — from the evidence *or* from a
   recorded Experience-Layer item (section 3), never from a fabricated
   personal story.

### 2b. Edge-authenticity (real edge, not slop edge)

- **No meta-labeling.** No "Let's be brutally honest", "Contrarian take:",
  "Hot take:", "The uncomfortable truth nobody wants to say". The content
  being edgy **is** the edge; announcing it is the tell.
- **No performative hotness.** No "X is dead", "The whiteboard is over" —
  big declaration, thin mechanism.
- **Prefer understatement for the biggest claims.** "It's worth noting no
  strategic buyer showed up" is more damning than "Miro is dead".
- **Edge is earned, not performed.** Specificity before opinion; stakes, not
  takes; **ONE earned edge moment per piece — hard limit.** The writer brief
  states it as a constraint, not an aspiration: "ONE edge moment max, earned
  via mechanism, never announced. Flag any attempt to perform multiple." The
  editor's ban-list pass enforces it.
- **A trace of the author.** One specific, off-beat detail or admission a
  formula couldn't have generated.

### 2c. Earned uncertainty (curious expert, not know-it-all)

- **Confidence on facts, curiosity on meaning.** State the numbers firmly;
  be genuinely puzzled about the interpretation. Hedging facts reads weak;
  certain interpretation reads preachy.
- **Open uncertainty invites participation; closed certainty ends the
  conversation.** A genuine puzzle creates a curiosity gap the reader
  scratches by commenting.
- **The puzzlement must be earned.** First show you've done the homework
  ("I get the comps. I get the markdown. What I genuinely don't understand
  is…"). Never lazy ignorance.
- **One honest open loop per piece, at the interpretation level, never the
  facts.** Not a fake rhetorical question — one genuine unresolved puzzle.
- **Uncertainty is a feeling, not a checklist (v1.2.1).** "What would have
  to be true" as a bulleted verification list is TESTING, not puzzlement —
  an audit trail, not curiosity. End in the ONE variable you can't settle,
  stated as confusion: *"The part I genuinely can't make sense of is
  whether one exit actually shifts buyer behavior, or whether this is
  cap-table pressure wearing a market-narrative costume."*
- **No meta-defensiveness (v1.2.1).** "I cannot verify this", "as far as I
  can tell", "reportedly", "if that number is accurate" — used to undercut
  a supported claim or to hedge your own POV — reads as apology, not rigor.
  State the fact confidently, then scope-limit where it stops being true.

### 2d. Experience hook (relatable ≠ generic)

- Recognition → identification → comment. The reader comments when content
  names their lived experience.
- **Specifically recognizable**, never generic. "If you've had a board
  meeting where you stopped believing your own valuation" — not "leaders
  sometimes struggle with valuation".
- Person before abstraction; a real situation, not a category.

### 2e. The changed-mind voice pattern (v1.2 — the strongest anti-slop defense)

- **The chronological flip:** "In 2021 I wrote that X. Three portfolio
  companies later, I watched X fail the same way each time. Here's what I got
  wrong." This is the most human pattern in the spec and the one a model
  cannot fake — a model has no past to change from.
- **Wired to the Experience Layer:** every `changed_mind` entry (§3a) is a
  candidate for this pattern. It must carry a *mechanism and a timeframe*
  (what you believed, what happened, what you believe now) — never a bare
  "I used to think differently."
- **It is self-correction on record**: the strongest recognition signal and
  the highest-trust interaction device available. When the layer has a genuine
  flip, prefer it over a bolted-on device.
- **Hard constraint:** never fabricate the flip. If the layer has no
  `changed_mind` entry for this topic, the pattern is unavailable.

---

## 3. The Experience Layer (Proprietary POV — the moat)

> This is the single most important upgrade over v1.0. Research discovers what
> is publicly knowable; scar tissue knows what isn't.

**The distinction that matters:**
- *Research can discover:* "Companies with X characteristic tend to experience
  Y."
- *Scar tissue says:* "I've watched this happen three times. The official
  explanation was X. The actual failure happened six weeks earlier, when
  nobody owned Y."

### 3a. What the layer holds

Curated, per-operator (or per-brand), and **deliberately maintained**:

- personal observations and recurring patterns
- mistakes made and decisions made
- counterexamples ("everyone says X, but the room I was in did Y")
- things initially believed and later changed one's mind about
- "this is what actually happens inside the room" knowledge
- unsentimental explanations that differ from the public narrative

### 3b. How it's used

The engine asks **one explicit question each run**, at the synthesis stage:

> "Do we have an experience-based observation that changes the interpretation
> of this evidence? If yes, use it (it is the proprietary POV). If no, say so
> and do not fabricate one."

**No fabricated experience.** If the layer has nothing on this topic, the
engine writes from evidence alone and says the POV is analytical. Honesty
about the absence is the same rule as honest gap-reporting.

### 3c. The Proprietary POV object

Before drafting, the engine produces a **Proprietary POV** that answers:

1. *What does GTM-360 believe about this that isn't obvious from the sources?*
2. *What would we still believe if every cited article disappeared tomorrow?*

This object is the intellectual asset every format is generated from. It also
operationalizes the ">50% original" rule: **"original" means new synthesis, a
new question map, a new execution layer, or a new reported detail not in the
source.** A rewrite of McKinsey's findings into our voice at 55% originality
is still thin — the editor verifies the piece contains at least one of those
four original moves, not just paraphrasing.

---

## 4. Hard & soft intelligence (the calibration axis)

Two distinct intelligences, calibrated per format:

- **Hard intelligence** = evidence, authority, specificity.
- **Soft intelligence** = relatability, emotion, invitation. Stakes, earned
  uncertainty, interaction devices, the reader's identity and experience.

**"Hard" is defined per register (v1.2):**
- **Long-form hard** = sourced evidence + citation density + proof mix.
- **Feed hard** = claim specificity + named detail + stakes. The feed formats
  are NOT soft-leaning; their hard intel is just a different kind — "four
  companies let the category leader clear unopposed" is hard, not soft.

Rules:
- Every piece needs **both**; the ratio is per format (section 5).
- Research always gathers both (named-company proof **and** expert voices
  that connect emotionally) — never only one.
- Getting it backwards breaks it: hedging facts reads weak/sloppy; certain
  interpretation reads preachy.
- **The ratios are hypotheses, not law.** They are tuned against real
  engagement data in the feedback loop (section 10).

---

## 5. Format registers (the adaptation layer)

Same POV, different distance. Each register has an **interaction floor** and a
**hard:soft calibration**.

| Format | Register | Hard:soft | Interaction floor | Allowed devices |
|---|---|---|---|---|
| Article / deep-dive | Operator | 65:35 | 0–1 | earned puzzlement, one real closing question, steelman |
| Substack / newsletter | Editorial | 55:45 | 0–1 | open loop + reply CTA, direct address |
| LinkedIn | Feed | 45:55 | ≥1 (genuine) **or disputable claim** | take-a-side, number exchange, provocation hook, prediction, open loop |
| X thread | Conversation | 40:60 | ≥1 (genuine) **or disputable claim** | take-a-side, number exchange, prediction, open loop, thread-native cliffhangers |
| Instagram / Reels | (deferred) | — | — | placeholder — no design work yet |

**The interaction floor is a floor, not a quota.** Feed formats require **at
least one genuine interaction device OR a central claim that is genuinely
disputable** (v1.2). The gate weighs *whether the device is organic to the
argument* over *how many there are*, and it prefers a piece with **zero**
devices that grows out of a disputable claim over one with a bolted-on
trigger. The editor flags devices that feel decorative (see 6d). The strongest
engagement usually comes from the insight itself creating disagreement —
interaction devices are scaffolding, never the goal.

**Article / deep-dive (Operator):** complete, citable, provable. Lead with
the answer to THE QUESTION IT ANSWERS, dense with named entities and numbers
(these get quoted by readers and AI search). Ends in a real question.
Provenance everywhere — dated citations ("McKinsey *State of AI*, March
2026") as a design element, not buried.

**Substack (Editorial):** a letter, not a brochure. Personal direct address,
why this matters to the reader today. Preserves the article's depth but
tightens what drags. One open loop, one reply CTA. Signed by a named author.

**LinkedIn (Feed):** an interaction-first rewrite, not a reflow. ONE core idea
stated in the first two lines. Short punchy lines, heavy line breaks. 2–3 max
concrete proof points (real stat, real named company, real quote). Hook →
insight → proof → a forward-looking point → a light CTA/question that invites
comments. No hashtag spam (max 3), no clickbait, no "X is dead".

**X thread (Conversation):** thread-native. First tweet earns the open; each
subsequent tweet is one scannable unit; a cliffhanger or open loop invites the
reply; number exchange ("what's your threshold?") invites engagement. Authored
by the named expert.

> **Whitepaper note (v1.1):** the original decision was "no whitepaper." That
> is now **soft**: if an Article + Substack piece would clearly work better as
> a downloadable, evergreen, citable document, write it. Substack is intimate
> and time-bound; a document is discoverable and evergreen. Keep the option
> open rather than committing to the format.

---

## 6. Interaction devices & edge quality (now two different things)

v1.0 lumped these together. v1.1 splits them, because they're different
muscles:

- **Interaction devices** are *structural choices* — what you ask at the end,
  the hook you use, the loop you leave open. They are checkable: present or
  absent. **They are a presence gate** (binary per format, section 5).
- **Edge-authenticity** is *voice and substance* — whether the edge is earned.
  A piece can have perfect device placement and still have slop edge. **It is
  a quality dimension** with a separate, heavier weight in the composite
  (section 9).

### 6a. Interaction devices (the toolkit)

1. **Relatable experience hook** — names the reader's lived experience.
2. **Earned uncertainty / honest open loop** — one genuine puzzle at the
   interpretation level.
3. **Take-a-side** — a defensible position people will argue with.
4. **Number exchange** — "Miro cleared 2.3x ARR. What's the multiple where
   *you* sell?" People answer with *their* number.
5. **Steelman the other side** — invite both camps into the thread.
6. **Prediction with a scorecard** — "By Q2 2027, X will have happened."
7. **"I was wrong"** — self-correction; the strongest likability lever.
8. **Named enemy (an idea, never a person)** — the VC who priced the mark,
   the AI-hype machine. Attack behaviors, not people.
9. **Normalizing** — "if you're wondering whether your 2021 valuation is
   paper: everyone is."
10. **Insider references** — something only the niche audience knows.

### 6b. Presence rules

- Feed formats (LinkedIn/X): **≥1 genuine device OR a genuinely disputable
  central claim (v1.2).** Absence of both fails the gate; presence alone does
  not pass it (organic-ness checked below).
- Long-form (Article/Substack): 0–1, optional.
- **No device is ever decorative.** If it can't grow out of the argument's
  actual tension, cut it. Form without substance = bait. A piece whose central
  claim is genuinely disputable needs no device at all.

### 6c. Edge-authenticity (the quality dimension)

As defined in 2b — earned, specific, understated, one moment max, never
announced. Scored separately (0–1), weighted heavily for feed formats,
enforced by the editor's ban-list + edge-moment pass.

### 6d. Editor flag: decorative mechanics

The editor's human-voice review adds a check: **"Does every interaction device
or edge moment feel like it grew out of the argument, or is it bolted on?"**
Flag anything that reads as a trigger placed for the gate rather than a
natural consequence of the claim. This is the guard against
gate-shaped-content.

---

## 7. Ban lists (universal, deterministic, checkable)

### 7a. Machine tells
- "in today's fast-paced world", "it's important to note"
- delve, unlock, seamless, leverage, elevate, game-changer
- "landscape" as filler
- "at its core", "the deeper issue", "the heart of the matter",
  "X is the Y of Z", "the currency of", "the language of"
- "Let's dive in", "Let's explore", "Here's what you need to know",
  "To be clear", "Don't get me wrong", "Honestly, …", "Look, …", "The thing is"
- "Read that again", "Let that sink in", "That's the real win"
- "it's also possible", "might arguably", "could potentially", "to be fair"

### 7b. AI-edge-slop tells
- "Let's be brutally honest", "Contrarian take:", "Hot take:",
  "Unpopular opinion", "The uncomfortable truth nobody wants to say"
- "X is dead", "X is over", "X is broken" (without mechanism)
- The "It's not X, it's Y" contrast formula and its split form
  ("This does not mean X. It means Y.") — unless it corrects a belief the
  reader actually holds

### 7c. Structure tells
- Em-dash stacking (one is fine; a text full of them is machine rhythm)
- Forced triads (three items only when meaning truly needs three)
- Robotic parallelism (every section the same shape)
- Uniform sentence rhythm
- One-line closers at the end of every section
- **The fixed steelman three-beat (v1.2.1):** objection → concession →
  "here's why the thesis survives" — predictable section shape is a machine
  tell; vary it, sometimes leave the hole open
- **Verification-checklist uncertainty (v1.2.1):** "what would have to be
  true" as bullets — testing, not puzzlement

### 7d. Brand violations
- Scare-tactic words (broken/failing/bleeding/chaos/disaster) for the
  customer's situation
- "You're doing it wrong", "you lack strategy", "you need education"
- "AI-powered growth", "autonomous revenue", "AI-driven magic"
- "Book a demo", "Unlock growth", "Optimize your revenue"

### 7e. Anti-hallucination
- Never fake a statistic, quote, company, or personal anecdote
- All specificity comes from the dossier **or the Experience Layer**; analysis/
  POV is the author's and needs no source; fabricated facts are removed
- Honest gap reporting when proof can't be found — never paper over it
- Honest absence in the Experience Layer — never fabricate an operator insight

---

## 8. The pipeline (v1.1 — Proprietary POV as a first-class stage)

```
Question → Research → Evidence → Synthesis → Proprietary POV
  → So-what gate → Draft → Format → Editor → Publish gate → Ship
```

1. **Question** — real demand (search + community signal); question-intent
   clustering (P1.5 prototype).
2. **Research** — grounded, proof-mix hunted (named companies, expert quotes,
   stats), recency-gated.
3. **Evidence** — the verified table; provenance + proof_type tagged.
4. **Synthesis** — the connection nobody made; ≥1 claim not traceable to any
   single source (while every *fact* stays sourced).
5. **Proprietary POV** — the Experience Layer question (section 3). Answers:
   *"What do we believe that isn't obvious from the sources?"* If the layer
   has nothing, it says so — analytically-voiced piece. **v1.2: experience
   may also reframe which evidence matters** (demote/contextualize a source,
   stating that it did so) and **when scar tissue contradicts a published
   fact, the engine presents the tension** — "the data says X; I've watched
   the data measure the wrong thing three times" — never resolves it silently.
6. **So-what gate** — *is this question actually burning right now?* Checked
   against search volume + community signal from the question layer. **If the
   demand is cold, kill or steer before the writer spends words** (operator
   override allowed — the operator may know something the data doesn't).
7. **Draft** — writer, base voice v2 + register envelope + ONE edge moment +
   the Proprietary POV woven in.
8. **Format** — register adaptation (section 5).
9. **Editor** — fact-vs-analysis classification, anti-hallucination, ban-list
   pass, decorative-mechanic flag, proof-mix coverage, composite score
   (section 9).
10. **Publish gate (human)** — claim-confirmation, not a vibe check (v1.2).
    The operator sees the draft against the deterministic checks + the 2–3
    **original moves** the engine believes it made (new synthesis / new
    question map / new execution layer / new reported detail), and answers
    **two mandatory questions**:
    - *(a) the thinking test:* "Is there a claim here you'd defend in a
      meeting that you couldn't find in any source?"
    - *(b) the actionability test:* "Would this change what the reader does
      next?"
    A piece that is recognizable-but-inert (passes nothing on either) is the
    slop failure mode — kill or revise. This is the anti-slop firewall.
11. **Ship** → measure (section 10).

---

## 9. Composite scoring model (the hard gate, reweighted)

No brittle checklist. A **weighted composite score** per piece; a piece may
fail individual dimensions and still pass when other strengths compensate.
**v1.1 change: the score is dominated by deterministic checks, with subjective
scoring as tiebreaker only.**

### Weighting principle: deterministic ≥60%

- **Deterministic dimensions (≥60% of the score, machine-checkable):**
  evidence grounding (all claims trace to dossier/Experience Layer) ·
  proof-mix coverage (count) · ban-list violations (pattern match) ·
  interaction-device presence per format (binary) **or, for feed formats,
  a genuinely disputable central claim** (v1.2) · **at least one of the four
  original moves present** (new synthesis / new question map / new execution
  layer / new reported detail — v1.2) · so-what (the gate ran and the demand
  signal is fresh) · structure/register compliance ·
  freshness of sources (recency gate).
- **Subjective dimensions (≤40%, tiebreaker only):** edge-authenticity ·
  earned uncertainty · human-voice quality · experience-hook quality ·
  changed-mind strength (v1.2) · gotcha/trade-off strength. These are scored
  by the LLM judge but cannot, by themselves, push a piece over the line.

### The caveat (v1.2, recorded)

The deterministic checks filter *tells*, not *slop*: ban-list pattern matches
and device presence are satisfiable by any model that has seen the list. The
composite is a **reject filter**, not a ranker — and the actual anti-slop wall
is the human publish gate (§8 step 10), whose two claim-confirmation questions
are what "recognizable as the operator's thinking" actually means operationally.

### The gate

- **Hard pass = composite ≥ 0.75, with the deterministic share ≥0.45 on its
  own.** A piece that nails every subjective dimension but fails the
  deterministic checks does not pass.
- **Weights are per-format.** Feed formats: interaction-device presence +
  edge-authenticity + experience-hook carry the weight. Long-form: synthesis +
  so-what + earned-uncertainty carry the weight.
- **Human publish gate is the final layer** (section 8 step 10) — the one
  score the LLM never issues.

### Why not a separate judge model?

A second LLM judge still reads the same rubric and still doesn't know the
operator — it's a costlier version of the same bias. The v1.1 answer instead:
deterministic checks dominate the score, the human publish gate carries the
"recognizable as the operator's thinking" test, and real engagement data tunes
the weights. The only judge who knows the operator is the operator.

---

## 10. Feedback loop (post-publish tuning)

The composite weights and hard:soft ratios are **hypotheses until data says
otherwise.**

### 10a. What to measure per piece
- **Engagement:** comments (are interaction devices working?), shares, the
  ratio of "I was thinking the same thing" vs "you got this wrong" replies
  (edge-authenticity vs slop edge).
- **Citations:** AI-search and reader citations (proof-mix and named-entity
  density working or not).
- **Freshness:** which pieces age well vs become dated fast.
- **Boring-correction:** when a piece is strong on every dimension but
  generates nothing — note it; no interaction device can save an
  uninteresting claim, and the cause usually traces back to the so-what gate
  or the Proprietary POV stage, not the voice.

### 10b. The tuning loop
- After **~30–50 pieces**, compare the actual outcome data against the
  per-format weights and ratios.
- Example: if the highest-engagement LinkedIn posts are 50:50 (not 40:60),
  change the spec and log it in the changelog.
- Hard:soft ratios, interaction floors, and dimension weights are data, not
  dogma.

### 10c. Scar-tissue calibration (the Experience Layer's starter set)
To seed the Experience Layer, take 3 pieces from a real operator and annotate
"this sentence is scar tissue because ___." Extract the patterns — specificity
of trade-off, naming a cost nobody wants to admit, casual pessimism about what
breaks, unsentimental explanations. Those patterns become the layer's first
entries and the annotation template for future calibration.

---

## 11. Freshness & the refresh rule

- Content with dated references (stats, news, events) gets a **freshness
  check 60–90 days post-publish.**
- **If the core claim still holds** → refresh the proof (re-run research,
  update stats, re-publish; the engine's Refresh loop already exists).
- **If the claim is now stale** → archive and retire, don't quietly republish.
- Freshness is a citable-asset property (48% of AI citations are <3 months
  old), so it's a first-class lifecycle, not a maintenance afterthought.

---

## 12. The output contract (what the reader does)

- **Article/deep-dive:** reader cites it, AI search quotes it, reader acts on
  the move. Ends with a real question.
- **Substack:** reader replies, shares, subscribes.
- **LinkedIn:** reader comments (adds their number, their take, their miss),
  shares.
- **X thread:** reader replies, bookmarks (prediction scorecard), follows.

Every piece: named-expert authorship, verified facts only, the Proprietary
POV or an honest analytical POV, the frontier outlook, series structure when
applicable, and channel-ready variants — all built from the same fact-checked
core.

---

## 13. How this is enforced

1. **POV stage** — a dedicated pipeline step (before Draft) fetches matching
   Experience-Layer entries, asks the one question, and produces the
   Proprietary POV object (or honestly says the POV is analytical).
2. **So-what gate** — runs after spec-building, before the writer (section 8
   step 6); kill/steer on cold demand, operator override allowed.
3. **Spec builder** — carries the register + interaction-floor requirements
   and THE QUESTION IT ANSWERS into the writer brief.
4. **Writer** — system prompt injects brand identity + base voice v2 +
   scoped certainty + the changed-mind pattern (when available) + the register
   envelope for the target format + the **ONE edge moment** hard constraint +
   the Proprietary POV object.
5. **Editor** — composite gate (deterministic-dominated), fact-vs-analysis
   classification, anti-slop ban lists, decorative-mechanic flag, proof-mix
   coverage, original-move presence, human-voice review.
6. **Publish gate** — the operator's two claim-confirmation questions
   (thinking test + actionability test) against the engine's original moves.
7. **Distribute** — register envelopes (hard:soft per format); adds the X
   thread variant; Reels deferred.

## 14. Evolution rule

This is data, not dogma. When a real piece's composite score is tuned, the
weight/threshold change lands here with a changelog entry. The Miro/Bending
Spoons deep-dive is the calibration run. The first 30–50 shipped pieces
produce the data that rewrites sections 4, 5, and 9.