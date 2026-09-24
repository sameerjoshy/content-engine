import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

type Framework = 'MEDDIC' | 'SPICED' | 'BANT';
type Status = 'present' | 'partial' | 'missing';

interface CriterionScore {
  criterion: string;
  status: Status;
  evidence: string | null;
  gap: string | null;
}

interface RiskFlag {
  severity: 'hard' | 'warn';
  flag: string;
  why: string;
}

interface QualifierResponse {
  framework: Framework;
  stage: string;
  readiness: number;
  verdict: string;
  scorecard: CriterionScore[];
  gap_questions: string[];
  risk_flags: RiskFlag[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

const STAGES = ['Prospecting', 'Discovery', 'Validation', 'Proposal', 'Negotiation', 'Legal / Procurement', 'Closed Won', 'Closed Lost'];

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  present: { label: 'Confirmed', cls: 'tag-own' },
  partial: { label: 'Partial', cls: 'tag-p2' },
  missing: { label: 'Unknown', cls: 'tag-p1' },
};

function tone(score: number) {
  if (score >= 75) return 'good';
  if (score >= 45) return 'warn';
  return 'bad';
}

export default function Qualifier() {
  usePageTitle('Qualifier');
  const [dealContext, setDealContext] = useState('');
  const [dealStage, setDealStage] = useState('Discovery');
  const [framework, setFramework] = useState<Framework>('MEDDIC');
  const [paperProcess, setPaperProcess] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QualifierResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (dealContext.trim().length < 20) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<QualifierResponse>('/api/qualify', {
        method: 'POST',
        body: JSON.stringify({
          deal_context: dealContext.trim(),
          deal_stage: dealStage,
          framework,
          paper_process: paperProcess.trim() || undefined,
        }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Qualification failed');
    } finally {
      setRunning(false);
    }
  }, [dealContext, dealStage, framework, paperProcess]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Qualifier</h1>
        <p>
          <strong>What it does:</strong> scores a live deal against your framework and shows you exactly what you still
          don't know — before it costs you the deal.
          <br />
          <strong>What you get:</strong> a criterion-by-criterion scorecard with the evidence, the exact questions to
          close each gap, and the stage risks worth flagging.
          <br />
          <strong>What it needs:</strong> the deal notes, the stage, and your framework.
          <br />
          <strong>How it stays honest:</strong> it never moves the deal. Every score cites your own notes — a gap is a
          gap, not a guess.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form">
          <div className="seo-field" style={{ flex: 1 }}>
            <label>Deal stage</label>
            <select className="input" value={dealStage} onChange={(e) => setDealStage(e.target.value)}>
              {STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="seo-field" style={{ flex: 1 }}>
            <label>Framework</label>
            <select className="input" value={framework} onChange={(e) => setFramework(e.target.value as Framework)}>
              <option value="MEDDIC">MEDDIC</option>
              <option value="SPICED">SPICED</option>
              <option value="BANT">BANT</option>
            </select>
          </div>
          <div className="seo-field" style={{ flex: 2 }}>
            <label>Paper process (legal / procurement / security)</label>
            <Input value={paperProcess} placeholder="e.g. security review required, legal redlines pending" onChange={(e) => setPaperProcess(e.target.value)} />
          </div>
        </div>
        <div className="seo-report-form" style={{ marginTop: 12 }}>
          <div className="seo-field" style={{ flex: 1 }}>
            <label>Deal notes</label>
            <Textarea
              value={dealContext}
              placeholder="Paste the CRM notes, email thread, or call summary. The more concrete the detail, the sharper the gaps."
              onChange={(e) => setDealContext(e.target.value)}
              rows={7}
            />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={dealContext.trim().length < 20 || running}>
            {running ? 'Qualifying…' : 'Run the review'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Scoring the deal → finding the gaps → flagging the stage risks…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          {/* Verdict */}
          <section className="seo-section">
            <div className={`seo-score-grid`} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <div className={`seo-score-card seo-score-${tone(result.readiness)}`}>
                <div className="seo-score-label">Readiness</div>
                <div className="seo-score-value">{result.readiness}%</div>
                <div className="seo-score-note">{result.framework} · {result.stage}</div>
              </div>
              <div className={`seo-score-card seo-score-${tone(result.readiness)}`} style={{ gridColumn: 'span 2', textAlign: 'left' }}>
                <div className="seo-score-label">Verdict</div>
                <div className="seo-score-note" style={{ fontSize: 16, marginTop: 6, lineHeight: 1.5 }}>{result.verdict}</div>
              </div>
            </div>
          </section>

          {/* Risk flags */}
          {result.risk_flags.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Risks to resolve</h2>
                {result.risk_flags.map((r, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{r.flag}</strong>
                    <span className="seo-risk-tag">{r.severity === 'hard' ? 'Hard flag' : 'Watch'}</span>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{r.why}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Scorecard */}
          <section className="seo-section">
            <h2>The scorecard</h2>
            <p className="seo-section-intro">Every criterion, scored against your own notes. Unknown is a finding, not a failure.</p>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Criterion</th>
                    <th>Status</th>
                    <th>Evidence / gap</th>
                  </tr>
                </thead>
                <tbody>
                  {result.scorecard.map((s, i) => (
                    <tr key={i}>
                      <td style={{ minWidth: 180 }}><strong className="text-sm">{s.criterion}</strong></td>
                      <td>
                        <span className={`tag ${STATUS_META[s.status].cls}`}>{STATUS_META[s.status].label}</span>
                      </td>
                      <td className="text-sm" style={{ maxWidth: 520 }}>
                        {s.evidence ? <span className="muted">“{s.evidence}”</span> : null}
                        {s.gap ? <span className="block text-xs" style={{ color: '#b45309', marginTop: 2 }}>Gap: {s.gap}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Gap questions */}
          {result.gap_questions.length ? (
            <section className="seo-section">
              <h2>The questions to ask next</h2>
              <p className="seo-section-intro">One sharp question per open gap. Get the answers before you advance the deal.</p>
              <ol className="flag-list" style={{ listStyle: 'decimal', paddingLeft: 20 }}>
                {result.gap_questions.map((q, i) => (
                  <li key={i} className="text-sm" style={{ padding: '6px 0', color: '#333' }}>{q}</li>
                ))}
              </ol>
            </section>
          ) : null}

          {/* Method */}
          <section className="seo-section">
            <h2>Method</h2>
            <div className="seo-method">
              <div>
                <span className="seo-label">Measured (from your input)</span>
                <ul>{result.measured_vs_inferred.measured.map((m, i) => <li key={i}>✓ {m}</li>)}</ul>
              </div>
              <div>
                <span className="seo-label">Inferred (judgment on it)</span>
                <ul>{result.measured_vs_inferred.inferred.map((m, i) => <li key={i}>~ {m}</li>)}</ul>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}