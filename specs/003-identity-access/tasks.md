# Tasks 003 — Identity and account access

Status: approved v0.4; T1–T7 complete; T8 execution plan and implementation separately gated
Approval (v0.4): “Apruebo estas listas y autorizo finalizar y el presentar el plan”, 2026-11-18.
Preparation authority (v0.4): “Apruebo las revisiones y autorizo actualizar las tareas afectadas”, 2026-11-18. No implementation authorization.
Approval (v0.3): “Apruebo las listas y autorizo reanudar 003:T1”, 2026-11-17. Authorizes revised 003:T1 implementation and its approved bounded temporary-MySQL checks; no later task or installation.
Revision: v0.4
Preparation authority (v0.3): “Apruebo estos planes y autorizo actualizar las listas”, 2026-11-17. Proposed lists are not approved by this preparation authorization.
Approval (v0.2): “Apruebo las listas de tareas y autorizo el inicio de 002:T9 y las instalaciones”, 2026-11-17. Approves all revised task lists and authorizes only 002:T9 and its concrete four-package installation scope.
Historical approval (v0.1): The user stated “Apruebo y autorizo iniciar la T1 de spec 002”, approving the derived-document/task package and authorizing only 002:T1 on 2026-11-16. No installation is authorized.
Derived documents: [spec](./spec.md), v0.3 synchronized from approved parent v1.2; [plan v0.4](./plan.md), approved.
Approved sources: [Spec 001 v1.2](../001-toca-regalo/spec.md), [Plan 001 v0.5](../001-toca-regalo/plan.md)
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

