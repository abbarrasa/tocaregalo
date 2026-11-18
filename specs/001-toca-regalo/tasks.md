# Application Task Index — Toca Regalo

Status: approved v0.4; only 003:T1 resumption authorized
Approval (v0.4): “Apruebo las listas y autorizo reanudar 003:T1”, 2026-11-17. Authorizes revised 003:T1 implementation and its approved bounded temporary-MySQL checks; no later task or installation.
Approval (v0.3): “apruebo las listas y autorizo a preparar el plan de ejecución”, 2026-11-17. Authorizes T10 execution-plan preparation only.
Preparation authorization (v0.3): “apruebo la revisiones y autorizo actualizar las listas de tareas”, 2026-11-17. Proposed lists require approval; no implementation authorized.
Revision: v0.4
Preparation authority (v0.4): “Apruebo estos planes y autorizo actualizar las listas”, 2026-11-17. Proposed lists are not approved by this preparation authorization.
Approval (v0.2): “Apruebo las listas de tareas y autorizo el inicio de 002:T9 y las instalaciones”, 2026-11-17. Approves all revised task lists and authorizes only 002:T9 and its concrete four-package installation scope.
Historical approval (v0.1): The user stated “Apruebo y autorizo iniciar la T1 de spec 002” on 2026-11-16. Subsequent task/install approvals remain valid for their recorded scope.
Revision preparation authorized: “Apruebo estas revisiones y autorizo actualizar las tareas”, 2026-11-17. Subsequent task-list/T9/installation approval is recorded above.
Approved parent specification: [001 v1.2](./spec.md)
Approved parent plan: [001 v0.4](./plan.md)
Approved split: [six-block decomposition v0.1](./decomposition-proposal.md)

## Approval and execution state

The original 54 tasks and their IDs are preserved. T1/T2/T3/T4/T5/T6/T7/T8/T9 are complete with [runtime/static evidence](../002-development-foundation/verification.md) and [dependency evidence](../002-development-foundation/dependency-resolution.md). Approved Spec 001 v1.2 adds NFR-10; approved plans v0.2 call for PHPStan preparation before T4. This approved task revision adds only 002:T9, dependent on completed T3, and changes T4 to depend on T9. Proposed v0.3 adds corrective 002:T10 under approved plan v0.3. Total: 56 tasks, ten complete and 46 pending. T4–T6 are complete with recorded evidence; T6 reused installed tools/images for local mail and process checks. No later task implementation is authorized. Earlier results remain historical, not PHPStan acceptance.

## Ordered blocks

| Block | Specification | Plan | Tasks | Count | Dependency |
| --- | --- | --- | --- | --- | --- |
| 002 — Development foundation | [spec v0.2](../002-development-foundation/spec.md) | [plan v0.3](../002-development-foundation/plan.md) | [tasks v0.3 proposed](../002-development-foundation/tasks.md) | 10 complete, 0 pending | None |
| 003 — Identity and account access | [spec v0.3](../003-identity-access/spec.md) | [plan v0.3](../003-identity-access/plan.md) | [tasks v0.3 approved](../003-identity-access/tasks.md) | 1 complete, 8 pending | 002 |
| 004 — Groups and events | [spec v0.2](../004-groups-events/spec.md) | [plan v0.3](../004-groups-events/plan.md) | [tasks v0.2 approved](../004-groups-events/tasks.md) | 10 pending | 003 |
| 005 — Confidential draw lifecycle | [spec v0.2](../005-confidential-draws/spec.md) | [plan v0.3](../005-confidential-draws/plan.md) | [tasks v0.3 proposed](../005-confidential-draws/tasks.md) | 10 pending | 004 |
| 006 — Notifications and private dashboard | [spec v0.2](../006-notifications-dashboard/spec.md) | [plan v0.3](../006-notifications-dashboard/plan.md) | [tasks v0.2 approved](../006-notifications-dashboard/tasks.md) | 9 pending | 005 |
| 007 — Account deletion and application verification | [spec v0.3](../007-deletion-verification/spec.md) | [plan v0.3](../007-deletion-verification/plan.md) | [tasks v0.3 approved](../007-deletion-verification/tasks.md) | 8 pending | 006 |

