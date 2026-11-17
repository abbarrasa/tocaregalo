# 002:T3 — Execution plan

Revision: v0.1
Status: approved with the user's environment-file condition; implementation complete
Approval: “Para la configuración de la conexión a la base de datos, usa los parámetros del fichero .env que también usa Symfony. Cuando necesites que te diga los parámetros, pregúntamelos. Apruebo el plan” on 2026-11-17.
Binding condition: use the project-root ignored .env as Symfony Dotenv and smoke Compose configuration source. Ask the user for database parameters before connecting; never invent or overwrite their credentials. Database verification is pending their response. The approval authorizes this task only.
Completion: the user supplied database/user tocaregalo, port 3306, and explicitly authorized preparing ignored .env with generated local secrets. Actual runtime/negative/configuration checks and cleanup succeeded; see [T3 completion](./verification.md#t3-completion). Earlier pending statements describe the approval-stage context.
User-directed naming adjustment: on 2026-11-17 the user explicitly requested representative Docker service names prefixed with tocaregalo. Apply `tocaregalo-` to existing service keys across development/test/smoke Compose files and update depends_on, Nginx upstreams and example DSN hosts. This changes technical names only, not the approved stack/product scope. The supplied DB name/user remain tocaregalo and port 3306; the internal service host is now tocaregalo-mysql. Do not overwrite a user-supplied .env or run databases as part of renaming.
Date: 2026-11-17
Authority: [Spec 002 v0.1](./spec.md), [Plan 002 v0.1](./plan.md), [parent architecture v0.1](../001-toca-regalo/plan.md), [task T3](./tasks.md).
Planning authorization: “Continúa con T3, presentando su plan de ejecución y esperando a que lo apruebe […] con cada tarea en este proyecto.” Planning only is authorized.

## Objective and scope

Wire the installed Symfony/API Platform backend to actual isolated MySQL 8.4 and demonstrate JSON request handling. This supports NFR-1, NFR-3 and NFR-4; it does not implement business resources or fulfill product acceptance criteria.

Use T2 dependencies and pinned images unchanged. No new installation, pull/build, browser, Vue shell, account flow, business entity, migration, worker, SMTP delivery or recipient encryption key. T3 tests HTTP handling inside the Symfony kernel; full Nginx/frontend execution remains T4/T8.

## Prerequisites and branch

After explicit approval, run `git status --short --branch` and preserve all edits. Create `feature/002_T03-backend-api-runtime` from the then-current local `dev`. Stop if changing branches would overwrite work. Do not fetch, merge, stash, commit or push.

Verify T2 lockfiles, installed packages, PHP tool image and pinned MySQL image are available. Report missing prerequisites rather than reinstalling without authorization. Planning inspection found clean local `dev` with T2 files. Original requirements/ER files remain missing as recorded previously; use approved specifications/architecture without reinterpreting product sources. Restore originals before any work requiring renewed source interpretation.

## Files and responsibilities

| Planned file/directory | Responsibility |
| --- | --- |
| `backend/src/Kernel.php` | Minimal Symfony kernel and configuration loading. |
| `backend/public/index.php`, `backend/bin/console` | Symfony Runtime HTTP/console entrypoints, without views or scaffolding installer. |
| `backend/config/bundles.php`, `services.yaml`, `routes.yaml` | Explicit bundle/service registration and `/api` routes. |
| `backend/config/packages/framework.yaml` | External APP_SECRET, smoke debug disabled, JSON errors and system timezone handling. Sessions/authentication remain later work. |
| `backend/config/packages/api_platform.yaml` | JSON API formats, no Swagger/ReDoc/HTML documentation UI or GraphQL, empty resource set. |
| `backend/config/packages/doctrine.yaml` | External DATABASE_URL, actual MySQL DBAL connection, UTF-8 and UTC session; no business mappings/schema. |
| `backend/src/Api/` | JSON error adapter only if standard configuration cannot ensure the contract. No new public health endpoint. |
| `backend/tests/Smoke/backend-runtime.php` | Standalone meaningful runtime checks; full PHPUnit harness remains T5. |
| `compose.smoke.yaml` | Isolated MySQL and one-shot PHP smoke services, pinned images, no published ports, assignment-key mount or frontend/worker dependency. |
| `specs/002-development-foundation/verification.md`, `README.md` | Exact evidence/limits and Spanish setup status. |
| `AGENTS.md`, `MEMORY.md`, task list/index | Approval, actual checks, completion and next approval boundary. |

Kernel/entrypoints are included in the parent plan; smoke Compose is verification infrastructure for T3's existing done condition. No domain schema/function or user screen is needed in this increment. No new dependency or architecture family is proposed.

## Implementation sequence, only after approval

1. Write smoke assertions first and demonstrate the expected initial failure from the missing runtime, distinguishing it from unavailable dependencies/tooling.
2. Add minimal kernel, HTTP/console entrypoints and explicit configuration. API Platform's `/api` entrypoint returns JSON without business resources. Unknown API paths return JSON errors, including HTML Accept requests, without exception traces or credentials.
3. Wire Doctrine via DATABASE_URL. Execute read-only `SELECT 1` against MySQL; verify version family 8.4 and UTC session. No tables or business fixtures.
4. Run success and dependency-failure checks in the isolated environment below. Do not substitute SQLite or hide failures. A missing product decision or material plan change requires review before dependent changes.
5. Review diff, record exact commands/results/limits, update task/memory, present result and stop before T4. No commit or push.

## Runtime operations requested with plan approval

- Start only dedicated Compose project `tocaregalo-t3`, using existing pinned MySQL and built PHP images with pulls/builds disabled. Start no development/test application stack.
- Initialize an empty smoke database in container tmpfs at `/var/lib/mysql`. This initialization was excluded from T2 and is explicitly proposed here. Mount no persistent named volume or host database directory.
- Generate temporary APP_SECRET and MySQL smoke credentials using the installed PHP random generator. Store only in an ignored, owner-readable local environment file; never print them or reuse public review-only placeholders. No recipient encryption key or existing credential is changed.
- Execute one-shot PHP checks with the backend directory mounted and no public port. Check invalid isolated DB connection settings separately: nonzero exit and sanitized diagnostic, no interruption of existing services.
- Stop/remove only this dedicated project's containers/network. Never use `down --volumes` or remove existing volumes. Its tmpfs disappears with its container; keep local credentials ignored and do not delete unrelated files.

No runtime operation is performed during planning. Implementation evidence must record exact commands with the explicit project name and disabled pulls/builds.

## Verification and task completion

| Requirement/check | Required evidence |
| --- | --- |
| NFR-1 | Symfony/API Platform `/api` JSON response and real MySQL 8.4 `SELECT 1` returning 1; no SQLite fallback. |
| NFR-3 | Reproducible isolated Compose smoke execution with pinned images, no public ports or existing-volume changes. Nginx app verification remains T4/T8. |
| NFR-4 | Kernel HTTP requests for `/api` and unknown API path, including HTML Accept: proper status, JSON content type/body, no user HTML/docs UI/tracebacks/credentials. |
| Dependency failure | Invalid isolated DB host/settings produces nonzero exit and sanitized diagnostic, never a false success. |
| Regression | PHP syntax lint, Symfony configuration/container checks, Composer lock/platform consistency, JSON/Twig review, Compose configuration and whitespace checks; no lock changes. |

No empty-suite success or invented coverage percentage. Any required failing/unavailable check blocks task completion and is recorded honestly. Existing T2 audit warnings remain visible; their repair is outside this increment.

## Approval requested

Approve execution plan v0.1 and authorize only T3 implementation and the isolated runtime operations above. T4 and new installations remain separately gated. Implementation has not started.
