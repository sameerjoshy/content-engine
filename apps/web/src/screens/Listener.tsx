import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

type Decision = 'route' | 'veto';

interface SignalVerdict {
  signal: string;
  company: string | null;
  trigger: string;
  decision: Decision;
  confidence: number;
  reason: string;
  evidence: string | null;
}

interface ListenerResponse {
  sensitivity: string;
  routed: SignalVerdict[];
  vetoed: SignalVerdict[];
  digest: string;
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

const SENSITIVITY = [
  { value: 'broad', label: 'Broad — surface anything relevant' },
  { value: 'buying_signals', label: 'Buying signals only' },
  { value: 'custom', label: 'Custom' },
];

export default function Listener() {
  usePageTitle('Listener');
  const [signals, setSignals] = useState('');
  const [icp, setIcp] = useState('');
  const [watchList, setWatchList] = useState('');
  const [sensitivity, setSensitivity] = useState('broad');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ListenerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (signals.trim().length < 10) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<ListenerResponse>('/api/listen', {
        method: 'POST',
        body: JSON.stringify({
          signals: signals.trim(),
          icp: icp.trim() || undefined,
          watch_list: watchList.trim() || undefined,
          sensitivity,
        }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setRunning(false);
    }
  }, [signals, icp, watchList, sensitivity]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Listener</h1>
        <p>
          <strong>What it does:</strong> takes a batch of market signals and tells you which ones actually matter —
          routing the real ones and vetoing the noise, with the reason for every call.
          <br />
          <strong>What you get:</strong> a ranked signal digest and a transparent veto log — what routed, what was
          excluded, and why.
          <br />
          <strong>What it needs:</strong> the candidate signals and your ICP.
          <br />
          <strong>How it stays honest:</strong> a single-source signal doesn't route on its own — and every verdict is
          grounded in the evidence you pasted, never invented.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form">
          <div className="seo-field" style={{ flex: 2 }}>
            <label>Your ICP</label>
            <Input value={icp} placeholder="e.g. Series B B2B SaaS, 200–1000 employees, US + EU" onChange={(e) => setIcp(e.target.value)} />
          </div>
          <div className="seo-field" style={{ flex: 2 }}>
            <label>Watch list (optional)</label>
            <Input value={watchList} placeholder="e.g. Acme, Globex, Initech" onChange={(e) => setWatchList(e.target.value)} />
          </div>
          <div className="seo-field" style={{ flex: 2 }}>
            <label>Sensitivity</label>
            <select className="input" value={sensitivity} onChange={(e) => setSensitivity(e.target.value)}>
              {SENSITIVITY.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="seo-report-form" style={{ marginTop: 12 }}>
          <div className="seo-field" style={{ flex: 1 }}>
            <label>Candidate signals</label>
            <Textarea value={signals} placeholder="Paste the raw signals — news, posts, job changes, funding, tech mentions. One per line or as a block." onChange={(e) => setSignals(e.target.value)} rows={7} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={signals.trim().length < 10 || running}>
            {running ? 'Listening…' : 'Scan the signals'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Validating each signal against the ICP → routing the real ones → logging the vetoes…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line">
              <h2>Signal digest</h2>
              <p className="seo-bl-verdict">{result.digest}</p>
              <div className="row" style={{ gap: 16, marginTop: 8 }}>
                <span className="tag tag-own">{result.routed.length} routed</span>
                <span className="tag tag-nobody">{result.vetoed.length} vetoed</span>
              </div>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Noise controls</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.routed.length ? (
            <section className="seo-section">
              <h2>Routed — act on these</h2>
              <div className="seo-fix-grid">
                {result.routed.map((v, i) => (
                  <article key={i} className="seo-fix seo-fix-p1">
                    <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <span className="tag">{v.trigger}</span>
                      <span className="muted text-xs" style={{ marginLeft: 'auto', fontWeight: 700 }}>{Math.round(v.confidence * 100)}%</span>
                    </div>
                    <h3>{v.signal}</h3>
                    {v.company ? <p className="text-sm" style={{ marginTop: 4 }}><strong>{v.company}</strong></p> : null}
                    <p className="muted text-xs" style={{ marginTop: 6 }}>{v.reason}</p>
                    {v.evidence ? <p className="muted text-xs" style={{ marginTop: 6 }}>Evidence: “{v.evidence}”</p> : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {result.vetoed.length ? (
            <section className="seo-section">
              <h2>The veto log — what we filtered out</h2>
              <p className="seo-section-intro">Transparency, not a black box: every exclusion is named with its reason.</p>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Signal</th><th>Trigger</th><th>Why vetoed</th></tr></thead>
                  <tbody>
                    {result.vetoed.map((v, i) => (
                      <tr key={i}>
                        <td className="text-sm" style={{ maxWidth: 240 }}>{v.signal}</td>
                        <td className="muted text-xs">{v.trigger}</td>
                        <td className="muted text-xs" style={{ maxWidth: 320 }}>{v.reason}</td>
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