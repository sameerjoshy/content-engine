import { useLocation } from 'react-router-dom';

/**
 * GuideLink — the "how to read this" bridge from a runtime output to its
 * plain-English guide on the website. Maps the current CE route to the canonical
 * guide at gtm-360.com/agents/<engine>/<agent>/guide. Rendered once in Layout so
 * every runtime output carries it automatically.
 */

const ROUTE_GUIDE: Record<string, { engine: string; agent: string }> = {
  '/seo': { engine: 'marketing', agent: 'seo-analyzer' },
  '/radar': { engine: 'marketing', agent: 'content-radar' },
  '/icp': { engine: 'marketing', agent: 'icp-clarifier' },
  '/competitor': { engine: 'marketing', agent: 'competitor-intel' },
  '/qualify': { engine: 'sales', agent: 'qualifier' },
  '/listen': { engine: 'sales', agent: 'listener' },
  '/snipe': { engine: 'sales', agent: 'sniper' },
  '/deal-room': { engine: 'sales', agent: 'deal-room' },
  '/scout': { engine: 'sales', agent: 'signals-scout' },
  '/diagnostic': { engine: 'strategy', agent: 'diagnostic' },
  '/goal-integrity': { engine: 'strategy', agent: 'goal-integrity' },
  '/planning': { engine: 'strategy', agent: 'planning-cycle' },
  '/goal-designer': { engine: 'strategy', agent: 'goal-designer' },
  '/market': { engine: 'strategy', agent: 'market-research' },
  '/roadmap-align': { engine: 'strategy', agent: 'roadmap-align' },
  '/campaign': { engine: 'marketing', agent: 'campaign-builder' },
  '/account-planner': { engine: 'marketing', agent: 'account-planner' },
  '/abm': { engine: 'marketing', agent: 'abm-playbook' },
  '/video-outreach': { engine: 'sales', agent: 'video-outreach' },
  '/pricing': { engine: 'sales', agent: 'pricing-strategist' },
  '/negotiation': { engine: 'sales', agent: 'negotiation-coach' },
  '/onboarding': { engine: 'expansion', agent: 'onboarding-coach' },
  '/renewal': { engine: 'expansion', agent: 'renewal-analyst' },
  '/cross-sell': { engine: 'expansion', agent: 'cross-sell-scout' },
  '/pipeline-audit': { engine: 'operations', agent: 'pipeline-auditor' },
  '/attribution': { engine: 'operations', agent: 'attribution' },
  '/comp-quota': { engine: 'operations', agent: 'comp-quota' },
  '/workflow': { engine: 'operations', agent: 'workflow-builder' },
  '/command': { engine: 'operations', agent: 'chief-of-staff' },
  '/churn': { engine: 'expansion', agent: 'churn-predictor' },
  '/expansion': { engine: 'expansion', agent: 'expansion-radar' },
  '/hygiene': { engine: 'operations', agent: 'hygiene' },
  '/forecast': { engine: 'operations', agent: 'forecast-analyser' },
  '/win-loss': { engine: 'operations', agent: 'win-loss' },
};

export default function GuideLink() {
  const { pathname } = useLocation();
  const match = Object.keys(ROUTE_GUIDE)
    .sort((a, b) => b.length - a.length)
    .find((k) => pathname === k || pathname.startsWith(k + '/'));
  if (!match) return null;

  const { engine, agent } = ROUTE_GUIDE[match];
  const url = `https://gtm-360.com/agents/${engine}/${agent}/guide`;

  return (
    <p className="guide-link">
      New to this?{' '}
      <a href={url} target="_blank" rel="noopener noreferrer">
        Read the plain-English guide →
      </a>{' '}
      <span className="muted">how to read the output and the terms it uses.</span>
    </p>
  );
}
