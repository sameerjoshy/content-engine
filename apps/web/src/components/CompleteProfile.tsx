import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button, Card, Field, Input } from './ui';

/**
 * Shown after OAuth (Google) signup, where the signup form's first/last/company
 * fields weren't collected. Persists to user_metadata and re-syncs to HubSpot.
 */
export default function CompleteProfile() {
  const { user, refreshUser } = useAuth();
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [industry, setIndustry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const needsCompletion = !meta.company && !saved;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/me/profile', {
        method: 'POST',
        body: JSON.stringify({
          company,
          job_title: jobTitle,
          industry,
        }),
      });
      await refreshUser();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setBusy(false);
    }
  };

  if (!needsCompletion) return null;

  return (
    <Card className="mb-md">
      <h3 className="section-title" style={{ marginTop: 0 }}>
        Tell us about your company
      </h3>
      <p className="muted">
        You signed in with Google. Add your company details — they personalize your research and appear in your
        HubSpot profile.
      </p>
      <form onSubmit={submit}>
        <div className="row" style={{ gap: 12 }}>
          <Field label="Company">
            <Input value={company} onChange={(e) => setCompany(e.target.value)} required placeholder="Acme Inc." />
          </Field>
          <Field label="Job title">
            <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="VP Marketing" />
          </Field>
          <Field label="Industry">
            <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="B2B SaaS" />
          </Field>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <div className="row mt-md" style={{ gap: 12 }}>
          <Button type="submit" disabled={busy || !company.trim()}>
            {busy ? 'Saving…' : 'Save & continue'}
          </Button>
        </div>
      </form>
    </Card>
  );
}