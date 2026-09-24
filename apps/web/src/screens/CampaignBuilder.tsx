import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface CampaignResponse {
  verdict: string;
  segment: string;
  arc: { phase: string; message: string; goal: string }[];
  calendar: { when: string; channel: string; asset: string; cta: string }[];
  assets: { asset: string; channel: string; due: string }[];
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

export default function CampaignBuilder() {
  usePageTitle('Campaign Builder');
  const [message, setMessage] = useState('');
  const [segment, setSegment] = useState('');
  const [window, setWindow] = useState('');
  const [channels, setChannels] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CampaignResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (message.trim().length < 5 || !segment.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<CampaignResponse>('/api/campaign', {
        method: 'POST',
        body: JSON.stringify({
          message: message.trim(),
          segment: segment.trim(),
          window: window.trim() || undefined,
          channels: channels.trim() || undefined,
        }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Campaign plan failed');
    } finally {
      setRunning(false);
    }
  }, [message, segment, window, channels]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Campaign Builder</h1>
        <p>
          <strong>What it does:</strong> turns one message and one segment into a multi-channel campaign — the narrative
          arc, the channel mix, a dated calendar, and the assets to produce.
          <br />
          <strong>What you get:</strong> the arc in stages, a dated calendar with channels and CTAs, and an asset list
          with due dates.
          <br />
          <strong>What it needs:</strong> the message, the segment, and the campaign window.
          <br />
          <strong>How it stays honest:</strong> a campaign must target a defined segment — set it to "everyone" and the
          segment gate fires rather than planning a campaign that reaches no one.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="seo-field">
            <label>Message</label>
            <Input value={message} placeholder="The one message to amplify, e.g. 'Pipeline coverage is the real forecast problem'" onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <div className="seo-field" style={{ flex: 2, minWidth: 200 }}>
              <label>Segment</label>
              <Input value={segment} placeholder="e.g. RevOps leaders at Series B SaaS (200-1000 emp)" onChange={(e) => setSegment(e.target.value)} />
            </div>
            <div className="seo-field" style={{ flex: 1, minWidth: 140 }}>
              <label>Window</label>
              <Input value={window} placeholder="e.g. 6 weeks from Apr 1" onChange={(e) => setWindow(e.target.value)} />
            </div>
          </div>
          <div className="seo-field">
            <label>Preferred channels (optional)</label>
            <Input value={channels} placeholder="e.g. LinkedIn + email + one webinar" onChange={(e) => setChannels(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={message.trim().length < 5 || !segment.trim() || running}>
            {running ? 'Building the campaign…' : 'Build the campaign'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Shaping the arc → mixing channels → scheduling the calendar…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line" style={{ borderLeftColor: result.gates.length ? '#f57c00' : '#388e3c' }}>
              <h2>The campaign for {result.segment}</h2>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="tag">{result.arc.length} arc stages</span>
                <span className="tag">{result.calendar.length} calendar entries</span>
                <span className="tag">{result.assets.length} assets</span>
              </div>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Before you build assets</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.arc.length ? (
            <section className="seo-section">
              <h2>The narrative arc</h2>
              <div className="seo-fix-grid">
                {result.arc.map((a, i) => (
                  <article key={i} className="seo-fix seo-fix-p2">
                    <h3 style={{ margin: 0, fontSize: 15 }}>{a.phase}</h3>
                    <p className="text-sm" style={{ marginTop: 6 }}>{a.message}</p>
                    <p className="muted text-sm" style={{ marginTop: 6 }}><strong>Goal:</strong> {a.goal}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {result.calendar.length ? (
            <section className="seo-section">
              <h2>The calendar</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>When</th><th>Channel</th><th>Asset</th><th>CTA</th></tr></thead>
                  <tbody>
                    {result.calendar.map((c, i) => (
                      <tr key={i}>
                        <td className="text-sm">{c.when}</td>
                        <td className="muted text-sm">{c.channel}</td>
                        <td className="text-sm">{c.asset}</td>
                        <td className="muted text-sm">{c.cta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {result.assets.length ? (
            <section className="seo-section">
              <h2>Assets to produce</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Asset</th><th>Channel</th><th>Due</th></tr></thead>
                  <tbody>
                    {result.assets.map((a, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{a.asset}</strong></td>
                        <td className="muted text-sm">{a.channel}</td>
                        <td className="text-sm">{a.due}</td>
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