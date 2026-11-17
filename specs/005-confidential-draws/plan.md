# Plan 005 — Confidential draw lifecycle

Status: approved v0.3; task execution and installation remain separately gated
Approval (v0.3): “apruebo la revisiones y autorizo actualizar las listas de tareas”, 2026-11-17. Approves displayed plan revisions and authorizes task-list preparation only.
Revision: v0.3
Historical approval (v0.1): The user stated “Apruebo y autorizo iniciar la T1 de spec 002”, approving the derived-document/task package and authorizing only 002:T1 on 2026-11-16. No installation is authorized.
Derived specification: [005 v0.2](./spec.md), synchronized from approved parent v1.1
Approved parent specification: [001 v1.1](../001-toca-regalo/spec.md)
Architecture: [001 v0.2 proposed; unchanged v0.1 baseline historically approved](../001-toca-regalo/plan.md)
Approval (v0.2): “Apruebo estas revisiones y autorizo actualizar las tareas”, 2026-11-17, approves the displayed PHPStan plan revision and authorizes task-list preparation, not implementation or installation.

## Approach and approved design

Provide fair, confidential and transactionally consistent event draws and membership-driven replacement/invalidation.

Inherit parent plan sections 2–11 for exact toolchain families, architecture, data/privacy/transaction contracts, pure function signatures/pseudocode, API routes, UI states and verification profiles. Do not create conflicting local versions of those designs. The user approved the parent specification v1.0, parent plan v0.1, and six-block decomposition v0.1 (“Apruebo los bloques. Continúa”). The user subsequently approved these derived documents and task lists, authorizing only 002:T1. No installation or other task execution is authorized.

## Components, interfaces and flows

Pure uniform generator/validator/member-state decisions; Sodium envelope and scoped HMAC adapter; draw repositories/external mappings; locking transaction use cases; own-assignment projection and admin deletion.

draws with unique event/revision, assignments with nullable giver FK/encrypted recipient/scoped lookup, notification references bound to revision. No plaintext recipient FK or names in persisted queue payload.

API draw/state/own projection contracts only; management action wiring and reveal presentation are completed in 006. Spanish notices remain required.

Dependencies: [004-groups-events](../004-groups-events/tasks.md). The parent application remains incomplete until all cross-slice cases are covered. Assignment email rendering/retry UI and private dashboard are completed in 006; account-deletion cascade/null orchestration is completed in 007. Existing notification work is enqueued atomically by ID, never silently omitted.

## Planned files and bounded responsibilities

| Task | Planned paths | Responsibility |
| --- | --- | --- |
| T1 | `backend/src/Domain/Draw/`, `backend/tests/Unit/` | Implement and prove uniform draw generation |
| T2 | `backend/src/Infrastructure/Crypto/`, `backend/tests/Integration/` | Implement versioned recipient encryption and lookup tokens |
| T3 | `backend/config/doctrine/`, `backend/migrations/`, `backend/src/Infrastructure/Doctrine/` | Map draw assignments and durable revision references |
| T4 | `backend/src/Application/`, `backend/src/Api/`, `backend/tests/Functional/` | Implement transactional manual draw execution |
| T5 | `backend/src/Infrastructure/Doctrine/`, `backend/tests/Integration/` | Verify concurrent draw and closure precedence |
| T6 | `backend/src/Application/`, `backend/src/Domain/Draw/`, `backend/tests/Integration/` | Integrate membership additions/removals with draw replacement |
| T7 | `backend/src/Application/`, `backend/src/Domain/Draw/`, `backend/tests/Integration/` | Implement invalidation below three and automatic recovery |
| T8 | `backend/src/Api/`, `backend/src/Application/`, `backend/tests/Functional/` | Implement explicit SUPER ADMIN draw deletion |
| T9 | `backend/src/Api/Resource/`, `backend/src/Api/State/`, `backend/tests/Functional/` | Implement own-only recipient read projection |
| T10 | `specs/005-confidential-draws/verification.md`, `backend/tests/` | Record draw/crypto/concurrency evidence and regress management |

Paths are planned implementation targets; only the documentation in this slice is being created now. Do not create code/configuration before task approval and explicit start authorization.

## Design decisions and alternatives

Preserve the approved application architecture; add only the proposed NFR-10 development analysis tools. Existing decisions remain: pure domain and external ORM mappings; same-origin sessions/CSRF; scoped resource DTOs; real MySQL tests; uniform shuffle/rejection; versioned Sodium/scoped-HMAC recipient references; one authoritative notification retry loop; independent logical closure guard. Use only the decisions relevant to the task.

Parent rejected alternatives remain rejected for their recorded tradeoffs: Twig/distribution templates, plaintext recipient FK, biased single-cycle/bounded-fallback draws, unnecessary Redis/RabbitMQ/JWT/state libraries, and SQLite substitutions. The approved local capture and key policy do not authorize downloads, secrets generation, or real email delivery now.

