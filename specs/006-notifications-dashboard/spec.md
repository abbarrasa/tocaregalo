# Spec 006 — Notifications and private dashboard

Status: synchronized with approved parent requirements; task execution remains separately gated
Revision: v0.2
Historical approval (v0.1): The user stated “Apruebo y autorizo iniciar la T1 de spec 002”, approving the derived-document/task package and authorizing only 002:T1 on 2026-11-16. No installation is authorized.
Parent: [Spec 001 v1.1, approved](../001-toca-regalo/spec.md)
Architecture: [Plan 001 v0.2, approved](../001-toca-regalo/plan.md)
Organization: [approved decomposition v0.1](../001-toca-regalo/decomposition-proposal.md)
Inheritance authority: approved parent v1.1 supplies NFR-10 verbatim; the user approved revised plans and authorized downstream task updates on 2026-11-17. This synchronized extraction adds no independent product decision.

## Context and objective

Complete durable participant notifications and the private responsive dashboard with reveal/resend and visible delivery failures.

The user approved the parent specification v1.0, parent plan v0.1, and six-block decomposition v0.1 (“Apruebo los bloques. Continúa”). The user subsequently approved these derived documents and task lists, authorizing only 002:T1. No installation or other task execution is authorized.

## Scope and actors

This is an organizational slice of the approved application, not a separate product or a change of requirements. Actors, definitions, field constraints and permission exceptions are inherited from Spec 001. No other-user assignment disclosure through management or status/resend. Account-deletion end-to-end consequences remain in 007; recovery delivery is regression-tested, not redefined.

Prerequisite block: [005-confidential-draws](../005-confidential-draws/tasks.md). No cross-block case is marked fulfilled until its complete supporting behavior passes.

## Functional requirements inherited without changes

The following rows are copied verbatim from the approved parent. Inclusion identifies applicable behavior, including supporting/regression work; it does not claim the entire requirement is completed by this slice.

| ID | Requirement | Source |
| --- | --- | --- |
| FR-13 | When a draw becomes valid, the system shall email each group member the event name and their recipient's first name and surnames when present. Failed delivery shall preserve the draw and retry under FR-34; exhaustion shall be visible to the owner and SUPER ADMIN without revealing others' assignments, with resend still available for current valid unfinished-event assignments. Owners may request resend for group members, SUPER ADMIN for any user, and users for themselves from their draw card. Pending assignment emails shall be discarded on assignment replacement or event closure. | S1 Event draw; S8/S9/S11/S12 |
| FR-14 | While assignments are stored, the system shall encrypt the assigned recipient reversibly in the application before database storage and recover it when needed for notification. Key provisioning and retention policy shall be proposed for user approval during planning. | S1 Event draw; S10 |
| FR-16 | When the dashboard is displayed, the system shall show the signed-in user's own assignment cards for applicable draws in unfinished events, including event name and an initially concealed recipient name. Invalid draws shall display “Participantes insuficientes” and shall not allow revealing the previous assignment. No user, including SUPER ADMIN, shall be permitted to view another user's assignment. | S1 Dashboard; S8/S11 |
| FR-17 | When a user activates an assignment card's reveal button, the system shall display the recipient name for 20 seconds and then conceal it again; activation while visible shall restart that 20-second period. | S1 Dashboard; S8 |
| FR-18 | When the dashboard is displayed, the system shall show a card listing groups owned by the user. | S1 Dashboard |
| FR-21 | When the Events sidebar entry is selected, the system shall list events of owned groups and provide access to event CRUD, draw execution, authorized draw deletion, and event completion. | S1 Sidebar |
| FR-22 | While a user has the SUPER ADMIN role, the system shall permit all specified management operations, including those outside owned groups, without granting access to other users' assignments (FR-16). | S1 Roles amended by S8 |
| FR-25 | When account deletion, owner-driven membership removal, or addition of a member after a draw affects an existing draw in a surviving unfinished event, the system shall automatically replace that draw using current group membership if at least three members are available and email each their new assignment. This shall also apply when membership reaches three again after prior assignments became invalid. The system shall not repeat draws of finished events. | S5/S6/S7/S8 |
| FR-26 | If fewer than three members are available for an initial draw or automatic redraw, the system shall not perform the draw and shall inform members of insufficient participants by email. Previous assignments shall be retained and marked invalid when an unfinished-event redraw becomes impossible. | S6/S7 amended by S8 |
| FR-28 | When a user requests password recovery, the system shall email a single-use reset link, valid for one hour by default with a configurable lifetime. Issuing a new link shall invalidate earlier links for that account. A valid unused current link shall permit setting a password under FR-4; superseded, used, or expired links shall not authorize reset. | S8/S9/S12 |
| FR-32 | When event closure coincides with draw execution or membership changes, the system shall give closure precedence and shall not create or replace a draw after that event is closed. Authorized group membership changes shall still proceed, without redrawing closed-event draws; affected unfinished events shall retain FR-25 behavior. | S9/S12 |
| FR-34 | When notification delivery fails, the system shall permit five retries in addition to the initial send. For retry n=1…5, the delay after the preceding failure shall be `base × 2^(n−1)`, with a configurable positive base duration. A base of 30 seconds yields delays of 30 s, 60 s, 120 s, 240 s, and 480 s. Stale assignment emails shall be discarded under FR-13. | S10/S11 |

