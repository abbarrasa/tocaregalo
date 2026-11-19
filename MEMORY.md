# TocaRegalo project memory

Last reviewed: 2026-11-19. This is a handoff, not an implementation approval or a substitute for inspecting the repository. Start with [AGENTS.md](./AGENTS.md), [README.md](./README.md), `git status --short --branch`, and the current code and tests.

## Scope and decisions

- This repository is `abbarrasa/tocaregalo-sites`, an independent implementation for ChatGPT Sites. Symfony lives in a different repository.
- Target stack: Vue + Bootstrap, a TypeScript API on Cloudflare Workers, Cloudflare D1, and SendGrid HTTPS. Vue, Bootstrap, and SendGrid are not yet wired into this codebase.
- The published URL is intended to be public. The application must perform its own authentication and authorization before granting access to account, group, event, or assignment data. Public registration and password login now use the session foundation.
- Approved account requirements: email, password, and name are mandatory at public registration; surname and international phone are optional. Login accepts email or phone plus password. Email/phone must be unique when provided. The user explicitly overrode the proposed password limits: the only password policy is at least six Unicode code points, without a password-specific maximum, composition rules, trimming, or normalization. The JSON body has a separate operational 16 KiB limit.
- The approved default session lifetime is 24 hours, configurable with `SESSION_TTL_SECONDS`. Contact ownership verification and password recovery are outside this task and remain pending. Password login must not be described as verifying ownership of an email address or phone number.
- The TocaRegalo v1.2 specification and approved prototype are named product references, but their contents are not present here. Confirm requirements against those sources when needed.
- The user requires planning followed by explicit approval before implementation, including documentation. Git feature names must be in English, based on local `dev`, with no commits or pushes unless explicitly requested. Full rules are in [AGENTS.md](./AGENTS.md).

## Code map and implemented behavior

| Area | Source | Current behavior |
| --- | --- | --- |
| Draw algorithm | [draw.ts](./src/domain/draw.ts) | Secure rejection-sampled random indices, Fisher–Yates shuffle, and rejection of fixed points for uniform valid assignments. At least three distinct participants. |
| Recipient protection | [recipient-protection.ts](./src/domain/recipient-protection.ts) | AES-GCM envelopes with fresh 12-byte IVs, key/draw/giver authenticated scope, draw-scoped HMAC indexes, and decryption with a key ring. |
| Timing rules | [timing.ts](./src/domain/timing.ts) | Inclusive closure boundary, 60-second processing target, exponential retry timing from each preceding failure, and a six-attempt limit. |
| Shared validation | [validation.ts](./src/domain/validation.ts) | Nonblank ID checks, safe integer timestamps, and trimmed names of 1–100 characters, extracted without changing behavior. |
| Database contract | [d1.ts](./src/persistence/d1.ts) | Small structural D1 contract, now named `PersistenceDatabase` to reflect its use by every repository. |
| Draw persistence | [draw-repository.ts](./src/persistence/draw-repository.ts) | Validates a complete snapshot, encrypts recipients, and stores it in one atomic batch. One draw per event; duplicates fail rather than replace data. |
| Account persistence | [accounts-repository.ts](./src/persistence/accounts-repository.ts) | Internal provisioning without a password, normalized email, profile/self lookup with nullable surname and phone. Public credentials are handled separately. |
| Group persistence | [groups-repository.ts](./src/persistence/groups-repository.ts) | Atomic group/owner membership creation, member-scoped reads, owner-only membership mutations and event creation. |
| Session primitives | [session.ts](./src/domain/session.ts) | Random 256-bit tokens, SHA-256 storage hashes, and independently domain-separated session-bound CSRF tokens. |
| Session use cases | [session-service.ts](./src/application/session-service.ts) | Internal issuance for a verified account, explicit lifetime, injected clock, authentication, and revocation through a small store contract. |
| Session persistence | [sessions-repository.ts](./src/persistence/sessions-repository.ts) | Durable token hashes, account foreign key, server-side expiry, and deletion for revocation. |
| Session HTTP | [session-routes.ts](./src/http/session-routes.ts) | `GET /api/me` and `POST /api/logout`, no-store responses, session identity, and CSRF/origin checks on logout. |
| Session cookie | [session-cookie.ts](./src/http/session-cookie.ts) | Host-only Secure/HttpOnly/SameSite=Lax cookie helpers and rejection of duplicate or malformed tokens. |
| Authentication validation | [authentication.ts](./src/domain/authentication.ts) | Registration/login input validation, email and international phone normalization, and the minimum-six password rule. |
| Authentication use cases | [authentication-service.ts](./src/application/authentication-service.ts) | Public account registration and password verification before session issue, with injected credential store, hasher, and session service. |
| Password infrastructure | [argon2-password-hasher.ts](./src/infrastructure/argon2-password-hasher.ts) | Argon2id via pinned `@noble/hashes`, random salts, PHC encoding, fixed costs, and full dummy verification for unknown accounts. |
| Credential persistence | [credentials-repository.ts](./src/persistence/credentials-repository.ts) | Atomic account/credential creation, normalized email/phone lookup, and narrow uniqueness-conflict mapping. |
| Rate limiting | [auth-rate-limiter.ts](./src/application/auth-rate-limiter.ts), [auth-counters-repository.ts](./src/persistence/auth-counters-repository.ts) | Atomic D1 counters for fixed windows, hashed keys, and bounded historical cleanup. |
| Public auth HTTP | [auth-routes.ts](./src/http/auth-routes.ts), [auth-body.ts](./src/http/auth-body.ts) | Register/login routes, trusted HTTPS origin, bounded JSON streaming, generic login failures, and protected cookie issuance. |
| HTTP entry point | [worker.ts](./src/worker.ts) | Public health/register/login, session route composition, and generic failure responses without leaking database details. No HTTP endpoint issues sessions from an unchecked account ID. |

