export interface WorkflowBinding {
  create: (options: { id: string; params: Record<string, unknown> }) => Promise<{ id: string }>;
  get: (id: string) => Promise<{
    sendEvent: (opts: { type: string; payload: unknown }) => Promise<void>;
  }>;
}

export interface Env {
  ENVIRONMENT: string;
  DEEPSEEK_API_KEY: string;
  ANTHROPIC_API_KEY?: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY: string;
  TAVILY_API_KEY?: string;
  SERPER_API_KEY?: string;
  HUBSPOT_API_KEY?: string;
  RESEND_API_KEY?: string;
  AUTH_HOOK_SECRET?: string;
  ARTICLE_WORKFLOW: WorkflowBinding;
  WORKER_SELF?: { fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> };
}