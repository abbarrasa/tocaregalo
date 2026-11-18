# Spec 003 verification evidence

## T1 — In progress

Date: 2026-11-17. [Execution plan v0.1](./t1-execution-plan.md) approved with “Apruebo el plan”; implementation/temp-MySQL checks separately authorized with “Autorizo implementar T1 y ejecutar las comprobaciones previstas con MySQL temporal”. Branch `feature/003_T01-user-values-persistence` created from current local dev, preserving proposed-plan/MEMORY edits. No installation, dependency/image update, keys, real user, development DDL, SMTP, commit or push.

Scope supports backend FR-3/4 (AC-3/4), NFR-1/10, not complete block/product acceptance. Domain profile normalizes text/phone and derives email comparison without Doctrine/Symfony; framework email validation and password hashing are infrastructure adapters. External XML mappings target separate infrastructure records and repository ports. Initial migration owns only users/roles/user_roles; no verification flag, public endpoint, group/authentication/bootstrap/recovery behavior added.

### Executed findings and corrections

- Test-first `vendor/bin/phpunit tests/Unit/User` in installed network-disabled PHP container: initial 17 tests failed because the new classes were absent (8 errors/9 expected-exception failures), establishing the missing implementation. After implementation one test incorrectly assumed Symfony's default email constraint accepted an accented local part. Corrected that assumption: valid ASCII email exercises Symfony; pure comparison and binary DB collation tests preserve accent distinctions without changing email validation policy.
- Initial full backend execution: 44 tests/144 assertions, three errors from reusing Doctrine's frozen migration instance across up/down commands; later duplicate fixture errors followed the failed teardown. Dedicated tmpfs runtime was removed. Integration migration commands now use a fresh kernel/factory, no changes to vendor code.
- Initial analysis with new integration test: eight level-10 errors at service/mixed DB result boundaries and redundant nullsafe access. Added runtime service/result narrowing and explicit loaded-user assertion, without baseline/scope reduction. Subsequent level-10 run passed.
- A stronger ORM/DDL comparison found identity index-name drift and infrastructure-owned schema differences. Migration index names now match the actual installed ORM; comparison explicitly targets only the three identity-owned tables. No Messenger/migration metadata is created/dropped through an ORM schema-update shortcut. DDL executes only through the real migration and guarded test target.

### Pending clarification

The minimum-only domain password policy and Symfony hashing must be reconciled for inputs beyond Symfony's inherited 4096-byte safety limit. A focused question has been sent; no new application maximum, custom hash or policy change is approved. Task completion remains pending that decision and final checks. The user-facing composition rule is otherwise unchanged, including exact whitespace/Unicode character preservation and no category combination requirement.

### Latest successful checks and remaining decision

- Final backend rerun `scripts/check backend`: **45 tests / 175 assertions passed**, PHPUnit 12.5.44 / PHP 8.5.12. Actual migration up/down/up succeeded in guarded tmpfs MySQL; identity-owned ORM/table comparisons have zero ALTER statements; persisted user/role roundtrip, nullable surnames, Symfony hash verification, normalized unique email/phone, role/user-role uniqueness and existing JSON/database boundary regressions passed.
- Actual information_schema assertions verify every mapped textual user column is VARCHAR(255), surnames nullable, email_comparison collation `utf8mb4_bin`; comparison preserves accent distinctions. Identity unique index names match installed ORM generation. No SQLite substitute or schema-update operation used.
- Latest `scripts/check phpstan`: zero errors at fixed level 10, including `migrations` and all previous owned-PHP/test paths, no baseline. Dependency manifests/locks unchanged. No stronger password category policy, verification flag, public endpoint or real account introduced.
- Installed network-disabled PHP tool: **35 PHP syntax checks**, successful `lint:container --env=test` and **11 YAML files** passed `lint:yaml config --env=test`. No database connection to development occurred in these checks.
- A synthetic 4097-byte input passed the approved minimum-only domain rule but Symfony's current hasher threw InvalidPasswordException, confirming its built-in 4096-byte safety boundary. No password/hash was printed. A focused user question remains pending; task is **not complete** despite passing other checks. No user approval of that boundary or custom workaround is inferred.

Next action: resolve the password-boundary clarification through the applicable SDD approval process before completing T1 or adding a new policy/algorithm adapter. Do not begin T2. Current implemented hashing uses Symfony auto as planned; its technical guard is documented, not silently recast as an approved product constraint.

### Approved boundary resumption — 2026-11-17

Supersedes the pending-decision statements above: user accepted Symfony's limit, approved parent Spec 001 v1.2, affected plans and task lists, then stated “Apruebo las listas y autorizo reanudar 003:T1”. Execution follows approved T1 plan v0.2 and unchanged temporary-MySQL limits.

Test-first boundary check: initial standalone invocation lacked the private root dotenv mount and exited 2 in bootstrap, without running tests; corrected the invocation, not application configuration. The corrected network-disabled installed PHP run executed 8 boundary tests/16 assertions with four expected failures: the pure policy accepted 4097 bytes and Symfony raised its own exception instead of the shared policy's validation exception. ASCII/multibyte 4096-byte hashing and exact verification already passed. All inputs were synthetic fixtures.

