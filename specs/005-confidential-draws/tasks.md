# Tasks 005 — Confidential draw lifecycle

Status: approved; individual task execution remains separately gated
Revision: v0.1
Approval: The user stated “Apruebo y autorizo iniciar la T1 de spec 002”, approving the derived-document/task package and authorizing only 002:T1 on 2026-11-16. No installation is authorized.
Derived documents: [spec v0.1](./spec.md), [plan v0.1](./plan.md), both approved
Approved sources: [Spec 001 v1.0](../001-toca-regalo/spec.md), [Plan 001 v0.1](../001-toca-regalo/plan.md)
Execution authorization: only 002:T1 is authorized. All other tasks and every package/image/browser installation require separate authorization.

## Execution rules

Task IDs are qualified as 005:Tn across blocks; unqualified Tn references are local. Execute one explicitly authorized task at a time, with its prerequisite checks satisfied. Each task includes its applicable tests/checks and actual evidence when run. Do not mark product requirements fulfilled based on partial supporting work; Assignment email rendering/retry UI and private dashboard are completed in 006; account-deletion cascade/null orchestration is completed in 007. Existing notification work is enqueued atomically by ID, never silently omitted.

No dependency installation, image pull/build requiring packages, or browser download without separate explicit user authorization. Do not hide installation in startup/check scripts. A fixture-only test cannot replace real MySQL/privacy/browser evidence required by the parent.

## Proposed tasks

- [ ] **T1. Implement and prove uniform draw generation.** FR-10
  - Depends on: 004:T10.
  - Work: Write invariant tests and exact small-case shuffle-choice enumeration, then implement Fisher–Yates rejection via injected random integers.
  - Files/responsibility: backend/src/Domain/Draw/; backend/tests/Unit/.
  - Done when: n=3 and n=4 include every valid assignment with equal counts, including disjoint cycles; insufficient membership fails; larger memberships satisfy invariants.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T2. Implement versioned recipient encryption and lookup tokens.** FR-14, FR-23
  - Depends on: T1.
  - Work: Implement approved Sodium authenticated envelope/scoped HMAC adapter and versioned key-file loader without committing keys.
  - Files/responsibility: backend/src/Infrastructure/Crypto/; backend/tests/Integration/.
  - Done when: Roundtrip/tamper/wrong-key tests pass, lookup tags are draw-scoped, and encrypted records contain no readable recipient identity; missing-key failure is explicit.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T3. Map draw assignments and durable revision references.** FR-10, FR-11, FR-13, FR-14, FR-23, NFR-1
  - Depends on: T2.
  - Work: Add external draw/assignment mappings, unique event/giver/token constraints and revision-bound work references with giver SET NULL.
  - Files/responsibility: backend/config/doctrine/; backend/migrations/; backend/src/Infrastructure/Doctrine/.
  - Done when: MySQL schema/uniqueness/null tests pass and rollback leaves no partial assignments or notification work; recipient columns have no plaintext FK.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T4. Implement transactional manual draw execution.** FR-10, FR-11, FR-13, FR-22, FR-32, NFR-4
  - Depends on: T3.
  - Work: Implement authorized group/event lock order, closure recheck, uniform generation/validation/encryption and atomic notification-ID enqueue.
  - Files/responsibility: backend/src/Application/; backend/src/Api/; backend/tests/Functional/.
  - Done when: Only authorized unfinished eligible events draw; committed mapping is valid/encrypted; failures leave no partial draw/work; no other-user recipient is returned.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T5. Verify concurrent draw and closure precedence.** FR-11, FR-32, FR-33, NFR-9
  - Depends on: T4.
  - Work: Use separate MySQL connections/barriers to exercise simultaneous draws and closure; implement the required already-performed notice.
  - Files/responsibility: backend/src/Infrastructure/Doctrine/; backend/tests/Integration/.
  - Done when: Two requests produce one draw/initial work set; second sees notice; closure at the boundary prevents new/replacement draws.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T6. Integrate membership additions/removals with draw replacement.** FR-24, FR-25, FR-27, FR-32
  - Depends on: T5.
  - Work: Connect group mutations to the pure decision matrix and atomic replacement of unfinished draws; keep finished draws unchanged.
  - Files/responsibility: backend/src/Application/; backend/src/Domain/Draw/; backend/tests/Integration/.
  - Done when: Added/removed members match replacement membership, confirmed removals preserve account, metadata/duplicate no-ops do not redraw, and group edits still succeed alongside closed events.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T7. Implement invalidation below three and automatic recovery.** FR-25, FR-26, FR-27
  - Depends on: T6.
  - Work: Retain invalid prior assignments below three, enqueue insufficient-member work, and replace when minimum returns without creating first draws for events with no prior draw.
  - Files/responsibility: backend/src/Application/; backend/src/Domain/Draw/; backend/tests/Integration/.
  - Done when: Zero/one/two make no new assignments; prior records remain invalid, no invalid reveal is possible, and returning to three replaces only affected unfinished draws.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T8. Implement explicit SUPER ADMIN draw deletion.** FR-11, FR-12, FR-22
  - Depends on: T7.
  - Work: Add admin-only draw deletion with pending-work cancellation and finished-event restriction.
  - Files/responsibility: backend/src/Api/; backend/src/Application/; backend/tests/Functional/.
  - Done when: USER denial and open/finished admin deletion pass; deleting a finished draw never reopens or enables redraw; open event respects eligibility.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T9. Implement own-only recipient read projection.** FR-14, FR-16, FR-22, NFR-4
  - Depends on: T8.
  - Work: Create no-store own-assignment DTO/provider with valid/current/unfinished guards; decrypt only in the authorized path.
  - Files/responsibility: backend/src/Api/Resource/; backend/src/Api/State/; backend/tests/Functional/.
  - Done when: USER and SUPER ADMIN cannot read others' recipients through direct IDs, management lists, errors or serialized entities; invalid/finished queries reveal none.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T10. Record draw/crypto/concurrency evidence and regress management.** FR-10, FR-11, FR-12, FR-13, FR-14, FR-16, FR-22, FR-23, FR-24, FR-25, FR-26, FR-27, FR-32, FR-33, NFR-1, NFR-4, NFR-9
  - Depends on: T9.
  - Work: Run focused real-database/privacy/concurrency and group/event regressions; record missing downstream mail/UI/account-deletion evidence explicitly.
  - Files/responsibility: specs/005-confidential-draws/verification.md; backend/tests/.
  - Done when: Draw lifecycle evidence passes, nullable-recipient lookup contract is proven, and notification/dashboard/account-deletion acceptance is not marked fulfilled prematurely.
  - Evidence: not executed; no completion or passing result claimed.

## Traceability and acceptance

See [plan traceability](./plan.md#traceability). FR-N maps to parent AC-N; NFR acceptance conditions are inherited verbatim in [spec](./spec.md). All 10 tasks are pending; no checks have been executed.

## Phase boundary

After the last task, report evidence/limitations and request authorization for the next task/block as applicable. Final read-only application Validation requires its own authorization and the installed sdd-code-review workflow. Do not mark the parent specification implemented before accepted fulfilled Validation.

