# Instructions for AI agents

These instructions apply to the entire repository. Read this file, [MEMORY.md](./MEMORY.md), [README.md](./README.md), and the relevant code and tests before proposing changes. Current user instructions take precedence. Treat memory as a dated handoff and verify it against the working tree.

## Plan before implementation

1. Inspect the current state using read-only operations. Identify the task, affected components, existing behavior, risks, and relevant tests.
2. Present a concrete plan describing the proposed files and changes, validation, and any unresolved decisions.
3. Wait for explicit user approval before implementing the plan, including writing documentation, changing dependencies, or applying migrations. Approval of a plan covers its stated scope; do not ask again for each routine step. Environment permission prompts may still be necessary.
4. Implement the approved plan. If a material scope change is needed, explain it and obtain approval for the revised plan before implementing that change.
5. Validate the result, review the diff, update the handoff, and report the outcome and final Git state. Do not describe planned or untested behavior as complete.

Read-only inspection and planning may proceed before approval. A request to continue is not approval of an implementation plan that has not yet been presented. Do not repeat an already approved plan when resuming the same task.

## Required Git workflow

- Before changing branches, run `git status --short --branch` and inspect the local branches. Preserve all pre-existing tracked and untracked changes.
- For each new implementation task, create and switch to an English branch named `feature/<short-description-in-kebab-case>` starting at the current commit of local `dev`, for example `git switch -c feature/session-authentication dev`.
- Use local `dev` as it stands; do not silently update it from a remote. Verify the source branch exists and the target name is available.
- Uncommitted changes may carry across only when the switch is safe. If the switch would overwrite or conflict with local work, stop and explain the exact conflicting files and branch state. Do not discard or temporarily hide work to proceed.
- Do not run `reset`, `restore`, `clean`, `stash`, `commit`, `amend`, `rebase`, `merge`, `force-push`, or `push` unless explicitly requested. This workflow does not authorize commits or pushes.
- At completion, run `git status` and report the branch, modified/untracked files, and any pre-existing changes. Do not stage files unless requested.
- [The PR workflow](./.github/workflows/create-pr.yml) can create a PR to `dev` after an eligible push. Its existence does not authorize an agent to push or to claim a PR was created locally.

## Project boundaries

- Repository: `abbarrasa/tocaregalo-sites`, the independent ChatGPT Sites implementation of TocaRegalo. The Symfony application is in another repository; do not introduce Symfony/PHP assumptions here.
- Target stack: Vue and Bootstrap for the frontend, a TypeScript Cloudflare Worker API, D1 persistence, and SendGrid over HTTPS for email. The frontend is not implemented yet. A SendGrid verification-email adapter exists; real delivery has not been tested.
- Product references are the TocaRegalo v1.2 functional specification and the approved visual prototype. They are mentioned in the README but are not included in this repository. Do not invent their contents; obtain the relevant requirements when a decision depends on them.
- Keep HTTP, application orchestration, domain rules, and persistence responsibilities distinct. The Worker exposes health, public registration/login, authenticated account reads/logout, email-verification and password-recovery routes, authenticated group creation/list/detail, and event creation/list/detail. Public login checks a password before internal session issuance.

## Clean Code and SOLID

- Prefer clear English names, small cohesive functions, explicit inputs and outputs, and comments that explain constraints or decisions. Preserve existing public behavior during refactors.
- Keep pure validation and business rules in [the domain layer](./src/domain/). Do not make one repository import another repository just to reuse validation or shared data structures.
- Apply single responsibility: transport handles HTTP, application services coordinate use cases, domain functions express business rules, and repositories handle persistence. Introduce services as real use cases require them, not as empty scaffolding.
- Apply dependency inversion and interface segregation: depend on small structural contracts such as [PersistenceDatabase](./src/persistence/d1.ts), with dependencies supplied explicitly. Avoid global service locators and concrete infrastructure dependencies in domain logic.
- Extend behavior through composition and focused contracts. Keep implementations substitutable by honoring their documented return values, errors, atomicity, and authorization semantics.
- Use strict TypeScript and explicit null/error handling. Avoid `any`, unchecked casts, broad exception swallowing, speculative abstractions, and inheritance added merely to satisfy a pattern.
- Use the existing ESM style with explicit `.ts` imports and erasable TypeScript syntax. Node executes the test files directly; do not introduce constructs that require an unconfigured transpilation step.

## Scalability and persistence

