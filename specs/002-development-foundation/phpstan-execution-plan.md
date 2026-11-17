# PHPStan quality gate — Execution plan

Revision: v0.1
Status: approved; authorized 002:T9 execution complete
Approval: “Apruebo estas revisiones y autorizo actualizar las tareas”, 2026-11-17. This approves the displayed plan, not its package installation or task execution.
Execution and installation authorization: “Apruebo las listas de tareas y autorizo el inicio de 002:T9 y las instalaciones”, 2026-11-17. Scope: four listed dev packages (^2.0) and required transitives only.
Date: 2026-11-17
Authority: [Spec 001 v1.1, NFR-10](../001-toca-regalo/spec.md), approved by “Apruebo la especificación y autorizo actualizar los planes”. This statement authorizes preparing plans only.

## Outcome and sequencing

Establish the required PHPStan check before closing T4: fixed level 10, all project-owned PHP including tests, zero errors without hiding findings in a baseline. Run it after every subsequent implementation task. Prior T1–T3 evidence remains historical under its original approved scope; initial analysis covers the current backend, but no defects or passing result are presumed.

The proposed Tasks update assigns 002:T9 to this enabling work after T3 and before T4, preserving existing IDs. Block 002 now proposes nine tasks, within the ten-task limit; the revised task list and T9 execution await approval. Do not combine potentially substantial initial PHP corrections silently with the already approved frontend work.

After task authorization, start its branch from current local dev using the assigned feature/task ID; inspect status first, preserve existing edits, and stop on unsafe switching. No merge/stash/commit/push.

## Concrete installation scope for later explicit authorization

Add these development requirements to backend Composer, with stable compatible releases resolved and locked using the existing PHP 8.5 tool image:

| Package | Constraint | Responsibility |
| --- | --- | --- |
| `phpstan/phpstan` | `^2.0` | Static analysis engine; configure fixed numeric level 10, not moving `max`. |
| `phpstan/phpstan-symfony` | `^2.0` | Symfony/container type understanding. |
| `phpstan/phpstan-doctrine` | `^2.0` | Doctrine repository/ORM/DBAL type understanding. |
| `phpstan/phpstan-phpunit` | `^2.0` | Assertions and test-specific type understanding. |

Include only required transitive dependencies. Preserve Symfony 7.4/API Platform 4.2/Doctrine/PHPUnit families and Twig conflicts. Use a targeted Composer resolution without platform/advisory bypasses or broad updates; surface incompatibilities. Record the actual lock diff, versions, audits and warnings. No PHPStan extension-installer plugin, strict-rules package, bleeding-edge rules, host tool, PHP image rebuild, browser download or application dependency is included. Load extensions explicitly from configuration; Composer scripts remain disabled during resolution. No package installation is authorized by this plan's preparation or by the earlier Playwright approval.

Upstream evidence consulted read-only on 2026-11-17: [PHPStan levels](https://phpstan.org/user-guide/rule-levels), [installation and analysis scope](https://phpstan.org/user-guide/getting-started), and major-2 manifests for [Symfony](https://raw.githubusercontent.com/phpstan/phpstan-symfony/2.0.x/composer.json), [Doctrine](https://raw.githubusercontent.com/phpstan/phpstan-doctrine/2.0.x/composer.json), [PHPUnit](https://raw.githubusercontent.com/phpstan/phpstan-phpunit/2.0.x/composer.json). These describe intended integrations and constraints, not a successful project resolution.

## Planned files and responsibilities

| Planned file | Responsibility |
| --- | --- |
| `backend/composer.json`, `backend/composer.lock` | Explicit approved dev requirements, deterministic lock, named analysis command. |
| `backend/phpstan.neon.dist` | Level 10; explicit src/tests/config/public/bin/console PHP scope; manual extension includes; ignored cache under backend/var. Vendor/generated files provide symbols, not analysis targets. |
| `backend/tests/StaticAnalysis/bootstrap.php`, optional container metadata helper | Isolated analysis support where the extensions require it. Never connect a database, send mail, read/print production secrets or execute public/console entrypoints as bootstrap side effects. Any container metadata is generated under ignored backend/var using inert analysis-only inputs, not the private .env. |
| Existing project-owned PHP files | Only verified type/correctness findings: precise signatures/PHPDoc shapes/generics/guards and necessary minimal corrections, preserving approved behavior. No vendor patching, scope exclusion or baseline to hide findings. |
| `README.md`, `specs/002-development-foundation/verification.md`, governance documents | Spanish command notes, actual run evidence and per-task completion rule. General developer wrappers/VS Code tasks remain T7. |

## Execution and checks after approvals

1. Review the targeted dependency/configuration diff, obtain installation authorization, install using the existing container and record resolution/audit results. Missing tool is an environment prerequisite, not an intentional failing application test.
2. Configure level 10 and explicit owned-code paths. Read existing tests/runtime conventions; analysis must include tests and must not execute the private environment or business entrypoints.
3. Run analysis on the current PHP. Record actual initial findings, then make only justified corrections in the assigned scope. For a runtime behavior correction, first demonstrate the defect with an appropriate focused test; for type-only corrections, review types and rerun relevant existing checks. Surface a material behavior/requirement gap instead of fixing it silently.
4. Run `vendor/bin/phpstan analyse --configuration=phpstan.neon.dist --no-progress` from backend inside the existing PHP tool image. Require exit 0 and zero errors. Confirm configured scope includes all owned PHP paths and no hiding baseline; do not weaken level or omit failing project files.
5. Recheck PHP syntax, Symfony container/configuration and T3 JSON/MySQL boundary as applicable to modified runtime files; reuse the approved isolated tmpfs procedure, keeping .env private and cleaning up only its dedicated containers/network. Record any unexecuted required check as blocked.
6. Record package/configuration versions, analysis results, actual fixes, audit limits and regressions. Update the assigned task/memory only when done conditions pass, present the result and stop. T4 remains separately gated by its updated execution plan and prerequisite check.

## Alternatives and limits

Fixed level 10 implements the user's confirmed threshold; `max` could tighten automatically on upgrades. An analyzer without the relevant framework/test extensions gives less precise understanding of existing boundaries; manually included extensions avoid introducing an auto-install Composer plugin. A baseline or reduced level would conceal unmet NFR-10 and is not permitted. Static analysis complements runtime tests and does not prove functional correctness or remove T2 audit warnings.

No code, manifest, configuration, installation or analysis has been performed during this planning step. Approval of this plan must precede task-list changes; task execution and concrete installation require their own explicit authorizations.

## Execution outcome

002:T9 completed on 2026-11-17 after explicit task-list, start and installation approval recorded above. [T9 evidence](./verification.md#t9-completion) supersedes planning-time pending statements: four installs, initial 14 findings, final level-10 zero-error analysis and runtime regressions passed; audit/license warnings recorded. No T4 execution, commit or push.
