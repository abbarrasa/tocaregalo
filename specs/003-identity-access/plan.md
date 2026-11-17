# Plan 003 — Identity and account access

Status: approved; task execution and installation remain separately gated
Revision: v0.2
Historical approval (v0.1): The user stated “Apruebo y autorizo iniciar la T1 de spec 002”, approving the derived-document/task package and authorizing only 002:T1 on 2026-11-16. No installation is authorized.
Derived specification: [003 v0.2](./spec.md), synchronized from approved parent v1.1
Approved parent specification: [001 v1.1](../001-toca-regalo/spec.md)
Architecture: [001 v0.2 proposed; unchanged v0.1 baseline historically approved](../001-toca-regalo/plan.md)
Approval (v0.2): “Apruebo estas revisiones y autorizo actualizar las tareas”, 2026-11-17, approves the displayed PHPStan plan revision and authorizes task-list preparation, not implementation or installation.

## Approach and approved design

Provide authenticated identity, account changes, recovery and the adapted SUPER ADMIN command using the approved session/API boundaries.

Inherit parent plan sections 2–11 for exact toolchain families, architecture, data/privacy/transaction contracts, pure function signatures/pseudocode, API routes, UI states and verification profiles. Do not create conflicting local versions of those designs. The user approved the parent specification v1.0, parent plan v0.1, and six-block decomposition v0.1 (“Apruebo los bloques. Continúa”). The user subsequently approved these derived documents and task lists, authorizing only 002:T1. No installation or other task execution is authorized.

## Components, interfaces and flows

Pure user normalization/password policy; User/Role repositories, external mappings, Symfony hasher/session/CSRF adapters, reset-token persistence/mail worker, JSON DTOs, account/login/recovery views.

users, roles/user_roles, database sessions, hashed reset tokens and foundational notification/Doctrine transport tables. No verification status, role-management screen or plaintext password/token storage.

Email-or-phone login, logout, recovery/reset errors, authenticated account editing, phone plugin wrapper, responsive Spanish forms with labels/keyboard/focus.

Dependencies: [002-development-foundation](../002-development-foundation/tasks.md). The parent application remains incomplete until all cross-slice cases are covered. No global account deletion until 007. Ordinary-user creation is an application boundary exercised with fixtures here; its owner/group entry point is completed in 004. Final assignment dashboard and assignment-delivery acceptance remain in 006.

## Planned files and bounded responsibilities

| Task | Planned paths | Responsibility |
| --- | --- | --- |
| T1 | `backend/src/Domain/User/`, `backend/src/Infrastructure/Doctrine/`, `backend/config/doctrine/`, `backend/migrations/` | Implement normalized user values and persistence constraints |
| T2 | `backend/src/Command/`, `backend/tests/Functional/` | Adapt and verify the interactive SUPER ADMIN command |
| T3 | `backend/src/Infrastructure/Security/`, `backend/src/Api/`, `backend/config/packages/` | Implement session authentication and logout JSON contracts |
| T4 | `backend/src/Application/`, `backend/src/Api/`, `backend/tests/Functional/` | Implement authenticated own-account changes and creation boundary |
| T5 | `backend/src/Application/`, `backend/src/Infrastructure/Doctrine/`, `backend/tests/Unit/`, `backend/tests/Integration/` | Implement recovery token lifecycle |
| T6 | `backend/src/Infrastructure/Mail/`, `backend/config/packages/messenger.yaml`, `backend/tests/Integration/` | Deliver recovery email through durable mail infrastructure |
| T7 | `frontend/src/views/`, `frontend/src/plugins/phone.js`, `frontend/src/composables/`, `frontend/tests/` | Implement login and recovery/reset screens |
| T8 | `frontend/src/views/AccountView.vue`, `frontend/src/api/`, `tests/e2e/` | Implement responsive own-account editing |
| T9 | `specs/003-identity-access/verification.md`, `backend/tests/`, `tests/e2e/` | Verify identity privacy and record slice evidence |

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
| FR-3 | T1, T2, T4, T7, T8, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-4 | T1, T2, T4, T8, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-5 | T4, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-13 | T6, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-15 | T3, T7, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-22 | T2, T3, T4, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-28 | T5, T6, T7, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-29 | T4, T8, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-30 | T2, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-34 | T6, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-35 | T3, T7, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-1 | T1, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-2 | T7, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-4 | T3, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-5 | T7, T8, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-6 | T7, T8, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-7 | T6, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-8 | T7, T8, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-10 | All future implementation tasks; prerequisite tooling in 002 before T4 | Fixed level 10 over owned PHP including tests; zero-error post-task evidence, no concealing baseline; failure blocks completion. |

The [task list](./tasks.md) supplies concrete work and done conditions. Parent AC numbers are unchanged; no replacement child acceptance identifiers are invented.

## Approval and next action

9 proposed tasks, ordered by dependency. Approximately 20–30 minutes per task is a decomposition target, not a promise; expose required scope changes rather than silently enlarging a task. This slice stays at ten tasks or fewer.

The original derived-document/task package remains historical approval for unchanged scope. This v0.2 revision is approved; the proposed task-list v0.2 update now awaits its own approval. Preserve T4 v0.1 and Playwright approvals for their unchanged scope; present the expanded PHPStan gate and enabling work separately. No installation or implementation is authorized by preparing this revision.

