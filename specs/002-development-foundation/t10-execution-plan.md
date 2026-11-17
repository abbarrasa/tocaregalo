# 002:T10 — Execution plan

Revision: v0.1
Status: approved; implementation and bounded checks complete
Approval: “Apruebo el plan y autorizo su implementación y las comprobaciones”, 2026-11-17.
Date: 2026-11-17
Planning authorization: “apruebo las listas y autorizo a preparar el plan de ejecución”. Approves task lists/index v0.3; authorizes preparation only.
Authority: approved [Spec 002 v0.2](./spec.md), parent Spec 001 v1.1, approved [Plan 002 v0.3](./plan.md), [parent plan v0.3](../001-toca-regalo/plan.md), [005 plan v0.3](../005-confidential-draws/plan.md), [T10](./tasks.md), [startup proposal](./startup-remediation-proposal.md).

## Scope and limits

Remove the unused assignment-key requirement from current foundation startup and verify the actual main service graph through a bounded isolated mode. NFR-3 primary; NFR-1/4/5/7/10 supporting. No change to specifications, encryption requirements, backup policy or future 005:T2 mandatory consumer keys/fail-closed behavior. No dummy/real key file, key schema, installation, image build/pull, browser download, business schema/migration, account, worker startup, external SMTP, deployment or CI change.

Git condition amended by explicit “Autorizo”, 2026-11-17: dev and HEAD both at 48147c797c9f426f007b9dbe81b1926ac20e4f11; create feature/002_T10-main-startup-prerequisites from dev carrying all existing approved documentation edits without commit/merge/stash. Branch creation succeeded and edits were preserved. No implicit Git history operation or push.

## Files and responsibilities

| Files | Change |
| --- | --- |
| `compose.yaml`, `compose.test.yaml` | Remove unused ASSIGNMENT_KEY_FILE, assignment-key mounts/declarations and obsolete test-secret override; preserve unrelated service/environment/port/volume/image configuration. |
| `compose.startup-verification.yaml` | Reviewed storage/port/environment-only override for the main graph, never a replacement standalone graph. |
| `scripts/dev`, `scripts/lib/common.sh` | Remove unused key preflight; share startup delegation between up/verify; add only the fixed verification mode and ownership safeguards. Keep existing check behavior. |
| `tests/scripts/` | Test-first wrapper/model-routing and error/ownership boundaries using isolated recorder fixtures. |
| `tests/startup/` | Model parity/safety assertions and main-runtime read-only DB/browser checks using installed containers. No host PHP/Node dependency. |
| `README.md`, `docs/development.md`, `.env.example` comments if needed | Current startup/help/limits and explicit future key activation; private dotenv untouched. |
| Verification/task/memory/governance records | Actual checks, approval and next review boundary. |

No Composer/npm manifest/lock change. No task in 005 is implemented.

## Command and override contract

`scripts/dev up`: existing explicit development project `tocaregalo` and main `compose.yaml`, same selected services as today, no unused key guard. `scripts/dev down`: unchanged ordinary lifecycle. Add `scripts/dev verify` with no extra arguments or arbitrary Compose/project/file/DSN overrides. Help remains Spanish with no daemon access. Verification shares the same helper that starts Nginx and Mailpit plus their declared dependencies; workers remain excluded even if ambient profiles are set.

Verification always uses explicit project `tocaregalo-startup` and files `compose.yaml` then `compose.startup-verification.yaml`, with root `.env` as data. Override contents:

- Clear MySQL data volumes using Compose `!reset []` and add tmpfs `/var/lib/mysql`; no named/bind data mount remains. Do not mount the existing development volume. The unused top-level volume declaration is not a data mount and must not result in creating a persistent volume.
- Replace Nginx publications with `!override` loopback `127.0.0.1:8083:80` and Mailpit UI with `127.0.0.1:8028:8025`; no SMTP/DB host publication.
- Set APP_ENV=dev for PHP and APP_PUBLIC_URL to the verification URL; set frontend VITE_PUBLIC_PORT=8083. These are verification address/environment selections; preserve all other variables, especially credentials, timezone and DATABASE_URL. No private values are printed.
- Preserve every main service image, startup command, dependency, dotenv mount and applicable worker profile. Only the existing non-worker graph starts. The verification DB has the supplied development database name in an isolated MySQL instance, not a connection to the persistent development server.