The validator extraction and database contract rename were approved together with these documents. They remove cross-repository validation coupling without changing SQL, cryptography, permissions, or business rules.

## Database and authorization details

- [0001_draws.sql](./migrations/0001_draws.sql) creates events, draws, participant snapshots, encrypted assignments, uniqueness constraints, and a due-closure index. Timestamps use UTC epoch milliseconds.
- [0002_accounts_groups.sql](./migrations/0002_accounts_groups.sql) adds accounts, groups, memberships, indexes, and a nullable event group foreign key. Existing events retain `group_id = NULL`; membership-scoped queries do not expose them.
- Groups reference an owner account. Owner account deletion is restricted by a foreign key. Group deletion cascades through memberships, linked events, draws, and assignments. The full account/recipient deletion policy is still pending.
- Group creation also inserts owner membership in the same batch. The repository prevents removing the owner. This is not a claim that arbitrary direct SQL enforces every ownership invariant.
- Only the owner can add/remove members or create events through the current repository. `addMember` is internal provisioning intended to follow invitation acceptance; invitations do not exist yet.
- The mutation SQL checks ownership during the write. Unauthorized member addition/event creation raises `GroupAccessError`; member removal returns `false` when nothing can be removed. Uniqueness and foreign key errors propagate.
- `findRecipientForAccount` returns only the acting account's assignment while that account still belongs to the event's group. Revoking membership stops scoped reads and preserves the encrypted snapshot.
- `findRecipient`, `findByEvent`, and `save` remain internal low-level operations without caller authorization. `save` does not enforce closure timing or group eligibility. Future HTTP endpoints need authenticated application orchestration around them.
- Do not accept `actorAccountId` or a self-lookup account ID from unchecked browser input. `/api/me` derives its account ID from the stored session; group and event operations remain internal and are not yet connected to HTTP.
- [0003_sessions.sql](./migrations/0003_sessions.sql) adds sessions with account cascade deletion and indexes for account and expiry. Only hashes are persisted; raw session and CSRF tokens are never stored.
- Session expiry is absolute and inclusive at `expires_at_ms`. Internal issuance takes an explicit lifetime (minimum 1000 ms); public login uses `SESSION_TTL_SECONDS`, default 86400. Multiple device sessions are independent; logout revokes only the presented token.
- `issueForVerifiedAccount` requires an authenticated account identity from its trusted caller. Public login invokes it only after password verification. The method cannot itself prove email/phone ownership; HTTP never supplies its account ID directly. Refresh, idle timeout, bulk revocation, and expired-row cleanup are still pending.
- `/api/me` returns `{ account, csrfToken }`. Logout requires the session cookie, an exact configured HTTPS `Origin`, and the matching `X-CSRF-Token`. Cookie name: `__Host-tocaregalo_session`; flags: Secure, HttpOnly, SameSite=Lax, Path=/, no Domain. No CORS policy is enabled; the initial browser integration assumes a shared frontend/API origin.
- [0004_public_auth.sql](./migrations/0004_public_auth.sql) adds nullable `last_name`/`phone`, a unique non-null phone index, separate password credentials, and rate counters. Existing accounts remain credential-less and cannot be claimed by registering their existing email. Profile `displayName` stores the required first name; `lastName` and `phone` are null when omitted.
- `POST /api/register` accepts `{ email, password, name, lastName?, phone? }` and returns 201 with `{ account }`, without a session. Duplicate email/phone returns generic 409; registration can therefore reveal that some submitted identifier exists. `POST /api/login` accepts `{ identifier, password }`, returns the same 401 for missing accounts or wrong passwords, and on success returns `{ csrfToken }` plus the HttpOnly cookie. Account hashes and raw session tokens never appear in response JSON.
- Phone normalization requires `+` and up to 15 digits, strips spaces/parentheses/hyphens, and never guesses a country. It validates structure, not phone existence or ownership. Multiple absent phones are allowed.
- Both public auth routes require JSON and an exact trusted HTTPS `Origin`; they do not enable CORS. Non-POST is 405; wrong origin is 403; invalid fields/JSON is 400; unsupported content type is 415; oversized body is 413. Body size is enforced during streaming, not just from `Content-Length`.
- Rate windows last 15 minutes: 10 registrations/IP, 30 logins/IP, and 5 logins/normalized identifier. Successful attempts count too. Requests exceeding a counter receive 429 and `Retry-After: 900`. Cloudflare must set/overwrite `CF-Connecting-IP`; absent IPs share `unknown`. SHA-256 counter keys avoid raw identifiers at rest but do not provide dictionary-resistant anonymity. Cleanup deletes at most 100 old keys per counter operation; counter updates are atomic under contention.
- Password hashes use Argon2id v19, m=19456 KiB (19 MiB), t=2, p=1, a random 16-byte salt and 32-byte output. Encoded costs are fixed/validated rather than executed from arbitrary stored parameters. Unsupported hashes fail closed. The synchronous pure-JS KDF avoids concurrent KDF memory allocations per isolate but blocks request execution while hashing. Profile production CPU/load before deploying; budget Workers Paid rather than assuming the Free plan's 10 ms CPU allowance is sufficient. Local workerd success is not production performance validation.

