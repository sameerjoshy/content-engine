import { Link, useLocation } from 'react-router-dom';
import { GROUP_BY_ID, AGENTS } from '@gtm360/agent-registry';

/**
 * Breadcrumb trail — shows where the user is in the engine hierarchy:
 *   GTM-360 / Marketing / SEO Analyzer
 * Derives the trail from the current route + the registry. Falls back to a
 * simple Home → Section trail for routes without an agent/engine match.
 */

interface Crumb {
  label: string;
  to?: string;
}

const ROUTE_CRUMB: Record<string, { label: string; to?: string }> = {
  '/': { label: 'Home' },
  '/engine': { label: 'Engine' },
  '/create': { label: 'Create' },
  '/radar': { label: 'Content Radar' },
  '/seo': { label: 'SEO Analyzer' },
  '/studio': { label: 'Studio' },
  '/draft': { label: 'Draft' },
  '/workflow': { label: 'Workflow' },
};

// Dedicated agent routes → their engine group (so the breadcrumb shows the parent engine).
const ROUTE_GROUP: Record<string, string> = {
  '/seo': 'marketing',
  '/radar': 'marketing',
  '/create': 'marketing',
  '/studio': 'marketing',
};

export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const crumbs: Crumb[] = [{ label: 'GTM-360', to: '/' }];

  const pushEngine = (groupId: string) => {
    const g = GROUP_BY_ID[groupId as keyof typeof GROUP_BY_ID];
    if (g) crumbs.push({ label: g.name, to: `/space/${g.id}` });
  };

  // Agent match: /space/<group> → Engine / Agent, or a dedicated agent route.
  const spaceMatch = pathname.match(/^\/space\/([a-z]+)$/);
  if (spaceMatch) {
    const g = GROUP_BY_ID[spaceMatch[1] as keyof typeof GROUP_BY_ID];
    if (g) pushEngine(g.id);
    const agent = AGENTS.find((a) => a.group === spaceMatch[1]);
    if (agent && agent.group === spaceMatch[1]) {
      crumbs.push({ label: agent.name, to: `/space/${agent.group}` });
    }
  } else {
    // Dedicated route: engine parent (from the registry) then the agent/section.
    const matchedRoute = Object.keys(ROUTE_CRUMB)
      .filter((k) => k !== '/')
      .sort((a, b) => b.length - a.length)
      .find((k) => pathname === k || pathname.startsWith(k + '/'));
    if (matchedRoute) {
      const parentGroup = ROUTE_GROUP[matchedRoute];
      if (parentGroup) pushEngine(parentGroup);
      const crumb = ROUTE_CRUMB[matchedRoute];
      if (crumb.to) crumbs.push({ label: crumb.label, to: crumb.to });
      else crumbs.push({ label: crumb.label });
    } else {
      const seg = pathname.split('/').filter(Boolean).pop() ?? '';
      if (seg) crumbs.push({ label: seg.charAt(0).toUpperCase() + seg.slice(1) });
    }
  }

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {crumbs.map((c, i) => (
        <span key={i} className="breadcrumbs-item">
          {i > 0 ? <span className="breadcrumbs-sep">/</span> : null}
          {c.to && i < crumbs.length - 1 ? (
            <Link to={c.to} className="breadcrumbs-link">
              {c.label}
            </Link>
          ) : (
            <span className="breadcrumbs-current">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}