- [x] **T4. Implement authenticated own-account changes and creation boundary.** FR-3, FR-4, FR-5, FR-22, FR-29, NFR-10
  - Depends on: T3.
  - Work: Implement ordinary-user creation service and own-data/password updates with actor policies and validation. Do not expose owner-dependent account creation before group authorization exists.
  - Files/responsibility: backend/src/Application/; backend/src/Api/; backend/tests/Functional/.
  - Done when: Own updates and password verification pass; unauthorized other-member edits fail; normal creation produces USER only; duplicate races produce field errors.
  - Evidence: Complete with backend 73 tests/621 assertions, PHPStan level 10 zero errors and recorded checks; see [T4 evidence](./verification.md#t4-completion). Historical details are retained there.

- [x] **T5. Implement recovery token lifecycle.** FR-28, FR-4, NFR-10
  - Depends on: T4.
  - Work: Generate random single-use tokens stored as hashes; configurable one-hour default, latest-link supersession, consumption and password reset.
  - Files/responsibility: backend/src/Application/; backend/src/Infrastructure/Doctrine/; backend/tests/Unit/; backend/tests/Integration/.
  - Done when: Controlled-clock tests prove expiry, supersession and reuse rejection; valid reset changes the password and permits login; raw tokens never appear in persistence/logs.
  - Evidence: Complete under approved execution plan v0.1: backend 88 tests/812 assertions, four real races, rollback/native login, PHPStan level 10 zero errors and 80 syntax/container/12 YAML checks pass. See [T5 evidence](./verification.md#t5-completion). Stop before T6.

- [x] **T6. Deliver recovery email through durable mail infrastructure.** FR-13, FR-28, FR-34, NFR-7, NFR-10
  - Depends on: T5.
  - Work: Integrate recovery/reset JSON adapters and atomic issuance/supersession, authenticated encrypted delivery work and ID-only Messenger enqueue on one MySQL connection. Use approved RECOVERY_DELIVERY_KEY from the private shared dotenv, independent of assignment keys/APP_SECRET; validate before credential mutation. Implement authoritative stale guards, stable Message-ID, synchronous Mailer handoff, sanitized retry status and terminal envelope purging. Messenger alone owns five retries; assignment rendering remains 006.
  - Files/responsibility: backend/src/Application/Recovery/ and Port/; backend/src/Api/; backend/src/Infrastructure/Mail/ and Doctrine/; backend/config/routes.yaml, services.yaml, doctrine/ and packages/messenger.yaml; new explicit migrations; environment templates and existing runtime/test wrappers where needed; backend/tests/; README.md and technical operations/security documentation.
  - Done when: Mailpit captures a usable link and native reset/login succeeds; retry/restart preserves the same token; real MySQL failures roll back token/work/queue together; superseded, consumed, expired and deleted-account work cannot send after its authoritative stale check. Queue/failure/log/status output contains no raw token/key/link. Fresh nonces, request/delivery identity binding, tampering/wrong/missing-key failure and successful/terminal/stale envelope purging are verified. Existing credential/profile/role policy remains unchanged; no second queue or scheduler, no exactly-once SMTP claim. Document single-active-key backup and drain/cancel/purge-before-replacement procedure, without generating real keys under planning approval. Full relevant regressions and fixed PHPStan level 10 pass. Exact JSON/URL contracts and bounded runtime operations require finalized T6 execution-plan approval.
  - Evidence: Complete under approved execution plan v0.3: final mail suite 105 tests/1084 assertions, PHPStan level 10 zero errors, 96 syntax/container/12 YAML and static checks pass. See [T6 evidence](./verification.md#t6-completion). Stop before T7.

- [x] **T7. Implement login and recovery/reset screens.** FR-3, FR-4, FR-15, FR-28, FR-35, NFR-2, NFR-5, NFR-6, NFR-8, NFR-10
  - Depends on: T6.
  - Work: Create Vue forms, phone wrapper with restricted input, session route guards and logout; successful login enters the dashboard route shell.
  - Files/responsibility: frontend/src/views/; frontend/src/plugins/phone.js; frontend/src/composables/; frontend/tests/.
  - Done when: Typing/paste, loading/errors and keyboard component tests pass; browser login/logout/reset succeeds on desktop/mobile; no registration/verification link.
  - Evidence: Complete under approved execution plan v0.1: frontend 28 tests, real identity E2E 24 tests/four profiles, foundation E2E 8 tests, full backend/mail 105 tests/1084 assertions, build/static/97 PHP syntax/container/12 YAML and PHPStan level 10 zero errors pass. See [T7 evidence](./verification.md#t7-completion). Stop before T8.

- [ ] **T8. Implement responsive own-account editing.** FR-3, FR-4, FR-29, NFR-5, NFR-6, NFR-8, NFR-10
  - Depends on: T7.
  - Work: Create own-data/password form bound to JSON API, required/unique errors and exact password handling; omit delete until 007.
  - Files/responsibility: frontend/src/views/AccountView.vue; frontend/src/api/; tests/e2e/.
  - Done when: Logged-in profile/password changes work in browser, unauthorized edits remain denied, and mobile/keyboard labels and errors are verified.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T9. Verify identity privacy and record slice evidence.** FR-3, FR-4, FR-5, FR-13, FR-15, FR-22, FR-28, FR-29, FR-30, FR-34, FR-35, NFR-1, NFR-2, NFR-4, NFR-5, NFR-6, NFR-7, NFR-8, NFR-10
  - Depends on: T8.
  - Work: Run focused account/API/command/browser regressions, inspect DTOs/logs for credentials, and record partial owner/draw coverage explicitly. Consolidate T6's environment-key/encrypted-delivery, atomic enqueue, same-token retry, stale cancellation, terminal purging and non-disclosure evidence against approved parent plan v0.5 / derived plan v0.4; verify current combined recovery/browser behavior without claiming unfinished assignment delivery.
  - Files/responsibility: specs/003-identity-access/verification.md; backend/tests/; tests/e2e/.
  - Done when: Identity acceptance cases pass with evidence, including usable captured recovery links and secret/token privacy under the approved delivery design; group-owner creation, assignment notifications/dashboard and deletion remain labelled downstream rather than fulfilled. Preserve T1–T5 historical evidence and distinguish internal lifecycle checks from current full recovery-flow verification; fixed PHPStan level 10 remains required.
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

## T4 completion — latest boundary

T4 complete under approved execution plan v0.1 and “apruebo el plan y autorizo su implementación”, 2026-11-18. [Evidence](./verification.md#t4-completion): backend 73/621 including real unique races/native HTTP, PHPStan level 10 zero errors, 66 syntax/container/12 YAML checks pass. Internal ordinary creation only; owner/group and UI flows remain pending. Project total 14 complete/42 pending. Stop before T5; continuation prepares/presents its execution plan for explicit approval and implementation/runtime authorization.

## T5 completion — latest boundary

T5 complete under [execution plan v0.1](./t5-execution-plan.md), approved with “Apruebo el plan y autorizo su implementación”, 2026-11-18. [Evidence](./verification.md#t5-completion): backend 88/812 including controlled-clock boundaries, four real connection races, actual SQL rollback and native login; PHPStan level 10 zero errors, 80 syntax/container/12 YAML checks pass. Lifecycle only; HTTP/email integration remains T6 and UI T7. Project total 15 complete/41 pending. Stop before T6 and require its execution-plan approval and implementation/runtime authorization.

## Recovery delivery task revision — v0.4 proposed

Preparation authority: “Apruebo las revisiones y autorizo actualizar las tareas afectadas”, 2026-11-18. Implements approved parent plan v0.5 / derived plan v0.4 under unchanged Spec 001 v1.2 / derived spec v0.3. Changed pending tasks: T6 delivery/JSON/secret/atomicity scope and done conditions; T9 consolidated regression/privacy evidence. T1–T5 remain complete with their recorded evidence; T7/T8 behavior, IDs and dependencies remain unchanged. Nine local tasks: five complete, four pending. Project total remains 56, 15 complete/41 pending.

No block 002 task reopened and no assignment-key/file policy change in 005:T2. No task or package added. Existing requirements retain their traceability: T6 recovery portions of FR-13/28/34 and NFR-7/10; T9 consolidates all listed identity acceptance, including FR-4 password consumers. These changed task conditions are proposals, not approved by document-preparation authority. No implementation/check has been executed for T6.

Next: obtain approval of task list v0.4 and parent index v0.5 and authorization to finalize/present T6 execution plan. Its exact API/link details, concrete files, runtime/test-secret operations and limits require that later explicit approval before implementation. No key generation, dotenv mutation, installation, real database/account changes, runtime, commit/push or T7 authorized.

### v0.4 approval — latest boundary

User stated “Apruebo estas listas y autorizo finalizar y el presentar el plan”, 2026-11-18, approving displayed tasks v0.4 / parent index v0.5 and authorizing final T6 execution-plan preparation/presentation only. Earlier pending-task-approval statements are historical. Await approval and explicit implementation/runtime authorization for finalized T6 execution plan; no key generation or installation inferred.

## T6 completion — latest boundary

T6 complete under execution plan v0.3 approved with “apruebo el plan y su implementación”, 2026-11-18. [Evidence](./verification.md#t6-completion): final mail suite 105/1084 including current backend, real worker/SMTP races, durable same-token retry and crash-window count recovery, SQL rollback/key/privacy/schema checks; PHPStan level 10 zero errors, 96 syntax/container/12 YAML and static checks pass. Six local tasks complete, three pending. Project total 16 complete/40 pending. Stop before T7; prepare/present its execution plan on continuation and await explicit approval/implementation/runtime authorization. No real key provisioned or main development recovery readiness claim; no installation, external mail, commit or push.

## T7 completion — latest boundary

User approved [execution plan v0.1](./t7-execution-plan.md) and implementation with “Apruebo el plan y la implementación”, 2026-11-18. [Evidence](./verification.md#t7-completion): Vue 28 tests, real identity browser 24 cases/four profiles, foundation browser eight cases/four profiles, full backend/mail 105/1084, build/static/97 syntax/container/12 YAML/editor and PHPStan fixed level 10 zero errors pass. Local phone fallback preserves the approved phone policy; no package added. Temporary graph/private test env material removed; real development provisioning remains pending. Seven local tasks complete/two pending; project 17 complete/39 pending. Stop before T8 and require its execution-plan approval and implementation/runtime authorization. No automatic slice Validation, installation, commit or push.
