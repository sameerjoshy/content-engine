// The Agent Portal (agents.gtm-360.com) and the Content Engine
// (apps.gtm-360.com/content-engine, content.gtm-360.com) share this app's code.
// Brand by host so the two surfaces never conflate.
const host = typeof window !== 'undefined' ? window.location.hostname : '';

export const isAgentPortal = host === 'agents.gtm-360.com';
export const BRAND = isAgentPortal ? 'Agent Portal' : 'Content Engine';
export const BRAND_TAGLINE = isAgentPortal
  ? 'AI Content Production for GTM Teams'
  : 'Topic to fact-checked article, in your voice';
