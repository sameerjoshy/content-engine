import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface CrossSellResponse {
  verdict: string;
  readiness: { score: number; label: string; why: string };
  brief: { product: string; evidence: string; framing: string };
  signals: { signal: string; meaning: string }[];
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

export default function CrossSellScout() {
  usePageTitle('Cross-Sell Scout');
  const [healthScore, setHealthScore] = useState('');
  const [usageSupport, setUsageSupport] = useState('');
  const [products, setProducts] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CrossSellResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!healthScore.trim() || usageSupport.trim().length < 10) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<CrossSellResponse>('/api/cross-sell', {
        method: 'POST',
        body: JSON.stringify({ health_score: healthScore.trim(), usage_support: usageSupport.trim(), products: products.trim() || undefined }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setRunning(false);
    }
  }, [healthScore, usageSupport, products]);

  const scoreClass = result ? (result.readiness.score >= 4 ? 'p3' : result.readiness.score === 3 ? 'p2' : 'p1') : 'p2';

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Cross-Sell Scout</h1>
        <p>
          <strong>What it does:</strong> scans health, usage, and support for the signals an account is ready for an
          adjacent product — and frames the cross-sell as a natural next step.
          <br />
          <strong>What you get:</strong> a readiness score with rationale, the product to lead with, the evidence, and the
          framing.
          <br />
          <strong>What it needs:</strong> the health score and the usage/support picture.
          <br />
          <strong>How it stays honest:</strong> the health gate blocks declining accounts — a cross-sell to an unhealthy
          account is a churn accelerant, so it holds the account back.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="seo-field">
            <label>Health score</label>
            <Input value={healthScore} placeholder="e.g. Healthy / green, or 'declining usage'" onChange={(e) => setHealthScore(e.target.value)} />
          </div>
          <div className="seo-field">
            <label>Usage + support</label>
            <Textarea value={usageSupport} placeholder="Where value has landed: usage patterns, teams, support themes." onChange={(e) => setUsageSupport(e.target.value)} rows={5} />
          </div>
          <div className="seo-field">
            <label>Available products (optional)</label>
            <Input value={products} placeholder="e.g. Analytics add-on, Premium tier, API access" onChange={(e) => setProducts(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={!healthScore.trim() || usageSupport.trim().length < 10 || running}>
            {running ? 'Scanning…' : 'Scan for cross-sell'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Reading signals → scoring readiness → framing the cross-sell…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line">
              <h2>Readiness: {result.readiness.score}/5 — {result.readiness.label}</h2>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.readiness.why}</p>
              <p className="muted text-sm" style={{ marginTop: 8 }}>{result.verdict}</p>
              <div className="row" style={{ gap: 12, marginTop: 10 }}>
                <span className={`tag tag-${scoreClass}`}>{result.readiness.label}</span>
              </div>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Before you pitch</h2>
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
            <h2>The cross-sell brief</h2>
            <div className="seo-callout">
              <p><strong>{result.brief.product}</strong></p>
              <p className="text-sm" style={{ marginTop: 8 }}><strong>Evidence:</strong> {result.brief.evidence}</p>
              <p className="muted text-sm" style={{ marginTop: 8 }}><strong>Framing:</strong> {result.brief.framing}</p>
            </div>
          </section>

          {result.signals.length ? (
            <section className="seo-section">
              <h2>The signals</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Signal</th><th>What it means</th></tr></thead>
                  <tbody>
                    {result.signals.map((s, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{s.signal}</strong></td>
                        <td className="muted text-sm">{s.meaning}</td>
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