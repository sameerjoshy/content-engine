import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface AccountRisk { account: string; tier: 'healthy' | 'watch' | 'at-risk' | 'critical'; driver: string; evidence: string; renewal: string | null }

interface ChurnRadarResponse {
  verdict: string;
  accounts: AccountRisk[];
  distribution: { healthy: number; watch: number; 'at-risk': number; critical: number };
  at_risk_value: string;
  playbook: { tier: string; action: string }[];
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

const TIER_CLASS: Record<AccountRisk['tier'], string> = { critical: 'p1', 'at-risk': 'p1', watch: 'p2', healthy: 'p3' };
const TIER_LABEL: Record<AccountRisk['tier'], string> = { critical: 'Critical', 'at-risk': 'At risk', watch: 'Watch', healthy: 'Healthy' };

export default function ChurnRadar() {
  usePageTitle('Churn Radar');
  const [accountData, setAccountData] = useState('');
  const [period, setPeriod] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ChurnRadarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (accountData.trim().length < 30) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<ChurnRadarResponse>('/api/churn', {
        method: 'POST',
        body: JSON.stringify({ account_data: accountData.trim(), period: period.trim() || undefined }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Health read failed');
    } finally {
      setRunning(false);
    }
  }, [accountData, period]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Churn Radar</h1>
        <p>
          <strong>What it does:</strong> scores every account's health and tiers the churn risk before renewal — so you
          call the right accounts first, with the reason in hand.
          <br />
          <strong>What you get:</strong> a tier per account (critical → healthy), the single driver and the evidence
          behind it, the value at risk, and a per-tier playbook.
          <br />
          <strong>What it needs:</strong> account data — usage, support, sentiment, renewal if you have it.
          <br />
          <strong>How it stays honest:</strong> no account is tiered healthy by default; a green average never hides a red
          account, and critical accounts escalate ahead of any renewal motion.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="seo-field">
            <label>Account data (CSV or rows)</label>
            <Textarea value={accountData} placeholder="Account, Usage trend, Support tickets, NPS, Renewal, Contract value&#10;Acme, -40%, 3 escalations, 3, 2026-01-31, 45000&#10;..." onChange={(e) => setAccountData(e.target.value)} rows={8} />
          </div>
          <div className="seo-field">
            <label>Period (optional)</label>
            <Input value={period} placeholder="e.g. last 90 days" onChange={(e) => setPeriod(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={accountData.trim().length < 30 || running}>
            {running ? 'Scoring accounts…' : 'Read my accounts'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Scoring signals → tiering risk → building the playbook…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line" style={{ borderLeftColor: result.distribution.critical ? '#d32f2f' : result.distribution['at-risk'] ? '#f57c00' : '#388e3c' }}>
              <h2>Where your book stands</h2>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                {result.distribution.critical ? <span className="tag tag-p1">{result.distribution.critical} critical</span> : null}
                {result.distribution['at-risk'] ? <span className="tag tag-p1">{result.distribution['at-risk']} at risk</span> : null}
                {result.distribution.watch ? <span className="tag tag-p2">{result.distribution.watch} watch</span> : null}
                <span className="tag tag-own">{result.distribution.healthy} healthy</span>
                <span className="tag">${result.at_risk_value} at risk</span>
              </div>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Who to call first</h2>
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
                  <thead><tr><th>Account</th><th>Tier</th><th>Driver</th><th>Renewal</th></tr></thead>
                  <tbody>
                    {result.accounts.map((a, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{a.account}</strong></td>
                        <td><span className={`tag tag-${TIER_CLASS[a.tier]}`}>{TIER_LABEL[a.tier]}</span></td>
                        <td className="text-sm">{a.driver}<br /><span className="muted" style={{ fontSize: 12 }}>{a.evidence}</span></td>
                        <td className="muted text-sm">{a.renewal ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {result.playbook.length ? (
            <section className="seo-section">
              <h2>The playbook</h2>
              <div className="seo-fix-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {result.playbook.map((p, i) => (
                  <article key={i} className="seo-fix seo-fix-p2">
                    <h3 style={{ margin: 0, fontSize: 15 }}>{p.tier}</h3>
                    <p className="text-sm" style={{ marginTop: 6 }}>{p.action}</p>
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