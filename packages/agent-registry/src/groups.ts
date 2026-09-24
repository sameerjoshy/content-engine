import type { ExecutiveLens, GroupId, OutcomeGroup } from './types';

/**
 * The five engines of the GTM-360 bowtie model. Functional names on the surface
 * (Strategy / Marketing / Sales / Expansion / Operations); the customer journey
 * (Attract → Convert → Grow) is the story; Operations validates and the loop
 * enhances back to Strategy.
 *
 *          STRATEGY (know · decide)        ← top envelope
 *     ATTRACT ── CONVERT ── GROW           ← the customer journey
 *          OPERATIONS (validate)          ← bottom envelope
 *          └── Enhance → back to Strategy
 */
export const OUTCOME_GROUPS: OutcomeGroup[] = [
  {
    id: 'strategy',
    number: 1,
    name: 'Strategy',
    envelope: 'top',
    verb: 'Know who to serve. Decide what to do.',
    outcome: 'The right customer, the right goal, the honest plan',
    description: 'The revenue system starts here — who we serve, what we promise, and a plan that survives a hard look.',
    color: '#2563eb',
  },
  {
    id: 'marketing',
    number: 2,
    name: 'Marketing',
    envelope: 'journey',
    journey: 'attract',
    verb: 'Attract. Position. ABM. Content.',
    outcome: 'The obvious choice before they ever talk to you',
    description: 'Citable content, SEO, and account-level positioning (including ABM) that make you the obvious choice.',
    color: '#10b981',
  },
  {
    id: 'sales',
    number: 3,
    name: 'Sales',
    envelope: 'journey',
    journey: 'convert',
    verb: 'Signal → outreach → qualify → close.',
    outcome: 'Pipeline that fills and closes',
    description: 'From market signal to outreach to qualification to close — every step grounded in evidence, approved by a human.',
    color: '#d97706',
  },
  {
    id: 'expansion',
    number: 4,
    name: 'Expansion',
    envelope: 'journey',
    journey: 'grow',
    verb: 'Retain the book. Grow back into the account.',
    outcome: 'The book kept and grown',
    description: 'Account health, churn risk, and land-and-expand readiness — the book doesn\'t just stay, it compounds.',
    color: '#0d9488',
  },
  {
    id: 'operations',
    number: 5,
    name: 'Operations',
    envelope: 'bottom',
    verb: 'Validate the numbers. Learn from every deal.',
    outcome: 'Numbers you can bet the quarter on',
    description: 'Data hygiene, forecast confidence, workflow integrity, and win/loss learnings — the guardrail that feeds a better next quarter.',
    color: '#475569',
  },
];

export const GROUP_BY_ID: Record<GroupId, OutcomeGroup> = Object.fromEntries(
  OUTCOME_GROUPS.map((g) => [g.id, g]),
) as Record<GroupId, OutcomeGroup>;

export const GROUP_ORDER: GroupId[] = OUTCOME_GROUPS.map((g) => g.id);

/** HQ personas are executive lenses over the engine, not agents. */
export const EXECUTIVE_LENSES: ExecutiveLens[] = [
  { id: 'sam', name: 'Sam', title: 'Chief of Staff', groups: ['strategy', 'operations'] },
  { id: 'rex', name: 'Rex', title: 'CRO', groups: ['sales', 'operations'] },
  { id: 'andy', name: 'Andy', title: 'CMO', groups: ['marketing', 'strategy'] },
  { id: 'finn', name: 'Finn', title: 'CFO', groups: ['operations'] },
  { id: 'ola', name: 'Ola', title: 'COO', groups: ['expansion', 'operations'] },
];