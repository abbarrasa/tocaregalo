# 003:T1 — Lastname naming revision execution plan

Revision: v0.1
Status: executed; naming refactor and bounded checks complete
Approval: User stated "apruebo el plan y autorizo la implementación", 2026-11-18, approving v0.1 including its bounded checks.
Date: 2026-11-18
Request: “Cambia surnames por lastname”, referencing UserProfile.php.
Baseline: completed 003:T1, parent Spec 001 v1.2, Plan 003 v0.3 and task list v0.3. This is an identifier refactor, with no product requirement change.

## Scope and files

Rename the PHP property, constructor/validator parameters and pure normalizer from `surnames` to exactly `lastname`. Update UserProfile, UserValues, UserInputValidator, UserRecord, DoctrineUserRepository and their unit/integration references. Update the external ORM mapping field to `lastname` with explicit `column="surnames"`, preserving the existing database column and migration. English prose may continue using the ordinary word surnames; no global prose replacement.

## Sequence and checks

1. Preserve existing local modifications and branch. This resumes T1 naming work on feature/003_T01-user-values-persistence, not a new product task or T2.
2. Update behavior-preserving test references and all production PHP consumers together; do not introduce a failing test solely for identifier spelling.
3. Update the external field mapping while retaining the SQL column. Check for stale PHP references and syntax/configuration errors.
4. Run existing unit/integration backend regressions with the approved guarded temporary MySQL harness, including real migration/ORM parity and nullable surname roundtrip. Run full-scope PHPStan fixed level 10 with zero errors, no baseline.
5. Confirm cleanup, unchanged migrations/manifests/locks and ignored private dotenv. Record actual evidence and updated task/memory boundary; stop before T2.

## Runtime and limits

Reuse installed images and existing scripts/check backend and scripts/check phpstan. Runtime scope is the existing owned tmpfs tocaregalo-test database and PHP check containers only. No installations, image pull/build, real development database changes, real account, keys, SMTP, commit, push or branch switch. If a database-column rename is desired, that requires a separately reviewed migration scope and is not included here.

## Approval requested

Approve this plan and authorize the naming refactor plus its bounded temporary-MySQL checks. T1 remains complete for the previous snapshot; its evidence does not automatically validate changed identifiers/mapping. No implementation occurs during this proposal.
