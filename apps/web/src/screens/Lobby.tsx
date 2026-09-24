import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { api } from '../api';
import { Button, Card } from '../components/ui';
import { AGENTS, GROUP_BY_ID, GROUP_ORDER } from '@gtm360/agent-registry';
import { usePageTitle } from '../usePageTitle';

interface SessionRow {
  id: string;
  topic: string;
  status: string;
  format?: string;
  created_at?: string;
}

const STATUS_META: Record<string, { label: string; to: (id: string) => string }> = {
  in_progress: { label: 'In progress', to: (id) => `/workflow/${id}` },
  awaiting_review: { label: 'Awaiting review', to: (id) => `/research/${id}` },
  complete: { label: 'Complete', to: (id) => `/draft/${id}` },
  error: { label: 'Failed', to: (id) => `/workflow/${id}` },
};

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/**
 * The Lobby — the single entrance. Task-first: quick actions, continue where
 * you left off, then the five engines. Agents are the engine beneath,
 * surfaced on drill-down, never the headline.
 */
export default function Lobby() {
  usePageTitle('Lobby');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const name = (user?.user_metadata?.first_name as string | undefined) ?? user?.email?.split('@')[0] ?? 'there';

  useEffect(() => {
    api<{ sessions: SessionRow[] }>('/api/sessions')
      .then((r) => setSessions((r.sessions ?? []).slice(0, 6)))
      .catch(() => setSessions([]));
  }, []);

  const recent = sessions.filter((s) => s.status !== 'complete').slice(0, 3);
  const done = sessions.filter((s) => s.status === 'complete').slice(0, 3);

  return (
    <div>
      <div className="page-head">
        <h1>Welcome, {name}</h1>
        <p>What do you want to get done today? Pick a space — each one handles one part of the business.</p>
      </div>

      <Card className="mb-md">
        <h2 className="section-title" style={{ marginTop: 0 }}>Quick actions</h2>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Button onClick={() => navigate('/create')}>Start an article</Button>
          <Button variant="secondary" onClick={() => navigate('/radar')}>Find a topic</Button>
          <Button variant="secondary" onClick={() => navigate('/studio')}>Edit inputs</Button>
        </div>
      </Card>

      {recent.length > 0 || done.length > 0 ? (
        <Card className="mb-md">
          <h2 className="section-title" style={{ marginTop: 0 }}>Continue where you left off</h2>
          <div className="recent-list">
            {[...recent, ...done].map((s) => {
              const meta = STATUS_META[s.status];
              if (!meta) return null;
              return (
                <button key={s.id} type="button" className="recent-row" onClick={() => navigate(meta.to(s.id))}>
                  <span className="recent-topic">{s.topic || 'Untitled run'}</span>
                  <span className={`tag ${s.status === 'error' ? 'quality-low' : ''}`}>{meta.label}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{s.format ?? ''} {timeAgo(s.created_at)}</span>
                </button>
              );
            })}
          </div>
        </Card>
      ) : null}

      <h2 className="section-title">Pick a space</h2>
      <div className="lobby-grid">
        {GROUP_ORDER.map((id) => {
          const g = GROUP_BY_ID[id];
          const agents = AGENTS.filter((a) => a.group === id);
          return (
            <Card key={id} className="lobby-card" style={{ borderLeft: `4px solid ${g.color}`, background: `linear-gradient(180deg, color-mix(in srgb, ${g.color} 6%, white) 0%, #ffffff 140px)` }} onClick={() => navigate(`/space/${id}`)}>
              <div className="row-between">
                <span className="tag">{g.name} · {g.number}</span>
                <span className="muted" style={{ fontSize: 12 }}>{agents.length} agents</span>
              </div>
              <h2>{g.verb}</h2>
              <p className="lobby-outcome">{g.outcome}</p>
              <p className="lobby-desc">{g.description}</p>
              <div className="lobby-agents">
                {agents.slice(0, 5).map((a) => (
                  <span key={a.id} className="tag">{a.name}</span>
                ))}
              </div>
              <div className="lobby-actions">
                <Button className="btn-sm">Open space</Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
