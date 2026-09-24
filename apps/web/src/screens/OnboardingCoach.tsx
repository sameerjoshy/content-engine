import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface OnboardingResponse {
  verdict: string;
  first_value: { milestone: string; when: string; evidence: string };
  milestones: { when: string; milestone: string; owner: string; proof: string }[];
  success_metrics: { metric: string; target: string; proves: string }[];
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

export default function OnboardingCoach() {
  usePageTitle('Onboarding Coach');
  const [accountContext, setAccountContext] = useState('');
  const [productSurface, setProductSurface] = useState('');
  const [window, setWindow] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<OnboardingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (accountContext.trim().length < 10 || productSurface.trim().length < 5) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<OnboardingResponse>('/api/onboarding', {
        method: 'POST',
        body: JSON.stringify({ account_context: accountContext.trim(), product_surface: productSurface.trim(), window: window.trim() || undefined }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Plan failed');
    } finally {
      setRunning(false);
    }
  }, [accountContext, productSurface, window]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Onboarding Coach</h1>
        <p>
          <strong>What it does:</strong> designs the path from day one to the customer's first real win — milestones, owners,
          and the metrics that prove value landed.
          <br />
          <strong>What you get:</strong> the first-value moment, the ordered milestone path, and the success metrics.
          <br />
          <strong>What it needs:</strong> the account context and the product surface (the workflows they must adopt).
          <br />
          <strong>How it stays honest:</strong> the time-to-value gate flags a plan where first value lands past your
          window — enthusiasm fades before value arrives.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="seo-field">
            <label>Account context</label>
            <Textarea value={accountContext} placeholder="What this customer needs, their team, their goal for buying." onChange={(e) => setAccountContext(e.target.value)} rows={4} />
          </div>
          <div className="seo-field">
            <label>Product surface (workflows to adopt)</label>
            <Textarea value={productSurface} placeholder="The core workflows they need to adopt, e.g. 'connect data source, build first report, invite team'." onChange={(e) => setProductSurface(e.target.value)} rows={3} />
          </div>
          <div className="seo-field">
            <label>Plan window (optional)</label>
            <Input value={window} placeholder="e.g. 30 days" onChange={(e) => setWindow(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={accountContext.trim().length < 10 || productSurface.trim().length < 5 || running}>
            {running ? 'Designing…' : 'Design the onboarding path'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Finding the first win → sequencing the milestones → defining the metrics…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line">
              <h2>First value: {result.first_value.when}</h2>
              <p className="seo-bl-verdict">{result.first_value.milestone}</p>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.first_value.evidence}</p>
              <p className="muted text-sm" style={{ marginTop: 8 }}>{result.verdict}</p>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Before you start</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.milestones.length ? (
            <section className="seo-section">
              <h2>The path</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>When</th><th>Milestone</th><th>Owner</th><th>Proof</th></tr></thead>
                  <tbody>
                    {result.milestones.map((m, i) => (
                      <tr key={i}>
                        <td className="text-sm">{m.when}</td>
                        <td><strong className="text-sm">{m.milestone}</strong></td>
                        <td className="muted text-sm">{m.owner}</td>
                        <td className="muted text-sm">{m.proof}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {result.success_metrics.length ? (
            <section className="seo-section">
              <h2>What proves value landed</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Metric</th><th>Target</th><th>Proves</th></tr></thead>
                  <tbody>
                    {result.success_metrics.map((m, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{m.metric}</strong></td>
                        <td className="text-sm">{m.target}</td>
                        <td className="muted text-sm">{m.proves}</td>
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