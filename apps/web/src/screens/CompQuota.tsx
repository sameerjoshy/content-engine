import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface CompQuotaResponse {
  verdict: string;
  quotas: { rep: string; quota: string; rationale: string }[];
  reconciliation: { required: string; covered: string; verdict: string; reconciles: boolean };
  comp_model: { levers: string[]; guardrails: string[] };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

export default function CompQuota() {
  usePageTitle('Comp & Quota');
  const [territoryData, setTerritoryData] = useState('');
  const [coverage, setCoverage] = useState('');
  const [compStructure, setCompStructure] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CompQuotaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (territoryData.trim().length < 10) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<CompQuotaResponse>('/api/comp-quota', {
        method: 'POST',
        body: JSON.stringify({ territory_data: territoryData.trim(), coverage: coverage.trim() || undefined, comp_structure: compStructure.trim() || undefined }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Design failed');
    } finally {
      setRunning(false);
    }
  }, [territoryData, coverage, compStructure]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Comp &amp; Quota</h1>
        <p>
          <strong>What it does:</strong> designs quota and comp plans grounded in capacity, coverage, and history — targets
          reps believe and the math supports.
          <br />
          <strong>What you get:</strong> per-rep quotas with rationale, the coverage reconciliation, and the comp levers
          and guardrails.
          <br />
          <strong>What it needs:</strong> territory data — add pipeline coverage to reconcile the quotas.
          <br />
          <strong>How it stays honest:</strong> the reality gate flags quotas the pipeline cannot carry — a quota the
          coverage cannot support is a plan for failure, not a target.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="seo-field">
            <label>Territory data</label>
            <Textarea value={territoryData} placeholder="Roster, tenure (ramped/new), territory, capacity, historical attainment." onChange={(e) => setTerritoryData(e.target.value)} rows={5} />
          </div>
          <div className="seo-field">
            <label>Pipeline coverage (optional)</label>
            <Textarea value={coverage} placeholder="Coverage by stage/territory, e.g. 'Total pipeline $3.4M against a $1.8M target.'" onChange={(e) => setCoverage(e.target.value)} rows={3} />
          </div>
          <div className="seo-field">
            <label>Comp structure (optional)</label>
            <Textarea value={compStructure} placeholder="Current or target plan: base/variable split, accelerators, caps." onChange={(e) => setCompStructure(e.target.value)} rows={3} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={territoryData.trim().length < 10 || running}>
            {running ? 'Designing…' : 'Design the plan'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Reading capacity → setting quotas → reconciling against coverage…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line" style={{ borderLeftColor: result.reconciliation.reconciles ? '#388e3c' : '#f57c00' }}>
              <h2>{result.reconciliation.reconciles ? 'The plan holds' : 'The plan does not reconcile'}</h2>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="tag">required {result.reconciliation.required}</span>
                <span className="tag">covered {result.reconciliation.covered}</span>
              </div>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Before you publish it</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.quotas.length ? (
            <section className="seo-section">
              <h2>Quotas</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Rep</th><th>Quota</th><th>Rationale</th></tr></thead>
                  <tbody>
                    {result.quotas.map((q, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{q.rep}</strong></td>
                        <td className="text-sm">{q.quota}</td>
                        <td className="muted text-sm">{q.rationale}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="seo-section">
            <h2>Comp model</h2>
            <div className="seo-fix-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <article className="seo-fix seo-fix-p3">
                <h3>Levers</h3>
                <ul>{result.comp_model.levers.map((l, i) => <li key={i} className="text-sm">{l}</li>)}</ul>
              </article>
              <article className="seo-fix seo-fix-p1">
                <h3>Guardrails</h3>
                <ul>{result.comp_model.guardrails.map((g, i) => <li key={i} className="text-sm">{g}</li>)}</ul>
              </article>
            </div>
            {result.reconciliation.verdict ? <p className="text-sm" style={{ marginTop: 12 }}><strong>Reconciliation:</strong> {result.reconciliation.verdict}</p> : null}
          </section>

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