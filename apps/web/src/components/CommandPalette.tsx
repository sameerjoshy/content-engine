import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GROUP_BY_ID, GROUP_ORDER } from '@gtm360/agent-registry';

interface PaletteItem {
  label: string;
  hint?: string;
  to: string;
  keywords?: string;
}

const NAV_ITEMS: PaletteItem[] = [
  { label: 'Lobby', hint: 'Home', to: '/', keywords: 'home start' },
  { label: 'Create — start an article', hint: 'Profiles', to: '/create', keywords: 'article write create' },
  { label: 'Content Radar', hint: 'Find a topic', to: '/radar', keywords: 'radar topic scan opportunity' },
  { label: 'SEO Analyzer', hint: 'AEO + search audit', to: '/seo', keywords: 'seo aeo search audit visibility schema' },
  { label: 'Qualifier', hint: 'Deal qualification review', to: '/qualify', keywords: 'qualify deal meddic spiced bant gap risk' },
  { label: 'Diagnostic', hint: 'GTM health assessment', to: '/diagnostic', keywords: 'diagnostic health constraint planning cycle' },
  { label: 'Listener', hint: 'Market signal scan', to: '/listen', keywords: 'listener signal market monitor triggers icp' },
  { label: 'Sniper', hint: 'Precision outreach draft', to: '/snipe', keywords: 'sniper outreach email linkedin draft personalized' },
  { label: 'ICP Clarifier', hint: 'Who actually buys', to: '/icp', keywords: 'icp ideal customer profile drift win rate segment' },
  { label: 'Deal Room', hint: 'Live deal brief', to: '/deal-room', keywords: 'deal room brief risk log stakeholders transcript next step' },
  { label: 'Hygiene', hint: 'CRM data integrity audit', to: '/hygiene', keywords: 'hygiene crm data integrity pipeline audit forecast blockers duplicates stale' },
  { label: 'Forecast Analyser', hint: 'Commit + best case', to: '/forecast', keywords: 'forecast commit best case gap target coverage confidence quarter' },
  { label: 'Win/Loss', hint: 'Why deals win or lose', to: '/win-loss', keywords: 'win loss analysis patterns won lost why competitor reasons' },
  { label: 'Goal Integrity', hint: 'OKR alignment + gaming', to: '/goal-integrity', keywords: 'okr goals integrity alignment gaming metric game kpi objective key result' },
  { label: 'Churn Radar', hint: 'Account health + churn risk', to: '/churn', keywords: 'churn customer health retention risk at-risk renewal nps usage account' },
  { label: 'Expansion Radar', hint: 'Upsell readiness', to: '/expansion', keywords: 'expansion upsell grow readiness headroom upsell cross-sell seats add-on' },
  { label: 'Signals Scout', hint: 'Intent for one account', to: '/scout', keywords: 'signals scout intent account fit tier target buying signal' },
  { label: 'Competitor Intel', hint: 'Competitor moves + what to do', to: '/competitor', keywords: 'competitor intel competitive brief rival moves attribution battlecard' },
  { label: 'Planning Cycle', hint: 'Quarterly retrospective', to: '/planning', keywords: 'planning cycle quarterly retrospective targets actuals focus carryover OKR review' },
  { label: 'Goal Designer', hint: 'Draft OKRs + ambition check', to: '/goal-designer', keywords: 'goal designer okr draft objectives key results ambition stretch sandbag' },
  { label: 'Market Research', hint: 'Size the market + whitespace', to: '/market', keywords: 'market research tam size segment whitespace entry priority competitive' },
  { label: 'Roadmap Align', hint: 'Goals vs pipeline reality', to: '/roadmap-align', keywords: 'roadmap align goals pipeline coverage capacity divergence reality check' },
  { label: 'Campaign Builder', hint: 'One message ? a campaign', to: '/campaign', keywords: 'campaign builder multi-channel arc calendar assets segment cta' },
  { label: 'Account Planner', hint: 'Tier your target accounts', to: '/account-planner', keywords: 'account planner tiering target accounts fit intent focus set abm' },
  { label: 'ABM Playbook', hint: 'Per-account plays', to: '/abm', keywords: 'abm playbook account based positioning story channels named accounts' },
  { label: 'Video Outreach', hint: 'Personalised video script', to: '/video-outreach', keywords: 'video outreach script hook proof ask personalised record loom' },
  { label: 'Pricing Strategist', hint: 'Deal pricing + packaging', to: '/pricing', keywords: 'pricing strategist anchor package concession floor margin guardrail deal' },
  { label: 'Negotiation Coach', hint: 'Concession map + call prep', to: '/negotiation', keywords: 'negotiation coach concession map trade guardrail call prep hold give' },
  { label: 'Onboarding Coach', hint: 'Path to first value', to: '/onboarding', keywords: 'onboarding coach time to value milestones success metrics first win' },
  { label: 'Renewal Analyst', hint: 'Renewal plan + value proof', to: '/renewal', keywords: 'renewal analyst value proof offer expansion risk timeline contract' },
  { label: 'Cross-Sell Scout', hint: 'Adjacent-product readiness', to: '/cross-sell', keywords: 'cross sell scout readiness adjacent product upsell multi-product health' },
  { label: 'Pipeline Auditor', hint: 'Is each stage earned?', to: '/pipeline-audit', keywords: 'pipeline auditor stage integrity evidence mismatch aged coverage forecast risk' },
  { label: 'Attribution', hint: 'Which engine drove revenue', to: '/attribution', keywords: 'attribution revenue touch channel engine model first last linear spend' },
  { label: 'Comp & Quota', hint: 'Quota + comp design', to: '/comp-quota', keywords: 'comp quota commission accelerator spiff territory capacity coverage reconciliation' },
  { label: 'Workflow Builder', hint: 'Plain language to CRM spec', to: '/workflow', keywords: 'workflow builder crm spec hubspot salesforce trigger conditions actions automation' },
  { label: 'Chief of Staff', hint: 'Weekly cross-engine brief', to: '/command', keywords: 'chief of staff command weekly brief cross-engine risks decisions orchestrate' },
  { label: 'Engine', hint: 'All agents by outcome', to: '/engine', keywords: 'agents registry outcome' },
  { label: 'Studio', hint: 'Edit profile inputs', to: '/studio', keywords: 'profile voice icp research' },
  ...GROUP_ORDER.map((id) => {
    const g = GROUP_BY_ID[id];
    return { label: `${g.name} space`, hint: g.verb, to: `/space/${id}`, keywords: `${g.name} ${g.verb} ${g.outcome}` };
  }),
];

/**
 * Command palette (Ctrl/Cmd+K) — quick navigation to any part of the engine,
 * in the style of Linear / Asana / Notion.
 */
export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV_ITEMS;
    return NAV_ITEMS.filter((i) => `${i.label} ${i.hint ?? ''} ${i.keywords ?? ''}`.toLowerCase().includes(q));
  }, [query]);

  const select = (item: PaletteItem) => {
    navigate(item.to);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Jump to a space, tool, or agent…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter' && items[active]) select(items[active]);
          }}
        />
        <div className="palette-list">
          {items.length === 0 ? (
            <div className="palette-empty">No matches for “{query}”.</div>
          ) : (
            items.map((item, i) => (
              <button
                key={item.to}
                type="button"
                className={`palette-item ${i === active ? 'palette-item-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => select(item)}
              >
                <span className="palette-label">{item.label}</span>
                {item.hint ? <span className="palette-hint">{item.hint}</span> : null}
              </button>
            ))
          )}
        </div>
        <div className="palette-footer">↑↓ navigate · Enter open · Esc close</div>
      </div>
    </div>
  );
}