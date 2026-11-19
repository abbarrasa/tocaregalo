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
- Keep HTTP, application orchestration, domain rules, and persistence responsibilities distinct. The Worker exposes health, public registration/login, authenticated account reads/logout, and email-verification request/confirmation routes. Public login checks a password before internal session issuance.

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
- Email verification is available through authenticated/CSRF-protected requests and token-based confirmation. Login remains allowed before verification. Only the stored account email may receive a challenge; never accept a recipient or account ID override from the browser. Tokens are single-use, hashed at rest, expiring, and replaced by reissue. Verification consumption and account marking must stay atomic. Phone verification and password recovery remain pending.
- The current membership policy permits only the owner to manage members and create events; the owner cannot be removed through the repository. Member addition is internal provisioning pending an invitation flow.
- Use the membership-scoped assignment query for the future participant API. The low-level draw methods do not authorize callers. Do not expose them directly as endpoints.
- Removing membership revokes scoped reads but preserves encrypted draw snapshots. Legacy events with no group remain inaccessible through membership-scoped queries. Do not silently assign ownership to old data.
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
