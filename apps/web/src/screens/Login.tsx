import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { Button, Card, Field, Input } from '../components/ui';
import { usePageTitle } from '../usePageTitle';

interface SignupFields {
  firstName: string;
  lastName: string;
  company: string;
}

export default function Login() {
  usePageTitle('Sign in');
  const { signIn, signUp, signInWithGoogle, error } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profile, setProfile] = useState<SignupFields>({ firstName: '', lastName: '', company: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'signin') await signIn(email, password);
      else await signUp(email, password, profile);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <Card className="auth-card">
        <div className="auth-logo">
          <h1>Agent Portal</h1>
          <p>Turn your inputs into publishable articles — with full transparency.</p>
        </div>
        <form onSubmit={submit}>
          {mode === 'signup' ? (
            <div className="row" style={{ gap: 12 }}>
              <Field label="First name">
                <Input value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} required placeholder="Ada" />
              </Field>
              <Field label="Last name">
                <Input value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} required placeholder="Lovelace" />
              </Field>
            </div>
          ) : null}
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
          </Field>
          {mode === 'signup' ? (
            <Field label="Company">
              <Input value={profile.company} onChange={(e) => setProfile({ ...profile, company: e.target.value })} required placeholder="Acme Inc." />
            </Field>
          ) : null}
          {error ? <p className="error-text mb-md">{error}</p> : null}
          <Button type="submit" disabled={busy || !email || password.length < 6} className="row" style={{ width: '100%' }}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
          <div className="row" style={{ alignItems: 'center', gap: 12, margin: '14px 0' }}>
            <span className="divider-line" />
            <span className="muted">or</span>
            <span className="divider-line" />
          </div>
          <Button type="button" variant="secondary" className="row" style={{ width: '100%' }} onClick={() => signInWithGoogle()} disabled={busy}>
            Continue with Google
          </Button>
          <button type="button" className="btn btn-tertiary mt-md" style={{ width: '100%' }} onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
          </button>
        </form>
        <p className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 16 }}>
          <Link to="/">Home</Link> · <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link>
        </p>
      </Card>
    </div>
  );
}
