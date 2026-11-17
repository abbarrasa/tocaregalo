# Spec 005 — Confidential draw lifecycle

Status: synchronized with approved parent requirements; task execution remains separately gated
Revision: v0.2
Historical approval (v0.1): The user stated “Apruebo y autorizo iniciar la T1 de spec 002”, approving the derived-document/task package and authorizing only 002:T1 on 2026-11-16. No installation is authorized.
Parent: [Spec 001 v1.1, approved](../001-toca-regalo/spec.md)
Architecture: [Plan 001 v0.2, approved](../001-toca-regalo/plan.md)
Organization: [approved decomposition v0.1](../001-toca-regalo/decomposition-proposal.md)
Inheritance authority: approved parent v1.1 supplies NFR-10 verbatim; the user approved revised plans and authorized downstream task updates on 2026-11-17. This synchronized extraction adds no independent product decision.

## Context and objective

Provide fair, confidential and transactionally consistent event draws and membership-driven replacement/invalidation.

The user approved the parent specification v1.0, parent plan v0.1, and six-block decomposition v0.1 (“Apruebo los bloques. Continúa”). The user subsequently approved these derived documents and task lists, authorizing only 002:T1. No installation or other task execution is authorized.

## Scope and actors

This is an organizational slice of the approved application, not a separate product or a change of requirements. Actors, definitions, field constraints and permission exceptions are inherited from Spec 001. Assignment email rendering/retry UI and private dashboard are completed in 006; account-deletion cascade/null orchestration is completed in 007. Existing notification work is enqueued atomically by ID, never silently omitted.

Prerequisite block: [004-groups-events](../004-groups-events/tasks.md). No cross-block case is marked fulfilled until its complete supporting behavior passes.

## Functional requirements inherited without changes

The following rows are copied verbatim from the approved parent. Inclusion identifies applicable behavior, including supporting/regression work; it does not claim the entire requirement is completed by this slice.

| ID | Requirement | Source |
| --- | --- | --- |
| FR-10 | When an owner requests a draw for an event belonging to an owned group with at least three members, the system shall include all group members without additional exclusions, assign each exactly one recipient, ensure each receives from exactly one giver, and exclude self-assignment. All complete valid assignments for that membership shall have equal probability. Closed-draw and finished-event restrictions apply. | S1 Event draw; S6/S7/S13 |
| FR-11 | When a draw becomes valid, the system shall close it and prevent manual modification or another manual draw until its deletion. Automatic replacement under FR-25 is an explicit exception. | S1 Event draw amended by S5 |
| FR-12 | When explicit deletion of an event draw is requested, the system shall allow it only for SUPER ADMIN, including for finished events. After deletion, the draw restriction from FR-11 shall be removed, but a finished event shall remain closed and shall not be drawn again. Account-deletion cascades and automatic replacement under FR-23/25 are distinct system actions. | S1 Event draw; S4/S5/S11 |
| FR-13 | When a draw becomes valid, the system shall email each group member the event name and their recipient's first name and surnames when present. Failed delivery shall preserve the draw and retry under FR-34; exhaustion shall be visible to the owner and SUPER ADMIN without revealing others' assignments, with resend still available for current valid unfinished-event assignments. Owners may request resend for group members, SUPER ADMIN for any user, and users for themselves from their draw card. Pending assignment emails shall be discarded on assignment replacement or event closure. | S1 Event draw; S8/S9/S11/S12 |
| FR-14 | While assignments are stored, the system shall encrypt the assigned recipient reversibly in the application before database storage and recover it when needed for notification. Key provisioning and retention policy shall be proposed for user approval during planning. | S1 Event draw; S10 |
| FR-16 | When the dashboard is displayed, the system shall show the signed-in user's own assignment cards for applicable draws in unfinished events, including event name and an initially concealed recipient name. Invalid draws shall display “Participantes insuficientes” and shall not allow revealing the previous assignment. No user, including SUPER ADMIN, shall be permitted to view another user's assignment. | S1 Dashboard; S8/S11 |
| FR-22 | While a user has the SUPER ADMIN role, the system shall permit all specified management operations, including those outside owned groups, without granting access to other users' assignments (FR-16). | S1 Roles amended by S8 |
| FR-23 | When global account deletion is requested, the system shall permit a USER to delete only their own account and SUPER ADMIN to delete any account. Deleting an account shall delete its owned groups and their dependent events and draws, while retaining the other users belonging to those groups. Surviving assignment fields referring to the deleted user shall be cleared to null, equivalent to SET NULL. Both deletion paths shall remove surviving memberships and trigger FR-25 for affected unfinished-event draws; finished-event draws shall not repeat. | S4/S5/S6/S10 |
| FR-24 | When an owner removes another member from an owned group, the system shall remove that membership without deleting the member's global account and apply FR-25 to affected unfinished-event draws. | S5/S6 |
| FR-25 | When account deletion, owner-driven membership removal, or addition of a member after a draw affects an existing draw in a surviving unfinished event, the system shall automatically replace that draw using current group membership if at least three members are available and email each their new assignment. This shall also apply when membership reaches three again after prior assignments became invalid. The system shall not repeat draws of finished events. | S5/S6/S7/S8 |
| FR-26 | If fewer than three members are available for an initial draw or automatic redraw, the system shall not perform the draw and shall inform members of insufficient participants by email. Previous assignments shall be retained and marked invalid when an unfinished-event redraw becomes impossible. | S6/S7 amended by S8 |
| FR-27 | When membership removal is requested, including through account deletion, the system shall inform the acting user of the consequences and require confirmation before executing the removal. Every removal requires confirmation; if fewer than three members would remain, the system shall display a special warning about insufficient participants. | S6/S7 |
| FR-32 | When event closure coincides with draw execution or membership changes, the system shall give closure precedence and shall not create or replace a draw after that event is closed. Authorized group membership changes shall still proceed, without redrawing closed-event draws; affected unfinished events shall retain FR-25 behavior. | S9/S12 |
| FR-33 | When simultaneous requests attempt the same event draw, the system shall perform the draw once and notify the second requester that it is already performed, subject to closure priority. | S10 |

