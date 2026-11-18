# Plan 003 — Identity and account access

Status: approved v0.4; affected task-condition preparation authorized, implementation separately gated
Approval (v0.4): “Apruebo las revisiones y autorizo actualizar las tareas afectadas”, 2026-11-18. Approves displayed revision and authorizes task updates only.
Approval (v0.3): “Apruebo estos planes y autorizo actualizar las listas”, 2026-11-17. Approves the displayed plan; authorizes task-list preparation only.
Revision: v0.4
Preparation authority: “Apruebo esta revisión y autorizo preparar el resto de revisiones afectadas”, 2026-11-17. No task-list or implementation approval inferred.
Historical approval (v0.1): The user stated “Apruebo y autorizo iniciar la T1 de spec 002”, approving the derived-document/task package and authorizing only 002:T1 on 2026-11-16. No installation is authorized.
Derived specification: [003 v0.3](./spec.md), synchronized from approved parent v1.2
Approved parent specification: [001 v1.2](../001-toca-regalo/spec.md)
Architecture: [001 v0.4 proposed; unchanged v0.3 scope historically approved](../001-toca-regalo/plan.md)
Approval (v0.2): “Apruebo estas revisiones y autorizo actualizar las tareas”, 2026-11-17, approves the displayed PHPStan plan revision and authorizes task-list preparation, not implementation or installation.

## Approach and approved design

Provide authenticated identity, account changes, recovery and the adapted SUPER ADMIN command using the approved session/API boundaries.

Inherit parent plan sections 2–11 for exact toolchain families, architecture, data/privacy/transaction contracts, pure function signatures/pseudocode, API routes, UI states and verification profiles. Do not create conflicting local versions of those designs. The user approved the parent specification v1.0, parent plan v0.1, and six-block decomposition v0.1 (“Apruebo los bloques. Continúa”). The user subsequently approved these derived documents and task lists, authorizing only 002:T1. No installation or other task execution is authorized.

## Components, interfaces and flows

Pure user normalization/password policy; User/Role repositories, external mappings, Symfony hasher/session/CSRF adapters, reset-token persistence/mail worker, JSON DTOs, account/login/recovery views.

users, roles/user_roles, database sessions, hashed reset tokens and foundational notification/Doctrine transport tables. No verification status, role-management screen or plaintext password/token storage.

Email-or-phone login, logout, recovery/reset errors, authenticated account editing, phone plugin wrapper, responsive Spanish forms with labels/keyboard/focus.

Dependencies: [002-development-foundation](../002-development-foundation/tasks.md). The parent application remains incomplete until all cross-slice cases are covered. No global account deletion until 007. Ordinary-user creation is an application boundary exercised with fixtures here; its owner/group entry point is completed in 004. Final assignment dashboard and assignment-delivery acceptance remain in 006.

## Planned files and bounded responsibilities

| Task | Planned paths | Responsibility |
| --- | --- | --- |
| T1 | `backend/src/Domain/User/`, `backend/src/Infrastructure/Doctrine/`, `backend/config/doctrine/`, `backend/migrations/` | Implement normalized user values and persistence constraints |
| T2 | `backend/src/Command/`, `backend/tests/Functional/` | Adapt and verify the interactive SUPER ADMIN command |
| T3 | `backend/src/Infrastructure/Security/`, `backend/src/Api/`, `backend/config/packages/` | Implement session authentication and logout JSON contracts |
| T4 | `backend/src/Application/`, `backend/src/Api/`, `backend/tests/Functional/` | Implement authenticated own-account changes and creation boundary |
| T5 | `backend/src/Application/`, `backend/src/Infrastructure/Doctrine/`, `backend/tests/Unit/`, `backend/tests/Integration/` | Implement recovery token lifecycle |
| T6 | `backend/src/Infrastructure/Mail/`, `backend/config/packages/messenger.yaml`, `backend/tests/Integration/` | Deliver recovery email through durable mail infrastructure |
| T7 | `frontend/src/views/`, `frontend/src/plugins/phone.js`, `frontend/src/composables/`, `frontend/tests/` | Implement login and recovery/reset screens |
| T8 | `frontend/src/views/AccountView.vue`, `frontend/src/api/`, `tests/e2e/` | Implement responsive own-account editing |
| T9 | `specs/003-identity-access/verification.md`, `backend/tests/`, `tests/e2e/` | Verify identity privacy and record slice evidence |

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
| FR-3 | T1, T2, T4, T7, T8, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-4 | T1, T2, T4, T5, T7, T8, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-5 | T4, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-13 | T6, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-15 | T3, T7, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-22 | T2, T3, T4, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-28 | T5, T6, T7, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-29 | T4, T8, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-30 | T2, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-34 | T6, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| FR-35 | T3, T7, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-1 | T1, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-2 | T7, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-4 | T3, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-5 | T7, T8, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-6 | T7, T8, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-7 | T6, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-8 | T7, T8, T9 | Use the corresponding parent AC or NFR condition; distinguish direct scope from downstream/regression evidence. |
| NFR-10 | All future implementation tasks; prerequisite tooling in 002 before T4 | Fixed level 10 over owned PHP including tests; zero-error post-task evidence, no concealing baseline; failure blocks completion. |

