import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface ExpansionAccount { account: string; readiness: 'ready' | 'warming' | 'not-yet'; signal: string; offer: string; value: string | null }

interface ExpansionRadarResponse {
  verdict: string;
  accounts: ExpansionAccount[];
  summary: { ready: number; warming: number; not_yet: number; pipeline_value: string };
  playbook: { window: string; move: string }[];
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

const RD_CLASS: Record<ExpansionAccount['readiness'], string> = { ready: 'p3', warming: 'p2', 'not-yet': 'p1' };
const RD_LABEL: Record<ExpansionAccount['readiness'], string> = { ready: 'Ready', warming: 'Warming', 'not-yet': 'Not yet' };

export default function ExpansionRadar() {
  usePageTitle('Expansion Radar');
  const [accountData, setAccountData] = useState('');
  const [offerings, setOfferings] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExpansionRadarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (accountData.trim().length < 30) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<ExpansionRadarResponse>('/api/expansion', {
        method: 'POST',
        body: JSON.stringify({ account_data: accountData.trim(), offerings: offerings.trim() || undefined }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Readiness read failed');
    } finally {
      setRunning(false);
    }
  }, [accountData, offerings]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Expansion Radar</h1>
        <p>
          <strong>What it does:</strong> finds which healthy accounts are ready to grow, what to sell them, and the
          trigger to move now.
          <br />
          <strong>What you get:</strong> a readiness read per account (ready → not yet), the headroom signal and the
          offer to lead with, expected pipeline value, and timing windows.
          <br />
          <strong>What it needs:</strong> account data — usage, teams, health. Add your offerings to sharpen the pitch.
          <br />
          <strong>How it stays honest:</strong> any account showing churn signals is suppressed from expansion — pitching
          a shrinking account is a churn accelerant, not growth.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="seo-field">
            <label>Account data (CSV or rows)</label>
            <Textarea value={accountData} placeholder="Account, Usage vs limit, Teams, NPS, Renewal, Contract value&#10;Acme, 92% of seats, 3 teams, 9, 2026-06-30, 45000&#10;..." onChange={(e) => setAccountData(e.target.value)} rows={7} />
          </div>
          <div className="seo-field">
            <label>Offerings (optional)</label>
            <Input value={offerings} placeholder="e.g. Premium tier, additional seats, analytics add-on" onChange={(e) => setOfferings(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={accountData.trim().length < 30 || running}>
            {running ? 'Finding the signal…' : 'Find expansion-ready accounts'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Reading health → finding headroom → filtering out churn risk…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line" style={{ borderLeftColor: result.summary.ready ? '#388e3c' : '#f57c00' }}>
              <h2>Where the growth is</h2>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="tag tag-own">{result.summary.ready} ready</span>
                <span className="tag tag-p2">{result.summary.warming} warming</span>
                <span className="tag tag-p1">{result.summary.not_yet} not yet</span>
                <span className="tag">${result.summary.pipeline_value} pipeline</span>
              </div>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Read the gates first</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.accounts.length ? (
            <section className="seo-section">
              <h2>Account by account</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Account</th><th>Readiness</th><th>Signal</th><th>Offer</th><th>Value</th></tr></thead>
                  <tbody>
                    {result.accounts.map((a, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{a.account}</strong></td>
                        <td><span className={`tag tag-${RD_CLASS[a.readiness]}`}>{RD_LABEL[a.readiness]}</span></td>
                        <td className="text-sm">{a.signal}</td>
                        <td className="text-sm">{a.offer}</td>
                        <td className="muted text-sm">{a.value ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {result.playbook.length ? (
            <section className="seo-section">
              <h2>When to move</h2>
              <div className="seo-fix-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {result.playbook.map((p, i) => (
                  <article key={i} className="seo-fix seo-fix-p3">
                    <h3 style={{ margin: 0, fontSize: 15 }}>{p.window}</h3>
                    <p className="text-sm" style={{ marginTop: 6 }}>{p.move}</p>
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