## Test strategy and evidence

NFR-10 (approved parent Spec 001 v1.1) adds a shared completion gate: after every future implementation task, run fixed PHPStan level 10 on all project-owned PHP including tests, excluding third-party dependencies. Require zero errors without concealing findings in a baseline; record the command, scope, version and result. Failed or unavailable analysis blocks task completion. Establish the tooling in block 002 before T4 using [the proposed PHPStan execution plan](../002-development-foundation/phpstan-execution-plan.md). Earlier task evidence remains historical for its original scope. The derived spec has been synchronized with the approved parent NFR during the authorized downstream document/Tasks update.

Follow parent test strategy with each task: behavioral tests first for application behavior, relevant real-MySQL/API/component/browser regressions, controlled time for deadlines/retries/reveal, and reproducible manual checks where appropriate. For static configuration or docs, inspect/lint the actual deliverable rather than invent tests mirroring its content. For enabling work, record supported requirements without claiming their product acceptance is fulfilled.

Use Chromium desktop 1440×900 and mobile 390×844 with essential Firefox/WebKit flows as specified by the approved parent. No arbitrary code-coverage percentage. Do not mark a task complete on unavailable tooling or an unexecuted check. External production SMTP remains a deployment dependency, not a prerequisite to local captured-email evidence.

## Traceability

| Parent requirement | Proposed tasks | Verification authority |
| --- | --- | --- |
| FR-10 | T1, T3, T4, T10 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-11 | T3, T4, T5, T8, T10 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-12 | T8, T10 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-13 | T3, T4, T10 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-14 | T2, T3, T9, T10 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-16 | T9, T10 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-22 | T4, T8, T9, T10 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-23 | T2, T3, T10 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-24 | T6, T10 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-25 | T6, T7, T10 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-26 | T7, T10 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-27 | T6, T7, T10 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-32 | T4, T5, T6, T10 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-33 | T5, T10 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-1 | T3, T10 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-4 | T4, T9, T10 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-9 | T5, T10 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-10 | All future implementation tasks; prerequisite tooling in 002 before T4 | Fixed level 10 over owned PHP including tests; zero-error post-task evidence, no concealing baseline; failure blocks completion. |

The [task list](./tasks.md) supplies concrete work and done conditions. Parent AC numbers are unchanged; no replacement child acceptance identifiers are invented.

## Approval and next action

10 proposed tasks, ordered by dependency. Approximately 20–30 minutes per task is a decomposition target, not a promise; expose required scope changes rather than silently enlarging a task. This slice stays at ten tasks or fewer.

The original derived-document/task package remains historical approval for unchanged scope. This v0.2 revision is approved; the proposed task-list v0.2 update now awaits its own approval. Preserve T4 v0.1 and Playwright approvals for their unchanged scope; present the expanded PHPStan gate and enabling work separately. No installation or implementation is authorized by preparing this revision.


## v0.3 — Mandatory key-consumer readiness before crypto activation

Preparation authorized on 2026-11-17: “apruebo la propuesta y autorizo preparar las revisiones”. This revision remains proposed. The approved [startup direction](../002-development-foundation/startup-remediation-proposal.md) removes a foundation dependency before any consumer exists; it does not relax FR-14/23, confidentiality, deletion atomicity or the approved key policy. Spec 005 v0.2 and all requirement IDs remain unchanged.

Expand the existing 005:T2 work when task revisions are approved: define/present the key-file contract and explicit operational provisioning procedure, then obtain separate approval/secret-generation authorization before producing real material. Implement the versioned loader and restore mandatory read-only assignment-key mounts and relevant environment wiring for every API/worker/operational consumer before any crypto-backed feature can be enabled. Validate absent/unreadable/malformed rings, invalid key length/encoding, absent active version and unavailable historical versions. Fail closed before writes or destructive transaction side effects; never fall back to plaintext or placeholder material.

Keep the existing random 32-byte master secret, independently labeled encryption/HMAC derivation, versioning, separate encrypted offline backups, restoration checks and explicit rotation/retained-version policy. Future task execution planning must resolve custody/backup inputs with the user; no storage vendor, ring schema, passphrase or retention interval is invented here. Development/test material must be separate, ignored, never printed or committed. No keys are generated as a consequence of approving this plan.

Files impacted by the future T2 revision include the existing Crypto adapter/loader/tests plus consumer Compose/environment wiring, an explicitly reviewed operational provisioning command and security-operations documentation. Tests must prove consumer startup/operation rejection without valid keys, real roundtrip/tamper/wrong-key/scoped-index behavior, and no partial destructive mutation on key failure. Existing T3/T4/T6 dependencies on T2 continue to enforce consumer readiness; no task is marked complete on mounts alone.

After plan approval, amend only T2's work/files/done conditions in the existing task list, preserving its ID and dependencies and the block's ten-task count. No block 005 implementation is authorized by this document preparation.
