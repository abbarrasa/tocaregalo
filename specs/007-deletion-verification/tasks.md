# Tasks 007 — Account deletion and application verification

Status: approved; task execution remains separately gated
Revision: v0.2
Approval (v0.2): “Apruebo las listas de tareas y autorizo el inicio de 002:T9 y las instalaciones”, 2026-11-17. Approves all revised task lists and authorizes only 002:T9 and its concrete four-package installation scope.
Historical approval (v0.1): The user stated “Apruebo y autorizo iniciar la T1 de spec 002”, approving the derived-document/task package and authorizing only 002:T1 on 2026-11-16. No installation is authorized.
Derived documents: [spec](./spec.md), synchronized from approved parent v1.1; [plan v0.2](./plan.md), approved.
Approved sources: [Spec 001 v1.1](../001-toca-regalo/spec.md), [Plan 001 v0.2](../001-toca-regalo/plan.md)
Execution authorization: no task in this block is authorized. Upstream 002:T9 and its installation were authorized separately; follow prerequisite and per-task approval gates.

## Execution rules

Revision preparation authorized by “Apruebo estas revisiones y autorizo actualizar las tareas” on 2026-11-17. This v0.2 task list is approved under the approval evidence above. Every pending task carries NFR-10: before completion, run fixed PHPStan level 10 on all project-owned PHP including tests, with zero errors and no concealing baseline; record command/configuration/version/result. Failed or unavailable analysis blocks completion. Earlier checked tasks retain historical evidence under their original scope.

Task IDs are qualified as 007:Tn across blocks; unqualified Tn references are local. Execute one explicitly authorized task at a time, with its prerequisite checks satisfied. Each task includes its applicable tests/checks and actual evidence when run. Do not mark product requirements fulfilled based on partial supporting work; Direct implementation focuses on FR-2/12/14/22/23/24/25/26/27/32; other FR/NFR are complete-regression scope, not new implementation. No automatic corrective work, final acceptance or validation approval is implied.

No dependency installation, image pull/build requiring packages, or browser download without separate explicit user authorization. Do not hide installation in startup/check scripts. A fixture-only test cannot replace real MySQL/privacy/browser evidence required by the parent.

## Proposed tasks