Implemented a framework-independent `strlen` byte guard after the existing UTF-8/six-character minimum validation. Inputs above 4096 bytes raise a Spanish validation error before invoking Symfony hashing; preserve exact bytes, whitespace and existing auto hashing. No truncation, custom hash, dependency or schema change. The new tests cover both ASCII and multibyte 4096/4097-byte inputs, whitespace preservation and correct/incorrect verification at the accepted boundary. Consumer account/API/command/recovery no-mutation behavior remains later-task scope; T1 adds no public operation.

### T1 completion

- `scripts/check backend`: exit 0, **53 tests/191 assertions**, PHPUnit 12.5.44 / PHP 8.5.12. Includes all eight boundary cases and existing guarded real-MySQL migration reversal/schema/uniqueness/roundtrip and JSON/database regressions. MySQL uses only owned tmpfs test storage; no development DDL/accounts.
- `scripts/check phpstan`: exit 0, **zero errors at fixed level 10**, full owned PHP including tests and migrations, no baseline/exclusions added.
- Network-disabled installed PHP container: **36 PHP syntax checks**, `lint:container --env=test` success and **11 YAML files** valid. Editor diagnostics report no errors for backend source/tests/migrations.
- `git diff --check` passed. Manifests/locks unchanged. Private root dotenv remains ignored/untracked and mode 600; no credentials or hash output. No installation, image build/pull, keys, real SMTP, commit or push.
- Backend wrapper exit 0 removed owned MySQL/container network. Independent `docker ps` and network label queries returned no owned test resources; wrapper lock absent.

T1 is complete for its approved backend-support scope (FR-3/4, AC-3/4 backend portions, NFR-1/10). Full frontend prevention, account creation/changes/recovery/bootstrap/auth flows and block Validation remain pending their own tasks. Project: 56 tasks total, 11 complete, 45 pending. Stop before T2; on user continuation prepare/present T2 execution plan and await explicit approval/implementation authorization.

## T1 naming revision — 2026-11-18

Approved [lastname execution plan v0.1](./lastname-rename-execution-plan.md) with “apruebo el plan y autorizo la implementación”. Renamed PHP property/parameters/normalizer and all existing consumers from `surnames` to exactly `lastname`; updated existing unit/integration references. External UserRecord mapping explicitly retains SQL `column="surnames"`; migration unchanged. This is a behavior-preserving naming change under existing FR-3, not a new product requirement or T2 implementation. Per plan, reused existing behavioral tests instead of introducing a test for identifier spelling.

Naming revision results: `scripts/check backend` exit 0, **53 tests/191 assertions** (PHPUnit 12.5.44/PHP 8.5.12), including real migration up/down/up, ORM/schema parity and nullable lastname roundtrip against guarded tmpfs MySQL. `scripts/check phpstan` exit 0, fixed level 10 **zero errors** including tests/migrations, no baseline. Network-disabled PHP checks: **36 syntax checks**, container lint success, **11 YAML files** valid. Editor diagnostics clear. No stale PHP `surnames` references; the sole remaining source/mapping occurrence is intentional SQL column mapping. No migration/manifests/locks changed by this refactor. Private dotenv remains ignored/untracked/mode 600. Wrapper removed owned containers/network and lock; independent labelled-resource queries returned empty. No installation, real database/account mutation, key, SMTP, commit or push. T1 remains complete for this checked naming revision; T2 unauthorized.

## T1 lastName casing revision — 2026-11-18

User approved [casing execution plan v0.1](./last-name-camelcase-execution-plan.md) with “aprueblo el plan y su implementación”. Renamed PHP properties/parameters/normalizer, repository consumers, existing tests and XML field from lastname to exactly lastName. External mapping retains SQL surnames; migration unchanged. No product requirement or behavior change; existing behavioral tests reused as planned. No stale lowercase lastname identifiers remain in source/tests/mapping. Previous naming evidence remains historical for its own snapshot.

Casing revision checks: `scripts/check backend` exit 0, **53 tests/191 assertions**, including real guarded tmpfs MySQL migration up/down/up, ORM/schema parity, uniqueness and nullable lastName roundtrip. `scripts/check phpstan` exit 0, fixed level 10 **zero errors**, full owned scope including tests/migrations, no baseline. Network-disabled installed PHP container: **36 syntax checks**, container lint success and **11 YAML files** valid. Editor diagnostics clear; `git diff --check` passes. Manifests/locks and migration unchanged by this refactor; private dotenv ignored/untracked/mode 600. Wrapper cleaned its test runtime; independent container/network label queries returned empty and wrapper lock absent. No installation, keys, real account/development DDL, SMTP, commit or push. T1 remains complete; no T2 execution. Counts unchanged (11 complete/45 pending).

## T1 lastName SQL alignment — 2026-11-18

User approved [SQL alignment execution plan v0.1](./last-name-sql-execution-plan.md) with “Apruebo el plan y la implementación”. Updated initial users-table migration column and explicit external XML mapping to exactly lastName, superseding the earlier decision to retain SQL surnames. Current owned source/tests/config/migration search has no old surnames/lastname identifiers. Current development guidance records the naming; historical English prose, approval evidence and earlier execution records remain unchanged. Optionality, VARCHAR(255), normalization and other migration behavior unchanged. No persistent database upgrade is claimed or executed.