## Non-functional requirements inherited without changes

| ID | Requirement | Acceptance condition | Source |
| --- | --- | --- | --- |
| NFR-1 | Use Symfony, API Platform, and MySQL for the backend. | Configuration and a running API/database interaction demonstrate use of all three. Versions require an approved plan. | S1 Technologies |
| NFR-4 | The frontend shall obtain data and perform actions through API calls; the backend shall expose endpoints and never return user templates or views. | Integration checks inspect API responses and demonstrate a frontend flow consuming the API without backend-rendered views. | S1 Technologies |
| NFR-9 | Enforce logical closure immediately at its boundary and complete background closure processing within one minute while the required environment services are running. | With a controlled clock, prove new draws/replacements are blocked at the boundary, including before background processing runs; verify background closure completes no later than 60 seconds afterward. | S13 |
| NFR-10 | Run PHPStan at fixed level 10 on project-owned PHP, including tests and excluding third-party dependencies, after each implementation task and before marking it complete. Require zero reported errors without hiding findings in a baseline. | The recorded PHPStan command/configuration demonstrates level 10 and the required scope; each subsequent implementation task records a successful run with zero errors and no findings hidden in a baseline. Failed or unavailable analysis prevents task completion. | S14 |

NFR-10 is inherited from approved parent Spec 001 v1.1. It applies to every future implementation task; completed task evidence remains historical under its original approved scope. A failed or unavailable PHPStan check blocks completion.

## Acceptance criteria inherited without changes

