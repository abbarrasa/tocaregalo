# Toca Regalo Project Memory

Last updated: 2026-11-17

## Current state

- Phase: Implementation, 002:T1 and T2 complete. Stop before unauthorized T3.
- [Application specification 001 v1.0](./specs/001-toca-regalo/spec.md), [technical plan 001 v0.1](./specs/001-toca-regalo/plan.md), and [six-block decomposition v0.1](./specs/001-toca-regalo/decomposition-proposal.md) are approved.
- All six derived blocks' spec/plan/tasks documents at v0.1 are explicitly approved. The [application task index v0.1](./specs/001-toca-regalo/tasks.md) maps 54 tasks: two complete, 52 pending.
- Six image downloads, two tool builds and Composer/npm installations occurred under T2's explicit authorization. Application runtime/behavior remain unimplemented; no application services, browser downloads, key generation or database initialization occurred.
- 002:T2 completed on `feature/002_T02-lock-dependencies`, created from clean local `dev`. Manifests, lockfiles and immutable image digests are present; [dependency evidence](./specs/002-development-foundation/dependency-resolution.md) records checks and audit warnings. No task after T2 is authorized. Public review-only secret values remain unusable at runtime. No commit/push performed.

## Approval evidence

The original approvals below are explicit user statements from 2026-11-16; the T2 authorization is dated separately:

| Document/phase | Evidence | Approved scope |
| --- | --- | --- |
| [Constitution v1](./docs/constitution.md) | “apruebo la constitución”, after the English technical-document language amendment | Six project principles |
| Specification preparation | User authorized Specification from requirements/ER and necessary AGENTS/MEMORY changes | Source review and specification |
| Clarification | “Autorizo pasar a Clarificación” | QA findings, decisions and specification updates |
| Final clarification proposals | “Apruebo estas propuestas y continúa” | Six final decisions recorded as S13 in the parent specification |
| [Spec 001 v1.0](./specs/001-toca-regalo/spec.md) | “Apruebo la especificacion”, answering the request to approve v1.0 and enter Planning | Consolidated requirements and Plan preparation |
| [Plan 001 v0.1](./specs/001-toca-regalo/plan.md) | “Apruebo el plan” | Technical baseline and task decomposition |
| [Decomposition v0.1](./specs/001-toca-regalo/decomposition-proposal.md) | “Apruebo los bloques. Continúa” | Six organizational slices and preparation of derived specifications/plans/tasks |
| Derived 002–007 documents/tasks v0.1 and 002:T1 | “Apruebo y autorizo iniciar la T1 de spec 002” | Approves the complete derived-document/task package and execution of only 002:T1; no installation |
| 002:T2 preparation, 2026-11-17 | “Continúa con la siguiente tarea” | Start the next task and prepare manifests/download scope |
| 002:T2 installation, 2026-11-17 | “Autorizo todo” | Execute the presented concrete scope: six image downloads, two tool builds, Composer/npm packages and transitives/locks; excludes browsers, application services, database initialization and keys |

The approved child scope/task definitions remain unchanged; T2 and its authorized installation are complete. Historical clarification sources S4–S13, including superseded answers, remain in Spec 001; do not repeat their already resolved questions.

## Derived work and dependencies

| Block | Documents | Tasks | Prerequisite |
| --- | --- | --- | --- |
| 002 — Development foundation | [spec](./specs/002-development-foundation/spec.md), [plan](./specs/002-development-foundation/plan.md), [tasks](./specs/002-development-foundation/tasks.md) | 2 complete, 6 pending | None |
| 003 — Identity and account access | [spec](./specs/003-identity-access/spec.md), [plan](./specs/003-identity-access/plan.md), [tasks](./specs/003-identity-access/tasks.md) | 9 pending | 002:T8 |
| 004 — Groups and events | [spec](./specs/004-groups-events/spec.md), [plan](./specs/004-groups-events/plan.md), [tasks](./specs/004-groups-events/tasks.md) | 10 pending | 003:T9 |
| 005 — Confidential draw lifecycle | [spec](./specs/005-confidential-draws/spec.md), [plan](./specs/005-confidential-draws/plan.md), [tasks](./specs/005-confidential-draws/tasks.md) | 10 pending | 004:T10 |
| 006 — Notifications and private dashboard | [spec](./specs/006-notifications-dashboard/spec.md), [plan](./specs/006-notifications-dashboard/plan.md), [tasks](./specs/006-notifications-dashboard/tasks.md) | 9 pending | 005:T10 |
| 007 — Account deletion and verification | [spec](./specs/007-deletion-verification/spec.md), [plan](./specs/007-deletion-verification/plan.md), [tasks](./specs/007-deletion-verification/tasks.md) | 8 pending | 006:T9 |

All requirements/acceptance criteria are inherited without changes from the parent; child rows are verbatim excerpts. No IDs are renumbered and no requirement is fulfilled just because a supporting component exists. Parent traceability is in the task index; each child plan maps its requirements to tasks. Cross-block cases explicitly defer their full evidence to the completing blocks.

002:T1 prepares configuration/documents and static checks without downloads or installation. 002:T2 resolves dependencies/images/locks only after separate installation authorization. Tasks are sequential, not delegated/parallel-agent work, and each explicitly authorized task ends with a result and stop.

## Approved technical and product authority

