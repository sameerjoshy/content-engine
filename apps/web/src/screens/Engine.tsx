import { Card } from '../components/ui';
import { AGENTS, EXECUTIVE_LENSES, GROUP_BY_ID, GROUP_ORDER } from '@gtm360/agent-registry';
import { usePageTitle } from '../usePageTitle';

const STATUS_LABEL: Record<string, string> = {
  live: 'Live',
  demo: 'Demo',
  planned: 'Planned',
};

/**
 * The Agent Engine surface — the five engines and the canonical agents
 * that deliver them. One catalog, one look, powered by @gtm360/agent-registry.
 */
export default function Engine() {
  usePageTitle('Engine');
  return (
    <div>
      <div className="page-head">
        <h1>The Engine</h1>
        <p>25 specialist agents across five engines — Strategy, Marketing, Sales, Expansion, Operations. Grounded in evidence, gated by logic, approved by a human before it ships.</p>
      </div>

      <Card className="mb-md">
        <h2 className="section-title" style={{ marginTop: 0 }}>The loop</h2>
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
      </Card>

      <div className="engine-groups">
        {GROUP_ORDER.map((id) => {
          const g = GROUP_BY_ID[id];
          const agents = AGENTS.filter((a) => a.group === id);
          return (
            <Card key={id} className="engine-group" style={{ borderLeft: `4px solid ${g.color}`, background: `linear-gradient(180deg, color-mix(in srgb, ${g.color} 5%, white) 0%, #ffffff 120px)` }}>
              <div className="engine-group-head">
                <span className="engine-group-num" style={{ background: g.color }}>{g.number}</span>
                <div>
                  <h2>{g.name}</h2>
                  <p className="engine-group-verb">{g.verb} — {g.outcome}</p>
                </div>
              </div>
              <p className="engine-group-desc">{g.description}</p>
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
                    {a.legacyIds.length > 0 ? (
                      <div className="engine-agent-legacy">Absorbed: {a.legacyIds.join(', ')}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mb-md">
        <h2 className="section-title" style={{ marginTop: 0 }}>Executive lenses</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          The C-suite personas are views over the engine — each lens surfaces the groups that matter for that role.
        </p>
        <div className="engine-lenses">
          {EXECUTIVE_LENSES.map((l) => (
            <div key={l.id} className="engine-lens">
              <strong>{l.name}</strong>
              <span className="muted">{l.title}</span>
              <span className="engine-lens-groups">
                {l.groups.map((gid) => GROUP_BY_ID[gid].name).join(' · ')}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
