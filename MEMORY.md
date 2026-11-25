# TocaRegalo project memory

Last updated: 2026-11-25. Dated handoff — verify current `git status` and files before editing. Supersedes earlier historical assumptions where newer migrations/features exist.

## Product & architectural baseline

- **Repository & scope:** `abbarrasa/tocaregalo-sites` (independent TypeScript + Vue 3 + Bootstrap 5 + Cloudflare Workers + D1 + Resend HTTPS implementation; Symfony lives in a separate repo). The v1.2 spec is not yet present; `/home/albertusko/Proyectos/TocaRegalo.html` (read 2026-11-20) is a visual reference only, not a replacement for backend/privacy rules.
- **Same-origin routing:** API (`/api`, `/api/*`, `/health`) runs on the Worker; static assets (`dist/frontend`) use hash routing (`#groups`, `#account`, `#invitations`, `#groups/<id>/events`, `#events/<id>`) with `not_found_handling=none` in `wrangler.site.jsonc` and `Cache-Control: no-store` on API responses.

## Key modules & migrations

- **Migrations (`0001`–`0012`):**
  - `0001_draws.sql`: events, draws, snapshots, encrypted assignments.
  - `0002_accounts_groups.sql`: accounts, groups, memberships, nullable `events.group_id` (legacy `group_id IS NULL` events remain inaccessible to membership queries).
  - `0003_sessions.sql`: SHA-256 hashed 256-bit tokens, cascade on account delete.
  - `0004_public_auth.sql`: `last_name`, unique non-null `phone`, credentials table, rate-limit counters.
  - `0005_email_verification.sql`: `email_verified_at_ms` and single active challenge per account.
  - `0006_password_recovery.sql`: credential revision and recovery challenges.
  - `0007_event_listing_index.sql` & `0008_event_creation_order.sql`: `(group_id, created_at_ms DESC, id DESC)` index and `BEFORE UPDATE` trigger keeping `events.created_at_ms` immutable.
  - `0009_group_invitations.sql`: one active invitation per `(group_id, normalized_email)`, 7-day TTL, atomic acceptance + membership insert.
  - `0010_event_draw_lifecycle.sql`: membership revisions, draw versions, `pending`/`ready`/`closed` lifecycle, immutable closed snapshots.
  - `0011_scheduled_event_processing.sql`: `event_processing_jobs` (`close`/`redraw`), version + group-revision fences, capped backoff `1 -> 2 -> 4 -> 8 -> 15` min (stage saturates at 5).
  - `0012_draw_notifications.sql`: closure notification outbox, 120s fenced leases, max 6 known failures (`1 -> 2 -> 4 -> 8 -> 16` min).
  - `0013_social_auth.sql`: Google identities keyed by `(provider, subject)`, linked accounts and short-lived OAuth state hashes.
- **Backend (`src/`):** `worker.ts` wires `domain/`, `application/`, `persistence/` (shared `PersistenceDatabase` in `src/persistence/d1.ts`), and `infrastructure/` (Argon2id via `@noble/hashes`, Web Crypto AES-GCM/HMAC, Resend HTTPS).
- **Frontend (`frontend/src/`):** `App.vue`, `AuthForm.vue`, `AccountPanel.vue`, `GroupList.vue`, `GroupDetail.vue`, `OwnerInvitations.vue`, `AcceptInvitation.vue`, `EventList.vue`, `EventDetail.vue`, `EventLifecycle.vue`, `PrivateRecipient.vue`, `PageControls.vue`, `BrandMark.vue`, `http-client.ts`, `clients.ts`, `api.ts`, `group-client.ts`, `invitation-client.ts`, `event-client.ts`, `event-lifecycle-client.ts`, `recipient-client.ts`, `event-time.ts`, `pagination.ts`, `navigation.ts`, `use-page.ts`.

## Test & environment notes

- **Test runner & DB helpers:** Node >=24 (`node:sqlite` + native TS execution). Use `tests/helpers/migrations.ts` when fixtures load migrations with `-- statement-breakpoint` triggers (`0008+`). Integration tests run against ephemeral Miniflare/workerd D1, not persistent local D1 (`npm run db:migrate:local`) or remote D1.
- **Pinned versions to respect:** `@noble/hashes` `2.4.0`, `miniflare` `5.20261118.0-beta` (`convertV4MiniflareOptions`), root TS 7 vs. frontend workspace TS 6 (`frontend/typecheck.cjs`).
- **Profile updates:** `PATCH /api/me/profile` is session/CSRF-scoped; email changes invalidate verification/recovery, and password changes require the current password and revoke all sessions.
- **Field errors:** Registration/profile APIs return `{ code, fields }`; the frontend maps these entries to accessible control-level Spanish messages.
- **Phone login:** National phone identifiers are normalized with `LOCAL_COUNTRY_PHONE_PREFIX`, default `+34`; explicit international prefixes remain unchanged.
- **Resend development:** Use `RESEND_TEST_MODE=true` or `RESEND_TEST_RECIPIENT_EMAIL`; both require `APP_ENV=development`, and test mode skips external calls.
- **Workstation path note:** If `node` is missing from a restricted agent PATH, check existing Node >=24 installations (e.g., `/home/albertusko/.nvm/versions/node/v24.22.2/bin/node`) rather than installing a second runtime.

## Pending & unverified items

- **Production & external services:** No remote D1 migration/deployment, real secrets (`RESEND_API_KEY`, `DRAW_CIPHER_KEY_HEX`, `DRAW_INDEX_KEY_HEX`, optional `DRAW_PREVIOUS_CIPHER_KEYS_JSON`), real email deliverability testing, or production Argon2id CPU profiling has been performed yet.
- **Timing & product scope:** The <=60s post-due closure target is not certified by a 1-minute Cron or local tests alone. Phone verification, voluntary group exit, ownership transfer, account/recipient deletion policies, and any v1.2 extensions require explicit specification and approval before implementation. Browser QA in `docs/qa/browser-validation/README.md` verified core flows in local Chromium (including fix and revalidation of the post-verification navigation lock), with mobile/cross-browser and production TLS/cookie checks still pending.

## ChatGPT Sites hosting artifact

- `npm run build:chatgpt-sites` generates the self-contained Worker at
  `dist/server/index.js` with embedded public frontend assets and the existing
  Sites manifest at `dist/.openai/hosting.json`. The API and scheduled handler
  are preserved. `npm run validate:chatgpt-sites` checks the actual artifact in
  ephemeral workerd; the native `build:site` command remains available.
- Hosted migration packaging, actual D1 provisioning, secrets, scheduling and
  production runtime validation remain pending. Neither command publishes.
