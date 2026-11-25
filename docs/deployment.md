# API deployment and operations

This runbook prepares a future authorized deployment. No real account, domain,
D1 database, keys or sender have been configured by this work. A GitHub release
does not deploy the Worker. The implemented Vue/Bootstrap screens build to
`dist/frontend`. Same-origin asset/API packaging is configured and tested locally;
real hosting, account/database/domain bindings, secrets and delivery remain pending.

## Inputs and configuration

Record the approved release commit, Cloudflare account, Worker name, D1 name/ID,
HTTPS hostname/route, intended plan and Resend verified sender. Use a dedicated
staging database and test recipients before production. Never paste secrets in
issues, chat, command arguments or source control.

[wrangler.jsonc](../wrangler.jsonc) is local configuration: its D1 UUID is a
placeholder and `workers_dev` is false. Before an authorized publication, prepare
and review an explicit target configuration with a real `DB` binding, migrations
directory and HTTPS route/custom domain. Do not silently repoint the local DB.
Keep the existing compatibility date until a separately tested upgrade.

`APP_ORIGIN` must be the exact browser HTTPS origin (scheme, hostname and port,
without a path). Cookies are Secure/HttpOnly/host-only/SameSite=Lax; the current
API assumes frontend and API share an origin and enables no CORS. A separate
Sites hostname requires an approved topology/authentication design before use.
The Vite development proxy does not provide production routing. For the compiled
site, [wrangler.site.jsonc](../wrangler.site.jsonc) supplies native Worker Static
Assets routing. Assets are served directly; `/api`, `/api/*` and `/health` run the
existing Worker first, even if a static file collides with those paths. There is
no script-level asset binding or public asset fallback in the API. Hash navigation
needs no SPA fallback: `not_found_handling=none` preserves missing-route errors.
Unknown API paths return API 404 responses, not `index.html`, including browser
navigation requests. Static resources are public; private data still requires
the existing session API. No CORS, Origin, CSRF or cookie policy changes are made.
Preserve the server-controlled `CF-Connecting-IP` header for rate limiting.

## Local packaging and routing validation

`npm run build:site` builds the frontend, then runs Wrangler with
`--config wrangler.site.jsonc --dry-run --outdir dist/worker`. Only `dist/frontend`
is public; the Worker bundle in `dist/worker` is outside that assets directory.
Build immediately before packaging to avoid stale assets. The separate
[API-only config](../wrangler.jsonc) remains usable without a frontend build.
Both configs are local templates with placeholder D1 IDs, not deployment targets.
Review common runtime settings in both when changing them; they do not inherit
configuration from each other. CI packages the combined site without deployment.

[site-hosting.integration.test.ts](../tests/site-hosting.integration.test.ts)
builds current frontend source, dry-runs the site config and runs the real bundled
Worker with Miniflare/workerd static routing and migrated ephemeral D1. It checks
HTML/HEAD, JS/CSS/SVG types, missing routes, reserved-path collisions, health,
unauthenticated no-store JSON, method checks and Origin rejection. It does not
certify remote routing, TLS, cookie delivery or an actual deployment. Existing
[browser evidence](./qa/browser-validation/README.md) used the Vite proxy and must
not be represented as browser verification of a published combined site.