## Local tools and commands

Node >=24 is required; tests use native TypeScript execution and `node:sqlite`. The user reported Node 24.22.2 and npm 11.19.1. In this workstation, Node was available at `/home/albertusko/.nvm/versions/node/v24.22.2/bin/node`, although the restricted agent PATH did not expose it. Executing outside the sandbox with the required tool permission worked. This is an environment observation, not a portable path requirement.

```sh
npm ci
npm test
npm run test:unit
npm run test:integration
npm run typecheck
npm run db:migrate:local
npm run dev
```

Inspect [package.json](./package.json) and [package-lock.json](./package-lock.json) for dependency versions. Miniflare is pinned to `5.20261118.0-beta`, matching the version used by Wrangler when introduced; tests use its official `convertV4MiniflareOptions` adapter. Argon2id uses the production dependency `@noble/hashes` pinned to `2.4.0`. Check compatibility before upgrading these tools.

[wrangler.jsonc](./wrangler.jsonc) binds `DB` to `tocaregalo-local` with a placeholder UUID and disables `workers_dev`. It is local development configuration, not a production resource declaration. Worker secrets, a real D1 resource ID, and remote deployment setup are still needed.

`APP_ORIGIN` is configured locally as `https://localhost:8787`; replace it for other origins. It must be a canonical HTTPS origin without path or trailing slash. Browser cookie testing requires HTTPS, for example `npm run dev -- --local-protocol https`. Missing/invalid origin configuration fails closed for registration/login and authenticated logout (503). `SESSION_TTL_SECONDS` is locally `86400` and must be a positive safe integer whose millisecond value is also safe. The API is usable with a synthetic account; a browser frontend has not been built yet.

## Validation evidence and limitations

After the approved documentation/refactor changes on 2026-11-19, the complete suite had **17 passing tests**, both TypeScript configurations passed, and the editor reported no diagnostics. `git diff --check` also passed. No behavior or migration changes were made in this refactor. Both migrations had previously been applied successfully with Wrangler locally, and a prior Worker packaging dry run passed. Rerun the relevant checks for subsequent source changes rather than treating these historical results as current validation.

