import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface TieredAccount { account: string; fit: number; intent: number; tier: 1 | 2 | 3 | 0; why: string }

interface AccountPlannerResponse {
  verdict: string;
  accounts: TieredAccount[];
  focus_set: string[];
  tiers: { tier1: number; tier2: number; tier3: number; excluded: number };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

const TIER_LABEL: Record<number, string> = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3', 0: 'Below fit' };
const TIER_CLASS: Record<number, string> = { 1: 'p3', 2: 'p2', 3: 'p2', 0: 'p1' };

export default function AccountPlanner() {
  usePageTitle('Account Planner');
  const [accountUniverse, setAccountUniverse] = useState('');
  const [icp, setIcp] = useState('');
  const [fitThreshold, setFitThreshold] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AccountPlannerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (accountUniverse.trim().length < 10 || !icp.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<AccountPlannerResponse>('/api/account-planner', {
        method: 'POST',
        body: JSON.stringify({ account_universe: accountUniverse.trim(), icp: icp.trim(), fit_threshold: fitThreshold.trim() || undefined }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tiering failed');
    } finally {
      setRunning(false);
    }
  }, [accountUniverse, icp, fitThreshold]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Account Planner</h1>
        <p>
          <strong>What it does:</strong> scores your account universe against ICP fit and intent, tiers it, and names the
          accounts worth a play this quarter.
          <br />
          <strong>What you get:</strong> a tiered list with fit and intent per account, the focus set, and why each scored
          where it did.
          <br />
          <strong>What it needs:</strong> the account universe (a list or CSV) and your ICP.
          <br />
          <strong>How it stays honest:</strong> accounts below the fit threshold are not auto-selected — the fit gate keeps
          poor-fit accounts out of the focus set rather than padding it.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <div className="seo-field" style={{ flex: 3, minWidth: 240 }}>
              <label>Your ICP</label>
              <Input value={icp} placeholder="e.g. Series B B2B SaaS, 200-1000 employees, US, RevOps buyer" onChange={(e) => setIcp(e.target.value)} />
            </div>
            <div className="seo-field" style={{ flex: 1, minWidth: 130 }}>
              <label>Fit threshold</label>
              <Input value={fitThreshold} placeholder="0.5" onChange={(e) => setFitThreshold(e.target.value)} />
            </div>
          </div>
          <div className="seo-field">
            <label>Account universe</label>
            <Textarea value={accountUniverse} placeholder="One account per line, with what you know.&#10;Acme — SaaS, 400 emp, US, hiring RevOps&#10;Globex — manufacturing, 5000 emp" onChange={(e) => setAccountUniverse(e.target.value)} rows={8} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={accountUniverse.trim().length < 10 || !icp.trim() || running}>
            {running ? 'Tiering…' : 'Tier the account list'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Scoring fit and intent → tiering → naming the focus set…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line" style={{ borderLeftColor: result.tiers.tier1 ? '#388e3c' : '#f57c00' }}>
              <h2>The focus set</h2>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="tag tag-own">{result.tiers.tier1} tier 1</span>
                <span className="tag tag-p2">{result.tiers.tier2} tier 2</span>
                <span className="tag tag-p2">{result.tiers.tier3} tier 3</span>
                <span className="tag tag-p1">{result.tiers.excluded} below fit</span>
              </div>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Read before acting</h2>
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
              <h2>Every account, scored</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Account</th><th>Tier</th><th>Fit</th><th>Intent</th><th>Why</th></tr></thead>
                  <tbody>
                    {result.accounts.map((a, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{a.account}</strong></td>
                        <td><span className={`tag tag-${TIER_CLASS[a.tier]}`}>{TIER_LABEL[a.tier]}</span></td>
                        <td className="text-sm">{Math.round(a.fit * 100)}%</td>
                        <td className="text-sm">{Math.round(a.intent * 100)}%</td>
                        <td className="muted text-sm">{a.why}</td>
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