import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface WorkflowResponse {
  verdict: string;
  platform: string;
  spec: { trigger: string; conditions: string[]; actions: string[]; edge_cases: string[] };
  clarifying_questions: string[];
  ready_to_build: boolean;
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

const PLATFORMS = ['HubSpot', 'Salesforce'];

export default function WorkflowBuilder() {
  usePageTitle('Workflow Builder');
  const [processDescription, setProcessDescription] = useState('');
  const [platform, setPlatform] = useState('HubSpot');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<WorkflowResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (processDescription.trim().length < 10) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<WorkflowResponse>('/api/workflow', {
        method: 'POST',
        body: JSON.stringify({ process_description: processDescription.trim(), platform }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Spec failed');
    } finally {
      setRunning(false);
    }
  }, [processDescription, platform]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Workflow Builder</h1>
        <p>
          <strong>What it does:</strong> turns a plain-language process decision into an implementation-ready CRM workflow
          spec — trigger, conditions, actions, and edge cases.
          <br />
          <strong>What you get:</strong> a spec a RevOps admin could build without asking you anything.
          <br />
          <strong>What it needs:</strong> the process in plain language and the CRM platform.
          <br />
          <strong>How it stays honest:</strong> the ambiguity gate surfaces the clarifying questions instead of guessing at
          the gaps — an ambiguous ask produces questions, not a wrong spec.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="seo-field">
            <label>Process description</label>
            <Textarea value={processDescription} placeholder="What should happen, in plain language. e.g. 'When a deal sits in Proposal for 14 days with no activity, notify the rep and create a task.'" onChange={(e) => setProcessDescription(e.target.value)} rows={6} />
          </div>
          <div className="seo-field">
            <label>CRM platform</label>
            <select className="input" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={processDescription.trim().length < 10 || running}>
            {running ? 'Specifying…' : 'Build the spec'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Reading the process → defining the trigger → mapping conditions and edge cases…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line" style={{ borderLeftColor: result.ready_to_build ? '#388e3c' : '#f57c00' }}>
              <h2>{result.ready_to_build ? 'Ready to build' : 'Not buildable yet'}</h2>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.verdict}</p>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="tag">{result.platform}</span>
                {result.clarifying_questions.length ? <span className="tag tag-p2">{result.clarifying_questions.length} open questions</span> : <span className="tag tag-own">No open questions</span>}
              </div>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Before you build</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.ready_to_build ? (
            <section className="seo-section">
              <h2>The spec</h2>
              <div className="seo-callout"><p><strong>Trigger:</strong> {result.spec.trigger}</p></div>
              <div className="seo-fix-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 12 }}>
                <article className="seo-fix seo-fix-p2">
                  <h3>Conditions</h3>
                  <ul>{result.spec.conditions.map((c, i) => <li key={i} className="text-sm">{c}</li>)}</ul>
                </article>
                <article className="seo-fix seo-fix-p3">
                  <h3>Actions</h3>
                  <ol>{result.spec.actions.map((a, i) => <li key={i} className="text-sm">{a}</li>)}</ol>
                </article>
              </div>
              {result.spec.edge_cases.length ? (
                <article className="seo-fix seo-fix-p1" style={{ marginTop: 12 }}>
                  <h3>Edge cases</h3>
                  <ul>{result.spec.edge_cases.map((c, i) => <li key={i} className="text-sm">{c}</li>)}</ul>
                </article>
              ) : null}
            </section>
          ) : null}

          {result.clarifying_questions.length ? (
            <section className="seo-section">
              <h2>Answer these first</h2>
              <ol>
                {result.clarifying_questions.map((q, i) => <li key={i} className="text-sm" style={{ marginBottom: 6 }}>{q}</li>)}
              </ol>
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