SQL alignment results: `scripts/check backend` exit 0, **53 tests/191 assertions**, PHPUnit 12.5.44/PHP 8.5.12. Actual migration up/down/up and zero-ALTER identity ORM/schema comparisons pass with the lastName column; nullable persistence, normalized uniqueness and password-boundary regressions pass. `scripts/check phpstan` exit 0, fixed level 10 **zero errors** including migrations/tests, no baseline. Installed network-disabled PHP container: **36 syntax checks**, container lint success and **11 YAML files** valid. Editor diagnostics clear, `git diff --check` passes. Root dotenv ignored/untracked/mode 600; manifests/locks unchanged. Wrapper removed test containers/network; independent label queries empty and wrapper lock absent. No installations, real development DDL/accounts, keys, SMTP, commit or push. T1 remains complete; counts 11 complete/45 pending. No T2 authorization. Any independently migrated persistent schema requires separately authorized upgrade work; this task changes only initial schema definition and disposable verification.

## T2 — Interactive SUPER ADMIN completion

Date: 2026-11-18. [Execution plan v0.1](./t2-execution-plan.md) approved with “Apruebo el plan y su implementación”, including bounded temporary-MySQL and real PTY checks. Branch `feature/003_T02_super-admin-command` created from then-current local dev, preserving plan/MEMORY edits. Supports FR-3/4/22/30, AC-3/4/30 and NFR-5/10 within bootstrap scope; later login/session/API authorization remains unimplemented.

### Implementation and traceability

- Console `app:user:create-super-admin`: Spanish interactive prompts, required email/first name/phone, optional lastName, hidden confirmed password, no visible fallback and three attempts per question. Noninteractive execution returns INVALID before DB access; exhausted invalid input/EOF returns FAILURE. Exact password whitespace/UTF-8 policy and Symfony auto hashing are reused.
- Application bootstrap service and narrow atomic store port keep console and persistence responsibilities separate. The Doctrine adapter checks normalized duplicates, reuses or creates ROLE_SUPER_ADMIN and persists role/user/join in one transaction/flush. Database uniqueness races and storage failures are sanitized; no existing account is updated or promoted. No verification field, role-management API or public registration added.
- Current committed baseline maps PHP lastName to SQL last_name; this task preserves the existing migration/mapping rather than the older historical naming record.

### Executed findings and corrections

- Test-first network-disabled functional invocation: one expected missing-command error, zero assertions, because the app:user namespace was absent. This established missing implementation, not an environment failure.
- Initial backend run: 57 tests/243 assertions, one error because the new fixture queried lastName as a SQL column. Inspected committed dev and corrected fixture queries to its last_name column; no schema change.
- Initial PHPStan: 11 errors at mixed Console question/validator boundaries, nullable kernel and fixture list typing. Added runtime narrowing and mixed-input validators; two subsequent redundant array_values findings were removed without changing analysis scope.
- Expanded backend run: 59 tests/281 assertions, one terminal timeout and one boundary failure caused by malformed synthetic email literals introduced while preparing fixtures. Corrected the fixture emails; application validation remained unchanged.
- Focused SuperAdmin runs: six tests/95 assertions passed, with a notice on Linux PTY stream closure. A diagnostic run with --display-notices/--display-phpunit-notices identified stream_get_contents errno=5 on normal slave closure. The fixture now handles only that PTY EOF in a local restored error handler; other notices remain visible. No PHPUnit failure/notice configuration or PHPStan baseline was relaxed.

### Final actual results

- `scripts/check backend`: exit 0, **59 tests/286 assertions**, PHPUnit 12.5.44/PHP 8.5.12, no warnings/notices. Includes existing T1 regressions and six bootstrap cases: noninteractive refusal, missing/reused role and normalized duplicate no-mutation, invalid/EOF/confirmation exhaustion without account/role creation, forced real MySQL insert failure with role rollback, real PTY hidden-input/exact-space/optional-lastName persistence, and 4097-byte rejection/4096-byte multibyte acceptance.
- Actual PTY fixture launches the real console in the guarded test environment, responds to prompts, asserts the password is absent from captured terminal output, and verifies its hash preserves spaces. No buffered-input substitute or real account is used.
- `scripts/check phpstan`: exit 0, fixed level 10 **zero errors**, all owned PHP including new tests/helper and migrations, no baseline or scope exclusion.
- Installed network-disabled PHP tool: **43 PHP syntax checks**, successful `lint:container --env=test`, **11 YAML files** valid. Editor diagnostics show no errors in source/tests.
- `git diff --check` passes. Dependency manifests/locks and migrations unchanged. Root dotenv ignored/untracked/mode 600 and never overwritten/printed. No installations, image pulls/builds, keys, real SMTP, development DDL/accounts, commit or push.
- Backend wrapper removed owned MySQL/container network. Independent Docker project-label queries returned no test resources; wrapper lock absent.

T2 is complete for this approved scope. Counts: 56 tasks, 12 complete, 44 pending. Stop before T3; on continuation prepare/present its task-specific execution plan and wait for explicit approval/implementation authorization. No actual development bootstrap, authentication flow or block Validation is claimed.

## T3 — Session authentication execution record

Date: 2026-11-18. [Execution plan v0.1](./t3-execution-plan.md) approved with “Apruebo el plan y su implementación”, including bounded temporary-MySQL checks. Branch feature/003_T03_session-authentication created from current local dev, preserving plan/MEMORY edits. No installation or persistent development mutation.

### Scope and implementation

FR-15/22/35 and AC-15/35 backend portions: email/cleaned-phone JSON login, own actor projection, logout/session invalidation and server-sourced roles. NFR-1/4/5/10: existing Symfony/API/MySQL boundaries, Spanish JSON responses and fixed analysis gate. Vue dashboard navigation, account changes/recovery, group/assignment authorization and final slice Validation remain later work.

