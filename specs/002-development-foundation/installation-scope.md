# 002:T2 — Installation scope for approval

Date: 2026-11-17
Status: authorized and executed; T2 complete with documented audit warnings
Installation authorization: “Autorizo todo” on 2026-11-17, in response to the concrete scope below. This authorization does not extend to later tasks or excluded operations.
Task-start evidence: “Continúa con la siguiente tarea” on 2026-11-17.
Branch: `feature/002_T02-lock-dependencies`, created from local `dev` with a clean working tree.
Authority: [approved task T2](./tasks.md), [approved architecture](../001-toca-regalo/plan.md).

## Reviewable manifests

- [Backend manifest](../../backend/composer.json): PHP 8.5; API Platform Symfony/Doctrine ORM components 4.2; Doctrine ORM 3, DBAL 4, compatible bundles/migrations; Symfony 7.4 runtime, configuration, console, security, password hashing, validation, serialization, clock, mail and durable notification components; PHPUnit 12 and BrowserKit helpers.
- [Frontend manifest](../../frontend/package.json): Node 24; Vue 3, Router 4, Bootstrap 5.3, Vue Tel Input; Vite 8 with its Vue plugin; Vitest, Vue Test Utils 2, jsdom for DOM component tests, Playwright 1.

Unspecified stable lines in the approved plan use `*` only in this initial review manifest: Vue Tel Input, the Vue compiler plugin, Vitest and jsdom. Resolve stable versions compatible with Node 24/Vue 3/Vite 8, then replace these ranges with the resolved version family and record exact versions in the lockfile. Do not accept prereleases or ignore incompatible engines/peer dependencies. This document does not assert that resolution has passed.

The backend allows only the Symfony Runtime Composer plugin, needed to generate its runtime entrypoint during installation. No Symfony Flex plugin/recipes or application scaffolding scripts are included. Composer conflicts explicitly reject Twig and its Symfony integrations. Preserve the existing repository license; these private application manifests do not grant a new license.

## Requested download and build authorization

1. Query registries and download the six existing base/service image families: `php:8.5-fpm-bookworm`, `composer:2`, `node:24-bookworm-slim`, `mysql:8.4`, `nginx:stable-alpine`, `axllent/mailpit:v1`. Record exact versions and immutable digests; use the resolved references in configuration. Image downloads can consume several gigabytes; their exact size is not yet measured.
2. Build the two development tool images using the existing [PHP Dockerfile](../../docker/php/Dockerfile) and [Node Dockerfile](../../docker/node/Dockerfile). The PHP build downloads Debian packages `git`, `unzip`, `tzdata`, `libicu-dev`, `libonig-dev`, `libzip-dev` and their required dependencies, and compiles `intl`, `mbstring`, `pdo_mysql`, `zip`. Verify the base image supplies Sodium and all required PHPUnit extensions; surface missing prerequisites before altering the build scope.
3. Run Composer and npm in disposable tool containers, mounted only to the required project directories and tool caches. Download the declared packages and their required transitive dependencies. Generate `composer.lock` and `package-lock.json`, with local ignored `vendor` and `node_modules` directories. Use the actual PHP platform; no ignored platform/engine requirements, forced peer resolution, global host installation or implicit application scripts. Initial resolution disables package scripts; review any necessary subsequent scripts before execution.
4. Record resolved dependencies/images and actual commands/downloads. Validate manifest/lock consistency, platform/engine compatibility, absent Twig, and dependency security audit results. Report failures without silently selecting a different approved family.

Application services, MySQL initialization/migrations, real SMTP, secret/key generation and browser binary downloads are outside this authorization request. Only temporary dependency-tool containers are needed for T2. Playwright's npm package is included, with browser downloads explicitly disabled; browser binaries will be requested with their later verification scope. No database volumes will be created or removed. No commit or push is included.

## Current evidence and limits

Executed on 2026-11-17: Perl JSON::PP decoded both manifests successfully; `git diff --check` passed for tracked changes; `git diff --no-index --check /dev/null <file>` reported no whitespace diagnostics for both manifests and this scope document (exit 1 denotes new-file differences); editor diagnostics reported no errors for either manifest. Final status: the feature branch contains modified AGENTS/MEMORY/tasks and untracked backend/frontend manifests plus this scope document. No commit/push occurred.

Subsequent authorized resolution/build/installation and checks are recorded in [T2 resolution evidence](./dependency-resolution.md). Both lockfiles and all six image digests now exist. Audit warnings are explicit; application tests remain unexecuted and T3 remains unauthorized.
