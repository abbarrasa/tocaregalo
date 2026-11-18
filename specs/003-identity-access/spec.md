# Spec 003 — Identity and account access

Status: synchronized with approved parent requirements; task execution remains separately gated
Revision: v0.3
Synchronization (v0.3): “Apruebo esta revisión y autorizo preparar el resto de revisiones afectadas”, 2026-11-17. Inherits approved parent v1.2 FR-4/AC-4 verbatim; no independent requirement or task authorization added. Historical v0.2 inheritance remains recorded below.
Historical approval (v0.1): The user stated “Apruebo y autorizo iniciar la T1 de spec 002”, approving the derived-document/task package and authorizing only 002:T1 on 2026-11-16. No installation is authorized.
Parent: [Spec 001 v1.2, approved](../001-toca-regalo/spec.md)
Architecture: [Plan 001 v0.2, approved](../001-toca-regalo/plan.md)
Organization: [approved decomposition v0.1](../001-toca-regalo/decomposition-proposal.md)
Inheritance authority: approved parent v1.1 supplies NFR-10 verbatim; the user approved revised plans and authorized downstream task updates on 2026-11-17. This synchronized extraction adds no independent product decision.

## Context and objective

Provide authenticated identity, account changes, recovery and the adapted SUPER ADMIN command using the approved session/API boundaries.

The user approved the parent specification v1.0, parent plan v0.1, and six-block decomposition v0.1 (“Apruebo los bloques. Continúa”). The user subsequently approved these derived documents and task lists, authorizing only 002:T1. No installation or other task execution is authorized.

## Scope and actors

This is an organizational slice of the approved application, not a separate product or a change of requirements. Actors, definitions, field constraints and permission exceptions are inherited from Spec 001. No global account deletion until 007. Ordinary-user creation is an application boundary exercised with fixtures here; its owner/group entry point is completed in 004. Final assignment dashboard and assignment-delivery acceptance remain in 006.

Prerequisite block: [002-development-foundation](../002-development-foundation/tasks.md). No cross-block case is marked fulfilled until its complete supporting behavior passes.

## Functional requirements inherited without changes

The following rows are copied verbatim from the approved parent. Inclusion identifies applicable behavior, including supporting/regression work; it does not claim the entire requirement is completed by this slice.

| ID | Requirement | Source |
| --- | --- | --- |
| FR-3 | When a user is created or modified, the system shall require globally unique email and textual phone values, a required first name, and optional surnames. It shall trim surrounding whitespace from names/email, validate email with Symfony, and compare email uniqueness without case sensitivity. Every phone, including Spanish numbers, shall include a country prefix beginning with `+`. Backend processing shall remove whitespace/signs except the prefix `+` and enforce uniqueness on the cleaned value. The frontend shall use an available Vue plugin, or an implemented Vue plugin, to prevent spaces, hyphens, and other signs in the phone number. | S1 User management; S4/S5/S6/S11/S13 |
| FR-4 | When a password is set, the system shall require at least six characters, permitting letters, digits, and symbols without requiring a combination of character categories, and hash it using Symfony's password hasher classes and algorithms. When an owner creates a user, that owner shall set the initial password. When the input exceeds 4096 UTF-8 bytes, the system shall reject it without creating an account or modifying an existing password; whitespace shall be preserved exactly. | S1 User management; S4/S5/S15 |
| FR-5 | When an owner manages users within an owned group, the system shall allow creation and listing but shall not allow that owner to modify another member's user data. Group ownership alone shall not authorize deleting another user's global account. | S1 User management amended by S4/S5 |
| FR-13 | When a draw becomes valid, the system shall email each group member the event name and their recipient's first name and surnames when present. Failed delivery shall preserve the draw and retry under FR-34; exhaustion shall be visible to the owner and SUPER ADMIN without revealing others' assignments, with resend still available for current valid unfinished-event assignments. Owners may request resend for group members, SUPER ADMIN for any user, and users for themselves from their draw card. Pending assignment emails shall be discarded on assignment replacement or event closure. | S1 Event draw; S8/S9/S11/S12 |
| FR-15 | When a user logs in successfully using email or phone and password, the system shall redirect that user to the dashboard. The system shall not provide public registration. | S1 Dashboard; S8 |
| FR-22 | While a user has the SUPER ADMIN role, the system shall permit all specified management operations, including those outside owned groups, without granting access to other users' assignments (FR-16). | S1 Roles amended by S8 |
| FR-28 | When a user requests password recovery, the system shall email a single-use reset link, valid for one hour by default with a configurable lifetime. Issuing a new link shall invalidate earlier links for that account. A valid unused current link shall permit setting a password under FR-4; superseded, used, or expired links shall not authorize reset. | S8/S9/S12 |
| FR-29 | While authenticated, a user shall be permitted to modify their own account data and password, subject to the existing field constraints and password policy. | S8 |
| FR-30 | When the interactive `app:user:create-super-admin` command is executed with valid inputs, the system shall create a SUPER ADMIN. It shall request email, required first name/phone, optional surnames, and a confirmed password under FR-4; create the role if missing; and omit account verification. Adapt the reference without its Nurschool namespace or stronger password policy. SUPER ADMIN creation shall use this command; specified user-creation flows shall create ordinary users. No role-management screen is included. | S8/S10/S11/S13 |
| FR-34 | When notification delivery fails, the system shall permit five retries in addition to the initial send. For retry n=1…5, the delay after the preceding failure shall be `base × 2^(n−1)`, with a configurable positive base duration. A base of 30 seconds yields delays of 30 s, 60 s, 120 s, 240 s, and 480 s. Stale assignment emails shall be discarded under FR-13. | S10/S11 |
| FR-35 | When an authenticated user requests logout, the system shall end that session's authenticated access. Subsequent protected operations through that session shall require login again. | S12 |

