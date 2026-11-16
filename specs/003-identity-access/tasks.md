# Tasks 003 — Identity and account access

Status: approved; individual task execution remains separately gated
Revision: v0.1
Approval: The user stated “Apruebo y autorizo iniciar la T1 de spec 002”, approving the derived-document/task package and authorizing only 002:T1 on 2026-11-16. No installation is authorized.
Derived documents: [spec v0.1](./spec.md), [plan v0.1](./plan.md), both approved
Approved sources: [Spec 001 v1.0](../001-toca-regalo/spec.md), [Plan 001 v0.1](../001-toca-regalo/plan.md)
Execution authorization: only 002:T1 is authorized. All other tasks and every package/image/browser installation require separate authorization.

## Execution rules

Task IDs are qualified as 003:Tn across blocks; unqualified Tn references are local. Execute one explicitly authorized task at a time, with its prerequisite checks satisfied. Each task includes its applicable tests/checks and actual evidence when run. Do not mark product requirements fulfilled based on partial supporting work; No global account deletion until 007. Ordinary-user creation is an application boundary exercised with fixtures here; its owner/group entry point is completed in 004. Final assignment dashboard and assignment-delivery acceptance remain in 006.

No dependency installation, image pull/build requiring packages, or browser download without separate explicit user authorization. Do not hide installation in startup/check scripts. A fixture-only test cannot replace real MySQL/privacy/browser evidence required by the parent.

## Proposed tasks

- [ ] **T1. Implement normalized user values and persistence constraints.** FR-3, FR-4, NFR-1
  - Depends on: 002:T8.
  - Work: Write behavioral tests for trim/email/phone/password rules; implement pure normalizers, Symfony validation adapter, external user/role mappings and unique normalized indexes.
  - Files/responsibility: backend/src/Domain/User/; backend/src/Infrastructure/Doctrine/; backend/config/doctrine/; backend/migrations/.
  - Done when: Missing/duplicate/case/format tests pass against real MySQL; passwords retain exact entered characters and policy accepts six-character category variants.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T2. Adapt and verify the interactive SUPER ADMIN command.** FR-3, FR-4, FR-22, FR-30
  - Depends on: T1.
  - Work: Adapt supplied reference with required first name/phone, optional surnames, confirmed hidden password and role creation if missing; omit account verification.
  - Files/responsibility: backend/src/Command/; backend/tests/Functional/.
  - Done when: Interactive fixtures cover missing role, duplicates, validation, confirmation and failure exits; no existing user is overwritten or verified.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T3. Implement session authentication and logout JSON contracts.** FR-15, FR-22, FR-35, NFR-4
  - Depends on: T2.
  - Work: Implement identifier login, session actor projection, CSRF and explicit logout with same-origin cookies; no public registration.
  - Files/responsibility: backend/src/Infrastructure/Security/; backend/src/Api/; backend/config/packages/.
  - Done when: Email and cleaned-phone login succeed, invalid credentials fail, logout invalidates old-session access, and forged role/owner input grants no privilege.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T4. Implement authenticated own-account changes and creation boundary.** FR-3, FR-4, FR-5, FR-22, FR-29
  - Depends on: T3.
  - Work: Implement ordinary-user creation service and own-data/password updates with actor policies and validation. Do not expose owner-dependent account creation before group authorization exists.
  - Files/responsibility: backend/src/Application/; backend/src/Api/; backend/tests/Functional/.
  - Done when: Own updates and password verification pass; unauthorized other-member edits fail; normal creation produces USER only; duplicate races produce field errors.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T5. Implement recovery token lifecycle.** FR-28
  - Depends on: T4.
  - Work: Generate random single-use tokens stored as hashes; configurable one-hour default, latest-link supersession, consumption and password reset.
  - Files/responsibility: backend/src/Application/; backend/src/Infrastructure/Doctrine/; backend/tests/Unit/; backend/tests/Integration/.
  - Done when: Controlled-clock tests prove expiry, supersession and reuse rejection; valid reset changes the password and permits login; raw tokens never appear in persistence/logs.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T6. Deliver recovery email through durable mail infrastructure.** FR-13, FR-28, FR-34, NFR-7
  - Depends on: T5.
  - Work: Implement foundational transactional message-ID transport/retry status needed for recovery, guarding expiry/supersession before handoff; assignment rendering remains 006.
  - Files/responsibility: backend/src/Infrastructure/Mail/; backend/config/packages/messenger.yaml; backend/tests/Integration/.
  - Done when: Mailpit captures a usable link; transport failure does not regenerate credentials, guards suppress stale reset delivery, and no second hidden mail queue is introduced.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T7. Implement login and recovery/reset screens.** FR-3, FR-15, FR-28, FR-35, NFR-2, NFR-5, NFR-6, NFR-8
  - Depends on: T6.
  - Work: Create Vue forms, phone wrapper with restricted input, session route guards and logout; successful login enters the dashboard route shell.
  - Files/responsibility: frontend/src/views/; frontend/src/plugins/phone.js; frontend/src/composables/; frontend/tests/.
  - Done when: Typing/paste, loading/errors and keyboard component tests pass; browser login/logout/reset succeeds on desktop/mobile; no registration/verification link.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T8. Implement responsive own-account editing.** FR-3, FR-4, FR-29, NFR-5, NFR-6, NFR-8
  - Depends on: T7.
  - Work: Create own-data/password form bound to JSON API, required/unique errors and exact password handling; omit delete until 007.
  - Files/responsibility: frontend/src/views/AccountView.vue; frontend/src/api/; tests/e2e/.
  - Done when: Logged-in profile/password changes work in browser, unauthorized edits remain denied, and mobile/keyboard labels and errors are verified.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T9. Verify identity privacy and record slice evidence.** FR-3, FR-4, FR-5, FR-13, FR-15, FR-22, FR-28, FR-29, FR-30, FR-34, FR-35, NFR-1, NFR-2, NFR-4, NFR-5, NFR-6, NFR-7, NFR-8
  - Depends on: T8.
  - Work: Run focused account/API/command/browser regressions, inspect DTOs/logs for credentials, and record partial owner/draw coverage explicitly.
  - Files/responsibility: specs/003-identity-access/verification.md; backend/tests/; tests/e2e/.
  - Done when: Identity acceptance cases pass with evidence; group-owner creation, assignment notifications/dashboard and deletion remain labelled downstream rather than fulfilled.
  - Evidence: not executed; no completion or passing result claimed.

## Traceability and acceptance

See [plan traceability](./plan.md#traceability). FR-N maps to parent AC-N; NFR acceptance conditions are inherited verbatim in [spec](./spec.md). All 9 tasks are pending; no checks have been executed.

## Phase boundary

After the last task, report evidence/limitations and request authorization for the next task/block as applicable. Final read-only application Validation requires its own authorization and the installed sdd-code-review workflow. Do not mark the parent specification implemented before accepted fulfilled Validation.