The [task list](./tasks.md) supplies concrete work and done conditions. Parent AC numbers are unchanged; no replacement child acceptance identifiers are invented.

## Approval and next action

9 proposed tasks, ordered by dependency. Approximately 20–30 minutes per task is a decomposition target, not a promise; expose required scope changes rather than silently enlarging a task. This slice stays at ten tasks or fewer.

The original derived-document/task package remains historical approval for unchanged scope. This v0.2 revision is approved; the proposed task-list v0.2 update now awaits its own approval. Preserve T4 v0.1 and Playwright approvals for their unchanged scope; present the expanded PHPStan gate and enabling work separately. No installation or implementation is authorized by preparing this revision.


## Password boundary revision — proposed

Implements approved parent Spec 001 v1.2 FR-4/AC-4 (S15). Keep the shared policy framework-independent: validate UTF-8, count at least six characters with `mb_strlen`, reject more than 4096 bytes with `strlen`, and preserve exact whitespace. Delegate hashing and verification to the existing Symfony auto adapter. No custom prehash, truncation, new package or schema change. The rejected alternative of bypassing the framework guard would introduce custom hashing behavior despite the accepted Symfony limit.

Apply validation before password hashing and account/password persistence in all password-setting consumers: owner creation, bootstrap command, authenticated changes and recovery. Later consumer tasks must prove invalid input leaves accounts/passwords unchanged. Existing reset-token validity/single-use rules remain unchanged. Do not infer implemented consumer flows from shared-policy tests.

Verification: test ASCII and multibyte inputs at 4096 and 4097 bytes, five/six-character minimum boundaries, preserved whitespace, correct/incorrect hash verification and rejection before persistence. Future forms must use Spanish associated field errors; HTML character-count limits cannot replace backend UTF-8 byte validation. Run relevant regressions and final full-scope PHPStan level 10, zero errors without baseline. Existing 003:T1 45 tests/175 assertions do not yet cover this boundary; preserve their historical evidence and accepted block 002 Validation.

No new task IDs, dependency installation, key operation, development DDL/account, commit or push is proposed. Revise affected task conditions only after plan approval. Existing unmodified plan sections retain their historical approved scope.

## Recovery delivery secret revision — v0.4 proposed

Preparation/decision authority: “Apruebo la propuesto y actualizar los planes afectados”, 2026-11-18, approves environment-based key direction and authorizes preparation only. Inherit the proposed [parent v0.5 recovery delivery policy](../001-toca-regalo/plan.md#recovery-delivery-secret-revision--v05-proposed) for FR-28/AC-28, recovery portions of FR-13/34 and NFR-7/10. Approved v0.3 remains the unchanged execution baseline until revision approval. No specification change or T5 reopening.

T6 will retain hash-only reset validation and store only an authenticated Sodium-encrypted token envelope in its delivery work record. Messenger carries IDs; synchronous handler decrypts only after current-request checks, retries the same token and stable Message-ID, and purges the envelope at successful/terminal/stale transitions. Token issuance/supersession, work creation and transport enqueue are atomic; consumption/supersession also cancel affected pending delivery material. No independent retry loop, plaintext mail queue or token JSON response.

RECOVERY_DELIVERY_KEY is a distinct Base64-encoded 32-byte key loaded from the ignored root dotenv, mode 0600. Templates have an empty placeholder. No separate key file/mount, APP_SECRET reuse, assignment-key dependency or global foundation startup prerequisite. Version-1 envelopes use the single active key; drain or explicitly cancel/purge pending work before an authorized replacement. This revision does not add a historical key ring or seamless rotation. Missing/invalid key and tampering fail closed before credential mutation/delivery, without exposing secrets. Backup/restoration and test policy are defined in the parent. No generation or dotenv modification is authorized now.

Affected work: Application/Recovery and Port handoff; Infrastructure/Mail, Doctrine and mappings/new explicit migrations; API routes/controllers; services/Messenger/environment templates; verification harness and unit/integration/native HTTP fixtures; English operations/security documentation and Spanish README. T6 checks include actual transaction rollback, same-token retry/restart, local captured-link reset/login, stale/tamper/key failures, terminal purging, ID-only payloads and final full-scope PHPStan level 10. T9 consolidates this evidence without claiming assignment delivery or UI acceptance prematurely. No new task or package is proposed; existing counts stay 56 total, 15 complete/41 pending.

Next: obtain approval of parent v0.5 / this v0.4 and authorization to revise affected task conditions/index. Then obtain task-condition approval, finalize/present T6 execution plan, and await its explicit implementation/runtime authorization. No T6 implementation, service startup, key generation or T7 under this document-preparation authority.

### v0.4 approval boundary

On 2026-11-18 user stated “Apruebo las revisiones y autorizo actualizar las tareas afectadas”, approving parent v0.5 and this v0.4 and authorizing affected task-condition preparation. Earlier proposed/pending-approval statements above are historical. Next obtain approval of revised tasks/index, then finalize/present T6 execution plan for its separate authorization. No implementation or key generation authorized.
