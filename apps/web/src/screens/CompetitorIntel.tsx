import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface IntelClaim { claim: string; attribution: string | null; verified: boolean }

interface CompetitorIntelResponse {
  competitor: string;
  verdict: string;
  timeline: { when: string; move: string; attribution: string | null }[];
  implications: { area: string; impact: 'high' | 'medium' | 'low'; why: string }[];
  claims: IntelClaim[];
  moves: { do_now: string[]; watch: string[] };
  coverage: { sourced_claims: number; unsourced_claims: number };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

const IMPACT_CLASS: Record<'high' | 'medium' | 'low', string> = { high: 'p1', medium: 'p2', low: 'p3' };

export default function CompetitorIntel() {
  usePageTitle('Competitor Intel');
  const [competitor, setCompetitor] = useState('');
  const [sourceMaterial, setSourceMaterial] = useState('');
  const [yourPosition, setYourPosition] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CompetitorIntelResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!competitor.trim() || sourceMaterial.trim().length < 30) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<CompetitorIntelResponse>('/api/competitor', {
        method: 'POST',
        body: JSON.stringify({
          competitor: competitor.trim(),
          source_material: sourceMaterial.trim(),
          your_position: yourPosition.trim() || undefined,
        }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Brief failed');
    } finally {
      setRunning(false);
    }
  }, [competitor, sourceMaterial, yourPosition]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Competitor Intel</h1>
        <p>
          <strong>What it does:</strong> reads what a competitor is actually doing — from the material you've gathered —
          and tells you what it means for you and what to do about it.
          <br />
          <strong>What you get:</strong> a move timeline, implications scored by impact, every claim with its source,
          and the moves to make now versus watch.
          <br />
          <strong>What it needs:</strong> the competitor's name and the source material you've collected.
          <br />
          <strong>How it stays honest:</strong> every claim carries attribution — anything unsourced is flagged
          unverified rather than dressed up as fact.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <div className="seo-field" style={{ flex: 1, minWidth: 180 }}>
              <label>Competitor</label>
              <Input value={competitor} placeholder="e.g. Rival Inc" onChange={(e) => setCompetitor(e.target.value)} />
            </div>
            <div className="seo-field" style={{ flex: 2, minWidth: 220 }}>
              <label>Your position (optional)</label>
              <Input value={yourPosition} placeholder="e.g. We win on depth; they win on price" onChange={(e) => setYourPosition(e.target.value)} />
            </div>
          </div>
          <div className="seo-field">
            <label>Source material</label>
            <Textarea value={sourceMaterial} placeholder="Paste headlines, release notes, pricing pages, job posts — include the source for each where you have it." onChange={(e) => setSourceMaterial(e.target.value)} rows={8} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={!competitor.trim() || sourceMaterial.trim().length < 30 || running}>
            {running ? 'Building the brief…' : 'Brief me on them'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Reading sources → building the timeline → scoring the implications…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line">
              <h2>{result.competitor}</h2>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="tag tag-own">{result.coverage.sourced_claims} sourced</span>
                {result.coverage.unsourced_claims ? <span className="tag tag-p2">{result.coverage.unsourced_claims} unsourced</span> : null}
              </div>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Confidence</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.timeline.length ? (
            <section className="seo-section">
              <h2>What they've done</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>When</th><th>Move</th><th>Source</th></tr></thead>
                  <tbody>
                    {result.timeline.map((t, i) => (
                      <tr key={i}>
                        <td className="muted text-sm">{t.when || '—'}</td>
                        <td className="text-sm">{t.move}</td>
                        <td className="muted text-sm">{t.attribution ?? <span className="tag tag-p2">unsourced</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {result.implications.length ? (
            <section className="seo-section">
              <h2>What it means for you</h2>
              <div className="seo-fix-grid">
                {result.implications.map((im, i) => (
                  <article key={i} className={`seo-fix seo-fix-${IMPACT_CLASS[im.impact]}`}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: 15 }}>{im.area}</h3>
                      <span className={`tag tag-${IMPACT_CLASS[im.impact]}`}>{im.impact}</span>
                    </div>
                    <p className="muted text-sm" style={{ marginTop: 6 }}>{im.why}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="seo-section">
            <h2>What to do</h2>
            <div className="seo-fix-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <article className="seo-fix seo-fix-p3">
                <h3>Do now</h3>
                <ul>{result.moves.do_now.map((m, i) => <li key={i} className="text-sm">{m}</li>)}</ul>
              </article>
              <article className="seo-fix seo-fix-p2">
                <h3>Watch</h3>
                <ul>{result.moves.watch.map((m, i) => <li key={i} className="text-sm">{m}</li>)}</ul>
              </article>
            </div>
          </section>

          {result.claims.length ? (
            <section className="seo-section">
              <h2>Every claim, with its source</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Claim</th><th>Attribution</th><th>Status</th></tr></thead>
                  <tbody>
                    {result.claims.map((c, i) => (
                      <tr key={i}>
                        <td className="text-sm">{c.claim}</td>
                        <td className="muted text-sm">{c.attribution ?? '—'}</td>
                        <td><span className={`tag ${c.verified ? 'tag-own' : 'tag-p2'}`}>{c.verified ? 'Sourced' : 'Unverified'}</span></td>
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