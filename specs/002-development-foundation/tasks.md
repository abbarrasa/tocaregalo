# Tasks 002 — Development foundation

Status: approved; individual task execution remains separately gated
Revision: v0.1
Approval: The user stated “Apruebo y autorizo iniciar la T1 de spec 002”, approving the derived-document/task package and authorizing only 002:T1 on 2026-11-16. No installation is authorized.
Derived documents: [spec v0.1](./spec.md), [plan v0.1](./plan.md), both approved
Approved sources: [Spec 001 v1.0](../001-toca-regalo/spec.md), [Plan 001 v0.1](../001-toca-regalo/plan.md)
Execution authorization: 002:T1 and T2 completed. “Continúa con la siguiente tarea” followed by “Autorizo todo” on 2026-11-17 authorizes T2 and its documented installation scope. No task after T2, browser binary download or application startup is authorized.

## Execution rules

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

- [ ] **T3. Wire the backend API runtime and real MySQL boundary.** NFR-1, NFR-3, NFR-4
  - Depends on: T2.
  - Work: Create minimal Symfony/API Platform JSON runtime, external configuration and real database connection; disable template/docs UI and expose no business entities.
  - Files/responsibility: backend/config/; backend/public/; backend/src/Api/; docker/nginx/.
  - Done when: A reproducible internal smoke check demonstrates JSON API execution and MySQL connection; unavailable dependencies fail visibly; backend returns no user HTML.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T4. Wire the Vue build and Nginx entry point.** NFR-2, NFR-3, NFR-4, NFR-5, NFR-6
  - Depends on: T3.
  - Work: Create Vue/Router/Bootstrap shell, native-fetch API boundary, Vite HMR and built-static Nginx routing; keep product routes for their own slices.
  - Files/responsibility: frontend/src/main.js; frontend/src/router/; frontend/src/api/; frontend/vite.config.js; docker/nginx/.
  - Done when: Frontend builds and loads through Nginx on desktop/mobile profiles; API requests follow the same origin; no Twig or backend view renders.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T5. Prepare focused verification harnesses and database isolation.** NFR-1, NFR-2, NFR-3, NFR-4, NFR-6, NFR-8
  - Depends on: T4.
  - Work: Configure PHPUnit, Vue component tests and Playwright browser profiles with isolated MySQL fixture/reset support; use a meaningful runtime-boundary check rather than an empty-suite success.
  - Files/responsibility: backend/phpunit.xml.dist; backend/tests/; frontend/vitest.config.js; frontend/tests/; playwright.config.js; tests/e2e/.
  - Done when: A focused API/database check and frontend boundary check execute reproducibly; test fixtures never use/reset development data; browser/viewport profiles match the approved plan.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T6. Connect local mail capture and worker runtime contracts.** NFR-3, NFR-7, NFR-9
  - Depends on: T5.
  - Work: Wire Mailpit SMTP, environment sender templates and worker/closure process entrypoints; deliver a test fixture email without introducing product notification behavior.
  - Files/responsibility: docker/worker/; docker/scheduler/; backend/config/; compose.yaml.
  - Done when: Local capture receives a fixture message; workers start/stop with their shared PHP image; SMTP secrets are absent from tracked files and the SMTP port stays internal.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T7. Document and expose approved developer/check commands.** NFR-3, NFR-5, NFR-7, NFR-8
  - Depends on: T6.
  - Work: Add development/check wrappers, VS Code tasks, editor conventions, Spanish README and English technical setup notes; startup/check wrappers never install packages.
  - Files/responsibility: scripts/dev; scripts/check; .vscode/tasks.json; .editorconfig; README.md; docs/development.md.
  - Done when: Documented wrapper commands invoke the intended container tools, VS Code tasks resolve, and setup/SMTP/key placeholders are understandable without real secrets.
  - Evidence: not executed; no completion or passing result claimed.

- [ ] **T8. Verify the complete development setup and record limits.** NFR-1, NFR-2, NFR-3, NFR-4, NFR-5, NFR-6, NFR-7, NFR-8, NFR-9
  - Depends on: T7.
  - Work: Run the authorized clean test-environment build/start/health/migration-harness and frontend-build procedures, inspect loopback ports and capture, and record commands/versions/results.
  - Files/responsibility: specs/002-development-foundation/verification.md; README.md; docs/development.md.
  - Done when: Reproducible setup checks pass or are explicitly blocked with evidence; no data volume is destroyed automatically; foundation coverage is distinguished from unimplemented product behavior.
  - Evidence: not executed; no completion or passing result claimed.

## Traceability and acceptance

See [plan traceability](./plan.md#traceability). FR-N maps to parent AC-N; NFR acceptance conditions are inherited verbatim in [spec](./spec.md). T1 is complete with static-check evidence; T2–T8 remain pending and unauthorized. No application/runtime acceptance is claimed.

## Phase boundary

After the last task, report evidence/limitations and request authorization for the next task/block as applicable. Final read-only application Validation requires its own authorization and the installed sdd-code-review workflow. Do not mark the parent specification implemented before accepted fulfilled Validation.

