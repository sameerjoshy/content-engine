// Experience Layer elicitation (VOICE_SYSTEM.md §3, EXPERIENCE_LAYER.md).
//
// The moat. This tool helps an operator surface scar tissue they don't
// normally articulate, then writes it into ce_experience so the pipeline's
// Proprietary POV stage can use it. It NEVER invents an entry — every field is
// the operator's own words, and "I don't have one" is a valid answer.
//
// Usage:
//   node scripts/experience-elicitation.mjs --email you@company.com
//   node scripts/experience-elicitation.mjs --user <uuid> [--tags "territory design,OKR"]
//   node scripts/experience-elicitation.mjs --prompts            # print the prompts
//   node scripts/experience-elicitation.mjs --list --email you@company.com
//   node scripts/experience-elicitation.mjs --import entries.json --user <uuid>
//   node scripts/experience-elicitation.mjs --export out.json --user <uuid>
//
// Env (already persisted User-scoped on this machine): SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.

import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : undefined;
};
const has = (flag) => args.includes(flag);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PROMPTS = [
  {
    key: 'official_vs_actual',
    label: 'The "official vs actual" gap',
    q: 'Where have you seen the public explanation of something not match what actually happened? ("We said X failed because Y, but it really failed because Z — six weeks earlier.")',
  },
  {
    key: 'three_times',
    label: 'The three-times pattern',
    q: 'What have you watched play out three or more times until it became a rule? (Three times = pattern, not anecdote.)',
  },
  {
    key: 'mistake_ledger',
    label: 'The mistake ledger',
    q: 'What decision cost you — and what would you tell a younger operator instead? What did you believe that turned out wrong?',
  },
  {
    key: 'counterexample',
    label: 'The counterexample',
    q: 'What does "everyone says" that your own experience contradicts?',
  },
  {
    key: 'inside_the_room',
    label: 'Inside-the-room knowledge',
    q: 'What happens in a GTM decision room that never makes it into a case study — the politics, the slide that stopped being believed, the real reason the deal stalled?',
  },
  {
    key: 'unsentimental',
    label: 'The unsentimental explanation',
    q: 'Where is the honest reason uncomfortable and nobody publishes it? ("The renewal was never about price; the champion lost the budget fight in March.")',
  },
  {
    key: 'no_citations',
    label: 'What you would still believe with no citations',
    q: 'If every article on your topic vanished tomorrow, what conviction would remain, and why?',
  },
];

function headers(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function resolveUser(email, userId) {
  if (userId) return userId;
  if (!email) return undefined;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers: headers() });
  if (!res.ok) throw new Error(`User lookup failed (${res.status}). Pass --user <uuid> instead.`);
  const data = await res.json();
  const users = data.users ?? data;
  const hit = (users ?? []).find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase());
  if (!hit) throw new Error(`No user found for ${email}.`);
  return hit.id;
}

async function insertEntry(entry) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/ce_experience`, {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error(`Insert failed (${res.status}): ${await res.text()}`);
  return (await res.json())[0];
}

async function listEntries(userId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/ce_experience?user_id=eq.${userId}&order=created_at.desc`,
    { headers: headers() },
  );
  if (!res.ok) throw new Error(`List failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function main() {
  if (has('--prompts')) {
    console.log('Elicitation prompts (run these to surface scar tissue):\n');
    PROMPTS.forEach((p, i) => console.log(`${i + 1}. ${p.label}\n   ${p.q}\n`));
    return;
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment.');
    process.exit(1);
  }

  const email = get('--email');
  const userId = await resolveUser(email, get('--user'));
  if (!userId) {
    console.error('Provide --user <uuid> or --email <address>.');
    process.exit(1);
  }

  if (has('--list')) {
    const entries = await listEntries(userId);
    if (!entries.length) {
      console.log('Experience Layer is empty — nothing to show. That is an honest answer, not a failure.');
      return;
    }
    for (const e of entries) {
      console.log(`\n[${e.id}] ${e.publishable ? 'publishable' : 'INTERNAL'} · occurrences=${e.occurrences} · tags=${(e.applicable_tags ?? []).join(', ') || '—'}`);
      console.log(`  insight: ${e.insight}`);
      if (e.scar) console.log(`  scar:    ${e.scar}`);
      if (e.changed_mind_from) console.log(`  changed: ${e.changed_mind_from} → ${e.changed_mind_to}`);
    }
    return;
  }

  if (has('--export')) {
    const entries = await listEntries(userId);
    writeFileSync(get('--export'), JSON.stringify(entries, null, 2), 'utf8');
    console.log(`Exported ${entries.length} entries to ${get('--export')}`);
    return;
  }

  if (has('--import')) {
    const raw = JSON.parse(readFileSync(get('--import'), 'utf8'));
    const items = Array.isArray(raw) ? raw : raw.entries ?? [];
    let n = 0;
    for (const it of items) {
      if (!it.insight) continue;
      await insertEntry({ user_id: userId, ...it, applicable_tags: it.applicable_tags ?? [] });
      n++;
    }
    console.log(`Imported ${n} entries.`);
    return;
  }

  // Interactive elicitation.
  const rl = createInterface({ input, output });
  console.log('\nGTM-360 Experience Layer — elicitation');
  console.log('Answer what you actually have. "skip" or empty = no entry (honest absence is the rule).');
  console.log('Every field is your own words; nothing here is invented for you.\n');

  const tags = (get('--tags') ?? '').split(',').map((t) => t.trim()).filter(Boolean);
  const tagList = tags.length
    ? tags
    : (await rl.question('Topic tags for this session (comma-separated, e.g. "territory design, pipeline hygiene"): '))
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

  const only = get('--prompt');
  const chosen = only ? [PROMPTS[Number(only) - 1]].filter(Boolean) : PROMPTS;

  let saved = 0;
  for (const p of chosen) {
    console.log(`\n── ${p.label} ──`);
    console.log(p.q);
    const insight = (await rl.question('\nYour insight (or "skip"): ')).trim();
    if (!insight || /^skip$/i.test(insight)) {
      console.log('Skipped — the layer stays honest.');
      continue;
    }
    const scar = (await rl.question('The scar — what happened that taught you this? (1-2 sentences): ')).trim();
    const pattern = (await rl.question('The pattern — the general rule a reader can take away: ')).trim();
    const counter = (await rl.question('The counter — what the mainstream narrative gets wrong: ')).trim();
    const occRaw = (await rl.question('How many times have you seen this play out? (3+ = pattern): ')).trim();
    const occurrences = Math.max(1, Number(occRaw) || 1);
    const from = (await rl.question('Changed your mind? What did you believe before? (blank = no): ')).trim();
    const to = from ? (await rl.question('What do you believe now? ')).trim() : '';
    const story = from ? (await rl.question('What happened that changed it? ')).trim() : '';
    const pub = (await rl.question('Publishable as your public POV? (y/n, default y): ')).trim().toLowerCase();

    const entry = {
      user_id: userId,
      insight,
      scar: scar || null,
      pattern: pattern || null,
      counter: counter || null,
      applicable_tags: tagList,
      changed_mind_from: from || null,
      changed_mind_to: to || null,
      changed_mind_story: story || null,
      occurrences,
      publishable: pub !== 'n',
    };
    const saved_entry = await insertEntry(entry);
    saved++;
    console.log(`✓ Saved entry ${saved_entry.id}${entry.publishable ? '' : ' (internal — shapes thinking, never published verbatim)'}.`);
  }

  rl.close();
  console.log(`\nDone. ${saved} entr${saved === 1 ? 'y' : 'ies'} added. Grow it weekly — the moat compounds.`);
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
});