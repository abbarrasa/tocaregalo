# Tasks 006 — Notifications and private dashboard

Status: approved; task execution remains separately gated
Revision: v0.2
Approval (v0.2): “Apruebo las listas de tareas y autorizo el inicio de 002:T9 y las instalaciones”, 2026-11-17. Approves all revised task lists and authorizes only 002:T9 and its concrete four-package installation scope.
Historical approval (v0.1): The user stated “Apruebo y autorizo iniciar la T1 de spec 002”, approving the derived-document/task package and authorizing only 002:T1 on 2026-11-16. No installation is authorized.
Derived documents: [spec](./spec.md), synchronized from approved parent v1.1; [plan v0.2](./plan.md), approved.
Approved sources: [Spec 001 v1.1](../001-toca-regalo/spec.md), [Plan 001 v0.2](../001-toca-regalo/plan.md)
Execution authorization: no task in this block is authorized. Upstream 002:T9 and its installation were authorized separately; follow prerequisite and per-task approval gates.

## Execution rules

Revision preparation authorized by “Apruebo estas revisiones y autorizo actualizar las tareas” on 2026-11-17. This v0.2 task list is approved under the approval evidence above. Every pending task carries NFR-10: before completion, run fixed PHPStan level 10 on all project-owned PHP including tests, with zero errors and no concealing baseline; record command/configuration/version/result. Failed or unavailable analysis blocks completion. Earlier checked tasks retain historical evidence under their original scope.

Task IDs are qualified as 006:Tn across blocks; unqualified Tn references are local. Execute one explicitly authorized task at a time, with its prerequisite checks satisfied. Each task includes its applicable tests/checks and actual evidence when run. Do not mark product requirements fulfilled based on partial supporting work; No other-user assignment disclosure through management or status/resend. Account-deletion end-to-end consequences remain in 007; recovery delivery is regression-tested, not redefined.

No dependency installation, image pull/build requiring packages, or browser download without separate explicit user authorization. Do not hide installation in startup/check scripts. A fixture-only test cannot replace real MySQL/privacy/browser evidence required by the parent.

## Proposed tasks

