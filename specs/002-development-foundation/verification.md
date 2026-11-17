# Verification — Development Foundation

Sources: [spec v0.1](./spec.md), [plan v0.1](./plan.md), [tasks v0.1](./tasks.md).
Scope: 002:T1 only, 2026-11-16. This is task evidence, not final application Validation.

## Authorization

The user stated “Apruebo y autorizo iniciar la T1 de spec 002” in response to the request to approve the derived-document/task package and start only 002:T1. No package/image/browser installation or later task is authorized.

## Deliverable

- [Development Compose](../../compose.yaml) defines PHP, frontend, Nginx, MySQL, Mailpit and profiled notification/closure workers; no automatic dependency installation at startup.
- [Test override](../../compose.test.yaml) uses an explicit separate project, database, database volume, ports, and assignment-key file. The documented `--project-name tocaregalo-test` avoids inheritance of the development project name from environment configuration.
- [Environment template](../../.env.example) contains public review-only markers, approved image families, timezone, database/mail values, retry/reset settings and external secret-file paths. No actual environment file or key was generated.
- [PHP build recipe](../../docker/php/Dockerfile), [PHP settings](../../docker/php/development.ini), [Node build recipe](../../docker/node/Dockerfile), and [Nginx config](../../docker/nginx/default.conf) are reviewable templates for the approved architecture. Build-time package installation is declared but has not been executed.
- [Ignore rules](../../.gitignore), [Docker context exclusions](../../.dockerignore), and [Spanish setup README](../../README.md) distinguish public templates from local credentials/dependencies and explain incomplete runtime status.

## Executed checks

| Check | Actual result |
| --- | --- |
| `docker compose --env-file .env.example -f compose.yaml --profile workers config --quiet` | Exit 0: development Compose model parses/interpolates, including worker profile. No daemon operation or image download. |
| `docker compose --project-name tocaregalo-test --env-file .env.example -f compose.yaml -f compose.test.yaml --profile workers config --quiet` | Exit 0: merged test model parses/interpolates, including overrides and worker profile. |
| Inspect both `config --format json` models in memory | Passed: seven intended services in each; only Nginx/Mailpit publish ports, all on 127.0.0.1; every service uses `pull_policy: never`; no installation/download commands in startup; API/workers inherit correct environments. No model secrets/values were printed. |
| Compare model isolation | Passed: distinct project/database-volume/database-URL/assignment-key-file values; all test workers use the isolated test database. |
| `git check-ignore --quiet` for seven local secret/dependency/runtime sample paths | All ignored as expected; the public `.env.example` returns the expected not-ignored result. No sample files were created by this check. |
| New-file whitespace checks using `git diff --no-index --check /dev/null <file>` | All nine added configuration/setup files have no diagnostics. Git's exit 1 for differing files is accepted only with empty diagnostics; values greater than 1 or diagnostics fail the check. |
| `git diff --check` | Exit 0, no whitespace diagnostics for tracked changes. |
| Editor diagnostics for Compose files, both Dockerfiles, Nginx config and README | No errors reported. This is not a substitute for image-based runtime validation. |

No behavioral test-first cycle applies to this configuration-only task: there is no product behavior implemented here. The approved task/plan prescribes inspecting/linting the actual configuration rather than writing tests that mirror its content. The static checks above are the task's done conditions.

## Requirement support and limitations

This task supports NFR-1/2/3/4/5/7 through reviewable environment/build/API-routing/language/mail configuration. None of these application-level acceptance conditions is claimed fulfilled by parsing configuration alone.

- Exact image patch versions/digests, Composer/npm manifests and dependency lockfiles are pending 002:T2 and explicit installation authorization. The current example family tags are not a resolved reproducible lock.
- No images were pulled/built, containers started, dependencies installed, real mail sent, or browser binaries downloaded. No key/secret generation or database mutation occurred.
- Application projects, actual API/Vue runtime, migrations, notification transport configuration and worker commands are not implemented yet. Bind sources use `create_host_path: false` and are not fabricated by this task.
- PHP extension loading, filesystem permissions, Nginx native syntax inside its image, Docker image availability, live health checks, SMTP capture and complete startup remain unexecuted. Host PHP/Node/Nginx are not installed for this task.
- Test/development isolation is confirmed at the configuration-model level, not through running databases. Future test wrappers must retain the explicit project override and isolated URL.
- Production TLS/SMTP deployment and actual secret supply remain future operational dependencies. Review-only marker values must be replaced before runtime use.

## Outcome and next step

002:T1 is complete: its configuration is reviewable, available static checks pass, and runtime limitations are explicit. Stop before 002:T2. Request task-start authorization and separate concrete installation/download permission before resolving/pulling/building dependencies or images.

## T3 progress

Date: 2026-11-17. Status: implementation in progress, not complete. Earlier sections record T1's historical scope; T2 results are in [dependency evidence](./dependency-resolution.md).

