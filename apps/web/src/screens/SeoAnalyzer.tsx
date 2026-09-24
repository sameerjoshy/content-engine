import { useCallback, useState } from 'react';
import { api } from '../api';
import { Button, Input, Spinner } from '../components/ui';
import { usePageTitle } from '../usePageTitle';
import SeoGuide from '../components/SeoGuide';

type Intent = 'recommend' | 'comparison' | 'how_to' | 'definition' | 'buying';
type Coverage = 'own' | 'competitor' | 'nobody';
type FixWave = 'wave1' | 'wave2';
type EffortTier = 'High' | 'Medium' | 'Low';

interface QueryRow {
  query: string;
  intent: Intent;
  demand: number;
  signal_sources: string[];
  coverage: Coverage;
  top_ranked_url: string | null;
  competitor_owner: string | null;
  brand_rank: number | null;
  is_top_gap: boolean;
  note: string;
}

interface AeoCheck {
  name: string;
  pass: boolean;
  detail: string;
}

interface AeoLayer {
  layer: 'discovery' | 'parsability' | 'capability';
  score: number;
  checks: AeoCheck[];
}

interface LostPrompt {
  query: string;
  intent: Intent;
  cited_by: string;
  why_they_win: string;
  fix_priority: 'P1' | 'P2' | 'P3';
}

interface FixItem {
  priority: 'P1' | 'P2' | 'P3';
  wave: FixWave;
  target_queries: string[];
  fix: string;
  detail: string;
  effort_days: number;
  effort_tier: EffortTier;
  impact_estimate: string;
  blocker: string | null;
  owner: string;
  handoff: string;
}

interface ExecutiveSummary {
  verdict: string;
  problem: string;
  opportunity: string;
  first_move: string;
}

interface SuccessMetric {
  metric: string;
  target: string;
  cadence: string;
}

interface CompetitiveBenchmark {
  brand_queries_ranked: number;
  competitors: { name: string; queries_ranked: number }[];
}

