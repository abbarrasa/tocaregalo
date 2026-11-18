# 003:T1 — Execution plan

Revision: v0.2
Status: executed; T1 complete with scope and evidence limits
Approval (v0.2): “Apruebo estos planes y autorizo actualizar las listas”, 2026-11-17. Does not authorize resuming boundary implementation or runtime.
Historical v0.1 authorization remains valid for its unchanged scope; no completion claimed.
Implementation authorization: “Autorizo implementar T1 y ejecutar las comprobaciones previstas con MySQL temporal”, 2026-11-17.
Plan approval: “Apruebo el plan”, 2026-11-17. No implementation or runtime authorization inferred.
Date: 2026-11-17
Planning authorization: “Continúa con la siguiente tarea”, after accepted block 002 Validation.
Authority: approved [Spec 003 v0.3](./spec.md), [Plan 003 v0.3](./plan.md), [T1](./tasks.md), parent [Spec 001 v1.2](../001-toca-regalo/spec.md) and [Plan 001 v0.4](../001-toca-regalo/plan.md). Parent v0.3's startup/key sequencing does not change identity requirements.

## Outcome and boundaries

Implement normalized user values, password policy and foundational user/role persistence constraints. Primary coverage FR-3/4 and AC-3/4 backend portions; NFR-1/10. Frontend phone prevention, owner creation entrypoints, login/logout/session/CSRF, SUPERADMIN command, recovery, account APIs and group authorization remain later tasks. No public endpoint or real account creation in T1.

No installation, dependency update, image build/pull, key provisioning or real SMTP. Reuse installed PHP/Symfony Validator/PasswordHasher/Doctrine/Migrations/MySQL tools. The original prose/PDF are not present in the current checkout; this task uses the approved consolidated specification/clarifications and introduces no new product rule. If implementation reveals a behavior not resolved there, stop affected work and ask rather than invent it.

After approval inspect status and create `feature/003_T01-user-values-persistence` from then-current local dev, preserving all planning edits. Current dev is clean before this proposal. Stop only if switching is unsafe; no commit, push, merge, stash, reset or restore. No prerequisite that these planning edits be committed is introduced.

## Files and responsibilities

| Files | Responsibility |
| --- | --- |
| `backend/src/Domain/User/` | Framework-independent User/Role models, normalized text/phone values and password policy. No ORM attributes or Symfony dependency. No plaintext password on persisted models. |
| `backend/src/Application/Port/` as needed | User persistence/password-service boundary required by approved architecture; no speculative generic abstraction or business use case. |
| `backend/src/Infrastructure/Validation/` | Symfony email validation adapter, combining required-field errors with pure normalization. Spanish field messages without submitted passwords. |
| `backend/src/Infrastructure/Security/` | Minimal Symfony password hashing/verification adapter using the approved password-service boundary; no authenticator/session/HTTP security flow. |
| `backend/src/Infrastructure/Doctrine/`, `backend/config/doctrine/` | Repository adapter and external mappings for users, roles and user_roles; generated integer IDs and normalized unique indexes. |
| `backend/migrations/`, `backend/config/bundles.php`, `backend/config/packages/doctrine*.yaml` | Register already-installed migrations support, explicit mapping/path config and initial reversible identity schema migration. No auto-migration on startup. |
| `backend/config/services.yaml` | Register only required adapters/services; keep existing JSON boundary. No automatic API resource exposure of domain objects. |
| `backend/tests/Unit/`, `Integration/`, existing support helpers where necessary | Rule tests and real isolated MySQL migration/mapping/constraint/hash verification with guards before schema mutation. |
| `README.md` / `docs/development.md` only if commands change | Explain migration availability/limits and test-only execution accurately. |
| `specs/003-identity-access/verification.md`, task/memory/governance records | Actual evidence, approval and next task boundary. |

Keep manifests/locks, frontend and block 005 untouched. Framework security interfaces belong in adapters, not domain models; the Symfony hasher bridge must not force framework interfaces into the domain. Do not implement future user-edit/search/API behavior just to exercise persistence.

## Rules and persistence contract

- Trim surrounding names/email; first name and email/phone required, surnames optional/nullable. Validate email through Symfony. Preserve the trimmed email and store its lowercase comparison key separately; do not remove accents for uniqueness. Whitespace-only required input fails. Do not invent name/password composition restrictions.
- Phone normalizer removes formatting whitespace/signs, retaining a single leading `+` and digits; reject absent country-prefix `+`, `00`-only prefixes, missing digits and malformed remaining plus placement. Formatting variants converge to one comparison value. Follow approved normalization examples/rules, without adding a new E.164 length/country allowlist or libphonenumber dependency.
- Count password characters, not bytes, for minimum six; preserve exact submitted characters and whitespace. Test letters-only, digits-only, signs-only, combinations and Unicode boundaries; no category combination or password trimming. Delegate hash/verify to Symfony algorithms/classes, never a custom hash. Apply the approved 4096 UTF-8 byte maximum through the shared pure policy before Symfony hashing; do not truncate or prehash. Test ASCII and multibyte 4096/4097-byte boundaries.
- `users`: generated integer ID, trimmed first name, nullable surnames, trimmed email, normalized email comparison key, cleaned phone, password hash. `roles`: integer ID and unique role name. `user_roles`: unique user/role pair with real FKs. No verification flag, creator/owner attribute, timestamps or additional user attributes not specified.
- Strings use installed Doctrine's default length 255; email comparison index uses binary collation to preserve accent distinctions, phone indexes the cleaned textual value. Explicitly inspect actual MySQL DDL/type/length/collation rather than claim defaults. Do not confuse search's case/accent-insensitive semantics with email uniqueness. No search implementation in T1.
- Repository supports required identity persistence/lookups and role association only. Database uniqueness remains authoritative under competing writes; application field-error translation for API races is completed in T4. No hardcoded fixtures or role seeding in real development DB. T2 owns interactive bootstrap and missing-role creation.

