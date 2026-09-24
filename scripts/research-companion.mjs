// Research Companion — gather expert quotes, named examples, and trends from
// the Agent-Reach channel stack (zero-config channels: YouTube, GitHub, web,
// RSS) into a structured brief importable into a Content Engine session.
//
// Usage:
//   node scripts/research-companion.mjs --topic "AI sales copilots" [--angle "Why most fail"] [--videos 5] [--repos 5] [--urls "https://a.com,https://b.com"] [--llm] [--out brief.md]
//
// `--llm` runs a DeepSeek pass to extract structured evidence (quotes /
// examples / trends) from the raw channel output. Channels that need cookies
// (X, Reddit, LinkedIn) are skipped unless their tool is configured.

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : undefined;
};
const has = (flag) => args.includes(flag);

const TOPIC = get('--topic');
if (!TOPIC) {
  console.error('Usage: node scripts/research-companion.mjs --topic "..." [--angle "..."] [--videos N] [--repos N] [--urls "..."] [--llm] [--out file.md]');
  process.exit(1);
}
const ANGLE = get('--angle') ?? '';
const VIDEOS = Number(get('--videos') ?? 5);
const REPOS = Number(get('--repos') ?? 5);
const URLS = (get('--urls') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const USE_LLM = has('--llm');
const OUT = get('--out');

const run = (raw) => {
  const parts = raw.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  const [cmd, ...args] = parts.map((p) => p.replace(/^"|"$/g, ''));
  const res = spawnSync(cmd, args, { encoding: 'utf8', timeout: 60000, windowsHide: true });
  return res.status === 0 ? res.stdout : '';
};

const results = {
  topic: TOPIC,
  angle: ANGLE,
  videos: [],
  repos: [],
  pages: [],
  rss: [],
  signals: [],
  errors: [],
};

// ── YouTube: top videos + (if extractable) a subtitle sample per video ──────
function youtubeSearch(query, n) {
  const out = run(`yt-dlp "ytsearch${n}:${query}" --flat-playlist --print "%(id)s|%(title)s|%(channel)s|%(duration_string)s"`);
  if (!out) { results.errors.push('youtube: no results (yt-dlp unavailable?)'); return; }
  for (const line of out.split('\n')) {
    const [id, title, channel, dur] = line.split('|');
    if (!id || !title) continue;
    results.videos.push({ id, title, channel: channel ?? '', dur: dur ?? '', url: `https://www.youtube.com/watch?v=${id}` });
  }
}

// ── GitHub: repos as named examples ────────────────────────────────────────
function githubSearch(query, n) {
  const q = JSON.stringify(query.replace(/"/g, ''));
  const out = run(`gh search repos ${q} --limit ${n} --json fullName,description,stargazersCount,url`);
  if (!out) { results.errors.push('github: no results (gh unavailable?)'); return; }
  try {
    const items = JSON.parse(out);
    for (const it of items) {
      results.repos.push({ name: it.fullName, desc: (it.description ?? '').slice(0, 160), stars: it.stargazersCount, url: it.url });
    }
  } catch { results.errors.push('github: parse failed'); }
}

// ── Web: Jina Reader on seed URLs ──────────────────────────────────────────
async function fetchPage(url) {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, { signal: AbortSignal.timeout(45000) });
    if (!res.ok) return '';
    const text = (await res.text()).slice(0, 6000);
    return text;
  } catch { return ''; }
}

// ── RSS: minimal title/link extraction ─────────────────────────────────────
async function fetchRss(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return;
    const xml = await res.text();
    const re = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/g;
    let m;
    while ((m = re.exec(xml)) && results.rss.length < 8) {
      const block = m[1];
      const title = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1] ?? '';
      const link = block.match(/<link[^>]*>(.*?)<\/link>/)?.[1] ?? block.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? '';
      if (title) results.rss.push({ title: title.slice(0, 140), url: link });
    }
  } catch {}
}

// ── Signals: Hacker News + Reddit RSS (keyless) ───────────────────────────
async function gatherSignals(query) {
  // Hacker News (Algolia API, keyless)
  try {
    const res = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=6`, { signal: AbortSignal.timeout(20000) });
    if (res.ok) {
      const data = await res.json();
      for (const h of (data.hits ?? []).slice(0, 6)) {
        if (!h.title) continue;
        results.signals.push({
          kind: 'hacker_news',
          title: h.title,
          url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
          score: h.points ? `${h.points} points` : '',
        });
      }
    }
  } catch { results.errors.push('signals: HN unreachable'); }

  // Reddit search RSS (keyless)
  try {
    const res = await fetch(`https://www.reddit.com/search.rss?q=${encodeURIComponent(query)}&limit=6`, { signal: AbortSignal.timeout(20000) });
    if (res.ok) {
      const xml = await res.text();
      const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
      for (const block of blocks.slice(0, 6)) {
        const title = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1] ?? '';
        const link = block.match(/<link>(.*?)<\/link>/)?.[1] ?? '';
        if (title && link) {
          results.signals.push({ kind: 'reddit', title: title.trim(), url: link.trim(), score: 'discussion' });
        }
      }
    }
  } catch { results.errors.push('signals: Reddit unreachable'); }
}

