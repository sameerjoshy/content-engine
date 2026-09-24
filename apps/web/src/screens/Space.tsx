import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card } from '../components/ui';
import { AGENTS, GROUP_BY_ID } from '@gtm360/agent-registry';
import { usePageTitle } from '../usePageTitle';

const STATUS_LABEL: Record<string, string> = { live: 'Live', demo: 'Demo', planned: 'Planned' };

interface SpaceTool {
  label: string;
  to?: string;
  external?: string;
}

const SPACE_TOOLS: Record<string, { note: string; tools: SpaceTool[] }> = {
  strategy: {
    note: 'The top envelope — know who to serve, decide what to do. Goals, OKRs, alignment, ambition, and integrity.',
    tools: [
      { label: 'Run the diagnostic', to: '/diagnostic' },
      { label: 'Check goal integrity', to: '/goal-integrity' },
      { label: 'Run the planning cycle', to: '/planning' },
      { label: 'Draft goals', to: '/goal-designer' },
      { label: 'Size the market', to: '/market' },
      { label: 'Align the plan', to: '/roadmap-align' },
      { label: 'Open Compass', external: 'https://okr.gtm-360.com' },
      { label: 'Find content opportunities', to: '/radar' },
      { label: 'Track a competitor', to: '/competitor' },
    ],
  },
  marketing: {
    note: 'The Attract journey — position, ABM, and the full content pipeline: angle to research to spec to write to edit to distribute.',
    tools: [
      { label: 'Start an article', to: '/create' },
      { label: 'Edit inputs', to: '/studio' },
      { label: 'Scan for topics', to: '/radar' },
      { label: 'SEO & AEO audit', to: '/seo' },
      { label: 'Find your real ICP', to: '/icp' },
      { label: 'Build a campaign', to: '/campaign' },
      { label: 'Tier target accounts', to: '/account-planner' },
      { label: 'Build account plays', to: '/abm' },
    ],
  },
  sales: {
    note: 'The Convert journey — runs on Cockpit: signal, outreach, qualification, and deal intelligence.',
    tools: [
      { label: 'Open Cockpit', external: 'https://brain.gtm-360.com' },
        { label: 'Scan signals', to: '/listen' },
        { label: 'Scout an account', to: '/scout' },
        { label: 'Draft outreach', to: '/snipe' },
        { label: 'Qualify a deal', to: '/qualify' },
        { label: 'Brief me on a deal', to: '/deal-room' },
        { label: 'Draft a video script', to: '/video-outreach' },
        { label: 'Price a deal', to: '/pricing' },
        { label: 'Prep a negotiation', to: '/negotiation' },
    ],
  },
  expansion: {
    note: 'The Grow journey — retain and grow the book: account health, churn risk, and expansion readiness.',
    tools: [{ label: 'Read account health', to: '/churn' }, { label: 'Find expansion signal', to: '/expansion' }, { label: 'Plan onboarding', to: '/onboarding' }, { label: 'Plan a renewal', to: '/renewal' }, { label: 'Scan for cross-sell', to: '/cross-sell' }, { label: 'Open Cockpit', external: 'https://brain.gtm-360.com' }],
  },
  operations: {
    note: 'The bottom envelope — validate the numbers and learn from every deal: hygiene, forecast confidence, win/loss, and workflow.',
    tools: [{ label: 'Run the weekly brief', to: '/command' }, { label: 'Audit pipeline hygiene', to: '/hygiene' }, { label: 'Audit stage integrity', to: '/pipeline-audit' }, { label: 'Build the forecast', to: '/forecast' }, { label: 'Analyze win/loss', to: '/win-loss' }, { label: 'Attribute revenue', to: '/attribution' }, { label: 'Design comp & quota', to: '/comp-quota' }, { label: 'Build a CRM workflow', to: '/workflow' }, { label: 'Open Compass', external: 'https://okr.gtm-360.com' }],
  },
};

export default function Space() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const group = id ? GROUP_BY_ID[id as keyof typeof GROUP_BY_ID] : undefined;
  usePageTitle(group ? `${group.name} space` : 'Space');

  if (!group) {
    return (
      <div>
        <h1>Space not found</h1>
        <Button onClick={() => navigate('/')}>Back to the lobby</Button>
      </div>
    );
  }

  const agents = AGENTS.filter((a) => a.group === group.id);
  const space = SPACE_TOOLS[group.id] ?? { note: '', tools: [] };

  return (
    <div>
      <button type="button" className="btn btn-tertiary btn-sm mb-md" onClick={() => navigate('/')}>
        ← Lobby
      </button>

      <div className="page-head">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="engine-loop-num" style={{ background: group.color }}>{group.number}</span>
          {group.name}
        </h1>
        <p>{group.verb} — {group.outcome}</p>
      </div>

      <Card className="mb-md" style={{ borderLeft: `4px solid ${group.color}`, background: `linear-gradient(180deg, color-mix(in srgb, ${group.color} 6%, white) 0%, #ffffff 150px)` }}>
        <p className="muted" style={{ margin: 0 }}>{group.description}</p>
      </Card>

      <Card className="mb-md">
        <h2 className="section-title" style={{ marginTop: 0 }}>Tools in this space</h2>
        <p className="muted" style={{ marginBottom: 16 }}>{space.note}</p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {space.tools.map((t) =>
            t.external ? (
              <a key={t.label} href={t.external} target="_blank" rel="noreferrer" className="btn btn-secondary">
                {t.label} ↗
              </a>
            ) : (
              <Button key={t.label} onClick={() => navigate(t.to!)}>
                {t.label}
              </Button>
            ),
          )}
        </div>
      </Card>

      <h2 className="section-title">Agents in this space</h2>
      <div className="engine-agents">
        {agents.map((a) => (
          <div key={a.id} className="engine-agent">
            <div className="row-between">
              <strong>{a.name}</strong>
              <span className="tag">{STATUS_LABEL[a.status] ?? a.status}</span>
            </div>
            <div className="engine-agent-role">{a.role}</div>
            {a.vibe ? <div className="engine-agent-vibe">{a.vibe}</div> : null}
            <p>{a.whatItDoes}</p>
            <div className="engine-agent-flow">
              <span>Takes: {a.inputs.map((i) => i.name).join(' · ')}</span>
              <span>Delivers: {a.outputs.map((o) => o.name).join(' · ')}</span>
            </div>
            {a.legacyIds.length > 0 ? <div className="engine-agent-legacy">Absorbed: {a.legacyIds.join(', ')}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}