Routing follows the official [Static Assets configuration](https://developers.cloudflare.com/workers/static-assets/binding/)
(reviewed 2026-11-20). Before future publication, copy/review the combined site
template into the explicit target config and replace local resource identifiers,
origin and routes. Preserve all runtime lifetimes, encryption/mail secrets and
Cron configuration; do not point staging at production D1.

Non-secret lifetimes in seconds: `SESSION_TTL_SECONDS=86400`,
`EMAIL_VERIFICATION_TTL_SECONDS=86400`, `PASSWORD_RECOVERY_TTL_SECONDS=1800`.
The Worker reads these settings from bindings, not from a browser.

Provision Worker secrets through Cloudflare's secret management. Required for
draw publication: `DRAW_KEY_ID`, `DRAW_CIPHER_KEY_HEX`, `DRAW_INDEX_KEY_HEX`.
Generate two independent random 32-byte keys securely, represented by 64 hex
characters. Do not use the same cipher/index material or reuse a key ID for new
material. Retain historical AES keys securely; optional
`DRAW_PREVIOUS_CIPHER_KEYS_JSON` contains `[{"id":"old-id","cipherHex":"..."}]`.
Loss of historical keys makes retained assignments unreadable. Never put actual
keys in this document, D1 or logs.

Email requires `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (an authorized sender).
Use a key restricted to the required mail capability. Missing configuration can
consume the six known failures of pending closure notices. Set up and validate
mail before enabling production Cron or creating real closures.

## Release sequence for a future authorized operation

1. Select the reviewed `main` commit/release; confirm CI and run `npm ci`,
   `npm run typecheck`, `npm test`, `npm run build:site` and `git diff --check` locally.
2. Review target configuration/account/database and the existing migration list.
   Use the installed Wrangler, an explicit `--config TARGET_CONFIG` and the
   intended database name for every remote operation. Create D1 only if it does
   not already exist. Do not run the local migration script against production.
3. Plan a maintenance window for an existing deployment. Preserve a tested backup
   and recovery procedure for both D1 and keys. Review migration compatibility
   with the currently running code. Do not restore a database casually: doing so
   can resurrect sessions, consumed tokens or previously sent email work.
4. Review pending migrations with `wrangler d1 migrations list DATABASE --remote
   --config TARGET_CONFIG`; apply them with `wrangler d1 migrations apply DATABASE
   --remote --config TARGET_CONFIG` only in the authorized window. Fresh databases
   need all migrations in order. Do not edit applied migrations. All twelve
   migrations through 0012 are required by the current scheduled handler.
5. Provision the reviewed Worker bindings/secrets and HTTPS routing. Build current
   frontend assets using `npm run build:frontend`, then bundle using
   `wrangler deploy --dry-run --config TARGET_CONFIG --outdir OUTPUT_DIRECTORY`.
   A successful dry run validates packaging only; it does not validate remote
   bindings, secret values, mail delivery or publish anything.
6. Publish the reviewed Worker/configuration only after database and secret
   readiness. Initial provisioning of Worker secrets may require creating the
   Worker first: keep routes/Cron disabled until ready, then publish the final
   configuration. Do not briefly expose an unprepared production deployment.
7. Confirm `* * * * *` on the actual Worker and observe native scheduled invocations
   without browser traffic. Cron is UTC and changes may take up to fifteen minutes
   to propagate. The current code processes at most twenty closes, twenty redraws
   and twenty notices per invocation. Event persistence failure can abort the
   handler before the notice phase; inspect invocation failures as well as counts.

Commands above are templates, not commands executed by this task. Use the local
Wrangler binary (for example `npm exec -- wrangler ...`) after installing the
lockfile. Do not pass actual secrets as shell arguments. Check the current
[D1 commands](https://developers.cloudflare.com/d1/wrangler-commands/),
[Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
and [Cron documentation](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
before performing remote operations (reviewed 2026-11-20).

## Acceptance in staging

`GET /health` only returns process-level status; it does not query D1 or prove
secrets, email or scheduled processing work. Use synthetic accounts through the
public registration/login routes. Confirm session/CSRF protections, invitations
and explicit acceptance with at least three members, owner event creation,
private own-assignment reads, manual close and scheduled close. Confirm a removed
member loses access. Never print assignments, cookies, codes or envelope contents
in the verification report.

Real mail validation must use authorized test inboxes. Check verification,
recovery, invitation and generic closure mail separately. Resend success means
accepted by the provider, not delivered to the inbox. Closure notices have
durable retries; other flows retain their documented policies. Do not intentionally
exhaust production retries or manually reset rows to resend ambiguous outcomes.

Measure scheduled closure completion against its stored due time with no browser
activity. Include backlog and failure scenarios, participant counts, platform
CPU/memory/query limits and the selected plan. Local tests, once/minute cadence
and a successful invocation do not certify the sixty-second target. Profile
Argon2id on the selected plan too; local workerd does not certify production CPU.

## Aggregate diagnostics

Run [event-health.sql](../operations/event-health.sql) and
[notification-health.sql](../operations/notification-health.sql) only against a
database migrated through 0012. Example template:
`wrangler d1 execute DATABASE --remote --config TARGET_CONFIG --file operations/event-health.sql`.
Use `--local` only for an intended persistent development database; tests use
separate ephemeral D1. These SELECT-only files never change queue state or expose
IDs, email, token/lease values, credentials or assignments.

- Events: `queued` counts jobs by kind, `runnable` counts jobs due for retry with
  at least three members, `undersized` counts jobs waiting for participants, and
  `backed_off` counts positive retry stages (including retries now due).
  `oldest_closure_delay_ms` includes undersized/backed-off closes and measures
  outstanding closure lateness, not already-completed closure latency.
- Notices: totals by status, due pending rows, expired sending leases, maximum
  known failures and age of the oldest pending/sending row. An expired lease is
  recoverable, not proof of failed delivery. Accepted is not inbox delivery.
- Empty tables return no rows; absent statuses/kinds are zero. Time is database
  UTC rounded to seconds, so these diagnostics are not millisecond deadline tests.
  Each file is a separate observation; results/logs are not a cross-query snapshot.
  Aggregates return bounded rows but scan stored jobs/notices and may become
  expensive as history grows. Run on demand, measure cost, and approve retention
  or a different monitoring design before high-frequency polling.

Compare trends with `Scheduled event processing` and `Draw notification
processing` aggregate logs. Known event errors back off indefinitely at 1, 2, 4,
8, then 15 minutes. Notices stop after six known failures with waits 1, 2, 4, 8,
16 minutes. Lost acknowledgement/timeout recovery can duplicate external delivery.
Investigate persistent lag and failed notices; do not erase evidence or claim
exactly-once delivery. Set operational alert thresholds after measuring workload.

## Recovery boundaries

Keep previous release artifacts/configuration and a reviewed incident procedure.
Rolling Worker code back does not roll D1 or external email back. Check schema
compatibility before choosing an older version; prefer a tested forward fix when
required. No down migrations, automatic rollback, retention deletion, resend
administration or key rotation operation is supplied by this runbook.

## ChatGPT Sites packaging (step 1)

The existing TocaRegalo Site uses `.openai/hosting.json` with its project ID and
logical D1 binding `DB`. Use Node 24 and the root lockfile:

```sh
npm ci
npm run build:chatgpt-sites
npm run validate:chatgpt-sites
```

The new command builds Vue and bundles the existing API with the compiled public
HTML, JS, CSS and SVG embedded in a single ES module at `dist/server/index.js`.
This avoids assuming that Sites provisions Wrangler's native asset router. The
wrapper forwards `/api`, `/api/*` and `/health` to the existing handler; other
known static paths support GET/HEAD only. Unknown paths return 404. The scheduled
handler is preserved, but packaging does not register a Cron Trigger on Sites.
Generated output from the previous build is replaced; rerun `npm run build:site`
when the native Cloudflare artifact is required. The manifest is copied to
`dist/.openai/hosting.json`. No local environment file or runtime secret is copied.

The validation script uses Miniflare with an ephemeral binding to exercise the
actual single-module artifact, public assets, routing and unauthenticated API.
The D1 migration format, production secret provisioning, background scheduling,
CPU profiling and hosted publication remain separate deployment steps. Do not
publish this initial artifact as a complete operational release.
