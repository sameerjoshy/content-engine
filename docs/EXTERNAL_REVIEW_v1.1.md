# External Review — Voice System v1.1

> Response to the open questions in `docs/context.md`. Reads against
> `VOICE_SYSTEM.md` v1.1 and the Miro/Bending Spoons examples.
> Format: what's strong · what's brittle · what I'd change · the one thing
> missing.

---

## What's strong

- **The Experience Layer is the right moat, and "honest absence" is the rule
  that keeps it honest.** An empty layer that says so writes a better piece
  than a fabricated insight. The one-question-per-run discipline
  ("do we have an experience-based observation that changes the
  interpretation?") is the correct cost — one question, not a system to game.
- **Confidence on facts, curiosity on meaning** is the single most load-bearing
  idea in the spec. It cleanly resolves the tension most engines drown in, and
  the flip ("hedge facts / certain interpretation") is exactly how AI slop
  reads. This is the one rule that will save you the most times.
- **The deterministic-dominated gate + human publish gate is the right
  architecture** — better than a judge model for the stated reason (the judge
  still doesn't know the operator). "Real edge is substance, slop edge is
  form" and "one edge moment, hard limit" are exactly right: the edge-moment
  limit is the only thing standing between you and the pattern-multiplier
  drift every LLM has.
- **Understatement for the biggest claims.** "No strategic buyer showed up" is
  the best sentence in the spec. It's a mechanism-level, specific, quiet
  sentence — and it's what makes the Miro example read human.

## What's brittle

1. **The composite score can be gamed at the deterministic layer.** ≥60%
   deterministic sounds anti-slop, but ban-list pattern matches and
   interaction-device presence are checkable *by the same model that was told
   the list*. A model that has seen the ban list will simply not emit the
   phrases and will place a device in the required slot — and it will do so
   every time. The deterministic share filters *tells*, not *slop*. The real
   anti-slop firewall is the human gate, and the current human gate is a
   yes/no vibe question.
2. **The recognition test rewards tics more than thinking.** Dash density,
   aphorism-dressing, one-line closers are all in the structure-tells ban list
   — which means the model knows them and can perform them as *signature*.
   "Would someone who knows you recognize this?" can be passed by mannerism
   alone. It's the one question slop can fake most easily.
3. **The interaction floor is still a quota in disguise.** "≥1 genuine device"
   with an organic-ness check is better than v1.0, but a feed format that has
   *no* device because its central claim is genuinely disputable will fail the
   gate — while a bolted-on "what's your number?" passes. The gate currently
   punishes the more honest piece.
4. **Hard:soft ratios are platform folklore, not data — and the feed-format
   numbers look inverted.** LinkedIn at 40:60 and X at 35:65 imply the feeds
   are soft-favored. But the feed formats' *hard* intelligence is different in
   kind from long-form's: on LinkedIn/X, hard = claim specificity + named
   detail + stakes ("four companies let the category leader clear unopposed"),
   not citation density. You're under-weighting specificity on the feeds.
5. **The ban on hedging could ban honest scope-limits.** Rule 2c says "hedging
   facts reads weak." True for *cowardice*. But real operators scope-limit
   their own numbers ("2.3x — in a market with exactly one buyer"), and that
   boundary is a hard-intel feature, not a soft tell. The rule as written will
   be read as "never hedge," which deletes the most credible sentence a person
   writes.
6. **Experience-vs-evidence tension is under-specified for the two hard
   cases.** The "facts ground, POV is yours" line handles the easy case. It
   doesn't say what happens when scar tissue *reframes which evidence matters*
   (the comps are noise because the category repriced) — or when it
   *contradicts a published fact*. Both are where the moat actually lives, and
   both are currently unhandled.

## What I'd change

1. **Make the human publish gate a claim-confirmation, not a vibe check.**
   Present the 2–3 "original moves" the engine believes it made and ask two
   questions, both mandatory: (a) *"Is there a claim here you'd defend in a
   meeting that you couldn't find in any source?"* — the thinking test, the
   Experience Layer question turned outward; and (b) *"Would this change what
   the reader does next?"* — the actionability test. Slop is inert; it changes
   nothing. Content that is recognizable-but-inert is the failure mode the
   current gate passes.
2. **Demote the interaction floor to "device OR disputable claim."** A feed
   piece passes the interaction presence check if it has ≥1 genuine device
   *or* its central claim is genuinely disputable (which the editor assesses
   in the deterministic pass). This de-mechanizes the floor while keeping its
   reject function, and it makes the honest piece with no device pass.
3. **Redefine hard/soft per register instead of just renumbering.**
   Long-form hard = sourced evidence + citation density. Feed hard = claim
   specificity + named detail + stakes. Both formats then keep the *same* POV
   with the *right* kind of hard intel. I'd move LinkedIn to 45:55 and X to
   40:60 as the starting hypothesis — but the real change is defining "hard"
   per register, not the number.
4. **Add "scoped certainty" to the base voice.** State the number firmly, then
   give the boundary of where it stops being true. This is a hard-intel
   feature, and it immunizes the spec against reading "confidence on facts" as
   overclaiming.
5. **Let experience choose the frame, not the facts.** (a) If the layer
   reframes which evidence matters, allow it to demote/contextualize a source
   — with the engine saying so. (b) If it contradicts a published fact, never
   resolve silently: *present the tension* — "the data says X; I've watched
   the data measure the wrong thing three times." Presenting the tension is
   both the honest move and a superior interaction device.
6. **Seed a `changed_mind` voice pattern in the base voice**, not just a field
   in the layer. The chronological flip ("I used to believe X, then I watched
   it fail, now I believe Y") is the most human pattern in existence and
   models can't do it without a past. Give it a home in §2 and weight it in
   the human-voice dimension.

## The one thing missing

**The operator's recorded disagreement with themselves.** Every other device
in the spec can be performed by a well-instructed model — even the earned
uncertainty, even the understatement. The one thing a model cannot fake is a
*change of mind with a mechanism and a date*: "In 2021 I wrote that X. Three
portfolio companies later, I watched X fail the same way each time. Here's
what I got wrong." That single pattern (a) is the strongest recognition signal
there is, (b) creates the highest-trust interaction device (self-correction on
record), and (c) is structurally impossible to fabricate honestly — which is
precisely why it's the best defense against "well-instructed model." Make it a
first-class voice pattern, wire it to the Experience Layer's `changed_mind`
field, and it becomes the load-bearing wall of the recognizability moat.