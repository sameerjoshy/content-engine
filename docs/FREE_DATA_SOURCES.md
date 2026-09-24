# Free Data Sources for the Engine

> Sources: [public-apis/public-apis](https://github.com/public-apis/public-apis) (MIT,
> 479k★, ~1,500 free APIs) + [marketinguys/awesome-gtm-engineering](https://github.com/marketinguys/awesome-gtm-engineering)
> (MIT, curated GTM-engineering tool index). These are the ones most relevant to the
> GTM-360 Agent Engine, mapped to the **five engines** (bowtie model) and the agents
> that consume data.
>
> **Before use:** every API below has its own terms/limits — verify current keys,
> quotas, and TOS. "Worker-native" = keyless HTTPS, safe to call directly from the
> Cloudflare Worker. Everything else goes through the local research companion or a
> keyed sidecar (Phase-3).

## Strategy · Know who to serve · decide what to do

| API | Source | Access | Use |
|---|---|---|---|
| GNews / Google News RSS | gnews.io | keyless / free key | market + trend context for planning and goal-setting |
| FRED | fred.stlouisfed.org | free key | macro indicators feeding plan targets |
| OpenAlex | openalex.org | keyless | academic/industry research (already in Researcher) |

## Marketing · Attract — position · ABM · content

| API | Source | Access | Use |
|---|---|---|---|
| Hacker News | news.ycombinator.com | keyless | startup/tech trends, product launches, HN reactions (Content Radar) |
| Reddit (JSON / .json endpoints) | reddit.com | keyless (rate-limited) | buyer language, pain points, subreddit sentiment (ICP, Radar) |
| Dev.to | dev.to | keyless | developer-market trends, tech discourse |
| Google News RSS / GNews | gnews.io | keyless / free key | news + trend detection per company/industry (Competitor Intel) |
| Wikipedia | wikipedia.org | keyless | background + named-entity grounding (Researcher) |
| Crossref / DOAJ | crossref.org / doaj.org | keyless | open-access research + statistics for proof |
| Jina Reader | r.jina.ai | keyless | page-to-text for source extraction (Researcher) |
| OpenAlex | openalex.org | keyless | academic research (Researcher) |
| Semantic Scholar | semanticscholar.org | keyless | academic citations (Researcher) |
| Serper / Brave (deprecated) | serper.dev | free key | search fallbacks (Tavily is primary) |
| NASA / Open Government data | data.gov etc. | keyless | domain-specific statistics |

## Sales · Convert — signal → outreach → qualify → close

| API | Source | Access | Use |
|---|---|---|---|
| Crunchbase (Basic) | crunchbase.com | free key | company funding, leadership, acquisitions → 52-trigger signals (Listener) |
| Clearbit Logo | logo.clearbit.com | keyless | account enrichment (logo/site) |
| Companies House | companieshouse.gov.uk | free key | UK company registry, filings, director changes |
| Reddit buyer-intent (subscope) | dancolta/subscope (keyless RSS) | keyless | buying-signal scan of subreddits without a Reddit account → Listener |
| RSS (any feed) | any | keyless | per-account/competitor signal feeds |
| ExchangeRate-API | exchangerate.host | keyless | currency normalization for deal values |
| V2EX / Bilibili | public | keyless | China-market signals (via Agent-Reach) |

## Expansion · Grow — retain · churn · land-and-expand

| API | Source | Access | Use |
|---|---|---|---|
| Clearbit Logo | logo.clearbit.com | keyless | account enrichment for account-health checks |
| Companies House | companieshouse.gov.uk | free key | customer-org changes → expansion timing signals |
| RSS (any feed) | any | keyless | customer/industry feeds for expansion readiness |

## Operations · Validate — hygiene · forecast · learnings

| API | Source | Access | Use |
|---|---|---|---|
| CoinGecko | coingecko.com | keyless | crypto deal/ARR normalization (if relevant) |
| Alpha Vantage | alphavantage.co | free key | market/company financials |
| Twelve Data | twelvedata.com | free key | market data, real-time quotes |
| FRED | fred.stlouisfed.org | free key | macro indicators for forecast context |

## Future-phase GTM-engineering stack (from awesome-gtm-engineering)

> Phase-3+ reference only. The engine runs on Workers + Supabase + DeepSeek today;
> none of these are installed. Revisit when the data layer or experimentation surface
> actually warrants them — never force-fit a tool.

| Layer | Candidates | When it matters |
|---|---|---|
| **Attribution & tracking** | Snowplow (first-party event tracking), UTM.io, Open Pixel | When the site/engine needs first-party event-level attribution beyond Plausible |
| **Analytics / event instrumentation** | PostHog, Amplitude, Heap | Product analytics for the CE/engine surfaces — only if Plausible proves insufficient |
| **CDP / data infrastructure** | Segment, RudderStack (open-source), dbt, Airbyte, Fivetran, Metabase | When a warehouse exists and agents need joined GTM data |
| **Experimentation** | GrowthBook (open-source), Statsig, VWO | A/B testing the marketing site — not active today |
| **Marketing automation APIs** | HubSpot API (already live), Customer.io, SendGrid | Extending the lead-capture + nurture layer |

## How to wire them in

1. **Worker-native (keyless):** add directly to `apps/api/src/lib/search.ts` / a new
   `sources.ts` in the Researcher pipeline — same pattern as OpenAlex/Scholar/Wikipedia.
2. **Keyed (free):** put keys in `.dev.vars`/worker secrets; add a graceful fallback
   like Tavily already has.
3. **Cookies/auth (Reddit/Twitter etc.):** route through the Agent-Reach research
   companion (local) or the Phase-3 sidecar — never the Worker.
4. **Content Radar + Listener:** Hacker News, GNews, Crunchbase, and RSS are the
   highest-leverage first additions (trend + signal coverage we currently lack).

## Security notes

- Prefer keyless/HTTPS sources inside the Worker (no secret surface).
- Free keys are fine, but treat them as low-trust: validate/limit what they feed.
- Never paste a third-party key into the frontend or into `AGENTS.md`.