import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface AccountPlay { account: string; story: string; positioning: string; channels: { channel: string; action: string; timing: string }[]; signal: string | null; grounded: boolean }

interface AbmResponse {
  verdict: string;
  plays: AccountPlay[];
  coverage: { grounded: number; ungrounded: number };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

export default function AbmPlaybook() {
  usePageTitle('ABM Playbook');
  const [accounts, setAccounts] = useState('');
  const [accountContext, setAccountContext] = useState('');
  const [yourPosition, setYourPosition] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AbmResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (accounts.trim().length < 3) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<AbmResponse>('/api/abm', {
        method: 'POST',
        body: JSON.stringify({ accounts: accounts.trim(), account_context: accountContext.trim() || undefined, your_position: yourPosition.trim() || undefined }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Playbook failed');
    } finally {
      setRunning(false);
    }
  }, [accounts, accountContext, yourPosition]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>ABM Playbook</h1>
        <p>
          <strong>What it does:</strong> for each named account, writes the story that account should hear and the channel
          plan to deliver it — grounded in that account's real signals.
          <br />
          <strong>What you get:</strong> a per-account play — story, positioning, and an ordered channel plan — each tied
          to a signal.
          <br />
          <strong>What it needs:</strong> your named accounts and the signals you know about each.
          <br />
          <strong>How it stays honest:</strong> the signal gate flags any account with no grounding signal — a play
          without a signal is generic outreach, and it says so rather than inventing a reason.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="seo-field">
            <label>Named accounts</label>
            <Textarea value={accounts} placeholder="One per line:&#10;Acme&#10;Globex&#10;Initech" onChange={(e) => setAccounts(e.target.value)} rows={4} />
          </div>
          <div className="seo-field">
            <label>Account context (signals)</label>
            <Textarea value={accountContext} placeholder="What you know about each:&#10;Acme — raised Series B, hiring RevOps, CRO left&#10;Globex — opened EMEA, migrating off legacy tool" onChange={(e) => setAccountContext(e.target.value)} rows={6} />
          </div>
          <div className="seo-field">
            <label>Your position (optional)</label>
            <Input value={yourPosition} placeholder="e.g. We win on depth; they win on price" onChange={(e) => setYourPosition(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={accounts.trim().length < 3 || running}>
            {running ? 'Building the plays…' : 'Build the playbook'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Reading signals → writing the account story → ordering the channels…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line">
              <h2>The playbook</h2>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="tag tag-own">{result.coverage.grounded} grounded</span>
                {result.coverage.ungrounded ? <span className="tag tag-p2">{result.coverage.ungrounded} generic</span> : null}
              </div>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Before you send anything</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.plays.map((p, i) => (
            <section key={i} className="seo-section">
              <div className={`seo-fix seo-fix-${p.grounded ? 'p3' : 'p2'}`}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>{p.account}</h3>
                  <span className={`tag tag-${p.grounded ? 'p3' : 'p2'}`}>{p.grounded ? 'Grounded' : 'No signal'}</span>
                </div>
                {p.signal ? <p className="muted text-sm" style={{ marginTop: 6 }}><strong>Signal:</strong> {p.signal}</p> : <p className="muted text-sm" style={{ marginTop: 6 }}>No grounding signal — find one before outreach.</p>}
                <p className="text-sm" style={{ marginTop: 8 }}><strong>The story:</strong> {p.story}</p>
                <p className="muted text-sm" style={{ marginTop: 4 }}><strong>Positioning:</strong> {p.positioning}</p>
                <div className="table-wrap" style={{ marginTop: 10 }}>
                  <table className="data-table">
                    <thead><tr><th>Channel</th><th>Action</th><th>Timing</th></tr></thead>
                    <tbody>
                      {p.channels.map((c, j) => (
                        <tr key={j}>
                          <td className="text-sm">{c.channel}</td>
                          <td className="muted text-sm">{c.action}</td>
                          <td className="muted text-sm">{c.timing}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ))}

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