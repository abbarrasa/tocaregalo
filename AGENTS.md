# Instructions for AI agents

Applies to `abbarrasa/tocaregalo-sites`. Read [MEMORY.md](./MEMORY.md) and [README.md](./README.md) for current invariants and commands, and verify the working tree before editing. Current user instructions take precedence.

## Fast feature workflow

1. **Inspect first (read-only):** Check `git status --short --branch`, relevant code, and existing tests before proposing changes.
2. **Short plan first:** Present a concise plan (target files, behavior/edge cases, and tests to add/update) and wait for explicit approval before modifying code or migrations. Do not ask again for routine sub-steps once approved.
3. **Protect existing behavior & tests:** Keep existing public contracts, auth/CSRF rules, D1 schemas/triggers, and passing tests intact unless explicitly asked to change them.
4. **Tests & lightweight memory:** Add or update focused tests for new behavior, failure modes, and regressions. Run `npm test`, `npm run typecheck`, and `git diff --check` (plus `npm run build:site` when touching frontend, Worker routing, or build config). Update only the relevant section of `MEMORY.md` when a feature adds durable contracts, migrations, or gotchas—skip changelog-style bloat.

## Git rules

- Check `git status --short --branch` and local branches before switching; preserve pre-existing changes.
- Branch from current local `dev` as `feature/<short-kebab-case-name>` when requested; never silently update `dev` from remote.
- Never run `reset`, `restore`, `clean`, `stash`, `commit`, `amend`, `rebase`, `merge`, `force-push`, or `push` unless explicitly requested, and do not stage files unless asked.

## Stack & layer boundaries

- **Stack:** TypeScript + Vue 3 + Bootstrap 5 in `frontend/` (TS 6 via `frontend/typecheck.cjs`); TypeScript 7 Worker API (`src/`), Cloudflare D1 (`migrations/`), and SendGrid HTTPS (`src/infrastructure/`), installed via root lockfile (`npm ci`).
- **Separation:** Keep HTTP (`src/http/`), application services (`src/application/`), pure domain logic (`src/domain/`), and persistence (`src/persistence/`) separated. Do not import one repository from another.
- **Code & test style:** Use explicit `.ts` imports and erasable TypeScript runnable directly by Node >=24. Avoid `any`, unsafe casts, broad exception swallowing, or speculative abstractions.

## Core domain & security invariants

- **Session & CSRF:** Derive acting account ID strictly from a verified session (`__Host-tocaregalo_session`: `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`). Require exact HTTPS `APP_ORIGIN` (no trailing slash/path) and session-bound `X-CSRF-Token` on state-changing requests. Never store tokens, passwords, codes, sessions, or assignments in `localStorage`/`sessionStorage`, URLs, or logs; never log secrets or PII.
- **Auth & accounts:** Public registration requires `email`, `password`, and `name` (`lastName` and `phone` optional). The **only** password rule is at least 6 Unicode code points (no max length, composition rules, trimming, or normalization). Login accepts normalized email or international phone (`+` + up to 15 digits) + password, checking credential currency so concurrent resets invalidate old sessions. Unverified accounts can log in; email verification and password recovery use separate domain-separated SHA-256 token hashes and atomic D1 batches.
- **Phone login:** Login accepts international phones with `+` and national phones using `LOCAL_COUNTRY_PHONE_PREFIX` (default `+34`); stored phones remain canonical international numbers.
- **Profile updates:** `PATCH /api/me/profile` derives account identity only from the verified session and requires session CSRF/origin checks. Profile edits are atomic; email changes clear verification and invalidate email/recovery challenges, while password changes require the current password and revoke every session.
- **Field errors:** Public registration and profile validation return safe `{ code, fields }` payloads; `fields` maps frontend control names to user-safe Spanish messages, and UI components may mark/focus only those fields.
- **SendGrid development:** Sandbox/redirection require `APP_ENV=development`; sandbox takes priority and redirect replaces only `to`, with no PII/provider details in logs.
- **Social auth:** Social identities use `(provider, subject)` and may link to an existing account only after provider email verification. OAuth state is consumed once and stored hashed; provider subjects and verified email identities, never browser-supplied account IDs, decide account resolution. Issue sessions only through `SessionService`.
- **Groups, invitations & members:** Enforce ownership in SQL for owner-only mutations (group creation, owner invitations, member removal, event creation, draw/close). Use keyset pagination (default 20, max 50, lookahead +1) without `OFFSET` or snapshot guarantees; cursors never authorize access. Removing a member cancels active unconsumed invitations for their stored email and removes membership in one D1 batch while preserving encrypted draw snapshots.
- **Events, draws, private recipient & cron:** Events keep `id`, `groupId`, `closureAtMs` (`null` or future safe integer ms > server `createdAtMs`), and immutable `createdAtMs` (`0008_event_creation_order.sql` trigger). Draws include all current members (minimum 3), use uniform rejection-sampled Fisher-Yates without fixed points, encrypt envelopes with AES-GCM (bound to key ID/draw/giver) + draw-scoped HMAC index, and read keys from Worker secrets (`DRAW_KEY_ID`, `DRAW_CIPHER_KEY_HEX`, `DRAW_INDEX_KEY_HEX`, optional `DRAW_PREVIOUS_CIPHER_KEYS_JSON`). `GET /api/events/:id/recipient` returns only the caller's own current-draw assignment after a post-decryption permission/version recheck. Cron (`* * * * *`) processes bounded due closes (20), redraws (20), and closure notifications (20 leased deliveries) with fenced retries and aggregate-only logs.
- **Frontend (`frontend/`):** Share one `HttpClient` per app instance with in-memory CSRF; keep domain clients separate (`api.ts`, `group-client.ts`, `invitation-client.ts`, `event-client.ts`, `event-lifecycle-client.ts`, `recipient-client.ts`). Fence stale async responses on navigation, resource switch, or unmount; clear private state on `401` and handle `404`/`409`/`503` without auto-retrying ambiguous mutations. Never infer permissions from visible controls or effective closure from scheduled dates.

## Commands & local boundaries

```sh
npm ci
npm test
npm run test:unit
npm run test:integration
npm run typecheck
npm run build:site
git diff --check
```

- Use `npm run dev:api` + `npm run dev:frontend` (`https://localhost:5173/`) for local browser work; run `npm run db:migrate:local` deliberately on persistent local D1 (integration tests use ephemeral D1).
- Do not deploy, run remote migrations, touch remote resources, or send real emails unless explicitly requested and configured. Local/workerd/jsdom passes do not certify remote D1, production CPU/Cron timing, or real email delivery.