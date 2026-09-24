/**
 * build-agent-videos.mjs — on-demand agent story video production.
 *
 * Reads the website's engine registry (25 live agents), maps each agent to the
 * parameterized HyperFrames template's variables, renders an MP4, extracts a
 * poster frame, and records it in the video registry the site reads.
 *
 * Usage:
 *   node scripts/build-agent-videos.mjs --agent content-radar   # one agent
 *   node scripts/build-agent-videos.mjs --all                    # every agent
 *
 * Voice: marketer and seller, never accountant — aspirational, no numbers,
 * no defensive register (see AGENT_QUALITY_STANDARD.md §9).
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TEMPLATE_DIR = path.resolve(ROOT, 'agent-video-template');
const ENGINES_PATH = path.resolve(ROOT, '../website/src/data/engines.js');
const OUTPUT_DIR = path.resolve(ROOT, '../website/public/videos/agents');
const VARS_DIR = path.resolve(ROOT, '.tmp/video-vars');
const REGISTRY_PATH = path.resolve(ROOT, '../website/src/data/videoRegistry.json');

const HF_ARGS = ['npx', '-y', 'hyperframes@0.8.54'];

// Agents with bespoke flagship videos — never overwritten by the templated build.
const BESPOKE = new Set(['seo-analyzer']);

// Journey stage → marketing label (operator voice, not the internal key).
const JOURNEY_LABEL = { attract: 'The Attract journey', convert: 'The Convert journey', grow: 'The Grow journey' };

/** Registry vibes — operator-grade one-liners for agents without a site vibe. */
const REGISTRY_VIBE = {
  'seo-analyzer': 'Be the answer when the question matters.',
  'content-radar': 'Finds the question nobody has answered well yet.',
  'angle-validator': 'Kills weak angles before they waste a single word.',
  researcher: 'Reads everything so the writer never has to guess.',
  'spec-builder': 'Writes instructions so clear they cannot be misread.',
  writer: 'Sounds like a person with scar tissue, not a press release.',
  editor: 'Removes the fabricated and defends the genuinely held.',
  distribute: 'One checked draft, every channel, no new lies.',
  'icp-clarifier': 'Shows you who actually buys, not who you think buys.',
  'competitor-intel': 'Reads what your competitors publish so you do not have to.',
  listener: 'Hears the market whispering and tells you when to shout.',
  'signals-scout': 'Turns weak signals into a why-now you can defend.',
  sniper: 'Writes outreach that references a real event, never a template.',
  qualifier: 'Surfaces what you do not know before it costs you the deal.',
  'deal-room': 'Gives you the whole deal in one brief, minutes before the call.',
  'health-monitor': 'A health score that explains itself, no black box.',
  'churn-predictor': 'Names the risk with evidence, not a hunch.',
  'expansion-radar': 'Tells you which accounts are ready to grow, before they ask.',
  'win-loss': 'Distils the post-mortems into patterns you can act on.',
  hygiene: 'Finds what is broken in the CRM before it breaks the forecast.',
  'forecast-analyser': 'Two numbers: what reps called, and what the evidence supports.',
  'workflow-builder': 'Turns a decision into a CRM spec the RevOps team can build.',
  diagnostic: 'Surfaces the truth the team has been avoiding, with receipts.',
  'planning-cycle': 'Turns the bruises of last quarter into the focus of this one.',
  'goal-designer': 'Makes targets ambitious enough to mean something.',
  'goal-integrity': 'Proves the math and flags the sandbagging.',
  'market-research': 'Maps the market so the plan aims at a real, sized prize.',
  'roadmap-align': 'Makes sure the plan and the pipeline are talking about the same quarter.',
  'campaign-builder': 'Turns one message into a calendar that actually reaches the buyer.',
  'account-planner': 'Picks the accounts worth a campaign before the campaign starts.',
  'abm-playbook': 'Builds the play that makes your named accounts feel chosen.',
  'video-outreach': 'Turns a signal into a 60-second video you could actually send.',
  'pricing-strategist': 'Prices the deal so the customer says yes and you still make margin.',
  'negotiation-coach': 'Prepares the concession map before the call, not after.',
  'onboarding-coach': 'Gets the customer to their first win before the enthusiasm fades.',
  'renewal-analyst': 'Starts the renewal conversation long before the contract date.',
  'cross-sell-scout': 'Spots the adjacent product the account is already asking for.',
  'pipeline-auditor': 'Finds the pipe that is full but empty.',
  attribution: 'Tells you which engine actually drove the revenue.',
  'comp-quota': 'Sets targets the reps believe and the math supports.',
  'chief-of-staff': 'Runs the weekly rhythm across every engine — what changed, what needs a decision, what to do.',
};

