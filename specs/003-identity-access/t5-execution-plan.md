# 003:T5 — Recovery token lifecycle

Revision: v0.1
Status: complete; approved implementation and bounded checks executed
Approval: “Apruebo el plan y autorizo su implementación”, 2026-11-18.
Date: 2026-11-18
Preparation authority: “Continúa con la siguiente tarea”.
Baseline: approved Spec 001 v1.2 / Plan 001 v0.4 and derived Spec/Plan/Tasks 003 v0.3. T1–T4 complete. Local dev is clean at 7be25d5a21c7d4c77217b96520cada05ee675457 before preparation.

## Scope and outcome

Implement the internal issuance and consumption lifecycle supporting FR-28/AC-28 and recovery's FR-4/AC-4 password policy, with NFR-10 as completion gate. A current unused token permits one password reset strictly before its stored expiry. A newly issued token supersedes earlier requests for that account. Invalid, expired, superseded or consumed tokens cannot mutate the password.

This is the backend lifecycle task. Recovery/reset HTTP adapters, public response contracts, emailed URL generation and actual delivery are integrated with T6; Vue forms remain T7. Do not expose a temporary token-returning HTTP endpoint or claim emailed-link acceptance from internal fixtures. No public registration, account verification, role changes, new session invalidation policy or current-password requirement.

## Proposed design

- Generate 32 cryptographically random bytes with random_bytes and encode as URL-safe text. Persist only a SHA-256 token digest, never the raw bearer token. High entropy permits fast digest lookup without password hashing. Keep raw material only in sensitive in-memory issuance output for the future mail handoff and private test fixtures; never log, serialize into queues, or return it through API JSON.
- Add password_reset_requests with primary key, user FK (cascade on account deletion), unique token digest, issued/expires timestamps and nullable consumed/superseded timestamps. Use a new explicit reversible migration and external mapping if an ORM record is introduced. Preserve existing migrations and user schema.
- Use an injectable application clock with a production system-clock adapter and a deterministic test clock. Read PASSWORD_RESET_TTL_SECONDS through service configuration, default 3600 as already documented. Require a positive integer and fail configuration clearly on invalid values. Capture the configured duration into each issued request's expiry; later configuration changes affect only new requests. Compare instants, with now >= expiry rejected.
- Application issuance accepts a trusted existing account ID and returns a sensitive issuance result for internal handoff. Public identifier lookup/non-disclosure and durable mail integration remain T6, without prematurely defining a public response. No raw token column, recoverable plaintext fallback or premature key requirement.
- Serialize issuance and reset on the account row, then its reset records in consistent order. Issuance supersedes earlier requests and inserts the new digest in one transaction. Reset resolves the digest, locks the account and rechecks the current request under the lock, validates the shared exact password policy, hashes with Symfony, and updates password plus consumption atomically. Preserve identity/profile/roles. Failure rolls back both writes; validation failure leaves the request usable until its ordinary expiry or supersession.
- Reject malformed/unknown tokens and inactive requests through a credential-free application error suitable for later Spanish API mapping. No raw token in exceptions, command arguments, fixtures' process output or SQL diagnostics. Concurrent consumption permits exactly one success. Serialize competing issuance/reset so the committed result agrees with current-token and one-use rules.

Rejected alternative: returning a token through a provisional HTTP endpoint would violate the approved email-only exposure boundary. Password-style hashing of high-entropy tokens adds cost and complicates indexed lookup without improving the bearer token's entropy. Use existing dependencies and native cryptography, with no package installation.

## Files and responsibilities

| Paths | Planned work |
| --- | --- |
| backend/src/Application/Recovery/ and Application/Port/ | Issuance/reset use cases, sensitive result, lifecycle errors, clock and transactional persistence boundaries. |
| backend/src/Domain/User/ | Reuse existing PasswordPolicy; add only framework-independent lifecycle decisions if useful. |
| backend/src/Infrastructure/Doctrine/ and config/doctrine/ | Atomic reset request storage/locking, hash-only lookup and optional external ORM mapping. |
| backend/src/Infrastructure/ and config/services.yaml | System clock adapter, service aliases and TTL binding; reuse SymfonyPasswordService. |
| backend/migrations/ | One new explicit MySQL migration, up/down and FK/index constraints. No development auto-migration. |
| backend/tests/Unit/, Integration/ and Fixtures/ as needed | Controlled clock, guarded MySQL rollback/concurrency, native login after reset and regression evidence. |
| docs/development.md and README.md | Technical lifecycle/TTL and Spanish current-scope instructions, with email/UI limits. |
| verification.md, tasks.md, parent task index, MEMORY.md, AGENTS.md | Approval, actual check evidence, T5 completion and stop-before-T6 boundary. |

## Execution sequence and verification

1. After approval inspect git status and create feature/003_T05_recovery-token-lifecycle from then-current local dev, preserving planning edits. Stop on unsafe switching; no reset/restore/stash/commit/push.
2. Write behavioral tests first; record failure caused by missing lifecycle behavior. Use deterministic clock inputs, not timing sleeps, for expiry tests.
3. Implement minimal application/clock/persistence/migration wiring. Reuse profile-independent password hashing; never save an entire stale user snapshot for password reset.
4. Unit/controlled-clock checks: default one hour, configurable duration for new tokens only, just-before/exact-expiry/after boundaries, supersession, consumed/unknown/malformed token rejection, exact password whitespace, five/six-character and ASCII/multibyte 4096/4097-byte boundaries. Invalid password leaves hash and token state unchanged.
5. Real guarded MySQL: new migration up/down, index/FK/schema parity, hash-only storage, atomic supersession/reset and rollback on injected persistence failure; deleted account rejection. Real independent connections with owned barriers prove two consumers cannot both succeed and competing issuance/reset respects the serialized lifecycle. No mocked unique/locking substitute.
6. Reset a synthetic ordinary and SUPER ADMIN account, confirm preserved profile/roles, verify new password, and use native HTTP login to accept it and reject the former password. Inspect captured private fixture output and persisted reset rows for absence of raw tokens/hashes in inappropriate outputs. Do not print sensitive snapshots on assertion failure.
7. Run scripts/check backend (T1–T4 regressions including native HTTP/PTY), PHP syntax/container/YAML lint, editor diagnostics, diff review, then scripts/check phpstan at fixed level 10 over all owned PHP/tests/migrations with zero errors and no baseline/exclusions.
8. Verify removal of owned containers/network/locks/HTTP children/barrier files. Check root dotenv remains private/ignored/untracked and existing manifests/locks unchanged. Record actual results, mark only T5 complete when all done conditions pass, and stop before T6. Separate slice Validation remains pending.

## Runtime and installation limits

Reuse installed PHP/MySQL images without pull/build/install. Use the existing compose.verification.yaml guarded tocaregalo-test tmpfs MySQL and loopback native HTTP fixtures only. Apply DDL/synthetic accounts/reset records exclusively after TestDatabase target guards. No persistent development migrations/accounts/sessions, secrets, key provisioning, SMTP, Mailpit/worker/browser startup, package installation or dependency changes. Existing shared root dotenv supplies configuration; do not print/overwrite it or request credentials already available. Temporary test-only TTL overrides are allowed within the disposable fixture environment.

T6 must integrate issuance and durable mail enqueue transactionally without introducing another queue or raw-token persistence; this task does not claim to solve that handoff. If integration feasibility requires a material plan change, stop and present the impact before implementing it.

## Approval and completion

User approved execution plan v0.1 and authorized implementation plus the bounded checks above. Completed with [actual evidence](./verification.md#t5-completion). This preparation changes documents only; it does not authorize implementation, installations or T6.
