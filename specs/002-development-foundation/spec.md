# Spec 002 — Development foundation

Status: synchronized with approved parent requirements; task execution remains separately gated
Revision: v0.2
Historical approval (v0.1): The user stated “Apruebo y autorizo iniciar la T1 de spec 002”, approving the derived-document/task package and authorizing only 002:T1 on 2026-11-16. No installation is authorized.
Parent: [Spec 001 v1.1, approved](../001-toca-regalo/spec.md)
Architecture: [Plan 001 v0.2, approved](../001-toca-regalo/plan.md)
Organization: [approved decomposition v0.1](../001-toca-regalo/decomposition-proposal.md)
Inheritance authority: approved parent v1.1 supplies NFR-10 verbatim; the user approved revised plans and authorized downstream task updates on 2026-11-17. This synchronized extraction adds no independent product decision.

## Context and objective

Provide the reproducible development environment and verification tools required by the approved application, without claiming product features implemented.

The user approved the parent specification v1.0, parent plan v0.1, and six-block decomposition v0.1 (“Apruebo los bloques. Continúa”). The user subsequently approved these derived documents and task lists, authorizing only 002:T1. No installation or other task execution is authorized.

## Scope and actors

This is an organizational slice of the approved application, not a separate product or a change of requirements. Actors, definitions, field constraints and permission exceptions are inherited from Spec 001. Infrastructure enabling work only. Product acceptance remains with 003–007; no health check or empty SPA is presented as the finished application.

Prerequisite block: None. No cross-block case is marked fulfilled until its complete supporting behavior passes.

## Functional requirements inherited without changes

No new functional requirement. This foundation enables all FR-1…35; product behavior and acceptance belong to the subsequent slices.

## Non-functional requirements inherited without changes

| ID | Requirement | Acceptance condition | Source |
| --- | --- | --- | --- |
| NFR-1 | Use Symfony, API Platform, and MySQL for the backend. | Configuration and a running API/database interaction demonstrate use of all three. Versions require an approved plan. | S1 Technologies |
| NFR-2 | Use Vue.js and Bootstrap for the frontend. Do not use Twig anywhere in the project. | Configuration and a demonstrated frontend flow show Vue.js and Bootstrap; dependency and source review confirm no Twig use. | S1 Technologies amended by S4 |
| NFR-3 | Provide a Docker development environment using Nginx. | Following documented setup starts the approved services and serves the application through Nginx. | S1 Technologies; user request |
| NFR-4 | The frontend shall obtain data and perform actions through API calls; the backend shall expose endpoints and never return user templates or views. | Integration checks inspect API responses and demonstrate a frontend flow consuming the API without backend-rendered views. | S1 Technologies |
| NFR-5 | Use Spanish for application text and user-facing documentation and English for technical documents, identifiers, and comments. | Review the implemented UI, user documentation, and technical artifacts against constitution P6. | S1 Other requirements; S3 |
| NFR-6 | Support use on mobile and desktop. | Demonstrate login, dashboard reveal/resend, account settings, and applicable owner-management flows on mobile and desktop viewport profiles agreed in the plan, without inaccessible controls or unintended horizontal page overflow. | S11 |
| NFR-7 | Configure SMTP externally per environment, capture email locally in development, and supply real-server settings for deployment without embedding credentials in the repository. | Demonstrate development capture of assignment and recovery emails and review environment configuration templates for host, port, transport security, authentication, and sender identity; verify no real credentials are committed. Real-delivery verification requires supplied deployment values. | S13 |
| NFR-8 | Show loading, empty, and error states in Spanish; support keyboard navigation and associate form labels and validation errors with their fields. | Exercise loading/empty/failure cases and complete specified form and navigation actions using the keyboard; inspect label/error associations. Browser and viewport profiles are recorded in the approved plan. | S13 |
| NFR-9 | Enforce logical closure immediately at its boundary and complete background closure processing within one minute while the required environment services are running. | With a controlled clock, prove new draws/replacements are blocked at the boundary, including before background processing runs; verify background closure completes no later than 60 seconds afterward. | S13 |
| NFR-10 | Run PHPStan at fixed level 10 on project-owned PHP, including tests and excluding third-party dependencies, after each implementation task and before marking it complete. Require zero reported errors without hiding findings in a baseline. | The recorded PHPStan command/configuration demonstrates level 10 and the required scope; each subsequent implementation task records a successful run with zero errors and no findings hidden in a baseline. Failed or unavailable analysis prevents task completion. | S14 |

NFR-10 is inherited from approved parent Spec 001 v1.1. It applies to every future implementation task; completed task evidence remains historical under its original approved scope. A failed or unavailable PHPStan check blocks completion.

## Acceptance criteria inherited without changes

No product acceptance criterion is replaced by a scaffold check. NFR acceptance conditions above are directly applicable to setup; full user-flow evidence is collected in downstream blocks.

## Slice completion and deferred evidence

Infrastructure enabling work only. Product acceptance remains with 003–007; no health check or empty SPA is presented as the finished application.

Every [task](./tasks.md) must satisfy its own observable done conditions, include applicable behavioral checks, and record actual evidence and limitations. Passing a fixture-only, component-only, or environment check does not satisfy a parent user-flow acceptance condition on its own.

## Edge cases and exclusions

Apply all parent edge cases, precedence rules and scope exclusions. This slice introduces no registration, verification, role-management screen, extra participant exclusions, cloud provider, or new product feature. Never expose partially implemented destructive behavior against downstream states. Runtime/installation failures and missing prerequisites remain visible blockers.

## Open questions

No new product question is introduced by this extraction. Document/task approval is recorded above; individual execution beyond 002:T1 and all installation authorization remain pending. Technical designs are inherited from the approved parent plan; changes to them or requirements follow SDD Change.