interface SeoResponse {
  topic_cluster: string;
  domain: string;
  executive_summary: ExecutiveSummary;
  summary: string;
  query_map: QueryRow[];
  aeo_readiness: { overall: number; layers: AeoLayer[] };
  lost_prompts: LostPrompt[];
  fix_pack: FixItem[];
  future_proofing: FixItem[];
  competitive_benchmark: CompetitiveBenchmark;
  success_frame: SuccessMetric[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
  scanned_at: string;
}

const INTENT_META: Record<Intent, { label: string; emoji: string; blurb: string }> = {
  buying: { label: 'Buying', emoji: '🛒', blurb: 'Buyers deciding who to engage' },
  comparison: { label: 'Comparison', emoji: '⚖️', blurb: 'Buyers weighing options' },
  how_to: { label: 'How-To', emoji: '🛠️', blurb: 'Buyers solving a problem' },
  definition: { label: 'Definitional', emoji: '📖', blurb: 'Buyers learning the basics — AI loves these' },
  recommend: { label: 'Recommend', emoji: '💡', blurb: 'Buyers seeking a pick' },
};

const LAYER_META: Record<string, { label: string; blurb: string }> = {
  discovery: { label: 'Discovery', blurb: 'Can AI crawlers find you?' },
  parsability: { label: 'Parsability', blurb: 'Can AI parse your answers?' },
  capability: { label: 'Capability', blurb: 'Can agents act on your site?' },
};

const COVERAGE_LABEL: Record<Coverage, string> = {
  own: 'Owned',
  competitor: 'Competitor',
  nobody: 'Nobody',
};

const PRIORITY_LABEL: Record<'P1' | 'P2' | 'P3', string> = {
  P1: 'Do This Week',
  P2: 'This Week',
  P3: 'Worth Doing',
};

const PRIORITY_CLASS: Record<'P1' | 'P2' | 'P3', string> = {
  P1: 'seo-fix-p1',
  P2: 'seo-fix-p2',
  P3: 'seo-fix-p3',
};

const PRIORITY_BADGE: Record<'P1' | 'P2' | 'P3', string> = {
  P1: 'seo-badge-p1',
  P2: 'seo-badge-p2',
  P3: 'seo-badge-p3',
};

const EFFORT_CLASS: Record<EffortTier, string> = {
  High: 'seo-effort-high',
  Medium: 'seo-effort-medium',
  Low: 'seo-effort-low',
};

const INTENT_ORDER: Intent[] = ['buying', 'comparison', 'how_to', 'definition', 'recommend'];

function pct(n: number) {
  return Math.round(n * 100);
}

function scoreTone(score: number) {
  if (score >= 0.75) return 'good';
  if (score >= 0.5) return 'warn';
  return 'bad';
}

function OwnedRow({ rank }: { rank: number | null }) {
  if (rank === null) return <span className="seo-own-flag">✗ Not ranked</span>;
  return <span className="seo-own-flag seo-own-flag-yes">✓ #{rank}</span>;
}

export default function SeoAnalyzer() {
  usePageTitle('SEO Analyzer');
  const [topicCluster, setTopicCluster] = useState('');
  const [domain, setDomain] = useState('gtm-360.com');
  const [competitors, setCompetitors] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SeoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    if (topicCluster.trim().length < 4) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<SeoResponse>('/api/seo-analyze', {
        method: 'POST',
        body: JSON.stringify({
          topic_cluster: topicCluster.trim(),
          domain: domain.trim() || 'gtm-360.com',
          competitors: competitors.split(',').map((c) => c.trim()).filter(Boolean).slice(0, 4),
        }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setRunning(false);
    }
  }, [topicCluster, domain, competitors]);

  const ex = result?.executive_summary;
  const blockers = result?.fix_pack.filter((f) => f.blocker) ?? [];

  return (
    <div className="seo-report">
      <div className="page-head">
        <h1>GTM-360 AI Engine Optimization Audit</h1>
        <p>
          <strong>What it does:</strong> maps the queries your buyers actually ask (in search and to AI assistants),
          then shows you exactly which ones to win and how.
          <br />
          <strong>What you get:</strong> a prioritized fix plan — effort, impact, blocker, and owner per fix — plus a
          competitive benchmark and a way to measure whether it worked.
          <br />
          <strong>What it needs:</strong> a topic cluster, your domain, and (optionally) your competitors.
          <br />
          <strong>How it stays honest:</strong> every finding is measured from real search results or explicitly labeled
          as inferred.
        </p>
      </div>

      <div className="seo-report-toolbar">
        <div className="seo-report-form">
          <div className="seo-field">
            <label>Topic cluster</label>
            <Input
              value={topicCluster}
              placeholder="e.g. pipeline forecasting, ABM for mid-market"
              onChange={(e) => setTopicCluster(e.target.value)}
            />
          </div>
          <div className="seo-field">
            <label>Domain</label>
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} />
          </div>
          <div className="seo-field">
            <label>Competitors (comma-separated)</label>
            <Input value={competitors} placeholder="e.g. clari.com, revenue.io" onChange={(e) => setCompetitors(e.target.value)} />
          </div>
          <Button onClick={analyze} disabled={topicCluster.trim().length < 4 || running}>
            {running ? 'Analyzing…' : 'Run the audit'}
          </Button>
          {result ? (
            <Button className="seo-export-btn" variant="secondary" onClick={() => window.print()}>
              Export PDF
            </Button>
          ) : null}
        </div>
        {error ? <p className="error-text mt-md">{error}</p> : null}
      </div>

      <SeoGuide />

      {running ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spinner />
          <p className="muted mt-md">Measuring SERPs → locating you and your competitors → building the roadmap…</p>
        </div>
      ) : null}

