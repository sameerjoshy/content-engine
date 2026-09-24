import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Button, Card, Field, Input } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

const DEPTHS = [
  { value: 'light', label: 'Light', hint: '~800 words · fewer sources' },
  { value: 'moderate', label: 'Moderate', hint: '~1200 words · balanced research' },
  { value: 'deep', label: 'Deep', hint: '1800+ words · heavy research' },
];

const FORMATS = [
  {
    value: 'article',
    label: 'Article',
    hint: 'Opinion / analysis piece with a strong angle',
  },
  {
    value: 'howto',
    label: 'Deep How-To Snippet',
    hint: 'Teach ONE move deeply — steps, gotcha, proof. Built for series/playbooks.',
  },
  {
    value: 'best_practice',
    label: 'Best-Practice Scan',
    hint: 'Map who is doing this well — named players, differentiation, whitespace, the move.',
  },
];

export default function NewArticle() {
  usePageTitle('New article');
  const [format, setFormat] = useState<'article' | 'howto' | 'best_practice'>('article');
  const [topic, setTopic] = useState('');
  const [angle, setAngle] = useState('');
  const [depth, setDepth] = useState('moderate');
  const [seriesName, setSeriesName] = useState('');
  const [seriesPart, setSeriesPart] = useState('');
  const [seriesTotal, setSeriesTotal] = useState('');
  const [reviewResearch, setReviewResearch] = useState(true);
  const [skipSoWhat, setSkipSoWhat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const profileName = localStorage.getItem('ce.profileName') ?? 'a profile';

  const topicValid = topic.trim().length > 3;
  const angleValid = angle.trim().length > 5;
  const canRun = topicValid && angleValid && !busy;

  const run = async (e: FormEvent) => {
    e.preventDefault();
    if (!canRun) return;
    setBusy(true);
    setError(null);
    try {
      const profileId = localStorage.getItem('ce.profileId');
      const series =
        format === 'howto' && seriesName.trim()
          ? {
              name: seriesName.trim(),
              part: seriesPart ? parseInt(seriesPart, 10) : undefined,
              total: seriesTotal ? parseInt(seriesTotal, 10) : undefined,
            }
          : undefined;
      const res = await api<{ session_id: string }>('/api/run-article', {
        method: 'POST',
        body: JSON.stringify({
          profile_id: profileId,
          topic: topic.trim(),
          angle: angle.trim(),
          depth,
          format,
          series,
          review_research: reviewResearch,
          skip_sowhat: skipSoWhat,
        }),
      });
      localStorage.setItem('ce.sessionId', res.session_id);
      navigate(`/workflow/${res.session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start run');
      setBusy(false);
    }
  };

  return (
    <div className="container-narrow">
      <div className="page-head">
        <h1>Create Your Article</h1>
        <p>
          Profile: <strong>{profileName}</strong>
        </p>
      </div>
      <Card>
        <form onSubmit={run}>
          <Field label="Format">
            <div className="radio-group">
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`radio-pill ${format === f.value ? 'selected' : ''}`}
                  onClick={() => setFormat(f.value as 'article' | 'howto' | 'best_practice')}
                  title={f.hint}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="hint">{FORMATS.find((f) => f.value === format)?.hint}</div>
          </Field>
          <Field label={format === 'howto' ? 'Skill to teach' : 'Topic'} hint={format === 'howto' ? 'The sub-skill a reader should be able to do afterward' : 'What is this about?'}>
            <Input
              value={topic}
              valid={topicValid}
              placeholder={format === 'howto' ? 'e.g. Building a territory map in 30 minutes' : 'e.g. AI in content workflows'}
              onChange={(e) => setTopic(e.target.value)}
            />
          </Field>
          <Field
            label={format === 'howto' ? 'The specific move' : 'Angle'}
            hint={
              format === 'howto'
                ? 'The ONE technique/decision this snippet teaches (a claim, not a subject)'
                : 'The specific take. Make it a claim, not a subject.'
            }
          >
            <Input
              value={angle}
              valid={angleValid}
              placeholder={
                format === 'howto'
                  ? 'e.g. Use revenue-weighted territories, not geography'
                  : 'e.g. Why most AI content pipelines fail'
              }
              onChange={(e) => setAngle(e.target.value)}
            />
          </Field>
          {format === 'howto' ? (
            <>
              <Field label="Series name" hint="Optional — turn this into a multi-part playbook">
                <Input value={seriesName} placeholder="e.g. Territory Planning Playbook" onChange={(e) => setSeriesName(e.target.value)} />
              </Field>
              <div className="row" style={{ gap: 12 }}>
                <Field label="Part #">
                  <Input type="number" min={1} value={seriesPart} placeholder="1" onChange={(e) => setSeriesPart(e.target.value)} />
                </Field>
                <Field label="Total parts">
                  <Input type="number" min={1} value={seriesTotal} placeholder="8" onChange={(e) => setSeriesTotal(e.target.value)} />
                </Field>
              </div>
            </>
          ) : null}
          <Field label="Research Depth">
            <div className="radio-group">
              {DEPTHS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  className={`radio-pill ${depth === d.value ? 'selected' : ''}`}
                  onClick={() => setDepth(d.value)}
                  title={d.hint}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </Field>
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={reviewResearch} onChange={(e) => setReviewResearch(e.target.checked)} />
              Review research before writing
            </label>
            <div className="hint">
              Pauses after research so you can approve the sources and steer the researcher before a single word is written.
            </div>
          </div>
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={skipSoWhat} onChange={(e) => setSkipSoWhat(e.target.checked)} />
              Skip the demand check
            </label>
            <div className="hint">
              The so-what gate verifies this question is being asked right now and steers/kills cold demand. Override when you know something the data doesn't.
            </div>
          </div>
          {error ? <p className="error-text mb-md">{error}</p> : null}
          <Button type="submit" disabled={!canRun} className="mt-md">
            {busy ? 'Starting…' : format === 'howto' ? 'Run How-To Snippet' : format === 'best_practice' ? 'Run Best-Practice Scan' : 'Run Article'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
