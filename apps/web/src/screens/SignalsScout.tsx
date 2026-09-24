import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

type IntentTier = 'hot' | 'warm' | 'watch' | 'not-a-fit';
interface ScoutingSignal { signal: string; trigger: string; date: string | null; evidence: string | null; strength: 'strong' | 'moderate' | 'weak' }

interface ScoutResponse {
  company: string;
  verdict: string;
  tier: IntentTier;
  icp_fit: { fits: boolean; score: number; why: string };
  intent: { present: boolean; score: number; why: string };
  signals: ScoutingSignal[];
  approach: { angle: string; opener: string; caution: string };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

const TIER_CLASS: Record<IntentTier, string> = { hot: 'p1', warm: 'p2', watch: 'p3', 'not-a-fit': 'p2' };
const TIER_LABEL: Record<IntentTier, string> = { hot: 'Hot — work now', warm: 'Warm — hot signal, check fit', watch: 'Watch — fits, no signal yet', 'not-a-fit': 'Not a fit' };
const STRENGTH_CLASS: Record<ScoutingSignal['strength'], string> = { strong: 'p3', moderate: 'p2', weak: 'p1' };

export default function SignalsScout() {
  usePageTitle('Signals Scout');
  const [company, setCompany] = useState('');
  const [domain, setDomain] = useState('');
  const [icp, setIcp] = useState('');
  const [signals, setSignals] = useState('');
  const [lookback, setLookback] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ScoutResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!company.trim() || !icp.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<ScoutResponse>('/api/scout', {
        method: 'POST',
        body: JSON.stringify({
          company: company.trim(),
          domain: domain.trim() || undefined,
          icp: icp.trim(),
          signals: signals.trim(),
          lookback: lookback.trim() || undefined,
        }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scout failed');
    } finally {
      setRunning(false);
    }
  }, [company, domain, icp, signals, lookback]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Signals Scout</h1>
        <p>
          <strong>What it does:</strong> goes at one target account — assembles the intent picture and tells you whether
          to work it now.
          <br />
          <strong>What you get:</strong> an ICP-fit read, an intent read, a tier (hot → not a fit), and the angle, opener,
          and caution for the approach.
          <br />
          <strong>What it needs:</strong> the company, your ICP, and any signals you've gathered.
          <br />
          <strong>How it stays honest:</strong> fit alone is watch, not hot — and a hot signal at an account that doesn't
          fit your ICP is never a target. Both axes together earn "hot".
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <div className="seo-field" style={{ flex: 2, minWidth: 160 }}>
              <label>Company</label>
              <Input value={company} placeholder="e.g. Acme Corp" onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="seo-field" style={{ flex: 2, minWidth: 140 }}>
              <label>Domain (optional)</label>
              <Input value={domain} placeholder="acme.com" onChange={(e) => setDomain(e.target.value)} />
            </div>
            <div className="seo-field" style={{ flex: 1, minWidth: 120 }}>
              <label>Lookback (optional)</label>
              <Input value={lookback} placeholder="90 days" onChange={(e) => setLookback(e.target.value)} />
            </div>
          </div>
          <div className="seo-field">
            <label>Your ICP</label>
            <Input value={icp} placeholder="e.g. B2B SaaS, 200-1000 employees, US, RevOps buyer" onChange={(e) => setIcp(e.target.value)} />
          </div>
          <div className="seo-field">
            <label>Signals gathered</label>
            <Textarea value={signals} placeholder="Raised a $40M Series B (Mar 2026). Posted 4 enterprise sales roles. CRO departed. Adopted Snowflake." onChange={(e) => setSignals(e.target.value)} rows={5} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={!company.trim() || !icp.trim() || running}>
            {running ? 'Scouting…' : 'Scout this account'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Reading signals → scoring fit and intent → setting the tier…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line" style={{ borderLeftColor: result.tier === 'hot' ? '#d32f2f' : result.tier === 'watch' ? '#388e3c' : result.tier === 'warm' ? '#f57c00' : '#757575' }}>
              <h2>{result.company}</h2>
              <p className="seo-bl-verdict">{TIER_LABEL[result.tier]}</p>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
            </div>
          </section>

          <section className="seo-section">
            <div className="seo-fix-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="seo-fix seo-fix-p3">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>ICP fit</h3>
                  <span className={`tag tag-${result.icp_fit.fits ? 'p3' : 'p1'}`}>{result.icp_fit.fits ? 'Fits' : 'No fit'} · {Math.round(result.icp_fit.score * 100)}%</span>
                </div>
                <p className="muted text-sm" style={{ marginTop: 6 }}>{result.icp_fit.why}</p>
              </div>
              <div className="seo-fix seo-fix-p2">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>Live intent</h3>
                  <span className={`tag tag-${result.intent.present ? 'p3' : 'p1'}`}>{result.intent.present ? 'Present' : 'None'} · {Math.round(result.intent.score * 100)}%</span>
                </div>
                <p className="muted text-sm" style={{ marginTop: 6 }}>{result.intent.why}</p>
              </div>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Before you work it</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.signals.length ? (
            <section className="seo-section">
              <h2>The signals</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Signal</th><th>Trigger</th><th>Date</th><th>Strength</th><th>Evidence</th></tr></thead>
                  <tbody>
                    {result.signals.map((s, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{s.signal}</strong></td>
                        <td className="muted text-sm">{s.trigger}</td>
                        <td className="muted text-sm">{s.date ?? '—'}</td>
                        <td><span className={`tag tag-${STRENGTH_CLASS[s.strength]}`}>{s.strength}</span></td>
                        <td className="muted text-sm">{s.evidence ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="seo-section">
            <h2>The approach</h2>
            <div className="seo-callout">
              <p><strong>{result.approach.angle}</strong></p>
              <p className="text-sm" style={{ marginTop: 8 }}><em>"{result.approach.opener}"</em></p>
              <p className="muted text-sm" style={{ marginTop: 8 }}><strong>Caution:</strong> {result.approach.caution}</p>
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