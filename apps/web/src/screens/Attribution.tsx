import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface AttributionResponse {
  verdict: string;
  model: string;
  by_engine: { engine: string; revenue: string; share: string }[];
  by_touch: { touch: string; revenue: string; share: string }[];
  spend_signal: { move: string; why: string; expected: string }[];
  data_quality: { has_touch_data: boolean; note: string };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

const MODELS = ['first', 'last', 'linear', 'custom'];

export default function Attribution() {
  usePageTitle('Attribution');
  const [closedDeals, setClosedDeals] = useState('');
  const [model, setModel] = useState('linear');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AttributionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (closedDeals.trim().length < 20) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<AttributionResponse>('/api/attribution', {
        method: 'POST',
        body: JSON.stringify({ closed_deals: closedDeals.trim(), model }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Attribution failed');
    } finally {
      setRunning(false);
    }
  }, [closedDeals, model]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Attribution</h1>
        <p>
          <strong>What it does:</strong> attributes closed revenue back across the journey — which touch, channel, and
          engine actually carried the deal.
          <br />
          <strong>What you get:</strong> revenue by engine and by touch, and where the next dollar earns most.
          <br />
          <strong>What it needs:</strong> closed deals with their touch history, and the model to attribute under.
          <br />
          <strong>How it stays honest:</strong> attribution needs touch data — with none, the data gate says so rather than
          guessing a channel mix.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="seo-field">
            <label>Closed deals + touch history</label>
            <Textarea value={closedDeals} placeholder="Deal, Outcome, Amount, Touch 1, Touch 2, Touch 3&#10;Acme, Won, 45000, LinkedIn ad, webinar, demo&#10;..." onChange={(e) => setClosedDeals(e.target.value)} rows={8} />
          </div>
          <div className="seo-field">
            <label>Attribution model</label>
            <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
              {MODELS.map((m) => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={closedDeals.trim().length < 20 || running}>
            {running ? 'Attributing…' : 'Attribute the revenue'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Reading closed deals → applying the {model} model → ranking the spend signal…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line">
              <h2>Attribution — {result.model} model</h2>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <span className={`tag ${result.data_quality.has_touch_data ? 'tag-own' : 'tag-p1'}`}>{result.data_quality.has_touch_data ? 'Touch data present' : 'No touch data'}</span>
              </div>
            </div>
          </section>

          <section className="seo-section">
            <div className="seo-risk-box">
              <h2>⚠️ Data quality</h2>
              <div className="seo-risk-item">
                <p className="muted text-sm" style={{ width: '100%', margin: 0 }}>{result.data_quality.note}</p>
              </div>
            </div>
          </section>

          {result.by_engine.length ? (
            <section className="seo-section">
              <h2>Revenue by engine</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Engine</th><th>Revenue</th><th>Share</th></tr></thead>
                  <tbody>
                    {result.by_engine.map((e, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{e.engine}</strong></td>
                        <td className="text-sm">{e.revenue}</td>
                        <td className="muted text-sm">{e.share}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {result.by_touch.length ? (
            <section className="seo-section">
              <h2>Revenue by touch</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Touch</th><th>Revenue</th><th>Share</th></tr></thead>
                  <tbody>
                    {result.by_touch.map((t, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{t.touch}</strong></td>
                        <td className="text-sm">{t.revenue}</td>
                        <td className="muted text-sm">{t.share}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {result.spend_signal.length ? (
            <section className="seo-section">
              <h2>Where the next dollar earns most</h2>
              <div className="seo-fix-grid">
                {result.spend_signal.map((s, i) => (
                  <article key={i} className="seo-fix seo-fix-p3">
                    <h3 style={{ margin: 0, fontSize: 15 }}>{s.move}</h3>
                    <p className="muted text-sm" style={{ marginTop: 6 }}>{s.why}</p>
                    <p className="text-sm" style={{ marginTop: 4 }}><strong>Expected:</strong> {s.expected}</p>
                  </article>
                ))}
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