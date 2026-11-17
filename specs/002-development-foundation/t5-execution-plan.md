# 002:T5 — Execution plan

Revision: v0.1
Status: approved; authorized T5 implementation complete
Approval: “Apruebo el plan y autorizo su implementación”, 2026-11-17. Approves v0.1 and its stated runtime; no package installation or download.
Date: 2026-11-17
Planning authorization: “continúa con T5”, after T4 completion. Under the user's per-task rule, this authorizes preparation and presentation only.
Authority: [Spec 002 v0.2](./spec.md), [Plan 002 v0.2](./plan.md), [parent verification strategy](../001-toca-regalo/plan.md#11-verification-strategy-and-evidence), [T5](./tasks.md). T4 and T9 are complete with [actual evidence](./verification.md).

## Outcome and limits

Establish executable, focused PHPUnit, Vue component and Playwright harnesses with isolated real MySQL fixtures. Verify existing runtime/UI boundaries rather than report empty suites as success. Support NFR-1/2/3/4/6/8/10; full product acceptance remains in subsequent blocks.

No user/group/event/draw schema, product endpoint, account fixture, migration, timer/reveal rule, mail delivery, worker or encryption-key generation. Tests exercise the current JSON API, shell and missing-route navigation only. Do not invent product behavior to populate the harness. General developer wrappers and VS Code tasks remain T7; full environment verification remains T8.

## Prerequisites and branch

After explicit approval, inspect Git status and start `feature/002_T05-verification-harnesses` from current local dev. Preserve all edits; stop if switching is unsafe. No commit, merge, stash, reset or push.

Reuse installed PHPUnit 12, BrowserKit, Vitest, Vue Test Utils, jsdom, Playwright 1.65.1, PHPStan and existing pinned PHP/Node/MySQL/Nginx/Playwright images. No package installation, lock update, image pull/build or browser download is included. Missing/incompatible tools are a blocker requiring a concrete follow-up proposal, not permission to install or bypass checks.

Continue using the ignored root .env as Symfony's shared parameter source. Do not print, overwrite or regenerate secrets. Validate required test parameters without displaying their values. Existing approved template names the test database `tocaregalo_test`, with TEST_DATABASE_URL/TEST_MYSQL_DATABASE and TEST_HTTP_PORT (8081 default). Ask the user if actual necessary parameters are missing or inconsistent; do not invent replacement credentials/ports. No need to ask for already supplied development database parameters again.

## Proposed files and responsibilities

| Files | Responsibility |
| --- | --- |
| `backend/phpunit.xml.dist`, `backend/tests/bootstrap.php` | Nonempty suite discovery; autoload; test kernel/environment/cache isolation and external parameter loading; never install or reset data at bootstrap. |
| `backend/config/packages/test/framework.yaml` | Symfony test support only in test environment; no test-only public product endpoint. |
| `backend/tests/Support/TestDatabase.php`, focused support tests | Explicit test-target validation before connection/mutation; fixture transaction/rollback helpers scoped to harness data. |
| `backend/tests/Integration/DatabaseBoundaryTest.php` | Real MySQL version/UTC, bound fixture insert/read, rollback/reset verification and isolated target checks. |
| `backend/tests/Functional/ApiBoundaryTest.php` | Kernel/BrowserKit JSON API success/not-found/disabled-docs and HTML-Accept regression; no diagnostic/secret disclosure. |
| `frontend/vitest.config.js`, `frontend/tests/components/NotFoundView.test.js` | Installed Vue plugin, jsdom component environment and real router/navigation assertions; preserve existing API-client tests. |
| `playwright.config.js`, `tests/e2e/shell.spec.js` and small support module if required | Chromium desktop/mobile, Firefox/WebKit desktop; existing shell, keyboard, SPA refresh, overflow, private paths and same-origin API checks. |
| `frontend/package.json` | Point existing test/e2e scripts at explicit configurations as needed; reuse frontend-installed runner, no new root manifest or dependency. |
| `compose.verification.yaml` | Dedicated test-only PHP/MySQL/Vite/Nginx/browser/check services; tmpfs DB, restricted bind mounts and explicit test environment. |
| `.gitignore`, `README.md`, task/verification/memory documents | Ignore reports/caches; Spanish reproducible commands and current scope; actual approval/results/limits. |

Names of narrowly scoped support/test files may be refined within these responsibilities. No unrelated runtime refactor or PHPStan exclusion is included.

Root Playwright configuration/tests must resolve the existing frontend-installed Playwright package explicitly, using a small local import bridge if necessary. Do not introduce a duplicate root dependency tree. PHPStan's existing tests path already covers all new PHP test/support files; retain level 10 and zero-error policy.

## Database isolation and fixture contract

Use a dedicated `tocaregalo-test` Compose project with a standalone verification configuration. Always set the project explicitly to override COMPOSE_PROJECT_NAME from the shared .env. Do not start the incomplete full application/worker stack or reuse development containers.

- MySQL uses the approved pinned 8.4 image, test database name and existing local credentials, tmpfs storage, no published DB port and no named/external volume. Its application account is initialized for that test database only. No service attaches an existing project network or development data directory.
- PHP receives APP_ENV=test, the explicit TEST_DATABASE_URL as DATABASE_URL, test cache paths and the shared root .env read-only. Bootstrap preserves externally supplied test values against root development defaults. Node/browser receive no root .env, backend source or database credential environment. Nginx receives only its config and compiled assets where needed. Database test secrets do not reach browser reports/logs.
- Before fixture operations, reject non-test APP_ENV, missing/mismatched test database names, equality with the configured development database, unapproved connection hosts or URLs not matching the declared test target. Do not rely only on an `_test` suffix. Fail before connecting/mutating; errors must not echo DSNs/passwords.
- Prove refusal of development-like/mismatched targets in focused tests using supplied strings, without opening those connections. Require a real test-server connection for integration checks; never substitute SQLite or skip unavailable MySQL as a passing result.
- Use a harness-only temporary table and bound values. Verify insert/read and transaction rollback restores the fixture's initial state; cleanup only the helper's own temporary data/connection. MySQL temporary-table DDL must remain outside the transactional fixture section. No database drop, schema-wide truncate, migration, production-table deletion or volume reset.
- Keep these DB tests sequential and independent of order; do not introduce shared parallel fixtures. Future business-schema migrations and fixture lifecycle are added with their own approved slices. This task demonstrates the reset boundary on real MySQL, not migration coverage for nonexistent entities.

## Test design and execution sequence after approval

1. Add focused assertions for test-target rejection and fixture lifecycle, current API JSON behavior and component navigation. Show intended failures where missing harness support is the cause; distinguish unavailable dependencies from behavioral red tests. Where current T3/T4 tests already demonstrate behavior, record that evidence rather than break working code artificially.
2. Configure PHPUnit/bootstrap and test-only framework support. Implement the smallest guarded database helper; prove real insert/read/rollback isolation and existing JSON boundary through the discovered suites. No install or destructive reset in suite startup/teardown.
3. Configure Vitest/jsdom and mount the actual NotFoundView with a memory router. Assert Spanish heading/link and real navigation to the preparation view. Run existing API-client tests in the same intended harness. Keyboard reachability is verified in browsers rather than pretending jsdom proves browser focus behavior.
4. Configure Playwright with Chromium 1440x900 and 390x844, Firefox/WebKit 1440x900. Reuse the exact installed-version browser image. Test Spanish shell, Bootstrap-loaded layout, not-found refresh/navigation, keyboard link activation, no horizontal overflow, JSON API/error routing and private-path protections. No product auth/reveal/recovery acceptance is claimed. T4 standalone HMR/static checks remain reproducible regressions; do not duplicate source-edit HMR across parallel browser projects.
5. Run focused PHPUnit/real-MySQL, Vue/API-client and Playwright projects, frontend build and relevant Symfony/PHP syntax/configuration checks. Use one browser worker initially to keep fixtures/process behavior deterministic. Confirm suite counts and fail-on-empty behavior where supported; missing/unexecuted required checks block completion.
6. Run PHPStan level 10 on all owned PHP including the new tests/support code, requiring zero errors without baseline or excluded owned files. Make only justified in-scope type fixes, rerun affected checks, record commands/results/audit limits and stop after T5.

## Runtime scope requested with this plan

After approval, start only dedicated test MySQL, PHP/FPM, Vite and Nginx plus ephemeral PHP/Node/browser check containers from existing images, all with representative `tocaregalo-` names and pull_policy never. No package/image build/download, dependency install, worker, SMTP or key setup.

Publish only test HTTP on 127.0.0.1 using the already approved TEST_HTTP_PORT (8081 default); check availability and stop on conflict rather than choose another port. Run browser traffic on Nginx's Docker-network origin with no CORS workaround. Browser configuration uses the installed tools and explicit existing repository mounts; no Docker socket mount or private backend environment. Allow ignored cache/build/test-report writes only as needed.

The test database exists only inside the newly started dedicated MySQL tmpfs. Validate project identity and mounts before DB checks. Start no unrelated service. On success or failure, stop/remove only this dedicated verification project's containers/network without volume deletion; preserve report evidence and do not destroy existing development/test volumes. If a project with this name is already running, inspect and report the conflict rather than replace it automatically.

## Completion evidence and traceability

| Requirement | Required T5 evidence |
| --- | --- |
| NFR-1 | PHPUnit discovers/runs actual API and real MySQL tests; insert/read/rollback and version/UTC checks pass. |
| NFR-2 | Real Vue component/router test and frontend build pass; no Twig introduced. |
| NFR-3 | Dedicated Compose parses, runtime/isolation inspected and actual Nginx API/SPA browser traffic passes. |
| NFR-4 | Discovered API tests and browser calls return JSON, including errors and HTML Accept; existing client boundary tests pass. |
| NFR-6 | Current shell works in Chromium desktop/mobile and configured Firefox/WebKit desktop; product-flow evidence deferred. |
| NFR-8 | Existing Spanish missing-route state/link navigation, keyboard and focus checked; no invented forms/loading flows. |
| NFR-10 | Final PHPStan level 10, all owned PHP/test/support paths, exit 0/zero errors, no concealment. |
| Isolation | Bad targets rejected before connection, real test fixture reset verified, no development data mount/port, .env still private, dedicated cleanup confirmed. |

Record actual versions, commands, test counts, expected negative exits and any blockers in verification.md; mark T5 complete only after all required checks pass. No arbitrary coverage threshold, no clean-audit claim: existing npm dev warnings, doctrine/common abandonment and Composer license recommendation remain documented. New download/install requirements or a material scope change require a separate proposal/authorization.

## Approval request

Approve this execution plan v0.1 and authorize its bounded T5 implementation/runtime scope, including isolated temporary MySQL and the four stated browser projects using existing images. No installation authorization is requested because no installation is planned. This planning step changes documentation only, stays on current dev, starts no services and leaves T5 incomplete.

## Execution outcome

Completed 2026-11-17 on feature/002_T05-verification-harnesses. [T5 evidence](./verification.md#t5-completion): PHPUnit 20 tests/68 assertions, Vitest 12 tests, Playwright 8 tests/four projects, frontend build, PHPStan level 10 zero errors, PHP/Symfony configuration and isolation checks pass. Initial missing-helper red test and cold multi-worker timeout diagnosis recorded. No install/download, new secrets, product behavior, commit or push. Dedicated runtime removed; stop before T6. This outcome supersedes planning-time pending statements above.
