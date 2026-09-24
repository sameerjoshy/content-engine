import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Profile } from '../types';
import { Button, Card, Field, Input, Spinner } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

type Archetype =
  | 'quiet_shift'
  | 'signal_vs_noise'
  | 'third_way'
  | 'long_game'
  | 'decision_framework'
  | 'howto'
  | 'best_practice'
  | 'frontier';

interface Opportunity {
  id: string;
  archetype: Archetype;
  topic: string;
  angle: string;
  question: string;
  suggested_format: 'article' | 'howto' | 'best_practice';
  suggested_depth: 'light' | 'moderate' | 'deep';
  scores: {
    demand: number;
    whitespace: number;
    insight_density: number;
    durability: number;
    frontier: number;
  };
  overall: number;
  why_now: string;
  signals: string[];
  source_urls: string[];
}

interface RadarResponse {
  opportunities: Opportunity[];
  scan_summary: string;
  scanned_at: string;
}

const ARCHETYPE_LABEL: Record<Archetype, string> = {
  quiet_shift: 'Quiet Shift',
  signal_vs_noise: 'Signal vs Noise',
  third_way: 'The Third Way',
  long_game: 'The Long Game',
  decision_framework: 'Decision Framework',
  howto: 'Deep How-To',
  best_practice: 'Best-Practice Scan',
  frontier: 'Frontier',
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="score-row">
      <span className="score-label">{label}</span>
      <div className="score-track">
        <div className="score-fill" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="score-val">{Math.round(value * 100)}</span>
    </div>
  );
}

export default function Radar() {
  usePageTitle('Radar');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<RadarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api<{ profiles: Profile[] }>('/api/profiles')
      .then((r) => {
        setProfiles(r.profiles);
        const saved = localStorage.getItem('ce.profileId');
        setSelectedId(saved && r.profiles.some((p) => p.id === saved) ? saved : r.profiles[0]?.id ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, []);

  const scan = useCallback(async () => {
    if (!selectedId) return;
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<RadarResponse>('/api/radar', {
        method: 'POST',
        body: JSON.stringify({ profile_id: selectedId, focus: focus.trim() || undefined }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }, [selectedId, focus]);

  const generate = async (o: Opportunity) => {
    localStorage.setItem('ce.profileId', selectedId ?? '');
    const res = await api<{ session_id: string }>('/api/run-article', {
      method: 'POST',
      body: JSON.stringify({
        profile_id: selectedId,
        topic: o.topic,
        angle: o.angle,
        depth: o.suggested_depth,
        format: o.suggested_format,
      }),
    });
    localStorage.setItem('ce.sessionId', res.session_id);
    navigate(`/workflow/${res.session_id}`);
  };

  return (
    <div>
      <div className="page-head">
        <h1>Content Radar</h1>
        <p>
          What should you write next? The radar scans what buyers are asking, what's trending, what's contra-consensus,
          and what's coming — then ranks the highest-leverage opportunities for this profile. Every angle is grounded in
          real search signals, not guesses.
        </p>
      </div>

      <Card className="mb-md">
        <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Profile</label>
            <select className="input" value={selectedId ?? ''} onChange={(e) => setSelectedId(e.target.value)}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 2 }}>
            <label>Focus topic (optional)</label>
            <Input value={focus} placeholder="e.g. territory planning, product-led growth, ABM" onChange={(e) => setFocus(e.target.value)} />
          </div>
          <Button onClick={scan} disabled={!selectedId || scanning}>
            {scanning ? 'Scanning signals…' : 'Scan'}
          </Button>
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </Card>

      {scanning ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Generating queries → searching the web → scoring opportunities…</p>
        </div>
      ) : null}

      {result ? (
        <>
          <p className="muted mb-md">
            <strong>{result.scan_summary}</strong> · scanned {new Date(result.scanned_at).toLocaleString()}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {result.opportunities.map((o) => (
              <Card key={o.id}>
                <div className="row-between">
                  <span className="tag">{ARCHETYPE_LABEL[o.archetype]}</span>
                  <span className="muted">
                    {o.suggested_format === 'howto' ? 'How-To' : o.suggested_format === 'best_practice' ? 'Best-Practice Scan' : 'Article'} · {o.suggested_depth} ·{' '}
                    <strong>{Math.round(o.overall * 100)}/100</strong>
                  </span>
                </div>
                <h3 className="mt-sm" style={{ marginBottom: 4 }}>
                  {o.topic}
                </h3>
                <p className="mb-sm">
                  <strong>Angle:</strong> {o.angle}
                </p>
                <p className="muted mb-sm">
                  <strong>Answers:</strong> "{o.question}"
                </p>
                <p className="mb-sm">
                  <strong>Why now:</strong> {o.why_now}
                </p>
                <div className="score-grid">
                  <ScoreBar label="Demand" value={o.scores.demand} />
                  <ScoreBar label="Whitespace" value={o.scores.whitespace} />
                  <ScoreBar label="Insight" value={o.scores.insight_density} />
                  <ScoreBar label="Durability" value={o.scores.durability} />
                  <ScoreBar label="Frontier" value={o.scores.frontier} />
                </div>
                {o.signals.length ? (
                  <ul className="flag-list mt-sm">
                    {o.signals.slice(0, 3).map((s, i) => (
                      <li key={i} className="muted">
                        {s}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="row-between mt-md">
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    {o.source_urls.slice(0, 3).map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noreferrer" className="muted" style={{ fontSize: 13 }}>
                        source {i + 1} ↗
                      </a>
                    ))}
                  </div>
                  <Button onClick={() => generate(o)}>Generate this piece</Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
