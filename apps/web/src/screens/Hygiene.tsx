import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface HygieneFinding { severity: 'blocker' | 'warning' | 'advisory'; issue: string; rows: string[]; impact: string }

interface HygieneResponse {
  verdict: string;
  findings: HygieneFinding[];
  impact: { raw_pipeline: string; at_risk: string; note: string };
  score: { value: number; label: string };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

const SEV_LABEL: Record<HygieneFinding['severity'], string> = { blocker: 'Blocker', warning: 'Warning', advisory: 'Advisory' };
const SEV_CLASS: Record<HygieneFinding['severity'], string> = { blocker: 'p1', warning: 'p2', advisory: 'p3' };

export default function Hygiene() {
  usePageTitle('Hygiene');
  const [pipelineExport, setPipelineExport] = useState('');
  const [auditScope, setAuditScope] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<HygieneResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (pipelineExport.trim().length < 30) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<HygieneResponse>('/api/hygiene', {
        method: 'POST',
        body: JSON.stringify({ pipeline_export: pipelineExport.trim(), audit_scope: auditScope.trim() || undefined }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Audit failed');
    } finally {
      setRunning(false);
    }
  }, [pipelineExport, auditScope]);

  const counts = result ? {
    blocker: result.findings.filter((f) => f.severity === 'blocker').length,
    warning: result.findings.filter((f) => f.severity === 'warning').length,
    advisory: result.findings.filter((f) => f.severity === 'advisory').length,
  } : null;

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Hygiene</h1>
        <p>
          <strong>What it does:</strong> audits your CRM pipeline export and tells you what's quietly breaking the
          forecast — missing amounts, impossible stages, stale deals, duplicates.
          <br />
          <strong>What you get:</strong> findings ranked blocker → warning → advisory, each citing the offending rows, plus
          the dollar impact and a hygiene score.
          <br />
          <strong>What it needs:</strong> a pipeline export (paste it in) — deals with stage, amount, close date, owner.
          <br />
          <strong>How it stays honest:</strong> every finding cites real rows from your export; blockers are separated
          from cosmetic issues so you fix the ones that matter first.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="seo-field">
            <label>Pipeline export (CSV or rows)</label>
            <Textarea value={pipelineExport} placeholder="Deal, Stage, Amount, Close date, Owner, Last activity&#10;Acme, Negotiation, 45000, 2026-01-15, Dana, 3 days ago&#10;..." onChange={(e) => setPipelineExport(e.target.value)} rows={8} />
          </div>
          <div className="seo-field">
            <label>Audit scope (optional)</label>
            <Input value={auditScope} placeholder="e.g. Q1 commit only, or full pipeline" onChange={(e) => setAuditScope(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={pipelineExport.trim().length < 30 || running}>
            {running ? 'Auditing…' : 'Audit the pipeline'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Parsing rows → flagging issues → ranking by forecast impact…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line">
              <h2>Can you trust this pipeline?</h2>
              <p className="seo-bl-verdict">{result.score.label} — {result.score.value}/100</p>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                {counts && counts.blocker ? <span className="tag tag-p1">{counts.blocker} blockers</span> : null}
                {counts && counts.warning ? <span className="tag tag-p2">{counts.warning} warnings</span> : null}
                {counts && counts.advisory ? <span className="tag tag-p3">{counts.advisory} advisory</span> : null}
              </div>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Forecast gate</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="seo-section">
            <h2>Forecast impact</h2>
            <div className="table-wrap">
              <table className="data-table">
                <tbody>
                  <tr><td><strong className="text-sm">Raw pipeline</strong></td><td className="text-sm">{result.impact.raw_pipeline}</td></tr>
                  <tr><td><strong className="text-sm">At risk</strong></td><td className="text-sm">{result.impact.at_risk}</td></tr>
                </tbody>
              </table>
            </div>
            {result.impact.note ? <p className="muted text-sm" style={{ marginTop: 8 }}>{result.impact.note}</p> : null}
          </section>

          <section className="seo-section">
            <h2>Findings — fix these, in this order</h2>
            <p className="seo-section-intro">Blockers corrupt the forecast. Warnings will bite. Advisory is cleanup.</p>
            <div className="seo-fix-grid">
              {result.findings.map((f, i) => (
                <article key={i} className={`seo-fix seo-fix-${SEV_CLASS[f.severity]}`}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{f.issue}</h3>
                    <span className={`tag tag-${SEV_CLASS[f.severity]}`}>{SEV_LABEL[f.severity]}</span>
                  </div>
                  {f.rows.length ? <p className="muted text-sm" style={{ marginTop: 6 }}>Rows: {f.rows.join(', ')}</p> : null}
                  {f.impact ? <p className="text-sm" style={{ marginTop: 4 }}>{f.impact}</p> : null}
                </article>
              ))}
            </div>
          </section>

          <section className="seo-section">
            <h2>Method</h2>
            <div className="seo-method">
              <div>
                <span className="seo-label">Measured</span>
                <ul>{result.measured_vs_inferred.measured.map((m, i) => <li key={i}>✓ {m}</li>)}</ul>
              </div>
              <div>
                <span className="seo-label">Inferred</span>
                <ul>{result.measured_vs_inferred.inferred.map((m, i) => <li key={i}>~ {m}</li>)}</ul>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}