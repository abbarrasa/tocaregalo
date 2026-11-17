# Plan 007 — Account deletion and application verification

Status: approved; task execution and installation remain separately gated
Revision: v0.2
Historical approval (v0.1): The user stated “Apruebo y autorizo iniciar la T1 de spec 002”, approving the derived-document/task package and authorizing only 002:T1 on 2026-11-16. No installation is authorized.
Derived specification: [007 v0.2](./spec.md), synchronized from approved parent v1.1
Approved parent specification: [001 v1.1](../001-toca-regalo/spec.md)
Architecture: [001 v0.2 proposed; unchanged v0.1 baseline historically approved](../001-toca-regalo/plan.md)
Approval (v0.2): “Apruebo estas revisiones y autorizo actualizar las tareas”, 2026-11-17, approves the displayed PHPStan plan revision and authorizes task-list preparation, not implementation or installation.

## Approach and approved design

Complete confirmed account deletion and all cross-application acceptance evidence before a separately authorized read-only Validation phase.

Inherit parent plan sections 2–11 for exact toolchain families, architecture, data/privacy/transaction contracts, pure function signatures/pseudocode, API routes, UI states and verification profiles. Do not create conflicting local versions of those designs. The user approved the parent specification v1.0, parent plan v0.1, and six-block decomposition v0.1 (“Apruebo los bloques. Continúa”). The user subsequently approved these derived documents and task lists, authorizing only 002:T1. No installation or other task execution is authorized.

## Components, interfaces and flows

Delete-account orchestrator/shared lock order, scoped encrypted-reference null cleanup, cascade/replacement/cancellation integration, own/admin delete UI, operational key restore procedure and evidence index.

Null surviving giver and encrypted-recipient references, retain other accounts, delete owned groups/events/draws/work, replace/invalidate surviving unfinished draws atomically. Finished draws remain unrerun.

Self/admin account deletion confirmation includes owned-data cascades and below-three warnings; final failure statuses and remaining-member messages retain privacy.

Dependencies: [006-notifications-dashboard](../006-notifications-dashboard/tasks.md). The parent application remains incomplete until all cross-slice cases are covered. Direct implementation focuses on FR-2/12/14/22/23/24/25/26/27/32; other FR/NFR are complete-regression scope, not new implementation. No automatic corrective work, final acceptance or validation approval is implied.

## Planned files and bounded responsibilities

| Task | Planned paths | Responsibility |
| --- | --- | --- |
| T1 | `backend/src/Infrastructure/Crypto/`, `backend/src/Infrastructure/Doctrine/`, `backend/tests/Integration/` | Implement encrypted recipient-reference null cleanup |
| T2 | `backend/src/Application/`, `backend/src/Api/`, `backend/tests/Integration/` | Implement confirmed self/admin account deletion and owned-data cascades |
| T3 | `backend/src/Application/`, `backend/tests/Integration/`, `backend/tests/Functional/` | Integrate surviving-group redraw/invalidation and email cancellation |
| T4 | `frontend/src/views/AccountView.vue`, `frontend/src/views/UsersView.vue`, `tests/e2e/` | Implement own and admin account-deletion interfaces |
| T5 | `docs/security-operations.md`, `backend/tests/Integration/`, `specs/007-deletion-verification/verification.md` | Exercise key backup/restore and encrypted-data operations |
| T6 | `backend/tests/`, `specs/001-toca-regalo/verification.md` | Complete backend and concurrency acceptance coverage |
| T7 | `frontend/tests/`, `tests/e2e/`, `README.md`, `docs/`, `specs/001-toca-regalo/verification.md` | Complete frontend/build/browser and documentation verification |
| T8 | `specs/001-toca-regalo/verification.md`, `specs/007-deletion-verification/verification.md`, `MEMORY.md` | Assemble the validation handoff without performing final review |

Paths are planned implementation targets; only the documentation in this slice is being created now. Do not create code/configuration before task approval and explicit start authorization.

