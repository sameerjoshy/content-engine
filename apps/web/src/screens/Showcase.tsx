import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { ShaderGradient, ShaderGradientCanvas } from 'shadergradient';
import { useAuth } from '../auth';
import { Button } from '../components/ui';
import ShowcaseVideo from '../components/ShowcaseVideo';
import { AGENTS, GROUP_BY_ID, GROUP_ORDER } from '@gtm360/agent-registry';
import { usePageTitle } from '../usePageTitle';

const PRODUCTS = [
  { name: 'Agent Portal', url: 'https://agents.gtm-360.com', desc: 'Turns a topic into a publishable article — real research behind every claim, your voice on every line.' },
  { name: 'Compass', url: 'https://okr.gtm-360.com', desc: 'Goals and strategy. OKRs that roll up, stay aligned, and catch the sandbagging.' },
  { name: 'Cockpit', url: 'https://brain.gtm-360.com', desc: 'Run the execution. Pipeline intelligence, deal strategy, and a GTM brain that keeps its thinking.' },
  { name: 'Crew', url: 'https://agents.gtm-360.com', desc: 'Pick a specialist — qualifier, sniper, forecast analyst — and get a straight answer.' },
  { name: 'Method', url: 'https://gtm.gtm-360.com', desc: 'How GTM actually works. Ten layers, 40-plus processes, frameworks, and a deck generator.' },
  { name: 'The Hub', url: 'https://gtm-360.com', desc: 'The front door. What GTM-360 is, and everything it runs.' },
];

const INCORPORATED = [
  { repo: 'blader/humanizer', what: 'AI-writing-tell patterns', into: 'Writer + Editor voice layer' },
  { repo: 'msitarzewski/agency-agents', what: 'Agent prompt craft', into: 'SELL + CREATE agent definitions' },
  { repo: 'pbakaus/impeccable', what: '61 AI-slop design rules', into: 'Design QA' },
  { repo: 'VoltAgent/awesome-design-md', what: 'Linear · Stripe · Notion design language', into: 'Design tokens' },
  { repo: 'Panniantong/Agent-Reach', what: 'Zero-config research channels', into: 'Research companion' },
  { repo: 'public-apis', what: 'Free data sources', into: 'Researcher (HN · Reddit · OpenAlex · Scholar)' },
  { repo: 'dancolta/subscope', what: 'Keyless Reddit buyer-intent', into: 'Listener signals' },
  { repo: 'every-app/open-seo', what: 'Self-hosted SEO/AEO', into: 'Content Radar (Phase 3)' },
  { repo: 'czlonkowski/n8n-mcp', what: 'Human-gated automation', into: 'SELL/GOVERN ops (Phase 3)' },
  { repo: 'DeusData/codebase-memory-mcp', what: 'Code intelligence', into: 'Dev agents' },
  { repo: 'mvanhorn/last30days-skill', what: 'Engagement-scored research', into: 'Radar (pending)' },
  { repo: 'anthropics/skills', what: 'Frontend design skill', into: 'Design craft' },
];

const OUTCOMES = [
  { title: 'Grounded in real research', desc: 'Every claim is traced to a source — Tavily, Hacker News, Reddit, OpenAlex, Semantic Scholar, Wikipedia.' },
  { title: 'Fact-checked before publish', desc: 'Fabricated claims are rewritten or removed; only genuine analysis is kept unsourced.' },
  { title: 'Written in your voice', desc: 'Specific, human, opinionated — with the machine tells stripped out.' },
  { title: 'Every channel, one draft', desc: 'LinkedIn, YouTube, Substack, and email built from the same checked core.' },
  { title: 'Pipeline that moves', desc: 'From signal to intent to outreach to deal — every step backed by evidence and approved by a human.' },
  { title: 'Numbers you can trust', desc: 'Rep-called vs evidence-adjusted forecast, hygiene gates, and honest reporting.' },
];

