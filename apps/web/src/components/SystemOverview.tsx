import { Card } from './ui';
import { GROUP_BY_ID, GROUP_ORDER } from '@gtm360/agent-registry';

/**
 * Graphical system overview — the outcome-driven engine plus the data layer.
 * Rendered as CSS boxes + arrows (no image assets, per repo convention).
 */

const CONNECTORS = [
  { name: 'DeepSeek', role: 'LLM — every agent' },
  { name: 'Cloudflare Workflows', role: 'Durable orchestrator' },
  { name: 'Supabase', role: 'Postgres · Auth · Storage' },
  { name: 'Tavily · Jina · academic', role: 'Research / scraping' },
  { name: 'Resend', role: 'Email delivery' },
  { name: 'HubSpot', role: 'CRM contact sync' },
];

export default function SystemOverview({ showLoop = true }: { showLoop?: boolean }) {
  return (
    <div className="sys-overview">
      <Card className="mb-md">
        <h2 className="section-title" style={{ marginTop: 0 }}>
          How Content Engine works
        </h2>
        <p className="muted">
          One loop, five engines. Every agent earns its place by the outcome it delivers — grounded in real
          research, fact-checked, and human-approved. Here's the machine.
        </p>

        <div className="sys-flow">
          {showLoop ? (
            <div className="engine-loop">
              {GROUP_ORDER.map((id) => {
                const g = GROUP_BY_ID[id];
                return (
                  <div key={id} className="engine-loop-node" style={{ borderColor: g.color, background: `color-mix(in srgb, ${g.color} 7%, white)` }}>
                    <span className="engine-loop-num" style={{ background: g.color }}>{g.number}</span>
                    <strong>{g.name}</strong>
                    <span className="engine-loop-verb">{g.verb}</span>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="sys-datagrid">
            {CONNECTORS.map((c) => (
              <div key={c.name} className="sys-node sys-node-connector">
                <strong>{c.name}</strong>
                <div className="sys-node-desc">{c.role}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}