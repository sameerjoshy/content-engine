// Registry consistency audit. Run: node scripts/validate-registry.mts
import { AGENTS, AGENT_BY_ID, GROUP_BY_ID, GROUP_ORDER } from '@gtm360/agent-registry';

const issues: string[] = [];
const ok = (msg: string) => console.log(`  PASS  ${msg}`);
const fail = (msg: string) => issues.push(msg);

console.log(`Registry audit — ${AGENTS.length} canonical agents\n`);

// 1. Unique ids
const ids = AGENTS.map((a) => a.id);
if (new Set(ids).size !== ids.length) fail('DUPLICATE agent ids');
else ok('agent ids unique');

// 2. Groups and order
if (GROUP_ORDER.length !== 5) fail(`expected 5 engines, got ${GROUP_ORDER.length}`);
else ok('5 engines present');

// 3. Per-agent consistency
for (const a of AGENTS) {
  if (!GROUP_BY_ID[a.group]) fail(`${a.id}: invalid group '${a.group}'`);
  if (!['live', 'demo', 'planned'].includes(a.status)) fail(`${a.id}: invalid status '${a.status}'`);
  if (!['content-engine', 'crew', 'cockpit', 'compass'].includes(a.source)) fail(`${a.id}: invalid source '${a.source}'`);
  if (a.inputs.length === 0) fail(`${a.id}: no inputs`);
  if (a.outputs.length === 0) fail(`${a.id}: no outputs`);
  if (a.gates.length === 0) fail(`${a.id}: no logic gates`);
  for (const h of a.handoffs) {
    if (!AGENT_BY_ID[h.to]) fail(`${a.id}: handoff '${h.to}' does not resolve`);
  }
}

// 4. Legacy id collisions
const seen = new Map<string, string>();
for (const a of AGENTS) {
  for (const l of a.legacyIds) {
    if (seen.has(l)) fail(`legacyId '${l}' claimed by both ${seen.get(l)} and ${a.id}`);
    seen.set(l, a.id);
  }
}

// 5. Every group has at least one agent; every agent covered
for (const g of GROUP_ORDER) {
  const n = AGENTS.filter((a) => a.group === g).length;
  if (n === 0) fail(`group ${g} has no agents`);
  else ok(`${GROUP_BY_ID[g].name} → ${n} agents`);
}

// 6. Handoff graph must not contain direct self-loops
for (const a of AGENTS) {
  for (const h of a.handoffs) {
    if (h.to === a.id) fail(`${a.id}: handoff to itself`);
  }
}

console.log('');
if (issues.length) {
  console.log(`✗ ${issues.length} issue(s):`);
  for (const i of issues) console.log(`  - ${i}`);
  process.exit(1);
} else {
  console.log('✓ Registry is consistent.');
}