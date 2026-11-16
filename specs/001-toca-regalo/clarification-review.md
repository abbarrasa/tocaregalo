# Clarification Review — Spec 001

Reviewed revision: [specification v1.0](./spec.md)
Constitution: [v1](../../docs/constitution.md)
Phase: Clarification, not implementation validation or code review.
Outcome: no confirmed blocking product ambiguity; consolidated specification v1.0 explicitly approved. This review remains document-level evidence, not implementation validation.

## Authority and approval evidence

- Constitution v1 was explicitly approved by the user.
- Specification and Clarification were explicitly authorized in conversation.
- Sources S4–S12 record the user's clarification answers, superseding conflicting interview/ER details; S13 records approval of all six final proposals through “Apruebo estas propuestas y continúa”.
- That last approval covers those proposals. It does not approve the consolidated v1.0 document, the technical plan, package installation, or implementation.
- Subsequently, the user explicitly stated “Apruebo la especificacion” in response to the combined request to approve v1.0 and enter Planning. Specification approval is now recorded; the technical plan, tasks, package installation, and implementation still require their respective approvals.
- Source requirements and ER files were not rewritten. The supplied PHP bootstrap command was analyzed as reference material; no application command was implemented.

## QA reassessment

| Review concern | Evidence and result |
| --- | --- |
| Ambiguous inputs and validation | FR-1/3/4/7/31 specify required/optional fields, phone normalization, email validation/uniqueness, password policy, and completion-date validation. Concrete Doctrine/MySQL length mappings depend on approved versions/types and are explicit plan follow-ups. |
| Conflicting sources and technology constraints | S4/S11/S13 remove Twig, clarify one owner and one group per event, disregard ER attributes, exclude erroneous Nurschool context, and resolve email information and bootstrap adaptations. NFR-1…5 preserve the mandated stack/API/language constraints. |
| Draw validity and fairness | FR-10 and AC-10 cover every member, minimum three, one giver/recipient, no self-assignment, and equal probability for complete valid assignments. Algorithm reasoning and exact small-case verification are required in the plan. |
| Draw state versus event state | FR-9/11/12/25/31/32 distinguish closed draws from finished events; finished events never reopen or redraw, even after SUPER ADMIN deletes their draw. A future completion value does not itself mean finished. |
| Member mutation and deletion | FR-2/23…27 define confirmation, owned-data cascades, retained other accounts, null references, automatic replacement, invalid retained assignments below three, and recovery to three. Duplicate association is explicitly a no-op under FR-6. |
| Confidentiality and authorization | FR-5/16/22/23/29/30 distinguish owner management, own-account operations, SUPER ADMIN exceptions, and assignment secrecy. Acting on behalf of another user for resend grants no access to their recipient. |
| Delivery failures and stale work | FR-13/34 specify preserved draws, initial send plus five exponential retries, final-failure visibility, permitted manual resend, and discard on assignment replacement/closure. SMTP settings are deployment values, with approved local capture for development. |
| Login, recovery, and logout | FR-15/28/29/30/35 define identifiers, no public registration/verification, configurable single-use recovery links, supersession, authenticated edits, bootstrap adaptation, and logout. |
| Concurrent operations and deadlines | FR-32/33 and NFR-9 prioritize closure, retain group membership mutations without closed-event redraw, collapse simultaneous initial draw requests, block logically at the closure boundary, and allow at most 60 seconds for background processing. |
| Interface and accessibility | FR-16/17 and NFR-6/8 specify own-card privacy, timer reset, invalid-card messaging, mobile/desktop use, Spanish loading/empty/error states, keyboard support, and field label/error association. Concrete test profiles belong in the plan. |
| Constitution conflicts | No direct conflict found with P1…P6. Requirements remain the authority; technical choices, architecture, and verification evidence have not been invented or claimed implemented. |

## Source coverage

| Source area | Specification coverage |
| --- | --- |
| Technologies and API-only separation | NFR-1…4; S4 excludes Twig |
| Roles and ownership | FR-1/2/5/8/12/19…24/29/30, assignment exception FR-16/22 |
| Group attributes and management | FR-1/2/7/20 |
| User attributes, membership, and search | FR-3…6/19/23/24/27/29 |
| Event attributes, management, and completion | FR-7…9/21/31/32 |
| Draw, encryption, locking, deletion, and email | FR-10…14/23…27/33/34 |
| Dashboard and sidebar | FR-15…21 |
| Spanish application language and English technical documentation | NFR-5; constitution P6 |
| Clarified authentication, recovery, command, and logout | FR-15/28…30/35 |
| Clarified development mail, responsive UI, accessibility, and closure delay | NFR-6…9 |

Every FR-1…35 has AC-1…35. Every NFR-1…9 has an inline acceptance condition. This is document-level traceability, not evidence that the application satisfies the requirements.

## Technical follow-ups and operational dependencies

These do not require further product clarification before plan preparation, but must be proposed and approved in the plan before dependent implementation:

1. Compatible versions, entity mapping/default lengths, boundaries and interfaces, package list, and Docker/Nginx development configuration.
2. Application encryption, key provisioning/backup/retention, and confidential nullable-reference handling. A plaintext recipient foreign key is not an acceptable shortcut around FR-14.
3. Uniform draw algorithm with reasoning and reproducible verification; transaction/concurrency strategy; closure scheduling and reliable retry/cancellation.
4. SMTP configuration templates and local email capture tooling. Real host/port/security/authentication/sender values remain necessary for production delivery checks. No credentials are requested in chat or stored in repository.
5. UI designs and concrete browser/viewport profiles, fixture clocks, test commands, and requirement-to-work-and-verification matrix.

## Verification limits and next step

- Reviewed the consolidated source decisions, stable identifiers, acceptance coverage, cross-references, and explicit scope exclusions.
- Checked local Markdown targets and requirement/criterion coverage mechanically and checked documentation whitespace.
- No application tests, runtime checks, deployment checks, package installation, or implementation review were performed; no application exists yet.
- The user has now approved specification v1.0; [technical plan v0.1](./plan.md) was prepared in the authorized Plan phase. Request approval of that plan before Tasks; no implementation or installation is authorized.
