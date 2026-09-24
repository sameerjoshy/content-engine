import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface CommandResponse {
  verdict: string;
  changed: { engine: string; what: string; source: string }[];
  decisions: { decision: string; owner: string; why: string; engine: string }[];
  risks: { risk: string; engine: string; severity: 'high' | 'medium' | 'low'; evidence: string }[];
  opportunities: { opportunity: string; engine: string; why: string }[];
  this_week: { action: string; owner: string; engine: string }[];
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

const SEV_CLASS: Record<'high' | 'medium' | 'low', string> = { high: 'p1', medium: 'p2', low: 'p3' };

export default function ChiefOfStaff() {
  usePageTitle('Chief of Staff');
  const [engineOutputs, setEngineOutputs] = useState('');
  const [priorities, setPriorities] = useState('');
  const [context, setContext] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CommandResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (engineOutputs.trim().length < 20) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<CommandResponse>('/api/command', {
        method: 'POST',
        body: JSON.stringify({ engine_outputs: engineOutputs.trim(), priorities: priorities.trim() || undefined, context: context.trim() || undefined }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Brief failed');
    } finally {
      setRunning(false);
    }
  }, [engineOutputs, priorities, context]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Chief of Staff</h1>
        <p>
          <strong>What it does:</strong> runs the weekly command rhythm across every engine — what changed, what needs a
          decision, and the cross-engine risks the individual agents cannot see from inside their own lane.
          <br />
          <strong>What you get:</strong> the weekly brief, the decisions you owe this week (each with an owner), the
          cross-engine risk register, and the week's actions.
          <br />
          <strong>What it needs:</strong> the latest engine outputs, your priorities, and what happened this week.
          <br />
          <strong>How it stays honest:</strong> it orchestrates, it does not invent — every item traces to an engine
          output, and a "needs a decision" item without an owner is dropped.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="seo-field">
            <label>Engine outputs</label>
            <Textarea value={engineOutputs} placeholder="Paste the latest from each engine — e.g.&#10;Marketing: SEO score 62, 3 pieces shipped&#10;Sales: commit $241k, 2 deals stalled in Negotiation&#10;Expansion: 2 accounts at risk, $105k&#10;Operations: pipeline $3.4M vs $1.8M target" onChange={(e) => setEngineOutputs(e.target.value)} rows={7} />
          </div>
          <div className="seo-field">
            <label>Priorities</label>
            <Input value={priorities} placeholder="e.g. Q1 $1.8M ARR; land 3 enterprise logos" onChange={(e) => setPriorities(e.target.value)} />
          </div>
          <div className="seo-field">
            <label>Context — what happened this week</label>
            <Textarea value={context} placeholder="Anything the outputs don't say: a key hire, a competitor move, a board ask." onChange={(e) => setContext(e.target.value)} rows={3} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={engineOutputs.trim().length < 20 || running}>
            {running ? 'Running the brief…' : 'Run the weekly brief'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Reading every engine → finding what changed → surfacing the decisions…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line">
              <h2>This week</h2>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="tag">{result.changed.length} changes</span>
                <span className="tag tag-p2">{result.decisions.length} decisions owed</span>
                <span className="tag tag-p1">{result.risks.length} risks</span>
                <span className="tag tag-own">{result.this_week.length} actions</span>
              </div>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Read first</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.decisions.length ? (
            <section className="seo-section">
              <h2>Decisions you owe</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Decision</th><th>Owner</th><th>Engine</th><th>Why now</th></tr></thead>
                  <tbody>
                    {result.decisions.map((d, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{d.decision}</strong></td>
                        <td className="text-sm">{d.owner}</td>
                        <td className="muted text-sm">{d.engine}</td>
                        <td className="muted text-sm">{d.why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {result.risks.length ? (
            <section className="seo-section">
              <h2>Cross-engine risks</h2>
              <p className="seo-section-intro">The ones no single engine owner will catch — they span lanes.</p>
              <div className="seo-fix-grid">
                {result.risks.map((r, i) => (
                  <article key={i} className={`seo-fix seo-fix-${SEV_CLASS[r.severity]}`}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: 15 }}>{r.risk}</h3>
                      <span className={`tag tag-${SEV_CLASS[r.severity]}`}>{r.severity}</span>
                    </div>
                    <p className="muted text-sm" style={{ marginTop: 6 }}><strong>{r.engine}</strong> — {r.evidence}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {result.this_week.length ? (
            <section className="seo-section">
              <h2>The week's actions</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Action</th><th>Owner</th><th>Engine</th></tr></thead>
                  <tbody>
                    {result.this_week.map((a, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{a.action}</strong></td>
                        <td className="text-sm">{a.owner}</td>
                        <td className="muted text-sm">{a.engine}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {result.changed.length ? (
            <section className="seo-section">
              <h2>What changed</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Engine</th><th>What changed</th><th>Source</th></tr></thead>
                  <tbody>
                    {result.changed.map((c, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{c.engine}</strong></td>
                        <td className="text-sm">{c.what}</td>
                        <td className="muted text-sm">{c.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {result.opportunities.length ? (
            <section className="seo-section">
              <h2>Opportunities across engines</h2>
              <div className="seo-fix-grid">
                {result.opportunities.map((o, i) => (
                  <article key={i} className="seo-fix seo-fix-p3">
                    <h3 style={{ margin: 0, fontSize: 15 }}>{o.opportunity}</h3>
                    <p className="muted text-sm" style={{ marginTop: 6 }}><strong>{o.engine}</strong> — {o.why}</p>
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