- [ ] **T1. Implement encrypted recipient-reference null cleanup.** FR-14, FR-23, NFR-10
  - Depends on: 006:T9.
  - Work: Compute versioned per-draw HMAC matches and null recipient envelope/token fields; combine with real giver FK SET NULL in transactional cleanup.
  - Files/responsibility: backend/src/Infrastructure/Crypto/; backend/src/Infrastructure/Doctrine/; backend/tests/Integration/.
  - Done when: Old/current-key fixtures and giver/recipient references clear correctly without decrypting or storing plaintext FK; missing keys fail before destructive partial changes.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T2. Implement confirmed self/admin account deletion and owned-data cascades.** FR-2, FR-12, FR-22, FR-23, FR-27, NFR-10
  - Depends on: T1.
  - Work: Wire actor authorization, confirmation and shared lock ordering across account/group/event deletion, preserving other member accounts.
  - Files/responsibility: backend/src/Application/; backend/src/Api/; backend/tests/Integration/.
  - Done when: Self/admin/nonadmin matrix, confirmation cancellation and owned-group/event/draw/work cascades pass; other users and their unrelated data remain.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T3. Integrate surviving-group redraw/invalidation and email cancellation.** FR-13, FR-14, FR-23, FR-24, FR-25, FR-26, FR-27, FR-32, FR-34, NFR-10
  - Depends on: T2.
  - Work: Complete atomic cleanup plus membership removal and draw/email consequences, honoring closure before replacement.
  - Files/responsibility: backend/src/Application/; backend/tests/Integration/; backend/tests/Functional/.
  - Done when: Deletion with at least three versus below three, recovery, finished references/nulls and concurrent membership/closure tests pass with correct current notifications and no partial state.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T4. Implement own and admin account-deletion interfaces.** FR-19, FR-22, FR-23, FR-27, FR-29, NFR-5, NFR-6, NFR-8, NFR-10
  - Depends on: T3.
  - Work: Expose approved self/admin deletion flows, cascade/member previews, special insufficient warning and session outcome; owners cannot delete other accounts.
  - Files/responsibility: frontend/src/views/AccountView.vue; frontend/src/views/UsersView.vue; tests/e2e/.
  - Done when: Desktop/mobile/keyboard browser tests cover cancel/confirm and permission denial; confirmed deletion removes access and doesn't expose assignments.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T5. Exercise key backup/restore and encrypted-data operations.** FR-14, FR-23, NFR-3, NFR-7, NFR-10
  - Depends on: T4.
  - Work: Document approved key provisioning/version/backup/rotation/restore procedure and exercise it on an isolated encrypted database fixture; never commit secret material.
  - Files/responsibility: docs/security-operations.md; backend/tests/Integration/; specs/007-deletion-verification/verification.md.
  - Done when: Offline fixture restore decrypts/looks up/deletes correctly with retained key versions; wrong/missing-key handling fails safely; secrets remain outside repository/logs.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T6. Complete backend and concurrency acceptance coverage.** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-19, FR-20, FR-21, FR-22, FR-23, FR-24, FR-25, FR-26, FR-27, FR-28, FR-29, FR-30, FR-31, FR-32, FR-33, FR-34, FR-35, NFR-1, NFR-3, NFR-4, NFR-7, NFR-9, NFR-10
  - Depends on: T5.
  - Work: Run required domain/integration/API/command regressions and concurrency/deadline cases; assemble all AC evidence. Findings are recorded, not silently repaired outside an authorized task.
  - Files/responsibility: backend/tests/; specs/001-toca-regalo/verification.md.
  - Done when: Every backend-applicable parent AC/NFR has actual results and references; failures remain explicit and block completion rather than being marked passed.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T7. Complete frontend/build/browser and documentation verification.** FR-1, FR-2, FR-3, FR-5, FR-6, FR-7, FR-8, FR-9, FR-13, FR-15, FR-16, FR-17, FR-18, FR-19, FR-20, FR-21, FR-22, FR-23, FR-24, FR-27, FR-28, FR-29, FR-31, FR-35, NFR-2, NFR-3, NFR-5, NFR-6, NFR-7, NFR-8, NFR-10
  - Depends on: T6.
  - Work: Run approved component/build/browser profiles and Spanish user/English technical documentation checks; verify reproducible local setup/capture without production credentials.
  - Files/responsibility: frontend/tests/; tests/e2e/; README.md; docs/; specs/001-toca-regalo/verification.md.
  - Done when: All UI-applicable acceptance rows have evidence, manifests contain no Twig, keyboard/labels/viewport checks pass or are blocked explicitly, and no deployment is claimed.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T8. Assemble the validation handoff without performing final review.** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-19, FR-20, FR-21, FR-22, FR-23, FR-24, FR-25, FR-26, FR-27, FR-28, FR-29, FR-30, FR-31, FR-32, FR-33, FR-34, FR-35, NFR-1, NFR-2, NFR-3, NFR-4, NFR-5, NFR-6, NFR-7, NFR-8, NFR-9, NFR-10
  - Depends on: T7.
  - Work: Complete requirement-by-requirement evidence index, slice task results and known limitations; request separate authorization for Validation and sdd-code-review. Do not repair findings or mark spec implemented.
  - Files/responsibility: specs/001-toca-regalo/verification.md; specs/007-deletion-verification/verification.md; MEMORY.md.
  - Done when: All required checks pass before this task is done; complete evidence is reviewable, external SMTP checks remain honestly scoped, and the next state is awaiting Validation authorization, not fulfilled/implemented.
  - Evidence: not executed; no completion or passing result claimed.

## Traceability and acceptance

See [plan traceability](./plan.md#traceability). FR-N maps to parent AC-N; NFR acceptance conditions are inherited verbatim in [spec](./spec.md). All 8 tasks are pending; no checks have been executed.

## Phase boundary

After the last task, report evidence/limitations and request authorization for the next task/block as applicable. Final read-only application Validation requires its own authorization and the installed sdd-code-review workflow. Do not mark the parent specification implemented before accepted fulfilled Validation.

