import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface PricingResponse {
  verdict: string;
  anchor: string;
  package: { tier: string; price: string; includes: string }[];
  concession_floor: string;
  margin_guardrail: string;
  reasoning: string;
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

export default function PricingStrategist() {
  usePageTitle('Pricing Strategist');
  const [dealContext, setDealContext] = useState('');
  const [priceHistory, setPriceHistory] = useState('');
  const [marginFloor, setMarginFloor] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PricingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (dealContext.trim().length < 10) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<PricingResponse>('/api/pricing', {
        method: 'POST',
        body: JSON.stringify({ deal_context: dealContext.trim(), price_history: priceHistory.trim() || undefined, margin_floor: marginFloor.trim() || undefined }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pricing failed');
    } finally {
      setRunning(false);
    }
  }, [dealContext, priceHistory, marginFloor]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Pricing Strategist</h1>
        <p>
          <strong>What it does:</strong> advises deal-level pricing and packaging — the anchor, the packages, the concession
          floor, and the walk-away number.
          <br />
          <strong>What you get:</strong> an opening anchor, 2-4 package options, the floor you should not go below, and the
          margin guardrail.
          <br />
          <strong>What it needs:</strong> the deal context — add price history and your margin floor to ground it.
          <br />
          <strong>How it stays honest:</strong> the margin gate flags any recommendation that dips below your floor, and an
          unverified guardrail is named as such.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="seo-field">
            <label>Deal context</label>
            <Textarea value={dealContext} placeholder="What they need, the deal size, competitive situation, budget signals, timeline." onChange={(e) => setDealContext(e.target.value)} rows={5} />
          </div>
          <div className="seo-field">
            <label>Price history (optional)</label>
            <Textarea value={priceHistory} placeholder="Recent wins/losses by price point, e.g. 'Two similar deals closed at $45k and $52k; one lost at $68k.'" onChange={(e) => setPriceHistory(e.target.value)} rows={3} />
          </div>
          <div className="seo-field">
            <label>Margin floor (optional)</label>
            <Input value={marginFloor} placeholder="e.g. 30% gross margin, or a floor price of $30k" onChange={(e) => setMarginFloor(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={dealContext.trim().length < 10 || running}>
            {running ? 'Pricing…' : 'Price this deal'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Reading the deal → benchmarking history → setting the guardrail…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line">
              <h2>The anchor</h2>
              <p className="seo-bl-verdict">{result.anchor}</p>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Before you quote</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.package.length ? (
            <section className="seo-section">
              <h2>The packages</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Tier</th><th>Price</th><th>Includes</th></tr></thead>
                  <tbody>
                    {result.package.map((p, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{p.tier}</strong></td>
                        <td className="text-sm">{p.price}</td>
                        <td className="muted text-sm">{p.includes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="seo-section">
            <div className="seo-fix-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="seo-fix seo-fix-p2">
                <h3 style={{ margin: 0 }}>Concession floor</h3>
                <p className="text-sm" style={{ marginTop: 6 }}>{result.concession_floor}</p>
              </div>
              <div className="seo-fix seo-fix-p1">
                <h3 style={{ margin: 0 }}>Margin guardrail — walk away below</h3>
                <p className="text-sm" style={{ marginTop: 6 }}>{result.margin_guardrail}</p>
              </div>
            </div>
          </section>

          <section className="seo-section">
            <h2>Why</h2>
            <p className="text-sm">{result.reasoning}</p>
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