Symfony SecurityBundle and lazy stateful firewall use infrastructure-only principal/provider/authenticator plus existing PasswordService verification. SessionUser serializes only stable ID; password/hash/profile are not persisted through that principal. Provider refreshes from DB per request; role changes or missing users invalidate prior access. Explicit DTOs expose only own approved fields/roles. The existing high-priority JSON exception subscriber now delegates security exceptions to Symfony and gives malformed input a stable invalid_input key instead of intercepting authentication failures as 500s.

Native PDO sessions use a new explicit reversible migration matching the installed handler schema. No identity migration change or automatic schema creation. Cookie/CSRF/endpoints match the approved concrete plan. Real native HTTP fixture requests prove MySQL storage and independent request lifetimes; simulated HTTPS is supported only by the private test router, not by production request headers.

### Findings and corrections during execution

- Initial network-disabled functional test: one test/one assertion failed with 404 instead of 401, establishing absent /api/me authentication behavior.
- Initial analysis: five errors (unnecessary nullable return types, unused integer helper and resource|false property assignment). Added covariant return types, real session-count assertion and explicit resource narrowing, without baseline/exclusions.
- Initial backend snapshot: 63 tests/315 assertions, two errors/two failures. New HTTP fixture incorrectly entered Symfony Runtime through its router script, producing non-JSON responses; the router now points SCRIPT_FILENAME/SCRIPT_NAME to the actual production front controller. An anonymous BrowserKit test attempted native session saving after table teardown; native HTTP assertions now cover that behavior, and the no-service principal serialization test covers the isolated credential boundary.
- Focused run: four tests/35 assertions, three errors because a built-in is_string callback was passed to a two-argument array_all call in the fixture. Replaced it with an explicit JSON-object shape check.
- Next focused run: four tests/60 assertions, two failures in fixture assumptions: existing cookies are not repeated on every response, and Symfony CSRF tokens use different HTTP/HTTPS namespaces. Cookie flags are asserted on the response issuing the cookie; simulated HTTPS is retained consistently. Production protections were not weakened.
- Focused session contracts subsequently passed four tests/82 assertions. Added explicit log leakage and role-change invalidation checks before the final full regression run.

### T3 completion and final actual results

- `scripts/check backend`: exit 0, **63 tests/374 assertions**, PHPUnit 12.5.44/PHP 8.5.12, no notices/warnings. Includes T1/T2 regressions, real PTY bootstrap and native HTTP session tests. Existing migration helpers apply/reverse the new sessions migration as well as identity schema; identity ORM/table parity remains intact.
- Session tests prove normalized email and cleaned-phone login, generic wrong/unknown credentials, CSRF absence/mismatch/other-session rejection, malformed/unsupported JSON input and forged privilege fields, method restrictions, own-only DTO, ID rotation, native MySQL session rows, no credentials/hash in session/response/private fixture log, cookie flags, logout cookie expiry/replay refusal and subsequent login. Independent anonymous sessions cannot inherit authentication. Persisted role change rejects old authentication; re-login reads the new role; deleted account loses access.
- Real loopback HTTP requests create fresh native request/kernel lifetimes; PDO session data is inspected in the guarded test MySQL instance. This is not BrowserKit file/mock session evidence. HTTPS cookie behavior is simulated only at the test router; no live production TLS or browser navigation claimed.
- `scripts/check phpstan`: exit 0, fixed level 10 **zero errors**, all owned PHP including new tests/router/helper/migration, no baseline/scope exclusion.
- Installed network-disabled PHP tool: **53 syntax checks**, successful `lint:container --env=test`, **12 YAML files** valid. Editor diagnostics clear for backend source/tests/migrations. `git diff --check` passed; manifests/locks unchanged, root dotenv ignored/untracked/mode 600.
- Backend wrapper removed owned MySQL containers/network. Independent Docker project-label queries returned empty; wrapper lock absent. HTTP fixtures terminate their child processes and close private temporary logs in teardown. No installation, image pull/build, persistent development DDL/account/session, key, SMTP, commit or push.

T3 is complete for the approved backend-support scope. Counts: 56 tasks, **13 complete/43 pending**. Authentication UI/dashboard navigation, account changes/recovery and downstream authorization remain pending. Stop before T4; continuation prepares/presents its execution plan for explicit approval/implementation authorization, not automatic execution. Spec 003 and parent remain short of implemented/accepted Validation.

## T4 completion

Date: 2026-11-18. Branch: feature/003_T04_own-account-updates. [Execution plan v0.1](./t4-execution-plan.md) approved with “apruebo el plan y autorizo su implementación”, including bounded temporary MySQL/native HTTP/race checks.

Implemented PATCH /api/me and internal fixed-ROLE_USER creation. Application input/uniqueness/update/create boundaries use shared normalization and password policy, with Symfony email validation and hashing adapters. Persistence transactionally locks and merges the current account, preserves roles/identity, and atomically provisions missing USER role/account/association. Only known database email/phone constraints translate to field errors; unexpected failures are sanitized. No public creation or other-account edit route was added.

### Actual checks