The approved session-foundation task subsequently reached **24 passing tests**, passed both TypeScript configurations and `git diff --check`, and produced no editor diagnostics. A Worker packaging dry run passed, and a smoke check of that bundle in workerd with ephemeral D1 verified health, authenticated identity, logout, and rejection after revocation. The third migration was applied successfully with Wrangler locally. The tests use internal issuance with synthetic accounts; they do not verify a public login or real email delivery. No remote resources were modified.

After the public registration/password-login task, the full suite reached **36 passing tests**. Both TypeScript configurations and `git diff --check` passed, with no editor diagnostics. The fourth migration applied successfully to persistent local D1. The new integration test bundles the real Worker and verifies Argon2id/password login inside workerd, including rollback and concurrent counter enforcement. Installing the pinned dependency reported zero known vulnerabilities at that time. No remote deployment, remote migration, contact verification, production CPU profile, or real email/SMS delivery was performed.

- [domain.test.ts](./tests/domain.test.ts) covers assignment invariants, enumeration of shuffle outcomes, fixed-point rejection, closure boundaries, and retry timing.
- [recipient-protection.test.ts](./tests/recipient-protection.test.ts) covers authenticated scope, tampering, key rotation, and HMAC index behavior.
- [persistence.test.ts](./tests/persistence.test.ts) executes repository SQL against SQLite and checks encryption, duplicate protection, constraints, cascades, and rollback.
- [d1.integration.test.ts](./tests/d1.integration.test.ts) uses ephemeral Miniflare/workerd D1 bindings, checks BLOB conversion and batch rollback, upgrades existing data, and tests account/group permissions and revoked membership.
- [session.test.ts](./tests/session.test.ts) covers token/CSRF separation and secure cookie parsing/attributes. [sessions.integration.test.ts](./tests/sessions.integration.test.ts) exercises D1-backed issuance, expiry boundaries, revocation, account isolation, HTTP behavior, origin/CSRF rejection, and account-deletion cascades.
- [authentication.test.ts](./tests/authentication.test.ts) covers input normalization, six-character-only policy, long/space/Unicode passwords, independent salts, and exact password verification. [auth.integration.test.ts](./tests/auth.integration.test.ts) builds the actual Worker with a Wrangler dry run, starts it in workerd, and tests real Argon2id register/login, email/phone access, me/logout, throttling, malformed/oversized requests, concurrent duplicates, and rollback. It uses temporary output and ephemeral D1, not persistent dev or remote resources.
- The integration migration loader currently splits plain DDL at semicolons. Before adding migrations containing triggers or embedded semicolons, replace it with a suitable migration loader; do not assume it is a general SQL parser.
- Local D1 validation does not establish remote D1 behavior, production latency, or unattended processing. No remote deployment or remote migration has been performed by the agent in this work.

## Open work and next recommended step

1. Plan contact ownership verification and password recovery according to the product specification. Public password registration/login are implemented, but contacts are unverified and no recovery path exists. Confirm the eventual frontend/API origin topology, and profile Argon2id with the intended Cloudflare plan before publishing.
2. Connect authorized application use cases to HTTP routes. Add invitation acceptance and membership lifecycle behavior according to the product specification.
3. Coordinate event eligibility, closure, and idempotent draw creation atomically under concurrent requests. The existing repository alone is not a complete closing service.
4. Integrate SendGrid and persist delivery state, retries, and idempotency. Only retry timing helpers exist today.
5. Implement unattended closing/retries. Measure the 60-second target from the scheduled closure in a published environment without browser traffic. If Sites cannot provide the required scheduler behavior, evaluate an external scheduler invoking an authenticated idempotent endpoint.
6. Build the approved Vue/Bootstrap interface, finalize deletion/key-management policy, configure real resources and secrets, and validate publication.

Scalability review still needs actual product limits: draw saving currently encrypts all assignments concurrently and builds `1 + 2N` statements in one batch. Preserve draw atomicity when introducing bounds or revising that design; do not invent a participant limit during an unrelated refactor.

## Resume checklist

- Re-read current Git state; branch names and uncommitted work are not reliably conveyed by this document. Never infer that a local change was committed or merged from a handoff alone.
- Inspect relevant code/tests, present the next plan, and wait for approval. The recommendations above are not authorization to implement them.
- Update this memory with verified outcomes after approved work. Keep secrets, tokens, clear-text assignments, and real user data out of documentation.
