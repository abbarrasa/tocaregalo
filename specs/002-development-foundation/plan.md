# Plan 002 — Development foundation

Status: approved v0.3; task execution and installation remain separately gated
Approval (v0.3): “apruebo la revisiones y autorizo actualizar las listas de tareas”, 2026-11-17. Approves displayed plan revisions and authorizes task-list preparation only.
Revision: v0.3
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


## v0.3 — Main startup remediation and verification

Preparation authorized on 2026-11-17: “apruebo la propuesta y autorizo preparar las revisiones”. The [technical direction](./startup-remediation-proposal.md) is approved; this revision and task/runtime execution remain pending. Approved Spec 002 v0.2 and parent Spec 001 v1.1 are unchanged. This amendment supersedes the premature key dependency and prior startup-blocker guidance, not the original task evidence.

### Corrective scope and files

Proposed 002:T10 depends on completed T7/T8 and addresses NFR-3, supporting NFR-1/4/5/7/10. Remove unused assignment secret wiring from `compose.yaml` and `compose.test.yaml`, and its unconditional guard from `scripts/dev`. Keep other environment/DB/port/image/service contracts. Update `README.md`, `docs/development.md` and future-key comments in `.env.example` only where necessary; never modify private dotenv values. Extend `tests/scripts/` with meaningful prerequisite/routing/cleanup tests. Update task/evidence/memory after actual checks.

Add a bounded `scripts/dev verify` command for verification of the main graph, sharing the same internal startup delegation as ordinary `up`. Ordinary `up` and `down` continue to target explicit project `tocaregalo`. Verification uses fixed project `tocaregalo-startup`, root `compose.yaml` plus a reviewed `compose.startup-verification.yaml` override: replace MySQL's persistent data mount with tmpfs; bind Nginx/Mailpit to fixed loopback ports 8083/8028; force APP_ENV=dev; do not change the main database URL/credentials, images, service startup commands, dotenv mounts or dependencies. The same database name inside a separate isolated MySQL instance does not target the development server. Do not execute migrations/accounts/worker commands.

Before startup, refuse existing development or verification containers/networks/volumes, occupied verification ports, or an active invocation lock. Do not adopt or remove existing resources. Use `--no-build --pull never`, explicit services with workers disabled, and no user-supplied Compose/model/project overrides. Ensure inspection failures fail closed. Cleanup only invocation-owned verification containers/network/lock, on success/failure/INT/TERM; never delete volumes. Refuse named data mounts in the resolved verification model before starting anything.

Add `tests/startup/` verification procedures that use the installed tools to wait for MySQL health, inspect selected non-secret metadata, perform read-only DB SELECT 1 via the main PHP service and check main Nginx HTTP JSON/private-path/Spanish shell behavior. A temporary Playwright `docker run --rm --pull never` on the owned network may mount existing frontend dependencies/tests/config, with base URL pointing to main Nginx. Do not add a browser/fixture service to the main graph. Use existing Chromium desktop/mobile cases for smoke; keep their scope explicit. The verification must start through the same startup helper as ordinary `up`, with only the documented storage/ports differences; do not claim ordinary persistent-volume initialization was tested.

### Proposed execution/check sequence

1. Before implementation, present a separate T10 execution plan with exact override/assertions/command map and obtain explicit authorization. Create the feature branch from then-current local dev only if approved prerequisites are present and no edits are lost.
2. Write failing focused tests for premature secret dependency removal, fixed main verification routing, existing-resource/port refusal, startup failure exit propagation and owned cleanup. Then make the minimum correction.
3. Validate base/overlay/verification models; assert main graph parity except documented storage/ports and APP_ENV selection; assert no required key file and no automatic install/build/pull/schema operations.
4. Execute the new isolated main-graph verification with existing images and supplied root dotenv. Verify service health/running state, SPA/JSON/private-path/browser smoke, read-only DB connection and actual loopback/internal port bindings.
5. Run applicable wrapper regressions and final PHPStan level 10 across all owned PHP/tests with zero errors/no baseline. Preserve lockfiles/private inputs. Record results and cleanup; stop before renewed read-only Validation.

Rejected alternative: removing only `scripts/dev`'s check while leaving Docker's required secret mount would retain the failure. Generating a dummy/real key before a consumer exists adds unsupported schema/custody work. Separate T5-only runtime success does not close main-graph verification.

### Task-list proposal for subsequent approval

Add **T10. Remove premature key dependency and verify main startup**, depending on T7/T8. Done when main-graph startup no longer requires unused keys, isolated verification passes, future crypto prerequisites are explicit in 005:T2, no existing resources/data are altered, final analysis passes and review evidence is recorded. Do not reopen completed T1–T9 or relabel their historical evidence as new verification. Task lists are not changed until this plan revision is approved. No runtime/install/key action is authorized by preparing this revision.