## Non-functional requirements inherited without changes

| ID | Requirement | Acceptance condition | Source |
| --- | --- | --- | --- |
| NFR-2 | Use Vue.js and Bootstrap for the frontend. Do not use Twig anywhere in the project. | Configuration and a demonstrated frontend flow show Vue.js and Bootstrap; dependency and source review confirm no Twig use. | S1 Technologies amended by S4 |
| NFR-4 | The frontend shall obtain data and perform actions through API calls; the backend shall expose endpoints and never return user templates or views. | Integration checks inspect API responses and demonstrate a frontend flow consuming the API without backend-rendered views. | S1 Technologies |
| NFR-5 | Use Spanish for application text and user-facing documentation and English for technical documents, identifiers, and comments. | Review the implemented UI, user documentation, and technical artifacts against constitution P6. | S1 Other requirements; S3 |
| NFR-6 | Support use on mobile and desktop. | Demonstrate login, dashboard reveal/resend, account settings, and applicable owner-management flows on mobile and desktop viewport profiles agreed in the plan, without inaccessible controls or unintended horizontal page overflow. | S11 |
| NFR-7 | Configure SMTP externally per environment, capture email locally in development, and supply real-server settings for deployment without embedding credentials in the repository. | Demonstrate development capture of assignment and recovery emails and review environment configuration templates for host, port, transport security, authentication, and sender identity; verify no real credentials are committed. Real-delivery verification requires supplied deployment values. | S13 |
| NFR-8 | Show loading, empty, and error states in Spanish; support keyboard navigation and associate form labels and validation errors with their fields. | Exercise loading/empty/failure cases and complete specified form and navigation actions using the keyboard; inspect label/error associations. Browser and viewport profiles are recorded in the approved plan. | S13 |
| NFR-9 | Enforce logical closure immediately at its boundary and complete background closure processing within one minute while the required environment services are running. | With a controlled clock, prove new draws/replacements are blocked at the boundary, including before background processing runs; verify background closure completes no later than 60 seconds afterward. | S13 |
| NFR-10 | Run PHPStan at fixed level 10 on project-owned PHP, including tests and excluding third-party dependencies, after each implementation task and before marking it complete. Require zero reported errors without hiding findings in a baseline. | The recorded PHPStan command/configuration demonstrates level 10 and the required scope; each subsequent implementation task records a successful run with zero errors and no findings hidden in a baseline. Failed or unavailable analysis prevents task completion. | S14 |