## Test-first sequence

1. Write focused rule tests first: missing/blank fields, trim/optional surnames, invalid email, case comparison without accent folding, phone variants/malformed prefix, exact password preservation and five/six Unicode character boundaries. Demonstrate intended failures because new behavior is absent, not broken dependencies.
2. Implement pure rules and Symfony boundary adapters with narrowly scoped services. Test hash verification with correct/incorrect password and ensure stored values are hashes, never plaintext. Do not make algorithm-specific hash snapshots.
3. Add external mappings/initial migration using installed APIs. Add guarded integration tests that apply the actual migration in an invocation-owned tmpfs MySQL database and inspect schema metadata. Verify persisted roundtrip/role relations, duplicate normalized email and cleaned phone, nullable surnames and unique role/user-role pairs. Assert missing required attributes fail through validation; do not claim empty SQL strings are rejected by NOT NULL alone.
4. Verify down/up reversibility only on that isolated invocation-owned test schema. No schema update shortcut, migration generation against development, automatic reset, unrelated table drop or persistent-data operation. Ensure guards validate test environment/declared URL/database before any DDL, including when migration tests fail. Use unique fixtures and transactional cleanup where possible; DDL auto-commit must be handled explicitly rather than pretending rollback reverses schema changes.
5. Run focused PHPUnit rules/integration plus existing JSON/database boundary regressions through the installed T5 harness. Compile/lint container/mappings/migration configuration, inspect generated DDL, and run PHP syntax on new owned PHP files.
6. Run final `scripts/check phpstan`: fixed level 10, full owned PHP including new tests/migrations, zero errors, no baseline or scope omission. Extend analysis paths to include `migrations` if necessary; this adds scope, never excludes existing paths. Any new PHP helper outside current paths must also be included. No PHPStan installation or level reduction.
7. Confirm owned containers/network removed, private dotenv unchanged/ignored/mode 600, locks/manifests unchanged, no runtime secrets or test accounts leaked into development. Review diff/links/diagnostics. Record actual commands/results/limits and mark only T1 complete after all gates pass. Stop before T2; require its own plan and implementation approval.

## Bounded runtime authorization requested

Use installed images and the existing `compose.verification.yaml` explicit project `tocaregalo-test`. Refuse preexisting reserved project/network/lock and unsafe database parameters before use. MySQL remains tmpfs/internal, using the already supplied TEST_DATABASE_URL and test database name; never apply identity migrations to the development URL. Start only MySQL and temporary PHP check containers for this backend task; no browser/frontend/mail/worker runtime needed. If a helper must support migration setup, keep its interface restricted to the guarded isolated database and preserve existing fixture safety tests.

This approval would authorize schema creation/migration reversal and synthetic user/role fixture persistence **only inside the newly owned temporary test database**, not the user's development database or real SUPERADMIN accounts. Never print credentials, plaintext passwords or hashes in logs. On failure/interruption clean up only owned services/network without deleting volumes. Report cleanup failures honestly.

Existing database parameters suffice unless inspection proves otherwise; ask for genuinely missing inputs rather than rewrite private dotenv or fabricate values. No network package resolution/download is included. If an installed dependency is missing, report it and request separate installation authorization with concrete scope.

## Completion and approval request

T1 done means rule tests, real migration/mapping/uniqueness/hash checks and final full-scope level-10 analysis pass, actual DDL/defaults documented, development data untouched and temporary resources removed. This supports backend AC-3/4 only, not full user flows or block 003 acceptance.

Historical v0.1 approval and runtime scope are recorded above; proposed v0.2 requires approval before boundary implementation resumes. This preparation modifies documentation only on dev; no implementation branch, package operation, migration, account or service startup has occurred.

## Approved decision and proposed remaining execution

Parent v1.2 is approved under “Apruebo esta revisión y autorizo preparar el resto de revisiones afectadas”, 2026-11-17. The user accepted Symfony's 4096-byte guard; this supersedes the earlier unresolved decision, not historical check results.

After approval of revised plans and tasks and explicit resumption authorization: add failing ASCII/multibyte 4096/4097-byte policy tests; add hasher boundary tests; implement the pure byte guard; rerun guarded temporary-MySQL backend regressions, relevant lint and final full-scope PHPStan level 10. Use the existing v0.1 files, harness, runtime limits and cleanup rules; no new services, installation or real data mutation. Record actual results, then assess T1 completion and stop before T2. Consumer API/command/recovery no-mutation checks remain their later tasks.

Revision v0.2 is approved under the evidence above; do not resume implementation until revised tasks and explicit resumption are authorized.

## Execution completed

Resumption authorized with “Apruebo las listas y autorizo reanudar 003:T1”, 2026-11-17. [Completion evidence](./verification.md#t1-completion): backend 53 tests/191 assertions; all required syntax/configuration and final level-10 checks pass; temporary runtime removed. Stop before T2.
