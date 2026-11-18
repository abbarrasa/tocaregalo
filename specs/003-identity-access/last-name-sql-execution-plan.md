# 003:T1 — LastName SQL alignment execution plan

Revision: v0.1
Status: executed; SQL alignment and bounded checks complete
Approval: "Apruebo el plan y la implementación", 2026-11-18, approves v0.1 including bounded checks.
Date: 2026-11-18
Request: “Cambialo también en la migración y el resto de referencias que falten”.
Baseline: completed lastName PHP casing revision; initial identity migration has been executed only against disposable test databases in recorded work. No development schema migration authorized or claimed.

## Scope and sequence

1. Preserve current branch feature/003_T01-user-values-persistence and all existing changes. This resumes T1 alignment; no T2.
2. Change initial migration users column from surnames to exactly lastName. Change external UserRecord mapping to explicit column="lastName". Keep optionality/default VARCHAR(255) and all other schema behavior unchanged. Current source/test/config search found no other old identifiers.
3. Inspect all owned source/config/test/document references. Update current technical naming guidance and completion records as necessary; preserve historical evidence, approval quotes and ordinary English prose using surnames. Do not rewrite product requirements merely to rename an implementation identifier.
4. Reuse existing backend tests with guarded owned tmpfs MySQL, actual migration reversal and ORM/schema parity; inspect generated column name and verify nullable persistence. Run PHP syntax/configuration checks and full-scope PHPStan level 10 with zero errors, no baseline.
5. Confirm temporary-resource cleanup, unchanged dependencies/private dotenv and record actual evidence in verification/tasks/MEMORY/AGENTS. Counts unchanged; stop before T2.

## Data and runtime boundary

Modify only the existing unpublished initial migration, per the explicit user request and recorded test-only execution history. No existing persistent database is altered, no corrective ALTER is executed and no data is discarded. Existing databases created independently with the former column are not migrated by editing this file; report that limitation rather than claim upgrade support.

Use installed images and existing tocaregalo-test harness only. No package/image install/build/pull, development DDL/accounts, keys, SMTP, commit/push or branch switch. Reuse existing behavioral/schema tests; do not create tests solely to mirror identifier spelling.

## Approval requested

Approve the SQL alignment plan and authorize implementation and bounded temporary-MySQL checks. This supersedes earlier naming plans' decision to retain the SQL surnames column, without invalidating their historical evidence. No code/schema/runtime change during planning.