const FAQS = [
  { q: 'What is GTM-360?', a: 'GTM-360 is a revenue operating system — a family of products (Compass, Cockpit, Crew, Method, Content Engine) powered by one agent engine. It takes strategy and turns it into work that actually gets done.' },
  { q: 'What is the agent engine?', a: 'Twenty-five specialist agents inside five engines — Strategy, Marketing, Sales, Expansion, and Operations — arranged as one loop: Strategy aims it, the customer journey (Attract, Convert, Grow) runs through Marketing, Sales, and Expansion, and Operations validates the numbers before you act. Every agent earns its place by the outcome it delivers.' },
  { q: 'How does Content Engine fact-check articles?', a: 'Every verifiable claim is checked against an evidence table built during research. Fabricated claims are rewritten or removed, and only your genuine analysis is kept without a source.' },
  { q: 'What can the products do?', a: 'Set and track OKRs (Compass), run the pipeline and deals (Cockpit), call on specialist agents (Crew), learn the playbook (Method), and produce citable content (Content Engine).' },
  { q: 'Is it free?', a: 'Yes. Content Engine is free to use today, and everything runs on open-source tools and free tiers.' },
];

export default function Showcase() {
  usePageTitle();
  const root = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const go = () => navigate(user ? '/' : '/login');
  const [webgl, setWebgl] = useState(true);

  // Progressive enhancement: the shader hero needs WebGL. If it's unavailable
  // (blocklisted GPU, corporate browser policy, headless), fall back to a CSS
  // gradient so the page never blanks.
  useEffect(() => {
    try {
      const c = document.createElement('canvas');
      setWebgl(Boolean(c.getContext('webgl2') || c.getContext('webgl')));
    } catch {
      setWebgl(false);
    }
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    const loop = (time: number) => {
      lenis.raf(time * 1000);
      requestAnimationFrame(loop);
    };
    const raf = requestAnimationFrame(loop);

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.reveal').forEach((el) => {
        gsap.fromTo(
          el,
          { y: 32, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.9, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 88%' } },
        );
      });
      gsap.fromTo('.hero-title', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: 0.1 });
      gsap.fromTo('.hero-sub', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, delay: 0.25 });
      gsap.fromTo('.hero-cta', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, delay: 0.4 });
    }, root);

    return () => {
      cancelAnimationFrame(raf);
      ctx.revert();
      lenis.destroy();
    };
  }, []);

  return (
    <div ref={root} className="showcase">
      {/* HERO — dark premium + shader gradient */}
      <section className="showcase-hero">
        {webgl ? (
          <ShaderGradientCanvas style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} pixelDensity={1} fov={45}>
            <ShaderGradient
              control="props"
              type="waterPlane"
              animate="on"
              uSpeed={0.25}
              uStrength={0.1}
              brightness={0.45}
              color1="#0f766e"
              color2="#155e75"
              color3="#1e293b"
              positionX={0}
              positionY={0}
              positionZ={0}
              enableTransition
            />
          </ShaderGradientCanvas>
        ) : (
          <div className="showcase-hero-fallback" />
        )}
        <div className="showcase-hero-veil" />
        <nav className="showcase-nav">
          <Link to="/" className="topbar-brand">
            <span className="landing-mark">CE</span>
            <span className="showcase-nav-brand">GTM-360</span>
          </Link>
          <div className="showcase-nav-links">
            <a href="#products">Products</a>
            <a href="#engine">The Engine</a>
            <a href="#built">Built with</a>
            <a href="#faq">FAQ</a>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Button variant="secondary" className="btn-sm" onClick={go}>Sign in</Button>
          </div>
        </nav>
        <div className="showcase-hero-inner">
          <p className="showcase-eyebrow hero-sub">The Revenue Operating System</p>
          <h1 className="hero-title">
            One loop.<br />
            <span className="text-gradient">Five engines.</span>
          </h1>
          <p className="showcase-hero-sub hero-sub">
            GTM-360 takes strategy and turns it into work that actually gets done. Compass sets the goals.
            Cockpit runs the execution. Crew brings the specialists. Method shows how it all fits together.
            Content Engine writes the stuff people can cite. One loop, five engines, behind all of it.
          </p>
          <div className="landing-cta hero-cta">
            <Button onClick={go}>Get started</Button>
            <Button variant="secondary" onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}>
              See what we built
            </Button>
          </div>
          <div className="showcase-hero-stats hero-sub">
            <span><strong>6</strong> products</span>
            <span><strong>25</strong> agents</span>
            <span><strong>5</strong> engines · one loop</span>
            <span><strong>12</strong> open-source pieces built in</span>
          </div>
        </div>
      </section>

      {/* PRODUCTS */}
      <section id="products" className="showcase-section light">
        <div className="showcase-section-head reveal">
          <h2>The products</h2>
          <p>Six tools, one system, all live today.</p>
        </div>
        <div className="showcase-grid">
          {PRODUCTS.map((p) => (
            <a key={p.name} href={p.url} target="_blank" rel="noreferrer" className="showcase-card reveal">
              <h3>{p.name}</h3>
              <p>{p.desc}</p>
              <span className="showcase-card-url">{p.url.replace('https://', '')}</span>
            </a>
          ))}
        </div>
      </section>

      {/* WATCH */}
      <section className="showcase-section dark">
        <div className="showcase-section-head reveal">
          <h2>Watch the system</h2>
          <p>Nineteen seconds of what GTM-360 actually is.</p>
        </div>
        <ShowcaseVideo src="/videos/brag.mp4" poster="/videos/brag.jpg" label="GTM-360 launch video" autoplay loop />
      </section>

      {/* ENGINE */}
      <section id="engine" className="showcase-section dark">
        <div className="showcase-section-head reveal">
          <h2>The engine</h2>
          <p>Five engines, one loop, 25 specialist jobs inside.</p>
        </div>
        <ShowcaseVideo
          src="/videos/pipeline-explainer.mp4"
          label="How the Content Engine pipeline works"
          className="showcase-video-compact"
        />
        <div className="showcase-engine-loop">
          {GROUP_ORDER.map((id) => {
            const g = GROUP_BY_ID[id];
            const agents = AGENTS.filter((a) => a.group === id);
            return (
              <div key={id} className="showcase-outcome reveal" style={{ borderColor: g.color }}>
                <span className="engine-loop-num" style={{ background: g.color }}>{g.number}</span>
                <h3>{g.name}</h3>
                <p className="showcase-outcome-verb">{g.verb}</p>
                <p className="showcase-outcome-outcome">{g.outcome}</p>
                <div className="showcase-outcome-agents">
                  {agents.slice(0, 4).map((a) => <span key={a.id} className="tag">{a.name}</span>)}
                  {agents.length > 4 ? <span className="tag">+{agents.length - 4}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* INCORPORATED */}
      <section id="built" className="showcase-section light">
        <div className="showcase-section-head reveal">
          <h2>Built on open source</h2>
          <p>The repos and skills that went into this — and what each one does.</p>
        </div>
        <div className="showcase-inc">
          {INCORPORATED.map((i) => (
            <div key={i.repo} className="showcase-inc-row reveal">
              <code>{i.repo}</code>
              <span>{i.what}</span>
              <span className="showcase-inc-into">→ {i.into}</span>
            </div>
          ))}
        </div>
      </section>

      {/* OUTCOMES */}
      <section className="showcase-section dark">
        <div className="showcase-section-head reveal">
          <h2>What you get</h2>
          <p>Not slideware. These hold up when it matters.</p>
        </div>
        <div className="showcase-grid">
          {OUTCOMES.map((o) => (
            <div key={o.title} className="showcase-card-plain reveal">
              <h3>{o.title}</h3>
              <p>{o.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ (AEO) */}
      <section id="faq" className="showcase-section light">
        <div className="showcase-section-head reveal">
          <h2>Frequently asked questions</h2>
        </div>
        <div className="landing-faq">
          {FAQS.map((f) => (
            <details key={f.q} className="landing-faq-item reveal">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="showcase-cta">
        <h2>Stop building a GTM machine by hand.</h2>
        <p>One loop. Five engines. Every product working together.</p>
        <Button onClick={go} className="btn-lg">Get started</Button>
      </section>

      <footer className="showcase-footer">
        <span className="topbar-brand"><span className="landing-mark">CE</span> GTM-360</span>
        <nav>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/login">Sign in</Link>
        </nav>
        <span className="muted">© {new Date().getFullYear()} GTM-360 · The Revenue Operating System</span>
      </footer>
    </div>
  );
}