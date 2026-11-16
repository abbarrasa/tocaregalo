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
