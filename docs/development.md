# Development operations

T7 exposes the installed foundation through POSIX shell entrypoints. Run from any working directory. Required host tools: Docker with Compose (2.24.4 or newer for existing overrides), Git, POSIX sh and Perl with JSON::PP for static task validation. PHP, Composer, Node and browsers run in existing containers. No wrapper installs dependencies, pulls/builds images or resets volumes. Tool images are the previously built `tocaregalo-php:dev` and `tocaregalo-node:dev`; the browser image remains digest-pinned in [verification Compose](../compose.verification.yaml).

## Commands

| Command | Responsibility |
| --- | --- |
| `scripts/dev --help`, `scripts/check --help` | Spanish usage, no daemon access. |
| `scripts/dev build` / `scripts/check build` | Compile frontend assets; never build Docker images. |
| `scripts/dev up` | Existing development Nginx/PHP/MySQL/frontend and Mailpit; no implicit workers. No assignment-key dependency until the crypto consumer is implemented. |
| `scripts/dev verify` | Main graph in fixed tocaregalo-startup project, tmpfs MySQL, loopback 8083/8028, read-only DB and Chromium desktop/mobile smoke; refuses existing development/verification resources. |
| `scripts/dev down` | Stop only the explicit `tocaregalo` development project; keep volumes. |
| `scripts/dev migrate`, `scripts/dev create-super-admin` | Read-only command discovery in an already running PHP service; delegate only if registered and attached to an interactive terminal. Currently unavailable; no runtime is started and no migrations/accounts are performed. |
| `scripts/check static` | Shell syntax, whitespace, secret ignore, Compose models, package JSON and VS Code task mappings, orchestration tests. |
| `scripts/check phpstan` | PHPStan fixed level 10 on all owned PHP/tests with existing configuration; no network/services. |
| `scripts/check backend [filter]` | Real isolated MySQL PHPUnit, explicitly excluding optional mail group. |
| `scripts/check mail [filter]` | Separate local Mailpit/MySQL fixture suite including mail tests. |
| `scripts/check frontend [file]` | Vitest with installed Node toolchain and no network/services. |
| `scripts/check e2e [project [file]]` | Four configured Playwright projects by default; optionally one allowlisted project and positional test file. |
| `scripts/check all` (or no argument) | Static → PHPStan → backend → mail → frontend → build → e2e, stop at first failure. Complete aggregate execution belongs to T8. |

Filters/files cannot begin with `-`; arbitrary tool options and Compose/DSN overrides are not accepted. Missing inputs, unavailable images and failed/empty suites fail visibly. VS Code **Run Task** exposes the same entrypoints with explicit workspace cwd and no automatic startup. Task JSON resolution checks do not demonstrate a GUI task launch.

## Configuration and isolation

Use only the ignored root `.env`, shared with Symfony through a read-only bind. Keep it mode 600; never print resolved Compose configuration or credentials into logs. See [.env.example](../.env.example) for required names and [README](../README.md) for Spanish setup notes. Existing dependency directories/images must already be present after a separately authorized installation. Wrappers refuse missing inputs rather than install them.

Development HTTP is loopback 8080 and Mailpit UI 8025 by default. Test browser HTTP is 8081; test Mailpit UI is 8026. MySQL and SMTP remain internal. Backend/browser use [T5 Compose](../compose.verification.yaml); mail uses [T6 Compose](../compose.mail-smoke.yaml), always explicit project `tocaregalo-test`. MySQL data is tmpfs. No wrapper targets the development database for tests.

Service-owning tests reject existing test containers/networks, take an exclusive ignored directory lock, and check the configured published loopback port before startup. A later port race is still possible: Docker reports startup failure and cleanup removes only this invocation's test project. Do not operate that reserved project manually while a wrapper runs. Success/failure/INT/TERM trigger scoped teardown without volume deletion; SIGKILL cannot be trapped. After a host crash, inspect remaining resources before manually removing the stale `backend/var/wrapper-test.lock`; never remove an active invocation's lock. Node/PHPStan use standalone `--rm` containers without network access, so they create no Compose network.

The PHP database fixture guard independently verifies the declared test URL/database and forbids development targets before connecting. Optional mail tests only accept the local SMTP service; existing T6 transient transport setup is confined to tmpfs. Recorder tests prove argument routing and failure handling only, not real DB/mail/browser correctness.

## Incomplete business operations and workers

Current browser content is the Spanish preparation shell, not a gift draw application. Migration configuration/schema and the interactive SUPERADMIN command are not yet implemented. Guarded wrappers currently fail if the PHP service or registered command is absent; discovery only lists commands and does not start services. No credentials are accepted as wrapper arguments.

