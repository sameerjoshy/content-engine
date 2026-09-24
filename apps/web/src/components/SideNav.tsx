import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AGENTS, GROUP_BY_ID, GROUP_ORDER, type GroupId } from '@gtm360/agent-registry';

/**
 * Left-hand engine navigation — Clari/DemandFarm-style flow.
 *
 * Groups are ordered by the bowtie model and labelled by their role in the
 * revenue flow:
 *   TOP ENVELOPE   → Strategy
 *   THE JOURNEY    → Marketing (Attract) → Sales (Convert) → Expansion (Grow)
 *   BOTTOM ENVELOPE→ Operations
 *
 * Sections are collapsible; the section containing the active agent stays
 * open. Every agent is listed under its engine and links to its surface
 * (or the engine space when it has no dedicated screen yet).
 */

const JOURNEY_LABEL: Record<string, string> = {
  attract: 'Attract',
  convert: 'Convert',
  grow: 'Grow',
};

// Agent id → surface route. Agents without a dedicated screen fall back to /space/:group.
const AGENT_ROUTE: Record<string, string> = {
  'seo-analyzer': '/seo',
  qualifier: '/qualify',
  diagnostic: '/diagnostic',
  listener: '/listen',
  sniper: '/snipe',
  'icp-clarifier': '/icp',
  'deal-room': '/deal-room',
  hygiene: '/hygiene',
  'forecast-analyser': '/forecast',
  'win-loss': '/win-loss',
  'churn-predictor': '/churn',
  'expansion-radar': '/expansion',
  'signals-scout': '/scout',
  'competitor-intel': '/competitor',
  'planning-cycle': '/planning',
  'goal-designer': '/goal-designer',
  'market-research': '/market',
  'roadmap-align': '/roadmap-align',
  'campaign-builder': '/campaign',
  'account-planner': '/account-planner',
  'abm-playbook': '/abm',
  'video-outreach': '/video-outreach',
  'pricing-strategist': '/pricing',
  'negotiation-coach': '/negotiation',
  'onboarding-coach': '/onboarding',
  'renewal-analyst': '/renewal',
  'cross-sell-scout': '/cross-sell',
  'pipeline-auditor': '/pipeline-audit',
  attribution: '/attribution',
  'comp-quota': '/comp-quota',
  'workflow-builder': '/workflow',
  'chief-of-staff': '/command',
  'health-monitor': '/churn',
  'content-radar': '/radar',
  'angle-validator': '/create',
  researcher: '/create',
  'spec-builder': '/create',
  writer: '/create',
  editor: '/create',
  distribute: '/create',
};

export default function SideNav() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const isActivePath = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname === path || pathname.startsWith(path + '/');
  };

  const isActiveGroup = (groupId: string) => {
    // The group is active if any agent under it matches the current route.
    const agents = AGENTS.filter((a) => a.group === groupId);
    return agents.some((a) => isActivePath(AGENT_ROUTE[a.id] ?? `/space/${groupId}`));
  };

  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  // Flow order: top envelope first, then journey in order, then bottom envelope.
  const topGroups = GROUP_ORDER.filter((id) => GROUP_BY_ID[id].envelope === 'top');
  const journeyGroups = GROUP_ORDER.filter((id) => GROUP_BY_ID[id].envelope === 'journey');
  const bottomGroups = GROUP_ORDER.filter((id) => GROUP_BY_ID[id].envelope === 'bottom');

  const renderGroup = (groupId: GroupId) => {
    const g = GROUP_BY_ID[groupId];
    const agents = AGENTS.filter((a) => a.group === groupId);
    const active = isActiveGroup(groupId);
    const expanded = open[groupId] ?? active;
    const journeyLabel = g.journey ? JOURNEY_LABEL[g.journey] : null;
    return (
      <div key={groupId} className="side-nav-section">
        <button
          type="button"
          className={`side-nav-engine ${active ? 'is-active' : ''}`}
          onClick={() => toggle(groupId)}
          aria-expanded={expanded}
        >
          <span className="side-nav-dot" style={{ background: g.color }} />
          <span className="side-nav-engine-name">{g.name}</span>
          {journeyLabel ? <span className="side-nav-journey">{journeyLabel}</span> : null}
          <span className={`side-nav-caret ${expanded ? 'is-open' : ''}`}>▸</span>
        </button>
        {expanded ? (
          <div className="side-nav-agents">
            {agents.map((a) => {
              const route = AGENT_ROUTE[a.id] ?? `/space/${groupId}`;
              return (
                <Link key={a.id} to={route} className={`side-nav-agent ${isActivePath(route) ? 'is-active' : ''}`} title={a.role}>
                  {a.name}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <aside className="side-nav">
      <div className="side-nav-section">
        <span className="side-nav-label">Engine</span>
        <Link to="/engine" className={`side-nav-link ${isActivePath('/engine') ? 'is-active' : ''}`}>
          All engines
        </Link>
      </div>

      {topGroups.length ? (
        <div className="side-nav-flow">
          <span className="side-nav-label">Top envelope</span>
          {topGroups.map(renderGroup)}
        </div>
      ) : null}

      {journeyGroups.length ? (
        <div className="side-nav-flow">
          <span className="side-nav-label">The journey</span>
          {journeyGroups.map(renderGroup)}
        </div>
      ) : null}

      {bottomGroups.length ? (
        <div className="side-nav-flow">
          <span className="side-nav-label">Bottom envelope</span>
          {bottomGroups.map(renderGroup)}
        </div>
      ) : null}
    </aside>
  );
}