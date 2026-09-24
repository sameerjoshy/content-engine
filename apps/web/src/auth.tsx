import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { setApiToken } from './api';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    // Session must persist + auto-refresh for the browser client (these were
    // accidentally set to false — copied from the service-role client in the
    // API. That logged users out on every refresh and broke tokens after 1h.)
    persistSession: true,
    autoRefreshToken: true,
    // PKCE instead of the default implicit flow: after Google OAuth the URL
    // carries a short ?code= instead of a huge #access_token=…&refresh_token=…
    // fragment, and supabase-js strips it from the address bar after exchange.
    flowType: 'pkce',
  },
});

export interface SignupProfile {
  firstName: string;
  lastName: string;
  company: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, profile: SignupProfile) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      setUser(session?.user ?? null);
      setApiToken(session?.access_token ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setApiToken(session?.access_token ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      error,
      async signIn(email, password) {
        setError(null);
        const { error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) setError(e.message);
      },
      async signUp(email, password, profile) {
        setError(null);
        const { error: e } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: profile.firstName,
              last_name: profile.lastName,
              company: profile.company,
            },
            // No trailing slash: the Supabase redirect allow-list globs are
            // exact-match, so "https://content.gtm-360.com/" fails and gotrue
            // falls back to the project Site URL (which 301s to hq.gtm-360.com).
            emailRedirectTo: window.location.origin,
          },
        });
        if (e) setError(e.message);
        else setError('Check your email to confirm your account, then sign in.');
      },
      async signInWithGoogle() {
        setError(null);
        const { error: e } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        });
        if (e) setError(e.message);
      },
      async signOut() {
        await supabase.auth.signOut();
        setApiToken(null);
      },
      async refreshUser() {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          setUser(data.user);
          setApiToken((await supabase.auth.getSession()).data.session?.access_token ?? null);
        }
      },
    }),
    [user, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}