- Test first: scripts/check backend OwnAccount failed as expected with HTTP 405 instead of 200 (1 test/11 assertions), before implementing PATCH. Initial green run: 1 test/25 assertions.
- Focused scripts/check backend Account: 9 tests/159 assertions passed before expanding HTTP coverage. Real independent-connection barrier tests exercise create/update × email/phone races after successful prechecks, verify field errors and unchanged losing accounts. These are actual MySQL unique violations, not stubbed exceptions.
- Final scripts/check backend: exit 0, 73 tests/621 assertions. Includes T1–T3 regressions, native loopback HTTP/MySQL session tests, real PTY bootstrap, own ordinary/SUPER ADMIN edits, CSRF/anonymous/forged IDs/roles rejection, partial preservation, optional surname clearing, canonical duplicates, exact password whitespace and 4096/4097 UTF-8 byte boundaries, new/old login identifiers/passwords, missing-role creation and rollback, and sanitized storage-failure rollback. Direct application policy rejects another target before writes. Existing accounts remain unchanged on rejected ordinary creation.
- scripts/check phpstan: exit 0, PHPStan 2.3.6 fixed level 10, full owned scope including tests/migrations, zero errors, no baseline/exclusions. Intermediate analysis caught a partially written test parse error, insufficient ManagerRegistry type narrowing, redundant nullsafe access and an unused helper; corrected before the final successful analysis. No gates weakened.
- Installed PHP image with --network none/--pull never: 66 PHP syntax checks, lint:container and all 12 configuration YAML files passed. Editor diagnostics reported no errors in affected source/tests.

### Coverage and limits

Backend portions of FR-3/4/5/22/29 and AC-3/4/5/29 are covered here, supporting NFR-1/4/5/10. FR-5 owner/group authorization and UI acceptance remain in block 004 and later identity UI tasks; internal fixture creation does not prove that unfinished flow. No recovery, deletion, email, browser/UI or production TLS validation is claimed. The existing session refresh policy is retained; no additional global logout rule is inferred.

Disposable guarded tmpfs MySQL only; native HTTP children and race barrier files are closed/removed by fixture teardown. No dependency/image installation/build/pull, schema change, persistent development DDL/account/session, secrets, SMTP, commit or push. Owned test containers/network and wrapper lock removed. Manifests/locks/migrations unchanged; root dotenv remains ignored/untracked with mode 600. Final diff whitespace check passed.

T4 complete; project total 56 tasks, 14 complete and 42 pending. Stop before T5. On continuation prepare and present T5's execution plan and await explicit approval/implementation/runtime authorization. Specification 003 remains approved pending its complete implementation and separate Validation.

## T5 completion

Date: 2026-11-18. Branch: feature/003_T05_recovery-token-lifecycle. [Execution plan v0.1](./t5-execution-plan.md) approved with “Apruebo el plan y autorizo su implementación”, including bounded temporary-MySQL/native HTTP/concurrency checks. Started from local dev 7be25d5a21c7d4c77217b96520cada05ee675457 preserving the planning documents.

### Implementation and traceability

FR-28/AC-28 backend lifecycle: RecoveryTokens generates 32 random bytes encoded as URL-safe text; only SHA-256 digests enter persistence. IssuedRecovery is an in-memory sensitive handoff, with redacted debug output and refused PHP/JSON serialization. An injectable clock and configured positive-integer PASSWORD_RESET_TTL_SECONDS provide the 3600-second default and captured per-request expiry. Exactly at expiry, a token is invalid. A new issue supersedes earlier requests; successful reset consumes the current request once. Consumed/superseded/unknown/malformed/expired requests cannot reset a password.

A new explicit reversible migration and external Doctrine mapping describe password_reset_requests, its unique digest, user FK with cascade and UTC microsecond timestamps. DBAL transactions lock the account before reset records, then recheck request state. Password write plus consumption and supersession plus issuance each commit atomically. No stale profile/role overwrite. FR-4/AC-4 uses the shared exact-whitespace six-character/4096-byte policy and Symfony hasher. NFR-10 passes below. Full emailed-link acceptance remains T6/T7; this task exposes no recovery API or UI and claims no delivery evidence.

### Actual commands and results

- Test first: scripts/check backend RecoveryClock failed because RecoveryLifetime did not exist (1 test, 0 assertions, one missing-class error). Runtime removed afterward.
- Initial focused lifecycle run: 3 tests/81 assertions, one failure from comparing the entire ORM schema against independently managed session/migration/transport tables. Corrected the test to compare the recovery-owned table, retaining schema parity checks rather than modifying unrelated infrastructure.
- Expanded focused run revealed a duplicate data-provider key, denied global trigger privileges and denied performance_schema access. Corrected unique provider labels; rollback tests now use temporary CHECK constraints on the guarded reset table, with no global privilege/configuration changes. Real concurrency fixtures use independent connected processes and barriers around the actual user-row lock, not mocked locking. A subsequent run overlapped a callback-result contract edit and reported array-to-string/password failures; fixed the adapter contract and discarded that intermediate run as final evidence.
- Final scripts/check backend: exit 0, 88 tests/812 assertions, no warnings. Includes all T1–T4 regressions, default/configured TTL, expiry before/at/after boundary, supersession/reuse, malformed/unknown/deleted-account rejection, hash-only persistence and migration/mapping parity. Invalid five-character and oversized ASCII/multibyte passwords leave password/token unchanged; six-character and 4096-byte values hash and verify. Ordinary and SUPER ADMIN reset preserve profile/roles and permit real native HTTP login with the new password while rejecting the old one.
- Four real independent-connection races pass: consume/consume, issue/old-consume, consume/issue and issue/issue. The first operation holds the account lock; the competing process remains unfinished until release. Outcomes prove one consumption success and one current request after competing issuance. This uses the disposable database; no claim of performance_schema lock instrumentation is made.
- Real CHECK-constraint failures after the password write and after supersession prove transaction rollback; the previous token remains usable. Cascade deletion removes reset requests. Private HTTP output excludes raw tokens/password hashes; token-bearing issuance refuses serialization and redacts debug output. No raw token is supplied in process command arguments.
- Final scripts/check phpstan: PHPStan 2.3.6, fixed level 10, full owned PHP/tests/migrations, exit 0 and zero errors, no baseline/exclusions. Earlier analysis flagged an always-true assertion; replaced it with explicit exception assertion accounting.
- Installed PHP image, --network none and --pull never: all 80 PHP syntax checks (79 source/test/config/public/migration files plus bin/console), lint:container and 12 YAML files passed. Editor diagnostics on the affected paths reported no errors. git diff --check passed.

