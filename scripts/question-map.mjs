// Question-Intent layer (P1.5 prototype) — gather what people are ACTUALLY
// searching/asking around a topic, then cluster into intent buckets that map
// to article sections.
//
// Usage:
//   node scripts/question-map.mjs --topic "Miro Bending Spoons acquisition" [--seeds "miro,miro sold,why did miro"] [--llm] [--out question-map.md]
//
// Sources (all keyless):
//   - Google autocomplete (client=chrome, returns bare JSON array)
//   - Reddit search RSS
//   - Hacker News Algolia API
// `--llm` runs a DeepSeek pass to cluster the raw queries into intent buckets.
// `--recommend` (implies --llm) adds a pipeline mapping pass: per bucket, the
// recommended content format (article/howto/best_practice), the interaction
// device that fits, and a so-what demand verdict (VOICE_SYSTEM.md §8 step 6).

import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : undefined;
};
const has = (flag) => args.includes(flag);

const TOPIC = get('--topic');
if (!TOPIC) {
  console.error('Usage: node scripts/question-map.mjs --topic "..." [--seeds "a,b,c"] [--llm] [--out file.md]');
  process.exit(1);
}
const SEEDS = (get('--seeds') ?? TOPIC).split(',').map((s) => s.trim()).filter(Boolean);
const USE_LLM = has('--llm');
const USE_RECOMMEND = has('--recommend');
const OUT = get('--out');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Google autocomplete ─────────────────────────────────────────────────────
async function autocomplete(seed) {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=chrome&hl=en&q=${encodeURIComponent(seed)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    // client=chrome returns ["query", ["sugg1", "sugg2", ...], ...]
    return Array.isArray(data) && Array.isArray(data[1]) ? data[1].filter(Boolean) : [];
  } catch {
    return [];
  }
}

// ── Reddit search RSS ────────────────────────────────────────────────────────
async function reddit(query, n = 8) {
  try {
    const res = await fetch(`https://www.reddit.com/search.rss?q=${encodeURIComponent(query)}&limit=${n}&sort=relevance`, {
      headers: { 'User-Agent': 'gtm360-question-map/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    const out = [];
    for (const block of blocks.slice(0, n)) {
      const title = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1] ?? '';
      const link = block.match(/<link>(.*?)<\/link>/)?.[1] ?? '';
      if (title && link) out.push({ text: title.trim(), kind: 'reddit', url: link.trim() });
    }
    return out;
  } catch {
    return [];
  }
}

// ── Hacker News Algolia ─────────────────────────────────────────────────────
async function hackerNews(query, n = 8) {
  try {
    const res = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${n}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.hits ?? [])
      .map((h) => ({ text: h.title ?? '', kind: 'hacker_news', url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}` }))
      .filter((h) => h.text);
  } catch {
    return [];
  }
}

// ── DeepSeek clustering ──────────────────────────────────────────────────────
async function cluster(queries) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const sys = `You are a demand-analyst. Cluster these real user search queries/community posts about "${TOPIC}" into intent buckets.
Return ONLY JSON, no fences, shaped exactly like:
{
  "buckets": [
    { "intent": "informational|decision|comparison|howto|risk|timeline", "question": "the canonical question people are asking", "signals": ["raw query strings"], "count": 3, "demand": "high|medium|low", "answer_in_section": "what section of a deep-dive article answers this" }
  ]
}
Rules: derive the canonical question from the raw signals (never invent a question with no signal behind it). Rank by count. Group near-duplicates.`;
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: JSON.stringify(queries, null, 1) },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = (data.choices?.[0]?.message?.content ?? '').replace(/```json|```/g, '');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── DeepSeek pipeline mapping (recommend format + device + so-what) ────────
async function recommend(buckets) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const sys = `You are the Question stage of a content engine (VOICE_SYSTEM.md §8). For each intent bucket, map it to the pipeline:
Return ONLY JSON, no fences, shaped exactly like:
{
  "recommendations": [
    { "intent": "informational|decision|comparison|howto|risk|timeline", "question": "canonical question", "format": "article|howto|best_practice", "format_reason": "one line why this format fits this demand", "interaction_device": "number exchange|take-a-side|prediction|open loop|steelman|i-was-wrong|normalizing|insider reference|none (long-form)", "device_reason": "one line why this device grows out of THIS argument's tension", "sowhat": "PASS|STEER|KILL", "sowhat_reason": "is this burning right now? what live signal supports it" }
  ]
}
Rules: recommend the format the DEMAND actually implies (howto = people asking how; best_practice = who's doing X well / comparison; article = why/what happened). Never recommend a device that can't grow out of the claim. sowhat STEER must include what angle to sharpen.`;
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: JSON.stringify(buckets ?? [], null, 1) },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = (data.choices?.[0]?.message?.content ?? '').replace(/```json|```/g, '');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── Run ──────────────────────────────────────────────────────────────────────
const suggestions = [];
const community = [];
const errors = [];

for (const seed of SEEDS) {
  const sugs = await autocomplete(seed);
  if (sugs.length) suggestions.push(...sugs.map((s) => ({ text: s, kind: 'autocomplete', url: null })));
  else errors.push(`autocomplete: no results for "${seed}"`);
  await sleep(250);
}
for (const seed of SEEDS.slice(0, 3)) {
  community.push(...(await reddit(seed)));
  community.push(...(await hackerNews(seed)));
}

const seen = new Set();
const all = [...suggestions, ...community].filter((q) => {
  const t = q.text.toLowerCase().trim();
  if (t.length < 3) return false;
  if (seen.has(t)) return false;
  seen.add(t);
  return true;
});

const buckets = USE_LLM || USE_RECOMMEND ? await cluster(all.map((q) => ({ ...q }))) : null;
const recs = USE_RECOMMEND && buckets ? await recommend(buckets) : null;

const lines = [];
lines.push(`# Question Map — ${TOPIC}`);
lines.push('');
lines.push(`**Sources:** Google autocomplete, Reddit RSS, Hacker News (all keyless)`);
lines.push('');
lines.push(`## Raw signals (${all.length})`);
for (const q of all.slice(0, 40)) lines.push(`- [${q.kind}] ${q.text}${q.url ? ` <${q.url}>` : ''}`);
if (errors.length) {
  lines.push('');
  lines.push('## Source notes');
  for (const e of errors) lines.push(`- ⚠️ ${e}`);
}
if (buckets) {
  lines.push('');
  lines.push('## Intent buckets (clustered)');
  for (const b of buckets.buckets ?? []) {
    lines.push(`- **${b.intent} · ${b.demand}** — "${b.question}"`);
    lines.push(`  - signals: ${b.signals?.join(' | ') ?? ''}`);
    lines.push(`  - answers in: ${b.answer_in_section}`);
  }
}
if (recs) {
  lines.push('');
  lines.push('## Pipeline mapping (format · device · so-what)');
  for (const r of recs.recommendations ?? []) {
    lines.push(`- **${r.intent}** — "${r.question}"`);
    lines.push(`  - format: **${r.format}** — ${r.format_reason}`);
    lines.push(`  - device: ${r.interaction_device} — ${r.device_reason}`);
    lines.push(`  - so-what: **${r.sowhat}** — ${r.sowhat_reason}`);
  }
}
const md = lines.join('\n');
if (OUT) {
  writeFileSync(OUT, md, 'utf8');
  console.log(`Wrote ${OUT} (${md.length} chars).`);
} else {
  console.log(md);
}