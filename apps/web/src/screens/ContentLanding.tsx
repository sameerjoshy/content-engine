import { Link } from 'react-router-dom';
import { BRAND, BRAND_TAGLINE } from '../brand';

/**
 * Logged-out landing for the Content Engine surface (apps.gtm-360.com/content-engine).
 * The Agent Portal keeps its own Showcase — this app serves both by host.
 */
export default function ContentLanding() {
  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', color: '#0F172A' }}>
      <header style={{ background: '#0A192F', color: '#fff', padding: '18px 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 32, height: 32, borderRadius: 8, background: '#10B981', color: '#0A192F', display: 'grid', placeItems: 'center', fontWeight: 800 }}>C</span>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontWeight: 800 }}>{BRAND}</div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.5 }}>GTM-360</div>
        </div>
        <Link to="/login" style={{ marginLeft: 'auto', background: '#10B981', color: '#0A192F', padding: '9px 18px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
          Sign in
        </Link>
      </header>

      <main className="container" style={{ maxWidth: 860, margin: '0 auto', padding: '72px 24px' }}>
        <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#10B981', fontWeight: 700, marginBottom: 16 }}>
          Content Engine
        </p>
        <h1 style={{ fontSize: 44, lineHeight: 1.08, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 20px', maxWidth: 720 }}>
          From a topic to a fact-checked article — in your voice.
        </h1>
        <p style={{ fontSize: 19, color: '#64748B', lineHeight: 1.6, maxWidth: 620, margin: '0 0 32px' }}>
          {BRAND_TAGLINE}. Grounded in research it actually performed, fact-checked against the
          evidence, then distributed to LinkedIn, YouTube, and Substack from the same core.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/login" style={{ background: '#0A192F', color: '#fff', padding: '14px 26px', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>
            Sign in to start →
          </Link>
          <Link to="/privacy" style={{ background: '#fff', color: '#334155', border: '1px solid #E2E8F0', padding: '14px 26px', borderRadius: 10, fontWeight: 600, textDecoration: 'none' }}>
            Privacy
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 56 }}>
          {[
            { t: 'Research-grounded', d: 'Every claim traces to a real, cited source — no invented statistics.' },
            { t: 'Fact-checked', d: 'Verifiable claims are checked against the evidence table and rewritten if unsupported.' },
            { t: 'Multi-channel', d: 'LinkedIn, YouTube, Substack, and email — generated from the same fact-checked draft.' },
          ].map((f) => (
            <div key={f.t} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>{f.t}</h3>
              <p style={{ margin: 0, color: '#64748B', fontSize: 13, lineHeight: 1.55 }}>{f.d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
