import { Link } from 'react-router-dom';
import { usePageTitle } from '../usePageTitle';

function LegalShell({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="legal-page">
      <div className="legal-nav">
        <Link to="/" className="topbar-brand">
          <span className="landing-mark">CE</span> Agent Portal
        </Link>
        <nav className="topbar-nav">
          <Link to="/">Home</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/login">Sign in</Link>
        </nav>
      </div>
      <div className="article container-narrow">
        <h1>{title}</h1>
        <p className="muted">Effective date: {updated}</p>
        {children}
      </div>
    </div>
  );
}

export function Privacy() {
  usePageTitle('Privacy');
  return (
    <LegalShell title="Privacy Policy" updated="September 13, 2026">
      <p>
        This Privacy Policy explains what Agent Portal ("we", "our", "GTM-360") collects, why we collect it, how it is
        used and shared, and the choices you have. Agent Portal is an AI-assisted content production tool. It is owned
        and operated by GTM-360.
      </p>

      <h2>1. Information we collect</h2>
      <p>We collect the following categories of information:</p>
      <ul>
        <li>
          <strong>Account information.</strong> When you create an account we collect your first and last name, email
          address, and company name. If you sign in with Google, we receive the name, email address, and profile picture
          that Google provides under your Google account settings.
        </li>
        <li>
          <strong>Content you create.</strong> We store the profiles (brand voice, ICP, research rules), topics, angles,
          research briefs, drafts, edits, and published pieces you generate with the service.
        </li>
        <li>
          <strong>Usage and telemetry.</strong> We record workflow events, the number of AI calls, token usage, latency,
          and cost per run. This is used to operate the service and measure quality.
        </li>
        <li>
          <strong>Research sources.</strong> When the Researcher gathers evidence for your piece, we store the URLs,
          titles, and excerpts used so every claim in your content can be traced to a source.
        </li>
        <li>
          <strong>Technical data.</strong> We automatically receive standard web logs — IP address, browser type, pages
          visited, and timestamps — needed to operate and secure the service.
        </li>
      </ul>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To provide, maintain, and improve the Agent Portal service.</li>
        <li>To generate drafts, research briefs, distribution variants, and email editions you request.</li>
        <li>To authenticate you and secure your account.</li>
        <li>To sync account information to our customer relationship management system (HubSpot) so we can support you.</li>
        <li>To send transactional email — confirmation, newsletter editions you request, and service notices.</li>
        <li>To monitor quality and cost of AI usage, and to debug and prevent abuse.</li>
      </ul>
      <p>
        We do <strong>not</strong> sell your personal information. We do not use your content to train third-party models
        for our commercial benefit.
      </p>

      <h2>3. Legal bases (GDPR)</h2>
      <p>
        Where the EU General Data Protection Regulation applies, we rely on: your consent (where you opt in to
        communications), performance of a contract (providing the service you requested), and our legitimate interests
        (operating and securing the service, quality monitoring, and abuse prevention).
      </p>

      <h2>4. Service providers and third parties</h2>
      <p>To run the service we share limited data with the following processors, each under its own data-processing terms:</p>
      <ul>
        <li><strong>Supabase</strong> (agrnbsaaxdbvlcdqtnwo.supabase.co) — database, authentication, and file storage.</li>
        <li><strong>Cloudflare</strong> — edge hosting for our API and website.</li>
        <li><strong>DeepSeek</strong> — large language model inference for research, drafting, and editing.</li>
        <li><strong>Tavily, Jina, OpenAlex, Semantic Scholar, Wikipedia</strong> — web and academic research used to ground your content.</li>
        <li><strong>Resend</strong> — transactional email delivery.</li>
        <li><strong>HubSpot</strong> — customer relationship management (contact sync on signup).</li>
        <li><strong>Google</strong> — OAuth sign-in and, where used, Google Cloud services.</li>
      </ul>

      <h2>5. Data retention</h2>
      <p>
        We retain account information and the content you create for as long as your account is active, so you can revisit
        and reuse your work. Telemetry and event logs are retained for a rolling period to support quality and cost
        monitoring. You may delete your account and request removal of your data at any time (see Section 7).
      </p>

      <h2>6. Security</h2>
      <p>
        We use industry-standard measures including encryption in transit (TLS), server-side role-restricted database
        access, secrets stored outside the codebase, and scoped access tokens. No method of transmission over the
        internet is 100% secure, but we work to protect your data.
      </p>

      <h2>7. Your rights</h2>
      <p>Depending on your jurisdiction, you may have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you.</li>
        <li>Correct inaccurate data.</li>
        <li>Request deletion of your data and account.</li>
        <li>Object to or restrict certain processing.</li>
        <li>Export a copy of your data in a portable format.</li>
      </ul>
      <p>
        To exercise any of these rights, email <a href="mailto:sameer@gtm-360.com">sameer@gtm-360.com</a>. We respond
        within 30 days. If you are in the EEA or UK and are not satisfied with our response, you may lodge a complaint
        with your local supervisory authority.
      </p>

      <h2>8. Children</h2>
      <p>
        Agent Portal is a business tool and is not directed to children under 16. We do not knowingly collect personal
        information from children.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We may update this policy as the service evolves. Material changes will be announced on this page with an updated
        effective date. Continued use after a change constitutes acceptance of the revised policy.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about this policy or your data: <a href="mailto:sameer@gtm-360.com">sameer@gtm-360.com</a>, GTM-360,
        Agent Portal.
      </p>
    </LegalShell>
  );
}

export default Privacy;