The user approved [T3 execution plan v0.1](./t3-execution-plan.md) with the condition to read the database connection from the same root .env used by Symfony and ask for its parameters. The database question is pending. No root/backend .env existed at initial inspection; no credentials have been selected or database container started. Branch: feature/002_T03-backend-api-runtime, from local dev, preserving pre-existing planning edits. No commit/push.

Implemented so far: minimal kernel and Runtime HTTP/console entrypoints; explicit FrameworkBundle/API Platform/Doctrine configuration; JSON-only request/error handling with Spanish generic error titles; smoke assertions and an isolated Compose definition with MySQL tmpfs and no published ports. Runtime entrypoints load `../.env` relative to Symfony's backend project directory; the smoke check loads that same root file through Symfony Dotenv. Doctrine reads DATABASE_URL, without a default production connection.

Actual checks:

- Initial `php tests/Smoke/backend-runtime.php --http-only` failed with exit 1 before the kernel existed. Installed Composer autoload/dependencies were present. No environment/database failure was presented as the intended initial missing-runtime result.
- Final `docker run --rm --pull=never --network none --user 1000:1000 --mount type=bind,src=/home/albertusko/Proyectos/tocaregalo,dst=/workspace --workdir /workspace/backend tocaregalo-php:dev php tests/Smoke/backend-runtime.php --http-only` exited 0, printing `HTTP JSON smoke checks passed.` It checks `/api` (200), an unknown API path (404), and `/api/docs` (404), each with JSON and HTML Accept. Bodies decode as JSON with no HTML, trace field or test secret. CLI-only diagnostics used while fixing the runtime were removed before the final run.
- HTTP-only mode uses an ephemeral process-only APP_SECRET and, only when DATABASE_URL is absent, a non-routable MySQL DSN fixture with a declared server version. Docker network is disabled. This is not a real connection, a user-selected parameter, or MySQL acceptance evidence. Full mode has no DATABASE_URL fallback and awaits the user's .env.
- PHP `-l` ran in the existing PHP tool container against all PHP files under src/config/public/tests/Smoke and bin/console: six files, all exit 0. No new image/package was installed.
- `docker compose --env-file .env.example --project-name tocaregalo-t3 -f compose.smoke.yaml config --quiet` exited 0. Public template markers were used only for parsing; no services were started with them.
- `git diff --check` passed at the progress boundary.

Pending: real MySQL SELECT 1/version/UTC checks, negative connection test, full dotenv-backed CLI/container/config verification, real smoke isolation inspection and cleanup. Existing T2 audit warnings remain open. T3 is unchecked and no full NFR/product acceptance is claimed. Wait for database parameters; do not start T4.

Subsequent user-requested service naming: all development/test/smoke service keys now start with `tocaregalo-`; depends_on references, Nginx PHP/frontend upstreams and example database/SMTP hosts were updated. All three Compose models were parsed with `config --format json`; service-prefix and dependency-target inspections passed (7/7/2 services respectively), as did `git diff --check`. An initial parse exposed one unchanged anchor dependency; it was corrected before the passing final checks. No service was started. User-supplied DB name/user are tocaregalo, port 3306; internal host is now tocaregalo-mysql. Runtime/database checks remain pending.

## T3 completion

Date: 2026-11-17. Status: task complete; earlier progress entries remain historical. Execution continued from clean current dev on `feature/002_T03-backend-runtime-verification` after the user stated “Sí. Prepara el .env. Asegúrate de que no se sube al repositorio (.gitignore)”, answering the request to generate local passwords/APP_SECRET and complete T3 verification.

The root .env was created exclusively (existing files would be preserved) from .env.example, replacing all review-only password/secret markers with independent PHP random_bytes(32) hex values and setting APP_DEBUG=0. No secret value was printed. Its database name/user are the user-supplied tocaregalo, host tocaregalo-mysql, port 3306. No recipient encryption key was generated. Native PHP generation used the existing tool image with network disabled; no package/image installation occurred.

Secret tracking checks:

- `git check-ignore -v .env`: exit 0, matched `.gitignore:55:/.env` (before and after creation).
- `stat --format='%a %n' .env`: `600 .env`.
- `git status --ignored --short .env`: `!! .env`.
- `git ls-files -- .env`: exit 0, no output; file is not tracked. The existing ignore rule already sufficed, so no redundant rule was added. Ignore rules do not prohibit an explicit future force-add.

All Compose commands below used `docker compose --env-file .env --project-name tocaregalo-t3 -f compose.smoke.yaml` as prefix, preserving the same root .env consumed by Symfony Dotenv. Commands never printed the resolved environment or container environment metadata.

