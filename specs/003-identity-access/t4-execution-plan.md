# 003:T4 — Own-account changes and ordinary creation boundary

Revision: v0.1
Status: complete; approved implementation and bounded checks executed
Approval: "apruebo el plan y autorizo su implementación", 2026-11-18, approves v0.1 including its bounded MySQL/HTTP/race checks.
Date: 2026-11-18
Preparation authority: “Continúa con T4”.
Baseline: approved Spec 001 v1.2, Plan 001 v0.4, derived Spec/Plan/Tasks 003 v0.3. T1–T3 complete. Scope: FR-3/4/5/22/29, AC-3/4/5/29 backend portions, supporting NFR-1/4/5/10.

## Outcome and boundaries

Implement authenticated own-profile/password changes and an internal ordinary-user creation service. Expose only PATCH /api/me. Owner/group creation entrypoint remains block 004; do not expose a general users POST or public registration. Owner membership authorization cannot be demonstrated before groups exist. SUPER ADMIN bootstrap remains its separate command; this task adds no role-management or other-account admin endpoint, deletion, recovery, notifications or UI.

### Proposed PATCH contract

- Require authenticated session and X-CSRF-Token under the existing session_mutation mechanism for ordinary users and SUPER ADMIN editing themselves.
- Accept a nonempty JSON object containing any subset of firstName, lastName, email, phone, password. Merge omitted fields with the current persisted account. Only lastName permits null; surrounding blank lastName clears it to null under existing normalization. Missing password preserves the hash; supplied empty/null/invalid password fails rather than silently preserving it. No new current-password requirement is introduced beyond the approved authenticated-session condition.
- Reuse required/trim/email/phone rules and exact six-character/4096-byte password policy with Symfony auto hashing. Preserve exact password whitespace. Identity, roles, owner/recipient IDs and unknown fields are rejected, never bound to entities. Actor/target ID comes exclusively from the server session; PATCH /api/me cannot target another account.
- Success returns 200 with the existing own-actor DTO and no-store, without password/hash or internal entity data. Return 401 unauthenticated, 403 invalid CSRF/unauthorized target in application policy, and 422 invalid/empty/unsupported input or duplicate email/phone, with stable error keys and Spanish field-associated messages. Unexpected persistence failure remains sanitized 500, with no SQL/credentials.
- Changing email/phone updates later login identifiers while session identity remains the same stable user ID. Password changes must verify the new password, reject the former password on subsequent login, and preserve ordinary versus SUPER ADMIN roles. Do not invent an all-sessions logout policy; existing T3 refresh behavior remains unchanged.

## Internal ordinary-user creation

Provide a narrow application service accepting validated account input/initial password and assigning only ROLE_USER. Caller cannot supply role/owner attributes; the service is wired only for internal future authorized group orchestration, not as a current HTTP endpoint. Validate and hash before persistence; create/reuse the fixed USER role atomically with a new account and association. Rollback on invalid/duplicate/persistence failure, never update/promote an existing account. This supports FR-5 without claiming its owner/group user flow is implemented. Application actor policy for own updates rejects attempts to update another account; group ownership cannot be asserted via client input to bypass it.

## Design and files

| Paths | Responsibility |
| --- | --- |
| backend/src/Application/User/ and Port/ | Own-update/ordinary-create use cases, trusted actor boundary, explicit input/update semantics and structured field/duplicate errors; no Symfony/Doctrine dependency in domain. |
| backend/src/Infrastructure/Validation/ | Reuse Symfony email validation with required/optional normalizers; structured field violations suitable for JSON without raw submitted credentials. |
| backend/src/Infrastructure/Doctrine/ | Atomic create/update persistence and DB-unique race translation. Preserve SQL last_name, IDs, current roles and existing schema. |
| backend/src/Api/ and config/routes.yaml, services.yaml | PATCH /api/me controller/input projection; reuse own actor DTO and session/CSRF security; no mass assignment or new public creation route. |
| backend/tests/Unit/, Integration/, Functional/, Support/ | Policy/update/validation tests, real MySQL atomicity/unique races and native HTTP account/session regressions. Extend existing HTTP helper only as required. |
| README.md, docs/development.md | Current API fields, validation/errors and limits in required language. |
| specs/003-identity-access/verification.md, tasks.md, MEMORY.md, AGENTS.md | Approval, actual evidence and next task boundary. |