### Limits and cleanup

Only guarded tmpfs MySQL and synthetic accounts/reset records/native loopback HTTP were used. Test teardown reverses migrations and removes owned HTTP children, private outputs and race barrier files; wrapper removes its containers/network/lock. No dependency/image installation/build/pull, development database migration/account/session changes, secrets/key generation, SMTP/Mailpit/workers/browser startup, commit or push. Existing dependency manifests/locks and prior migrations are unchanged. Root dotenv remains ignored/untracked with mode 600.

Recovery issuance is internal by trusted account ID; public identifier handling and durable mail integration remain T6, including transactional handoff without raw bearer persistence or another queue. No changed global session-invalidation policy, public registration or account verification. Separate slice Validation remains pending.

T5 complete. Total 56 tasks: 15 complete, 41 pending. Stop before T6; continuation prepares/presents its execution plan and awaits explicit approval/implementation/runtime authorization.

## T6 execution record

Date: 2026-11-18. Branch: feature/003_T06_recovery-mail-delivery. [Execution plan v0.3](./t6-execution-plan.md) explicitly approved with “apruebo el plan y su implementación”. Parent plan v0.5 / task index v0.5 and derived plan/tasks v0.4 were approved separately; no additional installation or real key provisioning authorized. Existing local approved planning edits were preserved on the new branch from dev.

Implemented strict CSRF-protected JSON recovery/reset adapters, generic 202 acknowledgement, trusted fragment links, encrypted delivery work and atomic issuance/work/ID-only Messenger handoff. T5 still validates digests only; its transaction now includes optional delivery handoff and pending-work cancellation/purging. RecoveryDeliveryStore serializes account/request/work before synchronous SMTP, reloads current account/request state, and purges successful/terminal/stale envelopes. Existing Messenger strategy owns retries; events mirror sanitized retry count/due/status. The root key remains unprovisioned; a separate test-only bootstrap generates disposable independent keys in mail test processes and passes them privately to child workers/HTTP. No new dependency, secret file or assignment-key requirement.

### Actual checks recorded so far

- Test first: scripts/check backend DeliveryProtection failed with two absent-class errors (2 tests, 0 assertions), confirming missing envelope/error behavior before implementation.
- Initial scripts/check mail RecoveryDelivery: 1 test/32 assertions passed with an actual captured link, native reset/login and no token response. Expanded four-test run exposed a fixture expectation: Messenger wraps the intended SQL CHECK enqueue failure in TransportException. Corrected the test catch without changing transaction semantics or weakening the failure injection. Next focused run: 7 tests/200 assertions passed, including ordinary/SUPER ADMIN capture/reset/login, actual work/queue failure rollback, same-token worker restart/retry, six attempts/five retries and terminal purge, strict input/CSRF/tampering and two real SMTP concurrency cases.
- SMTP races use a private loopback SMTP fixture that accepts real protocol DATA and blocks its acknowledgement without logging the body. Two actual notification workers claim duplicate ID messages; only one SMTP acceptance/attempt commits. A real reset connection waits during SMTP handoff, then consumes after acceptance/commit. This explicitly tests the approved external handoff boundary, not recall or exactly-once SMTP. These fixtures supplement, rather than replace, Mailpit usable-link evidence.
- Final scripts/check backend: exit 0, 91 tests/829 assertions, no warnings, including all T1–T5 regressions and new crypto/config unit tests. Existing real MySQL uniqueness/lifecycle races, password boundaries, native HTTP and PTY bootstrap remain passing with the new explicit migration.
- Final scripts/check phpstan: PHPStan 2.3.6 fixed level 10, all owned PHP/tests/migrations, exit 0, zero errors, no baseline/exclusions. Intermediate findings in mixed JSON/DB row types, callback result inference and fixture process command arguments were corrected with explicit narrowing/typed state; no quality gate relaxed.
- scripts/check static: exit 0; JSON, 11 task mappings, wrapper/ownership/model/port/signal boundaries and key-free shared startup checks pass.
- Installed PHP image, --network none/--pull never: 95 PHP syntax checks, Symfony lint:container and all 12 YAML files pass. Editor diagnostics for affected API/mail/test paths report no errors. git diff --check passed. Existing dependency manifests/locks and earlier migrations unchanged; root dotenv ignored/untracked/mode 600.

Full scripts/check mail, including the added explicit transport-schema parity and missing-key API case, is still running at this record boundary. Do not mark T6 complete until its actual result and final cleanup are recorded below.