## Non-functional requirements inherited without changes

| ID | Requirement | Acceptance condition | Source |
| --- | --- | --- | --- |
| NFR-1 | Use Symfony, API Platform, and MySQL for the backend. | Configuration and a running API/database interaction demonstrate use of all three. Versions require an approved plan. | S1 Technologies |
| NFR-2 | Use Vue.js and Bootstrap for the frontend. Do not use Twig anywhere in the project. | Configuration and a demonstrated frontend flow show Vue.js and Bootstrap; dependency and source review confirm no Twig use. | S1 Technologies amended by S4 |
| NFR-4 | The frontend shall obtain data and perform actions through API calls; the backend shall expose endpoints and never return user templates or views. | Integration checks inspect API responses and demonstrate a frontend flow consuming the API without backend-rendered views. | S1 Technologies |
| NFR-5 | Use Spanish for application text and user-facing documentation and English for technical documents, identifiers, and comments. | Review the implemented UI, user documentation, and technical artifacts against constitution P6. | S1 Other requirements; S3 |
| NFR-6 | Support use on mobile and desktop. | Demonstrate login, dashboard reveal/resend, account settings, and applicable owner-management flows on mobile and desktop viewport profiles agreed in the plan, without inaccessible controls or unintended horizontal page overflow. | S11 |
| NFR-7 | Configure SMTP externally per environment, capture email locally in development, and supply real-server settings for deployment without embedding credentials in the repository. | Demonstrate development capture of assignment and recovery emails and review environment configuration templates for host, port, transport security, authentication, and sender identity; verify no real credentials are committed. Real-delivery verification requires supplied deployment values. | S13 |
| NFR-8 | Show loading, empty, and error states in Spanish; support keyboard navigation and associate form labels and validation errors with their fields. | Exercise loading/empty/failure cases and complete specified form and navigation actions using the keyboard; inspect label/error associations. Browser and viewport profiles are recorded in the approved plan. | S13 |
| NFR-10 | Run PHPStan at fixed level 10 on project-owned PHP, including tests and excluding third-party dependencies, after each implementation task and before marking it complete. Require zero reported errors without hiding findings in a baseline. | The recorded PHPStan command/configuration demonstrates level 10 and the required scope; each subsequent implementation task records a successful run with zero errors and no findings hidden in a baseline. Failed or unavailable analysis prevents task completion. | S14 |

NFR-10 is inherited from approved parent Spec 001 v1.1. It applies to every future implementation task; completed task evidence remains historical under its original approved scope. A failed or unavailable PHPStan check blocks completion.

## Acceptance criteria inherited without changes