Resolve models privately and compare them before mutation. Allow differences only in the named storage/port/address/environment selections, Compose project-derived identifiers and removed data mount. Refuse any unexpected named data mount, changed image/command/dependency/credential, external DB host or ambiguous database target. Validate the effective DATABASE_URL points to `tocaregalo-mysql:3306` and matches the selected MySQL database/account parameters without printing them. No substitute credentials are generated.

## Ownership and runtime procedure

1. Check tools/private dotenv/dependencies; inspect existing local image availability. No implicit build/pull/install. Parse quiet/selective config only. Refuse preexisting development or startup project containers/networks/volumes, an active ignored startup lock, or occupied loopback ports 8083/8028; inspection errors must fail closed. Acquire exclusive ignored lock before claiming startup resources and recheck project state under the lock.
2. Start main non-worker graph with no build/pull through the shared helper; bound health/readiness wait to 120 seconds. Require MySQL healthy and PHP/frontend/Nginx/Mailpit running. Ready checks may retry transient startup responses inside that bound; no silent success or service omission.
3. Inspect only non-secret runtime metadata: MySQL tmpfs with no named data mount or published DB port; exact loopback HTTP/UI bindings and no SMTP publication. Check read-only SELECT 1 and UTC session via DBAL inside main PHP, without fixture table/schema creation or credential output.
4. Attach a transient existing digest-pinned Playwright image to the invocation-owned network with `--rm --pull never`, installed frontend dependencies and existing test/config mounts; set PLAYWRIGHT_BASE_URL=http://tocaregalo-nginx. Run existing chromium-desktop and chromium-mobile shell/API/private-path cases. Do not add services to the main model or install browsers. These tests include Spanish page, Bootstrap, no horizontal overflow, keyboard navigation, JSON API and private-path checks.
5. Success/failure/INT/TERM preserves the original result and performs scoped teardown only after ownership is established. Remove only owned containers/network/lock; never `down -v`, volume prune or development teardown. If cleanup fails, report it and fail the verification. SIGKILL/host crashes cannot be trapped: document manual inspection, never automatically delete a stale lock/resource from another invocation.

If the effective database URL or other required parameter is missing/inconsistent, stop and ask the user; never print or rewrite it. This isolated check proves the main graph/shared startup delegation with the documented storage/address differences, not persistent-volume initialization, product migrations or deployment readiness.

## Test-first implementation sequence

1. Add focused recorder tests for key-free startup and exact main/override/project routing. Demonstrate failure on existing implementation due to missing verify command/premature prerequisite, not broken fixtures.
2. Add negative cases: unrelated/preexisting project/volume/network, busy ports, lock contention, daemon inspection failure, unsafe resolved model/DB target, start/check failure and cleanup ownership. Include argument quoting/outside-cwd paths and no install/build/pull flags. Simulated tests prove orchestration only; use real runtime for service claims.
3. Implement minimum Compose/wrapper/check helpers and documentation. Keep existing entrypoints and T5/T6 test separation intact. Validate base, old test overlay and new startup overlay without exposing secrets. Check the approved 005:T2 prerequisite remains explicit.
4. Run recorder regressions and the new real `scripts/dev verify`; capture actual MySQL/API/browser results, ports, tmpfs and cleanup. If an unexpected defect/material plan change appears, stop the affected work and propose correction rather than expanding scope.
5. Run `scripts/check static` and final `scripts/check phpstan` at fixed level 10 over all owned PHP/tests, zero errors and no baseline. Run focused syntax checks for any new owned PHP check procedure. Use unchanged T8 aggregate evidence for untouched suites; rerun a suite only if changes/failures affect it. No full aggregate repeat by default.
6. Confirm no owned verification resources/lock/volume remain, private dotenv still mode 600/ignored/untracked, dependency manifests/locks unchanged, diff/local links/editor diagnostics clean. Record exact commands/results/limitations and update T10 completion only when done conditions pass. Present branch/status, stop and request renewed read-only Validation; do not mark specifications implemented or start block 003.

## Approval request

Approve execution plan v0.1 and authorize its bounded implementation and existing-image runtime checks. No installation or secret generation is included. Preparation has changed documentation only, with all preexisting local edits preserved and no branch switch/service startup.
