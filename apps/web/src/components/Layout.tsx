import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { BRAND } from '../brand';
import { Button } from '../components/ui';
import CommandPalette from './CommandPalette';
import CompleteProfile from './CompleteProfile';
import SideNav from './SideNav';
import Breadcrumbs from './Breadcrumbs';
import GuideLink from './GuideLink';

/** GTM-360 brand mark — navy square with the revenue-loop glyph (brand-consistent). */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 32 32" width={size} height={size}>
        <rect width="32" height="32" rx="7" fill="#0a192f" />
        <path d="M9 11h14M9 16h14M9 21h14" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M16 7v18" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="topbar-brand" href="/">
          <BrandMark />
          <span className="topbar-brand-name">GTM-360</span>
          <span className="topbar-brand-sep">/</span>
          <span className="topbar-brand-sub">{BRAND}</span>
        </a>
        <nav className="topbar-nav">
          <a href="/create" className="btn btn-tertiary btn-sm">
            Create
          </a>
          <a href="/engine" className="btn btn-tertiary btn-sm">
            Engine
          </a>
          <a href="/seo" className="btn btn-tertiary btn-sm">
            SEO
          </a>
        </nav>
        <div className="topbar-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPaletteOpen(true)} title="Search (Ctrl/Cmd+K)">
            ⌘K
          </button>
          <span className="muted" style={{ fontSize: 13 }}>
            {user?.email}
          </span>
          <Button variant="tertiary" className="btn-sm" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </header>
      <div className="app-layout">
        <SideNav />
        <main className="container">
          <Breadcrumbs />
          <GuideLink />
          <CompleteProfile />
          {children}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}