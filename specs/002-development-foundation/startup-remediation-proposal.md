# Main development startup — remediation proposal

Revision: v0.1
Status: technical direction approved; downstream revisions pending approval
Approval: “apruebo la propuesta y autorizo preparar las revisiones”, 2026-11-17. Authorizes document preparation only.
Date: 2026-11-17
Requested by: “prepara un plan para resolver el requisito del arranque”.
Baseline: approved [Spec 002 v0.2](./spec.md), [Plan 002 v0.2](./plan.md), parent [Plan 001 v0.2](../001-toca-regalo/plan.md), [T8 evidence](./verification.md#t8-execution-record), INCOMPLETE Validation recorded in [memory](../../MEMORY.md).

## Diagnosis and proposed decision

The base PHP service unconditionally mounts an assignment-key secret and `scripts/dev up` unconditionally requires its file. No current production service reads that key: recipient encryption is future block 005 work. The unrelated development shell/API/database startup is therefore blocked by an input that cannot yet be meaningfully validated or used.

Propose deferring the cryptographic secret dependency to the slice that implements its consumer. Make the current main development model start without assignment keys. Preserve the approved encryption/key policy: when encryption is implemented, its API/worker/operational consumers must receive the real read-only key ring and fail closed on missing/invalid material before any protected operation. Do not generate placeholder keys or choose the future ring schema during foundation remediation.

This is a proposed technical-plan correction under unchanged NFR-3, not an approved decision or a requirement reduction. No specification revision is proposed. Keep all FR/NFR/AC identifiers. Full product acceptance, encryption, notification business behavior, and closure remain in their original slices.

Rejected alternative: generate a key file now solely to satisfy Docker. This would force a ring schema and custody/backup operation before its consumer exists and would not prove encryption readiness. A temporary dummy file is also excluded. A separately approved future key-provisioning task remains necessary.

## Approval sequence and downstream impact

1. Obtain approval of this technical direction and authorization to revise affected plans and prepare the corrective task.
2. Present exact plan revisions: parent operational/key-mount sequencing, child 002 startup verification, child 005 consumer/provisioning prerequisite. Preserve the substantive encryption/key/backup policy and all prior evidence. Obtain approval of those revisions before implementation.
3. Add proposed **002:T10 — Remove premature key dependency and verify main startup** (tenth local task, preserving T1–T9 IDs). Present the updated task list and task-specific execution plan; obtain explicit task/runtime authorization. Earlier completed tasks retain historical results; T7 startup behavior and T8 main-stack evidence require reassessment after correction.
4. Implement only the approved correction, then repeat applicable read-only Validation under separate authorization. Do not mark the specification implemented or start block 003 on the strength of this proposal.

Current authorization covers preparation of this proposal only. No approved plan/task list, configuration, script, dependency, secret or branch is changed by preparing it.

## Proposed implementation files and responsibilities

| File | Bounded change after approvals |
| --- | --- |
| `compose.yaml` | Remove the unused assignment-key mount/declaration/environment wiring from the current foundation runtime; preserve service names, shared dotenv, image pins, ports and DB volumes. |
| `compose.test.yaml` | Remove corresponding premature test-key declaration from the overlay; preserve explicit test project/database/port separation. |
| `scripts/dev` | Replace unconditional assignment-key preflight with prerequisites actually needed by the current main runtime. No key bypass in future cryptographic operations. |
| `tests/scripts/` | Test startup routing without key material, no implicit workers/install/build/pull, honest missing-input/tool/startup failures and exit propagation. |
| `README.md`, `docs/development.md`, `.env.example` if its comments need adjustment | Explain current startup and deferred key provisioning accurately; retain future key-path placeholders only with clear future-scope wording. Never edit private dotenv values. |
| Verification/governance records | Actual commands/results, applicability of old evidence, task state and review boundary. |

No new optional cryptographic overlay, key-file schema, generator, rotation implementation or package is selected here. Those remain with the consumer's approved task. Future block 005 must explicitly restore the mandatory secret mount/preflight as an implementation prerequisite, before claiming encryption functionality complete.

## Proposed execution and runtime checks

- Start implementation from then-current local dev on `feature/002_T10-main-startup-prerequisites`, after status inspection and only once approved changes are present there. Preserve all existing local edits; if switching would lose work or the prerequisite revisions are absent from dev, stop and report the exact condition. Never commit/merge/stash/reset/push implicitly.
- Write focused wrapper/configuration tests first and demonstrate the current premature prerequisite failure using isolated fixtures. Implement the smallest approved correction. Validate the main and overlay models and protected secret ignores. No test installs tools.
- Run the exact main `compose.yaml` through `scripts/dev up` with existing images/private parameters, workers disabled. Verify MySQL healthy, frontend/PHP/Nginx running, Spanish shell at the main HTTP endpoint, JSON API responses and private-path protection. Check backend real DB connection read-only. Missing business migrations are not substituted with automatic schema updates.
- Refuse existing development containers/network/volume and occupied configured ports before owning a verification runtime. Do not start MySQL against an existing data volume. Use a temporary, explicitly reviewed Compose override that changes only MySQL storage to tmpfs while keeping the main service graph, images and environment; keep its purpose explicit in evidence. If testing `scripts/dev up` requires an additional allowlisted verification mode or fixture configuration, include its exact interface in the task-specific plan before authorization; never silently use arbitrary Compose argument overrides.
- The verification must demonstrate the main startup path, not merely repeat T5 standalone tests. If the temporary override would bypass a prerequisite or materially change service behavior beyond storage/loopback verification ports, stop and revise the plan.
- Run focused frontend/API browser smoke and wrapper negative checks, then PHPStan fixed level 10 on the full owned-PHP scope with zero errors/no baseline. Reuse unchanged T8 suites unless a change/failure justifies rerunning them.
- Remove only invocation-owned containers/network and temporary override; never delete volumes or alter private credentials. No accounts, business migrations, workers, keys, external SMTP, image/dependency operations or deployment.

## Completion conditions

1. The approved main startup path no longer requires an unused encryption key file.
2. Main-graph runtime evidence demonstrates Nginx/SPA/API/MySQL with current prerequisites and explicitly documented temporary storage isolation.
3. Encryption and destructive-operation policies remain unchanged; future block 005 has an explicit mandatory provisioning/mount/fail-closed prerequisite.
4. Focused checks and final level-10 analysis pass; owned resources are removed, dependency locks and private dotenv unchanged.
5. Read-only Validation reassesses NFR-3 against the corrected scope. Product-only criteria remain deferred; no full-application fulfillment claim.

## Next requested approval

Approve proposal v0.1's technical direction and authorize preparation of the affected plan revisions and corrective task. This approval does not authorize implementation, runtime startup, package installation or secret generation. Exact verification override/interface and revised task execution plan must be presented before implementation authorization.