/** Map an agent + its engine to the template's 10 variables (corrected mapping). */
function mapToVariables(agent, engine) {
  return {
    agentName: agent.name,
    agentVibe: REGISTRY_VIBE[agent.id] ?? `${agent.role} — ${engine.what}`,
    engineName: engine.name,
    engineColor: engine.color || '#34d399',
    engineJourney: JOURNEY_LABEL[engine.journey] ?? `${engine.name} engine`,
    engineClaim: engine.claim || 'The engine that makes you the obvious choice.',
    takesLine: agent.take,
    givesLine: agent.give,
    honestyLine: 'Show up where it matters most.',
    agentRole: agent.role,
  };
}

/** Run a HyperFrames command in the template dir. Windows: npx is a .cmd, so use a shell. */
function run(scriptArgs) {
  return new Promise((resolve, reject) => {
    const cmd = [...HF_ARGS, ...scriptArgs].join(' ');
    const child = spawn(cmd, { cwd: TEMPLATE_DIR, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`hyperframes ${scriptArgs[0]} failed (${code}): ${out.slice(-400)}`))));
  });
}

async function buildAgent(agent, engine) {
  const variables = mapToVariables(agent, engine);
  const varFile = path.join(VARS_DIR, `${agent.id}-vars.json`);
  await mkdir(VARS_DIR, { recursive: true });
  await writeFile(varFile, JSON.stringify(variables, null, 2), 'utf8');

  const mp4 = path.join(OUTPUT_DIR, `${agent.id}.mp4`);
  const poster = path.join(OUTPUT_DIR, `${agent.id}-poster.jpg`);
  await mkdir(OUTPUT_DIR, { recursive: true });

  console.log(`\n📍 ${agent.name} (${engine.name})`);

  // check validates the template composition once (no variable flag on check);
  // render applies the per-agent variables.
  await run(['check']);
  console.log('  ✓ check');

  await run(['render', '--variables-file', varFile, '--output', mp4, '--quiet']);
  console.log(`  ✓ render → ${mp4}`);

  // Poster frame at 1.5s (past the fade-in).
  await new Promise((resolve, reject) => {
    const child = spawn(`ffmpeg -y -i "${mp4}" -ss 00:00:01 -vframes 1 -q:v 2 "${poster}"`, { shell: true });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg poster failed (${code})`))));
  });
  console.log(`  ✓ poster → ${poster}`);

  return { id: agent.id, name: agent.name, videoUrl: `/videos/agents/${agent.id}.mp4`, posterUrl: `/videos/agents/${agent.id}-poster.jpg`, role: agent.role, vibe: REGISTRY_VIBE[agent.id] ?? '' };
}

async function main() {
  const args = process.argv.slice(2);
  const onlyAgent = args.find((a) => a.startsWith('--agent='))?.split('=')[1] ?? null;
  const all = args.includes('--all');

  const { ENGINES } = await import(pathToFileURL(ENGINES_PATH).href);
  const agents = [];
  for (const engine of ENGINES) for (const agent of engine.agents) agents.push({ agent, engine });
  const filtered = onlyAgent ? agents.filter((a) => a.agent.id === onlyAgent) : all ? agents.filter((a) => !BESPOKE.has(a.agent.id)) : agents.slice(0, 1);
  if (!filtered.length) { console.error(`No agents matched${onlyAgent ? `: ${onlyAgent}` : ''}`); process.exit(1); }

  // Merge into any existing registry so building one agent never wipes others.
  let registry = {};
  try {
    const existing = await readFile(REGISTRY_PATH, 'utf8');
    // Strip a UTF-8 BOM if present (PowerShell writes one; JSON.parse rejects it).
    registry = JSON.parse(existing.replace(/^\uFEFF/, '') || '{}');
  } catch {
    registry = {};
  }
  for (const { agent, engine } of filtered) {
    try {
      const entry = await buildAgent(agent, engine);
      registry[entry.id] = entry;
    } catch (err) {
      console.error(`  ✗ ${agent.name}: ${err.message}`);
    }
  }

  await mkdir(path.dirname(REGISTRY_PATH), { recursive: true });
  await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf8');
  console.log(`\n✓ registry → ${REGISTRY_PATH}`);
  console.log(`\n✅ Done. ${Object.keys(registry).length} agents in registry.`);
}

main().catch((e) => { console.error(e); process.exit(1); });