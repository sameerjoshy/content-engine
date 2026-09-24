import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface VideoBriefResponse {
  has_signal: boolean;
  verdict: string;
  script: { hook: string; proof: string; ask: string };
  beats: { t: string; line: string; on_screen: string }[];
  total_seconds: number;
  delivery: { channel: string; timing: string; note: string };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

export default function VideoOutreach() {
  usePageTitle('Video Outreach');
  const [signalBrief, setSignalBrief] = useState('');
  const [persona, setPersona] = useState('');
  const [offer, setOffer] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<VideoBriefResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!persona.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<VideoBriefResponse>('/api/video-outreach', {
        method: 'POST',
        body: JSON.stringify({ signal_brief: signalBrief.trim(), persona: persona.trim(), offer: offer.trim() || undefined }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Draft failed');
    } finally {
      setRunning(false);
    }
  }, [signalBrief, persona, offer]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Video Outreach</h1>
        <p>
          <strong>What it does:</strong> turns a specific signal and a persona into a recordable video script — hook, proof,
          ask — under 60 seconds.
          <br />
          <strong>What you get:</strong> the script in beats with what to show on screen, plus a delivery note (channel and
          timing).
          <br />
          <strong>What it needs:</strong> the signal (a real trigger) and the persona.
          <br />
          <strong>How it stays honest:</strong> no signal, no brief — a personalised video with nothing personal in it is
          spam, so it refuses rather than inventing a reason to send.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="seo-field">
            <label>Signal brief</label>
            <Textarea value={signalBrief} placeholder="The real trigger, e.g. 'Acme raised a $40M Series B and posted 4 enterprise AE roles; their CRO left in March.'" onChange={(e) => setSignalBrief(e.target.value)} rows={4} />
          </div>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <div className="seo-field" style={{ flex: 2, minWidth: 220 }}>
              <label>Persona</label>
              <Input value={persona} placeholder="e.g. VP Sales — scaling a new enterprise motion, no RevOps yet" onChange={(e) => setPersona(e.target.value)} />
            </div>
            <div className="seo-field" style={{ flex: 2, minWidth: 200 }}>
              <label>Your offer (optional)</label>
              <Input value={offer} placeholder="e.g. We fix pipeline coverage in 30 days" onChange={(e) => setOffer(e.target.value)} />
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={!persona.trim() || running}>
            {running ? 'Writing the script…' : 'Draft the video brief'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Checking for a signal → shaping the hook → writing the beats…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line" style={{ borderLeftColor: result.has_signal ? '#388e3c' : '#d32f2f' }}>
              <h2>{result.has_signal ? 'Recordable brief' : 'Not drafted'}</h2>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ {result.has_signal ? 'Read before recording' : 'Signal requirement'}</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.has_signal ? (
            <>
              <section className="seo-section">
                <h2>The script</h2>
                <div className="seo-fix-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                  <article className="seo-fix seo-fix-p1"><h3 style={{ margin: 0, fontSize: 15 }}>Hook</h3><p className="text-sm" style={{ marginTop: 6 }}>{result.script.hook}</p></article>
                  <article className="seo-fix seo-fix-p2"><h3 style={{ margin: 0, fontSize: 15 }}>Proof</h3><p className="text-sm" style={{ marginTop: 6 }}>{result.script.proof}</p></article>
                  <article className="seo-fix seo-fix-p3"><h3 style={{ margin: 0, fontSize: 15 }}>Ask</h3><p className="text-sm" style={{ marginTop: 6 }}>{result.script.ask}</p></article>
                </div>
              </section>

              {result.beats.length ? (
                <section className="seo-section">
                  <h2>Shot by shot</h2>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead><tr><th>Time</th><th>Line</th><th>On screen</th></tr></thead>
                      <tbody>
                        {result.beats.map((b, i) => (
                          <tr key={i}>
                            <td className="muted text-sm">{b.t}</td>
                            <td className="text-sm">{b.line}</td>
                            <td className="muted text-sm">{b.on_screen}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              <section className="seo-section">
                <h2>How to send it</h2>
                <div className="seo-callout">
                  <p><strong>{result.delivery.channel}</strong> — {result.delivery.timing}</p>
                  {result.delivery.note ? <p className="muted text-sm" style={{ marginTop: 8 }}>{result.delivery.note}</p> : null}
                </div>
              </section>
            </>
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
                <ul>{result.measured_vs_inferred.inferred.length ? result.measured_vs_inferred.inferred.map((m, i) => <li key={i}>~ {m}</li>) : <li className="muted">—</li>}</ul>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}