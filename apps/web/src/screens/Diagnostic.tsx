import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

type Domain = 'strategy' | 'marketing' | 'sales' | 'expansion' | 'operations';

interface Constraint {
  domain: Domain;
  constraint: string;
  confidence: number;
  evidence: string | null;
}

interface DiagnosticResponse {
  company: string;
  revenue_stage: string;
  team_size: number | null;
  state_summary: { question: string; finding: string }[];
  constraints: Constraint[];
  headline: string;
  gates: { gate: string; note: string }[];
  source_scraped: boolean;
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

const REVENUE_STAGES = ['$0–2M', '$2–10M', '$10–50M', '$50M+'];

const DOMAIN_LABEL: Record<Domain, { name: string; color: string }> = {
  strategy: { name: 'Strategy', color: '#2563eb' },
  marketing: { name: 'Marketing', color: '#10b981' },
  sales: { name: 'Sales', color: '#d97706' },
  expansion: { name: 'Expansion', color: '#0d9488' },
  operations: { name: 'Operations', color: '#475569' },
};

function confTone(c: number) {
  if (c >= 0.7) return 'good';
  if (c >= 0.45) return 'warn';
  return 'bad';
}

export default function Diagnostic() {
  usePageTitle('Diagnostic');
  const [companyUrl, setCompanyUrl] = useState('');
  const [revenueStage, setRevenueStage] = useState('$2–10M');
  const [teamSize, setTeamSize] = useState('');
  const [notes, setNotes] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DiagnosticResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (companyUrl.trim().length < 4) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<DiagnosticResponse>('/api/diagnostic', {
        method: 'POST',
        body: JSON.stringify({
          company_url: companyUrl.trim(),
          revenue_stage: revenueStage,
          team_size: teamSize ? Number(teamSize) : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Diagnostic failed');
    } finally {
      setRunning(false);
    }
  }, [companyUrl, revenueStage, teamSize, notes]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Diagnostic</h1>
        <p>
          <strong>What it does:</strong> reads your market and surfaces where the revenue system is actually under
          strain — the constraint worth fixing this quarter.
          <br />
          <strong>What you get:</strong> a state read across the five planning questions and a constraint map — each
          friction point named, with its evidence and a confidence.
          <br />
          <strong>What it needs:</strong> your company URL, revenue stage, and GTM team size.
          <br />
          <strong>How it stays honest:</strong> it runs on real, scraped context — and when it can't get it, it caps
          confidence low and says so instead of guessing.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form">
          <div className="seo-field" style={{ flex: 2 }}>
            <label>Company URL</label>
            <Input value={companyUrl} placeholder="https://yourcompany.com" onChange={(e) => setCompanyUrl(e.target.value)} />
          </div>
          <div className="seo-field" style={{ flex: 1 }}>
            <label>Revenue stage</label>
            <select className="input" value={revenueStage} onChange={(e) => setRevenueStage(e.target.value)}>
              {REVENUE_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="seo-field" style={{ flex: 1, maxWidth: 140 }}>
            <label>GTM team size</label>
            <Input value={teamSize} placeholder="e.g. 12" onChange={(e) => setTeamSize(e.target.value.replace(/[^0-9]/g, ''))} />
          </div>
        </div>
        <div className="seo-report-form" style={{ marginTop: 12 }}>
          <div className="seo-field" style={{ flex: 1 }}>
            <label>Anything we should know? (optional)</label>
            <Textarea value={notes} placeholder="Where does it feel hardest right now? What have you already tried?" onChange={(e) => setNotes(e.target.value)} rows={4} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={companyUrl.trim().length < 4 || running}>
            {running ? 'Diagnosing…' : 'Run the diagnostic'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Reading your market → running the planning questions → mapping the constraints…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          {/* Headline verdict */}
          <section className="seo-section">
            <div className="seo-bottom-line">
              <h2>Where you are</h2>
              <p className="seo-bl-verdict">{result.headline}</p>
              <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
                <span className="tag">{result.company}</span>
                <span className="tag">{result.revenue_stage}</span>
                {result.team_size ? <span className="tag">{result.team_size} GTM people</span> : null}
                <span className={`tag ${result.source_scraped ? 'tag-own' : 'tag-p1'}`}>
                  {result.source_scraped ? 'Independent context: scraped' : 'Independent context: unavailable'}
                </span>
              </div>
            </div>
          </section>

          {/* Gates */}
          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Read this before you act on it</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Constraint map */}
          <section className="seo-section">
            <h2>The constraint map</h2>
            <p className="seo-section-intro">Where the system is under strain, most likely first. Confidence tells you how hard to lean on each.</p>
            <div className="seo-fix-grid">
              {result.constraints.map((c, i) => (
                <article key={i} className={`seo-fix ${c.confidence >= 0.7 ? 'seo-fix-p1' : c.confidence >= 0.45 ? 'seo-fix-p2' : 'seo-fix-p3'}`}>
                  <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <span className="tag" style={{ background: DOMAIN_LABEL[c.domain].color, color: '#fff' }}>{DOMAIN_LABEL[c.domain].name}</span>
                    <span className={`seo-score-card seo-score-${confTone(c.confidence)}`} style={{ marginLeft: 'auto', padding: '2px 8px', border: 'none', borderRadius: 4 }}>
                      <span className="text-xs" style={{ fontWeight: 700 }}>{Math.round(c.confidence * 100)}% confidence</span>
                    </span>
                  </div>
                  <h3>{c.constraint}</h3>
                  {c.evidence ? <p className="muted text-xs" style={{ marginTop: 8 }}>Evidence: “{c.evidence}”</p> : <p className="muted text-xs" style={{ marginTop: 8 }}>Inference — no direct evidence in the scrape.</p>}
                </article>
              ))}
            </div>
          </section>

          {/* State summary */}
          <section className="seo-section">
            <h2>The five questions</h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Question</th><th>What we see</th></tr></thead>
                <tbody>
                  {result.state_summary.map((s, i) => (
                    <tr key={i}>
                      <td style={{ minWidth: 180 }}><strong className="text-sm">{s.question}</strong></td>
                      <td className="text-sm muted" style={{ maxWidth: 520 }}>{s.finding}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Method */}
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