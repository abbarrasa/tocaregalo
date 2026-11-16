# Spec 004 — Groups and events

Status: approved; individual task execution remains separately gated
Revision: v0.1
Approval: The user stated “Apruebo y autorizo iniciar la T1 de spec 002”, approving the derived-document/task package and authorizing only 002:T1 on 2026-11-16. No installation is authorized.
Parent: [Spec 001 v1.0, approved](../001-toca-regalo/spec.md)
Architecture: [Plan 001 v0.1, approved](../001-toca-regalo/plan.md)
Organization: [approved decomposition v0.1](../001-toca-regalo/decomposition-proposal.md)
Approval state: derived specification approved; parent requirements remain unchanged.

## Context and objective

Provide owner-scoped group/event management, member search/association/removal and completion scheduling with responsive navigation.

The user approved the parent specification v1.0, parent plan v0.1, and six-block decomposition v0.1 (“Apruebo los bloques. Continúa”). The user subsequently approved these derived documents and task lists, authorizing only 002:T1. No installation or other task execution is authorized.

## Scope and actors

This is an organizational slice of the approved application, not a separate product or a change of requirements. Actors, definitions, field constraints and permission exceptions are inherited from Spec 001. Post-draw mutation, assignment cleanup and delivery consequences are integrated in 005–007. Never expose a destructive operation against a dependent state whose complete transaction has not yet been implemented.

Prerequisite block: [003-identity-access](../003-identity-access/tasks.md). No cross-block case is marked fulfilled until its complete supporting behavior passes.

## Functional requirements inherited without changes

The following rows are copied verbatim from the approved parent. Inclusion identifies applicable behavior, including supporting/regression work; it does not claim the entire requirement is completed by this slice.

| ID | Requirement | Source |
| --- | --- | --- |
| FR-1 | When a USER creates a group, the system shall support a required name and optional long description, allow duplicate group names, and make the creator its single owner and a participating member. Each group shall have exactly one owner in the database. | S1 Group management; S4 |
| FR-2 | When a USER lists, modifies, or deletes groups, the system shall restrict these operations to owned groups. Group deletion shall require confirmation and delete that group's dependent events and draws without deleting its members' global accounts. | S1 Group management; S10 |
| FR-5 | When an owner manages users within an owned group, the system shall allow creation and listing but shall not allow that owner to modify another member's user data. Group ownership alone shall not authorize deleting another user's global account. | S1 User management amended by S4/S5 |
| FR-6 | When an owner searches system users by email, phone, first name, or surnames, the system shall apply case- and accent-insensitive partial matches and require all supplied filters to match (AND), display first name and surnames when present, and allow associating a selected user with an owned group. Empty results shall show “No se encontraron usuarios”. Duplicate association shall show “El usuario ya pertenece al grupo” without changing membership or triggering redraw. | S1 User management; S7/S11/S12 |
| FR-7 | When an owner creates or edits an event for an owned group, the system shall support a required name, optional date, and optional long notes. Each event shall belong to exactly one group. After a draw, authorized group name/description and event name/date/notes changes shall not repeat the draw. The completion field remains governed by FR-9/31. | S1 Event management; S4/S12 |
| FR-8 | When an owner manages events, the system shall allow listing events of owned groups and deleting those events. | S1 Event management |
| FR-9 | When an owner finishes an event, the system shall permit completion at any time, including without a valid draw, and set the shared completion field to the current date/time in installation system time, replacing any future scheduled value. | S1 Event management; Sidebar; S8/S10 |
| FR-19 | When the Users sidebar entry is selected, the system shall list users in owned groups and provide access to authorized user management and association with an owned group, enforcing FR-23 for account deletion. | S1 Sidebar; S4 |
| FR-20 | When the Groups sidebar entry is selected, the system shall list owned groups and provide access to group CRUD and member association through user creation or system-user search. | S1 Sidebar |
| FR-21 | When the Events sidebar entry is selected, the system shall list events of owned groups and provide access to event CRUD, draw execution, authorized draw deletion, and event completion. | S1 Sidebar |
| FR-22 | While a user has the SUPER ADMIN role, the system shall permit all specified management operations, including those outside owned groups, without granting access to other users' assignments (FR-16). | S1 Roles amended by S8 |
| FR-24 | When an owner removes another member from an owned group, the system shall remove that membership without deleting the member's global account and apply FR-25 to affected unfinished-event draws. | S5/S6 |
| FR-27 | When membership removal is requested, including through account deletion, the system shall inform the acting user of the consequences and require confirmation before executing the removal. Every removal requires confirmation; if fewer than three members would remain, the system shall display a special warning about insufficient participants. | S6/S7 |
| FR-31 | When the end of an event's selected completion day is reached in installation system time, the system shall automatically close the event using the same optional completion field as manual closure. The form shall explain end-of-day closure and reject past closure dates with a validation error. Omitting the field shall not schedule closure. A finished event shall not reopen. | S8/S9 |
| FR-32 | When event closure coincides with draw execution or membership changes, the system shall give closure precedence and shall not create or replace a draw after that event is closed. Authorized group membership changes shall still proceed, without redrawing closed-event draws; affected unfinished events shall retain FR-25 behavior. | S9/S12 |

## Non-functional requirements inherited without changes

