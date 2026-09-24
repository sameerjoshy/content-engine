import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { WorkflowStatus } from '../types';
import StageTimeline, { STAGES } from '../components/StageTimeline';
import LiveConsole from '../components/LiveConsole';
import ShowcaseVideo from '../components/ShowcaseVideo';
import { Button, Card } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

export default function Workflow() {
  usePageTitle('Workflow');
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<WorkflowStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await api<WorkflowStatus>(`/api/workflow-status/${id}`);
        if (!alive) return;
        setStatus(r);
        setError(null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Failed to load status');
      }
    };
    poll();
    const t = setInterval(poll, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id]);

  const messages = useMemo(() => {
    const m: Record<string, string> = {};
    if (!status) return m;
    for (const ev of status.events) {
      if (ev.stage && ev.message && !m[ev.stage]) m[ev.stage] = ev.message;
    }
    return m;
  }, [status]);

  const erroredStages = useMemo(() => {
    const s = new Set<string>();
    for (const ev of status?.events ?? []) if (ev.event_type === 'error') s.add(ev.stage);
    return s;
  }, [status]);

  const costSummary = useMemo(() => {
    if (!status) return null;
    let cost = 0;
    let tokensIn = 0;
    let tokensOut = 0;
    for (const ev of status.events) {
      if (ev.event_type === 'llm_call') {
        cost += ev.cost_usd ?? 0;
        tokensIn += ev.tokens_in ?? 0;
        tokensOut += ev.tokens_out ?? 0;
      }
    }
    return { cost, tokensIn, tokensOut };
  }, [status]);

  if (error) {
    return (
      <div className="page-head">
        <h1>Workflow</h1>
        <p className="error-text">{error}</p>
        <Button variant="secondary" className="mt-md" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!status) return <span className="spinner" />;

  const done = status.status === 'complete';
  const rejected = status.status === 'pivot' || status.status === 'killed';
  const isError = status.status === 'error';
  const awaitingReview = status.status === 'awaiting_review';
  const currentStageIdx = STAGES.findIndex((s) => s.key === status.current_stage);

  const modules = [
    { key: 'validator', label: 'Angle Validator', desc: 'Checks the angle against your existing content' },
    { key: 'researcher', label: 'Researcher', desc: 'Searches the web, fetches sources, extracts evidence' },
    { key: 'spec_builder', label: 'Spec Builder', desc: 'Turns profile + dossier into writer instructions' },
    { key: 'sowhat', label: 'Demand Gate', desc: 'Checks the question is actually burning right now' },
    { key: 'pov', label: 'Proprietary POV', desc: 'Applies the operator\'s experience-based insight' },
    { key: 'writer', label: 'Writer', desc: 'Drafts the piece in your brand voice' },
    { key: 'editor', label: 'Editor', desc: 'Fact-checks, classifies, and polishes' },
  ];
  const runningModule = status.current_stage === 'complete' ? null : modules.find((m) => m.key === status.current_stage) ?? null;

  return (
    <div>
      <div className="page-head">
        <h1>Your Article is Being Created</h1>
        <p>
          <strong>{status.topic}</strong> — {status.angle} · {status.profile_name}
          {status.format === 'howto' ? ' · Deep How-To Snippet' : status.format === 'best_practice' ? ' · Best-Practice Scan' : ''}
        </p>
      </div>

      {/* How the pipeline works — the stage handoffs, explained. */}
      <Card className="mb-md workflow-video-card">
        <div className="row-between" style={{ marginBottom: 12 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>How the pipeline works</h3>
          <span className="muted" style={{ fontSize: 13 }}>24s · what each stage hands off</span>
        </div>
        <ShowcaseVideo src="/videos/pipeline-explainer.mp4" label="How the Content Engine pipeline works" autoplay />
      </Card>

      <div className="row-between mb-md">
        <span className="muted">
          Stage {Math.max(0, currentStageIdx + 1)} of {STAGES.length}
        </span>
        {done ? <span className="success-text">✓ Complete</span> : null}
        {awaitingReview ? <span className="warning-text">⏳ Awaiting your review</span> : null}
      </div>

      <StageTimeline
        currentStage={status.current_stage}
        status={status.status}
        erroredStages={erroredStages}
        messages={messages}
      />

      {/* Live agent console — what the engine is doing, agent by agent. */}
      <div className="section-title" style={{ marginTop: 'var(--space-lg)' }}>
        Engine activity
      </div>
      <LiveConsole
        events={status.events ?? []}
        status={status.status}
        currentStage={status.current_stage}
        costSummary={costSummary}
      />

      {/* Live module status */}
      {!done && !rejected && !isError ? (
        <Card className="mt-md">
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Module status
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {modules.map((m) => {
              const isCurrent = status.current_stage === m.key;
              const isPast = currentStageIdx > modules.findIndex((x) => x.key === m.key);
              return (
                <div key={m.key} className="row-between" style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--color-neutral-50)' }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>{m.label}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {m.desc}
                    </div>
                  </div>
                  <span>
                    {isCurrent ? (
                      <span className="spinner" style={{ width: 14, height: 14 }} />
                    ) : isPast ? (
                      <span className="ok-text">✓</span>
                    ) : (
                      <span className="muted">○</span>
                    )}
                  </span>
                </div>
              );
            })}
            {awaitingReview ? (
              <div className="row-between" style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--color-warning-bg)' }}>
                <div>
                  <strong style={{ fontSize: 14 }}>Research review</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    The researcher finished. You decide what the writer uses.
                  </div>
                </div>
                <Button onClick={() => navigate(`/research/${id}`)}>Review research</Button>
              </div>
            ) : null}
          </div>
          {runningModule ? (
            <p className="muted mt-md" style={{ fontSize: 13 }}>
              Now running: <strong>{runningModule.label}</strong> — {runningModule.desc}
            </p>
          ) : null}
        </Card>
      ) : null}

      {done ? (
        <Card className="mt-md">
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Draft is ready
          </h3>
          <p className="muted">
            Every stage produced output you can inspect — the research dossier, the writer spec, the draft, and the
            edited version.
          </p>
          <Button onClick={() => navigate(`/draft/${id}`)}>View Draft</Button>
        </Card>
      ) : null}

      {rejected ? (
        <Card className="mt-md">
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Angle {status.status === 'killed' ? 'rejected' : 'needs a pivot'}
          </h3>
          <p>{status.decision?.reasoning}</p>
          {status.decision?.suggested_pivot ? (
            <p>
              <strong>Suggested pivot:</strong> {status.decision.suggested_pivot}
            </p>
          ) : null}
          <Button variant="secondary" className="mt-sm" onClick={() => navigate('/new')}>
            Adjust and try again
          </Button>
        </Card>
      ) : null}

      {isError ? (
        <Card className="mt-md">
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Something went wrong
          </h3>
          <p className="error-text">{status.error_message ?? 'The run failed. Try again.'}</p>
          <Button variant="secondary" className="mt-sm" onClick={() => navigate('/new')}>
            Start over
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
