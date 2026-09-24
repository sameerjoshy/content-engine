import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface RenewalResponse {
  verdict: string;
  value_proof: { claim: string; evidence: string }[];
  offer: string;
  expansion_option: string;
  risk_plan: { risk: string; mitigation: string }[];
  timeline: { when: string; action: string }[];
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

export default function RenewalAnalyst() {
  usePageTitle('Renewal Analyst');
  const [healthData, setHealthData] = useState('');
  const [renewalDate, setRenewalDate] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RenewalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (healthData.trim().length < 10) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<RenewalResponse>('/api/renewal', {
        method: 'POST',
        body: JSON.stringify({ health_data: healthData.trim(), renewal_date: renewalDate.trim() || undefined }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Plan failed');
    } finally {
      setRunning(false);
    }
  }, [healthData, renewalDate]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Renewal Analyst</h1>
        <p>
          <strong>What it does:</strong> builds the renewal plan — starting from proof of value, not the contract date.
          <br />
          <strong>What you get:</strong> the value proof to present, how to frame the offer, the expansion option, the risks
          and mitigations, and a timeline working back from the renewal.
          <br />
          <strong>What it needs:</strong> the health data — add the renewal date to schedule the timeline.
          <br />
          <strong>How it stays honest:</strong> the value gate blocks a renewal plan with no evidence of value delivered —
          you cannot renew what you cannot prove.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="seo-field">
            <label>Health data</label>
            <Textarea value={healthData} placeholder="Usage, outcomes, support history, NPS — whatever shows value delivered (or not)." onChange={(e) => setHealthData(e.target.value)} rows={6} />
          </div>
          <div className="seo-field">
            <label>Renewal date (optional)</label>
            <Input value={renewalDate} placeholder="e.g. 2026-09-30" onChange={(e) => setRenewalDate(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={healthData.trim().length < 10 || running}>
            {running ? 'Building the plan…' : 'Build the renewal plan'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Establishing value → framing the offer → working back from the date…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line">
              <h2>The renewal</h2>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Before the conversation</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.value_proof.length ? (
            <section className="seo-section">
              <h2>Proof of value</h2>
              <div className="seo-fix-grid">
                {result.value_proof.map((v, i) => (
                  <article key={i} className="seo-fix seo-fix-p3">
                    <h3 style={{ margin: 0, fontSize: 15 }}>{v.claim}</h3>
                    <p className="muted text-sm" style={{ marginTop: 6 }}>{v.evidence}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="seo-section">
            <div className="seo-fix-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="seo-fix seo-fix-p2">
                <h3 style={{ margin: 0 }}>How to frame it</h3>
                <p className="text-sm" style={{ marginTop: 6 }}>{result.offer}</p>
              </div>
              <div className="seo-fix seo-fix-p3">
                <h3 style={{ margin: 0 }}>The expansion option</h3>
                <p className="text-sm" style={{ marginTop: 6 }}>{result.expansion_option}</p>
              </div>
            </div>
          </section>

          {result.risk_plan.length ? (
            <section className="seo-section">
              <h2>Risks and mitigations</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Risk</th><th>Mitigation</th></tr></thead>
                  <tbody>
                    {result.risk_plan.map((r, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{r.risk}</strong></td>
                        <td className="muted text-sm">{r.mitigation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {result.timeline.length ? (
            <section className="seo-section">
              <h2>Working back from the date</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>When</th><th>Action</th></tr></thead>
                  <tbody>
                    {result.timeline.map((t, i) => (
                      <tr key={i}>
                        <td className="text-sm">{t.when}</td>
                        <td className="muted text-sm">{t.action}</td>
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