- Design for a stateless Worker. Do not use process memory as durable storage or as a reliable lock across requests.
- Use parameterized SQL, database constraints, appropriate indexes, and transactional D1 batches for related writes. Keep authorization predicates in the same SQL operation as the protected mutation where possible.
- Preserve atomicity and idempotency under concurrent requests. Never replace an existing draw during a retry or treat every database error as a duplicate.
- Consider query count, result size, bound parameters, batch size, CPU, memory, and concurrency when extending a use case. Verify current Cloudflare limits before depending on them. Add pagination and bounded work when introducing collection APIs or background processing.
- The current draw save prepares `1 + 2N` statements and encrypts all assignments concurrently. Do not claim unlimited participant capacity. Any change to bound or split that work must preserve complete-draw atomicity and receive approval if it changes product limits.
- Add forward migrations in [migrations](./migrations/); do not rewrite migrations that may already have been applied. Test upgrades with existing data, not only fresh databases.
- Distinguish SQLite tests, local D1/workerd integration, and remote D1 verification. Passing one does not establish all three.

## Domain and privacy invariants

- A draw includes every participant, including the owner, requires at least three distinct participants, gives each person one recipient, and forbids self-assignment. Preserve uniform sampling over valid permutations.
- Use Web Crypto for randomness and cryptography. Recipient envelopes use AES-GCM authenticated to the key ID, draw, and giver; the HMAC index is draw-scoped. Preserve those bindings and key rotation behavior.
- Keep encryption keys and SendGrid credentials in Worker secrets, never in D1, source code, test fixtures with real data, memory documents, or logs. Do not log clear-text assignments or authentication tokens.
- Account provisioning is not authentication or email verification. All acting account IDs must come from a verified session before exposing repository operations through HTTP.
- Public registration requires email, password, and name; surname and phone are optional. Login accepts email or international phone plus password. The user explicitly requires only a minimum of six Unicode characters for passwords: do not introduce a password-specific maximum, composition rules, trimming, normalization, or silent truncation.
- Password authentication does not prove email or phone ownership. Store only salted Argon2id hashes in the separate credential table; never expose hashes in account responses.
- Email verification is available through authenticated/CSRF-protected requests and token-based confirmation. Login remains allowed before verification. Only the stored account email may receive a challenge; never accept a recipient or account ID override from the browser. Tokens are single-use, hashed at rest, expiring, and replaced by reissue. Verification consumption and account marking must stay atomic. Phone verification remains pending.
- Password recovery accepts email or phone but sends only to the stored email of an account with a password credential, including unverified accounts. It does not provision legacy credentials, verify email, or log the user in. Recovery tokens have a separate hash domain, one current token/account and a 30-minute configurable lifetime. Consumption, password update and revocation of all sessions must remain atomic. Public login must condition session issuance on the credential it verified, so a concurrent reset cannot leave a session issued from an old password. Requests return generic 202 responses and use bounded `waitUntil` work, not a durable email queue; delivery failures must not reveal account existence.
- The current membership policy permits only the owner to invite/manage members and create events; the owner cannot be removed through the repository. Public membership addition requires explicit invitation acceptance; the old `addMember` operation remains trusted internal provisioning only.
- Group HTTP operations derive the actor from the session. Creation requires exact Origin and session CSRF, generates IDs/timestamps server-side, and adds owner membership atomically. Detail reads hide missing/inaccessible groups behind the same 404. Lists filter current membership in SQL and use ID-based keyset pagination (default 20, maximum 50 plus one lookahead row); cursors never grant access. Invitation and member-management HTTP operations are exposed within their scoped policies below.
- Invitations are owner-issued to a normalized email, expire after seven days, and replace any previous token for that group/email on reissue. Require session, exact Origin and CSRF for request and acceptance. Acceptance must match the current account email and consume the hashed, purpose-separated token in the same D1 batch as membership insertion. Tokens are single-use, including after membership removal, and never confer an unchecked account identity. Existing members are not duplicated. Invitation acceptance does not verify email or issue sessions. Keep current-owner validation in issuance and consumption SQL. Limit requests to five/group/email and thirty/owner per fifteen minutes; non-owners must not consume the group's recipient quota. SendGrid delivery is synchronous and simulated in tests, with conditional failed-send invalidation, not durable retries.
- Invitation administration is owner-only. Lists order by normalized email with keyset pages (default 20, maximum 50 plus one lookahead row) and expose only email, dates and pending/expired/accepted state, never token hashes or consumption markers. Revocation requires Origin/CSRF and deletes only an active unconsumed invitation for the target email. It is idempotent for absent, expired or consumed rows and never removes memberships. Keep ownership and mutation predicates in SQL within the authorization transaction. Acceptance/revocation/reissue serialize through D1; an issuance after completed revocation creates a usable new invitation. Lists show the current row per group/email, not a delivery log or invitation history.
- Event HTTP creation requires an owner session, exact Origin and session CSRF. Accept only the current minimal model: explicit `closureAtMs` set to null or a safe integer strictly after the server creation timestamp. Generate event ID/time server-side and take group ID from the route. Keep the owner predicate in the insertion SQL. Detail reads require current membership, with the same 404 for missing/inaccessible events; legacy unlinked events stay inaccessible. Creation/detail do not run draws, schedule closure, deliver email or establish additional event attributes/lifecycle rules.
- Event creation time comes from the server clock at creation and is immutable. Preserve historical values; the D1 trigger rejects changes to `created_at_ms`. There is no public update endpoint. Keep future event-edit operations from changing this field.
- Event lists are scoped to one group and current membership in the same SQL statement. Order by creation time descending, then ID descending for ties, supported by `(group_id, created_at_ms DESC, id DESC)`. Use keyset pagination (default 20, maximum 50 plus one lookahead row) with a versioned creation-time/ID cursor. Old ID-only event cursors are invalid and must restart pagination. Return 200 with an empty list for an authorized empty/exhausted page, and the same 404 for missing/inaccessible groups. Cursors never authorize access or require the referenced event to exist. Group lists keep their existing ID order/cursors. Pagination is not a snapshot across requests.
- Use the membership-scoped assignment query for the future participant API. The low-level draw methods do not authorize callers. Do not expose them directly as endpoints.
- Removing membership revokes scoped reads but preserves encrypted draw snapshots. Legacy events with no group remain inaccessible through membership-scoped queries. Do not silently assign ownership to old data.
- Member lists require current membership, order by account ID with bounded keyset pagination (default 20, maximum 50 plus one lookahead), and expose only accountId, displayName, joinedAtMs and isOwner. Never include contact details or credentials. HTTP removal is owner-only with exact Origin and session CSRF, protects the owner (409), and is idempotent for absent members. In one D1 batch, cancel active unconsumed invitations to the target account's stored email and remove membership, with ownership predicates in each protected mutation. Cancellation also covers absent membership to serialize safely against acceptance. Preserve expired/consumed invitation records and encrypted draws. Later invitations may re-enroll a removed account; sessions and unrelated groups are unaffected. Use MembersRepository for public removal; the old GroupsRepository.removeMember is an internal low-level operation without invitation cancellation.
- Closure is inclusive at its timestamp; the target processing delay is at most 60 seconds. Delivery retries stop after six failed attempts. Timing helpers alone do not implement scheduling or delivery.

