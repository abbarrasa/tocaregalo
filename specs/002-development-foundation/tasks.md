# Tasks 002 — Development foundation

Status: approved; task execution remains separately gated
Revision: v0.2
Approval (v0.2): “Apruebo las listas de tareas y autorizo el inicio de 002:T9 y las instalaciones”, 2026-11-17. Approves all revised task lists and authorizes only 002:T9 and its concrete four-package installation scope.
Historical approval (v0.1): The user stated “Apruebo y autorizo iniciar la T1 de spec 002”, approving the derived-document/task package and authorizing only 002:T1 on 2026-11-16. No installation is authorized.
Derived documents: [spec](./spec.md), synchronized from approved parent v1.1; [plan v0.2](./plan.md), approved.
Approved sources: [Spec 001 v1.1](../001-toca-regalo/spec.md), [Plan 001 v0.2](../001-toca-regalo/plan.md)
Execution authorization: T1–T4 and T9 complete. User resumed T4 with “Continúa con la siguiente tarea” after T9; prior runtime/Playwright approvals remained valid. No T5 or later task implementation is authorized.

## Execution rules

Revision preparation authorized by “Apruebo estas revisiones y autorizo actualizar las tareas” on 2026-11-17. This v0.2 task list is approved under the approval evidence above. Every pending task carries NFR-10: before completion, run fixed PHPStan level 10 on all project-owned PHP including tests, with zero errors and no concealing baseline; record command/configuration/version/result. Failed or unavailable analysis blocks completion. Earlier checked tasks retain historical evidence under their original scope.

Additional user rule (2026-11-17): present a task-specific execution plan and await explicit approval before every implementation. [T3 execution plan v0.1](./t3-execution-plan.md) is approved with its recorded .env condition.

Task IDs are qualified as 002:Tn across blocks; unqualified Tn references are local. Execute one explicitly authorized task at a time, with its prerequisite checks satisfied. Each task includes its applicable tests/checks and actual evidence when run. Do not mark product requirements fulfilled based on partial supporting work; Infrastructure enabling work only. Product acceptance remains with 003–007; no health check or empty SPA is presented as the finished application.

No dependency installation, image pull/build requiring packages, or browser download without separate explicit user authorization. Do not hide installation in startup/check scripts. A fixture-only test cannot replace real MySQL/privacy/browser evidence required by the parent.

## Proposed tasks

- [x] **T1. Prepare reviewable development configuration without installation.** NFR-1, NFR-2, NFR-3, NFR-4, NFR-5, NFR-7
  - Depends on: None.
  - Work: Create Compose/Docker/Nginx/environment templates, ignore rules and initial Spanish setup notes in the exact approved architecture. No image pull/build, package installation, browser download, or generated secret.
  - Files/responsibility: compose.yaml; compose.test.yaml; docker/; .env.example; .dockerignore; .gitignore; README.md.
  - Done when: Configuration is reviewable; available local static checks and whitespace checks pass; scripts contain no implicit installation/startup. Record runtime checks as pending, not passed.
  - Evidence: completed 2026-11-16. Both development/test Compose validations exited 0; model inspection verified service/port/environment/isolation/startup contracts; ignore/whitespace checks passed; editor reported no errors. No installation, image build/pull, runtime startup, or key generation. See [T1 verification and limits](./verification.md).

- [x] **T2. Resolve and lock the approved dependency families after installation authorization.** NFR-1, NFR-2, NFR-3
  - Depends on: T1; separate explicit package/image/browser download authorization.
  - Work: Present concrete manifests/image scope for approval; only after authorization resolve approved PHP/Symfony/API Platform/Doctrine/Vue/Vite/Bootstrap/phone/test dependencies, record image digests and lockfiles, reject Twig.
  - Files/responsibility: backend/composer.json; backend/composer.lock; frontend/package.json; frontend/package-lock.json; docker/.
  - Done when: Authorized resolution succeeds for approved families; lockfiles/digests and actual downloads recorded; no Twig dependency; resolution failures are surfaced rather than changing versions silently.
  - Evidence: completed 2026-11-17 on `feature/002_T02-lock-dependencies` after explicit [installation authorization](./installation-scope.md). Six image pulls and two tool builds succeeded; Composer/npm lockfiles and installed tool/platform checks passed; Twig absent. Audits retain four moderate npm development entries and abandoned doctrine/common (zero PHP security advisories; zero npm production advisories). Full commands/versions/warnings: [resolution evidence](./dependency-resolution.md). No application startup, browser binaries, database initialization or secrets. No commit/push.

