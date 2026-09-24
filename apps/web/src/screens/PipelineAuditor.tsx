import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface IntegrityIssue { deal: string; stage: string; issue: string; evidence: string; severity: 'critical' | 'high' | 'medium' }

interface PipelineAuditorResponse {
  verdict: string;
  integrity: IntegrityIssue[];
  aged: { deal: string; stage: string; note: string }[];
  forecast_risk: string;
  counts: { mismatches: number; aged: number; audited: number };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

const SEV_CLASS: Record<IntegrityIssue['severity'], string> = { critical: 'p1', high: 'p2', medium: 'p3' };

export default function PipelineAuditor() {
  usePageTitle('Pipeline Auditor');
  const [pipelineData, setPipelineData] = useState('');
  const [auditDepth, setAuditDepth] = useState('standard');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PipelineAuditorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (pipelineData.trim().length < 20) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<PipelineAuditorResponse>('/api/pipeline-audit', {
        method: 'POST',
        body: JSON.stringify({ pipeline_data: pipelineData.trim(), audit_depth: auditDepth }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Audit failed');
    } finally {
      setRunning(false);
    }
  }, [pipelineData, auditDepth]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Pipeline Auditor</h1>
        <p>
          <strong>What it does:</strong> audits whether each deal's stage is <em>earned</em> by evidence of buyer engagement —
          late-stage deals with no activity, aged deals that never move, pipeline that is full but empty.
          <br />
          <strong>What you get:</strong> stage/evidence mismatches ranked by severity, the aged deals, and what the pipeline
          really supports.
          <br />
          <strong>What it needs:</strong> pipeline data — deals with stage, value, and activity.
          <br />
          <strong>How it stays honest:</strong> a deal is not clean just because its fields are complete — the evidence gate
          flags every stage that isn't backed by engagement.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="seo-field">
            <label>Pipeline data (CSV or rows)</label>
            <Textarea value={pipelineData} placeholder="Deal, Stage, Amount, Last activity, Activity type, Days in stage&#10;Acme, Negotiation, 45000, 3 days ago, meeting, 5&#10;..." onChange={(e) => setPipelineData(e.target.value)} rows={8} />
          </div>
          <div className="seo-field">
            <label>Audit depth</label>
            <select className="input" value={auditDepth} onChange={(e) => setAuditDepth(e.target.value)}>
              <option value="standard">Standard</option>
              <option value="deep">Deep</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={pipelineData.trim().length < 20 || running}>
            {running ? 'Auditing…' : 'Audit the pipeline'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Checking each stage against its evidence → aging the deals → assessing forecast risk…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line" style={{ borderLeftColor: result.counts.mismatches ? '#d32f2f' : '#388e3c' }}>
              <h2>Is the pipeline real?</h2>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="tag">{result.counts.audited} audited</span>
                <span className="tag tag-p1">{result.counts.mismatches} mismatches</span>
                <span className="tag tag-p2">{result.counts.aged} aged</span>
              </div>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Forecast risk</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.forecast_risk ? (
            <section className="seo-section">
              <h2>What the pipeline actually supports</h2>
              <div className="seo-callout"><p>{result.forecast_risk}</p></div>
            </section>
          ) : null}

          {result.integrity.length ? (
            <section className="seo-section">
              <h2>Stage/evidence mismatches</h2>
              <div className="seo-fix-grid">
                {result.integrity.map((it, i) => (
                  <article key={i} className={`seo-fix seo-fix-${SEV_CLASS[it.severity]}`}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: 15 }}>{it.deal} — {it.stage}</h3>
                      <span className={`tag tag-${SEV_CLASS[it.severity]}`}>{it.severity}</span>
                    </div>
                    <p className="text-sm" style={{ marginTop: 6 }}>{it.issue}</p>
                    <p className="muted text-sm" style={{ marginTop: 4 }}><strong>Evidence:</strong> {it.evidence}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {result.aged.length ? (
            <section className="seo-section">
              <h2>Aged deals</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Deal</th><th>Stage</th><th>Note</th></tr></thead>
                  <tbody>
                    {result.aged.map((a, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{a.deal}</strong></td>
                        <td className="muted text-sm">{a.stage}</td>
                        <td className="muted text-sm">{a.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="seo-section">
            <h2>Method</h2>
            <div className="seo-method">
              <div>
                <span className="seo-label">Measured</span>
                <ul>{result.measured_vs_inferred.measured.map((m, i) => <li key={i}>&#10003; {m}</li>)}</ul>
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