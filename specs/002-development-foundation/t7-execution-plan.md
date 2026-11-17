# 002:T7 — Execution plan

Revision: v0.1
Status: approved; implemented and checked under this task scope
Approval: “Apruebo el plan y autorizo su implementación”, 2026-11-17; includes the stated bounded runtime checks, no installations.
Date: 2026-11-17
Planning authorization: “Continúa con la siguiente tarea”, following T6 completion. Per the user's per-task rule this authorizes preparation/presentation only.
Authority: [Spec 002 v0.2](./spec.md), [Plan 002 v0.2](./plan.md), [T7](./tasks.md), [parent development/verification design](../001-toca-regalo/plan.md), completed [T6 evidence](./verification.md#t6-completion).

## Outcome and boundaries

Expose the approved development/check operations through reproducible container wrappers and VS Code tasks. Add consistent editor settings, Spanish user-facing setup notes and English technical operations documentation. Support NFR-3/5/7/8/10; no new product flow or claim that the complete environment/business application is ready.

No new package, image download/build, browser install, host runtime, formatter/linter dependency, schema/business command, account, assignment key, real SMTP delivery, deployment or CI change. Reuse installed/pinned tools and T5/T6 isolation. Complete environment verification remains T8. Do not implement missing commands just to make a wrapper report success.

After explicit approval, inspect Git status and create `feature/002_T07-developer-check-commands` from current local dev, preserving edits. Stop on unsafe switching. No commit, push, merge, stash, reset or restore.

## Files and responsibilities

| Files | Responsibility |
| --- | --- |
| `scripts/dev` | POSIX shell allowlisted development operations, stable root resolution, existing Compose delegation and honest missing-prerequisite failures. |
| `scripts/check` | Focused verification commands and aggregate selection; exact nonzero exit propagation and test-project ownership/cleanup safeguards. |
| `scripts/lib/common.sh`, if warranted | Small shared argument/root/tool/preflight helpers; never evaluate/source private dotenv content as shell. |
| `tests/scripts/` | Focused command-boundary tests using a controlled Docker CLI recorder, proving routing, quoting, refusal and failure propagation without modifying real user data. |
| `.vscode/tasks.json` | Technical English labels, explicit repository cwd and wrapper invocations; no host PHP/Node assumption, secrets or auto-run on folder open. |
| `.editorconfig` | UTF-8/LF/final newline and existing per-family indentation conventions; no repository-wide reformat or plugin install. |
| `README.md` | Spanish entrypoints/prerequisites, current usable checks, expected shell, ports and clear incomplete operations. |
| `docs/development.md` | English command map, isolation/lifecycle, worker restart/signal/closure limits, SMTP and key/backup policy references. |
| `compose.yaml`, only if required for shared dotenv consistency | Minimal read-only root .env bind for the shared PHP service, matching the already approved Symfony source contract and T6 workers. No unrelated service/image/port redesign. |
| Task/verification/memory documents | Approval, exact checks/results/limits, next authorized task. |

Keep Composer/npm manifests/locks and runtime business code unchanged. Choose small shared helpers only where duplication warrants them; no command framework or additional tooling.

## Proposed command contract

### Development wrapper

| Operation | Behavior |
| --- | --- |
| `scripts/dev --help` | Spanish usage/limits; no daemon access or side effect. |
| `scripts/dev build` | Compile frontend assets using the existing Node image and installed dependencies. This is not an image build and cannot run npm install/ci or apt/Composer install. |
| `scripts/dev up` | Start the selected existing development services with no build/pull/install; workers remain opt-in, never started implicitly. Validate environment/required local inputs first. |
| `scripts/dev down` | Stop/remove only the explicitly selected development project; no volume deletion or unrelated project action. |
| `scripts/dev migrate` | Delegate only the approved Symfony migration command when available and explicitly requested by the operator. No migration generation/schema update/database reset; no automatic execution on startup/check. |
| `scripts/dev create-super-admin` | Delegate the future approved interactive command, preserving TTY/password privacy; never supply credentials through task arguments, environment snapshots or logs. |

Migration/bootstrap adapters are currently unavailable/incomplete. Their wrapper paths must fail clearly/nonzero when prerequisites or commands are absent. Test routing with a CLI recorder and read-only command discovery, not by creating real accounts/migrations in T7. The key-dependent full stack may remain blocked; do not generate keys, dummy keys, or fake application commands to bypass it. Document the precise missing prerequisite and future owner task.

No arbitrary shell execution, eval, shell sourcing of .env, implicit workers, Docker image build or dependency installation command. Resolve project paths safely when invoked from another cwd or a path containing spaces. Quote individual arguments; permit documented test selectors, not user overrides of Compose project/files/volumes/DSNs. Unknown commands fail before invoking Docker.

### Check wrapper

| Selection | Intended tools/scope |
| --- | --- |
| `scripts/check --help` | Usage with no daemon access or side effects. |
| `scripts/check static` | Available shell/JSON/Compose/ignore/whitespace checks; validate VS Code task mappings without executing business commands. |
| `scripts/check phpstan` | Existing PHP tool, fixed level 10 over all owned PHP/tests; no private values printed and no concealing baseline. |
| `scripts/check backend [focused selector]` | T5 isolated MySQL/PHP harness excluding optional mail group. Preserve actual PHPUnit failures/fail-on-empty semantics. |
| `scripts/check mail [focused selector]` | T6 local Mailpit/MySQL fixture harness; guarded temporary transport setup only and no external SMTP. |
| `scripts/check frontend [focused selector]` | Existing Vitest component/API boundary suite. |
| `scripts/check build` | Frontend production compilation with installed toolchain. |
| `scripts/check e2e [project/test selector]` | Existing T5 four-project Playwright configuration; retain same-origin API and test-only networking. |
| `scripts/check all` (also default) | Explicit ordered aggregate of these selections; stop on first failure with scoped cleanup. Full aggregate execution is T8 evidence unless new failures require broader T7 checks. |

State return codes honestly: missing dependencies/images/parameters and failed/empty suites cannot become success. Never include dependency install, image build/pull, volume reset, ignored test failure or silent test skipping. Existing T5 mail-group exclusion is explicit because that stack has no Mailpit; mail selection executes the separate capture suite.

For test selections that own services, use explicit `tocaregalo-test` and the intended standalone Compose file. Refuse an existing project/network or occupied configured port rather than silently adopt/replace it. Start only relevant services, keep MySQL tmpfs/internal and Mailpit SMTP internal, and trap success/failure/interruption cleanup for only the stack created by this invocation. Never delete volumes or reset development data. Do not tear down a project the wrapper did not start. Read-only/Node-only selections must not create a database stack unnecessarily.

## VS Code and editor behavior

Tasks call wrappers from repository root with English labels such as `Toca Regalo: PHPStan`, `Backend tests`, `Frontend tests`, `Browser tests`, `Mail capture tests` and `Frontend build`, plus documented development actions. Do not automatically start services/install anything when a workspace opens. Avoid fake problem matchers; use only appropriate real output mappings. No destructive reset task or embedded SMTP/password/key input. Newly created tasks are configuration, not evidence that a VS Code task has run.

Editor settings preserve existing family conventions (four spaces for PHP/backend YAML, two for frontend/Compose JSON/YAML, existing Composer indentation where applicable). UTF-8, LF, final newline and trailing-space rules are explicit. No mass reformat, editor extension install or automatic code modification.

## Documentation responsibilities

README remains Spanish; technical docs, comments, task labels and identifiers stay English. Document existing root .env/private mode and no-secret-in-Git rules, local ports/services, installed-tool prerequisites, common missing-tool/port/parameter failures and cleanup. Explain what currently appears in the browser and which operations are still unavailable.

Reference the approved versioned Sodium/scoped-HMAC key policy and backup/restoration requirements without inventing an unimplemented key-file schema, executable generator or production secret store. Assignment-key provisioning remains separately authorized; existing key-dependent services may fail preflight until material is supplied. Describe future worker restart after code changes, SIGTERM/143 observations and the current lack of proven graceful in-flight completion. Real event closure is 004:T8; fixture probes do not meet its deadline guarantee.

Document external deployment SMTP fields (host/port/TLS/auth/sender), local-only Mailpit test delivery and the absence of external email verification. Do not request production SMTP credentials for this documentation task. Keep audit/license warnings visible.

## Implementation and verification after approval

1. Write focused wrapper-boundary tests first: unknown command/missing prerequisite refusal, root/path quoting, fixed test project and exact delegated args, no install/pull/volume-reset flags, exit-code preservation and cleanup ownership on failure. Use a controlled fake Docker executable only to observe orchestration, never as proof of real runtime success. Demonstrate intended missing-wrapper failures.
2. Implement minimal POSIX wrappers/shared helpers, executable modes and task/editor configuration. Preserve private dotenv as data. Apply only the named PHP root-env consistency bind if needed; record it explicitly.
3. Validate shell syntax, JSON/task references, editor conventions, Markdown links and secret ignores. Review every command path for installation or destructive operations and ensure no daemon call for help/invalid commands. Verify unavailable migration/bootstrap/key paths are honest failures, with no real business mutation.
4. Exercise real focused delegated operations with installed images: static checks, PHPStan, frontend tests/build, a T5 backend check and Chromium desktop browser smoke if needed to verify its orchestration. Other projects/mail selections can have recorder evidence where their underlying unchanged harnesses already passed; explicitly report which paths were not rerun live. No full development startup or business mutation needed for T7; reserve complete setup for T8.
5. Run PHPStan after implementation even with no PHP source change; fixed level 10, zero errors, full owned-PHP/test scope. Rerun only checks affected by new failures/changes. Record actual wrapper outputs/results, task-launch evidence and any unavailable UI execution honestly.
6. Verify cleanup/private environment/dependency locks/diff, update task/memory only after done conditions pass, present the result and stop. T8 requires its own execution plan and authorization.

## Bounded runtime scope requested

After approval use existing PHP/Node/MySQL/Nginx/Playwright images only. Focused backend/browser wrapper checks may start the T5 `tocaregalo-test` temporary project with existing test URL and loopback HTTP port (8081 default). Check actual availability/project identity first and clean up only owned containers/network without volume deletion. No real accounts, schemas beyond existing harness fixtures, production SMTP, key creation or full key-dependent development stack.

No package install, image pull/build or browser download is requested. Missing tools/images/parameters are surfaced, not supplied silently; ask for genuinely missing user inputs. The guarded mail wrapper is exposed and tested for delegation but T6 capture need not be rerun unless its orchestration changes justify it. Existing approved runtime helpers may be reused; do not restart unrelated services.

## Completion and approval record

NFR-3: wrappers delegate to intended existing container toolchain and selected live checks pass. NFR-5: language policy and documentation checked. NFR-7: SMTP/key/private-input documentation remains external and local capture boundaries explicit. NFR-8: understandable Spanish usage/errors and setup information, no invented UI flow. NFR-10: actual final zero-error level-10 analysis. Record file/task resolution, negative-path evidence, runtime limits and remaining app incompleteness in verification.md.

Approved by “Apruebo el plan y autorizo su implementación”, 2026-11-17. Implementation evidence is recorded in verification.md#t7-completion. This planning step changes documentation only on current dev; no branch switch, script/config implementation, service startup, installation or business command execution.
