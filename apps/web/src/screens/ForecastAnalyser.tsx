import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface ForecastSlice { segment: string; commit: string; upside: string; confidence: 'high' | 'medium' | 'low' }

interface ForecastResponse {
  commit: { value: string; note: string };
  best_case: { value: string; note: string };
  target: { value: string | null; gap: string | null };
  slices: ForecastSlice[];
  gap_analysis: { gap: string; can_close: string; from: string[] };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

const CONF_CLASS: Record<ForecastSlice['confidence'], string> = { high: 'p3', medium: 'p2', low: 'p1' };

export default function ForecastAnalyser() {
  usePageTitle('Forecast Analyser');
  const [pipelineExport, setPipelineExport] = useState('');
  const [target, setTarget] = useState('');
  const [period, setPeriod] = useState('');
  const [hygieneNotes, setHygieneNotes] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (pipelineExport.trim().length < 30) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<ForecastResponse>('/api/forecast', {
        method: 'POST',
        body: JSON.stringify({
          pipeline_export: pipelineExport.trim(),
          target: target.trim() || undefined,
          period: period.trim() || undefined,
          hygiene_notes: hygieneNotes.trim() || undefined,
        }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Forecast failed');
    } finally {
      setRunning(false);
    }
  }, [pipelineExport, target, period, hygieneNotes]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Forecast Analyser</h1>
        <p>
          <strong>What it does:</strong> turns your pipeline into the two numbers a leader commits to — what you'd bet
          the quarter on, and the realistic upside above it.
          <br />
          <strong>What you get:</strong> commit and best-case with reasoning, per-segment confidence, and the gap to
          target with the specific deals that would have to land to close it.
          <br />
          <strong>What it needs:</strong> a pipeline export — add your target and period to get the gap.
          <br />
          <strong>How it stays honest:</strong> the commit bar excludes stalled deals, missing amounts, and orphan
          deals — and if nothing in your pipeline bridges the gap, it says so instead of padding the number.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <div className="seo-field" style={{ flex: 1, minWidth: 160 }}>
              <label>Target (optional)</label>
              <Input value={target} placeholder="e.g. $1.2M" onChange={(e) => setTarget(e.target.value)} />
            </div>
            <div className="seo-field" style={{ flex: 1, minWidth: 160 }}>
              <label>Period (optional)</label>
              <Input value={period} placeholder="e.g. Q1 FY26" onChange={(e) => setPeriod(e.target.value)} />
            </div>
          </div>
          <div className="seo-field">
            <label>Pipeline export (CSV or rows)</label>
            <Textarea value={pipelineExport} placeholder="Deal, Stage, Amount, Close date, Owner, Last activity&#10;Acme, Negotiation, 45000, 2026-01-15, Dana, 3 days ago&#10;..." onChange={(e) => setPipelineExport(e.target.value)} rows={7} />
          </div>
          <div className="seo-field">
            <label>Hygiene notes (optional)</label>
            <Input value={hygieneNotes} placeholder="Anything you know is wrong with the data — paste from Hygiene" onChange={(e) => setHygieneNotes(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={pipelineExport.trim().length < 30 || running}>
            {running ? 'Forecasting…' : 'Give me the two numbers'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Reading the pipeline → setting the commit bar → measuring the gap…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-fix-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="seo-bottom-line">
                <h2>Commit</h2>
                <p className="seo-bl-verdict">{result.commit.value}</p>
                <p className="muted text-sm" style={{ marginTop: 6 }}>{result.commit.note}</p>
              </div>
              <div className="seo-bottom-line" style={{ borderLeftColor: '#1976d2' }}>
                <h2>Best case</h2>
                <p className="seo-bl-verdict">{result.best_case.value}</p>
                <p className="muted text-sm" style={{ marginTop: 6 }}>{result.best_case.note}</p>
              </div>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Confidence gates</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.target.value ? (
            <section className="seo-section">
              <h2>The gap to target</h2>
              <div className="seo-callout">
                <p><strong>Target {result.target.value}</strong> — gap {result.target.gap ?? 'not quantified'}</p>
                <p className="muted text-sm" style={{ marginTop: 8 }}>{result.gap_analysis.can_close}</p>
              </div>
              {result.gap_analysis.from.length ? (
                <>
                  <p className="seo-section-intro" style={{ marginTop: 12 }}>For the gap to close, these have to land:</p>
                  <ul>{result.gap_analysis.from.map((f, i) => <li key={i} className="text-sm">{f}</li>)}</ul>
                </>
              ) : null}
            </section>
          ) : null}

          {result.slices.length ? (
            <section className="seo-section">
              <h2>Where the number comes from</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Segment</th><th>Commit</th><th>Upside</th><th>Confidence</th></tr></thead>
                  <tbody>
                    {result.slices.map((s, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{s.segment}</strong></td>
                        <td className="text-sm">{s.commit}</td>
                        <td className="text-sm">{s.upside}</td>
                        <td><span className={`tag tag-${CONF_CLASS[s.confidence]}`}>{s.confidence}</span></td>
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