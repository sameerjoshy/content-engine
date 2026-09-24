import type { Env } from '../env';
import type { SearchResult } from '../types';

/**
 * SEO/AEO data sources for the SEO Analyzer.
 *
 *   Serper (key)      — real Google SERP: organic positions, People-Also-Ask,
 *                       related searches. The measured layer.
 *   Google News RSS   — keyless trend + recency signals ("why now").
 *   robots.txt/sitemap — fetched directly for the three-layer AEO audit.
 *
 * Every function never throws — it returns [] / null on failure so the agent
 * degrades gracefully (same discipline as the Researcher's search chain).
 */

export interface SerperOrganic {
  title?: string;
  link?: string;
  snippet?: string;
  position?: number;
}

export interface SerperPaa {
  question?: string;
  snippet?: string;
  link?: string;
}

export interface SerperResponse {
  organic?: SerperOrganic[];
  peopleAlsoAsk?: SerperPaa[];
  relatedSearches?: { query?: string }[];
  knowledgeGraph?: { title?: string; description?: string };
  searchParameters?: { q?: string };
}

/** Real Google SERP via Serper (key). Returns organic results + PAA + related. */
export async function serperSearch(
  env: Env,
  query: string,
  num = 8,
): Promise<{ organic: SearchResult[]; paa: SerperPaa[]; related: string[] }> {
  const empty = { organic: [] as SearchResult[], paa: [] as SerperPaa[], related: [] as string[] };
  if (!env.SERPER_API_KEY) return empty;
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': env.SERPER_API_KEY },
      body: JSON.stringify({ q: query, num, gl: 'us', hl: 'en' }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return empty;
    const data = (await res.json()) as SerperResponse;
    const organic: SearchResult[] = (data.organic ?? [])
      .filter((r) => r.link)
      .map((r) => ({
        title: r.title ?? '',
        url: r.link as string,
        snippet: r.snippet ?? '',
        source: 'serper' as const,
      }))
      .slice(0, num);
    const paa = (data.peopleAlsoAsk ?? []).slice(0, 5);
    const related = (data.relatedSearches ?? []).map((r) => r.query ?? '').filter(Boolean).slice(0, 5);
    return { organic, paa, related };
  } catch {
    return empty;
  }
}

/** Google News RSS (keyless) — recency/trend signals for a topic. */
export async function googleNewsRss(query: string, limit = 6): Promise<SearchResult[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    const out: SearchResult[] = [];
    for (const block of blocks.slice(0, limit)) {
      const title = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1] ?? '';
      const link = block.match(/<link>(.*?)<\/link>/)?.[1] ?? '';
      const pub = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? '';
      if (title && link) {
        out.push({
          title: title.trim(),
          url: link.trim(),
          snippet: pub ? `Published ${pub.trim()}` : 'Google News',
          source: 'google_news' as const,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Fetch robots.txt for a domain — the discovery-layer audit input. */
export async function fetchRobotsTxt(domain: string): Promise<string | null> {
  try {
    const base = domain.startsWith('http') ? domain : `https://${domain}`;
    const res = await fetch(`${base}/robots.txt`, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    return (await res.text()).slice(0, 8000);
  } catch {
    return null;
  }
}

/** Fetch sitemap.xml (or robots-declared sitemap) and return the URLs listed. */
export async function fetchSitemapUrls(domain: string): Promise<string[]> {
  try {
    const base = domain.startsWith('http') ? domain : `https://${domain}`;
    const res = await fetch(`${base}/sitemap.xml`, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const urls = xml.match(/<loc>(.*?)<\/loc>/g) ?? [];
    return urls
      .map((u) => u.replace(/<\/?loc>/g, '').trim())
      .filter(Boolean)
      .slice(0, 500);
  } catch {
    return [];
  }
}

/** Fetch llms.txt if present — the AEO discovery-file audit input. */
export async function fetchLlmsTxt(domain: string): Promise<string | null> {
  try {
    const base = domain.startsWith('http') ? domain : `https://${domain}`;
    const res = await fetch(`${base}/llms.txt`, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    return (await res.text()).slice(0, 6000);
  } catch {
    return null;
  }
}

/** AI crawler classification for the robots.txt audit (Discovery layer). */
export interface AiCrawlerRule {
  userAgent: string;
  operator: string;
  purpose: 'training' | 'search_augmented' | 'browsing' | 'training_and_search';
  allowRecommended: boolean;
}

export const AI_CRAWLERS: AiCrawlerRule[] = [
  { userAgent: 'GPTBot', operator: 'OpenAI', purpose: 'training_and_search', allowRecommended: true },
  { userAgent: 'ChatGPT-User', operator: 'OpenAI', purpose: 'browsing', allowRecommended: true },
  { userAgent: 'OAI-SearchBot', operator: 'OpenAI', purpose: 'search_augmented', allowRecommended: true },
  { userAgent: 'ClaudeBot', operator: 'Anthropic', purpose: 'training_and_search', allowRecommended: true },
  { userAgent: 'Claude-Web', operator: 'Anthropic', purpose: 'browsing', allowRecommended: true },
  { userAgent: 'anthropic-ai', operator: 'Anthropic', purpose: 'training', allowRecommended: true },
  { userAgent: 'PerplexityBot', operator: 'Perplexity', purpose: 'search_augmented', allowRecommended: true },
  { userAgent: 'Google-Extended', operator: 'Google', purpose: 'training', allowRecommended: true },
  { userAgent: 'Bingbot', operator: 'Microsoft', purpose: 'search_augmented', allowRecommended: true },
  { userAgent: 'Applebot-Extended', operator: 'Apple', purpose: 'training', allowRecommended: true },
  { userAgent: 'Bytespider', operator: 'ByteDance', purpose: 'training', allowRecommended: false },
  { userAgent: 'CCBot', operator: 'Common Crawl', purpose: 'training', allowRecommended: false },
];