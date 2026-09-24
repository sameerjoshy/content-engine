/** The five engines of the GTM-360 bowtie model (functional names on the surface). */
export type GroupId = 'strategy' | 'marketing' | 'sales' | 'expansion' | 'operations';

/** Where an engine sits in the bowtie: top/journey/bottom envelope. */
export type EnvelopeType = 'top' | 'journey' | 'bottom';

/** The customer-journey stage an engine serves (only journey engines). */
export type JourneyStage = 'attract' | 'convert' | 'grow';

export type AgentStatus = 'live' | 'demo' | 'planned';

/** Where a canonical agent originally shipped from. */
export type AgentSource = 'content-engine' | 'crew' | 'cockpit' | 'compass';

export interface AgentIO {
  name: string;
  format: string;
  description: string;
}

export interface AgentGate {
  gate: string;
  rule: string;
}

export interface AgentHandoff {
  to: string;
  trigger: 'auto' | 'manual';
  condition: string;
}

/**
 * The universal execution chain every agent follows. No black boxes.
 */
export const AGENT_CHAIN = ['GATHER', 'VALIDATE', 'SYNTHESISE', 'VERIFY'] as const;

/**
 * A canonical agent. One per (outcome × job). Every agent follows the shared
 * contract: inputs → AGENT_CHAIN → outputs → gates → handoffs.
 */
export interface Agent {
  id: string;
  group: GroupId;
  name: string;
  role: string;
  /** One-line personality, in the style of agency-agents ("…kills happy ears on contact"). */
  vibe?: string;
  status: AgentStatus;
  source: AgentSource;
  /** Product-specific twins that were folded into this canonical agent. */
  legacyIds: string[];
  whatItDoes: string;
  inputs: AgentIO[];
  outputs: AgentIO[];
  gates: AgentGate[];
  handoffs: AgentHandoff[];
}

export interface OutcomeGroup {
  id: GroupId;
  number: number;
  name: string;
  /** Bowtie position: top envelope (strategy) · journey stage (marketing/sales/expansion) · bottom envelope (operations). */
  envelope: EnvelopeType;
  /** Customer-journey stage, present only for journey engines. */
  journey?: JourneyStage;
  verb: string;
  outcome: string;
  description: string;
  color: string;
}

export interface ExecutiveLens {
  id: string;
  name: string;
  title: string;
  groups: GroupId[];
}