import type { Env } from '../env';
import type { FetchedDoc, SearchResult } from '../types';

/**
 * Tool layer for the Researcher. Free-tier providers with graceful fallback:
 *   search: Tavily (key) -> OpenAlex -> Semantic Scholar (both keyless)
 *   fetch : Jina Reader (r.jina.ai, keyless) with truncation
 *
 * Note: Brave was dropped (no longer offers a free plan).
 */

const MAX_TEXT_CHARS = 6000;

export async function searchWeb(env: Env, query: string, limit = 8): Promise<SearchResult[]> {
  if (env.TAVILY_API_KEY) {
    const r = await tavilySearch(env, query, limit);
    if (r.length) return r;
  }
  const r = await keylessSearch(query, limit);
  return r;
}

async function tavilySearch(env: Env, query: string, limit: number): Promise<SearchResult[]> {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: env.TAVILY_API_KEY,
        query,
        max_results: Math.min(limit, 10),
        search_depth: 'basic',
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: { title?: string; url?: string; content?: string; score?: number }[];
    };
    return (data.results ?? [])
      .filter((r) => r.url)
      .map((r) => ({
        title: r.title ?? '',
        url: r.url as string,
        snippet: r.content ?? '',
        source: 'tavily' as const,
      }));
  } catch {
    return [];
  }
}

async function keylessSearch(query: string, limit: number): Promise<SearchResult[]> {
  const out: SearchResult[] = [];
  const [oa, ss, wiki, hn, reddit] = await Promise.allSettled([
    openAlex(query, limit),
    semanticScholar(query, limit),
    wikipedia(query, limit),
    hackerNews(query, limit),
    redditRss(query, limit),
  ]);
  if (oa.status === 'fulfilled') out.push(...oa.value);
  if (ss.status === 'fulfilled') out.push(...ss.value);
  if (wiki.status === 'fulfilled') out.push(...wiki.value);
  if (hn.status === 'fulfilled') out.push(...hn.value);
  if (reddit.status === 'fulfilled') out.push(...reddit.value);
  return out.slice(0, limit);
}

/** Hacker News via the free Algolia API (keyless) — tech/startup discourse. */
async function hackerNews(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(
      query,
    )}&tags=story&hitsPerPage=${Math.min(limit, 8)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      hits?: { title?: string; url?: string; points?: number; objectID?: string }[];
    };
    return (data.hits ?? [])
      .map((h) => ({
        title: h.title ?? '',
        url: h.url ?? (h.objectID ? `https://news.ycombinator.com/item?id=${h.objectID}` : ''),
        snippet: h.points ? `${h.points} points on Hacker News` : 'Hacker News discussion',
        source: 'hacker_news' as const,
      }))
      .filter((r) => r.title && r.url);
  } catch {
    return [];
  }
}

/** Reddit via its keyless RSS search endpoint — buyer language, practitioner threads. */
async function redditRss(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const url = `https://www.reddit.com/search.rss?q=${encodeURIComponent(query)}&limit=${Math.min(limit, 8)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    const out: SearchResult[] = [];
    for (const block of blocks.slice(0, Math.min(limit, 8))) {
      const title = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1] ?? '';
      const link = block.match(/<link>(.*?)<\/link>/)?.[1] ?? '';
      const desc = (block.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/)?.[1] ?? '').replace(
        /<[^>]+>/g,
        '',
      );
      if (title && link) {
        out.push({
          title: title.trim(),
          url: link.trim(),
          snippet: desc.trim().slice(0, 200),
          source: 'reddit' as const,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function wikipedia(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query,
    )}&format=json&srlimit=${Math.min(limit, 10)}&origin=*`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: { search?: { title?: string; snippet?: string }[] };
    };
    return (data.query?.search ?? [])
      .map((r) => ({
        title: r.title ?? '',
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent((r.title ?? '').replace(/ /g, '_'))}`,
        snippet: (r.snippet ?? '').replace(/<[^>]+>/g, ''),
        source: 'wikipedia' as const,
      }))
      .filter((r) => r.title);
  } catch {
    return [];
  }
}

async function openAlex(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(
      query,
    )}&per-page=${Math.min(limit, 10)}&sort=relevance_score:desc`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: {
        title?: string;
        publication_date?: string;
        doi?: string;
        abstract_inverted_index?: Record<string, number[]>;
        primary_location?: { landing_page_url?: string };
      }[];
    };
    return (data.results ?? [])
      .map((w) => {
        const url = w.primary_location?.landing_page_url ?? (w.doi ? `https://doi.org/${w.doi}` : '');
        return {
          title: w.title ?? '',
          url,
          snippet: reconstructAbstract(w.abstract_inverted_index) ?? (w.publication_date ? `Published ${w.publication_date}` : ''),
          source: 'openalex' as const,
        };
      })
      .filter((r) => r.url);
  } catch {
    return [];
  }
}

/** Rebuild OpenAlex abstract text from its inverted-index representation. */
function reconstructAbstract(idx?: Record<string, number[]>): string | null {
  if (!idx || typeof idx !== 'object') return null;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(idx)) {
    for (const pos of positions) words[pos] = word;
  }
  return words.filter(Boolean).join(' ');
}

async function semanticScholar(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
      query,
    )}&limit=${Math.min(limit, 10)}&fields=title,url,year,abstract`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: { title?: string; url?: string; year?: number; abstract?: string }[];
    };
    return (data.data ?? [])
      .map((p) => ({
        title: p.title ?? '',
        url: p.url ?? '',
        snippet: p.abstract ?? '',
        source: 'semantic_scholar' as const,
      }))
      .filter((r) => r.url);
  } catch {
    return [];
  }
}

/** Fetch a URL and return clean text. Uses Jina Reader (keyless). Never throws. */
export async function fetchContent(url: string): Promise<FetchedDoc | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'X-Respond-With': 'markdown' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    let text = await res.text();
    text = text.slice(0, MAX_TEXT_CHARS);
    const title = firstLine(text) || url;
    return { url, title, text };
  } catch {
    return null;
  }
}

function firstLine(text: string): string {
  const line = text.split('\n').find((l) => l.trim().length > 3);
  return line?.trim().slice(0, 200) ?? '';
}

export function dedupeResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const r of results) {
    const key = r.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}