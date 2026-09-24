import { useEffect } from 'react';
import { BRAND, BRAND_TAGLINE } from './brand';

/** Sets document.title for the page — SEO + browser tab clarity. */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} — ${BRAND}` : `${BRAND} — ${BRAND_TAGLINE}`;
  }, [title]);
}
