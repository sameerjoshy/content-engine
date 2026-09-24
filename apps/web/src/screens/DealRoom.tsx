import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface RiskItem { severity: 'critical' | 'high' | 'medium'; risk: string; why: string }
interface Stakeholder { name: string; role: string | null; sentiment: string | null }

interface DealRoomResponse {
  brief: string;
  stakeholders: Stakeholder[];
  readiness: { score: number; label: string };
  risk_log: RiskItem[];
  next_action: string;
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

const SEV_LABEL: Record<RiskItem['severity'], string> = { critical: 'P0', high: 'P1', medium: 'P2' };

export default function DealRoom() {
  usePageTitle('Deal Room');
  const [dealNotes, setDealNotes] = useState('');
  const [stakeholders, setStakeholders] = useState('');
  const [transcript, setTranscript] = useState('');
  const [paperProcess, setPaperProcess] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DealRoomResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (dealNotes.trim().length < 20) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<DealRoomResponse>('/api/deal-room', {
        method: 'POST',
        body: JSON.stringify({
          deal_notes: dealNotes.trim(),
          stakeholders: stakeholders.trim() || undefined,
          transcript: transcript.trim() || undefined,
          paper_process: paperProcess.trim() || undefined,
        }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Brief failed');
    } finally {
      setRunning(false);
    }
  }, [dealNotes, stakeholders, transcript, paperProcess]);

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>Deal Room</h1>
        <p>
          <strong>What it does:</strong> turns scattered deal notes, stakeholders, and call history into one live brief
          you read minutes before the call.
          <br />
          <strong>What you get:</strong> where the deal stands, a buyer-readiness read, the risk log ordered by what
          could kill it, and the single best next move.
          <br />
          <strong>What it needs:</strong> your deal notes — add stakeholders, the last transcript, and the paper process
          if you have them.
          <br />
          <strong>How it stays honest:</strong> it only names people who appear in your notes, and it escalates the two
          things that quietly stall deals — a missing economic buyer and an unmapped paper process.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="seo-field">
            <label>Deal notes</label>
            <Textarea value={dealNotes} placeholder="Where the deal stands, what changed, what's unresolved, next step…" onChange={(e) => setDealNotes(e.target.value)} rows={6} />
          </div>
          <div className="row" style={{ gap: 12 }}>
            <div className="seo-field" style={{ flex: 1 }}>
              <label>Stakeholders (optional)</label>
              <Input value={stakeholders} placeholder="Name — role — stance" onChange={(e) => setStakeholders(e.target.value)} />
            </div>
            <div className="seo-field" style={{ flex: 1 }}>
              <label>Paper process (optional)</label>
              <Input value={paperProcess} placeholder="Legal/procurement/security status" onChange={(e) => setPaperProcess(e.target.value)} />
            </div>
          </div>
          <div className="seo-field">
            <label>Last call transcript (optional)</label>
            <Textarea value={transcript} placeholder="Paste the transcript — it sharpens the brief and the risk log." onChange={(e) => setTranscript(e.target.value)} rows={4} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={run} disabled={dealNotes.trim().length < 20 || running}>
            {running ? 'Building the brief…' : 'Brief me on this deal'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Reading the notes → mapping stakeholders → ordering the risk log…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          <section className="seo-section">
            <div className="seo-bottom-line">
              <h2>Where the deal stands</h2>
              <p className="seo-bl-verdict">{result.readiness.label} — {result.readiness.score}/100</p>
              <p className="muted text-sm" style={{ marginTop: 6 }}>{result.brief}</p>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <span className={`tag ${result.readiness.score >= 70 ? 'tag-own' : result.readiness.score >= 45 ? 'tag-p2' : 'tag-p1'}`}>{result.readiness.label}</span>
                <span className="tag">{result.stakeholders.length} stakeholders mapped</span>
              </div>
            </div>
          </section>

          <section className="seo-section">
            <h2>Next move</h2>
            <div className="seo-callout">
              <p><strong>{result.next_action}</strong></p>
            </div>
          </section>

          {result.gates.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Deterministic gates fired</h2>
                {result.gates.map((g, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{g.gate}</strong>
                    <p className="muted text-sm" style={{ width: '100%', margin: '4px 0 0' }}>{g.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.risk_log.length ? (
            <section className="seo-section">
              <h2>Risk log — what could kill this</h2>
              <p className="seo-section-intro">Ordered by severity. The top row is what to resolve first.</p>
              <div className="seo-fix-grid">
                {result.risk_log.map((r, i) => (
                  <article key={i} className={`seo-fix seo-fix-${r.severity === 'critical' ? 'p1' : r.severity === 'high' ? 'p2' : 'p3'}`}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0 }}>{r.risk}</h3>
                      <span className={`tag ${r.severity === 'critical' ? 'tag-p1' : r.severity === 'high' ? 'tag-p2' : 'tag-p3'}`}>{SEV_LABEL[r.severity]}</span>
                    </div>
                    <p className="muted text-sm" style={{ marginTop: 6 }}>{r.why}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {result.stakeholders.length ? (
            <section className="seo-section">
              <h2>Who's in the room</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Name</th><th>Role</th><th>Stance</th></tr></thead>
                  <tbody>
                    {result.stakeholders.map((s, i) => (
                      <tr key={i}>
                        <td><strong className="text-sm">{s.name}</strong></td>
                        <td className="muted text-sm">{s.role ?? '—'}</td>
                        <td className="text-sm">{s.sentiment ?? '—'}</td>
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