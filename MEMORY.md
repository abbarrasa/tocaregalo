# TocaRegalo project memory

Last reviewed: 2026-11-19. This is a handoff, not an implementation approval or a substitute for inspecting the repository. Start with [AGENTS.md](./AGENTS.md), [README.md](./README.md), `git status --short --branch`, and the current code and tests.

## Scope and decisions

- This repository is `abbarrasa/tocaregalo-sites`, an independent implementation for ChatGPT Sites. Symfony lives in a different repository.
- Target stack: Vue + Bootstrap, a TypeScript API on Cloudflare Workers, Cloudflare D1, and SendGrid HTTPS. Vue, Bootstrap, and SendGrid are not yet wired into this codebase.
- The published URL is intended to be public. The application must perform its own authentication and authorization before granting access to account, group, event, or assignment data.
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
| Account persistence | [accounts-repository.ts](./src/persistence/accounts-repository.ts) | Internal provisioning, unique trimmed/lowercased email, display name, and self lookup by trusted account ID. No credentials or email verification. |
| Group persistence | [groups-repository.ts](./src/persistence/groups-repository.ts) | Atomic group/owner membership creation, member-scoped reads, owner-only membership mutations and event creation. |
| HTTP entry point | [worker.ts](./src/worker.ts) | Only `GET /health` returns JSON; all other requests return 404. No authenticated routes yet. |

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
- Do not accept `actorAccountId` or a self-lookup account ID from unchecked browser input. No session mechanism currently supplies a verified identity.

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

Inspect [package.json](./package.json) and [package-lock.json](./package-lock.json) for dependency versions. Miniflare is pinned to `5.20261118.0-beta`, matching the version used by Wrangler when introduced; tests use its official `convertV4MiniflareOptions` adapter. Check compatibility before upgrading either tool.

[wrangler.jsonc](./wrangler.jsonc) binds `DB` to `tocaregalo-local` with a placeholder UUID and disables `workers_dev`. It is local development configuration, not a production resource declaration. Worker secrets, a real D1 resource ID, and remote deployment setup are still needed.

## Validation evidence and limitations

After the approved documentation/refactor changes on 2026-11-19, the complete suite had **17 passing tests**, both TypeScript configurations passed, and the editor reported no diagnostics. `git diff --check` also passed. No behavior or migration changes were made in this refactor. Both migrations had previously been applied successfully with Wrangler locally, and a prior Worker packaging dry run passed. Rerun the relevant checks for subsequent source changes rather than treating these historical results as current validation.

- [domain.test.ts](./tests/domain.test.ts) covers assignment invariants, enumeration of shuffle outcomes, fixed-point rejection, closure boundaries, and retry timing.
- [recipient-protection.test.ts](./tests/recipient-protection.test.ts) covers authenticated scope, tampering, key rotation, and HMAC index behavior.
- [persistence.test.ts](./tests/persistence.test.ts) executes repository SQL against SQLite and checks encryption, duplicate protection, constraints, cascades, and rollback.
- [d1.integration.test.ts](./tests/d1.integration.test.ts) uses ephemeral Miniflare/workerd D1 bindings, checks BLOB conversion and batch rollback, upgrades existing data, and tests account/group permissions and revoked membership.
- The integration migration loader currently splits plain DDL at semicolons. Before adding migrations containing triggers or embedded semicolons, replace it with a suitable migration loader; do not assume it is a general SQL parser.
- Local D1 validation does not establish remote D1 behavior, production latency, or unattended processing. No remote deployment or remote migration has been performed by the agent in this work.

## Open work and next recommended step

1. Plan authentication and sessions, including email ownership verification, expiry/revocation, and HTTP protection. Obtain approval before choosing or implementing an authentication scheme.
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