- Refer to [Spec 001](./specs/001-toca-regalo/spec.md), not old conversation guesses, for the 35 FR and nine NFR, resolved questions, actors, language policy and scope exclusions.
- Refer to [Plan 001](./specs/001-toca-regalo/plan.md) for approved version families, independent domain/external mappings, same-origin session/CSRF APIs, real-MySQL tests, uniform shuffle/rejection, transaction coordination, key policy, Mailpit capture, deadline/notification state and verification profiles.
- The [bootstrap command reference review](./specs/001-toca-regalo/bootstrap-command-review.md) records supplied code and approved adaptations. Do not request the supplied code again or introduce account verification.
- Approved key design uses versioned Sodium authenticated envelopes and per-draw scoped HMAC references, with application-managed recipient SET NULL semantics rather than a plaintext recipient FK.
- SMTP templates are external per environment; development captures locally. Real SMTP host/port/security/authentication/sender values are deployment inputs. Credentials stay outside the repository/chat.
- All technical documents/code identifiers/comments are English; user-facing documentation and application text are Spanish.
- New package/image/browser installation outside T2's authorized scope still requires explicit authorization; no script may install implicitly. Plan/task approval does not supply that authorization.

## Sources and environment evidence

- The original requirements and scanned ER model were previously reviewed in the project root. On 2026-11-17, the final T2 source/link check found both originals absent from the current checkout (not deleted by T2); their historical root links in AGENTS remain unresolved. Approved specifications and plans remain available. Restore the originals before any work needing renewed source inspection.
- The scanned one-page ER was rendered and visually inspected using system Poppler; no dependencies were installed. ER attributes are ignored as explicitly requested; prose plus clarification governs.
- Original Nurschool/nursing context and Twig requirement were explicitly superseded. Do not infer product scope from them.
- Docker client/server 29.9.3 and Compose v5.7.1 were inspected read-only. The Docker version socket query required host approval and succeeded. No images were downloaded or containers created.
- Host PHP/Composer/Node/npm were not on PATH; Perl is available. Use the approved containerized toolchain after authorization rather than installing host runtimes.
- Primary documentation links supporting technical proposals are in the approved plan. Dependency resolution, runtime compatibility, migrations, application tests and production delivery remain unexecuted.

## Verification state

- 002:T2 completed with [dependency evidence](./specs/002-development-foundation/dependency-resolution.md): six images pinned; two tool builds; 117 locked PHP packages; final npm ci installed 145 packages. Composer manifest/platform/lock checks, executable versions, npm tree checks, JSON and Compose validations passed. All API Platform components use 4.2 and Symfony framework components use 7.4; no Twig. npm audit retains four moderate development entries (glob/minimatch via js-beautify/editorconfig); Composer audit reports abandoned doctrine/common, zero security advisories. npm production audit reports zero advisories. These audit warnings remain open; no application suite has run. Historical source/environment observations below describe their earlier dates, not a claim that T2 downloads never occurred.
- 002:T1 completed: [verification record](./specs/002-development-foundation/verification.md) contains exact static-check commands/results and runtime exclusions. Files: [development Compose](./compose.yaml), [test override](./compose.test.yaml), [environment template](./.env.example), [PHP Dockerfile](./docker/php/Dockerfile), [PHP settings](./docker/php/development.ini), [Node Dockerfile](./docker/node/Dockerfile), [Nginx config](./docker/nginx/default.conf), [Docker ignores](./.dockerignore), updated [Git ignores](./.gitignore), and [Spanish README](./README.md).
- Both Compose config validations exited 0. Parsed JSON model inspection passed for seven services, loopback-only Nginx/Mailpit publications, pull_policy never, no installation/download startup commands, proper API/worker environments, and distinct development/test project/database volume/URL/key file.
- Test validation explicitly uses --project-name tocaregalo-test because COMPOSE_PROJECT_NAME in a shared environment file can otherwise override top-level project names. Runtime test wrappers must retain this separation.
- Git ignore checks passed for seven sample secret/dependency/runtime paths and confirmed .env.example remains visible. New-file whitespace checks and git diff --check passed; editor diagnostics reported no errors in targeted configs/README. Native Nginx/PHP/image/runtime validation remains pending.
- Configuration-only T1 uses actual static/manual checks, not artificial behavioral tests. No application acceptance is claimed fulfilled; NFR-1/2/3/4/5/7 are supported by reviewable configuration only.

- Clarification QA and source-to-requirement review are documented in the [clarification review](./specs/001-toca-regalo/clarification-review.md).
- Prior structural checks verified 35 FR with matching AC, nine NFR and parent plan coverage, local Markdown targets, and documentation whitespace. These are document checks, not application validation.
- Derived-document verification passed using a read-only Perl check: six blocks and 18 child documents; 54 pending tasks with counts 8/9/10/10/9/8; copied FR/NFR/AC excerpts match the parent verbatim; all 44 requirements map to tasks; dependencies exist and are acyclic; no task is checked complete; local Markdown targets exist. `git diff --check` also passed. These results verify documentation structure and coverage only, not application behavior.
- No application test has run and no application requirement is reported fulfilled; configuration task 002:T1 and dependency task 002:T2 are complete. No code-coverage percentage was approved.

## Next authorized step

Request authorization for 002:T3: minimal Symfony/API Platform JSON runtime and real MySQL boundary. Stop after T2; do not start T3 or merge/commit/push automatically. Browser binaries, secrets and later tasks are not authorized by T2's installation approval. Record open dependency audit warnings in subsequent verification rather than claiming a clean audit.

Preserve existing approvals. Requirement or material plan changes follow SDD Change; do not restart Clarification or select new product behavior silently. Final read-only Validation and user acceptance remain separate future phases.