| Command suffix/check | Actual result |
| --- | --- |
| `config --quiet` | Exit 0 with actual local environment. |
| Prior project-container inspection | No existing T3 containers; no unrelated stack adopted or modified. |
| `up --detach --no-build --pull never --wait --wait-timeout 120 tocaregalo-mysql` | Exit 0; dedicated MySQL healthy. |
| Targeted Docker inspect of Mounts/PortBindings/Tmpfs/health | Mounts empty, PortBindings empty, tmpfs `/var/lib/mysql`, healthy. No host/named data volume or published port. |
| `run --rm --no-deps --pull never tocaregalo-php-smoke` | Exit 0: HTTP JSON checks and actual MySQL 8.4 SELECT 1/version/UTC session checks passed. |
| `run --rm --no-deps --pull never --env DATABASE_URL=mysql://unused:unused@no-database.invalid:3306/unused?serverVersion=8.4.0 tocaregalo-php-smoke` | Expected exit 1: HTTP checks passed, then Doctrine DBAL ConnectionException at the MySQL stage. Diagnostic contained no DSN/password. Existing MySQL remained running/healthy until cleanup. |
| `run --rm --no-deps --pull never --env APP_CACHE_DIR=/tmp/tocaregalo-console-check tocaregalo-php-smoke php bin/console lint:container --resolve-env-vars` | Exit 0; Symfony Runtime console loaded the shared .env and checked service types/env resolution. |
| Same run prefix, `php bin/console lint:yaml config` | Exit 0; all five YAML files valid. |
| Same run prefix, `composer check-platform-reqs` | Exit 0; PHP/extensions/Composer platform satisfied. |
| `git diff --exit-code -- backend/composer.json backend/composer.lock frontend/package.json frontend/package-lock.json` | Exit 0; no dependency or lock changes. |
| `down` (without volume flags) | Exit 0; only dedicated MySQL container and project network removed. One-shot checks had already removed their own containers. |
| Final project-filtered container inspection | No remaining T3 containers. |

Combined with the earlier missing-runtime failure, final HTTP/PHP syntax/Compose checks and diff review, these results satisfy T3's bounded done condition for NFR-1/3/4 support. They do not verify external Nginx HTTP transport, frontend screens, business persistence/migrations, SMTP or browser flows. T2 audit warnings remain open. Root .env remains private/local; temporary MySQL data is gone with tmpfs cleanup. No commit or push was performed. Stop before T4 implementation; its execution plan must be presented and approved first.

## T9 completion

Date: 2026-11-17. Requirement: NFR-10. Branch: `feature/002_T09-phpstan-quality-gate`, created from current local `dev` with pre-existing documentation edits preserved. User authorization: “Apruebo las listas de tareas y autorizo el inicio de 002:T9 y las instalaciones”. This approves task lists v0.2, starts only T9 under [execution plan v0.1](./phpstan-execution-plan.md), and permits the four listed development packages (^2.0) and required transitives. No commit/push or T4 implementation.

### Implementation and initial findings

Installed/locked PHPStan **2.3.6**, phpstan-symfony **2.1.1**, phpstan-doctrine **2.1.2**, phpstan-phpunit **2.1.2**. Composer reported four installs, zero updates/removals; no additional transitives, plugins, tool images or host packages were installed. Existing approved runtime families and Twig conflicts remain unchanged.

[Configuration](../../backend/phpstan.neon.dist) explicitly includes the three framework/test extensions, fixed numeric level 10 and `src`, `tests`, `config`, `public`, `bin/console`; cache is under ignored `var/phpstan`. No baseline, ignoreErrors, excluded owned files, vendor patch or analysis bootstrap. The existing vendor autoloader supplies symbols without executing application entrypoints. The analysis container mounts only backend, so the private root .env is unavailable to it. Container XML is unnecessary for this current scope: the known public Doctrine service contract is documented at the service boundary. Reassess extension metadata needs when future services require it.

First analysis exited 1 with **14 errors**: mixed runtime options/context, environment timezone, CLI argv availability, secret type, and dynamic Doctrine connection/query types. A second run exposed four remaining connection-method errors because ManagerRegistry returns generic object; documented the configured DBAL Connection contract. Final fixes are boundary PHPDoc shapes/types and local variables in HTTP/console entrypoints, Kernel and the existing smoke check. MySQL scalar-return annotations describe the actual fixed SELECT expressions, not arbitrary query output. No product behavior, schema, auth or external-service policy was changed. Existing smoke checks cover the affected runtime; no artificial behavior test was added for type documentation.

### Reproducible commands and actual results

Commands below ran from the repository root. Existing local image `tocaregalo-php:dev`, PHP 8.5.12; no image pull/build. UID/GID 1000:1000 match this workstation.

