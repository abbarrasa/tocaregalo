# 002:T8 — Execution plan

Revision: v0.1
Status: approved; completed with documented readiness limits
Approval: “Apruebo el plan y autorizo su ejecución”, 2026-11-17.
Date: 2026-11-17
Planning authorization: “Continúa con la siguiente tarea”, after T7 completion.
Authority: approved [Spec 002 v0.2](./spec.md), [Plan 002 v0.2](./plan.md), [T8](./tasks.md), parent [Plan 001 v0.2](../001-toca-regalo/plan.md), [T7 evidence](./verification.md#t7-completion).

## Objective and scope

Execute the foundation's existing verification procedures as an aggregate, inspect isolation/runtime configuration and record reproducible results and remaining limitations. This is the last implementation/check task in block 002, not final read-only SDD Validation or acceptance of the application.

Current local dev is clean. After approval, inspect status again and start `feature/002_T08-foundation-verification` from then-current local dev, preserving planning edits. Stop on unsafe switching. No commit, push, merge, stash, reset or restore.

No installation, package update, image pull/build, browser download, secret/key generation, production SMTP, deployment, real account creation or business migration. “Build” here means the existing frontend compilation; a clean dependency/image rebuild would require separate explicit installation scope and authorization. Clean test startup means an unoccupied reserved test project with tmpfs MySQL, not deleting existing data or uninstalling dependencies.

## Files and responsibilities

| File | Planned update |
| --- | --- |
| `verification.md` in this directory | Commands, versions, results, isolation/port checks, per-NFR evidence and explicit missing checks. |
| `README.md` | Spanish current setup status and actionable limitations, grounded in actual checks. |
| `docs/development.md` | English operational results/limits and accurate command guidance. |
| `tasks.md`, parent task index, `MEMORY.md`, `AGENTS.md`, this execution plan | Approval, bounded completion result and next approval boundary. |

No runtime code, Compose, wrapper, manifest or lock change is proposed. If verification reveals a defect, capture the failing evidence, stop dependent checks and propose a corrective task/plan for authorization under SDD. Do not repair it implicitly as part of this verification task.

## Sequence after approval

1. Record approval and branch. Inspect available installed images/tools and private-input presence without printing dotenv, key contents, credentials or full resolved Compose configuration. Confirm root dotenv remains ignored/untracked with mode 600; keep existing values untouched. Refuse an existing `tocaregalo-test` project/network/active lock or occupied loopback test port; do not adopt or remove unrelated resources.
2. Validate main development/test-overlay and standalone verification/mail Compose models with quiet or selectively parsed output. Inspect service names, image references, loopback HTTP/UI publications, internal-only DB/SMTP, tmpfs test storage, shared read-only dotenv, explicit test database and worker profiles/signals. Config checks are not runtime success.
3. Run `scripts/check all` using existing installed images: static → PHPStan → real-MySQL backend → local Mailpit suite → Vue tests → frontend build → four-project Playwright. This exercises T7 aggregate sequencing and live mail delegation not rerun during T7. Use existing tests, not artificial new tests of documentation. Stop on first failing stage; record skipped downstream stages accurately. Repeat only affected stages after separately authorized corrections if needed.
4. Observe active test runtime using narrowly selected Docker metadata: test database service health, tmpfs storage and absence of DB/SMTP publications; HTTP/UI bindings restricted to loopback. Observation may run alongside the aggregate in a second local command session, without changing services. The Mailpit fixture capture/queue acknowledgement is asserted by existing mail tests; browser shell/API/privacy/keyboard/viewport checks are asserted by existing Playwright tests. No product draw/recovery/closure acceptance is inferred.
5. Record unavailable operations: full development startup remains blocked by unprovisioned assignment keys; migration configuration/schema and SUPERADMIN command are unfinished. Reproduce safe failure paths if needed without starting development services or executing business mutations. Existing real temporary-table/rollback tests are database harness evidence, not executed application migrations. The real event-closure deadline remains 004:T8; T6 probe is process evidence only.
6. After checks, verify owned test containers/network/lock are removed, no unrelated/development data was touched, dependency manifests/locks unchanged and private dotenv still ignored. Run final `scripts/check phpstan` at fixed level 10 over all owned PHP including tests, with zero errors/no baseline; failure prevents completion. Check whitespace, local documentation links and relevant editor diagnostics.
7. Update evidence/status only from actual results. T8's done condition permits explicitly blocked setup checks with evidence; distinguish that bounded task completion from complete environment readiness. Present the results and stop. Request authorization for block 002 read-only Validation using `sdd-code-review`; do not begin it, mark a specification implemented, or start block 003 automatically.

## Runtime authorization requested

Existing PHP/Node/MySQL/Nginx/Mailpit/Playwright images only. The aggregate sequentially owns the reserved `tocaregalo-test` project through the existing standalone T5/T6 models. MySQL uses tmpfs and existing guarded fixtures. Browser HTTP defaults to loopback 8081; Mailpit UI defaults to loopback 8026; actual configured ports are checked before startup. Local fixture emails remain inside Mailpit. No external recipients or SMTP credentials are needed.

Wrappers perform scoped success/failure/signal cleanup, never volume deletion. If interrupted in a way that bypasses traps, inspect exact ownership before any cleanup; do not remove an unrelated or preexisting project. No full development stack, keys, business migration, SUPERADMIN command or package/image operation is requested. Genuinely missing user parameters must be requested; do not invent them.

## Traceability and reporting

| Requirement | Evidence planned in T8 | Limit |
| --- | --- | --- |
| NFR-1/3 | Symfony/API JSON + real MySQL tests, Nginx browser runtime, configuration/health/isolation | Full development stack remains blocked by keys. |
| NFR-2/4 | Vue build and same-origin JSON/private-path browser tests | No business application flows implemented. |
| NFR-5/8 | Spanish shell/docs, existing keyboard/error tests, English technical artifacts | Future product forms/loading/error states deferred. |
| NFR-6 | Chromium desktop/mobile, Firefox and WebKit configured profiles | Foundation shell only. |
| NFR-7 | Local fixture capture/queue acknowledgement, external SMTP template and secret review | Assignment/recovery business emails and external delivery deferred. |
| NFR-9 | Worker configuration and historical T6 process evidence clearly separated | Real boundary/60-second closure not implemented; no fulfillment claim. |
| NFR-10 | Aggregate and final level-10 zero-error analysis with existing full owned-PHP scope | Mandatory task-completion gate. |

Expected counts are historical references, not promised results: backend 23 tests/74 assertions, full mail harness 29 tests/105 assertions, Vitest 12, Playwright 8 across four projects. Record actual versions/counts/exits and any newly observed warning. Retain historical audit/license warnings; no fresh vulnerability audit is claimed without executing one.

## Approval and completion record

Approved with “Apruebo el plan y autorizo su ejecución”, 2026-11-17. Existing-image aggregate and final PHPStan passed; see verification.md#t8-execution-record. Full startup/business readiness remains limited as recorded. Stop before read-only SDD Validation, which requires separate authorization.