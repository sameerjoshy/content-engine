import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { Author, ContentMapItem, Profile } from '../types';
import { Button, Card, Input, QualityBadge, Spinner, Tag } from '../components/ui';
import { missingFields, SectionEditor, useDraft, type FieldConfig } from '../components/Editor';
import { usePageTitle } from '../usePageTitle';

const BV_FIELDS: FieldConfig[] = [
  { key: 'opening_style', label: 'Opening style', kind: 'text', hint: 'How should every article start?' },
  { key: 'tone', label: 'Tone', kind: 'text', hint: 'One sentence. E.g. "Confident, data-driven, no hedging."' },
  { key: 'sentence_structure', label: 'Sentence structure', kind: 'text' },
  { key: 'adjective_limit', label: 'Adjective limit', kind: 'text' },
  { key: 'forbidden_words', label: 'Forbidden words', kind: 'list', hint: 'Words that should never appear (e.g. might, possibly).' },
  { key: 'example_sentences', label: 'Example sentences', kind: 'list', hint: 'The single strongest input. The writer copies your rhythm.' },
];

const ICP_FIELDS: FieldConfig[] = [
  { key: 'title', label: 'Buyer title', kind: 'text', hint: 'e.g. VP Product, Head of Content' },
  { key: 'industry', label: 'Industry', kind: 'text' },
  { key: 'seniority', label: 'Seniority', kind: 'text' },
  { key: 'budget', label: 'Budget', kind: 'text' },
  { key: 'decision_style', label: 'Decision style', kind: 'text' },
  { key: 'pain_points', label: 'Pain points', kind: 'list' },
];

const CS_FIELDS: FieldConfig[] = [
  { key: 'structure', label: 'Structure', kind: 'text', hint: 'e.g. Problem → Why → Proof → Action → Close' },
  { key: 'word_count', label: 'Word count', kind: 'text' },
  { key: 'paragraph_requirements', label: 'Paragraph requirements', kind: 'text' },
  { key: 'must_have', label: 'Must include', kind: 'list' },
  { key: 'must_not_have', label: 'Must NOT include', kind: 'list' },
];

const RR_FIELDS: FieldConfig[] = [
  { key: 'recency', label: 'Recency', kind: 'text', hint: 'e.g. Data < 2 years old for tech' },
  { key: 'trusted_sources', label: 'Trusted sources', kind: 'list' },
  { key: 'sources_to_avoid', label: 'Sources to avoid', kind: 'list' },
];

