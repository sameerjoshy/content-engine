# GTM-360 Domain & Config Cleanup Runbook

> **Status:** Ready to execute (2026-09-13). Owner: GTM-360. Each step is reversible;
> rollback is noted per step. Token constraints are flagged inline.

## 1. Target state — one URL per product, one API

| Product | Canonical URL | Cloudflare resource | State today |
|---|---|---|---|
| Marketing + Hub | `gtm-360.com` (Hub `/system`) | Pages `gtm-360-website` | ✅ keep |
| Compass | `okr.gtm-360.com` | Pages `okr-web` | ✅ keep |
| Cockpit | `brain.gtm-360.com` | Render `gtm-360-cockpit` | ✅ keep |
| Crew | `agents.gtm-360.com` | Pages `gtm-360-agents` | ✅ keep |
| Method | `gtm.gtm-360.com` | Pages `gtm-operating-model` | ✅ keep |
| Content Engine | `content.gtm-360.com` | Pages `content-engine` | ✅ keep |
| **Platform API** | `api.gtm-360.com` → worker | route `api.gtm-360.com/*` | ⛔ to create |
| Cockpit aliases | — | `gtm360-hq`, `gtm360-revenue-os`, `opensignal` | ⛔ to retire |
| Dead app | — | Pages `gtm-360-workbench` | ⛔ to delete |

## 2. Execution order

### Step 1 — Fix the shared Supabase project (unblocks all apps)

The project `agrnbsaaxdbvlcdqtnwo` ("Open signal") is shared by Content Engine + the
OKR/Cockpit products. Two values are actively harmful:

- **Site URL** is `https://outbound.gtm-360.com` — a Cockpit alias. When a redirect
  target fails validation, gotrue falls back here (this caused the `hq.gtm-360.com`
  login bounce). Set it to the Hub: **`https://gtm-360.com`**.
- **Redirect allow-list** needs wildcards for every product domain so any path is a
  valid OAuth target:
  `https://outbound.gtm-360.com,https://gtm-360.com,https://gtm-360.com/*,https://okr.gtm-360.com,https://okr.gtm-360.com/*,https://brain.gtm-360.com,https://brain.gtm-360.com/*,https://agents.gtm-360.com,https://agents.gtm-360.com/*,https://gtm.gtm-360.com,https://gtm.gtm-360.com/*,https://content.gtm-360.com,https://content.gtm-360.com/*,https://content-engine-9eq.pages.dev,https://content-engine-9eq.pages.dev/*,http://localhost:3000,http://localhost:5173`

  ⚠️ **Token read-only** (`sbp_…` 403 on config PATCH) → do in **dashboard**:
  Supabase → Authentication → URL Configuration.

  *Rollback:* revert Site URL / allow-list to the values above (previous values are in
  this doc's history / AGENTS.md).

### Step 2 — Retire the Cockpit duplicate aliases

`hq.gtm-360.com`, `app.gtm-360.com`, `outbound.gtm-360.com`, `signal360.gtm-360.com`
all serve the Cockpit app while the switchers/smoke agree the canonical is
`brain.gtm-360.com`. Redirect them so any bookmarked URL keeps working:

| Alias | Pages project | Action |
|---|---|---|
| `hq.gtm-360.com` | `gtm360-hq` | Keep domain → **307 redirect to `brain.gtm-360.com`** (or repoint to its intended Revenue-OS product) |
| `app.gtm-360.com` | `gtm360-revenue-os` | **307 redirect to `brain.gtm-360.com`** (or adopt as the unified app shell) |
| `outbound.gtm-360.com` | `opensignal` | **307 redirect to `brain.gtm-360.com`** (was the Supabase site_url — now replaced in Step 1) |
| `signal360.gtm-360.com` | `opensignal` | **307 redirect to `brain.gtm-360.com`** |

How: Cloudflare Dashboard → Pages project → Custom domains → add a Bulk Redirect rule,
or a `_redirects` file in the project: `/* https://brain.gtm-360.com/ 307`.
Keep the Pages projects themselves (they may be rebuilt for their intended products)
unless the product is dead.

*Rollback:* remove the redirect → the domain serves its previous build again.

### Step 3 — Delete the dead workbench

`workbench.gtm-360.com` returns 404 and the project is 7 months stale.

```
npx wrangler pages project delete gtm-360-workbench
```
⚠️ Requires `CLOUDFLARE_API_TOKEN` with Pages write (current token has it). Confirm the
404 on a fresh browser session first.

*Rollback:* recreate the project and redeploy its dist.

### Step 4 — Create the platform API endpoint `api.gtm-360.com`

Serves the Phase-3 agent gateway (`api.gtm-360.com/agent/*`) and can front the
existing workers (`content-engine-api`, `okr-api`) behind one branded host.

1. DNS (needs a token/role with **DNS write** — current token has read only):
   `api.gtm-360.com CNAME → <target>`. For a Worker, add a route in the worker's
   `wrangler.jsonc`:
   ```jsonc
   "routes": [{ "pattern": "api.gtm-360.com/*", "custom_domain": true }]
   ```
2. `npx wrangler deploy` per worker.
3. Update `.env.production` / clients to call `https://api.gtm-360.com`.

*Rollback:* remove the route; clients fall back to `.workers.dev`.

### Step 5 — Stop exposing default Cloudflare subdomains

Enterprise hygiene: `*.pages.dev` and `*.workers.dev` shouldn't be public entry points.

- **Workers**: disable the `*.workers.dev` subdomain per account (Cloudflare dashboard →
  Workers & Pages → your subdomain → delete/disable), OR remove per-worker routes.
- **Pages**: `*.pages.dev` projects can't be fully hidden on the free tier; the alias
  URLs still resolve. Acceptable exposure, but do not link them anywhere.

*Rollback:* re-enable in the dashboard.

### Step 6 — Consolidate keep-alive workers

Two workers (`gtm-keepalive`, `gtm360-keepalive`) both ping to prevent Supabase
auto-pause, and the Content Engine API has an **undeployed** daily cron
(`src/index.ts` scheduled handler + `wrangler.jsonc` cron `0 3 * * *`).

- Pick ONE mechanism. Recommended: deploy the Content Engine API cron (free, already
  written, pings the shared `ce_sessions` table) and retire `gtm-keepalive` /
  `gtm360-keepalive`.
- Run: `npm run deploy:api` in `apps/api` after confirming the cron trigger.

*Rollback:* delete the cron trigger; re-enable a keep-alive worker.

## 3. Ordering rationale

1 → unblocks every app's auth (fixes the real login bug).
2 → removes the confusing 5-URL Cockpit spread without breaking bookmarks.
3 → deletes dead weight.
4 → gives the engine one branded API door (required before the Phase-3 gateway).
5 → cleans the surface users see.
6 → prevents the recurring Supabase auto-pause with a single mechanism.

## 4. Ownership

| Step | Action | Who can do it |
|---|---|---|
| 1 | Supabase Site URL + allow-list | You (dashboard) — token is read-only |
| 2 | Cloudflare Bulk Redirects / `_redirects` | You (dashboard) or `wrangler` (token has Pages write) |
| 3 | Delete `gtm-360-workbench` | `wrangler pages project delete` (token has Pages write) |
| 4 | DNS `api.gtm-360.com` | You (DNS write token/role) |
| 5 | Disable `*.workers.dev` | You (dashboard) |
| 6 | Deploy Content Engine API cron | `npm run deploy:api` (token has Workers write) |