Existing generic repository save writes the full profile/roles; do not allow stale request snapshots to overwrite concurrent changes or replace roles. Load/lock current account inside the atomic update, merge only supplied allowed values, and persist profile/hash while retaining persisted roles. Use database uniqueness as authority, not prechecks alone. Translate known email/phone constraint violations into the corresponding field error; never return raw database messages. Role creation must be atomic/idempotent under competing creation; do not concatenate separately flushed role/user writes without transaction protection. No schema change or package installation is proposed.

## Execution and verification

1. After approval inspect git status --short --branch and create feature/003_T04_own-account-updates from then-current local dev, preserving plan/MEMORY. Observed dev is clean before preparation, HEAD/dev e6b5f450359f48c6497bffbba8c20a8941c12600. Stop on an unsafe branch switch; no commit/push/merge/reset/restore/stash.
2. Add behavioral tests first for missing PATCH/internal creation behavior; record genuine missing-behavior failures. Reuse existing normalization/password tests rather than duplicate implementation assertions.
3. Implement narrow application/persistence boundaries and PATCH JSON adapter with authentication/CSRF. Validate complete merged profile before writes, hashing only a supplied valid password; transaction/row-lock current values so partial updates do not replace unrelated concurrent fields or roles.
4. Native HTTP tests: anonymous/CSRF rejection, partial own updates and null surnames, invalid fields/unknown role/ID injection, unchanged values on any invalid input, email/phone canonical duplicates, six/4096-byte boundaries and whitespace, password-only/profile-only changes, fresh GET /me and new/old identifier/password login. Check ordinary and SUPER ADMIN own edits; neither the route nor forged inputs can edit another account or alter roles. Application-policy tests explicitly reject a different target.
5. Real MySQL tests: ordinary creation returns USER only even when SUPER ADMIN role exists; missing USER role/create rollback, repeated normalized duplicates, unchanged existing account/hash/roles, atomic field changes and competing unique writes. Use independent real connections or controlled barriers to cause the unique constraint race after a precheck; a stub-only exception is not complete race evidence. Record the field error and unchanged losing account. Verify no partial update/creation when validation or persistence fails.
6. Run scripts/check backend with T1/T2/T3 regressions, including real PTY and native MySQL sessions. Run syntax/container/YAML checks, diagnostics and diff review, then final scripts/check phpstan fixed level 10, all owned PHP including tests/migrations, zero errors/no baseline or scope exclusions.
7. Confirm owned resources/HTTP children/locks removed, private dotenv unchanged/ignored/mode 600 and manifests/locks/schema unchanged. Record actual commands/results/limits. Mark only T4 complete after all done conditions pass; stop before T5.

## Runtime scope requested

Reuse installed images, compose.verification.yaml project tocaregalo-test, existing guarded TEST_DATABASE_URL and owned tmpfs MySQL plus temporary PHP/native loopback HTTP fixtures only. Guard target before any DDL/data/session operation. Actual migration/reversal, synthetic ordinary/admin accounts and race fixtures are restricted to that disposable database. No development migration/account/session mutation, browser/frontend/mail/worker runtime, keys, SMTP, dependency/image install/build/pull or secret generation. No full resolved env, raw passwords or hashes in output. Existing parameters suffice unless a genuinely missing value is discovered. Cleanup only invocation-owned resources on failure/success.

## Approval and completion

User approved execution plan v0.1 and authorized implementation plus its bounded temporary-MySQL/native HTTP/race checks. Completed with [actual evidence](./verification.md#t4-completion). The PATCH payload/status/merge/error details above are proposed technical choices within approved own-account requirements. Preparation changes documentation only; no code, branch creation, services or data operations occurred. No T5 or installation authorization is inferred.