- [x] **T3. Wire the backend API runtime and real MySQL boundary.** NFR-1, NFR-3, NFR-4
  - Depends on: T2.
  - Work: Create minimal Symfony/API Platform JSON runtime, external configuration and real database connection; disable template/docs UI and expose no business entities.
  - Files/responsibility: backend/config/; backend/public/; backend/src/Api/; docker/nginx/.
  - Done when: A reproducible internal smoke check demonstrates JSON API execution and MySQL connection; unavailable dependencies fail visibly; backend returns no user HTML.
  - Evidence: completed 2026-11-17, continued from current dev on feature/002_T03-backend-runtime-verification. User-authorized ignored .env generated with mode 600; not tracked. JSON HTTP and real MySQL 8.4 SELECT 1/UTC checks passed; invalid connection failed at the intended DB stage without credentials. Symfony container/YAML/platform checks passed; locks unchanged. Isolated MySQL used tmpfs/no ports; dedicated containers/network removed without volume deletion. [Actual commands and limits](./verification.md#t3-completion). No full product acceptance or browser/Nginx application check claimed. No commit/push.

- [x] **T9. Establish the PHPStan level-10 quality gate.** NFR-10
  - Depends on: T3; separate explicit approval of the four-package installation scope.
  - Execution plan: [PHPStan v0.1](./phpstan-execution-plan.md), approved; explicitly authorized by the approval evidence above. Planned branch: feature/002_T09-phpstan-quality-gate from current local dev after status inspection.
  - Work: Install only the four approved-scope development analysis packages after authorization; configure fixed level 10 over all owned PHP including tests; record actual initial findings, make minimal justified corrections and rerun applicable regressions. Never conceal findings with a baseline, lower the level, omit owned code or patch vendor files.
  - Files/responsibility: backend/composer.json and composer.lock; backend/phpstan.neon.dist; optional backend/tests/StaticAnalysis/bootstrap.php; verified PHP corrections; README.md; verification and governance evidence.
  - Done when: Targeted dependency resolution and configuration checks succeed; PHPStan exits 0 with zero errors for the entire owned-PHP/test scope, without a concealing baseline; relevant syntax/config/runtime regressions pass; private environment remains ignored and no secrets are printed. Record audits and remaining external warnings honestly.
  - Evidence: completed 2026-11-17 on feature/002_T09-phpstan-quality-gate. Four authorized packages locked/installed, no existing package updated/removed. Initial level-10 analysis: 14 errors; boundary types documented, final analysis zero errors. PHP syntax/platform, Symfony container/YAML, JSON HTTP and real MySQL 8.4/UTC checks passed; invalid connection failed as expected. No baseline/exclusions/vendor patches. See [T9 evidence](./verification.md#t9-completion) for commands, audit warnings and limits. No commit/push.

- [x] **T4. Wire the Vue build and Nginx entry point.** NFR-2, NFR-3, NFR-4, NFR-5, NFR-6, NFR-10
  - Execution plan: [v0.2](./t4-execution-plan.md), approved; original implementation/runtime and matching Playwright image download approvals remain valid. T9 prerequisite is complete; stop after T9 and wait for the user to resume T4.
  - Depends on: T9 (which depends on completed T3).
  - Work: Create Vue/Router/Bootstrap shell, native-fetch API boundary, Vite HMR and built-static Nginx routing; keep product routes for their own slices.
  - Files/responsibility: frontend/src/main.js; frontend/src/router/; frontend/src/api/; frontend/vite.config.js; docker/nginx/.
  - Done when: Frontend builds and loads through Nginx on desktop/mobile profiles; API requests follow the same origin; no Twig or backend view renders.
  - Evidence: completed 2026-11-17 on feature/002_T04-vue-nginx-entrypoint. Approved plan v0.2 resumed after T9. Eleven client tests and build pass; Chromium desktop/mobile verifies development and compiled-static Nginx/JSON/privacy/keyboard behavior; HMR update/restoration preserves document. PHPStan level 10 zero errors. Exact authorized Playwright image pinned by digest; manifests/locks unchanged, private .env preserved. Dedicated environment removed, no commit/push. See [T4 evidence](./verification.md#t4-completion).

- [ ] **T5. Prepare focused verification harnesses and database isolation.** NFR-1, NFR-2, NFR-3, NFR-4, NFR-6, NFR-8, NFR-10
  - Depends on: T4.
  - Work: Configure PHPUnit, Vue component tests and Playwright browser profiles with isolated MySQL fixture/reset support; use a meaningful runtime-boundary check rather than an empty-suite success.
  - Files/responsibility: backend/phpunit.xml.dist; backend/tests/; frontend/vitest.config.js; frontend/tests/; playwright.config.js; tests/e2e/.
  - Done when: A focused API/database check and frontend boundary check execute reproducibly; test fixtures never use/reset development data; browser/viewport profiles match the approved plan.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T6. Connect local mail capture and worker runtime contracts.** NFR-3, NFR-7, NFR-9, NFR-10
  - Depends on: T5.
  - Work: Wire Mailpit SMTP, environment sender templates and worker/closure process entrypoints; deliver a test fixture email without introducing product notification behavior.
  - Files/responsibility: docker/worker/; docker/scheduler/; backend/config/; compose.yaml.
  - Done when: Local capture receives a fixture message; workers start/stop with their shared PHP image; SMTP secrets are absent from tracked files and the SMTP port stays internal.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T7. Document and expose approved developer/check commands.** NFR-3, NFR-5, NFR-7, NFR-8, NFR-10
  - Depends on: T6.
  - Work: Add development/check wrappers, VS Code tasks, editor conventions, Spanish README and English technical setup notes; startup/check wrappers never install packages.
  - Files/responsibility: scripts/dev; scripts/check; .vscode/tasks.json; .editorconfig; README.md; docs/development.md.
  - Done when: Documented wrapper commands invoke the intended container tools, VS Code tasks resolve, and setup/SMTP/key placeholders are understandable without real secrets.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T8. Verify the complete development setup and record limits.** NFR-1, NFR-2, NFR-3, NFR-4, NFR-5, NFR-6, NFR-7, NFR-8, NFR-9, NFR-10
  - Depends on: T7.
  - Work: Run the authorized clean test-environment build/start/health/migration-harness and frontend-build procedures, inspect loopback ports and capture, and record commands/versions/results.
  - Files/responsibility: specs/002-development-foundation/verification.md; README.md; docs/development.md.
  - Done when: Reproducible setup checks pass or are explicitly blocked with evidence; no data volume is destroyed automatically; foundation coverage is distinguished from unimplemented product behavior.
  - Evidence: not executed; no completion or passing result claimed.

## Traceability and acceptance

See [plan traceability](./plan.md#traceability). FR-N maps to parent AC-N; NFR acceptance conditions are inherited verbatim in [spec](./spec.md). T1/T2/T3/T4/T9 are complete; T5–T8 are pending. Stop after T4. T5 requires a presented and approved execution plan before implementation. NFR-10 setup maps to T9; its post-task gate maps to all pending tasks. No complete application acceptance is claimed.

## Phase boundary

After the last task, report evidence/limitations and request authorization for the next task/block as applicable. Final read-only application Validation requires its own authorization and the installed sdd-code-review workflow. Do not mark the parent specification implemented before accepted fulfilled Validation.

