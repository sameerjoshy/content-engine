import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface GamingFlag { metric: string; loophole: string; question: string; severity: 'high' | 'medium' }

interface GoalIntegrityResponse {
  verdict: string;
  coverage: { objectives: number; with_measurable_kr: number; aligned_to_company: number };
  alignment: { objective: string; issue: string; detail: string }[];
  gaming_flags: GamingFlag[];
  score: { value: number; label: string };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

export default function GoalIntegrity() {
  usePageTitle('Goal Integrity');
  const [okrTree, setOkrTree] = useState('');
  const [companyPriorities, setCompanyPriorities] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<GoalIntegrityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (okrTree.trim().length < 20) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<GoalIntegrityResponse>('/api/goal-integrity', {
        method: 'POST',
        body: JSON.stringify({ okr_tree: okrTree.trim(), company_priorities: companyPriorities.trim() || undefined }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Audit failed');
    } finally {
      setRunning(false);
    }
  }, [okrTree, companyPriorities]);

  const cov = result?.coverage;

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Goal Integrity</h1>
        <p>
          <strong>What it does:</strong> checks whether your OKRs are real — every objective measurable, aligned to the
          company, and not gameable.
          <br />
          <strong>What you get:</strong> an alignment read, the objectives that are aspiration not commitment, and a
          gaming flag on any metric that can be hit without achieving the goal — with the one question that exposes it.
          <br />
          <strong>What it needs:</strong> your OKR tree — company priorities sharpen the alignment check.
          <br />
          <strong>How it stays honest:</strong> every flag names a metric that's actually in your tree, and asks a
          question you can verify rather than accusing anyone of anything.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="seo-field">
            <label>OKR tree</label>
            <Textarea value={okrTree} placeholder="Objective: Grow ARR&#10;  KR1: ARR $1.2M → $1.8M&#10;  KR2: Win rate 22% → 28%&#10;..." onChange={(e) => setOkrTree(e.target.value)} rows={8} />
          </div>
          <div className="seo-field">
            <label>Company priorities (optional)</label>
            <Input value={companyPriorities} placeholder="e.g. Land enterprise; expand the mid-market base" onChange={(e) => setCompanyPriorities(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={okrTree.trim().length < 20 || running}>
            {running ? 'Auditing…' : 'Check the OKRs'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Reading the tree → tracing objectives to KRs → probing for gaming…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line" style={{ borderLeftColor: result.score.value >= 60 ? '#388e3c' : result.score.value >= 35 ? '#f57c00' : '#d32f2f' }}>
              <h2>Can these goals drive the business?</h2>
              <p className="seo-bl-verdict">{result.score.label} — {result.score.value}/100</p>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
              {cov ? (
                <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                  <span className="tag">{cov.objectives} objectives</span>
                  <span className={`tag ${cov.with_measurable_kr === cov.objectives ? 'tag-own' : 'tag-p2'}`}>{cov.with_measurable_kr} measurable</span>
                  <span className={`tag ${cov.aligned_to_company === cov.objectives ? 'tag-own' : 'tag-p2'}`}>{cov.aligned_to_company} aligned</span>
                </div>
              ) : null}
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Integrity gates</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.alignment.length ? (
            <section className="seo-section">
              <h2>Objectives that don't hold up</h2>
              <div className="seo-fix-grid">
                {result.alignment.map((a, i) => (
                  <article key={i} className="seo-fix seo-fix-p2">
                    <h3 style={{ margin: 0, fontSize: 15 }}>{a.objective}</h3>
                    <p className="muted text-sm" style={{ marginTop: 6 }}><strong>{a.issue}</strong> — {a.detail}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {result.gaming_flags.length ? (
            <section className="seo-section">
              <h2>Metrics that can be gamed</h2>
              <p className="seo-section-intro">Each names the loophole and the one question that exposes it.</p>
              <div className="seo-fix-grid">
                {result.gaming_flags.map((f, i) => (
                  <article key={i} className={`seo-fix seo-fix-${f.severity === 'high' ? 'p1' : 'p2'}`}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: 15 }}>{f.metric}</h3>
                      <span className={`tag tag-${f.severity === 'high' ? 'p1' : 'p2'}`}>{f.severity}</span>
                    </div>
                    <p className="muted text-sm" style={{ marginTop: 6 }}>{f.loophole}</p>
                    <p className="text-sm" style={{ marginTop: 8 }}><strong>Ask:</strong> {f.question}</p>
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