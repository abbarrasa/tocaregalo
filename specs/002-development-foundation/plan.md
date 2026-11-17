# Plan 002 — Development foundation

Status: approved; task execution and installation remain separately gated
Revision: v0.2
Historical approval (v0.1): The user stated “Apruebo y autorizo iniciar la T1 de spec 002”, approving the derived-document/task package and authorizing only 002:T1 on 2026-11-16. No installation is authorized.
Derived specification: [002 v0.2](./spec.md), synchronized from approved parent v1.1
Approved parent specification: [001 v1.1](../001-toca-regalo/spec.md)
Architecture: [001 v0.2 proposed; unchanged v0.1 baseline historically approved](../001-toca-regalo/plan.md)
Approval (v0.2): “Apruebo estas revisiones y autorizo actualizar las tareas”, 2026-11-17, approves the displayed PHPStan plan revision and authorizes task-list preparation, not implementation or installation.

## Approach and approved design

Provide the reproducible development environment and verification tools required by the approved application, without claiming product features implemented.

Inherit parent plan sections 2–11 for exact toolchain families, architecture, data/privacy/transaction contracts, pure function signatures/pseudocode, API routes, UI states and verification profiles. Do not create conflicting local versions of those designs. The user approved the parent specification v1.0, parent plan v0.1, and six-block decomposition v0.1 (“Apruebo los bloques. Continúa”). The user subsequently approved these derived documents and task lists, authorizing only 002:T1. No installation or other task execution is authorized.

## Components, interfaces and flows

Compose services, PHP/Node images, Nginx API/SPA routing, MySQL/test isolation, local Mailpit, worker entrypoints, environment/secret templates and verification wrappers.

Development/test databases and runtime volumes only; no business schema or real credentials. Preserve existing repository/license/source documents.

Development SPA shell and Spanish setup documentation only; no new product flow.

Dependencies: None. The parent application remains incomplete until all cross-slice cases are covered. Infrastructure enabling work only. Product acceptance remains with 003–007; no health check or empty SPA is presented as the finished application.

## Planned files and bounded responsibilities

| Task | Planned paths | Responsibility |
| --- | --- | --- |
| T1 | `compose.yaml`, `compose.test.yaml`, `docker/`, `.env.example`, `.dockerignore`, `.gitignore`, `README.md` | Prepare reviewable development configuration without installation |
| T2 | `backend/composer.json`, `backend/composer.lock`, `frontend/package.json`, `frontend/package-lock.json`, `docker/` | Resolve and lock the approved dependency families after installation authorization |
| T3 | `backend/config/`, `backend/public/`, `backend/src/Api/`, `docker/nginx/` | Wire the backend API runtime and real MySQL boundary |
| Proposed T9 before T4 | `backend/composer.json`, `composer.lock`, `phpstan.neon.dist`, `tests/StaticAnalysis/`, verified existing PHP findings | Establish NFR-10 with compatible dev tools, precise owned-code analysis and first zero-error result; see separate proposed execution plan |
| T4 | `frontend/src/main.js`, `frontend/src/router/`, `frontend/src/api/`, `frontend/vite.config.js`, `docker/nginx/` | Wire the Vue build and Nginx entry point |
| T5 | `backend/phpunit.xml.dist`, `backend/tests/`, `frontend/vitest.config.js`, `frontend/tests/`, `playwright.config.js`, `tests/e2e/` | Prepare focused verification harnesses and database isolation |
| T6 | `docker/worker/`, `docker/scheduler/`, `backend/config/`, `compose.yaml` | Connect local mail capture and worker runtime contracts |
| T7 | `scripts/dev`, `scripts/check`, `.vscode/tasks.json`, `.editorconfig`, `README.md`, `docs/development.md` | Document and expose approved developer/check commands |
| T8 | `specs/002-development-foundation/verification.md`, `README.md`, `docs/development.md` | Verify the complete development setup and record limits |

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
| NFR-1 | T1, T2, T3, T5, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-2 | T1, T2, T4, T5, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-3 | T1, T2, T3, T4, T5, T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-4 | T1, T3, T4, T5, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-5 | T1, T4, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-6 | T4, T5, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-7 | T1, T6, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-8 | T5, T7, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-9 | T6, T8 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-10 | All future implementation tasks; prerequisite tooling in 002 before T4 | Fixed level 10 over owned PHP including tests; zero-error post-task evidence, no concealing baseline; failure blocks completion. |

The [task list](./tasks.md) supplies concrete work and done conditions. Parent AC numbers are unchanged; no replacement child acceptance identifiers are invented.

## Approval and next action

The authorized Tasks update proposes nine tasks, including 002:T9 for PHPStan before T4, within the ten-task limit and preserving existing IDs. Task-list approval/start/installation remain pending. Approximately 20–30 minutes per task remains a decomposition target; surface actual findings that exceed the bounded setup scope before expanding it.

The original derived-document/task package remains historical approval for unchanged scope. This v0.2 revision is approved; the proposed task-list v0.2 update now awaits its own approval. Preserve T4 v0.1 and Playwright approvals for their unchanged scope; present the expanded PHPStan gate and enabling work separately. No installation or implementation is authorized by preparing this revision.

