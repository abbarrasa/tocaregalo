# Tasks 004 — Groups and events

Status: approved; task execution remains separately gated
Revision: v0.2
Approval (v0.2): “Apruebo las listas de tareas y autorizo el inicio de 002:T9 y las instalaciones”, 2026-11-17. Approves all revised task lists and authorizes only 002:T9 and its concrete four-package installation scope.
Historical approval (v0.1): The user stated “Apruebo y autorizo iniciar la T1 de spec 002”, approving the derived-document/task package and authorizing only 002:T1 on 2026-11-16. No installation is authorized.
Derived documents: [spec](./spec.md), synchronized from approved parent v1.1; [plan v0.2](./plan.md), approved.
Approved sources: [Spec 001 v1.1](../001-toca-regalo/spec.md), [Plan 001 v0.2](../001-toca-regalo/plan.md)
Execution authorization: no task in this block is authorized. Upstream 002:T9 and its installation were authorized separately; follow prerequisite and per-task approval gates.

## Execution rules

Revision preparation authorized by “Apruebo estas revisiones y autorizo actualizar las tareas” on 2026-11-17. This v0.2 task list is approved under the approval evidence above. Every pending task carries NFR-10: before completion, run fixed PHPStan level 10 on all project-owned PHP including tests, with zero errors and no concealing baseline; record command/configuration/version/result. Failed or unavailable analysis blocks completion. Earlier checked tasks retain historical evidence under their original scope.

Task IDs are qualified as 004:Tn across blocks; unqualified Tn references are local. Execute one explicitly authorized task at a time, with its prerequisite checks satisfied. Each task includes its applicable tests/checks and actual evidence when run. Do not mark product requirements fulfilled based on partial supporting work; Post-draw mutation, assignment cleanup and delivery consequences are integrated in 005–007. Never expose a destructive operation against a dependent state whose complete transaction has not yet been implemented.

No dependency installation, image pull/build requiring packages, or browser download without separate explicit user authorization. Do not hide installation in startup/check scripts. A fixture-only test cannot replace real MySQL/privacy/browser evidence required by the parent.

## Proposed tasks