- [ ] **T1. Render assignment and insufficient-member notifications privately.** FR-13, FR-14, FR-25, FR-26, NFR-5, NFR-7, NFR-10
  - Depends on: 005:T10.
  - Work: Implement ID-based current-state renderers and synchronous SMTP handoff inside worker; recipient decrypt occurs only for the addressed member's message.
  - Files/responsibility: backend/src/Infrastructure/Mail/; backend/tests/Integration/.
  - Done when: Mailpit captures event/recipient first name/optional surnames and insufficient-participant messages; database queue contains IDs/revisions but no readable assigned recipient.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T2. Implement exact exponential retries and terminal failure status.** FR-13, FR-34, NFR-10
  - Depends on: T1.
  - Work: Wire one authoritative Messenger max-five retry strategy with configurable base, multiplier two and no jitter/cap; mirror sanitized status.
  - Files/responsibility: backend/config/packages/messenger.yaml; backend/src/Infrastructure/Mail/; backend/tests/Integration/.
  - Done when: Controlled-time tests prove initial plus five sends, 30/60/120/240/480-second delays at example base, success stops, and owner/admin see no recipient in final failure status.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T3. Cancel stale queued work across replacement and closure.** FR-13, FR-25, FR-28, FR-32, FR-34, NFR-9, NFR-10
  - Depends on: T2.
  - Work: Recheck draw revision/event/account/reset-token state immediately before render/handoff; integrate closure cancellation and delivery leases.
  - Files/responsibility: backend/src/Application/; backend/src/Infrastructure/Mail/; backend/tests/Integration/.
  - Done when: Barrier tests discard superseded/closed work, reset-link expiry/supersession is guarded, no hidden second mail queue persists plaintext, and SMTP handoff limits are documented honestly.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T4. Implement authorized resend and scoped delivery-status APIs.** FR-13, FR-22, FR-34, NFR-4, NFR-10
  - Depends on: T3.
  - Work: Add self/owner-member/SUPER ADMIN resend policies for current valid unfinished assignments and sanitized failure projections.
  - Files/responsibility: backend/src/Api/; backend/src/Application/; backend/tests/Functional/.
  - Done when: Permission matrix, stale/invalid/closed denial and new-delivery-sequence tests pass without redraw or returned other-user recipient.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T5. Implement own dashboard and owned-group projections.** FR-16, FR-18, FR-22, NFR-4, NFR-10
  - Depends on: T4.
  - Work: Build dashboard DTO for own unfinished assignments and owned groups, with valid/invalid states and no management recipient leakage.
  - Files/responsibility: backend/src/Api/Resource/; backend/src/Api/State/; backend/tests/Functional/.
  - Done when: API includes only correct own cards/groups, filters finished draws, marks invalid cards, and admin has no assignment disclosure bypass.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T6. Implement private card reveal and responsive dashboard.** FR-16, FR-17, FR-18, NFR-2, NFR-5, NFR-6, NFR-8, NFR-10
  - Depends on: T5.
  - Work: Create concealed/reveal/invalid cards, owned-group card, local reveal composable and Spanish loading/empty/error states.
  - Files/responsibility: frontend/src/views/DashboardView.vue; frontend/src/components/; frontend/src/composables/; frontend/tests/.
  - Done when: Fake-clock tests prove 20 seconds from latest activation, cleanup on navigation/logout and no invalid reveal; keyboard/mobile/desktop checks pass.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T7. Connect user resend and owner/admin event delivery actions.** FR-13, FR-16, FR-21, FR-22, FR-34, NFR-5, NFR-6, NFR-8, NFR-10
  - Depends on: T6.
  - Work: Wire card resend, event draw/admin-delete and sanitized owner/admin notification failure/resend controls.
  - Files/responsibility: frontend/src/views/EventsView.vue; frontend/src/components/; tests/e2e/.
  - Done when: Browser action permission/state matrix works without exposing recipients; loading/error feedback and keyboard focus work on mobile/desktop.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T8. Verify all membership-driven email and deadline outcomes.** FR-13, FR-25, FR-26, FR-32, FR-34, NFR-7, NFR-9, NFR-10
  - Depends on: T7.
  - Work: Exercise additions/removals/minimum recovery and closure with Mailpit and controlled clocks; include recovery delivery regressions.
  - Files/responsibility: backend/tests/Integration/; tests/e2e/.
  - Done when: Each valid new revision yields correct current messages, insufficient groups are informed, stale work is discarded, and closure budget/priority pass.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T9. Record dashboard/mail privacy and browser evidence.** FR-13, FR-14, FR-16, FR-17, FR-18, FR-21, FR-22, FR-25, FR-26, FR-28, FR-32, FR-34, NFR-2, NFR-4, NFR-5, NFR-6, NFR-7, NFR-8, NFR-9, NFR-10
  - Depends on: T8.
  - Work: Run component/API/privacy suites plus approved Chromium desktop/mobile and essential Firefox/WebKit flows; record captured email and terminal-failure limits.
  - Files/responsibility: specs/006-notifications-dashboard/verification.md; frontend/tests/; tests/e2e/.
  - Done when: All scoped behaviors have actual passing evidence or explicit blockers; no claim of production SMTP or exactly-once email delivery is made.
  - Evidence: not executed; no completion or passing result claimed.

## Traceability and acceptance

See [plan traceability](./plan.md#traceability). FR-N maps to parent AC-N; NFR acceptance conditions are inherited verbatim in [spec](./spec.md). All 9 tasks are pending; no checks have been executed.

## Phase boundary

After the last task, report evidence/limitations and request authorization for the next task/block as applicable. Final read-only application Validation requires its own authorization and the installed sdd-code-review workflow. Do not mark the parent specification implemented before accepted fulfilled Validation.

