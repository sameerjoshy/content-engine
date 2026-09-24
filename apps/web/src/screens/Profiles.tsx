import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Profile } from '../types';
import { Button, Card, QualityBadge, Spinner } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

export default function Profiles() {
  usePageTitle('Create');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api<{ profiles: Profile[] }>('/api/profiles')
      .then((r) => setProfiles(r.profiles))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load profiles'))
      .finally(() => setLoading(false));
  }, []);

  const select = (p: Profile) => {
    localStorage.setItem('ce.profileId', p.id);
    localStorage.setItem('ce.profileName', p.name);
    navigate('/new');
  };

  if (loading) return <Spinner />;
  if (error) return <p className="error-text">{error}</p>;

  return (
    <div>
      <div className="page-head row-between">
        <div>
          <h1>Select Your Profile</h1>
          <p>Your profile is your voice, audience, and standards — it drives everything downstream.</p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/studio')}>
          Edit inputs in Studio
        </Button>
      </div>
      {profiles.length === 0 ? (
        <Card className="empty-state">
          <h2>No profiles yet</h2>
          <p>Profiles encode your brand voice, ICP, and research rules. Create your first one in Studio, then return here to start an article.</p>
          <Button onClick={() => navigate('/studio')}>Create your first profile</Button>
        </Card>
      ) : (
        <div className="profile-grid">
          {profiles.map((p) => (
            <Card key={p.id} className="profile-card" onClick={() => select(p)}>
              <div className="row-between">
                <h3>{p.name}</h3>
                <QualityBadge score={p.input_quality?.score ?? null} />
              </div>
              <p className="desc">{p.description}</p>
              <Button onClick={() => select(p)}>Use This</Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