- AC-3 (FR-3): Missing required fields and duplicate email/phone fail; omitting surnames succeeds. Surrounding whitespace is trimmed from names/email; Symfony rejects invalid emails and case variants of an existing email fail uniqueness. Phones require a `+` country prefix; `00`-only prefixes fail. Backend cleanup strips whitespace/signs except the prefix `+`; formatting variants of the same cleaned phone fail uniqueness. Frontend entry prevents unwanted characters through the specified Vue plugin mechanism.
- AC-4 (FR-4): Passwords shorter than six characters fail. Passwords of six or more characters using letters, digits, symbols, or combinations meet the composition policy without requiring multiple categories. An owner sets a newly created user's initial password; the stored value is a Symfony-generated hash, not the raw password, and Symfony's hasher verifies the correct password and rejects an incorrect one.
  Verify the 4096-byte upper boundary with ASCII and multibyte UTF-8 inputs: valid inputs at 4096 bytes can be hashed and verified; inputs above 4096 bytes fail without account creation or password mutation. Preserve whitespace exactly; the minimum counts characters and the maximum counts bytes.
- AC-5 (FR-5): An owner can create and list users in an owned group, but attempts to modify another member's user data fail and leave it unchanged. An owner cannot delete another account solely through group ownership. SUPER ADMIN permissions follow FR-22.
- AC-13 (FR-13): Assignment email contains event name and recipient first name plus optional surnames. Failed delivery preserves assignments; after all retries fail, owner and SUPER ADMIN see the failure, without assignment disclosure, and can request authorized resend for a current valid unfinished-event assignment. Queued initial sends/retries/resends for superseded assignments or closed events are discarded. Resend permissions remain enforced.
- AC-15 (FR-15): The correct password with either the account's email or phone permits login and leads to the dashboard; incorrect credentials fail. No public account-registration operation is available.
- AC-22 (FR-22): SUPER ADMIN can perform specified management operations on groups and events owned by other users but cannot view another user's assignment.
- AC-28 (FR-28): A current emailed recovery link permits setting a valid password before expiry. Issuing a second link invalidates the first; successful use invalidates the used link; expired links fail. Default validity is one hour; configuration changes affect newly issued links. The reset password permits login.
- AC-29 (FR-29): During a session, a user can update their own account data and password under existing validation and uniqueness constraints; unauthenticated requests cannot perform those updates. Changing another member's data is not authorized by group ownership.
- AC-30 (FR-30): The interactive command collects email, required first name/phone, optional surnames, and confirmed password under FR-4, creates a SUPER ADMIN, and creates the role if absent. No verification status/flow or role-management screen exists; ordinary creation flows do not grant SUPER ADMIN. Required-field and duplicate-email/phone errors do not modify existing users. The adapted command uses Toca Regalo namespaces and the general six-character-minimum policy.
- AC-34 (FR-34): An initial failure permits at most five additional retries, six sends total. For base 30 seconds, successive retry delays after failure are 30/60/120/240/480 seconds. Changing the base scales delays. Success ends that sequence; closure/replacement discards pending deliveries. Exhaustion is visible to owner and SUPER ADMIN under AC-13 and permits authorized manual resend.
- AC-35 (FR-35): After logout, protected operations made through the previous session fail authentication and require login; a subsequent valid login restores access.

## Slice completion and deferred evidence

No global account deletion until 007. Ordinary-user creation is an application boundary exercised with fixtures here; its owner/group entry point is completed in 004. Final assignment dashboard and assignment-delivery acceptance remain in 006.

Every [task](./tasks.md) must satisfy its own observable done conditions, include applicable behavioral checks, and record actual evidence and limitations. Passing a fixture-only, component-only, or environment check does not satisfy a parent user-flow acceptance condition on its own.

## Edge cases and exclusions

Apply all parent edge cases, precedence rules and scope exclusions. This slice introduces no registration, verification, role-management screen, extra participant exclusions, cloud provider, or new product feature. Never expose partially implemented destructive behavior against downstream states. Runtime/installation failures and missing prerequisites remain visible blockers.

## Open questions

No new product question is introduced by this extraction. Document/task approval is recorded above; individual execution beyond 002:T1 and all installation authorization remain pending. Technical designs are inherited from the approved parent plan; changes to them or requirements follow SDD Change.