## Validation and environment

Use Node 24 or later and the commands in [package.json](./package.json):

```sh
npm ci
npm run test:unit
npm run test:integration
npm run typecheck
git diff --check
```

`npm test` runs the complete suite. Use meaningful regression tests for changed behavior, security boundaries, rollback, and concurrency; a mechanical refactor can rely on the relevant existing suite. Do not add tests that only mirror implementation details.

- Node and Worker types are checked separately by [tsconfig.json](./tsconfig.json) and [tsconfig.worker.json](./tsconfig.worker.json). Both must pass for shared source changes.
- Miniflare starts workerd and may need permissions unavailable in a restricted sandbox. Report environment failures accurately; do not skip failing tests and claim success.
- If Node is missing from the agent PATH, locate the user's existing installation rather than installing a second runtime. See the environment notes in [MEMORY.md](./MEMORY.md). Request tool escalation when required; do not bypass sandbox restrictions.
- `npm run db:migrate:local` applies migrations to persistent local development state. The integration tests use separate ephemeral databases. Apply migrations only within approved scope.
- [wrangler.jsonc](./wrangler.jsonc) contains a local placeholder D1 ID. Do not deploy or modify remote resources unless the approved task includes that work. Never claim a dry run deployed anything.

## Handoff maintenance

Keep this file focused on durable working rules. Update [MEMORY.md](./MEMORY.md) after approved work with verified state, decisions, validation results, limitations, and the next recommended step. Mark historical results and open questions clearly. Do not store secrets, assume remembered branch names are current, or turn suggestions into approved requirements.