      {result ? (
        <div className="seo-report-body">
          {/* ── Score cards: the 10-second verdict ─────────────────────────── */}
          <section className="seo-section" aria-label="Score overview">
            <div className="seo-score-grid">
              <div className={`seo-score-card seo-score-${scoreTone(result.aeo_readiness.overall)}`}>
                <div className="seo-score-label">AEO Readiness</div>
                <div className="seo-score-value">{pct(result.aeo_readiness.overall)}%</div>
                <div className="seo-score-note">{ex?.verdict ?? 'Overall AI visibility'}</div>
              </div>
              {result.aeo_readiness.layers.map((l) => (
                <div key={l.layer} className={`seo-score-card seo-score-${scoreTone(l.score)}`}>
                  <div className="seo-score-label">{LAYER_META[l.layer].label}</div>
                  <div className="seo-score-value">{pct(l.score)}%</div>
                  <div className="seo-score-note">{LAYER_META[l.layer].blurb}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Executive summary: the bottom line ─────────────────────────── */}
          <section className="seo-section">
            <div className="seo-bottom-line">
              <h2>The Bottom Line</h2>
              <p className="seo-bl-verdict">{ex?.verdict}</p>
              <div className="seo-bl-grid">
                <div>
                  <span className="seo-label">Problem</span>
                  <p>{ex?.problem}</p>
                </div>
                <div>
                  <span className="seo-label">Opportunity</span>
                  <p>{ex?.opportunity}</p>
                </div>
                <div>
                  <span className="seo-label">First Move (This Week)</span>
                  <p>{ex?.first_move}</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── Priority matrix: fix cards ─────────────────────────────────── */}
          {result.fix_pack.length ? (
            <section className="seo-section">
              <h2>Priority Matrix: What to Fix & When</h2>
              <p className="seo-section-intro">
                Ordered by expected impact. Effort is an estimate; impact is a likelihood, never a guarantee. Owner is a
                recommendation, not an assignment.
              </p>
              <div className="seo-fix-grid">
                {result.fix_pack.map((f, i) => (
                  <article key={i} className={`seo-fix ${PRIORITY_CLASS[f.priority]}`}>
                    <span className={`seo-badge ${PRIORITY_BADGE[f.priority]}`}>{PRIORITY_LABEL[f.priority]}</span>
                    <h3>{i + 1}. {f.fix}</h3>
                    <div className="seo-fix-meta">
                      <div>
                        <span className="seo-label">Effort</span>
                        <strong>{f.effort_days} day{f.effort_days === 1 ? '' : 's'} · {f.effort_tier}</strong>
                      </div>
                      <div>
                        <span className="seo-label">Impact</span>
                        <strong className={EFFORT_CLASS[f.effort_tier]}>{f.impact_estimate}</strong>
                      </div>
                      <div>
                        <span className="seo-label">Owner</span>
                        <strong>{f.owner}</strong>
                      </div>
                    </div>
                    <p className="seo-fix-desc">{f.detail}</p>
                    <div className="seo-targets">
                      <span className="seo-label">Targets</span>
                      {f.target_queries.join(' · ')}
                    </div>
                    <p className="seo-fix-handoff">→ {f.handoff}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {/* ── Blockers & risks ───────────────────────────────────────────── */}
          {blockers.length ? (
            <section className="seo-section">
              <div className="seo-risk-box">
                <h2>⚠️ Blockers & Risks</h2>
                {blockers.map((f, i) => (
                  <div key={i} className="seo-risk-item">
                    <strong>{f.fix}</strong>
                    <span className="seo-risk-tag">{f.blocker}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* ── Query clusters by intent ───────────────────────────────────── */}
          <section className="seo-section">
            <h2>Query Clusters</h2>
            <p className="seo-section-intro">
              Grouped by what the buyer wants. Coverage, rank, and competitor ownership are measured from the SERPs;
              demand is inferred. Highlighted rows are the highest-value gaps.
            </p>
            <div className="seo-cluster-grid">
              {INTENT_ORDER.map((intent) => {
                const rows = result.query_map.filter((q) => q.intent === intent);
                if (!rows.length) return null;
                const owned = rows.filter((q) => q.brand_rank !== null).length;
                const meta = INTENT_META[intent];
                return (
                  <article key={intent} className="seo-cluster">
                    <h3>
                      {meta.emoji} {meta.label} Queries <span className="seo-cluster-count">({rows.length})</span>
                    </h3>
                    <p className="seo-cluster-blurb">
                      {meta.blurb}. You own {owned}/{rows.length}.
                    </p>
                    <div className="seo-cluster-rows">
                      {rows.map((q, i) => (
                        <div key={i} className={`seo-cluster-row ${q.is_top_gap ? 'seo-cluster-row-gap' : ''}`}>
                          <div className="seo-cluster-query">
                            {q.query}
                            {q.is_top_gap ? <span className="seo-topgap-tag">Top gap</span> : null}
                          </div>
                          <div className="seo-cluster-owner">
                            {q.competitor_owner ? (
                              <span className="seo-owner-tag">{q.competitor_owner}</span>
                            ) : q.brand_rank !== null ? (
                              <span className="seo-owner-tag seo-owner-you">You</span>
                            ) : (
                              <span className="seo-owner-tag seo-owner-gen">Generic</span>
                            )}
                          </div>
                          <div className="seo-cluster-rank">
                            <OwnedRow rank={q.brand_rank} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* ── Competitive benchmark ──────────────────────────────────────── */}
          <section className="seo-section">
            <h2>Where You Stand</h2>
            <p className="seo-section-intro">
              How many of the {result.query_map.length} mapped queries each party holds a top result for (measured).
            </p>
            <div className="seo-bench">
              <div className="seo-bench-row seo-bench-you">
                <span className="seo-bench-name">Your site</span>
                <strong>{result.competitive_benchmark.brand_queries_ranked}</strong>
                <span className="seo-bench-of">of {result.query_map.length}</span>
              </div>
              {result.competitive_benchmark.competitors.map((c, i) => (
                <div key={i} className="seo-bench-row">
                  <span className="seo-bench-name">{c.name}</span>
                  <strong>{c.queries_ranked}</strong>
                  <span className="seo-bench-of">of {result.query_map.length}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Where competitors win (lost prompts) ───────────────────────── */}
          {result.lost_prompts.length ? (
            <section className="seo-section">
              <h2>Where Competitors Win</h2>
              <p className="seo-section-intro">
                Queries the brand should be cited for, but a competitor wins — and why.
              </p>
              <div className="seo-lost-list">
                {result.lost_prompts.map((l, i) => (
                  <div key={i} className="seo-lost-item">
                    <div className="seo-lost-q">{l.query}</div>
                    <div className="seo-lost-winner">
                      <span className="seo-label">Winner</span> {l.cited_by}
                    </div>
                    <div className="seo-lost-why">{l.why_they_win}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* ── Success frame ──────────────────────────────────────────────── */}
          <section className="seo-section">
            <h2>How We'll Know It Worked</h2>
            <p className="seo-section-intro">The measurement contract for these fixes — what to watch and when.</p>
            <div className="seo-success-grid">
              {result.success_frame.map((s, i) => (
                <div key={i} className="seo-success-card">
                  <div className="seo-label">{s.cadence}</div>
                  <strong>{s.metric}</strong>
                  <p>{s.target}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Wave 2: future-proofing ────────────────────────────────────── */}
          {result.future_proofing.length ? (
            <section className="seo-section">
              <h2>Future-Proofing (Wave 2)</h2>
              <p className="seo-section-intro">
                Lower-priority hedges — llms.txt, agent-permissions, capability layer. Worth doing after wave 1.
              </p>
              <div className="seo-fix-grid">
                {result.future_proofing.map((f, i) => (
                  <article key={i} className="seo-fix seo-fix-wave2">
                    <span className="seo-badge seo-badge-wave2">Future Wave</span>
                    <h3>{f.fix}</h3>
                    <div className="seo-fix-meta">
                      <div>
                        <span className="seo-label">Effort</span>
                        <strong>~{f.effort_days}d · {f.effort_tier}</strong>
                      </div>
                      <div>
                        <span className="seo-label">Owner</span>
                        <strong>{f.owner}</strong>
                      </div>
                    </div>
                    <p className="seo-fix-desc">{f.detail}</p>
                    {f.blocker ? <p className="seo-fix-handoff">⚠️ {f.blocker}</p> : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {/* ── Method ─────────────────────────────────────────────────────── */}
          <section className="seo-section">
            <h2>Method</h2>
            <div className="seo-method">
              <div>
                <span className="seo-label">Measured (directly observed)</span>
                <ul>
                  {result.measured_vs_inferred.measured.map((m, i) => (
                    <li key={i}>✓ {m}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="seo-label">Inferred (judgment on the signals)</span>
                <ul>
                  {result.measured_vs_inferred.inferred.map((m, i) => (
                    <li key={i}>~ {m}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}