function AuthorEditor({
  value,
  onChange,
}: {
  value: Author | null;
  onChange: (v: Author) => void;
}) {
  const a = value ?? { name: '' };
  const set = (k: keyof Author, v: string) => onChange({ ...a, [k]: v });
  return (
    <>
      <Card className="mb-md">
        <h3 className="section-title" style={{ marginTop: 0 }}>
          Author persona
        </h3>
        <p className="muted mb-sm">
          AI search engines and readers cite <em>individual experts</em>, not brands. This named person
          becomes the byline and voice of every article and channel variant. Leave name empty to use a generic voice.
        </p>
        <div className="field">
          <label>Name</label>
          <input className="input" value={a.name} placeholder="e.g. Sameer Joshy" onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="row" style={{ gap: 12 }}>
          <div className="field">
            <label>Title</label>
            <input className="input" value={a.title ?? ''} placeholder="e.g. CEO" onChange={(e) => set('title', e.target.value)} />
          </div>
          <div className="field">
            <label>Company</label>
            <input className="input" value={a.company ?? ''} placeholder="e.g. GTM-360" onChange={(e) => set('company', e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Bio</label>
          <textarea className="input" rows={2} value={a.bio ?? ''} placeholder="1-2 lines establishing credibility" onChange={(e) => set('bio', e.target.value)} />
        </div>
        <div className="field">
          <label>LinkedIn URL</label>
          <input className="input" value={a.linkedin_url ?? ''} placeholder="https://linkedin.com/in/…" onChange={(e) => set('linkedin_url', e.target.value)} />
        </div>
      </Card>
    </>
  );
}

function ProofEditor({
  value,
  onChange,
}: {
  value: Record<string, unknown> | undefined;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const p = value ?? {};
  const num = (k: string) => (typeof p[k] === 'number' ? (p[k] as number) : 0);
  const set = (k: string, v: number) => onChange({ ...p, [k]: v });
  return (
    <Card className="mb-md">
      <h3 className="section-title" style={{ marginTop: 0 }}>
        Required proof (credibility)
      </h3>
      <p className="muted mb-sm">
        The article will be written and fact-checked to include this proof. Leave at 0 to not require a type.
      </p>
      <div className="row" style={{ gap: 12 }}>
        <div className="field">
          <label>Named-company examples</label>
          <input className="input" type="number" min={0} value={num('named_examples')} onChange={(e) => set('named_examples', parseInt(e.target.value || '0', 10) || 0)} />
          <div className="hint">e.g. "Snowflake adopted X…", "Clari cut Y…"</div>
        </div>
        <div className="field">
          <label>Expert quotes</label>
          <input className="input" type="number" min={0} value={num('expert_quotes')} onChange={(e) => set('expert_quotes', parseInt(e.target.value || '0', 10) || 0)} />
          <div className="hint">Direct quotes from named people</div>
        </div>
        <div className="field">
          <label>Statistics</label>
          <input className="input" type="number" min={0} value={num('statistics')} onChange={(e) => set('statistics', parseInt(e.target.value || '0', 10) || 0)} />
          <div className="hint">Hard numbers / survey data</div>
        </div>
      </div>
    </Card>
  );
}

export default function Studio() {
  usePageTitle('Studio');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showContentMap, setShowContentMap] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ profiles: Profile[] }>('/api/profiles')
      .then((r) => {
        setProfiles(r.profiles);
        const saved = localStorage.getItem('ce.profileId');
        setSelectedId(saved && r.profiles.some((p) => p.id === saved) ? saved : r.profiles[0]?.id ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const selected = profiles.find((p) => p.id === selectedId) ?? null;

  const refresh = useCallback(async () => {
    const r = await api<{ profiles: Profile[] }>('/api/profiles');
    setProfiles(r.profiles);
  }, []);

  if (loading) return <Spinner />;
  if (error) return <p className="error-text">{error}</p>;

  return (
    <div>
      <div className="page-head">
        <h1>Profile Studio</h1>
        <p>
          The quality of your article is decided here. Vague inputs produce generic output — this screen shows you
          exactly what's sharp and what's fuzzy before you spend a single LLM dollar.
        </p>
      </div>

      <div className="studio-grid">
        <aside className="studio-sidebar">
          <div className="section-title" style={{ marginTop: 0 }}>
            Your profiles
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {profiles.map((p) => (
              <Card key={p.id} className="row-between" selected={p.id === selectedId} onClick={() => setSelectedId(p.id)}>
                <div>
                  <strong>{p.name}</strong>
                  <QualityBadge score={p.input_quality?.score ?? null} />
                </div>
              </Card>
            ))}
          </div>
          <Button variant="secondary" className="mt-sm" onClick={() => setShowContentMap((v) => !v)}>
            {showContentMap ? 'Hide content map' : 'Manage content map'}
          </Button>
          <Button
            variant="tertiary"
            className="mt-sm"
            onClick={async () => {
              const r = await api<{ profile: Profile }>('/api/profiles', {
                method: 'POST',
                body: JSON.stringify({ name: 'New Profile' }),
              });
              await refresh();
              setSelectedId(r.profile.id);
              localStorage.setItem('ce.profileId', r.profile.id);
            }}
          >
            + New profile
          </Button>
        </aside>

        <section>
          {selected ? (
            <ProfileEditor key={selected.id} profile={selected} onSaved={refresh} />
          ) : (
            <Card>
              <p className="muted">No profile selected.</p>
            </Card>
          )}
        </section>
      </div>

      {showContentMap ? (
        <div className="mt-md">
          <ContentMapManager />
        </div>
      ) : null}
    </div>
  );
}

function ProfileEditor({ profile, onSaved }: { profile: Profile; onSaved: () => Promise<void> }) {
  const { draft, setDraft, dirty } = useDraft(profile);
  const [tab, setTab] = useState<'voice' | 'author' | 'icp' | 'standards' | 'research' | 'quality'>('voice');
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const r = await api<{ profile: Profile }>(`/api/profiles/${profile.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          brand_voice: draft.brand_voice,
          icp: draft.icp,
          content_standards: draft.content_standards,
          research_rules: draft.research_rules,
          author: draft.author,
        }),
      });
      setDraft(r.profile);
      setMsg('Saved ✓');
      await onSaved();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const analyze = async () => {
    setAnalyzing(true);
    setMsg(null);
    try {
      await save();
      const r = await api<{ analysis: Profile['input_quality'] }>(`/api/profiles/${profile.id}/analyze`, {
        method: 'POST',
        body: '{}',
      });
      setDraft({ ...draft, input_quality: r.analysis });
      await onSaved();
      setTab('quality');
      setMsg('Analysis complete');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const q = draft.input_quality;

  return (
    <Card>
      <div className="row-between mb-md">
        <div className="flex-1">
          <FieldLabel>Profile name</FieldLabel>
          <Input value={draft.name} valid={draft.name.trim().length > 0} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <QualityBadge score={q?.score ?? null} />
      </div>
      <div className="field">
        <FieldLabel>Description</FieldLabel>
        <Input value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      </div>

      <div className="studio-tabs">
        {(
          [
            ['voice', 'Brand Voice'],
            ['author', 'Author'],
            ['icp', 'ICP'],
            ['standards', 'Standards'],
            ['research', 'Research'],
            ['quality', 'Quality'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={`studio-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'voice' && <SectionEditor section={draft.brand_voice} fields={BV_FIELDS} onChange={(brand_voice) => setDraft({ ...draft, brand_voice })} />}
      {tab === 'author' && (
        <AuthorEditor
          value={draft.author}
          onChange={(author) => setDraft({ ...draft, author })}
        />
      )}
      {tab === 'icp' && <SectionEditor section={draft.icp} fields={ICP_FIELDS} onChange={(icp) => setDraft({ ...draft, icp })} />}
      {tab === 'standards' && <SectionEditor section={draft.content_standards} fields={CS_FIELDS} onChange={(content_standards) => setDraft({ ...draft, content_standards })} />}
      {tab === 'research' && (
        <>
          <ProofEditor
            value={draft.research_rules?.required_proof as Record<string, unknown> | undefined}
            onChange={(required_proof) =>
              setDraft({ ...draft, research_rules: { ...draft.research_rules, required_proof } })
            }
          />
          <SectionEditor section={draft.research_rules} fields={RR_FIELDS} onChange={(research_rules) => setDraft({ ...draft, research_rules })} />
        </>
      )}
      {tab === 'quality' && <QualityPanel analysis={q} />}

      <div className="row-between mt-md">
        <div className="row">
          <Button onClick={save} disabled={!dirty && !saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          <Button variant="secondary" onClick={analyze} disabled={analyzing}>
            {analyzing ? 'Analyzing…' : 'Analyze inputs'}
          </Button>
        </div>
        {msg ? <span className={msg.includes('✗') || msg.includes('failed') ? 'error-text' : 'success-text'}>{msg}</span> : null}
      </div>
    </Card>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{children}</label>;
}

function QualityPanel({ analysis }: { analysis: Profile['input_quality'] }) {
  if (!analysis) {
    return (
      <p className="muted">
        Run <strong>Analyze inputs</strong> to see how sharp this profile is before you write with it.
      </p>
    );
  }
  const score = analysis.score;
  const tone = score != null && score >= 75 ? 'quality-good' : score != null && score >= 45 ? 'quality-mid' : 'quality-low';
  return (
    <div>
      <div className="row-between mb-md">
        <div>
          <div style={{ fontSize: 40, fontWeight: 700 }} className={tone}>
            {score != null ? score : '—'}
          </div>
          <div className="muted">Input quality score</div>
        </div>
        <div className="text-right muted">
          {analysis.analyzed_at ? `Analyzed ${new Date(analysis.analyzed_at).toLocaleString()}` : 'Not yet analyzed'}
        </div>
      </div>

      {analysis.flags?.length ? (
        <>
          <div className="section-title">What's missing</div>
          <ul className="flag-list">
            {analysis.flags.map((f, i) => (
              <li key={i}>{humanizeFlag(f)}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="success-text">No missing inputs detected.</p>
      )}

      {analysis.suggestions?.length ? (
        <>
          <div className="section-title">Suggestions</div>
          <ul className="flag-list">
            {analysis.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </>
      ) : null}

      {analysis.llm_critique ? (
        <>
          <div className="section-title">Strategist's take</div>
          <Card className="mb-md">
            <p style={{ margin: 0, color: 'var(--color-neutral-700)', fontSize: '0.95rem' }}>{analysis.llm_critique}</p>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function humanizeFlag(flag: string): string {
  const map: Record<string, string> = {
    not_reviewed: 'Profile has not been reviewed yet — run "Analyze inputs".',
    no_example_sentences: 'No example sentences — add 2-3 so the writer copies your rhythm.',
    no_forbidden_words: 'No forbidden words defined — list what should never appear.',
    no_tone_definition: 'No tone definition — describe the tone in one sentence.',
    no_icp_title: 'No buyer title defined — name the exact person you write for.',
    no_must_have: 'No "must include" items — define what every article needs.',
    no_structure: 'No article structure — define the skeleton (Problem → Why → Proof → Action → Close).',
    no_trusted_sources: 'No trusted sources — name the source types the researcher should use.',
  };
  return map[flag] ?? flag.replace(/_/g, ' ');
}

function ContentMapManager() {
  const [items, setItems] = useState<ContentMapItem[]>([]);
  const [title, setTitle] = useState('');
  const [angle, setAngle] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await api<{ items: ContentMapItem[] }>('/api/content-map');
    setItems(r.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!title.trim()) return;
    await api('/api/content-map', { method: 'POST', body: JSON.stringify({ title: title.trim(), angle: angle.trim() || null }) });
    setTitle('');
    setAngle('');
    await load();
  };

  const remove = async (id: string) => {
    await api(`/api/content-map/${id}`, { method: 'DELETE' });
    await load();
  };

  return (
    <Card>
      <div className="row-between mb-md">
        <h3 className="section-title" style={{ marginTop: 0 }}>
          Published content
        </h3>
        <Tag>{items.length} articles</Tag>
      </div>
      <p className="muted" style={{ fontSize: 14 }}>
        The Angle Validator checks every new angle against this list. Keep it up to date.
      </p>
      <div className="row mb-md">
        <Input placeholder="Article title" value={title} onChange={(e) => setTitle(e.target.value)} valid={false} />
        <Input placeholder="Angle (optional)" value={angle} onChange={(e) => setAngle(e.target.value)} valid={false} />
        <Button variant="secondary" onClick={add} disabled={!title.trim()}>
          Add
        </Button>
      </div>
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="muted">No published articles yet.</p>
      ) : (
        <div className="stage-list">
          {items.map((it) => (
            <div key={it.id} className="stage-item">
              <div className="stage-body">
                <div className="stage-name">{it.title}</div>
                <div className="stage-msg">
                  {it.angle ?? 'no angle'} · {it.publish_date ?? 'no date'}
                </div>
              </div>
              <Button variant="danger" className="btn-sm" onClick={() => remove(it.id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
