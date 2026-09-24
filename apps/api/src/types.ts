export type Stage =
  | 'validator'
  | 'researcher'
  | 'spec_builder'
  | 'sowhat'
  | 'pov'
  | 'writer'
  | 'editor'
  | 'complete';

export type SessionStatus = 'starting' | 'in_progress' | 'complete' | 'error' | 'pivot' | 'killed';

export type Depth = 'light' | 'moderate' | 'deep';

export type ContentFormat = 'article' | 'howto' | 'best_practice';

export interface Series {
  name: string;
  part?: number;
  total?: number;
}

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  slug: string | null;
  brand_voice: Record<string, unknown>;
  icp: Record<string, unknown>;
  content_standards: Record<string, unknown>;
  research_rules: Record<string, unknown>;
  input_quality: unknown;
  source_template: string | null;
  author: Author | null;
  is_active: boolean;
}

export interface Author {
  name: string;
  title?: string;
  bio?: string;
  company?: string;
  linkedin_url?: string;
  photo_url?: string;
}

export interface ContentMapItem {
  id: string;
  title: string;
  angle: string | null;
  publish_date: string | null;
  profile: string | null;
  status: string | null;
  url: string | null;
}

export interface Session {
  id: string;
  user_id: string;
  profile_id: string | null;
  profile_snapshot: Profile | null;
  topic: string;
  angle: string;
  depth: Depth;
  current_stage: string;
  status: SessionStatus;
  error_message: string | null;
  decision: unknown;
  workflow_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface EvidenceItem {
  claim_id: string;
  claim: string;
  source_url: string;
  source_title: string;
  publish_date?: string;
  source_type: string;
  proof_type?: string;
  trust_score: number;
  evidence_snippet: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: 'tavily' | 'openalex' | 'semantic_scholar' | 'wikipedia' | 'hacker_news' | 'reddit' | 'google' | 'google_news' | 'serper';
}

export interface FetchedDoc {
  url: string;
  title: string;
  text: string;
}

export interface LlmUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface LlmResult {
  text: string;
  usage: LlmUsage;
  model?: string;
}

export interface RunArticleInput {
  profile_id: string;
  topic: string;
  angle: string;
  depth: Depth;
  format?: ContentFormat;
  series?: Series;
  review_research?: boolean;
  /** Operator override: skip the so-what demand gate (operator may know something the data doesn't). */
  skip_sowhat?: boolean;
}

export interface ExperienceEntry {
  id: string;
  user_id: string;
  insight: string;
  scar: string | null;
  pattern: string | null;
  counter: string | null;
  applicable_tags: string[];
  changed_mind_from: string | null;
  changed_mind_to: string | null;
  changed_mind_story: string | null;
  occurrences: number;
  publishable: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface WorkflowParams {
  session_id: string;
  user_id: string;
}