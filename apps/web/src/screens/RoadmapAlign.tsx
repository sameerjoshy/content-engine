import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface Divergence { area: string; goal: string; reality: string; gap: string; severity: 'critical' | 'high' | 'medium' }

interface RoadmapAlignResponse {
  verdict: string;
  coverage: { required: string; available: string; ratio: string; verdict: string };
  divergences: Divergence[];
  adjustment_slots: { change: string; why: string; impact: string }[];
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

const SEV_CLASS: Record<Divergence['severity'], string> = { critical: 'p1', high: 'p2', medium: 'p3' };

export default function RoadmapAlign() {
  usePageTitle('Roadmap Align');
  const [goals, setGoals] = useState('');
  const [pipelineShape, setPipelineShape] = useState('');
  const [capacity, setCapacity] = useState('');
  const [winRate, setWinRate] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RoadmapAlignResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (goals.trim().length < 5 || pipelineShape.trim().length < 5) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<RoadmapAlignResponse>('/api/roadmap-align', {
        method: 'POST',
        body: JSON.stringify({
          goals: goals.trim(),
          pipeline_shape: pipelineShape.trim(),
          capacity: capacity.trim() || undefined,
          win_rate: winRate.trim() || undefined,
        }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Alignment check failed');
    } finally {
      setRunning(false);
    }
  }, [goals, pipelineShape, capacity, winRate]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Roadmap Align</h1>
        <p>
          <strong>What it does:</strong> cross-checks your goals against the actual pipeline shape and capacity, and flags
          where the plan and the funnel disagree — before the quarter starts.
          <br />
          <strong>What you get:</strong> the required-versus-available coverage, the divergences ranked by severity, and
          the adjustment slots that would close them.
          <br />
          <strong>What it needs:</strong> your goals and the pipeline shape — add capacity and win rate to quantify
          coverage.
          <br />
          <strong>How it stays honest:</strong> a goal the pipeline can't carry gets flagged, not quietly accepted. No
          figures invented; missing inputs are named.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="seo-field">
            <label>Goals</label>
            <Textarea value={goals} placeholder="e.g. Q1: $1.8M ARR; 30 enterprise logos; win rate 24% -> 28%" onChange={(e) => setGoals(e.target.value)} rows={3} />
          </div>
          <div className="seo-field">
            <label>Pipeline shape</label>
            <Textarea value={pipelineShape} placeholder="Coverage by stage, e.g. Discovery $2.1M / 40 deals; Proposal $900k / 12; Negotiation $400k / 5" onChange={(e) => setPipelineShape(e.target.value)} rows={4} />
          </div>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <div className="seo-field" style={{ flex: 1, minWidth: 200 }}>
              <label>Capacity (optional)</label>
              <Input value={capacity} placeholder="e.g. 6 AEs, 2 SDRs, 1 marketer" onChange={(e) => setCapacity(e.target.value)} />
            </div>
            <div className="seo-field" style={{ flex: 1, minWidth: 140 }}>
              <label>Win rate (optional)</label>
              <Input value={winRate} placeholder="e.g. 24%" onChange={(e) => setWinRate(e.target.value)} />
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={goals.trim().length < 5 || pipelineShape.trim().length < 5 || running}>
            {running ? 'Aligning…' : 'Check the plan against the funnel'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Reading goals → computing coverage → finding the divergences…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line" style={{ borderLeftColor: result.gates.length ? '#f57c00' : '#388e3c' }}>
              <h2>Can the pipeline carry the plan?</h2>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="tag">required {result.coverage.required}</span>
                <span className="tag">available {result.coverage.available}</span>
                <span className="tag tag-p2">ratio {result.coverage.ratio}</span>
              </div>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Before you commit</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.divergences.length ? (
            <section className="seo-section">
              <h2>Where the plan and the funnel disagree</h2>
              <div className="seo-fix-grid">
                {result.divergences.map((d, i) => (
                  <article key={i} className={`seo-fix seo-fix-${SEV_CLASS[d.severity]}`}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: 15 }}>{d.area}</h3>
                      <span className={`tag tag-${SEV_CLASS[d.severity]}`}>{d.severity}</span>
                    </div>
                    <p className="muted text-sm" style={{ marginTop: 6 }}><strong>Goal:</strong> {d.goal}</p>
                    <p className="muted text-sm" style={{ marginTop: 4 }}><strong>Reality:</strong> {d.reality}</p>
                    <p className="text-sm" style={{ marginTop: 4 }}><strong>Gap:</strong> {d.gap}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {result.adjustment_slots.length ? (
            <section className="seo-section">
              <h2>Adjustment slots</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Change</th><th>Why</th><th>Impact</th></tr></thead>
                  <tbody>
                    {result.adjustment_slots.map((a, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{a.change}</strong></td>
                        <td className="muted text-sm">{a.why}</td>
                        <td className="text-sm">{a.impact}</td>
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