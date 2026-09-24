import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface SegmentStat {
  segment: string;
  deals: number;
  won: number;
  win_rate: number;
  avg_cycle_days: number | null;
}

interface IcpResponse {
  stated_icp: string;
  actual_icp: { profile: string; why: string };
  drift: { point: string; detail: string }[];
  segments: SegmentStat[];
  sample: { total_deals: number; closed_won: number; preliminary: boolean };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

const LOOKBACKS = ['6 months', '12 months', 'all time'];

export default function IcpClarifier() {
  usePageTitle('ICP Clarifier');
  const [dealExport, setDealExport] = useState('');
  const [statedIcp, setStatedIcp] = useState('');
  const [lookback, setLookback] = useState('12 months');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<IcpResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (dealExport.trim().length < 30) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<IcpResponse>('/api/icp', {
        method: 'POST',
        body: JSON.stringify({ deal_export: dealExport.trim(), stated_icp: statedIcp.trim() || undefined, lookback }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setRunning(false);
    }
  }, [dealExport, statedIcp, lookback]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>ICP Clarifier</h1>
        <p>
          <strong>What it does:</strong> shows you who actually buys — not who you think buys — from your own closed-won
          patterns.
          <br />
          <strong>What you get:</strong> the real winning profile, the segment math behind it, and where your pipeline
          has drifted from the ICP you stated.
          <br />
          <strong>What it needs:</strong> a CRM deal export (past it in) and your stated ICP.
          <br />
          <strong>How it stays honest:</strong> it works only from your data — below 20 closed-won deals, it marks the
          pattern preliminary instead of overclaiming.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form">
          <div className="seo-field" style={{ flex: 3 }}>
            <label>Your stated ICP</label>
            <Input value={statedIcp} placeholder="e.g. Series B B2B SaaS, 200–1000 employees, US" onChange={(e) => setStatedIcp(e.target.value)} />
          </div>
          <div className="seo-field" style={{ flex: 1 }}>
            <label>Lookback</label>
            <select className="input" value={lookback} onChange={(e) => setLookback(e.target.value)}>
              {LOOKBACKS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="seo-report-form" style={{ marginTop: 12 }}>
          <div className="seo-field" style={{ flex: 1 }}>
            <label>Deal export (CSV or rows)</label>
            <Textarea value={dealExport} placeholder="Company, Industry, Employees, ACV, Cycle days, Outcome&#10;Acme, SaaS, 400, 45000, 62, Won&#10;..." onChange={(e) => setDealExport(e.target.value)} rows={7} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={dealExport.trim().length < 30 || running}>
            {running ? 'Analyzing…' : 'Find the real ICP'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Reading the deals → segmenting by outcome → finding the drift…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line" style={{ borderLeftColor: result.sample.preliminary ? '#f57c00' : '#388e3c' }}>
              <h2>Who actually buys</h2>
              <p className="seo-bl-verdict">{result.actual_icp.profile}</p>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.actual_icp.why}</p>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="tag">{result.sample.total_deals} deals</span>
                <span className="tag">{result.sample.closed_won} won</span>
                {result.sample.preliminary ? <span className="tag tag-p2">Preliminary sample</span> : <span className="tag tag-own">Sample OK</span>}
              </div>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Before you act on it</h2>
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
            <h2>The segment math</h2>
            <p className="seo-section-intro">Win rate and cycle by segment, from your data — the highest win rate at the shortest cycle is your real ICP.</p>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Segment</th><th>Deals</th><th>Won</th><th>Win rate</th><th>Avg cycle</th></tr></thead>
                <tbody>
                  {result.segments.map((s, i) => (
                    <tr key={i}>
                      <td><strong className="text-sm">{s.segment}</strong></td>
                      <td className="text-sm">{s.deals}</td>
                      <td className="text-sm">{s.won}</td>
                      <td className="text-sm">{Math.round(s.win_rate * 100)}%</td>
                      <td className="muted text-sm">{s.avg_cycle_days != null ? `${s.avg_cycle_days}d` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {result.drift.length ? (
            <section className="seo-section">
              <h2>Where the pipeline has drifted</h2>
              <div className="seo-fix-grid">
                {result.drift.map((d, i) => (
                  <article key={i} className="seo-fix seo-fix-p2">
                    <h3>{d.point}</h3>
                    <p className="muted text-sm" style={{ marginTop: 6 }}>{d.detail}</p>
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