NFR-10 is inherited from approved parent Spec 001 v1.1. It applies to every future implementation task; completed task evidence remains historical under its original approved scope. A failed or unavailable PHPStan check blocks completion.

## Acceptance criteria inherited without changes

- AC-13 (FR-13): Assignment email contains event name and recipient first name plus optional surnames. Failed delivery preserves assignments; after all retries fail, owner and SUPER ADMIN see the failure, without assignment disclosure, and can request authorized resend for a current valid unfinished-event assignment. Queued initial sends/retries/resends for superseded assignments or closed events are discarded. Resend permissions remain enforced.
- AC-14 (FR-14): Database inspection cannot read the stored assigned recipient in clear text, and authorized notification processing recovers the correct recipient.
- AC-16 (FR-16): Only own assignments in unfinished events produce cards; valid recipients are initially concealed. Invalid draws show “Participantes insuficientes” without allowing previous-assignment reveal. Requests to view another user's assignment fail for USER and SUPER ADMIN alike. Finished events do not produce these cards.
- AC-17 (FR-17): Reveal displays the correct recipient and conceals it after 20 seconds from the latest activation; activating again during visibility restarts the period.
- AC-18 (FR-18): The dashboard ownership card lists the current user's owned groups.
- AC-21 (FR-21): Events navigation displays the specified list and actions, enforcing FR-12 for deletion and FR-9 for completion.
- AC-22 (FR-22): SUPER ADMIN can perform specified management operations on groups and events owned by other users but cannot view another user's assignment.
- AC-25 (FR-25): Test self-deletion, SUPER ADMIN account deletion, owner-driven removal, and adding a member after a valid draw separately. Affected surviving unfinished-event draws are replaced when at least three members are available, using current membership and emailing each participant the new assignment. Added members participate and removed users are excluded. Finished-event draws never repeat. Insufficient members invoke AC-26; delivery failures follow AC-13/34.
- AC-26 (FR-26): Initial draws and automatic redraws with zero, one, or two available members create no new assignments. When an unfinished-event redraw becomes impossible, previous assignments remain stored and are marked invalid. Available members receive an insufficient-participant email. When membership returns to at least three, an affected unfinished-event draw is automatically replaced and new assignments emailed.
- AC-28 (FR-28): A current emailed recovery link permits setting a valid password before expiry. Issuing a second link invalidates the first; successful use invalidates the used link; expired links fail. Default validity is one hour; configuration changes affect newly issued links. The reset password permits login.
- AC-32 (FR-32): Concurrent closure prevents new/replacement draws for the closed event, while authorized group member changes succeed without redrawing its finished-event draws. Unfinished events in the same group still follow automatic redraw rules.
- AC-34 (FR-34): An initial failure permits at most five additional retries, six sends total. For base 30 seconds, successive retry delays after failure are 30/60/120/240/480 seconds. Changing the base scales delays. Success ends that sequence; closure/replacement discards pending deliveries. Exhaustion is visible to owner and SUPER ADMIN under AC-13 and permits authorized manual resend.

## Slice completion and deferred evidence

No other-user assignment disclosure through management or status/resend. Account-deletion end-to-end consequences remain in 007; recovery delivery is regression-tested, not redefined.

Every [task](./tasks.md) must satisfy its own observable done conditions, include applicable behavioral checks, and record actual evidence and limitations. Passing a fixture-only, component-only, or environment check does not satisfy a parent user-flow acceptance condition on its own.

## Edge cases and exclusions

Apply all parent edge cases, precedence rules and scope exclusions. This slice introduces no registration, verification, role-management screen, extra participant exclusions, cloud provider, or new product feature. Never expose partially implemented destructive behavior against downstream states. Runtime/installation failures and missing prerequisites remain visible blockers.

## Open questions

No new product question is introduced by this extraction. Document/task approval is recorded above; individual execution beyond 002:T1 and all installation authorization remain pending. Technical designs are inherited from the approved parent plan; changes to them or requirements follow SDD Change.

