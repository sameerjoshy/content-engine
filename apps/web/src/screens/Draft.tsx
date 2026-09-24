import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import type { DraftResponse } from '../types';
import Markdown from '../components/Markdown';
import { Button, Card, Modal, Spinner } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

const STAGE_OPTIONS = [
  { key: 'researcher', label: 'Research Dossier' },
  { key: 'spec_builder', label: 'Writer Spec' },
  { key: 'sowhat', label: 'Demand Check' },
  { key: 'pov', label: 'Proprietary POV' },
  { key: 'writer', label: 'Draft' },
  { key: 'editor', label: 'Edited Draft' },
];

interface ClaimScore {
  claim: string;
  confidence: number;
  supported: boolean;
  source_url?: string;
}

interface PublishResponse {
  file_url: string;
  filename: string;
  destination: string;
  content: string;
}

interface DistributeResponse {
  linkedin: string;
  youtube: string;
  substack: string;
  x_thread: string;
}

export default function Draft() {
  usePageTitle('Draft');
  const { id } = useParams<{ id: string }>();
  const [stage, setStage] = useState('editor');
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [destination, setDestination] = useState<'markdown' | 'linkedin'>('markdown');
  const [publishResult, setPublishResult] = useState<PublishResponse | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [reviseText, setReviseText] = useState('');
  const [revising, setRevising] = useState(false);
  const [reviseError, setReviseError] = useState<string | null>(null);
  const [distributeOpen, setDistributeOpen] = useState(false);
  const [distributeTab, setDistributeTab] = useState<'linkedin' | 'youtube' | 'substack' | 'x_thread'>('linkedin');
  const [distribute, setDistribute] = useState<DistributeResponse | null>(null);
  const [distributing, setDistributing] = useState(false);
  const [distributeError, setDistributeError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailing, setEmailing] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);

  const load = useCallback(
    async (s: string) => {
      setLoading(true);
      setError(null);
      try {
        const r = await api<DraftResponse>(`/api/draft/${id}/${s}`);
        setDraft(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load draft');
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    load(stage);
  }, [stage, load]);

  const meta = (draft?.meta ?? {}) as Record<string, unknown>;
  const quality = typeof meta.quality_score === 'number' ? meta.quality_score : null;
  const claimScores = Array.isArray(meta.claim_scores) ? (meta.claim_scores as ClaimScore[]) : [];

  const publish = async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      const r = await api<PublishResponse>(`/api/publish/${id}`, {
        method: 'POST',
        body: JSON.stringify({ destination }),
      });
      setPublishResult(r);
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const revise = async () => {
    if (!reviseText.trim()) return;
    setRevising(true);
    setReviseError(null);
    try {
      const r = await api<DraftResponse>(`/api/revise/${id}`, {
        method: 'POST',
        body: JSON.stringify({ instruction: reviseText }),
      });
      setDraft(r);
      setReviseText('');
      setReviseOpen(false);
    } catch (e) {
      setReviseError(e instanceof Error ? e.message : 'Revision failed');
    } finally {
      setRevising(false);
    }
  };

  const distributeArticle = async () => {
    setDistributing(true);
    setDistributeError(null);
    try {
      const r = await api<DistributeResponse>(`/api/distribute/${id}`, { method: 'POST' });
      setDistribute(r);
    } catch (e) {
      setDistributeError(e instanceof Error ? e.message : 'Distribution failed');
    } finally {
      setDistributing(false);
    }
  };

  const copyToClipboard = () => {
    if (draft) navigator.clipboard.writeText(draft.content).then(() => alert('Copied to clipboard'));
  };

  const copyVariant = (text: string) => {
    navigator.clipboard.writeText(text).then(() => alert(`Copied ${distributeTab} variant to clipboard`));
  };

  const sendNewsletter = async () => {
    const to = emailTo
      .split(/[,\s]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (!to.length) return;
    setEmailing(true);
    setEmailResult(null);
    try {
      const r = await api<{ ok: boolean; to: string[]; subject: string }>(`/api/email/${id}`, {
        method: 'POST',
        body: JSON.stringify({ to }),
      });
      setEmailResult(`Sent to ${r.to.join(', ')} — "${r.subject}"`);
    } catch (e) {
      setEmailResult(e instanceof Error ? e.message : 'Email failed');
    } finally {
      setEmailing(false);
    }
  };

  const refreshArticle = async () => {
    if (!window.confirm('Re-run this topic with fresh research? This creates a new version (new session).')) return;
    setRefreshing(true);
    try {
      const r = await api<{ session_id: string }>(`/api/refresh/${id}`, { method: 'POST' });
      window.location.href = `/workflow/${r.session_id}`;
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div>
      <div className="page-head row-between">
        <div>
          <h1>Your Draft</h1>
          <p>
            {draft ? draft.session_id.slice(0, 8) : '…'} · switch stages to see how the article evolved
          </p>
        </div>
        <div className="row">
          <Button variant="secondary" onClick={() => setReviseOpen(true)} disabled={stage !== 'editor' || !draft}>
            Revise
          </Button>
          <Button variant="secondary" onClick={() => { setDistribute(null); setDistributeOpen(true); }} disabled={stage !== 'editor' || !draft}>
            Distribute
          </Button>
          <Button variant="secondary" onClick={copyToClipboard} disabled={!draft}>
            Copy
          </Button>
          <Button variant="secondary" onClick={refreshArticle} disabled={stage !== 'editor' || !draft || refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button onClick={() => setShowPublish(true)} disabled={stage !== 'editor' || !draft}>
            Publish
          </Button>
        </div>
      </div>

      <div className="studio-tabs">
        {STAGE_OPTIONS.map((s) => (
          <button key={s.key} className={`studio-tab ${stage === s.key ? 'active' : ''}`} onClick={() => setStage(s.key)}>
            {s.label}
            {s.key === 'editor' && quality != null ? ` · ${quality}/10` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <Card>
          <p className="error-text">{error}</p>
        </Card>
      ) : draft ? (
        <>
          {stage === 'editor' && (
            <Card className="mb-md">
              <h3 className="section-title" style={{ marginTop: 0 }}>
                Editor's notes
              </h3>
              {quality != null ? (
                <p>
                  <strong>Quality:</strong> {quality}/10
                </p>
              ) : null}
              {Array.isArray(meta.unsupported_claims) && (meta.unsupported_claims as unknown[]).length > 0 ? (
                <>
                  <p className="error-text">⚠️ Fabricated facts removed / flagged (verifiable claims with no source):</p>
                  <ul className="flag-list">
                    {(meta.unsupported_claims as unknown[]).map((c, i) => {
                      const item = typeof c === 'string' ? { claim: c, kind: 'fact' } : (c as { claim: string; kind?: string });
                      const isAnalysis = item.kind === 'analysis';
                      return (
                        <li key={i}>
                          {isAnalysis ? (
                            <>
                              <span className="muted">💭 Analysis (kept as brand POV):</span> {item.claim}
                            </>
                          ) : (
                            <>
                              <span className="error-text">✕ Fact:</span> {item.claim}
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : null}
              {typeof meta.main_gap === 'string' ? <p className="muted">Biggest gap: {meta.main_gap}</p> : null}
              {claimScores.length > 0 ? (
                <>
                  <p className="muted mt-sm">Fact-check confidence by claim:</p>
                  <ul className="flag-list">
                    {claimScores.map((c, i) => (
                      <li key={i}>
                        <span className={c.supported ? 'ok-text' : 'error-text'}>
                          {c.supported ? '✓' : '✕'} {Math.round(c.confidence * 100)}%
                        </span>{' '}
                        {c.claim}
                        {c.source_url ? (
                          <>
                            {' '}
                            <a href={c.source_url} target="_blank" rel="noreferrer" className="muted">
                              (source)
                            </a>
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {meta.proof_check ? (
                <p className="muted mt-sm">
                  <strong>Credibility check:</strong>{' '}
                  {Array.isArray((meta.proof_check as { missing?: string[] }).missing) &&
                  (meta.proof_check as { missing: string[] }).missing.length > 0 ? (
                    <span className="error-text">
                      missing: {(meta.proof_check as { missing: string[] }).missing.join(', ')}
                    </span>
                  ) : (
                    <span className="ok-text">all required proof present ✓</span>
                  )}
                </p>
              ) : null}
              {(meta as { composite?: unknown }).composite ? (
                <QualityGate meta={meta} />
              ) : null}
              {typeof meta.edits === 'string' ? (
                <details className="mt-sm">
                  <summary className="muted">Show full edit notes</summary>
                  <pre className="mono">{meta.edits}</pre>
                </details>
              ) : null}
            </Card>
          )}
          <Card>
            <Markdown content={draft.content} />
          </Card>
        </>
      ) : null}

      {distributeOpen ? (
        <Modal
          title="Distribute this piece"
          subtitle="Generate channel-ready versions from the same fact-checked draft + evidence. No variant can invent facts."
          onClose={() => setDistributeOpen(false)}
        >
          {distributeError ? <p className="error-text mb-md">{distributeError}</p> : null}
          {!distribute ? (
            <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
              <Button onClick={distributeArticle} disabled={distributing}>
                {distributing ? 'Generating… (3 variants)' : 'Generate LinkedIn + YouTube + Newsletter'}
              </Button>
              <Button variant="secondary" onClick={() => setDistributeOpen(false)} disabled={distributing}>
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <div className="studio-tabs">
                {(['linkedin', 'youtube', 'substack', 'x_thread'] as const).map((t) => (
                  <button key={t} className={`studio-tab ${distributeTab === t ? 'active' : ''}`} onClick={() => setDistributeTab(t)}>
                    {t === 'linkedin' ? 'LinkedIn' : t === 'youtube' ? 'YouTube' : t === 'substack' ? 'Substack' : 'X Thread'}
                  </button>
                ))}
              </div>
              <textarea className="input mono" rows={14} readOnly value={distribute[distributeTab]} onFocus={(e) => e.currentTarget.select()} />
              {distributeTab === 'substack' ? (
                <div className="mt-md">
                  <label className="muted" style={{ display: 'block', marginBottom: 6 }}>
                    Send this edition as an email (comma-separated recipients)
                  </label>
                  <div className="row" style={{ gap: 8 }}>
                    <input className="input" value={emailTo} placeholder="you@company.com, colleague@company.com" onChange={(e) => setEmailTo(e.target.value)} />
                    <Button onClick={sendNewsletter} disabled={emailing || !emailTo.trim()}>
                      {emailing ? 'Sending…' : 'Send email'}
                    </Button>
                  </div>
                  {emailResult ? <p className="muted mt-sm">{emailResult}</p> : null}
                </div>
              ) : null}
              <div className="modal-actions">
                <Button onClick={() => copyVariant(distribute[distributeTab])}>Copy {distributeTab}</Button>
                <Button variant="secondary" onClick={() => { setDistribute(null); distributeArticle(); }} disabled={distributing}>
                  Regenerate
                </Button>
                <Button variant="secondary" onClick={() => setDistributeOpen(false)}>Close</Button>
              </div>
            </>
          )}
        </Modal>
      ) : null}

      {reviseOpen ? (
        <Modal title="Revise the draft" subtitle="Tell the editor what to change; it re-edits and fact-checks." onClose={() => setReviseOpen(false)}>
          {reviseError ? <p className="error-text mb-md">{reviseError}</p> : null}
          <textarea
            className="input"
            rows={3}
            placeholder='e.g. "Make the opening punchier, cut the second example, add a stronger call to action."'
            value={reviseText}
            onChange={(e) => setReviseText(e.target.value)}
          />
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setReviseOpen(false)} disabled={revising}>
              Cancel
            </Button>
            <Button onClick={revise} disabled={revising || !reviseText.trim()}>
              {revising ? 'Revising…' : 'Apply revision'}
            </Button>
          </div>
        </Modal>
      ) : null}

      {showPublish && !publishResult ? (
        <Modal title="Publish Your Article" subtitle="Export the edited draft as a file." onClose={() => setShowPublish(false)}>
          {publishError ? <p className="error-text mb-md">{publishError}</p> : null}
          <div className="field">
            <label>Destination</label>
            <select className="input" value={destination} onChange={(e) => setDestination(e.target.value as 'markdown' | 'linkedin')}>
              <option value="markdown">Markdown file (blogs, CMS, newsletter)</option>
              <option value="linkedin">LinkedIn post (plain text)</option>
            </select>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setShowPublish(false)} disabled={publishing}>
              Cancel
            </Button>
            <Button onClick={publish} disabled={publishing}>
              {publishing ? 'Publishing…' : destination === 'linkedin' ? 'Publish as LinkedIn post' : 'Publish to Markdown'}
            </Button>
          </div>
        </Modal>
      ) : null}

      {publishResult ? (
        <Modal title="✓ Article published successfully" subtitle={publishResult.filename} onClose={() => {}}>
          {publishResult.destination === 'linkedin' ? (
            <>
              <p>Copy-paste this into LinkedIn:</p>
              <textarea className="input mono" rows={8} readOnly value={publishResult.content} onFocus={(e) => e.currentTarget.select()} />
            </>
          ) : (
            <p>
              <a href={publishResult.file_url} target="_blank" rel="noreferrer">
                Open the markdown file
              </a>
            </p>
          )}
          <div className="modal-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setPublishResult(null);
                setShowPublish(false);
              }}
            >
              Close
            </Button>
            <Button onClick={() => (window.location.href = '/')}>Create Another Article</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/**
 * v1.2 composite quality gate (VOICE_SYSTEM.md §9): deterministic-dominated
 * score + the human publish gate's two claim-confirmation questions. The
 * composite is a reject filter, not a ranker — the anti-slop wall is the
 * operator's answer to the two questions below.
 */
function QualityGate({ meta }: { meta: Record<string, unknown> }) {
  const c = (meta.composite as {
    deterministic?: number;
    subjective?: number;
    composite?: number;
    pass?: boolean;
    breakdown?: Record<string, number>;
  }) ?? {};
  const voices = (meta.voice_scores as Record<string, number | undefined>) ?? {};
  const moves = Array.isArray(meta.original_moves) ? (meta.original_moves as string[]) : [];
  const decorations = Array.isArray(meta.decorative_devices) ? (meta.decorative_devices as string[]) : [];

  return (
    <div className="quality-gate mt-md" style={{ border: '1px solid var(--border, #333)', borderRadius: 8, padding: '12px 16px' }}>
      <h4 style={{ marginTop: 0, marginBottom: 8 }}>Quality gate (deterministic-dominated)</h4>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
        <div>
          <span className="muted">Composite</span>{' '}
          <strong>{c.composite != null ? c.composite.toFixed(2) : '—'}</strong>
          {c.pass != null ? (c.pass ? <span className="ok-text"> ✓ above bar</span> : <span className="error-text"> ✕ below bar</span>) : null}
        </div>
        <div>
          <span className="muted">Deterministic</span>{' '}
          <strong>{c.deterministic != null ? c.deterministic.toFixed(2) : '—'}</strong>{' '}
          <span className="muted">(≥0.45 required)</span>
        </div>
        <div>
          <span className="muted">Subjective (tiebreaker)</span>{' '}
          <strong>{c.subjective != null ? c.subjective.toFixed(2) : '—'}</strong>
        </div>
      </div>
      {c.breakdown ? (
        <ul className="flag-list mt-sm" style={{ marginBottom: 0 }}>
          {Object.entries(c.breakdown).map(([k, v]) => (
            <li key={k}>
              <span className={Number(v) >= 0.45 ? 'ok-text' : 'error-text'}>{Number(v).toFixed(2)}</span> {k.replace(/_/g, ' ')}
            </li>
          ))}
        </ul>
      ) : null}
      {Object.values(voices).some((v) => v != null) ? (
        <p className="muted mt-sm" style={{ marginBottom: 0 }}>
          Voice: edge {voices.edge_authenticity?.toFixed(2) ?? '—'} · earned uncertainty {voices.earned_uncertainty?.toFixed(2) ?? '—'} · human voice {voices.human_voice?.toFixed(2) ?? '—'} · changed-mind {voices.changed_mind_strength?.toFixed(2) ?? '—'}
        </p>
      ) : null}
      {moves.length ? (
        <p className="muted mt-sm" style={{ marginBottom: 0 }}>
          Original moves: {moves.join(' · ')}
        </p>
      ) : null}
      {decorations.length ? (
        <p className="error-text mt-sm" style={{ marginBottom: 0 }}>
          ⚠️ Decorative mechanics flagged: {decorations.join(' · ')}
        </p>
      ) : null}
      <details className="mt-sm">
        <summary className="muted" style={{ cursor: 'pointer' }}>
          Human publish gate — the two questions
        </summary>
        <ol style={{ marginTop: 8, marginBottom: 0 }}>
          <li>
            <strong>Thinking test:</strong> is there a claim in here you'd defend in a meeting that you couldn't
            find in any source?
          </li>
          <li>
            <strong>Actionability test:</strong> would this change what the reader does next?
          </li>
        </ol>
        <p className="muted mt-sm" style={{ marginBottom: 0 }}>
          Both must be yes to ship. Recognize-but-inert is the slop failure mode.
        </p>
      </details>
    </div>
  );
}
