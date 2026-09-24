import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface MarketSegment { segment: string; size: string; size_source: string | null; verified: boolean; growth: string | null; fit: string }

interface MarketResearchResponse {
  verdict: string;
  segments: MarketSegment[];
  whitespace: { area: string; why: string; evidence: string | null }[];
  competitors: { name: string; position: string; note: string }[];
  entry_priority: { rank: number; segment: string; why: string; evidence: string }[];
  coverage: { sized_with_source: number; sized_without_source: number };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

export default function MarketResearch() {
  usePageTitle('Market Research');
  const [segments, setSegments] = useState('');
  const [geography, setGeography] = useState('');
  const [yourPosition, setYourPosition] = useState('');
  const [sources, setSources] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MarketResearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (segments.trim().length < 5) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<MarketResearchResponse>('/api/market', {
        method: 'POST',
        body: JSON.stringify({
          segments: segments.trim(),
          geography: geography.trim() || undefined,
          your_position: yourPosition.trim() || undefined,
          sources: sources.trim() || undefined,
        }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Market map failed');
    } finally {
      setRunning(false);
    }
  }, [segments, geography, yourPosition, sources]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Market Research</h1>
        <p>
          <strong>What it does:</strong> sizes the segments you care about, maps the competitive field, and scores the
          whitespace — so the plan aims at a prize that is real.
          <br />
          <strong>What you get:</strong> a segment table with sizes and their sources, the whitespace, the competitive
          field, and a ranked entry priority with the evidence behind it.
          <br />
          <strong>What it needs:</strong> the segments to size — paste your sources (reports, analyst data) for a grounded
          read.
          <br />
          <strong>How it stays honest:</strong> every size carries its source or gets flagged as an estimate — no invented
          market numbers dressed up as facts.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <div className="seo-field" style={{ flex: 3, minWidth: 220 }}>
              <label>Segments to size</label>
              <Input value={segments} placeholder="e.g. Mid-market RevOps teams; enterprise sales ops" onChange={(e) => setSegments(e.target.value)} />
            </div>
            <div className="seo-field" style={{ flex: 1, minWidth: 120 }}>
              <label>Geography</label>
              <Input value={geography} placeholder="e.g. US + EMEA" onChange={(e) => setGeography(e.target.value)} />
            </div>
          </div>
          <div className="seo-field">
            <label>Your position (optional)</label>
            <Input value={yourPosition} placeholder="e.g. We win on depth for teams of 20-200" onChange={(e) => setYourPosition(e.target.value)} />
          </div>
          <div className="seo-field">
            <label>Sources</label>
            <Textarea value={sources} placeholder="Paste the reports, analyst data, or links you have — include the source for each figure." onChange={(e) => setSources(e.target.value)} rows={7} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={segments.trim().length < 5 || running}>
            {running ? 'Sizing the market…' : 'Map the market'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Sizing segments → mapping whitespace → ranking entry…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line">
              <h2>The shape of the market</h2>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="tag tag-own">{result.coverage.sized_with_source} sourced</span>
                {result.coverage.sized_without_source ? <span className="tag tag-p2">{result.coverage.sized_without_source} unsourced</span> : null}
              </div>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Before you plan on this</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.segments.length ? (
            <section className="seo-section">
              <h2>Segments</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Segment</th><th>Size</th><th>Source</th><th>Growth</th><th>Fit</th></tr></thead>
                  <tbody>
                    {result.segments.map((s, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{s.segment}</strong></td>
                        <td className="text-sm">{s.size}</td>
                        <td className="muted text-sm">{s.size_source ?? <span className="tag tag-p2">unsourced</span>}</td>
                        <td className="muted text-sm">{s.growth ?? '—'}</td>
                        <td className="text-sm">{s.fit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {result.entry_priority.length ? (
            <section className="seo-section">
              <h2>Where to aim first</h2>
              <div className="seo-fix-grid">
                {result.entry_priority.map((e) => (
                  <article key={e.rank} className="seo-fix seo-fix-p2">
                    <h3 style={{ margin: 0, fontSize: 15 }}>{e.rank}. {e.segment}</h3>
                    <p className="muted text-sm" style={{ marginTop: 6 }}>{e.why}</p>
                    {e.evidence ? <p className="text-sm" style={{ marginTop: 6 }}><strong>Evidence:</strong> {e.evidence}</p> : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {result.whitespace.length ? (
            <section className="seo-section">
              <h2>Whitespace</h2>
              <div className="seo-fix-grid">
                {result.whitespace.map((w, i) => (
                  <article key={i} className="seo-fix seo-fix-p3">
                    <h3 style={{ margin: 0, fontSize: 15 }}>{w.area}</h3>
                    <p className="muted text-sm" style={{ marginTop: 6 }}>{w.why}</p>
                    {w.evidence ? <p className="muted text-sm" style={{ marginTop: 4 }}>Source: {w.evidence}</p> : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {result.competitors.length ? (
            <section className="seo-section">
              <h2>The competitive field</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Player</th><th>Position</th><th>Note</th></tr></thead>
                  <tbody>
                    {result.competitors.map((c, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{c.name}</strong></td>
                        <td className="text-sm">{c.position}</td>
                        <td className="muted text-sm">{c.note}</td>
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