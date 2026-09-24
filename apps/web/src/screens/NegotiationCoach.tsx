import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface NegotiationResponse {
  verdict: string;
  map: { they_want: string; you_can_give: string; cost_to_you: string; in_exchange_for: string }[];
  concession_sequence: { order: number; concession: string; in_exchange_for: string; guardrail: string }[];
  call_prep: { hold: string[]; give: string[]; close_when: string };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

export default function NegotiationCoach() {
  usePageTitle('Negotiation Coach');
  const [dealBrief, setDealBrief] = useState('');
  const [knownPressures, setKnownPressures] = useState('');
  const [marginFloor, setMarginFloor] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<NegotiationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (dealBrief.trim().length < 10) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<NegotiationResponse>('/api/negotiation', {
        method: 'POST',
        body: JSON.stringify({ deal_brief: dealBrief.trim(), known_pressures: knownPressures.trim() || undefined, margin_floor: marginFloor.trim() || undefined }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Prep failed');
    } finally {
      setRunning(false);
    }
  }, [dealBrief, knownPressures, marginFloor]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Negotiation Coach</h1>
        <p>
          <strong>What it does:</strong> builds the concession map before the call — what they want, what you can give, what
          it costs you, and what you must get in exchange.
          <br />
          <strong>What you get:</strong> the trades, the order to give them in, what to hold, and when to close.
          <br />
          <strong>What it needs:</strong> the deal brief — add known pressures and your margin floor to sharpen it.
          <br />
          <strong>How it stays honest:</strong> nothing is given for free — every concession is mapped to a trade, and the
          guardrail gate blocks any move that breaches your margin floor.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="seo-field">
            <label>Deal brief</label>
            <Textarea value={dealBrief} placeholder="Where the deal stands, what they're pushing on, what they've asked for." onChange={(e) => setDealBrief(e.target.value)} rows={5} />
          </div>
          <div className="seo-field">
            <label>Known pressures (optional)</label>
            <Textarea value={knownPressures} placeholder="Budget, timeline, competitors, internal blockers." onChange={(e) => setKnownPressures(e.target.value)} rows={3} />
          </div>
          <div className="seo-field">
            <label>Margin floor (optional)</label>
            <Input value={marginFloor} placeholder="e.g. 30% gross margin, or a floor price of $30k" onChange={(e) => setMarginFloor(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={dealBrief.trim().length < 10 || running}>
            {running ? 'Mapping…' : 'Prep the negotiation'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Mapping the trades → ordering the concessions → prepping the call…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line">
              <h2>The negotiation</h2>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Guardrail</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.map.length ? (
            <section className="seo-section">
              <h2>What they want → what you trade</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>They want</th><th>You can give</th><th>Cost to you</th><th>Get in exchange</th></tr></thead>
                  <tbody>
                    {result.map.map((m, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{m.they_want}</strong></td>
                        <td className="text-sm">{m.you_can_give}</td>
                        <td className="muted text-sm">{m.cost_to_you}</td>
                        <td className="text-sm">{m.in_exchange_for}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {result.concession_sequence.length ? (
            <section className="seo-section">
              <h2>The order to give</h2>
              <div className="seo-fix-grid">
                {result.concession_sequence.map((c) => (
                  <article key={c.order} className="seo-fix seo-fix-p2">
                    <h3 style={{ margin: 0, fontSize: 15 }}>{c.order}. {c.concession}</h3>
                    <p className="text-sm" style={{ marginTop: 6 }}><strong>In exchange for:</strong> {c.in_exchange_for}</p>
                    <p className="muted text-sm" style={{ marginTop: 4 }}><strong>Guardrail:</strong> {c.guardrail}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="seo-section">
            <h2>Call prep</h2>
            <div className="seo-fix-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <article className="seo-fix seo-fix-p1">
                <h3>Hold</h3>
                <ul>{result.call_prep.hold.map((h, i) => <li key={i} className="text-sm">{h}</li>)}</ul>
              </article>
              <article className="seo-fix seo-fix-p3">
                <h3>Give</h3>
                <ul>{result.call_prep.give.map((g, i) => <li key={i} className="text-sm">{g}</li>)}</ul>
              </article>
            </div>
            {result.call_prep.close_when ? <p className="text-sm" style={{ marginTop: 12 }}><strong>Close when:</strong> {result.call_prep.close_when}</p> : null}
          </section>

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