### T6 expanded regression boundary

scripts/check mail completed with exit 0: 105 tests/1082 assertions, no warnings. Includes installed Messenger transport-schema parity, missing-key known/unknown API failures without token/work/queue mutation, captured USER/SUPER ADMIN recovery links, real worker retry/exhaustion and SMTP races, plus all prior regressions and the foundation mail/launcher checks. Its owned containers/network were removed.

Final diff review identified an additional crash-window case in the approved durable retry projection: retry enqueue can commit before the worker event records its count/due status. Added a behavioral test that erases only that projection after a real failed attempt, then restarts the actual worker and requires count recovery from the queued retry stamp. T6 remains in implementation until this case and affected final checks pass; the preceding full suite does not claim coverage of this newly added case.

### T6 retry projection correction

The added real-worker crash-window test failed as expected: 1 test/27 assertions, reporting one attempt instead of two after the test erased the retry projection while retaining Messenger's real queued retry stamp. Added recovery-specific received-message middleware that restores the observed count from RedeliveryStamp before handling, with monotonic count protection and no new retry scheduler. It ignores ordinary production/test messages and producer-side dispatch.

After this correction, final scripts/check phpstan again exits 0 with zero level-10 errors; all 96 PHP syntax checks, container and 12 YAML lint pass. Editor diagnostics on the middleware and expanded integration test report no errors. Full scripts/check mail is rerunning against this final implementation; the earlier 105/1082 run remains evidence for the preceding revision only.

## T6 completion

Final scripts/check mail after the retry projection correction: exit 0, 105 tests/1084 assertions, no warnings. This final run includes the entire current backend regression set plus all mail/worker tests, the reproduced crash-window case, captured usable USER/SUPER ADMIN links, transactional work/queue failures, same-token retry/restart, all five additional retries, terminal purging, real SMTP/worker/reset races, explicit installed transport-schema comparison, and missing-key non-disclosure/no-mutation checks. The prior standalone scripts/check backend passed 91/829; the final mail run re-executed that backend coverage with the new middleware. Final PHPStan fixed level 10, 96 PHP syntax checks, container/12 YAML lint and editor diagnostics pass. Static wrapper/model checks passed with the final compose/bootstrap changes. No baseline or quality-scope exclusion introduced.

FR-28/AC-28 backend recovery is implemented and locally verified; FR-4 password policy remains enforced, with recovery-specific FR-13/34 and NFR-7/10 evidence. Recovery UI remains T7, full identity slice review T9 and assignment delivery/status/resend remain block 006. The delivery table is DBAL-owned; tests verify its privacy/nullability/cascade contract and actual transactional failures, while comparing the explicit Messenger table against its installed adapter schema. Prior migrations and T5 historical evidence were retained.

Owned MySQL/Mailpit containers, network, wrapper lock, native HTTP/worker/SMTP child processes, barrier files and synthetic key environment were removed by wrapper/fixture teardown. Root dotenv unchanged, ignored/untracked, mode 0600; no real recovery key generated. No package/image installation/build/pull, persistent development migration/account/session/key mutation, external SMTP, browser/UI verification, commit or push. SMTP acceptance/crash can still produce external duplicate delivery as documented; stable Message-ID and serialization do not claim exactly-once SMTP. Main development recovery readiness still requires separately authorized real key provisioning and explicit migrations.

T6 complete under approved execution plan v0.3. Total 56 tasks: 16 complete, 40 pending; block 003 six complete/three pending. Stop before T7. On continuation prepare and present its task-specific execution plan and await explicit approval/implementation/runtime authorization. Specification 003 remains approved, with separate final Validation pending.

## T7 execution record

Date: 2026-11-18. Branch: feature/003_T07_identity-screens, from local dev 2a5ce43adeb58c56b2a8de3cf64aab8293b3528f with planning edits preserved. [Execution plan v0.1](./t7-execution-plan.md) approved with “Apruebo el plan y la implementación”, authorizing implementation and bounded installed-image MySQL/Mailpit/worker/browser checks with a disposable private test env file. No installation or real key provisioning.

Implemented Vue email/phone login, generic recovery and one-use reset screens, own-actor dashboard shell, session restoration/private guards/logout and safe fresh-CSRF transport/204/error handling. Reset fragment is moved to memory and removed from URL/history before asynchronous work; no browser storage, registration, verification, automatic reset login or unfinished group/assignment API exists. The installed vue-tel-input 9.9.2 selects a default country even without discovery and accepts formatting signs; the approved local fallback implements digits/one leading plus, caret/paste/composition handling without country inference or national validation.

### Actual intermediate checks and corrections

