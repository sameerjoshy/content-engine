import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface TargetLine { target: string; set: string | null; actual: string | null; result: 'beat' | 'met' | 'missed' | 'unknown'; lesson: string | null }

interface PlanningCycleResponse {
  verdict: string;
  retrospective: TargetLine[];
  scorecard: { beat: number; met: number; missed: number; unknown: number };
  focus_areas: { area: string; why: string; traces_to: string }[];
  carryover: string[];
  drop: string[];
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

const RESULT_CLASS: Record<TargetLine['result'], string> = { beat: 'p3', met: 'p3', missed: 'p1', unknown: 'p2' };

export default function PlanningCycle() {
  usePageTitle('Planning Cycle');
  const [lastQuarterData, setLastQuarterData] = useState('');
  const [context, setContext] = useState('');
  const [quarter, setQuarter] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PlanningCycleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (lastQuarterData.trim().length < 20) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<PlanningCycleResponse>('/api/planning', {
        method: 'POST',
        body: JSON.stringify({
          last_quarter_data: lastQuarterData.trim(),
          context: context.trim() || undefined,
          quarter: quarter.trim() || undefined,
        }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review failed');
    } finally {
      setRunning(false);
    }
  }, [lastQuarterData, context, quarter]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Planning Cycle</h1>
        <p>
          <strong>What it does:</strong> runs last quarter's retrospective — target versus actual — and turns the lessons
          into focus areas for the next one.
          <br />
          <strong>What you get:</strong> a target-by-target read with the lesson from each, a scorecard, 2-4 focus areas
          that trace to real misses, and what to carry over versus drop.
          <br />
          <strong>What it needs:</strong> last quarter's targets and what actually happened.
          <br />
          <strong>How it stays honest:</strong> every focus area must trace to a target — no focus without evidence — and
          the plan is capped so the quarter stays focused instead of spreading thin.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <div className="seo-field" style={{ flex: 1, minWidth: 160 }}>
              <label>Quarter (optional)</label>
              <Input value={quarter} placeholder="e.g. Q1 FY26" onChange={(e) => setQuarter(e.target.value)} />
            </div>
            <div className="seo-field" style={{ flex: 3, minWidth: 240 }}>
              <label>Business context (optional)</label>
              <Input value={context} placeholder="e.g. Doubling down on enterprise; new CRO starts in April" onChange={(e) => setContext(e.target.value)} />
            </div>
          </div>
          <div className="seo-field">
            <label>Last quarter — targets + actuals</label>
            <Textarea value={lastQuarterData} placeholder="Target: ARR $1.5M → actual $1.32M&#10;Target: Win rate 25% → actual 24%&#10;Target: 30 enterprise logos → actual 41&#10;..." onChange={(e) => setLastQuarterData(e.target.value)} rows={8} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={lastQuarterData.trim().length < 20 || running}>
            {running ? 'Running the loop…' : 'Run the planning cycle'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Scoring the quarter → extracting lessons → setting focus…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line" style={{ borderLeftColor: result.scorecard.missed ? '#f57c00' : '#388e3c' }}>
              <h2>How the quarter actually went</h2>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="tag tag-own">{result.scorecard.beat} beat</span>
                <span className="tag tag-own">{result.scorecard.met} met</span>
                {result.scorecard.missed ? <span className="tag tag-p1">{result.scorecard.missed} missed</span> : null}
                {result.scorecard.unknown ? <span className="tag tag-p2">{result.scorecard.unknown} unknown</span> : null}
              </div>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Read before planning</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.retrospective.length ? (
            <section className="seo-section">
              <h2>Target by target</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Target</th><th>Set</th><th>Actual</th><th>Result</th><th>Lesson</th></tr></thead>
                  <tbody>
                    {result.retrospective.map((t, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{t.target}</strong></td>
                        <td className="muted text-sm">{t.set ?? '—'}</td>
                        <td className="text-sm">{t.actual ?? '—'}</td>
                        <td><span className={`tag tag-${RESULT_CLASS[t.result]}`}>{t.result}</span></td>
                        <td className="muted text-sm">{t.lesson ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {result.focus_areas.length ? (
            <section className="seo-section">
              <h2>Next quarter's focus — and why</h2>
              <div className="seo-fix-grid">
                {result.focus_areas.map((f, i) => (
                  <article key={i} className="seo-fix seo-fix-p2">
                    <h3 style={{ margin: 0, fontSize: 15 }}>{f.area}</h3>
                    <p className="muted text-sm" style={{ marginTop: 6 }}>{f.why}</p>
                    <p className="text-sm" style={{ marginTop: 6 }}><strong>Traces to:</strong> {f.traces_to}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="seo-section">
            <h2>Carry over, or kill</h2>
            <div className="seo-fix-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <article className="seo-fix seo-fix-p3">
                <h3>Carry over</h3>
                <ul>{result.carryover.length ? result.carryover.map((c, i) => <li key={i} className="text-sm">{c}</li>) : <li className="text-sm muted">Nothing — clean slate.</li>}</ul>
              </article>
              <article className="seo-fix seo-fix-p1">
                <h3>Drop</h3>
                <ul>{result.drop.length ? result.drop.map((d, i) => <li key={i} className="text-sm">{d}</li>) : <li className="text-sm muted">Nothing flagged.</li>}</ul>
              </article>
            </div>
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