- AC-10 (FR-10): A draw includes every current group member, including the owner, each exactly once as giver and recipient, with no self-assignment. All complete valid assignments are equiprobable. The plan shall demonstrate this through algorithm reasoning and exact small-case checks, with supplementary randomized checks as appropriate; observed variation alone does not prove fairness. Fewer than three members invoke AC-26.
- AC-11 (FR-11): Once a valid draw exists, manual attempts to change or rerun it fail while assignments remain unchanged; the automatic replacement in AC-25 is allowed.
- AC-12 (FR-12): A USER cannot explicitly delete a draw; SUPER ADMIN can for both open and finished events. Deleting a finished-event draw leaves that event closed; attempts to draw it again fail. Open events still follow minimum-member rules.
- AC-13 (FR-13): Assignment email contains event name and recipient first name plus optional surnames. Failed delivery preserves assignments; after all retries fail, owner and SUPER ADMIN see the failure, without assignment disclosure, and can request authorized resend for a current valid unfinished-event assignment. Queued initial sends/retries/resends for superseded assignments or closed events are discarded. Resend permissions remain enforced.
- AC-14 (FR-14): Database inspection cannot read the stored assigned recipient in clear text, and authorized notification processing recovers the correct recipient.
- AC-16 (FR-16): Only own assignments in unfinished events produce cards; valid recipients are initially concealed. Invalid draws show “Participantes insuficientes” without allowing previous-assignment reveal. Requests to view another user's assignment fail for USER and SUPER ADMIN alike. Finished events do not produce these cards.
- AC-22 (FR-22): SUPER ADMIN can perform specified management operations on groups and events owned by other users but cannot view another user's assignment.
- AC-23 (FR-23): A USER may delete their own account but cannot delete another account; SUPER ADMIN may delete either. Deleting an owner removes owned groups and dependent events/draws, retaining other members' accounts. Surviving assignment references to the deleted user become null, including historical references in finished events, without redrawing finished events. Both deletion paths remove surviving memberships and invoke AC-25 for affected unfinished events, subject to AC-27.
- AC-24 (FR-24): Removing another member from an owned group removes that membership while the global account and its memberships in other groups remain; a USER who does not own the group cannot perform this group-management action.
- AC-25 (FR-25): Test self-deletion, SUPER ADMIN account deletion, owner-driven removal, and adding a member after a valid draw separately. Affected surviving unfinished-event draws are replaced when at least three members are available, using current membership and emailing each participant the new assignment. Added members participate and removed users are excluded. Finished-event draws never repeat. Insufficient members invoke AC-26; delivery failures follow AC-13/34.
- AC-26 (FR-26): Initial draws and automatic redraws with zero, one, or two available members create no new assignments. When an unfinished-event redraw becomes impossible, previous assignments remain stored and are marked invalid. Available members receive an insufficient-participant email. When membership returns to at least three, an affected unfinished-event draw is automatically replaced and new assignments emailed.
- AC-27 (FR-27): Every membership removal displays its consequences and requires the acting user's confirmation, including account-deletion paths. Without confirmation, removal and its dependent changes do not execute. A special insufficient-participant warning appears when fewer than three would remain, even though confirmation is also required when enough members would remain.
- AC-32 (FR-32): Concurrent closure prevents new/replacement draws for the closed event, while authorized group member changes succeed without redrawing its finished-event draws. Unfinished events in the same group still follow automatic redraw rules.
- AC-33 (FR-33): Two concurrent draw requests produce one draw, with the second requester receiving an already-performed notice. No duplicate assignments or duplicate initial-draw notification set is created; closure priority remains applicable.

## Slice completion and deferred evidence

Assignment email rendering/retry UI and private dashboard are completed in 006; account-deletion cascade/null orchestration is completed in 007. Existing notification work is enqueued atomically by ID, never silently omitted.

Every [task](./tasks.md) must satisfy its own observable done conditions, include applicable behavioral checks, and record actual evidence and limitations. Passing a fixture-only, component-only, or environment check does not satisfy a parent user-flow acceptance condition on its own.

## Edge cases and exclusions

Apply all parent edge cases, precedence rules and scope exclusions. This slice introduces no registration, verification, role-management screen, extra participant exclusions, cloud provider, or new product feature. Never expose partially implemented destructive behavior against downstream states. Runtime/installation failures and missing prerequisites remain visible blockers.

## Open questions

No new product question is introduced by this extraction. Document/task approval is recorded above; individual execution beyond 002:T1 and all installation authorization remain pending. Technical designs are inherited from the approved parent plan; changes to them or requirements follow SDD Change.

