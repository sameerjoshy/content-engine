import type { Agent } from './types';

/**
 * Canonical agent catalog — 25 agents across the five engines (bowtie model).
 * One canonical agent per job; product twins are declared in `legacyIds`
 * and retired from active UI. See docs/AGENT_ENGINE.md.
 *
 * Every agent follows the same contract, so any surface can render any agent:
 *   inputs (what the operator gives) → 4-step chain (GATHER → VALIDATE →
 *   SYNTHESISE → VERIFY) → outputs (what the outcome delivers) → gates →
 *   handoffs (what runs next).
 */
export const AGENTS: Agent[] = [
  // ── STRATEGY · Know who to serve · decide what to do ─────────────────────────
  {
    id: 'diagnostic',
    group: 'strategy',
    name: 'Diagnostic',
    role: 'GTM Health Assessment',
    vibe: 'Surfaces the truth the team has been avoiding, with receipts.',
    status: 'live',
    source: 'crew',
    legacyIds: ['cockpit-a2-market-research'],
    whatItDoes: 'Runs the GTM-360 planning-cycle questions against live context and surfaces where the system is under strain — clarity, not a task list.',
    inputs: [
      { name: 'Company URL', format: 'URL', description: 'Scraped for independent market context' },
      { name: 'Revenue Stage', format: 'Select', description: '$0–2M / $2–10M / $10–50M / $50M+' },
      { name: 'GTM Team Size', format: 'Number', description: 'Sales + marketing + CS headcount' },
    ],
    outputs: [
      { name: 'State Summary', format: 'Structured brief', description: 'Where you are across the planning questions' },
      { name: 'Constraint Map', format: 'JSON → visual', description: 'Friction points by domain with confidence' },
    ],
    gates: [
      { gate: 'Evidence threshold', rule: 'Unscrapable sources drop confidence to low — the agent does not guess' },
      { gate: 'Contradiction check', rule: 'Conflicting signals are both surfaced, never resolved silently' },
    ],
    handoffs: [{ to: 'planning-cycle', trigger: 'auto', condition: 'State Summary always pre-fills Planning Cycle context' }],
  },
  {
    id: 'planning-cycle',
    group: 'strategy',
    name: 'Planning Cycle',
    role: 'Quarterly Operating Loop',
    vibe: 'Turns the bruises of last quarter into the focus of this one.',
    status: 'live',
    source: 'crew',
    legacyIds: ['cockpit-a1-chief-of-staff'],
    whatItDoes: 'Turns targets vs actuals into a pressure-tested retrospective and prioritized focus areas for the coming quarter.',
    inputs: [
      { name: 'Prior Targets', format: 'Text', description: 'Last quarter goals (revenue, logos, NRR…)' },
      { name: 'Prior Actuals', format: 'Text', description: 'Last quarter results' },
      { name: 'Proposed Goals', format: 'Text', description: 'Optional — pressure-tested if provided' },
    ],
    outputs: [
      { name: 'Retrospective Brief', format: 'Markdown', description: 'What happened, why, what the system learned' },
      { name: 'Focus Areas', format: 'Ranked top 3', description: 'Highest-leverage areas with evidence' },
    ],
    gates: [
      { gate: 'Sanity check', rule: 'Actuals >50% above targets flagged — outliers distort retrospectives' },
      { gate: 'Ambition gate', rule: 'Goals >2x prior actuals without rationale flagged high-risk' },
    ],
    handoffs: [{ to: 'goal-designer', trigger: 'auto', condition: 'Focus Areas feed OKR targets' }],
  },
  {
    id: 'goal-designer',
    group: 'strategy',
    name: 'Goal Designer',
    role: 'OKR & Ambition Designer',
    vibe: 'Makes targets ambitious enough to mean something.',
    status: 'live',
    source: 'compass',
    legacyIds: ['compass-confidence'],
    whatItDoes: 'Designs OKRs that are ambitious but credible — cascading targets with alignment and confidence baked in.',
    inputs: [
      { name: 'Focus Areas', format: 'Auto', description: 'From Planning Cycle' },
      { name: 'Business Context', format: 'Text', description: 'Constraints, capacity, dependencies' },
    ],
    outputs: [
      { name: 'OKR Draft', format: 'Structured tree', description: 'Cascading goals with owners and confidence' },
      { name: 'Ambition Check', format: 'Flag list', description: 'Targets that are too soft or too aggressive' },
    ],
    gates: [
      { gate: 'Ambition gate', rule: 'Targets pressure-tested against actuals before sign-off' },
    ],
    handoffs: [{ to: 'goal-integrity', trigger: 'auto', condition: 'Live OKRs feed the integrity monitor' }],
  },
  {
    id: 'goal-integrity',
    group: 'strategy',
    name: 'Goal Integrity',
    role: 'OKR Alignment & Gaming Monitor',
    vibe: 'Proves the math and flags the sandbagging.',
    status: 'live',
    source: 'compass',
    legacyIds: ['compass-alignment', 'compass-radar'],
    whatItDoes: 'Proves the math on cascaded OKRs and flags sandbagging or gaming so targets stay honest.',
    inputs: [
      { name: 'OKR Tree', format: 'Auto', description: 'Cascaded goals + targets' },
    ],
    outputs: [
      { name: 'Alignment Proof', format: 'Math check', description: 'Cascaded targets roll up correctly' },
      { name: 'Gaming Flags', format: 'Flag list', description: 'Sandbagging and target gaming detected' },
    ],
    gates: [
      { gate: 'Integrity gate', rule: 'Gamed targets flagged, never silently accepted' },
    ],
    handoffs: [{ to: 'goal-designer', trigger: 'auto', condition: 'Flags feed the next design cycle' }],
  },

  // ── MARKETING · Attract — position · ABM · content ──────────────────────────
  {
    id: 'icp-clarifier',
    group: 'marketing',
    name: 'ICP Clarifier',
    role: 'Ideal Customer Profile Sharpener',
    vibe: 'Shows you who actually buys, not who you think buys.',
    status: 'live',
    source: 'crew',
    legacyIds: [],
    whatItDoes: 'Finds the gap between who you think you sell to and who actually buys, from closed-won patterns.',
    inputs: [
      { name: 'CRM Deal Export', format: 'CSV', description: 'Company size, industry, ACV, outcome, close date' },
      { name: 'Stated ICP', format: 'Text', description: 'Your current definition, if any' },
      { name: 'Lookback Period', format: 'Select', description: '6 / 12 months / all time' },
    ],
    outputs: [
      { name: 'Actual ICP Profile', format: 'Structured card', description: 'Highest win-rate, lowest cycle-time profile' },
      { name: 'ICP Drift Report', format: 'Table', description: 'Where pipeline deviates from the real ICP' },
    ],
    gates: [
      { gate: 'Sample size gate', rule: 'Minimum 20 closed-won deals; below that patterns are marked preliminary' },
      { gate: 'Recency weighting', rule: 'Last 6 months weighted 2x — old wins may reflect a different product' },
    ],
    handoffs: [{ to: 'signals-scout', trigger: 'auto', condition: 'Sharpened ICP becomes scoring criteria' }],
  },
  {
    id: 'competitor-intel',
    group: 'marketing',
    name: 'Competitor Intel',
    role: 'Competitive Intelligence Monitor',
    vibe: 'Reads what your competitors publish so you do not have to.',
    status: 'live',
    source: 'crew',
    legacyIds: [],
    whatItDoes: 'Monitors competitors across web, news, and blogs into a structured brief with source attribution.',
    inputs: [
      { name: 'Competitor Name', format: 'Text', description: 'Company to monitor' },
      { name: 'Competitor Website', format: 'URL', description: 'For RSS + scraping' },
    ],
    outputs: [
      { name: 'Intel Brief', format: 'Structured markdown', description: 'News · hires · funding · product moves · implications' },
      { name: 'Source Attribution', format: 'Cited list', description: 'Every claim linked to its source' },
    ],
    gates: [
      { gate: 'Evidence requirement', rule: 'Every section must cite a source or say "nothing significant found"' },
    ],
    handoffs: [{ to: 'writer', trigger: 'manual', condition: 'Competitive signals that warrant a content response' }],
  },
  {
    id: 'content-radar',
    group: 'marketing',
    name: 'Content Radar',
    role: 'Content Whitespace Scanner',
    vibe: 'Finds the question nobody has answered well yet.',
    status: 'live',
    source: 'content-engine',
    legacyIds: [],
    whatItDoes: 'Scans buyer questions, trends, and contra-consensus signals into ranked, grounded content opportunities scored against what you have already published.',
    inputs: [
      { name: 'Profile', format: 'Auto', description: 'Voice + ICP + research rules' },
      { name: 'Focus', format: 'Text', description: 'Optional area to scan' },
    ],
    outputs: [
      { name: 'Opportunity Cards', format: 'Ranked list (5–7)', description: 'Topic + angle + question + archetype per opportunity' },
      { name: 'Why Now', format: 'Text', description: 'Real sources behind each recommendation' },
    ],
    gates: [
      { gate: 'Whitespace check', rule: 'Scored against the content map — never re-suggests what you already said' },
    ],
    handoffs: [{ to: 'angle-validator', trigger: 'manual', condition: 'Opportunity selected for the pipeline' }],
  },
  {
    id: 'angle-validator',
    group: 'marketing',
    name: 'Angle Validator',
    role: 'Angle Proceed / Pivot / Kill',
    vibe: 'Kills weak angles before they waste a single token.',
    status: 'live',
    source: 'content-engine',
    legacyIds: [],
    whatItDoes: 'Checks a topic + angle against existing content and the profile before anything is researched.',
    inputs: [
      { name: 'Topic', format: 'Text', description: 'What to write about' },
      { name: 'Angle', format: 'Text', description: 'The proposed point of view' },
      { name: 'Existing Content', format: 'Auto', description: 'From the content map' },
    ],
    outputs: [
      { name: 'Decision', format: 'proceed / pivot / kill', description: 'With the reasoning' },
    ],
    gates: [
      { gate: 'Overlap gate', rule: 'Kills angles already covered by the content map' },
    ],
    handoffs: [{ to: 'researcher', trigger: 'auto', condition: 'Decision is proceed' }],
  },
  {
    id: 'researcher',
    group: 'marketing',
    name: 'Researcher',
    role: 'Grounded Evidence Pipeline',
    vibe: 'Reads everything so the writer does not have to guess.',
    status: 'live',
    source: 'content-engine',
    legacyIds: ['cockpit-a9-customer-voice'],
    whatItDoes: 'Searches the web, academic databases, and technical docs; scrapes sources; and builds an evidence table every claim must satisfy.',
    inputs: [
      { name: 'Topic + Angle', format: 'Auto', description: 'From Angle Validator' },
      { name: 'Research Rules', format: 'Auto', description: 'Proof mix, depth, sources to prefer' },
    ],
    outputs: [
      { name: 'Research Dossier', format: 'Structured brief', description: 'Sources with confidence, recency, and proof type' },
      { name: 'Evidence Table', format: 'Table', description: 'Every claim traced to a source URL' },
    ],
    gates: [
      { gate: 'Proof mix', rule: 'Required proof types met, or a targeted follow-up round runs' },
    ],
    handoffs: [{ to: 'spec-builder', trigger: 'auto', condition: 'Dossier complete' }],
  },
  {
    id: 'spec-builder',
    group: 'marketing',
    name: 'Spec Builder',
    role: 'Writer Specification',
    vibe: 'Writes instructions so clear the writer cannot misread them.',
    status: 'live',
    source: 'content-engine',
    legacyIds: [],
    whatItDoes: 'Turns profile + dossier into unambiguous writer instructions: structure, the question it answers, proof requirements, and the frontier point of view.',
    inputs: [
      { name: 'Profile', format: 'Auto', description: 'Voice, ICP, tone' },
      { name: 'Research Dossier', format: 'Auto', description: 'From Researcher' },
      { name: 'Format', format: 'Select', description: 'Article / how-to / best-practice map' },
    ],
    outputs: [
      { name: 'Writer Spec', format: 'Structured brief', description: 'Unambiguous instructions the writer must follow' },
    ],
    gates: [
      { gate: 'Proof mandate', rule: 'Required proof mix encoded, not suggested' },
    ],
    handoffs: [{ to: 'writer', trigger: 'auto', condition: 'Spec complete' }],
  },
  {
    id: 'writer',
    group: 'marketing',
    name: 'Writer',
    role: 'On-Voice First Draft',
    vibe: 'Sounds like a person with scar tissue, not a press release.',
    status: 'live',
    source: 'content-engine',
    legacyIds: ['crew-content-multiplier', 'compass-enablement'],
    whatItDoes: 'Drafts in brand voice with specific language, named entities, numbers, and a human POV — from evidence, never invented facts.',
    inputs: [
      { name: 'Writer Spec', format: 'Auto', description: 'From Spec Builder' },
      { name: 'Research Dossier', format: 'Auto', description: 'Evidence table + sources' },
    ],
    outputs: [
      { name: 'Full Draft', format: 'Markdown', description: 'Structured, scannable, author-stamped' },
    ],
    gates: [
      { gate: 'Voice check', rule: 'No machine tells, no fabricated stats' },
      { gate: 'Source binding', rule: 'Every verifiable claim traces to the evidence table' },
    ],
    handoffs: [{ to: 'editor', trigger: 'auto', condition: 'Draft complete' }],
  },
  {
    id: 'editor',
    group: 'marketing',
    name: 'Editor',
    role: 'Fact-Check & Quality Gate',
    vibe: 'Removes the fabricated and defends the genuinely held.',
    status: 'live',
    source: 'content-engine',
    legacyIds: ['cockpit-a10-editor-in-chief', 'compass-coach'],
    whatItDoes: 'Classifies every claim as fact (rewrite or remove if unsupported) vs analysis (keep, no source needed); strengthens weak proof; gates quality.',
    inputs: [
      { name: 'Full Draft', format: 'Auto', description: 'From Writer' },
      { name: 'Evidence Table', format: 'Auto', description: 'Claims are checked against it' },
    ],
    outputs: [
      { name: 'Edited Draft', format: 'Markdown', description: 'Fact-checked, voice-checked, proof-checked' },
      { name: 'Proof Check', format: 'Report', description: 'Missing proof types, named honestly' },
    ],
    gates: [
      { gate: 'Fact gate', rule: 'Fabricated verifiable claims are rewritten or removed' },
      { gate: 'Proof coverage', rule: 'Required proof mix present or a bounded strengthen pass runs' },
    ],
    handoffs: [{ to: 'distribute', trigger: 'auto', condition: 'Gate passes' }],
  },
  {
    id: 'distribute',
    group: 'marketing',
    name: 'Distribute',
    role: 'Channel Variant Builder',
    vibe: 'One checked draft, every channel, no new lies.',
    status: 'live',
    source: 'content-engine',
    legacyIds: [],
    whatItDoes: 'Generates LinkedIn, YouTube, Substack, and email variants from the same fact-checked core — no variant can fabricate.',
    inputs: [
      { name: 'Edited Draft', format: 'Auto', description: 'From Editor' },
      { name: 'Channels', format: 'Multi-select', description: 'LinkedIn / YouTube / Substack / email' },
    ],
    outputs: [
      { name: 'LinkedIn Post', format: 'Text', description: 'Hook → insight → proof → question' },
      { name: 'YouTube Script', format: 'Script', description: 'Full script with screen cues' },
      { name: 'Substack Edition', format: 'Markdown', description: 'Newsletter edition' },
    ],
    gates: [
      { gate: 'No new facts', rule: 'Every variant built only from the checked draft + evidence' },
    ],
    handoffs: [],
  },

  // ── SALES · Convert — signal → outreach → qualify → close ────────────────────
  {
    id: 'listener',
    group: 'sales',
    name: 'Listener',
    role: 'Market Signal Monitor',
    vibe: 'Hears the market whispering and tells you when to shout.',
    status: 'live',
    source: 'crew',
    legacyIds: [],
    whatItDoes: 'Monitors 52 canonical GTM triggers, validates each against ICP, and routes only high-confidence signals — with a transparent veto log.',
    inputs: [
      { name: 'ICP Profile', format: 'Auto', description: 'Scoring criteria' },
      { name: 'Watch List', format: 'Text', description: 'Companies/domains to monitor' },
      { name: 'Sensitivity', format: 'Select', description: 'Broad / buying-signals only / custom' },
    ],
    outputs: [
      { name: 'Signal Digest', format: 'Ranked list', description: 'Validated signals by confidence' },
      { name: 'Vetoed Signals', format: 'Audit log', description: 'What was excluded and why' },
    ],
    gates: [
      { gate: 'Noise threshold', rule: 'Single-source signals require corroboration before passing' },
    ],
    handoffs: [{ to: 'signals-scout', trigger: 'auto', condition: 'Buying-intent signals above threshold' }],
  },
  {
    id: 'signals-scout',
    group: 'sales',
    name: 'Signals Scout',
    role: 'Signal-to-Intent Owner',
    vibe: 'Turns weak signals into a why-now you can defend.',
    status: 'live',
    source: 'crew',
    legacyIds: ['cockpit-a3-account-research'],
    whatItDoes: 'Converts weak external signals into a human-reviewable intent judgment scored against your ICP.',
    inputs: [
      { name: 'Target Domain', format: 'Text', description: 'Account(s) to assess' },
      { name: 'ICP Profile', format: 'Auto', description: 'Fit scoring criteria' },
      { name: 'Lookback', format: 'Select', description: '30 / 60 / 90 days' },
    ],
    outputs: [
      { name: 'Intent Assessment', format: 'Card per account', description: 'Why Now score + confidence' },
      { name: 'Fit Tier', format: 'A / B / C / D', description: 'ICP match' },
    ],
    gates: [
      { gate: 'ICP gate', rule: 'Below fit tier B is not auto-routed — human override required' },
      { gate: 'Recency gate', rule: 'Signals outside the lookback window are excluded' },
    ],
    handoffs: [{ to: 'sniper', trigger: 'auto', condition: 'Fit tier A/B + medium/high intent' }],
  },
  {
    id: 'sniper',
    group: 'sales',
    name: 'Sniper',
    role: 'Precision Outreach Drafter',
    vibe: 'Writes outreach that references a real event, never a template.',
    status: 'live',
    source: 'crew',
    legacyIds: ['cockpit-a4-personalisation'],
    whatItDoes: 'Drafts outreach grounded in a specific real signal, self-critiques for relevance and tone, and never sends without approval.',
    inputs: [
      { name: 'Signal Brief', format: 'Auto', description: 'From Signals Scout or pasted' },
      { name: 'Target Persona', format: 'Text', description: 'Role, company, context' },
      { name: 'Channel', format: 'Select', description: 'Email / LinkedIn DM / call script' },
    ],
    outputs: [
      { name: 'Draft Message', format: 'Text + subject', description: 'Ready-to-review draft' },
      { name: 'Self-Critique', format: 'Structured', description: 'Relevance, tone, signal usage, length' },
    ],
    gates: [
      { gate: 'Signal requirement', rule: 'No specific signal = "insufficient context", not generic copy' },
      { gate: 'Hallucination check', rule: 'Every factual claim traces to the signal brief' },
    ],
    handoffs: [{ to: 'qualifier', trigger: 'manual', condition: 'Reply received and a deal exists' }],
  },
  {
    id: 'qualifier',
    group: 'sales',
    name: 'Qualifier',
    role: 'Deal Qualification Engine',
    vibe: 'Surfaces what you do not know before it costs you the deal.',
    status: 'live',
    source: 'crew',
    legacyIds: ['cockpit-a5-reply-handler'],
    whatItDoes: 'Scores deals against a framework, surfaces exactly what is unknown, and flags stage-evidence mismatches — it never moves deals.',
    inputs: [
      { name: 'Deal Context', format: 'Text', description: 'Notes, email thread, or CRM summary' },
      { name: 'Deal Stage', format: 'Select', description: 'Prospecting → Closed Won/Lost' },
      { name: 'Framework', format: 'Select', description: 'MEDDIC / SPICED / BANT' },
      { name: 'Paper Process', format: 'Text', description: 'Legal, procurement, security review requirements' },
    ],
    outputs: [
      { name: 'Qualification Scorecard', format: 'Per-criterion', description: 'Present / partial / missing' },
      { name: 'Gap List', format: 'Questions', description: 'Exact questions to fill each gap' },
    ],
    gates: [
      { gate: 'Stage gate', rule: 'Proposal stage without an economic buyer = hard flag' },
      { gate: 'Single-thread check', rule: 'One contact engaged = risk flag above Discovery' },
      { gate: 'Procurement gate', rule: 'Legal/procurement/security review not mapped = hard flag — a 6-week cycle found late kills the quarter' },
    ],
    handoffs: [{ to: 'deal-room', trigger: 'auto', condition: 'Scorecard always feeds the deal room' }],
  },
  {
    id: 'deal-room',
    group: 'sales',
    name: 'Deal Room',
    role: 'Live Deal Intelligence',
    vibe: 'Gives you the whole deal in one brief, minutes before the call.',
    status: 'live',
    source: 'crew',
    legacyIds: ['cockpit-a6-deal-strategist', 'cockpit-a7-proposal'],
    whatItDoes: 'Aggregates deal notes, stakeholders, and qualification into one brief with buyer readiness, a risk log, and a suggested next action.',
    inputs: [
      { name: 'Deal Notes', format: 'Text', description: 'CRM notes or email thread' },
      { name: 'Stakeholders', format: 'Text', description: 'Known people + roles + sentiment' },
      { name: 'Transcript', format: 'Text', description: 'Last call transcript, optional' },
      { name: 'Paper Process', format: 'Text', description: 'Legal, procurement, security questionnaire status' },
    ],
    outputs: [
      { name: 'Deal Brief', format: 'Markdown', description: 'Summary, stakeholders, dates, open items' },
      { name: 'Risk Log', format: 'Prioritised list', description: 'What could kill the deal, ordered by severity' },
    ],
    gates: [
      { gate: 'Escalation gate', rule: 'Economic buyer not mentioned in 21 days = top of risk log' },
      { gate: 'Procurement gate', rule: 'Procurement/legal review not mapped = top of risk log' },
    ],
    handoffs: [{ to: 'forecast-analyser', trigger: 'auto', condition: 'Buyer readiness feeds forecast confidence' }],
  },

  // ── EXPANSION · Grow — retain · churn · land-and-expand ──────────────────────
  {
    id: 'health-monitor',
    group: 'expansion',
    name: 'Health Monitor',
    role: 'Account Health Scoring',
    vibe: 'A health score that explains itself, no black box.',
    status: 'live',
    source: 'crew',
    legacyIds: [],
    whatItDoes: 'Builds a health score from usage, engagement, support, and NPS — every score comes with the evidence behind it.',
    inputs: [
      { name: 'Account', format: 'Text', description: 'Account to score' },
      { name: 'Usage Summary', format: 'Text', description: 'Sessions, features, seat utilisation' },
      { name: 'Support History', format: 'Text', description: 'Ticket summary' },
    ],
    outputs: [
      { name: 'Health Score', format: '0–100 + Green/Amber/Red', description: 'Weighted composite with breakdown' },
      { name: 'Change Driver', format: 'Text', description: 'What moved the score and why' },
    ],
    gates: [
      { gate: 'Data sufficiency', rule: 'Insufficient data = data gap, not a low score' },
      { gate: 'NPS anchor', rule: 'Detractor NPS forces Amber regardless of other dimensions' },
    ],
    handoffs: [
      { to: 'churn-predictor', trigger: 'auto', condition: 'Amber or Red triggers churn assessment' },
      { to: 'expansion-radar', trigger: 'auto', condition: 'Green >80 with high utilisation' },
    ],
  },
  {
    id: 'churn-predictor',
    group: 'expansion',
    name: 'Churn Predictor',
    role: 'Retention Risk Engine',
    vibe: 'Names the risk with evidence, not a hunch.',
    status: 'live',
    source: 'crew',
    legacyIds: [],
    whatItDoes: 'Tiers at-risk accounts with the specific evidence behind each tier — no black-box probability.',
    inputs: [
      { name: 'Health Data', format: 'Auto', description: 'From Health Monitor' },
      { name: 'Renewal Date', format: 'Date', description: 'Next renewal' },
      { name: 'Contract Value', format: 'Number', description: 'ACV' },
    ],
    outputs: [
      { name: 'Risk Tier', format: 'Watch / Intervene / Escalate', description: 'With specific criteria' },
      { name: 'Risk Evidence', format: 'Cited list', description: 'Signals that triggered the tier' },
    ],
    gates: [
      { gate: 'Tier thresholds', rule: 'Escalate requires renewal <30 days + intervene criteria' },
      { gate: 'New-account exclusion', rule: 'Accounts <90 days excluded from Escalate' },
    ],
    handoffs: [{ to: 'health-monitor', trigger: 'auto', condition: 'Intervene/Escalate trigger a health refresh' }],
  },
  {
    id: 'expansion-radar',
    group: 'expansion',
    name: 'Expansion Radar',
    role: 'Upsell Signal Detection',
    vibe: 'Tells you which accounts are ready to grow, before they ask.',
    status: 'live',
    source: 'crew',
    legacyIds: [],
    whatItDoes: 'Identifies when accounts are ready to grow — utilisation, adoption, and external hiring signals — before they ask.',
    inputs: [
      { name: 'Health Score', format: 'Auto', description: 'Green accounts only' },
      { name: 'Utilisation', format: 'Number', description: 'Seat/licence percentage' },
      { name: 'Account Domain', format: 'URL', description: 'External hiring signals' },
    ],
    outputs: [
      { name: 'Readiness Score', format: '1–5 stars', description: 'With rationale' },
      { name: 'Expansion Brief', format: 'Internal brief', description: 'Why now, what product, what framing' },
    ],
    gates: [
      { gate: 'Health gate', rule: 'Only Green accounts eligible' },
      { gate: 'Utilisation threshold', rule: '>85% utilisation or a premium-feature spike required' },
    ],
    handoffs: [{ to: 'signals-scout', trigger: 'manual', condition: 'Expansion into a new team or division' }],
  },

  // ── OPERATIONS · Validate — hygiene · forecast · learnings ───────────────────
  {
    id: 'win-loss',
    group: 'operations',
    name: 'Win/Loss',
    role: 'Win/Loss Analyst',
    vibe: 'Distils the post-mortems into patterns you can act on.',
    status: 'live',
    source: 'cockpit',
    legacyIds: ['cockpit-wl'],
    whatItDoes: 'Distils why deals are won and lost into patterns that feed planning and positioning.',
    inputs: [
      { name: 'Deal Outcomes', format: 'Text', description: 'Won/lost deals with reasons' },
    ],
    outputs: [
      { name: 'Pattern Report', format: 'Structured', description: 'Winning and losing themes with evidence' },
    ],
    gates: [
      { gate: 'Sample gate', rule: 'Patterns require a minimum number of reviewed deals' },
    ],
    handoffs: [{ to: 'planning-cycle', trigger: 'auto', condition: 'Patterns feed the next quarterly loop' }],
  },
  {
    id: 'hygiene',
    group: 'operations',
    name: 'Hygiene',
    role: 'CRM Data Integrity Monitor',
    vibe: 'Finds what is broken in the CRM before it breaks the forecast.',
    status: 'live',
    source: 'crew',
    legacyIds: [],
    whatItDoes: 'Finds what is broken in the CRM before it breaks the forecast; auto-fixes only safe fields, everything else needs approval.',
    inputs: [
      { name: 'Pipeline Data', format: 'CSV / text', description: 'Deals with stages, values, dates, contacts' },
      { name: 'Audit Scope', format: 'Select', description: 'Full / current quarter / stage range' },
    ],
    outputs: [
      { name: 'Hygiene Report', format: 'Table', description: 'Blocker / warning / advisory' },
      { name: 'Forecast Impact', format: 'Metrics', description: 'Clean vs raw pipeline value' },
    ],
    gates: [
      { gate: 'Severity classification', rule: 'Blocker = affects forecast; advisory = hygiene only' },
    ],
    handoffs: [{ to: 'forecast-analyser', trigger: 'auto', condition: 'Hygiene always runs before forecast' }],
  },
  {
    id: 'forecast-analyser',
    group: 'operations',
    name: 'Forecast Analyser',
    role: 'Forecast Confidence Engine',
    vibe: 'Two numbers: what reps called, and what the evidence supports.',
    status: 'live',
    source: 'crew',
    legacyIds: ['cockpit-a8-revenue-forecast'],
    whatItDoes: 'Produces rep-called vs evidence-adjusted forecast, with the gap analysis that shows exactly where risk lives.',
    inputs: [
      { name: 'Pipeline Data', format: 'CSV / text', description: 'Deal name, stage, value, close date, activity' },
      { name: 'Hygiene Report', format: 'Auto', description: 'From Hygiene if run first' },
      { name: 'Period', format: 'Select', description: 'Current quarter / 30 / 60 days' },
    ],
    outputs: [
      { name: 'Two Numbers', format: 'Currency + range', description: 'What reps called vs what evidence supports' },
      { name: 'Gap Analysis', format: 'Deal-level', description: 'Every downward adjustment with reason' },
    ],
    gates: [
      { gate: 'Overconfidence flag', rule: 'Rep-called >30% above evidence-adjusted = warning on top' },
    ],
    handoffs: [{ to: 'planning-cycle', trigger: 'auto', condition: 'Forecast feeds quarterly context' }],
  },
  {
    id: 'workflow-builder',
    group: 'operations',
    name: 'Workflow Builder',
    role: 'RevOps Automation Architect',
    vibe: 'Turns a decision into a CRM spec the RevOps team can build.',
    status: 'live',
    source: 'crew',
    legacyIds: [],
    whatItDoes: 'Turns a plain-language process decision into an implementation-ready CRM workflow specification.',
    inputs: [
      { name: 'Process Description', format: 'Text', description: 'What should happen, in plain language' },
      { name: 'CRM Platform', format: 'Select', description: 'HubSpot / Salesforce' },
    ],
    outputs: [
      { name: 'Workflow Spec', format: 'Document', description: 'Trigger, conditions, actions, edge cases' },
    ],
    gates: [
      { gate: 'Ambiguity gate', rule: 'Ambiguous description = clarifying questions surfaced, not guessed' },
    ],
handoffs: [{ to: 'hygiene', trigger: 'auto', condition: 'Post-implementation verification' }],
  },

  // ── STRATEGY · roadmap ───────────────────────────────────────────────────────
  {
    id: 'market-research',
    group: 'strategy',
    name: 'Market Research',
    role: 'Total Addressable Market Analyst',
    vibe: 'Maps the market so the plan aims at a real, sized prize.',
    status: 'live',
    source: 'crew',
    legacyIds: [],
    whatItDoes: 'Sizes segments, maps the competitive field, and scores the whitespace so Strategy targets a prize that is real and reachable.',
    inputs: [
      { name: 'Target Segments', format: 'Text', description: 'Segments to size' },
      { name: 'Geography', format: 'Select', description: 'Market scope' },
    ],
    outputs: [
      { name: 'Market Map', format: 'Structured brief', description: 'Segments, sizes, and whitespace' },
      { name: 'Entry Priority', format: 'Ranked list', description: 'Where to aim first, with evidence' },
    ],
    gates: [
      { gate: 'Evidence gate', rule: 'Segment sizes must trace to cited sources, not estimates dressed as facts' },
    ],
    handoffs: [{ to: 'planning-cycle', trigger: 'manual', condition: 'Market map feeds the next planning loop' }],
  },
  {
    id: 'roadmap-align',
    group: 'strategy',
    name: 'Roadmap Align',
    role: 'Goal-to-Pipeline Alignment Planner',
    vibe: 'Makes sure the plan and the pipeline are talking about the same quarter.',
    status: 'live',
    source: 'crew',
    legacyIds: [],
    whatItDoes: 'Cross-checks goals against pipeline shape and capacity, and flags where the plan and the funnel disagree before the quarter starts.',
    inputs: [
      { name: 'Goals', format: 'Auto', description: 'From Goal Designer' },
      { name: 'Pipeline Shape', format: 'Text', description: 'Coverage by stage' },
      { name: 'Capacity', format: 'Text', description: 'Rep + marketing capacity' },
    ],
    outputs: [
      { name: 'Alignment Report', format: 'Report', description: 'Where goals and pipeline diverge' },
      { name: 'Adjustment Slots', format: 'Flag list', description: 'What to change, with reasoning' },
    ],
    gates: [
      { gate: 'Reality gate', rule: 'Goals without pipeline coverage are flagged, not silently accepted' },
    ],
    handoffs: [{ to: 'goal-designer', trigger: 'manual', condition: 'Flags feed the next goal design' }],
  },

  // ── MARKETING · roadmap ──────────────────────────────────────────────────────
  {
    id: 'seo-analyzer',
    group: 'marketing',
    name: 'SEO Analyzer',
    role: 'Search Visibility & AEO Analyst',
    vibe: 'Maps the questions buyers ask an AI, audits whether the site can be the answer, and hands back the fix.',
    status: 'live',
    source: 'content-engine',
    legacyIds: [],
    whatItDoes: 'Runs a three-layer AEO + search audit on a topic cluster: (1) maps the real queries buyers ask search and AI engines with demand and coverage, (2) scores the site\'s own AI-readiness — robots/llms.txt discovery, parsability (schema, headings, token budgets), capability — and (3) identifies lost prompts where competitors win citations and why, then produces a prioritized fix pack with handoffs into the content pipeline.',
    inputs: [
      { name: 'Topic Cluster', format: 'Text', description: 'Core theme to analyse (e.g. "pipeline forecasting")' },
      { name: 'Target Domain', format: 'URL', description: 'The site to audit (defaults to the brand site)' },
      { name: 'Competitors', format: 'Text', description: 'Optional: 2–4 competitor domains to compare citation patterns' },
      { name: 'Existing Content', format: 'Auto', description: 'From the content map — coverage is scored against what the brand has already published' },
      { name: 'Profile', format: 'Auto', description: 'ICP + brand voice scope the queries and the fix language' },
    ],
    outputs: [
      { name: 'Query Map', format: 'Table', description: 'Question → intent (recommend/comparison/how-to/definition) → demand (measured) → coverage (own/competitor/nobody)' },
      { name: 'AEO Readiness Score', format: 'Scorecard', description: 'Three-layer site audit: discovery (robots/llms.txt/sitemap), parsability (schema/headings/token budget), capability (agent-permissions)' },
      { name: 'Lost-Prompt Analysis', format: 'Table', description: 'Queries the brand should win but competitors are cited for, with why they win' },
      { name: 'Fix Pack', format: 'Prioritised list', description: 'Fixes by expected citation impact, each with target queries, the exact change, and a content handoff' },
    ],
    gates: [
      { gate: 'Demand gate', rule: 'Only queries with measured search/assistant demand are surfaced — no keyword echo, no invented volume' },
      { gate: 'Measured-vs-inferred', rule: 'SERP positions and schema presence are measured; demand heat and citation likelihood are explicitly inferred' },
      { gate: 'Honesty gate', rule: 'Absence of evidence is reported as absence; no "get cited" guarantees — only "improve citation likelihood"' },
      { gate: 'Differentiation gate', rule: 'Every recommendation carries a judgment and a next action — a keyword list without a spine is rejected' },
    ],
    handoffs: [
      { to: 'content-radar', trigger: 'manual', condition: 'Uncovered high-demand queries become content opportunities' },
      { to: 'writer', trigger: 'manual', condition: 'A fix-pack item is approved and enters the fact-checked pipeline' },
    ],
  },
  {
    id: 'campaign-builder',
    group: 'marketing',
    name: 'Campaign Builder',
    role: 'Multi-Channel Campaign Architect',
    vibe: 'Turns one message into a calendar that actually reaches the buyer.',
    status: 'live',
    source: 'crew',
    legacyIds: [],
    whatItDoes: 'Designs multi-channel campaigns — narrative arc, channel mix, content calendar, and CTAs — from a message and a segment.',
    inputs: [
      { name: 'Message', format: 'Text', description: 'Core message to amplify' },
      { name: 'Segment', format: 'Auto', description: 'From ICP Clarifier' },
      { name: 'Window', format: 'Date range', description: 'Campaign period' },
    ],
    outputs: [
      { name: 'Campaign Plan', format: 'Calendar', description: 'Channels, cadence, assets, CTAs' },
      { name: 'Asset List', format: 'Checklist', description: 'What to produce and by when' },
    ],
    gates: [
      { gate: 'Segment gate', rule: 'Campaigns target a defined segment, never everyone' },
    ],
    handoffs: [{ to: 'writer', trigger: 'manual', condition: 'Campaign assets enter the content pipeline' }],
  },
  {
    id: 'abm-playbook',
    group: 'marketing',
    name: 'ABM Playbook',
    role: 'Account-Based Positioning Builder',
    vibe: 'Builds the play that makes your named accounts feel chosen.',
    status: 'live',
    source: 'crew',
    legacyIds: [],
    whatItDoes: 'Builds account-based positioning and outreach playbooks for named accounts — the story, the channels, and the timing.',
    inputs: [
      { name: 'Named Accounts', format: 'List', description: 'Accounts to target' },
      { name: 'Account Context', format: 'Text', description: 'Known signals per account' },
    ],
    outputs: [
      { name: 'ABM Playbook', format: 'Document', description: 'Per-account positioning + channel plan' },
      { name: 'Account Story', format: 'Text', description: 'The message each account should hear' },
    ],
    gates: [
      { gate: 'Signal gate', rule: 'Each account play grounds in real account signals, not generic outreach' },
    ],
    handoffs: [{ to: 'sniper', trigger: 'manual', condition: 'Account play becomes personalised outreach' }],
  },
  {
    id: 'account-planner',
    group: 'marketing',
    name: 'Account Planner',
    role: 'Target Account Selection & Tiering',
    vibe: 'Picks the accounts worth a campaign before the campaign starts.',
    status: 'live',
    source: 'crew',
    legacyIds: [],
    whatItDoes: 'Scores the account universe against ICP + fit + intent and tiers it, so ABM and sales spend on the accounts most likely to convert.',
    inputs: [
      { name: 'Account Universe', format: 'CSV', description: 'Candidate accounts' },
      { name: 'ICP Profile', format: 'Auto', description: 'Fit criteria' },
    ],
    outputs: [
      { name: 'Tiered Account List', format: 'Table', description: 'Tier + fit + intent per account' },
      { name: 'Focus Set', format: 'List', description: 'Accounts worth a play this quarter' },
    ],
    gates: [
      { gate: 'Fit gate', rule: 'Accounts below fit threshold are not auto-selected' },
    ],
    handoffs: [{ to: 'abm-playbook', trigger: 'manual', condition: 'Tier 1 accounts get plays' }],
  },

  // ── SALES · roadmap ──────────────────────────────────────────────────────────
  {
    id: 'video-outreach',
    group: 'sales',
    name: 'Video Outreach',
    role: 'Personalised Video Brief Drafter',
    vibe: 'Turns a signal into a 60-second video you could actually send.',
    status: 'live',
    source: 'crew',
    legacyIds: [],
    whatItDoes: 'Drafts a personalised video brief — the hook, the proof, the ask — grounded in a specific signal, ready to record.',
    inputs: [
      { name: 'Signal Brief', format: 'Auto', description: 'From Signals Scout or pasted' },
      { name: 'Persona', format: 'Text', description: 'Role + context' },
    ],
    outputs: [
      { name: 'Video Brief', format: 'Script', description: 'Hook → proof → ask, under 60s' },
      { name: 'Delivery Note', format: 'Text', description: 'Channel + timing recommendation' },
    ],
    gates: [
      { gate: 'Signal requirement', rule: 'No specific signal = no brief — a video without a reason to send is spam' },
    ],
    handoffs: [{ to: 'sniper', trigger: 'manual', condition: 'Video follow-up layered onto a sequence' }],
  },
  {
    id: 'pricing-strategist',
    group: 'sales',
    name: 'Pricing Strategist',
    role: 'Deal Pricing & Packaging Analyst',
    vibe: 'Prices the deal so the customer says yes and you still make margin.',
    status: 'live',
    source: 'cockpit',
    legacyIds: [],
    whatItDoes: 'Advises deal-level pricing and packaging — anchoring, tier fit, and concession boundaries — grounded in deal context and prior wins.',
    inputs: [
      { name: 'Deal Context', format: 'Auto', description: 'From Deal Room' },
      { name: 'Price History', format: 'Text', description: 'Recent wins/losses by price point' },
    ],
    outputs: [
      { name: 'Pricing Recommendation', format: 'Brief', description: 'Anchor, package, concession floor' },
      { name: 'Margin Guardrail', format: 'Number', description: 'The walk-away number' },
    ],
    gates: [
      { gate: 'Margin gate', rule: 'Recommendations must stay above the margin floor' },
    ],
    handoffs: [{ to: 'deal-room', trigger: 'manual', condition: 'Pricing note feeds the deal brief' }],
  },
  {
    id: 'negotiation-coach',
    group: 'sales',
    name: 'Negotiation Coach',
    role: 'Live Negotiation Advisor',
    vibe: 'Prepares the concession map before the call, not after.',
    status: 'live',
    source: 'cockpit',
    legacyIds: [],
    whatItDoes: 'Builds a negotiation map — what they want, what you can give, where the line is — and preps the concession sequence for the call.',
    inputs: [
      { name: 'Deal Brief', format: 'Auto', description: 'From Deal Room' },
      { name: 'Known Pressures', format: 'Text', description: 'Budget, timeline, competitors' },
    ],
    outputs: [
      { name: 'Concession Map', format: 'Structured', description: 'Trades, in order, with guardrails' },
      { name: 'Call Prep', format: 'Bullets', description: 'What to hold, what to give, when to close' },
    ],
    gates: [
      { gate: 'Guardrail gate', rule: 'Concessions never breach the margin floor' },
    ],
    handoffs: [{ to: 'deal-room', trigger: 'manual', condition: 'Prep notes feed the deal brief' }],
  },

  // ── EXPANSION · roadmap ──────────────────────────────────────────────────────
  {
    id: 'onboarding-coach',
    group: 'expansion',
    name: 'Onboarding Coach',
    role: 'Time-to-Value Planner',
    vibe: 'Gets the customer to their first win before the enthusiasm fades.',
    status: 'live',
    source: 'crew',
    legacyIds: [],
    whatItDoes: 'Designs an onboarding path to first value — milestones, owners, and the metrics that prove it worked.',
    inputs: [
      { name: 'Account Context', format: 'Auto', description: 'From Health Monitor' },
      { name: 'Product Surface', format: 'Text', description: 'The core workflows to adopt' },
    ],
    outputs: [
      { name: 'Onboarding Plan', format: 'Milestones', description: 'Day-1 → first-value path' },
      { name: 'Success Metrics', format: 'Metrics', description: 'What proves value landed' },
    ],
    gates: [
      { gate: 'Time-to-value gate', rule: 'First value must be reachable inside the plan window' },
    ],
    handoffs: [{ to: 'health-monitor', trigger: 'auto', condition: 'Onboarding milestones feed the health score' }],
  },
  {
    id: 'renewal-analyst',
    group: 'expansion',
    name: 'Renewal Analyst',
    role: 'Renewal Strategy Planner',
    vibe: 'Starts the renewal conversation long before the contract date.',
    status: 'live',
    source: 'crew',
    legacyIds: [],
    whatItDoes: 'Builds the renewal plan — the proof of value to present, the expansion option to offer, and the risk to neutralise.',
    inputs: [
      { name: 'Health Data', format: 'Auto', description: 'From Health Monitor' },
      { name: 'Renewal Date', format: 'Date', description: 'Next renewal' },
    ],
    outputs: [
      { name: 'Renewal Plan', format: 'Brief', description: 'Value proof, offer, and risk plan' },
      { name: 'Expansion Option', format: 'Text', description: 'The upsell framed as the natural next step' },
    ],
    gates: [
      { gate: 'Value gate', rule: 'A renewal plan must open with evidence of value delivered' },
    ],
    handoffs: [{ to: 'expansion-radar', trigger: 'manual', condition: 'Renewal options feed expansion readiness' }],
  },
  {
    id: 'cross-sell-scout',
    group: 'expansion',
    name: 'Cross-Sell Scout',
    role: 'Cross-Sell & Multi-Product Scout',
    vibe: 'Spots the adjacent product the account is already asking for.',
    status: 'live',
    source: 'crew',
    legacyIds: [],
    whatItDoes: 'Scans health + usage + support for the signals that an account is ready for an adjacent product, and frames the cross-sell.',
    inputs: [
      { name: 'Health Score', format: 'Auto', description: 'Green accounts only' },
      { name: 'Usage + Support', format: 'Text', description: 'Where value already landed' },
    ],
    outputs: [
      { name: 'Cross-Sell Brief', format: 'Internal brief', description: 'Product, evidence, framing' },
      { name: 'Readiness Score', format: '1–5', description: 'With rationale' },
    ],
    gates: [
      { gate: 'Health gate', rule: 'Only healthy accounts are eligible' },
    ],
    handoffs: [{ to: 'expansion-radar', trigger: 'manual', condition: 'Readiness feeds the expansion brief' }],
  },

  // ── OPERATIONS · roadmap ─────────────────────────────────────────────────────
  {
    id: 'pipeline-auditor',
    group: 'operations',
    name: 'Pipeline Auditor',
    role: 'Pipeline Integrity Auditor',
    vibe: 'Finds the pipe that is full but empty.',
    status: 'live',
    source: 'crew',
    legacyIds: [],
    whatItDoes: 'Audits pipeline quality beyond hygiene — stage/evidence mismatches, aged deals, and coverage gaps — into a full integrity report.',
    inputs: [
      { name: 'Pipeline Data', format: 'CSV / text', description: 'Deals with stages, values, activity' },
      { name: 'Audit Depth', format: 'Select', description: 'Standard / deep' },
    ],
    outputs: [
      { name: 'Integrity Report', format: 'Report', description: 'Stage, age, coverage issues' },
      { name: 'Forecast Risk', format: 'Metrics', description: 'What the pipeline really supports' },
    ],
    gates: [
      { gate: 'Evidence gate', rule: 'Stage/evidence mismatches flagged, never assumed clean' },
    ],
    handoffs: [{ to: 'forecast-analyser', trigger: 'auto', condition: 'Audit feeds forecast confidence' }],
  },
  {
    id: 'attribution',
    group: 'operations',
    name: 'Attribution',
    role: 'Revenue Attribution Analyst',
    vibe: 'Tells you which engine actually drove the revenue.',
    status: 'live',
    source: 'crew',
    legacyIds: [],
    whatItDoes: 'Attributes closed revenue back across the journey — which touch, channel, and engine carried the deal — so spend follows what works.',
    inputs: [
      { name: 'Closed Deals', format: 'CSV', description: 'Deals + touch history' },
      { name: 'Model', format: 'Select', description: 'First / last / linear / custom' },
    ],
    outputs: [
      { name: 'Attribution Report', format: 'Report', description: 'Revenue by engine and touch' },
      { name: 'Spend Signal', format: 'Ranked list', description: 'Where next dollar earns most' },
    ],
    gates: [
      { gate: 'Data gate', rule: 'Attribution requires touch data; absent data is reported, not guessed' },
    ],
    handoffs: [{ to: 'planning-cycle', trigger: 'manual', condition: 'Attribution feeds next quarter\'s plan' }],
  },
  {
    id: 'comp-quota',
    group: 'operations',
    name: 'Comp & Quota',
    role: 'Quota & Compensation Designer',
    vibe: 'Sets targets the reps believe and the math supports.',
    status: 'live',
    source: 'crew',
    legacyIds: [],
    whatItDoes: 'Designs quota and comp plans grounded in capacity, coverage, and history — so targets are motivating and the math holds.',
    inputs: [
      { name: 'Territory Data', format: 'Text', description: 'Capacity, coverage, history' },
      { name: 'Comp Structure', format: 'Text', description: 'Current or target plan' },
    ],
    outputs: [
      { name: 'Quota Plan', format: 'Table', description: 'Per-rep targets with rationale' },
      { name: 'Comp Model', format: 'Brief', description: 'Levers and guardrails' },
    ],
    gates: [
      { gate: 'Reality gate', rule: 'Quotas must reconcile with pipeline coverage, not optimism' },
    ],
    handoffs: [{ to: 'goal-integrity', trigger: 'manual', condition: 'Quota plan feeds goal integrity' }],
  },
  {
    id: 'chief-of-staff',
    group: 'operations',
    name: 'Chief of Staff',
    role: 'Cross-Engine Orchestrator',
    vibe: 'Runs the weekly rhythm across every engine — what changed, what needs a decision, what to do.',
    status: 'live',
    source: 'crew',
    legacyIds: [],
    whatItDoes: 'Runs the weekly command rhythm across all five engines: what changed, what needs a decision this week, and the cross-engine risks and opportunities the individual agents cannot see from inside their own lane. It orchestrates; it does not invent — every item traces to an engine output.',
    inputs: [
      { name: 'Engine Outputs', format: 'Auto', description: 'The latest results from the engines (or pasted in)' },
      { name: 'Priorities', format: 'Text', description: 'The quarter\'s goals and the current bets' },
      { name: 'Context', format: 'Text', description: 'What happened this week' },
    ],
    outputs: [
      { name: 'Weekly Command Brief', format: 'Brief', description: 'What changed, what needs a decision, what to do' },
      { name: 'Risk & Opportunity Register', format: 'Ranked list', description: 'Cross-engine risks and openings, with the owning engine' },
    ],
    gates: [
      { gate: 'Evidence gate', rule: 'Only surfaces what the engine outputs support — no synthesized facts, no invented status' },
      { gate: 'Decision gate', rule: 'Every "needs a decision" item names the decision and the owner, or it is not surfaced' },
    ],
    handoffs: [
      { to: 'planning-cycle', trigger: 'manual', condition: 'Weekly themes feed the quarterly loop' },
      { to: 'goal-integrity', trigger: 'manual', condition: 'Cross-engine risk flags feed goal integrity' },
    ],
  },
];

export const AGENT_BY_ID: Record<string, Agent> = Object.fromEntries(AGENTS.map((a) => [a.id, a]));

export function agentsByGroup(groupId: string): Agent[] {
  return AGENTS.filter((a) => a.group === groupId);
}