| ID | Requirement | Acceptance condition | Source |
| --- | --- | --- | --- |
| NFR-1 | Use Symfony, API Platform, and MySQL for the backend. | Configuration and a running API/database interaction demonstrate use of all three. Versions require an approved plan. | S1 Technologies |
| NFR-4 | The frontend shall obtain data and perform actions through API calls; the backend shall expose endpoints and never return user templates or views. | Integration checks inspect API responses and demonstrate a frontend flow consuming the API without backend-rendered views. | S1 Technologies |
| NFR-5 | Use Spanish for application text and user-facing documentation and English for technical documents, identifiers, and comments. | Review the implemented UI, user documentation, and technical artifacts against constitution P6. | S1 Other requirements; S3 |
| NFR-6 | Support use on mobile and desktop. | Demonstrate login, dashboard reveal/resend, account settings, and applicable owner-management flows on mobile and desktop viewport profiles agreed in the plan, without inaccessible controls or unintended horizontal page overflow. | S11 |
| NFR-8 | Show loading, empty, and error states in Spanish; support keyboard navigation and associate form labels and validation errors with their fields. | Exercise loading/empty/failure cases and complete specified form and navigation actions using the keyboard; inspect label/error associations. Browser and viewport profiles are recorded in the approved plan. | S13 |
| NFR-9 | Enforce logical closure immediately at its boundary and complete background closure processing within one minute while the required environment services are running. | With a controlled clock, prove new draws/replacements are blocked at the boundary, including before background processing runs; verify background closure completes no later than 60 seconds afterward. | S13 |

## Acceptance criteria inherited without changes

- AC-1 (FR-1): Creating two groups with the same nonempty name succeeds; creation without a name fails; omitting the description succeeds. Each created group has exactly one owner, its creator, and includes that creator as a participating member; the database enforces a single owner per group.
- AC-2 (FR-2): USER can list and change owned groups but cannot list or change unowned groups through these management operations. Confirmed deletion removes the group, its events, and its draws, retaining member accounts; cancelling confirmation leaves them unchanged.
- AC-5 (FR-5): An owner can create and list users in an owned group, but attempts to modify another member's user data fail and leave it unchanged. An owner cannot delete another account solely through group ownership. SUPER ADMIN permissions follow FR-22.
- AC-6 (FR-6): Each searchable field supports partial matching; filters combine with AND, ignoring case/accents, such that `jose` matches `José`. Results show first name plus optional surnames. No matches display “No se encontraron usuarios”. Reassociating an existing member displays “El usuario ya pertenece al grupo”, without duplicate membership, mutation, redraw, or new assignment email.
- AC-7 (FR-7): An owner can create/edit an event with only a name; absent names fail, optional date/notes can be supplied, and each event has exactly one group. After a valid draw, changing group name/description or event name/date/notes leaves its assignments unchanged and does not trigger redraw.
- AC-8 (FR-8): An owner can list and delete events of owned groups; a USER without ownership cannot.
- AC-9 (FR-9): An owner can finish an event with no draw, an invalid draw, or a valid draw; completion writes the current system date/time into the single completion field, overwriting any future value, and closes the event immediately.
- AC-19 (FR-19): Users navigation displays the specified list and permits authorized creation, listing, association, and removal; it does not grant owners permission to modify other users' data or delete their accounts. SUPER ADMIN and own-account exceptions follow FR-22/23/29.
- AC-20 (FR-20): Groups navigation displays owned groups and permits member association using both creation and search.
- AC-21 (FR-21): Events navigation displays the specified list and actions, enforcing FR-12 for deletion and FR-9 for completion.
- AC-22 (FR-22): SUPER ADMIN can perform specified management operations on groups and events owned by other users but cannot view another user's assignment.
- AC-24 (FR-24): Removing another member from an owned group removes that membership while the global account and its memberships in other groups remain; a USER who does not own the group cannot perform this group-management action.
- AC-27 (FR-27): Every membership removal displays its consequences and requires the acting user's confirmation, including account-deletion paths. Without confirmation, removal and its dependent changes do not execute. A special insufficient-participant warning appears when fewer than three would remain, even though confirmation is also required when enough members would remain.
- AC-31 (FR-31): An event with no completion value remains unscheduled. Selecting today or a future day schedules closure at that day's end in installation system time, explained by the form. A past day produces a form validation error. The event remains open before the scheduled boundary unless manually closed, closes when due, and cannot reopen. Manual closure updates the same field as specified by AC-9.
- AC-32 (FR-32): Concurrent closure prevents new/replacement draws for the closed event, while authorized group member changes succeed without redrawing its finished-event draws. Unfinished events in the same group still follow automatic redraw rules.

## Slice completion and deferred evidence

Post-draw mutation, assignment cleanup and delivery consequences are integrated in 005–007. Never expose a destructive operation against a dependent state whose complete transaction has not yet been implemented.

Every [task](./tasks.md) must satisfy its own observable done conditions, include applicable behavioral checks, and record actual evidence and limitations. Passing a fixture-only, component-only, or environment check does not satisfy a parent user-flow acceptance condition on its own.

## Edge cases and exclusions

Apply all parent edge cases, precedence rules and scope exclusions. This slice introduces no registration, verification, role-management screen, extra participant exclusions, cloud provider, or new product feature. Never expose partially implemented destructive behavior against downstream states. Runtime/installation failures and missing prerequisites remain visible blockers.

## Open questions

No new product question is introduced by this extraction. Document/task approval is recorded above; individual execution beyond 002:T1 and all installation authorization remain pending. Technical designs are inherited from the approved parent plan; changes to them or requirements follow SDD Change.

