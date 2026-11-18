# Tasks 003 — Identity and account access

Status: approved v0.3; only 003:T1 resumption authorized
Approval (v0.3): “Apruebo las listas y autorizo reanudar 003:T1”, 2026-11-17. Authorizes revised 003:T1 implementation and its approved bounded temporary-MySQL checks; no later task or installation.
Revision: v0.3
Preparation authority (v0.3): “Apruebo estos planes y autorizo actualizar las listas”, 2026-11-17. Proposed lists are not approved by this preparation authorization.
Approval (v0.2): “Apruebo las listas de tareas y autorizo el inicio de 002:T9 y las instalaciones”, 2026-11-17. Approves all revised task lists and authorizes only 002:T9 and its concrete four-package installation scope.
Historical approval (v0.1): The user stated “Apruebo y autorizo iniciar la T1 de spec 002”, approving the derived-document/task package and authorizing only 002:T1 on 2026-11-16. No installation is authorized.
Derived documents: [spec](./spec.md), v0.3 synchronized from approved parent v1.2; [plan v0.3](./plan.md), approved.
Approved sources: [Spec 001 v1.2](../001-toca-regalo/spec.md), [Plan 001 v0.4](../001-toca-regalo/plan.md)
Execution authorization: T1 v0.1 implementation was authorized and remains incomplete. Approved execution plan v0.2 and these proposed task conditions require explicit task approval and T1 resumption authorization. No T2 authorization.

## Execution rules

Revision preparation authorized by “Apruebo estas revisiones y autorizo actualizar las tareas” on 2026-11-17. Historical v0.2 approval is preserved; changed v0.3 conditions await approval. Every pending task carries NFR-10: before completion, run fixed PHPStan level 10 on all project-owned PHP including tests, with zero errors and no concealing baseline; record command/configuration/version/result. Failed or unavailable analysis blocks completion. Earlier checked tasks retain historical evidence under their original scope.

Task IDs are qualified as 003:Tn across blocks; unqualified Tn references are local. Execute one explicitly authorized task at a time, with its prerequisite checks satisfied. Each task includes its applicable tests/checks and actual evidence when run. Do not mark product requirements fulfilled based on partial supporting work; No global account deletion until 007. Ordinary-user creation is an application boundary exercised with fixtures here; its owner/group entry point is completed in 004. Final assignment dashboard and assignment-delivery acceptance remain in 006.

No dependency installation, image pull/build requiring packages, or browser download without separate explicit user authorization. Do not hide installation in startup/check scripts. A fixture-only test cannot replace real MySQL/privacy/browser evidence required by the parent.

## Proposed tasks

