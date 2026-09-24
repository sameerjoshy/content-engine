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

export function Terms() {
  usePageTitle('Terms');
  return (
    <LegalShell title="Terms of Service" updated="September 13, 2026">
      <p>
        These Terms of Service ("Terms") govern your access to and use of Agent Portal, an AI-assisted content
        production tool operated by GTM-360 ("we", "our"). By creating an account or using the service, you agree to
        these Terms.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least 18 years old and able to enter a binding agreement to use the service. By using it on behalf
        of a company, you represent that you are authorized to bind that company.
      </p>

      <h2>2. Accounts</h2>
      <p>
        You are responsible for safeguarding your credentials and for all activity under your account. You agree to
        provide accurate registration information and to keep it current. We may suspend or terminate accounts that
        violate these Terms.
      </p>

      <h2>3. AI-generated content</h2>
      <p>
        Agent Portal uses large language models and automated research to generate drafts, research briefs, and
        distribution variants. AI output can be inaccurate, incomplete, or unsuited to your purpose. You are responsible
        for reviewing and verifying all output before publication, and you assume full responsibility for the content you
        publish. The service includes fact-checking and evidence features, but they do not guarantee that every claim is
        true.
      </p>

      <h2>4. Your content</h2>
      <p>
        You retain all rights to the content you input and the output you generate and publish. You grant us a limited,
        non-exclusive license to process your content solely to provide the service (including storage, research, AI
        inference, and distribution to destinations you select). You represent that your inputs do not infringe third-party
        rights or violate applicable law.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You agree not to use the service to:</p>
      <ul>
        <li>Generate unlawful, defamatory, harassing, or fraudulent content.</li>
        <li>Infringe intellectual property or misappropriate trade secrets.</li>
        <li>Attempt to access the service, databases, or other users' accounts without authorization.</li>
        <li>Reverse engineer, resell, or build competing services on the service.</li>
        <li>Exceed reasonable usage limits or disrupt the service for others.</li>
      </ul>

      <h2>6. Fees and billing</h2>
      <p>
        The service is currently provided free of charge. If we introduce paid plans, pricing will be posted before any
        charge is incurred, and you will have the option to accept or cancel before payment.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        The service itself — software, branding, interfaces, and documentation — is owned by GTM-360 and protected by
        applicable law. You receive no ownership rights in the service beyond a revocable right to use it under these
        Terms.
      </p>

      <h2>8. Disclaimers</h2>
      <p>
        The service is provided "as is" and "as available", without warranties of any kind, express or implied, including
        merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the service will
        be uninterrupted, error-free, or that AI output will be accurate or complete.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, GTM-360 shall not be liable for indirect, incidental, special,
        consequential, or punitive damages, or for lost profits, revenue, or data, arising out of or relating to these
        Terms or your use of the service. Our total aggregate liability shall not exceed the amounts you paid us in the
        twelve months preceding the claim, or $100 if you paid nothing.
      </p>

      <h2>10. Termination</h2>
      <p>
        You may stop using the service and delete your account at any time. We may suspend or terminate access for
        violation of these Terms or for extended inactivity, with reasonable notice where practical. Provisions that by
        their nature survive termination (including Sections 3, 4, 8, and 9) remain in effect.
      </p>

      <h2>11. Governing law</h2>
      <p>
        These Terms are governed by the laws of the jurisdiction in which GTM-360 is established, without regard to
        conflict-of-law principles. You consent to the exclusive jurisdiction of that jurisdiction's courts for any
        dispute arising under these Terms, except where applicable law requires otherwise.
      </p>

      <h2>12. Changes</h2>
      <p>
        We may update these Terms from time to time. Material changes will be reflected on this page with an updated
        effective date. Continued use after a change constitutes acceptance.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions about these Terms: <a href="mailto:sameer@gtm-360.com">sameer@gtm-360.com</a>, GTM-360, Content
        Engine.
      </p>
    </LegalShell>
  );
}

export default Terms;
