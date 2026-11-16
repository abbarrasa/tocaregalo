# Task Decomposition Proposal — Toca Regalo

Status: approved
Revision: v0.1
Approval: The user explicitly stated “Apruebo los bloques. Continúa” on 2026-11-16, authorizing the six-block split and preparation of derived documents/task lists. No installation or task execution is authorized.
Source specification: [001 v1.0, approved](./spec.md)
Technical plan: [001 v0.1, approved](./plan.md)

## Reason and preservation of approved scope

The approved whole-application plan covers 35 functional and nine non-functional requirements. About ten tasks of roughly 20–30 minutes cannot realistically cover environment setup, domain rules, API/persistence/security, responsive screens, asynchronous delivery, concurrency, and their verification. Compressing these into ten headings would hide large implementation batches.

The [SDD workflow](../../.agents/skills/sdd/SKILL.md) requires proposing a specification split when more tasks are needed and waiting for the user's decision. The user has approved this split. The derived documents are now listed in the [task index](./tasks.md); their review approval and task-start authorization remain pending. No requirements are changed by this split.

Retain Spec 001 v1.0 as the approved application contract and plan v0.1 as the approved architecture. Derive the following numbered specifications by reference, retaining all original FR/NFR/AC identifiers and recording precisely which acceptance cases each increment completes. No requirement is removed, broadened, renumbered, or marked fulfilled merely because one supporting component exists. Shared requirements are deliberately covered in several increments.

## Proposed derived specifications and order

Derived directories 002–007 have now been created with v0.1 specifications, scoped plans, and task lists. Actual task counts are 8, 9, 10, 10, 9, and 8 respectively. Initial estimates below remain historical decomposition guidance; every current task includes checks and observable done conditions. Expose scope changes before implementation rather than silently enlarging tasks.

| Proposed specification | Verifiable outcome | Requirement coverage | Dependencies | Expected task count |
| --- | --- | --- | --- | --- |
| 002 — Development foundation | Reproducible PHP/Vue/MySQL/Nginx/Mailpit services, locked toolchain, test harnesses, external configuration/secret templates and Spanish setup instructions. | Enabling work for all requirements; directly NFR-1…5/7 and verification tooling for NFR-6/8/9. No product behavior claimed complete. | None | 6–8 |
| 003 — Identity and account access | Interactive SUPER ADMIN bootstrap, ordinary-account creation boundary, email/phone login, logout, own-account editing, single-use recovery with supersession, API permissions and responsive account screens. | FR-3/4/5/15/22/28/29/30/35; supporting FR-13/34 delivery infrastructure; NFR-5…8. Global account deletion remains explicitly for 007. | 002 | 7–9 |
| 004 — Groups and events | Owned group/event management, membership creation/search/association/removal, confirmation previews, optional end-of-day completion, closure worker and metadata edits. Forms and navigation work for owners/admins. | FR-1/2/5/6/7/8/9/19/20/21/22/24/27/31/32; NFR-5/6/8/9. Post-draw effects/dependent cascades are supporting work until 005/007 complete those acceptance cases. | 003 | 8–10 |
| 005 — Confidential draw lifecycle | Uniform valid draws, encrypted recipient storage/scoped lookup, draw locking/deletion, minimum members, invalidation/recovery, member-driven replacement, and concurrent draw/closure guards with real-database checks. | FR-10/11/12/14/22/24/25/26/27/32/33; supporting FR-13/16/23; NFR-1/4/9. Member email outcomes remain for 006; account-deletion integration remains for 007. | 004 | 8–10 |
| 006 — Notifications and private dashboard | Durable assignment/insufficient-participant emails, exact retry strategy/status/resend, stale-work cancellation, own-only assignment dashboard and 20-second reveal/reset, owned-group card, responsive states. | FR-13/16/17/18/21/22/25/26/28/34; supporting FR-14/32; NFR-5…9. Recovery is regression-tested through the same transport without changing its approved flow. | 005 | 7–9 |
| 007 — Account deletion and application verification | Confirmed self/admin account deletion, owned-data cascade, nullable encrypted/giver references, remaining-member redraw/invalidation/email, finished-event preservation, key backup/restore exercise, complete regression and validation evidence. | FR-2/12/14/22/23/24/25/26/27/32; cross-application checks for every FR-1…35 and NFR-1…9. | 006 | 6–8 implementation/check tasks, then separately authorized Validation |

These are sequential increments, not a delegation or parallel-agent plan. Functional tests travel with the behavior that they verify; 007 does not defer all testing until the end. All specified delete operations that depend on unimplemented downstream behavior remain unavailable until their entire transaction is implemented and verified, rather than deleting incomplete data. No incomplete increment is presented as the finished application.

## Completeness and approval handling

- The derived specifications describe slices of the existing approved contract, not a new requirements interview. Link to Spec 001 and copy only the exact scoped acceptance conditions needed for each slice; record unresolved technical dependencies explicitly.
- Each derived `spec.md`, `plan.md`, and `tasks.md` records its parent revision and approval evidence. Parent approval does not invent approval of a future unseen child document or task list.
- Require coverage mapping for every parent requirement and every acceptance case, including cross-slice cases. Component completion is not a substitute for end-to-end acceptance.
- Preserve the approved architecture, domain boundaries, key policy, no-Twig requirement, and dependency families. Material deviations require the existing change process.
- Task lists include dependency IDs, bounded work, done conditions, and actual results once run. Stop after each authorized task as required by the workflow.
- The first implementation task will prepare reviewable bootstrap/configuration files. Before any package/image/browser download or dependency installation, present the concrete dependency scope and obtain explicit authorization. A task-list approval alone does not authorize installation.
- Source documents, constitution, Spec 001's behavior, and plan v0.1 remain unchanged by approval of this organizational split.

## Decision requested

The six-slice decomposition is approved. Next, review the derived documents/task lists through the task index and authorize the first task explicitly. Installation and subsequent task execution remain separately gated.