## Design decisions and alternatives

Preserve the approved application architecture; add only the proposed NFR-10 development analysis tools. Existing decisions remain: pure domain and external ORM mappings; same-origin sessions/CSRF; scoped resource DTOs; real MySQL tests; uniform shuffle/rejection; versioned Sodium/scoped-HMAC recipient references; one authoritative notification retry loop; independent logical closure guard. Use only the decisions relevant to the task.

Parent rejected alternatives remain rejected for their recorded tradeoffs: Twig/distribution templates, plaintext recipient FK, biased single-cycle/bounded-fallback draws, unnecessary Redis/RabbitMQ/JWT/state libraries, and SQLite substitutions. The approved local capture and key policy do not authorize downloads, secrets generation, or real email delivery now.

## Test strategy and evidence

NFR-10 (approved parent Spec 001 v1.1) adds a shared completion gate: after every future implementation task, run fixed PHPStan level 10 on all project-owned PHP including tests, excluding third-party dependencies. Require zero errors without concealing findings in a baseline; record the command, scope, version and result. Failed or unavailable analysis blocks task completion. Establish the tooling in block 002 before T4 using [the proposed PHPStan execution plan](../002-development-foundation/phpstan-execution-plan.md). Earlier task evidence remains historical for its original scope. The derived spec has been synchronized with the approved parent NFR during the authorized downstream document/Tasks update.

Follow parent test strategy with each task: behavioral tests first for application behavior, relevant real-MySQL/API/component/browser regressions, controlled time for deadlines/retries/reveal, and reproducible manual checks where appropriate. For static configuration or docs, inspect/lint the actual deliverable rather than invent tests mirroring its content. For enabling work, record supported requirements without claiming their product acceptance is fulfilled.

Use Chromium desktop 1440×900 and mobile 390×844 with essential Firefox/WebKit flows as specified by the approved parent. No arbitrary code-coverage percentage. Do not mark a task complete on unavailable tooling or an unexecuted check. External production SMTP remains a deployment dependency, not a prerequisite to local captured-email evidence.

## Traceability

| Parent requirement | Proposed tasks | Verification authority |
| --- | --- | --- |
| FR-1 | T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-2 | T2, T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-3 | T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-4 | T6, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-5 | T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-6 | T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-7 | T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-8 | T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-9 | T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-10 | T6, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-11 | T6, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-12 | T2, T6, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-13 | T3, T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-14 | T1, T3, T5, T6, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-15 | T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-16 | T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-17 | T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-18 | T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-19 | T4, T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-20 | T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-21 | T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-22 | T2, T4, T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-23 | T1, T2, T3, T4, T5, T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-24 | T3, T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-25 | T3, T6, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-26 | T3, T6, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-27 | T2, T3, T4, T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-28 | T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-29 | T4, T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-30 | T6, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-31 | T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-32 | T3, T6, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-33 | T6, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-34 | T3, T6, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-35 | T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-1 | T6, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-2 | T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-3 | T5, T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-4 | T6, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-5 | T4, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-6 | T4, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-7 | T5, T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-8 | T4, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-9 | T6, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-10 | All future implementation tasks; prerequisite tooling in 002 before T4 | Fixed level 10 over owned PHP including tests; zero-error post-task evidence, no concealing baseline; failure blocks completion. |

The [task list](./tasks.md) supplies concrete work and done conditions. Parent AC numbers are unchanged; no replacement child acceptance identifiers are invented.

## Approval and next action

8 proposed tasks, ordered by dependency. Approximately 20–30 minutes per task is a decomposition target, not a promise; expose required scope changes rather than silently enlarging a task. This slice stays at ten tasks or fewer.

The original derived-document/task package remains historical approval for unchanged scope. This v0.2 revision is approved; the proposed task-list v0.2 update now awaits its own approval. Preserve T4 v0.1 and Playwright approvals for their unchanged scope; present the expanded PHPStan gate and enabling work separately. No installation or implementation is authorized by preparing this revision.