```bash
docker run --rm --pull never --user 1000:1000 -e COMPOSER_HOME=/tmp/composer \
  -v /home/albertusko/Proyectos/tocaregalo/backend:/workspace/backend \
  -w /workspace/backend tocaregalo-php:dev \
  composer require --dev 'phpstan/phpstan:^2.0' 'phpstan/phpstan-symfony:^2.0' \
  'phpstan/phpstan-doctrine:^2.0' 'phpstan/phpstan-phpunit:^2.0' \
  --no-scripts --no-interaction --no-progress

docker run --rm --pull never --user 1000:1000 \
  -v /home/albertusko/Proyectos/tocaregalo/backend:/workspace/backend \
  -w /workspace/backend tocaregalo-php:dev \
  vendor/bin/phpstan analyse --configuration=phpstan.neon.dist --no-progress
```

Install exit 0. Initial analysis exit 1 as above. Final `composer analyse` (same analyse command) exited 0, `[OK] No errors`. Final explicit analysis with additional `--debug` also exited 0, bypassing the result cache and enumerating all six owned PHP files: bin/console, config/bundles.php, public/index.php, src/Api/JsonResponseSubscriber.php, src/Kernel.php, tests/Smoke/backend-runtime.php. Dependencies only provide symbols. Fixed level 10 and all-owned-PHP/test coverage verified; no finding hidden in a baseline.

Inside that same backend-only tool container:

- `composer validate --strict --no-check-publish`: exit 1 solely for the existing missing-license recommendation. No license decision made in T9.
- `composer validate --no-check-publish`: exit 0, same recommendation; manifest and lock valid.
- `composer check-platform-reqs`: exit 0, all installed PHP/extension requirements satisfied.
- `find src tests config public -name '*.php' -exec php -l {} \;` and `php -l bin/console`: all six syntax checks pass.
- `composer audit --locked --format=json`, with COMPOSER_HOME=/tmp/composer: exit 1, zero advisories and abandoned doctrine/common only. The require operation also reported no security advisories. Existing npm development audit findings from T2 are unchanged; npm was not installed/updated/audited in T9.

Runtime regression commands:

```bash
docker compose --env-file .env --project-name tocaregalo-t3 -f compose.smoke.yaml \
  up --detach --no-build --pull never --wait --wait-timeout 120 tocaregalo-mysql
docker compose --env-file .env --project-name tocaregalo-t3 -f compose.smoke.yaml \
  run --rm --no-deps --pull never tocaregalo-php-smoke
docker compose --env-file .env --project-name tocaregalo-t3 -f compose.smoke.yaml \
  run --rm --no-deps --pull never \
  -e 'DATABASE_URL=mysql://unused:unused@no-database.invalid:3306/unused?serverVersion=8.4.0' \
  tocaregalo-php-smoke
docker compose --env-file .env --project-name tocaregalo-t3 -f compose.smoke.yaml \
  run --rm --no-deps --pull never -e APP_CACHE_DIR=/tmp/tocaregalo-t9-console-check \
  tocaregalo-php-smoke php bin/console lint:container --resolve-env-vars
docker compose --env-file .env --project-name tocaregalo-t3 -f compose.smoke.yaml \
  run --rm --no-deps --pull never -e APP_CACHE_DIR=/tmp/tocaregalo-t9-console-check \
  tocaregalo-php-smoke php bin/console lint:yaml config
docker inspect --format '{{json .HostConfig.Tmpfs}} {{json .HostConfig.PortBindings}}' \
  tocaregalo-t3-tocaregalo-mysql-1
docker compose --env-file .env --project-name tocaregalo-t3 -f compose.smoke.yaml down
```

- Healthy MySQL startup exit 0. Smoke exit 0: HTTP JSON checks (200 entrypoint/404 unknown API/404 disabled docs, JSON and HTML Accept) and MySQL 8.4 SELECT 1/UTC session pass.
- Negative connection smoke: intended exit 1 at MySQL connection and queries with Doctrine DBAL ConnectionException; HTTP checks pass first, no DSN/secret logged.
- Symfony container lint exit 0; YAML lint exit 0, five valid YAML files.
- Inspection: tmpfs `/var/lib/mysql`, no published ports. Shutdown exit 0 removes only dedicated containers/network, without volume deletion. Final project container/network filters empty.
- Private .env: git check-ignore succeeds; git ls-files empty; mode 600. Never printed or modified by T9.
- Targeted editor diagnostics: no errors in changed PHP, manifest or PHPStan configuration. Final git diff --check and task-count/lock-scope checks pass.

### Limits and next task

T9 establishes NFR-10 tooling and verifies the current six owned PHP files. Repeat analysis after every future implementation; zero errors required before task completion. Framework/container/query types are contracts at dynamic boundaries, not a substitute for runtime tests. Existing audit/license recommendations are recorded, not silently repaired. No browser, frontend/Nginx or product acceptance is claimed. T4/Playwright approvals remain valid; stop at T9 and wait for the user to resume T4.
