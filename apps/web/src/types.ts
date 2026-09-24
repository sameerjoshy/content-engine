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
  author: Author | null;
  input_quality: {
    score: number | null;
    flags: string[];
    suggestions: string[];
    llm_critique?: string | null;
    analyzed_at?: string;
  } | null;
  source_template: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

export interface SessionSummary {
  id: string;
  topic: string;
  angle: string;
  current_stage: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

export interface WorkflowEvent {
  stage: string;
  event_type: string;
  message: string;
  data: Record<string, unknown> | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
  created_at: string;
}

export interface WorkflowStatus {
  session_id: string;
  topic: string;
  angle: string;
  depth: string;
  format: string;
  current_stage: string;
  status: string;
  review_research: boolean;
  research_note: string | null;
  error_message: string | null;
  decision: { decision: string; reasoning?: string; suggested_pivot?: string | null } | null;
  profile_name: string | null;
  created_at: string;
  events: WorkflowEvent[];
}

export interface ResearchEvidence {
  claim: string;
  source_url: string;
  source_title: string;
  publish_date: string | null;
  source_type: string;
  proof_type: string | null;
  trust_score: number;
  evidence_snippet: string;
  confidence: number;
  recency: number | null;
}

export interface ResearchBrief {
  session_id: string;
  topic: string;
  angle: string;
  format: string;
  status: string;
  current_stage: string;
  research_note: string | null;
  dossier: string;
  evidence: ResearchEvidence[];
  gap_report: { found: Record<string, number>; missing: string[] } | null;
}

export interface DraftResponse {
  session_id: string;
  stage: string;
  content: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}