- Test-first contracts failed to import the absent phone module before implementation (zero executed tests). Initial implementation passed 15 tests; expanded frontend suite passed 27 across five files, including fresh CSRF per mutation, 204, allowed field errors, password Unicode/byte/exact-whitespace policy, stale session responses, logout failure, guards, generic acknowledgement and reset fragment/field-error behavior.
- Build and static wrapper/model checks passed. An early analysis reported zero errors but its wrapper encountered a shell parse error while that script was being edited during execution; that run is not claimed as a passing command. The subsequent complete scripts/check phpstan exited 0 with zero fixed-level-10 errors. No baseline/exclusions. Editor diagnostics passed.
- First real Chromium run found stale worker cache/absent receiver and cold HTTP readiness failures; private clean worker/API caches and a bounded native readiness request resolved these. Standalone Chromium desktop then passed six identity/shell/security cases. No mocked login/mail replaced these checks.
- A subsequent full matrix encountered pending HTTP/timeouts under high host load/swap and was stopped explicitly (exit 143); it is not passing evidence. Its automatic Playwright failure context included synthetic fixture password data. Removed those owned contexts, disabled page-copy snapshots as well as traces/video/screenshots, moved fixture credentials out of reported spec source, sanitized credential-fill/navigation errors and used boolean secret assertions. A fixture-only one-child FPM pool and bounded 120-second cases/30-second expectations with maxFailures=1 reduce resource cascades without changing functional assertions or adding retries. Worker/control remain bounded at 1800 seconds. No main runtime/hasher policy was altered.
- Wrapper mock checks pass for pre-existing-resource refusal, failures and SIGTERM, including 0700/0600 temporary material and removal of the owned env directory/lock. They use no real key. Installed-image offline checks pass: 97 PHP syntax files including bin/console, php-fpm -t for the fixture pool, Symfony lint:container and all 12 YAML files.

The current four-profile matrix and final mail/backend/foundation regressions remain pending at this record boundary. T7 is not yet complete; do not infer completion from the standalone Chromium result.

### T7 expanded regression boundary

The corrected dedicated identity graph completed scripts/check identity with exit 0: 24 tests across Chromium desktop/mobile, Firefox and WebKit, zero retries, in 4.0 minutes. Real email/phone login, reload/private guards, server logout/replay rejection, network failures, actual Mailpit fragment navigation/removal, exact password reset and old-password rejection, reuse/expiry/supersession/missing link, own SUPER ADMIN identity, keyboard/error focus and responsive/private-path/JSON checks passed. Owned graph, lock and private env directory were removed. No failure contexts remained. Current build contains neither recovery-key identifiers nor fixed fixture credentials.

Final scripts/check frontend passed 28 tests across five files, including a new generic 503 recovery-service UI case with retryable controls and no false delivery acknowledgement. Final static wrapper/model checks and PHPStan fixed level 10 exited 0 with zero errors. Full scripts/check mail passed 105 tests/1084 assertions, including all current backend regressions and missing-key/rollback/worker/SMTP privacy cases; its graph was removed.

Plain foundation e2e then exposed a wrong test precondition: that model intentionally applies no session/identity migrations, so GET /api/me fails and the approved guard correctly renders a session-service error instead of claiming anonymity. The first plain run had four navigation assertion failures, four passing JSON/private-path tests and 16 intentionally skipped identity cases. Corrected only the graph-specific home-return expectation to require the explicit error/retry state and no actor in foundation mode; migrated identity mode still strictly requires login. Security, keyboard, responsive and API expectations remain intact. The standalone foundation rerun is pending; T7 is not yet complete.

## T7 completion

Final plain scripts/check e2e exited 0: eight foundation shell/JSON/private-path cases across all four profiles passed, with 16 identity cases intentionally skipped because only scripts/check identity provisions their required schema/accounts/mail/key. The migrated identity run passed all 24 cases without skips or retries; its strict login expectation is retained in the graph-specific branch. The foundation rerun requires the actual session-service error/retry state and no actor, preserving the accepted migration-free foundation scope. The intermediate incorrect-expectation failure above is retained as historical evidence, not a product readiness claim.

Final results: frontend 28 tests/five files; identity E2E 24 tests/four profiles; foundation E2E eight tests/four profiles; complete backend/mail suite 105 tests/1084 assertions; production frontend build; static wrapper/model/11 task mappings including private-material failure/SIGTERM cleanup; PHPStan 2.3.6 fixed level 10 zero errors with full owned PHP/tests/migrations and no baseline/exclusions; 97 PHP syntax checks, test-pool FPM syntax, container/12 YAML lint, editor diagnostics and diff checks pass. No standalone backend rerun is claimed: the full mail run includes that regression coverage. The final smoke-only assertion adjustment changes the intentionally uninitialized graph expectation; migrated login/security behavior was not relaxed.

FR-3/4/15/28/35 and NFR-2/5/6/8/10 frontend portions are locally verified within T7. Account editing remains T8; consolidated identity privacy evidence/review remains T9 and separate Validation. Full group/event/assignment dashboard and delivery remain downstream. This proves local HTTP browser/session/mail integration, not production TLS/proxy/external SMTP or main development readiness. Main development still requires separately authorized explicit migrations/accounts and real recovery-key provisioning.

Owned MySQL/Mailpit/FPM/Vite/Nginx/worker/control/browser containers, network, wrapper lock, private synthetic env directories and fixture child processes were removed by their wrappers/fixtures. No failure-context, trace, screenshot or video artifact remains from the final runs. Root dotenv remains ignored/untracked/mode 0600 and was not mutated; dependencies/locks and production migrations are unchanged. No installation/image pull/build, persistent development DDL/account/session/key mutation, external delivery, commit or push. The frontend application build is distinct from an image build.

T7 complete on feature/003_T07_identity-screens under execution plan v0.1, approved with “Apruebo el plan y la implementación”. Total 56 tasks: 17 complete, 39 pending; block 003 seven complete/two pending. Stop before T8; on continuation prepare/present its task-specific execution plan and await explicit approval/implementation/runtime authorization. Spec 003 remains approved with final Validation pending.
