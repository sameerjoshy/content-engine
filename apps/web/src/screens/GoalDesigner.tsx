import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface DraftObjective {
  objective: string;
  key_results: { kr: string; baseline: string | null; target: string; measure: string }[];
  ambition: 'stretch' | 'realistic' | 'sandbag' | 'fantasy';
  ambition_why: string;
}

interface GoalDesignerResponse {
  verdict: string;
  objectives: DraftObjective[];
  health: { objectives: number; with_measurable_kr: number; stretch: number };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

const AMB_CLASS: Record<DraftObjective['ambition'], string> = { stretch: 'p3', realistic: 'p2', sandbag: 'p2', fantasy: 'p1' };

export default function GoalDesigner() {
  usePageTitle('Goal Designer');
  const [focusAreas, setFocusAreas] = useState('');
  const [context, setContext] = useState('');
  const [baseline, setBaseline] = useState('');
  const [horizon, setHorizon] = useState('one quarter');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<GoalDesignerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (focusAreas.trim().length < 10) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<GoalDesignerResponse>('/api/goal-designer', {
        method: 'POST',
        body: JSON.stringify({
          focus_areas: focusAreas.trim(),
          context: context.trim() || undefined,
          baseline: baseline.trim() || undefined,
          horizon: horizon.trim() || undefined,
        }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Draft failed');
    } finally {
      setRunning(false);
    }
  }, [focusAreas, context, baseline, horizon]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Goal Designer</h1>
        <p>
          <strong>What it does:</strong> drafts an OKR set from your focus areas — then pressure-tests the ambition, so you
          don't set goals you'll sleepwalk past or never reach.
          <br />
          <strong>What you get:</strong> objectives with measurable key results (baseline, target, measure) and an
          ambition verdict per objective: stretch, realistic, sandbag, or fantasy.
          <br />
          <strong>What it needs:</strong> your focus areas — context and baseline numbers sharpen the draft.
          <br />
          <strong>How it stays honest:</strong> every target gets a number and a threshold, and the ambition check names
          the math — sandbagged and unreachable targets both get flagged, not hidden.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="seo-field">
            <label>Focus areas</label>
            <Textarea value={focusAreas} placeholder="e.g. Grow ARR; fix the content engine; land enterprise logos" onChange={(e) => setFocusAreas(e.target.value)} rows={3} />
          </div>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <div className="seo-field" style={{ flex: 2, minWidth: 200 }}>
              <label>Context (optional)</label>
              <Input value={context} placeholder="e.g. New CRO starts April; EMEA expansion" onChange={(e) => setContext(e.target.value)} />
            </div>
            <div className="seo-field" style={{ flex: 2, minWidth: 180 }}>
              <label>Baseline (optional)</label>
              <Input value={baseline} placeholder="e.g. ARR $1.2M; win rate 24%" onChange={(e) => setBaseline(e.target.value)} />
            </div>
            <div className="seo-field" style={{ flex: 1, minWidth: 130 }}>
              <label>Horizon</label>
              <Input value={horizon} onChange={(e) => setHorizon(e.target.value)} />
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={focusAreas.trim().length < 10 || running}>
            {running ? 'Designing…' : 'Draft the goals'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Drafting objectives → writing measurable KRs → pressure-testing ambition…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line" style={{ borderLeftColor: result.gates.length ? '#f57c00' : '#388e3c' }}>
              <h2>Is this set ambitious enough?</h2>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="tag">{result.health.objectives} objectives</span>
                <span className={`tag ${result.health.with_measurable_kr === result.health.objectives ? 'tag-own' : 'tag-p2'}`}>{result.health.with_measurable_kr} measurable</span>
                <span className="tag tag-own">{result.health.stretch} stretch</span>
              </div>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Ambition gates</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="seo-section">
            <h2>The draft</h2>
            {result.objectives.map((o, i) => (
              <article key={i} className={`seo-fix seo-fix-${AMB_CLASS[o.ambition]}`} style={{ marginBottom: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>{o.objective}</h3>
                  <span className={`tag tag-${AMB_CLASS[o.ambition]}`}>{o.ambition}</span>
                </div>
                <div className="table-wrap" style={{ marginTop: 10 }}>
                  <table className="data-table">
                    <thead><tr><th>Key result</th><th>Baseline</th><th>Target</th><th>Measure</th></tr></thead>
                    <tbody>
                      {o.key_results.map((k, j) => (
                        <tr key={j}>
                          <td className="text-sm">{k.kr}</td>
                          <td className="muted text-sm">{k.baseline ?? 'unknown'}</td>
                          <td className="text-sm">{k.target}</td>
                          <td className="muted text-sm">{k.measure}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted text-sm" style={{ marginTop: 8 }}><strong>Ambition:</strong> {o.ambition_why}</p>
              </article>
            ))}
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