- [x] **T1. Implement normalized user values and persistence constraints.** FR-3, FR-4, NFR-1, NFR-10
  - Depends on: 002:T8.
  - Work: Write behavioral tests for trim/email/phone/password rules; implement pure normalizers, Symfony validation adapter, external user/role mappings and unique normalized indexes.
  - Files/responsibility: backend/src/Domain/User/; backend/src/Infrastructure/Doctrine/; backend/config/doctrine/; backend/migrations/.
  - Done when: Missing/duplicate/case/format tests pass against real MySQL; passwords retain exact entered characters and policy accepts six-character category variants.
  - Evidence: complete on feature/003_T01-user-values-persistence under approved execution plan v0.2 and “Apruebo las listas y autorizo reanudar 003:T1”. Backend 53 tests/191 assertions, real guarded MySQL migration reversal/schema/uniqueness checks, eight ASCII/multibyte password-boundary cases, 36 PHP syntax checks, container/11 YAML lint and PHPStan level 10 zero errors pass. Owned runtime removed; no development mutation or installation. See [T1 evidence](./verification.md#t1-completion). Stop before T2.

- [x] **T2. Adapt and verify the interactive SUPER ADMIN command.** FR-3, FR-4, FR-22, FR-30, NFR-10
  - Depends on: T1.
  - Work: Adapt supplied reference with required first name/phone, optional surnames, confirmed hidden password and role creation if missing; omit account verification.
  - Files/responsibility: backend/src/Command/; backend/tests/Functional/.
  - Done when: Interactive fixtures cover missing role, duplicates, validation, confirmation and failure exits; no existing user is overwritten or verified.
  - Evidence: Complete under approved execution plan v0.1 on feature/003_T02_super-admin-command. Backend 59 tests/286 assertions including real MySQL atomic rollback/duplicate and real PTY hidden-input checks; PHPStan level 10 zero errors; syntax/container/11 YAML checks pass. Owned runtime removed; no real account/DDL or installation. See [T2 evidence](./verification.md#t2--interactive-super-admin-completion). Stop before T3.

- [x] **T3. Implement session authentication and logout JSON contracts.** FR-15, FR-22, FR-35, NFR-4, NFR-10
  - Depends on: T2.
  - Work: Implement identifier login, session actor projection, CSRF and explicit logout with same-origin cookies; no public registration.
  - Files/responsibility: backend/src/Infrastructure/Security/; backend/src/Api/; backend/config/packages/.
  - Done when: Email and cleaned-phone login succeed, invalid credentials fail, logout invalidates old-session access, and forged role/owner input grants no privilege.
  - Evidence: Complete under approved T3 execution plan v0.1 on feature/003_T03_session-authentication: backend 63 tests/374 assertions with real HTTP/MySQL session persistence, CSRF, rotation/logout replay, persisted role/user refresh and T1/T2 regressions; PHPStan level 10 zero errors; 53 syntax/container/12 YAML checks pass. Owned resources removed. [Evidence](./verification.md#t3-completion-and-final-actual-results). Stop before T4.

- [ ] **T4. Implement authenticated own-account changes and creation boundary.** FR-3, FR-4, FR-5, FR-22, FR-29, NFR-10
  - Depends on: T3.
  - Work: Implement ordinary-user creation service and own-data/password updates with actor policies and validation. Do not expose owner-dependent account creation before group authorization exists.
  - Files/responsibility: backend/src/Application/; backend/src/Api/; backend/tests/Functional/.
  - Done when: Own updates and password verification pass; unauthorized other-member edits fail; normal creation produces USER only; duplicate races produce field errors.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T5. Implement recovery token lifecycle.** FR-28, FR-4, NFR-10
  - Depends on: T4.
  - Work: Generate random single-use tokens stored as hashes; configurable one-hour default, latest-link supersession, consumption and password reset.
  - Files/responsibility: backend/src/Application/; backend/src/Infrastructure/Doctrine/; backend/tests/Unit/; backend/tests/Integration/.
  - Done when: Controlled-clock tests prove expiry, supersession and reuse rejection; valid reset changes the password and permits login; raw tokens never appear in persistence/logs.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T6. Deliver recovery email through durable mail infrastructure.** FR-13, FR-28, FR-34, NFR-7, NFR-10
  - Depends on: T5.
  - Work: Implement foundational transactional message-ID transport/retry status needed for recovery, guarding expiry/supersession before handoff; assignment rendering remains 006.
  - Files/responsibility: backend/src/Infrastructure/Mail/; backend/config/packages/messenger.yaml; backend/tests/Integration/.
  - Done when: Mailpit captures a usable link; transport failure does not regenerate credentials, guards suppress stale reset delivery, and no second hidden mail queue is introduced.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T7. Implement login and recovery/reset screens.** FR-3, FR-4, FR-15, FR-28, FR-35, NFR-2, NFR-5, NFR-6, NFR-8, NFR-10
  - Depends on: T6.
  - Work: Create Vue forms, phone wrapper with restricted input, session route guards and logout; successful login enters the dashboard route shell.
  - Files/responsibility: frontend/src/views/; frontend/src/plugins/phone.js; frontend/src/composables/; frontend/tests/.
  - Done when: Typing/paste, loading/errors and keyboard component tests pass; browser login/logout/reset succeeds on desktop/mobile; no registration/verification link.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T8. Implement responsive own-account editing.** FR-3, FR-4, FR-29, NFR-5, NFR-6, NFR-8, NFR-10
  - Depends on: T7.
  - Work: Create own-data/password form bound to JSON API, required/unique errors and exact password handling; omit delete until 007.
  - Files/responsibility: frontend/src/views/AccountView.vue; frontend/src/api/; tests/e2e/.
  - Done when: Logged-in profile/password changes work in browser, unauthorized edits remain denied, and mobile/keyboard labels and errors are verified.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T9. Verify identity privacy and record slice evidence.** FR-3, FR-4, FR-5, FR-13, FR-15, FR-22, FR-28, FR-29, FR-30, FR-34, FR-35, NFR-1, NFR-2, NFR-4, NFR-5, NFR-6, NFR-7, NFR-8, NFR-10
  - Depends on: T8.
  - Work: Run focused account/API/command/browser regressions, inspect DTOs/logs for credentials, and record partial owner/draw coverage explicitly.
  - Files/responsibility: specs/003-identity-access/verification.md; backend/tests/; tests/e2e/.
  - Done when: Identity acceptance cases pass with evidence; group-owner creation, assignment notifications/dashboard and deletion remain labelled downstream rather than fulfilled.
  - Evidence: not executed; no completion or passing result claimed.

## Traceability and acceptance

See [plan traceability](./plan.md#traceability). FR-N maps to parent AC-N; NFR acceptance conditions are inherited verbatim in [spec](./spec.md). T1–T3 are complete; six tasks remain pending. No later task checks have been executed.

## Phase boundary

After the last task, report evidence/limitations and request authorization for the next task/block as applicable. Final read-only application Validation requires its own authorization and the installed sdd-code-review workflow. Do not mark the parent specification implemented before accepted fulfilled Validation.


## Password boundary revision (v0.3) — proposed

Implements approved parent Spec 001 v1.2 FR-4/AC-4 and approved parent plan v0.4. Preserve existing IDs, dependencies and completion evidence; no new task or installation. Project total remains 56 tasks: ten complete, 46 incomplete (including in-progress 003:T1). Changed conditions below supplement the existing task definitions and require approval before execution.

| Task | Additional work and done condition |
| --- | --- |
| T1 | Test first and enforce the shared six-character minimum and 4096 UTF-8 byte maximum without trimming; ASCII/multibyte 4096-byte input hashes and verifies, 4097-byte input fails before hashing/persistence. Rerun guarded temporary-MySQL backend regressions, relevant lint and final full-scope PHPStan level 10. Record actual evidence before completion. |
| T2 | Bootstrap uses the same boundary; oversized input creates no account and leaves existing credentials unchanged. Hidden input/confirmation behavior remains required. |
| T4 | Ordinary creation and own-password changes use the shared policy; oversized input creates no account and does not modify existing passwords. |
| T5 | Recovery reset uses FR-4; oversized input leaves the existing password unchanged. Existing token lifecycle requirements remain applicable. |
| T7 | Reset form reports the boundary through Spanish associated field errors; backend byte checks remain authoritative. Add FR-4 to this task's traceability. |
| T8 | Own-password form verifies byte-boundary errors and exact whitespace on mobile/desktop under existing browser profiles. |
| T9 | Consolidate AC-4 boundary and consumer no-mutation evidence; do not claim shared-policy tests prove unfinished user flows. |

## Latest completion boundary

003:T1 is complete; T2 remains unauthorized. On continuation prepare and present its execution plan and await explicit approval. Project total: 56 tasks, 11 complete and 45 pending. Historical pre-completion counts and pending approvals above are superseded by this boundary.

### Approved T1 lastname refactor — 2026-11-18

Approved execution plan v0.1 with “apruebo el plan y autorizo la implementación”. PHP identifiers now use `lastname`; external mapping retains SQL `surnames`. [Naming evidence](./verification.md#t1-naming-revision--2026-11-18): backend 53/191, ORM parity/migrations, 36 syntax checks, container/11 YAML lint and PHPStan level 10 zero errors pass; temporary resources removed. T1 remains complete, no new task or T2 execution.

### Approved T1 lastName casing correction — 2026-11-18

Approved casing execution plan v0.1 with “aprueblo el plan y su implementación”. Identifiers now use exactly lastName; SQL surnames retained. [Current evidence](./verification.md#t1-lastname-casing-revision--2026-11-18): backend 53/191, real MySQL migration/ORM checks, 36 syntax/container/11 YAML checks and PHPStan level 10 zero errors pass. Runtime cleaned. T1 remains complete; no new task or T2 authorization.

### Approved T1 lastName SQL alignment — 2026-11-18

Approved SQL execution plan v0.1 with “Apruebo el plan y la implementación”. Initial migration and ORM column now use lastName, superseding earlier retained surnames decisions. [Evidence](./verification.md#t1-lastname-sql-alignment--2026-11-18): backend 53/191, real migration/ORM parity, syntax/container/11 YAML and fixed level-10 analysis pass; temporary runtime removed. No persistent schema migration performed. T1 complete; no T2.

## T2 completion — latest boundary

T2 complete on feature/003_T02_super-admin-command; counts 12 complete/44 pending project-wide. No T3 authorization. On continuation prepare/present its execution plan and await explicit approval. Previous stop-before-T2 statements remain historical.

## T3 completion — latest boundary

T3 complete; project total 13 complete/43 pending. No T4 authorization. On continuation prepare/present its task-specific execution plan and await explicit approval. Historical stop-before-T3 entries are superseded.