IDs such as 002:T1 are unique across the application; local task files use T1, T2, etc. Each block has at most ten tasks and includes tests/evidence with its behavior. This is sequential work, not delegated/parallel agent execution.

## First concrete task and installation boundary

[002:T1](../002-development-foundation/tasks.md#proposed-tasks) prepares reviewable Compose/Docker/Nginx/environment templates, ignore rules and Spanish setup notes. It performs available static checks and does not install dependencies, pull/build images, download browsers, start the application, or claim runtime checks passed.

After 002:T1 is reviewed and complete, 002:T2 requires separate explicit authorization for its concrete package/image/browser scope. No startup/check wrapper may silently install. Exact patch locks and image digests are outputs of that authorized bootstrap work, not fabricated in documentation.

## Parent requirement-to-task coverage

The rows below identify all proposed supporting/implementation/regression tasks. Read each block's scope and done conditions before deciding an acceptance case is fulfilled. In particular, 007's comprehensive regression tasks do not replace direct behavior work in earlier blocks.

| Parent requirement | Proposed task references |
| --- | --- |
| FR-1 | 004:T1, 004:T9, 007:T6, 007:T7, 007:T8 |
| FR-2 | 004:T2, 004:T9, 007:T2, 007:T6, 007:T7, 007:T8 |
| FR-3 | 003:T1, 003:T2, 003:T4, 003:T7, 003:T8, 003:T9, 007:T6, 007:T7, 007:T8 |
| FR-4 | 003:T1, 003:T2, 003:T4, 003:T5, 003:T7, 003:T8, 003:T9, 007:T6, 007:T7, 007:T8 |
| FR-5 | 003:T4, 003:T9, 004:T4, 004:T5, 004:T9, 007:T6, 007:T7, 007:T8 |
| FR-6 | 004:T4, 004:T9, 007:T6, 007:T7, 007:T8 |
| FR-7 | 004:T2, 004:T3, 004:T10, 007:T6, 007:T7, 007:T8 |
| FR-8 | 004:T3, 004:T10, 007:T6, 007:T7, 007:T8 |
| FR-9 | 004:T7, 004:T8, 004:T10, 007:T6, 007:T7, 007:T8 |
| FR-10 | 005:T1, 005:T3, 005:T4, 005:T10, 007:T6, 007:T8 |
| FR-11 | 005:T3, 005:T4, 005:T5, 005:T8, 005:T10, 007:T6, 007:T8 |
| FR-12 | 005:T8, 005:T10, 007:T2, 007:T6, 007:T8 |
| FR-13 | 003:T6, 003:T9, 005:T3, 005:T4, 005:T10, 006:T1, 006:T2, 006:T3, 006:T4, 006:T7, 006:T8, 006:T9, 007:T3, 007:T6, 007:T7, 007:T8 |
| FR-14 | 005:T2, 005:T3, 005:T9, 005:T10, 006:T1, 006:T9, 007:T1, 007:T3, 007:T5, 007:T6, 007:T8 |
| FR-15 | 003:T3, 003:T7, 003:T9, 007:T6, 007:T7, 007:T8 |
| FR-16 | 005:T9, 005:T10, 006:T5, 006:T6, 006:T7, 006:T9, 007:T6, 007:T7, 007:T8 |
| FR-17 | 006:T6, 006:T9, 007:T6, 007:T7, 007:T8 |
| FR-18 | 006:T5, 006:T6, 006:T9, 007:T6, 007:T7, 007:T8 |
| FR-19 | 004:T4, 004:T5, 004:T9, 007:T4, 007:T6, 007:T7, 007:T8 |
| FR-20 | 004:T4, 004:T5, 004:T9, 007:T6, 007:T7, 007:T8 |
| FR-21 | 004:T3, 004:T10, 006:T7, 006:T9, 007:T6, 007:T7, 007:T8 |
| FR-22 | 003:T2, 003:T3, 003:T4, 003:T9, 004:T1, 004:T2, 004:T3, 004:T5, 004:T10, 005:T4, 005:T8, 005:T9, 005:T10, 006:T4, 006:T5, 006:T7, 006:T9, 007:T2, 007:T4, 007:T6, 007:T7, 007:T8 |
| FR-23 | 005:T2, 005:T3, 005:T10, 007:T1, 007:T2, 007:T3, 007:T4, 007:T5, 007:T6, 007:T7, 007:T8 |
| FR-24 | 004:T6, 004:T9, 005:T6, 005:T10, 007:T3, 007:T6, 007:T7, 007:T8 |
| FR-25 | 005:T6, 005:T7, 005:T10, 006:T1, 006:T3, 006:T8, 006:T9, 007:T3, 007:T6, 007:T8 |
| FR-26 | 005:T7, 005:T10, 006:T1, 006:T8, 006:T9, 007:T3, 007:T6, 007:T8 |
| FR-27 | 004:T6, 004:T9, 005:T6, 005:T7, 005:T10, 007:T2, 007:T3, 007:T4, 007:T6, 007:T7, 007:T8 |
| FR-28 | 003:T5, 003:T6, 003:T7, 003:T9, 006:T3, 006:T9, 007:T6, 007:T7, 007:T8 |
| FR-29 | 003:T4, 003:T8, 003:T9, 007:T4, 007:T6, 007:T7, 007:T8 |
| FR-30 | 003:T2, 003:T9, 007:T6, 007:T8 |
| FR-31 | 004:T7, 004:T8, 004:T10, 007:T6, 007:T7, 007:T8 |
| FR-32 | 004:T6, 004:T7, 004:T8, 004:T10, 005:T4, 005:T5, 005:T6, 005:T10, 006:T3, 006:T8, 006:T9, 007:T3, 007:T6, 007:T8 |
| FR-33 | 005:T5, 005:T10, 007:T6, 007:T8 |
| FR-34 | 003:T6, 003:T9, 006:T2, 006:T3, 006:T4, 006:T7, 006:T8, 006:T9, 007:T3, 007:T6, 007:T8 |
| FR-35 | 003:T3, 003:T7, 003:T9, 007:T6, 007:T7, 007:T8 |
| NFR-1 | 002:T1, 002:T2, 002:T3, 002:T5, 002:T8, 003:T1, 003:T9, 004:T1, 004:T10, 005:T3, 005:T10, 007:T6, 007:T8 |
| NFR-2 | 002:T1, 002:T2, 002:T4, 002:T5, 002:T8, 003:T7, 003:T9, 006:T6, 006:T9, 007:T7, 007:T8 |
| NFR-3 | 002:T1, 002:T2, 002:T3, 002:T4, 002:T5, 002:T6, 002:T7, 002:T8, 007:T5, 007:T6, 007:T7, 007:T8 |
| NFR-4 | 002:T1, 002:T3, 002:T4, 002:T5, 002:T8, 003:T3, 003:T9, 004:T10, 005:T4, 005:T9, 005:T10, 006:T4, 006:T5, 006:T9, 007:T6, 007:T8 |
| NFR-5 | 002:T1, 002:T4, 002:T7, 002:T8, 003:T7, 003:T8, 003:T9, 004:T9, 004:T10, 006:T1, 006:T6, 006:T7, 006:T9, 007:T4, 007:T7, 007:T8 |
| NFR-6 | 002:T4, 002:T5, 002:T8, 003:T7, 003:T8, 003:T9, 004:T9, 004:T10, 006:T6, 006:T7, 006:T9, 007:T4, 007:T7, 007:T8 |
| NFR-7 | 002:T1, 002:T6, 002:T7, 002:T8, 003:T6, 003:T9, 006:T1, 006:T8, 006:T9, 007:T5, 007:T6, 007:T7, 007:T8 |
| NFR-8 | 002:T5, 002:T7, 002:T8, 003:T7, 003:T8, 003:T9, 004:T9, 004:T10, 006:T6, 006:T7, 006:T9, 007:T4, 007:T7, 007:T8 |
| NFR-9 | 002:T6, 002:T8, 004:T7, 004:T8, 004:T10, 005:T5, 005:T10, 006:T3, 006:T8, 006:T9, 007:T6, 007:T8 |
| NFR-10 | 002:T9, 002:T4, 002:T5, 002:T6, 002:T7, 002:T8, 003:T1, 003:T2, 003:T3, 003:T4, 003:T5, 003:T6, 003:T7, 003:T8, 003:T9, 004:T1, 004:T2, 004:T3, 004:T4, 004:T5, 004:T6, 004:T7, 004:T8, 004:T9, 004:T10, 005:T1, 005:T2, 005:T3, 005:T4, 005:T5, 005:T6, 005:T7, 005:T8, 005:T9, 005:T10, 006:T1, 006:T2, 006:T3, 006:T4, 006:T5, 006:T6, 006:T7, 006:T8, 006:T9, 007:T1, 007:T2, 007:T3, 007:T4, 007:T5, 007:T6, 007:T7, 007:T8 |

## Cross-block acceptance closure

- Environment checks do not satisfy product flows; setup evidence is 002 and behavior evidence follows.
- 003 completes account access/recovery/bootstrap; owner/group creation entrypoints are completed in 004 and assignment delivery/dashboard in 006.
- 004 group/event/member actions are integrated with post-draw replacement and confidential data in 005, actual notification behavior in 006, and global account deletion/null/cascade in 007.
- 005 draw acceptance is cumulative: work enqueue is not email-delivery evidence, and a read DTO is not a complete reveal-card browser flow.
- 006 completes current assignment/insufficient-member mail, retry/resend/status, stale cancellation, responsive private cards and deadline regressions.
- 007 closes account-deletion integrations and gathers all remaining parent acceptance/regression evidence. It never treats fixture-only checks as full application fulfillment.

Final read-only Validation and user acceptance remain separate from these implementation/check tasks. Parent specification status remains approved until the complete reviewed implementation is accepted.

## Next task boundary

All block 002 tasks are complete with documented readiness limits; [T8 evidence](../002-development-foundation/verification.md#t8-execution-record) records aggregate success and unavailable business operations. Await explicit authorization for block 002 read-only SDD Validation; do not begin block 003 or mark specifications implemented.

## v0.3 proposal boundary

Only 002:T10 is added; 005:T2's key-consumer readiness work/done conditions expand without changing its ID/dependencies. The local lists now contain 10/9/10/10/9/8 tasks, 56 total, nine complete/47 pending. Map NFR-1/3/4/5/7/10 additionally to 002:T10; all other task/requirement assignments remain unchanged. Historical completed-task results are not rewritten. Approve the revised parent/002/005 lists before preparing the task-specific T10 execution plan. No implementation, runtime, installation or key generation is authorized. This boundary supersedes older task-count/next-step text above.

## T10 completed — latest boundary

Approved task lists v0.3 and execution plan v0.1 were authorized separately; [002:T10 evidence](../002-development-foundation/verification.md#t10-completion) records main startup correction and checks. Total 56 tasks: ten complete/46 pending; block 002 ten complete/zero pending. This supersedes historical counts/proposals above. Await explicit renewed read-only Validation; no block 003 implementation or specification acceptance is authorized.

## Block 002 acceptance

“Acepto la validación”, 2026-11-17, accepts the scoped foundation PASS; Spec 002 v0.2 is implemented. Parent Spec 001 remains approved. No block 003 task is authorized; continuation begins with 003:T1 execution planning and its separate approval gate. Ten of 56 tasks complete, 46 pending.

## Password boundary revision (v0.4) — proposed

Implements approved parent Spec 001 v1.2 FR-4/AC-4 and approved parent plan v0.4. Preserve existing IDs, dependencies and completion evidence; no new task or installation. Project total remains 56 tasks: ten complete, 46 incomplete (including in-progress 003:T1). Changed conditions below supplement the existing task definitions and require approval before execution.

Affected lists: 003 v0.3 (T1/T2/T4/T5/T7/T8/T9) and 007 v0.3 (T6/T7/T8). Shared policy remains in 003:T1; later consumers and final regressions keep their existing tasks. No reopening of accepted 002 foundation work. Next request is approval of these lists and explicit resumption of 003:T1 under approved execution plan v0.2 and its existing isolated temporary-MySQL limits. No T2 or installation authorization inferred.

## 003:T1 completion — latest boundary

Approved revised lists and resumption: “Apruebo las listas y autorizo reanudar 003:T1”, 2026-11-17. [T1 evidence](../003-identity-access/verification.md#t1-completion): backend 53/191, guarded migration/schema constraints, byte-boundary checks, syntax/container/YAML and PHPStan level 10 zero errors pass. Test runtime removed. Total 56 tasks: 11 complete, 45 pending. Stop before 003:T2; continuation authorizes preparation of its execution plan, not implementation. This supersedes historical counts and authorization statements.