Assignment keys are not provisioned. The [approved key policy](../specs/001-toca-regalo/plan.md#proposed-key-policy-for-approval) requires an explicitly authorized cryptographically random 32-byte master secret, independent labeled encryption/HMAC derivation, a versioned ring mounted read-only outside image/repository/database/log/frontend, and separately encrypted offline key backups. Restoration must be tested with a database copy. Retain versions needed by live envelopes or restorable backups; no arbitrary retention interval is established. Key-file schema/generator and rotation operations are future work: do not invent a JSON file or dummy key to bypass startup.

Worker profiles are opt-in. Restart workers after code changes; they share the PHP tool image. SIGTERM exits 143 were observed in T6; completion of in-flight business messages has not been demonstrated. Real scheduled closure is 004:T8, with independent immediate closure guards; the fixture probe is not deadline evidence.

## SMTP and outstanding limits

Deployment operators supply SMTP host, port, TLS mode, authentication user/password where required, and sender address/display name through environment/secret management. Development uses Mailpit, not external delivery. Do not request production credentials for local checks or commit real values. External delivery, recovery/assignment business email content and monitoring remain their respective future slices.

Historical audits report four moderate npm development advisories and abandoned doctrine/common, with zero PHP security advisories and zero npm production advisories at their recorded runs. The Composer license warning is also retained. See [dependency evidence](../specs/002-development-foundation/dependency-resolution.md) and [verification](../specs/002-development-foundation/verification.md); T7 does not silently refresh dependencies or claim new audit results.

## T8 verification snapshot

On 2026-11-17 the installed-image `scripts/check all` completed successfully: static/11 task mappings, PHPStan level 10, PHPUnit backend 23 tests/74 assertions, local mail harness 29/105, Vitest 12, frontend compilation and all 8 Playwright cases across four profiles. MySQL tmpfs/internal ports and loopback HTTP/Mailpit bindings were observed live. See [T8 evidence](../specs/002-development-foundation/verification.md#t8-execution-record). No image/dependency rebuild or fresh audit occurred. At T8, key-dependent development startup was blocked; application migrations, SUPERADMIN and real event closure remain unavailable; passing the aggregate is foundation evidence. Read-only SDD Validation/user acceptance remain pending.

## T10 main-graph verification

`scripts/dev verify` uses the shared main startup helper, explicit project `tocaregalo-startup` and [storage/address override](../compose.startup-verification.yaml). Only MySQL storage (tmpfs), loopback ports (8083/8028), development APP_ENV and matching public URL/frontend port differ. Model parity and effective DB target are checked privately before startup. Existing development/startup containers, networks or volumes, occupied ports and an active ignored `backend/var/startup-verification.lock` cause refusal. Inspection errors fail closed. This never starts workers, installs/builds/pulls, provisions keys or applies migrations.

Runtime checks assert MySQL health/tmpfs/internal ports, exact web/UI loopback bindings, main PHP read-only SELECT 1/UTC, bounded HTTP readiness and Chromium desktop/mobile cases. Scoped traps remove owned resources/lock without volume deletion; SIGKILL cannot be trapped. Persistent development-volume initialization is not claimed. The database name/credentials remain the supplied development values inside a separate temporary MySQL instance; model guards reject external/ambiguous targets. No private resolved model or environment snapshot is printed.

Current foundation services no longer mount/read unused assignment keys. The approved 005:T2 task must restore mandatory read-only key wiring and validate/fail closed before any encryption consumer is enabled. Existing key derivation/custody/backup/rotation requirements remain unchanged; no ring schema/material is introduced by T10.

## Identity persistence checks (003:T1)

Identity uses framework-independent domain models and external XML mappings of infrastructure records; no API resources are exposed for these records. The installed Doctrine migrations bundle is registered with the initial identity migration. Startup remains migration-free. T1 applies/reverses the actual migration only inside the invocation-owned guarded tmpfs test database. It does not migrate development or create real accounts.

The integration test validates the effective ORM connection against the guarded test connection before DDL. Each migration command boots a fresh kernel/factory, matching a real CLI invocation: executed migration instances are frozen by Doctrine and must not be reused in-process for reversal. MySQL DDL is explicitly nontransactional. Schema comparison is limited to users/roles/user_roles; transport and migration metadata tables are managed separately and are never dropped by a schema-update shortcut. Full owned-PHP analysis now includes migrations in addition to the previous paths.

The optional user surname value uses `lastName` in PHP, external Doctrine mapping and the initial users-table SQL column. Earlier naming revisions in verification records are historical. The initial identity migration has only been exercised in disposable test databases in this workflow; editing it does not rename columns in a persistent database that somebody has already migrated independently.

## Interactive SUPER ADMIN bootstrap

`app:user:create-super-admin` is a manual interactive operation after the target identity migrations have been applied. The command uses shared profile/email/password validation, Spanish prompts, hidden input without visible fallback and three attempts per question. It never accepts credentials through options, overwrites an existing user or adds verification state. Symfony's existing auto hasher receives the exact validated password. Missing role, new account and role association persist in one Doctrine transaction/flush; database uniqueness races abort with sanitized retry guidance.

The application bootstrap port and Doctrine adapter are separate from console interaction. Tests use the guarded temporary MySQL database, real migrations and bounded pseudo-terminal interaction; no real bootstrap is performed by checks or startup. Keep PHP `lastName` mapped to the current committed SQL `last_name` column. Command readiness does not imply login/session/API authorization readiness; those remain subsequent identity tasks. No production SMTP, keys or deployment is required by this command.

## Session JSON boundary

SecurityBundle uses a stateful lazy firewall, a Symfony infrastructure principal/provider and the existing Symfony-backed password verification port. The principal serializes only a stable user ID, never its profile or password hash; each subsequent request reloads the persisted user and roles. Role changes invalidate the previous authenticated token; a removed user cannot retain access. Domain models implement no Symfony interfaces.

GET /api/csrf initializes session-backed `session_mutation` CSRF state. POST /api/login accepts only JSON identifier/password and X-CSRF-Token, returns the own actor DTO and rotates the session ID. GET /api/me returns id, firstName, lastName, email, phone and persisted roles only. POST /api/logout checks CSRF, clears the security token, invalidates the session and expires TOCAREGALO_SESSION, returning 204. Error responses are JSON with Spanish text; no login redirect or public registration exists. Obtain a fresh CSRF token after session rotation/logout when needed; Symfony separates HTTP and HTTPS token namespaces.

The native session factory and installed PDO handler use DATABASE_URL. An explicit new migration owns sessions (binary ID/data, integer lifetime/time), independent of the identity ORM records. No request/startup auto-creation is configured. Cookie settings are HttpOnly, SameSite=Lax, path / and Secure=auto; local HTTP is supported, deployment requires HTTPS and verified proxy/TLS configuration. Framework lifetime defaults are retained. This task does not initialize persistent development sessions/schema or provide deployment TLS.

Session acceptance tests launch a bounded loopback PHP HTTP fixture against guarded tmpfs MySQL. Requests have native sessions and fresh kernel lifetimes, not BrowserKit file/mock storage. A test-only router permits simulated HTTPS cookie checks; that header is not implemented by the production entrypoint. Check real TLS/browser navigation separately in their authorized scopes. Logs are private temporary files and assertions inspect for credential leakage without printing transcripts. Migration reversal, role refresh, cross-session CSRF, old-cookie rejection and T1/T2 regressions remain in the backend suite.

## Own-account API and ordinary creation boundary (003:T4)

PATCH /api/me requires the authenticated session and its session_mutation X-CSRF-Token. Accept a nonempty JSON object containing a subset of firstName, lastName, email, phone and password. Omitted values are preserved; only lastName accepts null, and blank lastName normalizes to null. Password validation preserves whitespace and enforces the shared six-character/4096 UTF-8 byte policy. Return the own actor DTO on 200, 401 for anonymous requests, 403 for invalid CSRF and 422 with Spanish field-associated errors for invalid/unknown input or duplicate identifiers. Unexpected persistence failures remain sanitized 500 responses.

UpdateOwnAccount derives the target from the trusted session. DoctrineAccountStore locks and merges the current persisted account transactionally, preserving identity and roles. Database unique constraints remain authoritative; known email/phone race failures become field errors after rollback. Internal CreateOrdinaryUser assigns only ROLE_USER and atomically provisions that fixed role with the account. It has no public HTTP endpoint: authorized owner/group orchestration remains block 004. No schema or dependency change, current-password prompt or global session invalidation policy was added. See [T4 evidence](../specs/003-identity-access/verification.md#t4-completion).

## Recovery lifecycle boundary (003:T5)

RecoveryTokens issues 32-byte random URL-safe bearer tokens for an existing trusted account ID. Only their SHA-256 digest is stored in password_reset_requests. IssuedRecovery is sensitive in-memory handoff data, redacts debug output and refuses PHP/JSON serialization. No recovery HTTP route or token-returning API is introduced here; identifier lookup, durable email integration and public contracts remain T6, with forms in T7.

PASSWORD_RESET_TTL_SECONDS defaults to 3600 and must be a positive integer. Expiry is captured at issuance, so changing configuration affects newly issued links. An injectable clock checks now >= expiresAt as expired and timestamps issuance/consumption; persistence stores UTC microsecond instants. New issuance supersedes earlier requests. A consumed, superseded, unknown, malformed or expired token cannot change the password.

The DBAL adapter locks the user before reset records, re-reads the request under lock, and commits password plus consumption together. Issuance commits supersession plus the new request together. Invalid passwords leave the request unconsumed. The shared exact six-character/4096 UTF-8 byte policy and Symfony hashing apply; profile/roles are untouched. Account deletion cascades through reset records. A separate explicit migration creates the table; do not automatically apply it to development data. Email queue handoff must be integrated transactionally in T6 without persisting raw bearer material or introducing a second queue.

## Durable recovery API and worker (003:T6)

POST /api/password-recovery accepts exactly a string identifier (email or normalized international phone), CSRF and JSON; a valid request receives the same 202 acknowledgement for known/unknown accounts. POST /api/password-reset accepts exactly token/password, CSRF and JSON, returns 204 without login on success, or 422 associated field errors for invalid token/password. Infrastructure failures are sanitized 503, with no credential mutation on failed issuance/enqueue. Recovery links use trusted APP_PUBLIC_URL and a fragment token. The Vue integration is described below.

Apply the explicit delivery/transport migration before using recovery. Issuance, encrypted work and ID-only enqueue share the transaction; worker delivery uses synchronous Mailer and Messenger-owned retries. RECOVERY_DELIVERY_KEY stays private; setup commands do not provision a real key. The isolated identity check creates only its disposable synthetic key. See [security operations](./security-operations.md) for backup, replacement, retry and SMTP acceptance limits. Main development readiness requires separately authorized real key provisioning; disposable tests use independent synthetic keys.

## Identity screens and isolated browser verification (003:T7)

The Vue entrypoint redirects through the session guard to /login or the authenticated /dashboard shell. Login and recovery select an email or international phone identifier; reset consumes the trusted email fragment into memory and immediately removes it from URL/history. Actor, CSRF, password and bearer data are not persisted in browser storage. The panel explicitly marks groups/events as pending. Account editing remains T8.

The installed vue-tel-input 9.9.2 selects a default country even with automatic discovery disabled and its character filter accepts formatting signs. T7 therefore uses the approved local Vue phone directive/wrapper: digits and one initial plus, paste/caret/composition handling, no country inference or national validation, no network discovery. No dependency was added or removed.

Run `scripts/check identity` for the real identity graph across all four configured profiles, or `scripts/check identity chromium-desktop`. It adds the isolated identity overlay to the guarded foundation model, explicitly migrates/seeds only tmpfs test MySQL, starts Mailpit and the real notification worker, and uses actual captured links. The browser shares the isolated Nginx network namespace so the trusted localhost email URL works verbatim. No fixture HTTP endpoint is exposed. A test-only CLI control process accepts reset/expire commands through a private owned directory and checks the test database before SQL.

One disposable synthetic recovery key is generated in an invocation-owned 0700 temporary directory with a 0600 env file, injected only into PHP services. The browser mounts only the control subdirectory, never the env file. Traps remove owned services/network, test lock and temporary material; pre-existing test resources are refused. Trace/video/screenshots are disabled for identity cases. This selector is separate from the existing foundation `all` aggregate. Main development still needs separately authorized migrations, accounts and real recovery-key provisioning; this harness does not initialize them.

Identity verification limits PHP-FPM to one child using a fixture-only pool configuration; the main service configuration is unchanged. Worker/control processes stop after at most 1800 seconds. Identity browser cases have a 120-second case bound, 30-second assertion bound and stop after the first failure; functional expectations and zero retries remain unchanged. The installed Playwright page-copy snapshot hook is disabled with PLAYWRIGHT_NO_COPY_PROMPT, in addition to trace/video/screenshots being off. Credential-fill/navigation failures are sanitized and fixed disposable credentials are kept out of reported spec source. No test artifact should contain bearer material or credential values.

The plain `scripts/check e2e` foundation model intentionally applies no identity/session migrations. Its home-return smoke therefore expects the explicit session-service error/retry state and no actor, rather than pretending that an unavailable session store proves anonymity. The migrated identity selector separately requires anonymous-to-login redirection and all actual identity flows. Both modes retain the same JSON/private-path, keyboard and responsive checks.

## Own-account screen (003:T8)

The protected /account route revalidates the own actor through the existing guard. Separate profile/password forms use PATCH /api/me with a fresh session-bound CSRF token. Profile payloads contain only changed allowed keys, with lastName: null for cleared surnames; untouched fields/password are omitted. Canonical responses refresh the saved profile and own session actor. Password-only saves preserve unrelated profile drafts and clear password references after requests/route exit. Generation checks ignore stale update results/errors after logout/new session operations; a current 401 clears actor state and redirects without replay. No new product backend contract, role editor or deletion UI exists.

Browser fixtures capture seeded account IDs once at guarded control startup and restore canonical synthetic profiles/passwords before each case, so identifier edits do not contaminate T7 recovery/login regressions. No fixture endpoint is public. Reuse the existing isolated identity graph/private disposable key and browser artifact restrictions. Production schema, dependencies and real development data/keys are unchanged.
