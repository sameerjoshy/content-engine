import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import type { ResearchBrief, ResearchEvidence } from '../types';
import { Button, Card, Spinner } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

export default function ResearchReview() {
  usePageTitle('Research review');
  const { id } = useParams<{ id: string }>();
  const [brief, setBrief] = useState<ResearchBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [steer, setSteer] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<ResearchBrief>(`/api/research-brief/${id}`);
      setBrief(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load research');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/research-approve/${id}`, { method: 'POST', body: '{}' });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setBusy(false);
    }
  };

  const steerAndApprove = async () => {
    if (!steer.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/research-steer/${id}`, { method: 'POST', body: JSON.stringify({ instruction: steer }) });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Steer failed');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="container-narrow">
        <Card className="mt-lg">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            ✓ Research locked in
          </h2>
          <p className="muted">The pipeline is now writing the piece from this research.</p>
          <a className="btn btn-primary mt-md" href={`/workflow/${id}`}>
            Watch it run
          </a>
        </Card>
      </div>
    );
  }

  if (loading) return <Spinner />;
  if (error) return <p className="error-text">{error}</p>;
  if (!brief) return <p className="muted">No research to review.</p>;

  const proofLabel: Record<string, string> = {
    case_study: 'Named example',
    expert_quote: 'Expert quote',
    statistic: 'Statistic',
    frontier: 'Frontier / outlook',
    other: 'Other',
  };

  return (
    <div>
      <div className="page-head">
        <h1>Review the research</h1>
        <p>
          <strong>{brief.topic}</strong> — {brief.angle}
        </p>
      </div>

      {brief.gap_report ? (
        <Card className="mb-md">
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Credibility check
          </h3>
          {brief.gap_report.missing.length ? (
            <p className="error-text">
              Missing before writing: {brief.gap_report.missing.join(', ')} — you can steer the researcher below, or
              proceed and the editor will flag what it can't prove.
            </p>
          ) : (
            <p className="ok-text">All required proof present ✓</p>
          )}
        </Card>
      ) : null}

      <Card className="mb-md">
        <h3 className="section-title" style={{ marginTop: 0 }}>
          Research dossier
        </h3>
        <div className="mono" style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>
          {brief.dossier.slice(0, 6000)}
          {brief.dossier.length > 6000 ? '\n…' : ''}
        </div>
      </Card>

      <Card className="mb-md">
        <h3 className="section-title" style={{ marginTop: 0 }}>
          Evidence ({brief.evidence.length})
        </h3>
        <p className="muted mb-sm">Sorted by confidence. Recency = years since publish.</p>
        {brief.evidence.map((e: ResearchEvidence, i: number) => (
          <div key={i} className="ev-item" style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--color-neutral-100)' }}>
            <div className="row-between">
              <span className="tag">{proofLabel[e.proof_type ?? ''] ?? e.source_type}</span>
              <span className="muted" style={{ fontSize: 12 }}>
                confidence {Math.round((e.confidence ?? 0) * 100)}% ·{' '}
                {e.recency != null ? (e.recency === 0 ? 'this year' : `${e.recency}yr old`) : 'age unknown'}
              </span>
            </div>
            <p className="mt-sm" style={{ marginBottom: 4 }}>
              {e.claim}
            </p>
            <p className="muted" style={{ fontSize: 13 }}>
              {e.source_title} · <a href={e.source_url} target="_blank" rel="noreferrer">{e.source_url}</a>
            </p>
            {e.evidence_snippet ? <p className="muted mt-sm" style={{ fontSize: 13 }}>"{e.evidence_snippet.slice(0, 220)}{e.evidence_snippet.length > 220 ? '…' : ''}"</p> : null}
          </div>
        ))}
      </Card>

      <Card className="mb-md">
        <h3 className="section-title" style={{ marginTop: 0 }}>
          Steer the researcher (optional)
        </h3>
        <textarea
          className="input"
          rows={2}
          value={steer}
          placeholder='e.g. "Find more statistics" · "Add a real company example" · "More frontier outlook"'
          onChange={(e) => setSteer(e.target.value)}
        />
        <div className="row mt-md" style={{ gap: 12 }}>
          <Button variant="secondary" onClick={steerAndApprove} disabled={busy || !steer.trim()}>
            {busy ? 'Re-running research…' : 'Re-run research with this steer, then write'}
          </Button>
        </div>
      </Card>

      <div className="row" style={{ gap: 12 }}>
        <Button onClick={approve} disabled={busy}>
          {busy ? 'Approving…' : '✓ Research looks good — start writing'}
        </Button>
      </div>
    </div>
  );
}
