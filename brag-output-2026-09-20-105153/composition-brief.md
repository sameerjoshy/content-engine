# Hyperframes Composition Brief: GTM-360 Content Engine

## Objective
Create a short launch-style brag video for GTM-360 — the Revenue Operating System.

## Output
- Composition directory: `composition/`
- Rendered video: `brag.mp4`
- Format: landscape — 1920x1080
- Duration: 18 seconds

## Source Material
- Project root: D:\GTM-Engine\content-engine
- Primary files read: `apps/web/index.html` (SEO/meta + FAQ), `apps/web/src/screens/Showcase.tsx` (hero/products/engine/outcomes), `apps/web/src/styles.css` (palette), `packages/agent-registry/src/groups.ts` (6 outcome groups + colors)
- Product name: GTM-360
- Tagline / strongest claim: "One engine. Six outcomes."
- Key UI or visual moment to recreate: the Showcase hero — dark ink + emerald radial glow, "One engine. Six outcomes." with the #34d399→#2dd4bf text-gradient, stat chips (6 products · 25 agents · 6 outcome groups)
- Copy that must appear verbatim:
  - "One engine. Six outcomes."
  - "The Revenue Operating System"
  - "Stop building a GTM machine by hand."
  - The 6 group verbs: Know where we are / Decide what to do / Produce the assets / Move the pipeline / Keep and grow the book / Run on trustworthy numbers

## Creative Direction
- Tone preset: polished
- Creative direction: "enterprise product-family reveal — quiet premium, the engine is the hero"
- Interpretation: restraint as the creative choice. 4 scenes, slow confident reveals, soft crossfades, generous letter-spacing, light-to-medium type weight. Serious, elegant, credible. The system assembling itself, not shouting.
- Angle: one engine behind six products — 25 agents in 6 outcome groups running one operating loop.
- Hook: "The Revenue Operating System" eyebrow → "One engine. Six outcomes." on dark ink with emerald glow.
- Outro / punchline: CTA band gradient → "Stop building a GTM machine by hand." → GTM-360 wordmark + "The Revenue Operating System."
- Avoid:
  - Generic SaaS language ("Streamline your workflow", "elevate", "unlock")
  - Abstract filler visuals, waveform/equalizer graphics
  - Hype, "AI magic" claims — operators, not gurus
  - Over-crowding a scene with text past the reading-time floor

## Visual Identity
- Background: #050b0a (dark scenes) · #f7faf9 (proof scene) · CTA gradient #0f766e→#052e22 (outro card)
- Text: #ffffff on dark · #0f172a on light
- Accent: #34d399 emerald · text-gradient #34d399→#2dd4bf
- Display font: Inter 800 (site's own stack — brand fidelity)
- Body font: Inter 400/500
- Visual references from the project: hero shader-gradient (emerald #0f766e→#155e75→#1e293b), engine-loop cards with group colors (#7c3aed ORIENT, #2563eb PLAN, #10b981 CREATE, #d97706 SELL, #0d9488 SUSTAIN, #475569 GOVERN), light proof section (#f7faf9, white cards, #0f766e links)

## Storyboard
Use the storyboard in `brag-plan.md` as the creative contract.

Scene summary:
1. Hook — 0.0–4.0s — eyebrow + "One engine. Six outcomes." + 3 stat chips on dark ink
2. Engine loop — 4.0–9.5s — 6 group cards (ORIENT→GOVERN) appearing one by one around a loop, "25 agents in six outcome groups"
3. Proof — 9.5–14.5s — 3 proof rows on light: grounded research / fact-checked / every channel one draft
4. Outro — 14.5–18.0s — CTA band, "Stop building a GTM machine by hand." + GTM-360 wordmark + tagline

## Audio
- Audio role: warm bed, sparse professional accents — cinematic support, not a hype track
- Audio arc: quiet rise in scene 1 → system assembling in scene 2 → grounded proof in scene 3 → resolve with a single bell in scene 4, then calm
- Music: happy-beats-business-moves-vol-12-by-ende-dot-app.mp3 (copied to assets/music/)
- Music treatment: fade in at 0.2s, volume ~0.30, gentle fade under final logo
- Music cue guidance: bundled preset read (vol-12, ~110 BPM). Strong cues: 8.74s (loop completes), 13.11s (proof), 17.47s/18.56s (outro land). Beat grid ~0.55s — for readable text snap to every other beat (≥1.1s).
- Audio-reactive treatment: subtle — music RMS/bass may breathe the hero glow and card presence; no waveform/equalizer visuals
- Audio-coupled moments: hero title slam (impactSoft), stat chips (click ticks), six cards arriving one-by-one (drop per card), proof rows (drop), logo land (one bell)
- SFX selection guidance: low high-frequency-risk files for repeated moments; restraint over density
- Exact SFX choice: Hyperframes to choose filenames/timestamps/volume from assets/sfx/ — impactSoft_medium_001 (title), click_001 (chips), drop_001 (cards + proof), impactBell_heavy_000 (logo)
- Audio files: music + selected SFX copied into composition/assets/

## Hyperframes Instructions
Build a polished 18s landscape launch video. Key requirements:
- Show at least one real UI element from the source: recreate the "One engine. Six outcomes." hero with the emerald gradient text + stat chips, and the six outcome-group cards with their exact colors.
- Keep all text readable in the final render (0.8s floor for short lines, ~0.3s/word for sentences; fast-in then hold).
- Keep the video within 15–25 seconds (target 18s).
- Include the planned music/SFX layer.
- Use music cue metadata as optional timing hints; never hurt readability for a beat.
- Beat-lock at most 1–3 major moments (loop completes ~8.7s, logo land ~17.5s).
- For sequential text (cards, proof rows), snap to every other beat or reveal and hold — never outrun reading.
- Honor the fade-under-logo music treatment.
- Use local assets for audio (relative paths — no absolute paths).
- Run `npx hyperframes check` before render — it is brag's single gate.

## Notes from the implemented composition
Implemented in `index.html` as 4 nested clips (scene1 0–4s, scene2 4–9.5s, scene3 9.5–14.5s, scene4 14.5–18s) with a single paused GSAP timeline on `window.__timelines['main']`. Music at volume 0.30; SFX: impactSoft at 1.6s, click×3 (2.8/3.2/3.6), drop×6 (4.9→8.9s stagger), drop×3 (10/11.1/12.2), bell at 17.3s. `npx hyperframes check` passed: 0 errors, contrast 38/38 WCAG AA.