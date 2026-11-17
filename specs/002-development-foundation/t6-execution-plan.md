# 002:T6 — Execution plan

Revision: v0.1
Status: approved; authorized T6 implementation complete
Approval: “Apruebo el plan y autorizo su implementación”, 2026-11-17, approves v0.1 and its bounded local runtime; no installations or external SMTP.
Date: 2026-11-17
Planning authorization: “Continúa con la siguiente tarea”, following T5 completion. Under the user's per-task rule, preparation/presentation only.
Authority: [Spec 002 v0.2](./spec.md), [Plan 002 v0.2](./plan.md), [T6](./tasks.md), [parent delivery/runtime design](../001-toca-regalo/plan.md), completed [T5 evidence](./verification.md#t5-completion).

## Outcome and scope boundaries

Connect Symfony Mailer to external SMTP configuration, local Mailpit capture and the approved shared-PHP notification/closure worker entrypoint contracts. Send and inspect a fixture message through a real local SMTP connection; demonstrate process start/stop and failure visibility without introducing product notification or event behavior. Supports NFR-3/7/9/10; does not complete their downstream product acceptance.

Use already installed Symfony Mailer/Messenger/Doctrine transport and existing pinned PHP/MySQL/Mailpit images. No dependency installation, image pull/build, browser download, new service family, cloud target, real SMTP connection or real-user message. Keep package manifests/locks unchanged. Missing tools are a blocker requiring a separate concrete proposal, not implicit installation authority.

Actual event closure command/domain behavior belongs to [004:T7/T8](../004-groups-events/tasks.md). Assignment/recovery delivery, notification status/resend/staleness/cancellation and retry behavior belong to 003/005/006. Do not implement placeholder production commands/handlers, business tables, fake successful closure, account flows, encryption keys or production fixtures in T6. A closure launcher must fail visibly if its future application command is unavailable. Clearly distinguish process-contract evidence using test-only commands from working event closure and the one-minute NFR-9 product guarantee.

## Branch and prerequisites

After approval inspect Git status and create `feature/002_T06-mail-worker-runtime` from current local dev, preserving existing edits; stop on unsafe switching. No commit, merge, stash, reset, restore or push.

Use existing private root .env and the T5 guarded test database contract. Check necessary local test parameters without printing them; ask for missing/inconsistent values instead of inventing credentials. Do not modify/regenerate .env or secrets. External deployment SMTP host/port/TLS/authentication/sender values remain future deployment inputs; they are unnecessary for Mailpit verification.

## Planned files and responsibilities

| Files | Responsibility |
| --- | --- |
| `backend/config/packages/mailer.yaml` | External MAILER_DSN and sender defaults; synchronous Mailer handoff, no second implicit email queue. |
| `backend/config/packages/messenger.yaml` | Existing Doctrine notification transport, auto_setup false, approved retry base/multiplier/count; no product-message routing/handler or separate retry loop. |
| `backend/config/services.yaml` | Explicit sender/configuration bindings only as needed, keeping responsibilities separate. |
| `docker/worker/entrypoint.sh`, `docker/scheduler/entrypoint.sh` | Shared-image process launchers, validation and exec/signal forwarding; default commands match approved notification consume/closure contracts. No install, hidden setup or fake no-op success. |
| `compose.yaml` | Read-only launcher mounts/entrypoint wiring for existing worker services and existing environment source; worker profiles remain opt-in. |
| `backend/config/services_test.yaml`, optional test-only package override | Register fixture messages/handlers/commands only in test; force local Mailpit target for the verification environment. No reachable product endpoint. |
| `backend/tests/Fixtures/Mail/`, `backend/tests/Fixtures/Command/` | Reserved-domain fixture email, transport preparation/dispatch and bounded process probe; no domain/account/assignment data. |
| `backend/tests/Integration/LocalMailCaptureTest.php`, focused configuration/process tests | Real SMTP capture/content/sender checks, consumed fixture/queue acknowledgement and launcher start/stop/fail-fast checks. Reuse T5 guarded database support. |
| `compose.mail-smoke.yaml` | Isolated temporary MySQL/Mailpit plus PHP verification and worker services sharing the existing image; no frontend/browser/assignment-key dependency. |
| `README.md`, verification/tasks/memory documents | Spanish local setup and clear worker limits, exact commands/results, audit limits and next approval boundary. |

Test/support file names may be refined within these responsibilities. Avoid a generic framework for nonexistent business workflows. General developer/VS Code wrappers remain T7; no image rebuild is needed because launchers are bind-mounted.

## Mail/queue/runtime contracts

### Local SMTP and sender configuration

Use the existing MAILER_DSN, MAIL_FROM_ADDRESS and MAIL_FROM_NAME templates. Configure Symfony Mailer to send synchronously when called by the eventual application delivery worker, even with Messenger enabled. Avoid a second queued SendEmailMessage path containing plaintext mail snapshots. Fixture recipients use the reserved `.test` domain and Spanish content with a correlation marker; no user records or recipient assignments.

The dedicated verification stack forces SMTP to `tocaregalo-mailpit:1025` independently of any external MAILER_DSN in root .env. Enforce this local target before sending fixture mail. Retrieve capture through the dedicated Mailpit HTTP API and assert marker, recipient, sender and body, not just SMTP acceptance. Do not delete unrelated mail or contact production SMTP. Verify test-only fixture services are absent outside APP_ENV=test.

### Messenger transport

Keep the existing approved Doctrine notification queue and auto_setup=false. Configure five retries, multiplier two, base from NOTIFICATION_RETRY_BASE_MS (30000 ms default), zero jitter and no truncating delay cap, per parent design. Do not introduce a second retry policy or claim tested product retries before 006.

For cross-process runtime proof only, enqueue a test-only message with a fixture identifier and let an actual Messenger worker process it into a local captured message. The fixture handler is registered only in test. Explicitly prepare Messenger's infrastructure table only in the guarded tmpfs test database before enqueueing; no runtime auto_setup, product migration or development schema mutation. This infrastructure table is test-only evidence, not a completed business schema. Confirm queue acknowledgement and capture. Any setup helper must invoke the T5 target validation before DDL and refuse unsafe targets without connecting.

### Worker and closure process entrypoints

Use the existing PHP image and exec the PHP console process so signals are forwarded through the existing init process. Defaults are the approved Messenger notifications consumer and future app:events:close-due command with its 15-second polling argument. Allow explicit command arguments for bounded verification. Do not wrap them in an independent retry/scheduling loop or hide nonzero command exits.

Demonstrate a bounded real notification consumer, then an idle start/stop check. For the scheduler launcher, use a test-only bounded probe command to verify invocation/arguments and termination; it must not be registered as the production closure command. Use a bounded real-process check with the 15-second contract where applicable, keeping model/clock assertions deterministic. Record actual stop/exit behavior; do not promise graceful in-flight handling without signal support evidence. Invoke the missing production closure command in a controlled check and confirm nonzero failure instead of fake success. No real event is closed by this task.

## Implementation sequence after approval

1. Add focused tests for sender/local transport configuration, reserved-domain fixture capture, unsafe fixture-setup rejection and launcher delegation/failure. Record actual initial failures for missing wiring; reuse existing T5 behavior evidence instead of breaking it artificially.
2. Add minimal Mailer/Messenger configuration and worker launchers. Validate Symfony configuration/container and inspect effective retry/queue values without dumping private environment or DSNs.
3. Register test-only fixture services, validate the isolated database, explicitly prepare only its transport table and enqueue one fixture identifier. Start the actual worker and verify Mailpit capture and acknowledgement.
4. Verify bounded start/stop, argument forwarding and nonzero failure of unavailable/default closure behavior. Test outside-test service exclusion. Distinguish process-only probes from future closure/delivery semantics.
5. Run focused mail/process checks, existing PHPUnit database/API regressions and PHP/shell/YAML syntax. Run PHPStan level 10 over all owned PHP including fixtures/tests, zero errors, no baseline or scope exclusion. Changes are backend/runtime-only; no unnecessary browser rerun unless frontend/HTTP boundaries are affected.
6. Inspect runtime mounts/ports/environment and private-file ignore state; stop/remove only the dedicated containers/network without volume deletion. Record versions, exact commands, actual results/limitations and stop after T6. No T7 implementation.

## Requested runtime scope

Only after approval, use a standalone dedicated test configuration with explicit project `tocaregalo-test`, retaining T5's project-identity safeguards. Stop and report existing-project/port conflicts before startup rather than replace another stack or select alternate ports.

Start only the pinned MySQL tmpfs instance, pinned Mailpit and ephemeral PHP test/worker/probe containers with `tocaregalo-` service names. No development data volume, external network, SMTP publication, Docker socket, frontend/browser, workers from another project or assignment-key mount. No package installation/startup build/pull.

- Database: T5 test URL/schema/user parameters, guarded before setup/mutation, no DB host port, tmpfs-only storage.
- Mailpit: no external relay/forwarding; SMTP internal 1025; optional UI on 127.0.0.1 using existing TEST_MAILPIT_PORT (8026 default). Check actual configured port availability before publication.
- PHP: private root .env read-only, explicit APP_ENV=test, TEST_DATABASE_URL as DATABASE_URL, local-only SMTP override, sender values and test cache; shared image for tests and both worker launchers.
- No production SMTP credentials are requested or printed. Capture and queue test payloads contain fixture data only. Stop/remove only this dedicated stack even on failure; no automatic data-volume deletion.

## Completion evidence

| Requirement | Required bounded T6 evidence |
| --- | --- |
| NFR-3 | Compose/shell/Symfony configuration passes; actual shared-image worker/probe process launch/stop and failure propagation recorded. |
| NFR-7 | Real fixture SMTP handoff plus matching Mailpit capture, external sender/DSN configuration, internal SMTP and private secrets; no real-server delivery claimed. |
| NFR-9 | Closure launcher/15-second runtime argument and bounded process proof only; actual closure guard, deadline processing and <=60-second product evidence explicitly deferred to 004/006. |
| NFR-10 | Final fixed PHPStan level 10 over all owned PHP/fixtures/tests, exit 0/zero errors, no concealing baseline. |
| Isolation/regression | Guarded temporary queue schema only, no development mutation, fixtures absent in non-test container, existing API/MySQL tests pass, unchanged dependency manifests/locks, private .env preserved, dedicated cleanup. |

Existing npm development audit warnings, abandoned doctrine/common and Composer license recommendation remain recorded; no unrelated dependency repair or clean-audit claim. Do not mark T6 complete on unavailable mandatory checks, fake workers or fixture-only claims about product behavior.

## Approval request

Approve execution plan v0.1 and authorize its bounded implementation/runtime, including the local fixture email, guarded temporary Messenger infrastructure table, actual consumer and test-only closure process probe. No package/image/browser installation is planned or requested. This planning step changes documentation only on current dev; no branch switch, service startup or email send has occurred.

## Execution outcome

Completed 2026-11-17 on feature/002_T06-mail-worker-runtime. [T6 evidence](./verification.md#t6-completion) records real local SMTP capture/queue acknowledgement, test-only service isolation, configured retry parameters, process delegation/failure/SIGTERM termination, 29 tests/105 assertions and PHPStan level-10 zero errors. Dedicated runtime removed; no installs, external mail, real event closure, secret changes, commit or push. Stop before T7. This supersedes planning-time pending statements above.
