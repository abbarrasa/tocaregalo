# 003:T1 — LastName casing execution plan

Revision: v0.1
Status: executed; casing correction and bounded checks complete
Approval: "aprueblo el plan y su implementación", 2026-11-18, approves v0.1 and its bounded checks.
Date: 2026-11-18
Request: “Cambia lastname por lastName”.
Baseline: completed T1 naming revision; parent Spec 001 v1.2, Plan 003 v0.3 and task list v0.3. Identifier-only correction; no product requirement change.

## Scope and sequence

1. Preserve feature/003_T01-user-values-persistence and all pre-existing edits; no branch switch.
2. Rename `lastname` to exactly `lastName` in UserProfile and UserRecord properties, constructor/validator parameters, UserValues normalizer, DoctrineUserRepository and existing unit/integration consumers. Update external UserRecord XML field name, retaining `column="surnames"` and the unchanged migration.
3. Inspect stale references and run existing behavioral regressions, not tests for identifier spelling. Execute `scripts/check backend` with guarded owned tmpfs MySQL, verifying mapping/schema parity and nullable lastName persistence; run syntax/container/YAML checks and `scripts/check phpstan` at fixed level 10, zero errors without baseline.
4. Confirm cleanup and unchanged dependencies/migrations/private dotenv, record actual results in verification/tasks/MEMORY/AGENTS, then stop before T2. Existing evidence remains historical for the previous snapshot.

## Runtime and limits

Reuse installed images and existing tocaregalo-test isolated harness only. No installation, image pull/build, development database change, real account, SMTP, keys, commit or push. No schema-column rename or behavior change. No new task IDs; completion counts unchanged.

## Approval requested

Approve this execution plan and authorize the casing correction plus its bounded temporary-MySQL and static checks. No code or runtime changes during planning.
