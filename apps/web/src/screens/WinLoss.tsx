import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface WinLossPattern { pattern: string; direction: 'win' | 'loss'; evidence: string; sample: string }

interface WinLossResponse {
  verdict: string;
  win_patterns: WinLossPattern[];
  loss_patterns: WinLossPattern[];
  reasons: { reason: string; reported_share: string; evidence_based: boolean }[];
  actions: { do_more: string[]; stop: string[] };
  sample: { total: number; won: number; lost: number; win_rate: number; thin: boolean };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

export default function WinLoss() {
  usePageTitle('Win/Loss');
  const [dealExport, setDealExport] = useState('');
  const [period, setPeriod] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<WinLossResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (dealExport.trim().length < 30) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<WinLossResponse>('/api/win-loss', {
        method: 'POST',
        body: JSON.stringify({ deal_export: dealExport.trim(), period: period.trim() || undefined }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setRunning(false);
    }
  }, [dealExport, period]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Win/Loss</h1>
        <p>
          <strong>What it does:</strong> reads your closed deals and finds the patterns that actually separate wins from
          losses — not the reasons reps write down.
          <br />
          <strong>What you get:</strong> win and loss patterns with the evidence behind each, what to do more of, what
          to stop, and which stated reasons are backed by data.
          <br />
          <strong>What it needs:</strong> a closed-deal export — outcome plus whatever fields you track.
          <br />
          <strong>How it stays honest:</strong> no pattern it can't support with deals; it flags thin samples and
          separates evidence-based reasons from rep notes.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="seo-field">
            <label>Closed-deal export (CSV or rows)</label>
            <Textarea value={dealExport} placeholder="Deal, Outcome, Industry, Employees, ACV, Cycle, Competitor, Reason&#10;Acme, Won, SaaS, 400, 45000, 62, none, better fit&#10;..." onChange={(e) => setDealExport(e.target.value)} rows={8} />
          </div>
          <div className="seo-field">
            <label>Period (optional)</label>
            <Input value={period} placeholder="e.g. last 2 quarters" onChange={(e) => setPeriod(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={dealExport.trim().length < 30 || running}>
            {running ? 'Finding patterns…' : 'Analyze win/loss'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Reading outcomes → comparing wins vs losses → extracting patterns…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line">
              <h2>The pattern</h2>
              <p className="seo-bl-verdict">{Math.round(result.sample.win_rate * 100)}% win rate</p>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="tag">{result.sample.total} closed</span>
                <span className="tag tag-own">{result.sample.won} won</span>
                <span className="tag tag-p1">{result.sample.lost} lost</span>
                {result.sample.thin ? <span className="tag tag-p2">Thin sample</span> : null}
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
            <div className="seo-fix-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <h2>What wins</h2>
                {result.win_patterns.map((p, i) => (
                  <article key={i} className="seo-fix seo-fix-p3" style={{ marginBottom: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 15 }}>{p.pattern}</h3>
                    <p className="muted text-sm" style={{ marginTop: 6 }}>{p.evidence}</p>
                    {p.sample ? <span className="tag tag-own" style={{ marginTop: 6 }}>{p.sample}</span> : null}
                  </article>
                ))}
              </div>
              <div>
                <h2>What loses</h2>
                {result.loss_patterns.map((p, i) => (
                  <article key={i} className="seo-fix seo-fix-p1" style={{ marginBottom: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 15 }}>{p.pattern}</h3>
                    <p className="muted text-sm" style={{ marginTop: 6 }}>{p.evidence}</p>
                    {p.sample ? <span className="tag tag-p1" style={{ marginTop: 6 }}>{p.sample}</span> : null}
                  </article>
                ))}
              </div>
            </div>
          </section>

          {result.reasons.length ? (
            <section className="seo-section">
              <h2>Stated reasons — and whether the data backs them</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Reason</th><th>Reported share</th><th>Evidence</th></tr></thead>
                  <tbody>
                    {result.reasons.map((r, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{r.reason}</strong></td>
                        <td className="text-sm">{r.reported_share}</td>
                        <td><span className={`tag ${r.evidence_based ? 'tag-own' : 'tag-p2'}`}>{r.evidence_based ? 'Data-backed' : 'Rep note only'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="seo-section">
            <h2>What to do about it</h2>
            <div className="seo-fix-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <article className="seo-fix seo-fix-p3">
                <h3>Do more of</h3>
                <ul>{result.actions.do_more.map((a, i) => <li key={i} className="text-sm">{a}</li>)}</ul>
              </article>
              <article className="seo-fix seo-fix-p1">
                <h3>Stop</h3>
                <ul>{result.actions.stop.map((a, i) => <li key={i} className="text-sm">{a}</li>)}</ul>
              </article>
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