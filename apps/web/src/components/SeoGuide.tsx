import { useState } from 'react';

/**
 * "What am I looking at?" guide for the SEO Analyzer report.
 *
 * Explains the report in plain, consultant-grade language: what AEO/SEO is,
 * why it matters, how to read each section, and a glossary of the terms on
 * the page. Collapsible so it's there when needed, out of the way when not.
 * Written to the tone canon — no hype, no jargon soup, honest about what's
 * measured vs inferred.
 */

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: 'What this report is',
    body: (
      <>
        <p>
          This is an <strong>AI-visibility audit</strong> for a topic. Traditional SEO asks "how do you rank in Google?"
          This asks the newer question: "when a buyer asks an AI assistant — or searches — about this topic, can your site
          be the answer they're pointed to?" It's a different game: AI engines don't rank pages, they synthesize answers
          and cite sources. This report shows you which questions to win, whether your site can be cited, and how to fix
          it.
        </p>
      </>
    ),
  },
  {
    title: 'The score cards (top)',
    body: (
      <>
        <p>
          <strong>AEO Readiness</strong> is your overall AI-visibility health — one number out of 100. It's built from
          three layers:
        </p>
        <ul>
          <li>
            <strong>Discovery</strong> — can AI crawlers find you? (Your robots.txt, sitemap, and llms.txt.) Green means
            AI systems are allowed in.
          </li>
          <li>
            <strong>Parsability</strong> — can AI extract your answers? (Clean headings, FAQ schema, readable content.)
            This is the most common blocker: a site is findable but the answer is buried in JavaScript or unstructured
            prose, so AI can't quote it.
          </li>
          <li>
            <strong>Capability</strong> — can agents act on your site? (Machine-readable actions.) This is the most
            future-facing layer — most sites score low here.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'The Bottom Line',
    body: (
      <>
        <p>
          The executive summary: the problem (measured), the opportunity, and the single best move this week. If you
          only read one block, read this.
        </p>
      </>
    ),
  },
  {
    title: 'Priority Matrix (Your next moves)',
    body: (
      <>
        <p>
          The fix plan — what to do, in order of impact. Each fix card shows <strong>effort</strong> (estimated days),
          <strong> impact</strong> (what it should win), <strong>owner</strong> (a recommendation, not an assignment),
          and <strong>blocker</strong> (the risk that could slow it, e.g. legal review). Effort and impact are
          estimates — treat them as planning inputs, not promises.
        </p>
      </>
    ),
  },
  {
    title: 'Query clusters',
    body: (
      <>
        <p>
          The questions your buyers actually ask, grouped by intent: 🛒 Buying, ⚖️ Comparison, 🛠️ How-To, 📖
          Definitional, 💡 Recommend. Each row shows the query, who owns the top result, and whether you rank. Rows
          flagged <strong>Top gap</strong> are the highest-value ones to win — high demand, nobody (or a competitor)
          owning it.
        </p>
      </>
    ),
  },
  {
    title: 'Where You Stand',
    body: (
      <>
        <p>
          A measured benchmark: of the mapped queries, how many each party ranks for. If a competitor "owns" most of
          them, that's the clearest signal of where to focus.
        </p>
      </>
    ),
  },
  {
    title: 'Success frame & Method',
    body: (
      <>
        <p>
          <strong>Success frame:</strong> how you'll know the fixes worked — what to watch and when (citation lift,
          agent-parsing, traffic at 30/60 days).
        </p>
        <p>
          <strong>Method:</strong> honesty contract. <strong>Measured</strong> = directly observed from real search
          results and your site. <strong>Inferred</strong> = judgment on top of that (demand, intent, effort estimates).
          We always tell you which is which — nothing is dressed up as fact when it's a judgment.
        </p>
      </>
    ),
  },
];

const GLOSSARY: { term: string; def: string }[] = [
  { term: 'AEO', def: 'Answer Engine Optimization — making content answerable/citable by AI systems (ChatGPT, Perplexity, AI Overviews).' },
  { term: 'SERP', def: 'Search Engine Results Page — the page of results you see after a search.' },
  { term: 'PAA', def: 'People Also Ask — the related-questions box on Google; a strong assistant-style demand signal.' },
  { term: 'llms.txt', def: 'A small text file at your site root that lists your key pages for AI systems — an AI-friendly sitemap.' },
  { term: 'robots.txt', def: 'The file that tells crawlers what they may access. Whether AI crawlers are allowed or blocked lives here.' },
  { term: 'Schema / JSON-LD', def: 'Structured markup that tells machines what a page is (FAQ, Article, etc.) — makes answers extractable.' },
  { term: 'Citation likelihood', def: 'The chance a source gets cited in an AI answer. We improve the likelihood; we never guarantee citations.' },
  { term: 'Measured vs inferred', def: 'Measured = observed directly (real SERP results, your site). Inferred = our judgment on those signals.' },
];

export default function SeoGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="seo-guide">
      <button type="button" className="seo-guide-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>{open ? 'Hide guide' : 'What am I looking at? — a plain-English guide'}</span>
        <span className={`seo-guide-caret ${open ? 'is-open' : ''}`}>▸</span>
      </button>

      {open ? (
        <div className="seo-guide-body">
          {SECTIONS.map((s, i) => (
            <div key={i} className="seo-guide-section">
              <h3>{s.title}</h3>
              {s.body}
            </div>
          ))}
          <div className="seo-guide-section">
            <h3>Glossary</h3>
            <div className="seo-glossary">
              {GLOSSARY.map((g, i) => (
                <div key={i} className="seo-glossary-item">
                  <strong>{g.term}</strong>
                  <span>{g.def}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="seo-guide-note">
            Methodology draws on best-in-class AEO practice and the GTM-360 quality standard — every finding is grounded,
            and the report separates what's measured from what's inferred.
          </p>
        </div>
      ) : null}
    </div>
  );
}