// ── DeepSeek: extract structured evidence from raw channel output ──────────
async function extractEvidence() {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) { results.errors.push('llm: DEEPSEEK_API_KEY not set'); return; }

  const corpus = [
    ...results.videos.map((v) => `VIDEO: ${v.title} — ${v.channel} (${v.url})`),
    ...results.repos.map((r) => `REPO: ${r.name} — ${r.desc} (${r.url})`),
    ...results.signals.map((s) => `SIGNAL (${s.kind}, ${s.score}): ${s.title} (${s.url})`),
    ...results.pages.map((p) => `PAGE ${p.url}:\n${p.text.slice(0, 1500)}`),
  ].join('\n\n');

  const sys = `You are the Researcher's evidence extractor for the topic "${TOPIC}"${ANGLE ? ` with the angle "${ANGLE}"` : ''}.
Return ONLY JSON, no markdown fences, shaped exactly like:
{
  "expert_quotes": [{ "text": "quote", "who": "speaker/organization", "source": "where it appeared", "url": "traceable url" }],
  "named_examples": [{ "name": "company/product", "context": "how it's relevant", "url": "traceable url" }],
  "trends": [{ "signal": "observed trend or counter-consensus point", "source": "where observed", "url": "traceable url" }],
  "gaps": ["what remains unknown or unsourced"]
}
Only include items that are directly traceable to the corpus. Do not invent. If the corpus has no quote, return an empty array.`;

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: corpus },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) { results.errors.push(`llm: HTTP ${res.status}`); return; }
    const data = await res.json();
    const raw = (data.choices?.[0]?.message?.content ?? '').replace(/```json|```/g, '');
    results.evidence = JSON.parse(raw);
  } catch (e) {
    results.errors.push(`llm: ${e?.message ?? 'unknown error'}`);
  }
}

function renderMarkdown() {
  const lines = [];
  lines.push(`# Research brief — ${TOPIC}`);
  if (ANGLE) lines.push(`\n**Angle:** ${ANGLE}\n`);
  lines.push(`\n## Candidate sources`);

  lines.push(`\n### Videos (${results.videos.length})`);
  for (const v of results.videos) lines.push(`- **${v.title}** — ${v.channel} (${v.dur}) <${v.url}>`);

  lines.push(`\n### Repos / named examples (${results.repos.length})`);
  for (const r of results.repos) lines.push(`- **${r.name}** ⭐${r.stars} — ${r.desc} <${r.url}>`);

  if (results.rss.length) {
    lines.push(`\n### Feed items (${results.rss.length})`);
    for (const i of results.rss) lines.push(`- ${i.title} <${i.url}>`);
  }

  if (results.signals.length) {
    lines.push(`\n### Signals (${results.signals.length})`);
    for (const s of results.signals) lines.push(`- [${s.kind}] ${s.title} — ${s.score} <${s.url}>`);
  }

  if (results.evidence) {
    const ev = results.evidence;
    lines.push(`\n## Extracted evidence`);
    lines.push(`\n### Expert quotes (${ev.expert_quotes?.length ?? 0})`);
    for (const q of ev.expert_quotes ?? []) lines.push(`- "${q.text}" — ${q.who} <${q.url}>`);
    lines.push(`\n### Named examples (${ev.named_examples?.length ?? 0})`);
    for (const x of ev.named_examples ?? []) lines.push(`- **${x.name}** — ${x.context} <${x.url}>`);
    lines.push(`\n### Trends / signals (${ev.trends?.length ?? 0})`);
    for (const t of ev.trends ?? []) lines.push(`- ${t.signal} — ${t.source} <${t.url}>`);
    lines.push(`\n### Gaps (${ev.gaps?.length ?? 0})`);
    for (const g of ev.gaps ?? []) lines.push(`- ${g}`);
  }

  if (results.errors.length) {
    lines.push(`\n## Channel notes`);
    for (const e of results.errors) lines.push(`- ⚠️ ${e}`);
  }
  return lines.join('\n');
}

youtubeSearch(TOPIC, VIDEOS);
githubSearch(TOPIC, REPOS);
await gatherSignals(TOPIC);
if (URLS.length) {
  for (const u of URLS) {
    const text = await fetchPage(u);
    if (text) results.pages.push({ url: u, text });
    else results.errors.push(`web: failed to read ${u}`);
  }
}
if (USE_LLM) await extractEvidence();

const brief = renderMarkdown();
if (OUT) {
  writeFileSync(OUT, brief, 'utf8');
  console.log(`Wrote ${OUT} (${brief.length} chars).`);
} else {
  console.log(brief);
}