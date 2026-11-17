# Application Task Index — Toca Regalo

Status: approved; task execution remains separately gated
Revision: v0.2
Approval (v0.2): “Apruebo las listas de tareas y autorizo el inicio de 002:T9 y las instalaciones”, 2026-11-17. Approves all revised task lists and authorizes only 002:T9 and its concrete four-package installation scope.
Historical approval (v0.1): The user stated “Apruebo y autorizo iniciar la T1 de spec 002” on 2026-11-16. Subsequent task/install approvals remain valid for their recorded scope.
Revision preparation authorized: “Apruebo estas revisiones y autorizo actualizar las tareas”, 2026-11-17. Subsequent task-list/T9/installation approval is recorded above.
Approved parent specification: [001 v1.1](./spec.md)
Approved parent plan: [001 v0.2](./plan.md)
Approved split: [six-block decomposition v0.1](./decomposition-proposal.md)

## Approval and execution state

The original 54 tasks and their IDs are preserved. T1/T2/T3/T4/T5/T6/T9 are complete with [runtime/static evidence](../002-development-foundation/verification.md) and [dependency evidence](../002-development-foundation/dependency-resolution.md). Approved Spec 001 v1.1 adds NFR-10; approved plans v0.2 call for PHPStan preparation before T4. This approved task revision adds only 002:T9, dependent on completed T3, and changes T4 to depend on T9. Total: 55 tasks, seven complete and 48 pending. T4–T6 are complete with recorded evidence; T6 reused installed tools/images for local mail and process checks. No later task implementation is authorized. Earlier results remain historical, not PHPStan acceptance.

## Ordered blocks

| Block | Specification | Plan | Tasks | Count | Dependency |
| --- | --- | --- | --- | --- | --- |
| 002 — Development foundation | [spec v0.2](../002-development-foundation/spec.md) | [plan v0.2](../002-development-foundation/plan.md) | [tasks v0.2 approved](../002-development-foundation/tasks.md) | 7 complete, 2 pending | None |
| 003 — Identity and account access | [spec v0.2](../003-identity-access/spec.md) | [plan v0.2](../003-identity-access/plan.md) | [tasks v0.2 approved](../003-identity-access/tasks.md) | 9 pending | 002 |
| 004 — Groups and events | [spec v0.2](../004-groups-events/spec.md) | [plan v0.2](../004-groups-events/plan.md) | [tasks v0.2 approved](../004-groups-events/tasks.md) | 10 pending | 003 |
| 005 — Confidential draw lifecycle | [spec v0.2](../005-confidential-draws/spec.md) | [plan v0.2](../005-confidential-draws/plan.md) | [tasks v0.2 approved](../005-confidential-draws/tasks.md) | 10 pending | 004 |
| 006 — Notifications and private dashboard | [spec v0.2](../006-notifications-dashboard/spec.md) | [plan v0.2](../006-notifications-dashboard/plan.md) | [tasks v0.2 approved](../006-notifications-dashboard/tasks.md) | 9 pending | 005 |
| 007 — Account deletion and application verification | [spec v0.2](../007-deletion-verification/spec.md) | [plan v0.2](../007-deletion-verification/plan.md) | [tasks v0.2 approved](../007-deletion-verification/tasks.md) | 8 pending | 006 |

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
| FR-4 | 003:T1, 003:T2, 003:T4, 003:T8, 003:T9, 007:T6, 007:T8 |
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

Task lists v0.2 are approved and 002:T6 is complete. Stop at this boundary. On the next user continuation, prepare and present the T7 execution plan and await approval before implementation. No T7 installation or runtime is authorized by T6 completion.
