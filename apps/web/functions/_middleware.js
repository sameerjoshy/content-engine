/**
 * Cloudflare Pages Function (middleware).
 *
 * F1 fix: content.gtm-360.com is served by the same project as
 * agents.gtm-360.com. `_redirects` is not host-aware, so this middleware issues
 * a real server-side 301 from the legacy content host to the canonical Agent
 * Portal host — replacing the previous client-side JS redirect.
 *
 * Note: content-engine deploys manually (`npm run build:web` + wrangler pages
 * deploy), so this takes effect on the next deploy of the `content-engine`
 * project.
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === 'content.gtm-360.com') {
    return Response.redirect('https://agents.gtm-360.com' + url.pathname + url.search, 301);
  }
  return context.next();
}