- [ ] **T1. Implement group ownership and creator membership atomically.** FR-1, FR-22, NFR-1, NFR-10
  - Depends on: 003:T9.
  - Work: Add pure group model, external mappings and creation use case assigning exactly one creator-owner/member.
  - Files/responsibility: backend/src/Domain/Group/; backend/config/doctrine/; backend/migrations/; backend/src/Application/.
  - Done when: Duplicate names allowed, required name enforced, description optional, and one owner plus creator membership are committed atomically.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T2. Implement scoped group metadata and confirmed cascade deletion.** FR-2, FR-7, FR-22, NFR-10
  - Depends on: T1.
  - Work: Add owner-scoped lists/metadata/cascade boundary and explicit confirmation; SUPER ADMIN override never exposes assignments.
  - Files/responsibility: backend/src/Api/; backend/src/Application/; backend/tests/Integration/.
  - Done when: Owner/admin matrix and cancel/no-change tests pass for currently supported dependent states; other accounts survive deletion; post-draw cascade waits for downstream integration.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T3. Implement event attributes and owner-scoped CRUD.** FR-7, FR-8, FR-21, FR-22, NFR-10
  - Depends on: T2.
  - Work: Map event fields and group relation, CRUD projections and metadata updates; no draw side effects.
  - Files/responsibility: backend/src/Domain/Event/; backend/config/doctrine/; backend/src/Api/.
  - Done when: Required/optional event fields, exactly-one-group and owner/admin list/edit/delete tests pass without new views from backend.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T4. Implement partial AND user search and duplicate association.** FR-5, FR-6, FR-19, FR-20, NFR-10
  - Depends on: T3.
  - Work: Add owner-scoped group users and system-user search with case/accent-insensitive escaped filters and name-only results; association is unique.
  - Files/responsibility: backend/src/Api/State/; backend/src/Infrastructure/Doctrine/; backend/tests/Functional/.
  - Done when: Four fields/filter combinations and jose/José fixtures match correctly; empty/duplicate notices match requirements and duplicate association mutates nothing.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T5. Connect owner-created ordinary users to their group.** FR-5, FR-19, FR-20, FR-22, NFR-10
  - Depends on: T4.
  - Work: Connect approved account-creation service to authorized owned-group membership; creator sets initial password; reject owner edits/deletion of other accounts.
  - Files/responsibility: backend/src/Application/; backend/src/Api/; backend/tests/Integration/.
  - Done when: User/member creation is atomic, global duplicate errors do not leave partial accounts, ordinary users remain USER, and nonowners cannot create within others' groups.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T6. Implement member-removal preview and confirmation boundary.** FR-24, FR-27, FR-32, NFR-10
  - Depends on: T5.
  - Work: Add membership-only removal, recomputed below-three consequence warning and cancellation; keep the post-draw integration hook transactional for 005.
  - Files/responsibility: backend/src/Application/; backend/src/Api/; backend/tests/Functional/.
  - Done when: All supported removals require confirmation, insufficient-member warning is distinct, cancelling changes nothing, and account/other memberships survive.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T7. Implement completion-date rules and manual closure.** FR-9, FR-31, FR-32, NFR-9, NFR-10
  - Depends on: T6.
  - Work: Write pure clock/DST/boundary tests; implement shared completion timestamp, end-of-day conversion, past-date rejection, immediate manual overwrite and no reopening.
  - Files/responsibility: backend/src/Domain/Event/; backend/src/Application/; backend/tests/Unit/.
  - Done when: Today/future/past/null cases and current-time overwrite pass; logical closure blocks event-bound operations independently of a scheduled worker.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T8. Implement bounded due-event processing.** FR-9, FR-31, FR-32, NFR-9, NFR-10
  - Depends on: T7.
  - Work: Wire shared-PHP closure worker polling per approved plan and logical boundary adapter; cancellation port integrates pending assignment work in 006.
  - Files/responsibility: backend/src/Command/; docker/scheduler/; backend/tests/Integration/.
  - Done when: Controlled clocks and one real-process wiring check demonstrate at-most-60-second processing while logical closure applies immediately; no reopening occurs.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T9. Implement Groups and Users responsive management screens.** FR-1, FR-2, FR-5, FR-6, FR-19, FR-20, FR-24, FR-27, NFR-5, NFR-6, NFR-8, NFR-10
  - Depends on: T8.
  - Work: Connect group CRUD, create/search association and remove/confirm UI, scoped sidebar, no owner edit of another member.
  - Files/responsibility: frontend/src/views/; frontend/src/components/; frontend/src/api/; tests/e2e/.
  - Done when: Browser flows cover duplicate/empty states, confirmations, ownership denial, mobile display and keyboard focus/errors for both association methods.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T10. Implement Events screens and record management evidence.** FR-7, FR-8, FR-9, FR-21, FR-22, FR-31, FR-32, NFR-1, NFR-4, NFR-5, NFR-6, NFR-8, NFR-9, NFR-10
  - Depends on: T9.
  - Work: Connect event metadata/schedule/finish, form explanation and state errors; run slice regression and record downstream draw/delete limitations.
  - Files/responsibility: frontend/src/views/EventsView.vue; frontend/src/api/; specs/004-groups-events/verification.md.
  - Done when: Owner/admin event CRUD and finish work on mobile/desktop, labels/keyboard pass, API returns JSON, and no unimplemented draw-dependent operation is claimed complete.
  - Evidence: not executed; no completion or passing result claimed.

## Traceability and acceptance

See [plan traceability](./plan.md#traceability). FR-N maps to parent AC-N; NFR acceptance conditions are inherited verbatim in [spec](./spec.md). All 10 tasks are pending; no checks have been executed.

## Phase boundary

After the last task, report evidence/limitations and request authorization for the next task/block as applicable. Final read-only application Validation requires its own authorization and the installed sdd-code-review workflow. Do not mark the parent specification implemented before accepted fulfilled Validation.

