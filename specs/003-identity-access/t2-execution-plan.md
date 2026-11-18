# 003:T2 — Interactive SUPER ADMIN execution plan

Revision: v0.1
Status: executed; T2 complete with evidence and scope limits
Approval: "Apruebo el plan y su implementación", 2026-11-18, approves v0.1 and its temporary-MySQL/PTY checks.
Date: 2026-11-18
Preparation authority: “Continúa con la siguiente tarea”.
Sources: approved parent Spec 001 v1.2 / Plan 001 v0.4, derived Spec/Plan/Tasks 003 v0.3, FR-3/4/22/30, AC-3/4/30, NFR-5/10, supplied reference and bootstrap-command-review.md. T1 is complete with SQL/PHP lastName alignment. Original supplied command is available in conversation; do not request it again.

## Outcome and limits

Implement app:user:create-super-admin as an interactive Symfony command using Spanish prompts/messages and App namespaces. Collect email, required firstName/phone, optional lastName and hidden confirmed password. Reuse current normalization, Symfony email validation, minimum six characters / maximum 4096 UTF-8 bytes and Symfony auto hasher. Password whitespace remains exact; no account verification, public registration, role management or authentication flow.

Reject noninteractive execution with INVALID before persistence. Preserve reference behavior: at most three attempts per question, hidden password with visible fallback disabled, confirmation using hash_equals, sanitized duplicate/database errors and SUCCESS/FAILURE/INVALID exit codes. Duplicate normalized email/phone never modifies or promotes an existing account. EOF/cancellation/invalid input does not create an account. Missing SUPER ADMIN role is created only as part of successful creation; existing role is reused. No implicit real bootstrap or migration during task checks.

## Branch and prerequisites

Observed local dev is clean and HEAD equals dev at becf830790de503ce3823399bfce4ab09fa0ab7f during preparation. After approval rerun git status --short --branch; create feature/003_T02_super-admin-command from then-current local dev preserving this plan/MEMORY. Stop if switching would overwrite edits. No commit, push, merge, reset, restore or stash. If T1 prerequisites have changed, assess rather than claim prior evidence covers new code.

## Files and responsibilities

| Paths | Responsibility |
| --- | --- |
| backend/src/Command/CreateSuperAdminCommand.php | Interactive console questions, hidden-input policy, Spanish messages and exit handling; delegates creation through application boundary. |
| backend/src/Application/User/ and Application/Port/ as needed | Bootstrap orchestration and narrowly scoped atomic creation contract; reuse existing PasswordService and normalized profile rules. No generic role-management use case. |
| backend/src/Infrastructure/Doctrine/ | Atomic bootstrap adapter: lookup existing role, persist missing role and new user association, flush/commit together; database uniqueness remains authoritative. |
| backend/src/Infrastructure/Validation/ | Reuse UserInputValidator; add narrow prompt validation helpers only if needed, without duplicating domain rules. |
| backend/config/services.yaml | Register only command/bootstrap services and required port binding. |
| backend/tests/Unit/, Functional/, Integration/, Support/ | Command input/exit, atomic persistence and real hidden terminal behavior with isolated fixtures. Share existing guarded migration setup if useful without weakening guards. |
| README.md, docs/development.md | Spanish command usage and English technical preconditions/limits; no automatic execution or real credentials. |
| specs/003-identity-access/verification.md, tasks.md, MEMORY.md, AGENTS.md | Actual results, approval, scope limits and next boundary. |

Keep domain framework-independent. Do not add security interfaces/ORM attributes there, install packages, change schema/locks, or broaden T3 sessions/API work. New owned PHP stays within the existing full PHPStan scope.

## Design and sequence

1. Add behavior tests first for missing command/bootstrap behavior; record meaningful initial failures. Reuse existing FR-3/4 policy tests instead of recreating their implementation assertions.
2. Implement questions and validation with existing Symfony components. Prompt fields normalize only under existing rules. Never accept credentials through command options or print raw passwords/hashes. Only pass validated profile and hashed password into persistence.
3. Implement the application/atomic persistence boundary. Existing repository saveRole/save each flush separately; do not concatenate them without a transaction. The bootstrap adapter must create role/user/join rows in one transaction/flush, roll back on failure and never update an existing account. Reject duplicate email/phone early for friendly feedback, then catch database uniqueness races with sanitized retry guidance. Do not retry by granting an existing user privileges.
4. Verify functional cases through Symfony CommandTester and real isolated MySQL: missing/existing role, required/optional fields, canonical email/phone duplicates, password confirmation/mismatch/attempt exhaustion, six-character/category/Unicode/4096-byte acceptance and oversized rejection, no plaintext/verification attributes. Confirm stored hash verifies and rollback leaves no partial account/role on failure.
5. Run a bounded real pseudo-terminal fixture using installed PHP proc_open/PTY support to verify hidden input does not echo and spaces survive; CommandTester alone cannot establish terminal echo behavior. Use synthetic credentials only and no raw secret transcript in recorded logs. If PTY unavailable, report the missing evidence without silently installing tools or treating buffered input as an equivalent check.
6. Run scripts/check backend including existing T1 regressions with guarded temp MySQL, syntax/container/YAML checks, then final scripts/check phpstan at fixed level 10 on all owned PHP including tests/migrations, zero errors/no baseline. Review error sanitization, diff, diagnostics and requirement traceability.
7. Confirm cleanup and dotenv/manifests/locks unchanged; record actual commands/results/limitations. Complete only T2 after all its conditions pass, then stop before T3. No automatic real SUPER ADMIN creation.

## Runtime scope requested

Reuse installed images and compose.verification.yaml explicit project tocaregalo-test with existing TEST_DATABASE_URL, owned tmpfs MySQL and temporary PHP containers only. Existing wrapper refuses pre-existing resources and checks database target before DDL/fixtures. Apply actual migrations and synthetic command fixtures only there, reverse/drop only owned identity schema, clean owned containers/network/lock on success/failure. No development database connection/migration/account operation, browser/frontend/mail/worker runtime, keys, SMTP, image pull/build, package install or network dependency resolution. Root private dotenv is read-only, never printed or overwritten. Existing parameters suffice unless inspection shows a missing value.

## Acceptance and approval

FR-3/AC-3: required fields, nullable lastName, normalized uniqueness. FR-4/AC-4: exact password policy/hash, reject oversized input without account mutation. FR-22/30/AC-30: only command creates SUPER ADMIN, missing role created atomically, no existing user overwrite/verification. NFR-10: final zero-error fixed-level analysis. Real application login and role authorization remain T3 and later; command evidence does not fulfill those flows.

Approve execution plan v0.1 and authorize implementation plus the bounded temporary-MySQL/PTY checks described above. Preparation changes documentation only; no services, migrations, accounts, installations or branch creation executed.

## Inspected baseline clarification

Current committed dev uses PHP lastName with SQL last_name in both the initial migration and external ORM mapping. Preserve that source baseline; older naming evidence is historical. T2 does not rename schema columns. Initial fixture query was corrected to match this inspected schema.

## Completion

See [T2 evidence](./verification.md#t2--interactive-super-admin-completion): final backend 59 tests/286 assertions, real MySQL and PTY checks, zero-error level-10 analysis and syntax/configuration checks pass; resources removed. No real bootstrap executed. Stop before T3.
