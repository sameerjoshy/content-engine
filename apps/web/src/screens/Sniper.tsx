import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

type Channel = 'email' | 'linkedin_dm' | 'call_script';

interface SniperResponse {
  channel: string;
  draft: { subject: string | null; body: string };
  self_critique: { relevance: string; tone: string; signal_usage: string; length: string; ready: boolean };
  untraceable_claims: string[];
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

const CHANNELS: { value: Channel; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'linkedin_dm', label: 'LinkedIn DM' },
  { value: 'call_script', label: 'Call script' },
];

export default function Sniper() {
  usePageTitle('Sniper');
  const [signalBrief, setSignalBrief] = useState('');
  const [persona, setPersona] = useState('');
  const [channel, setChannel] = useState<Channel>('email');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SniperResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<SniperResponse>('/api/snipe', {
        method: 'POST',
        body: JSON.stringify({ signal_brief: signalBrief.trim(), persona: persona.trim() || undefined, channel }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Draft failed');
    } finally {
      setRunning(false);
    }
  }, [signalBrief, persona, channel]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Sniper</h1>
        <p>
          <strong>What it does:</strong> writes outreach that references one specific, real event at the account — and
          refuses to write generic copy.
          <br />
          <strong>What you get:</strong> a ready-to-review draft and an honest self-critique — relevance, tone, how the
          signal was used, and length.
          <br />
          <strong>What it needs:</strong> the signal (the real event) and the persona.
          <br />
          <strong>How it stays honest:</strong> every claim is traced to the signal brief; anything that isn't, it lists
          and flags for removal. Nothing sends without your approval.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form">
          <div className="seo-field" style={{ flex: 2 }}>
            <label>Target persona</label>
            <Input value={persona} placeholder="e.g. VP Sales at a Series B SaaS company" onChange={(e) => setPersona(e.target.value)} />
          </div>
          <div className="seo-field" style={{ flex: 1 }}>
            <label>Channel</label>
            <select className="input" value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
              {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div className="seo-report-form" style={{ marginTop: 12 }}>
          <div className="seo-field" style={{ flex: 1 }}>
            <label>Signal brief (the real event)</label>
            <Textarea value={signalBrief} placeholder="e.g. Acme raised a $40M Series B last week led by Sequoia; they posted 4 enterprise sales roles and their CRO left in March." onChange={(e) => setSignalBrief(e.target.value)} rows={5} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={running}> {running ? 'Drafting…' : 'Draft the message'} </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Grounding in the signal → drafting → self-critiquing…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line" style={{ borderLeftColor: result.self_critique.ready ? '#388e3c' : '#d32f2f' }}>
              <h2>{result.channel} draft {result.self_critique.ready ? '— ready to review' : '— needs work'}</h2>
              {result.draft.subject ? <p className="seo-label" style={{ marginTop: 8 }}>Subject</p> : null}
              {result.draft.subject ? <p style={{ fontWeight: 700, marginBottom: 8 }}>{result.draft.subject}</p> : null}
              <p className="seo-bl-verdict" style={{ whiteSpace: 'pre-wrap' }}>{result.draft.body}</p>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Before you send</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
                {result.untraceable_claims.length ? (
                  <ul className="flag-list" style={{ marginTop: 8 }}>
                    {result.untraceable_claims.map((c, i) => <li key={i} className="text-xs error-text">✗ {c}</li>)}
                  </ul>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="seo-section">
            <h2>Self-critique</h2>
            <div className="table-wrap">
              <table className="data-table">
                <tbody>
                  <tr><td style={{ width: 160 }}><strong className="text-sm">Relevance</strong></td><td className="muted text-sm">{result.self_critique.relevance}</td></tr>
                  <tr><td><strong className="text-sm">Tone</strong></td><td className="muted text-sm">{result.self_critique.tone}</td></tr>
                  <tr><td><strong className="text-sm">Signal usage</strong></td><td className="muted text-sm">{result.self_critique.signal_usage}</td></tr>
                  <tr><td><strong className="text-sm">Length</strong></td><td className="muted text-sm">{result.self_critique.length}</td></tr>
                </tbody>
              </table>
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