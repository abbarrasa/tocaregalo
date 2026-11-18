# 003:T6 — Durable recovery email and JSON integration

Revision: v0.3
Status: complete; approved implementation and bounded checks executed
Approval: “apruebo el plan y su implementación”, 2026-11-18.
Date: 2026-11-18
Preparation authority: “Apruebo estas listas y autorizo finalizar y el presentar el plan”.
Baseline: approved Spec 001 v1.2, parent Plan v0.5 / task index v0.5, derived Spec 003 v0.3 / Plan v0.4 / Tasks v0.4; T1–T5 complete.

## Approval history and scope

User approved the dotenv-key direction with “Apruebo la propuesto y actualizar los planes afectados”, the displayed parent/003 plan revisions with “Apruebo las revisiones y autorizo actualizar las tareas afectadas”, and the displayed task revisions with “Apruebo estas listas y autorizo finalizar y el presentar el plan”, all on 2026-11-18. At preparation these authorized the finalized document only; subsequent execution authority is recorded above. Earlier v0.1 file-key proposal and v0.2 unresolved-upstream state are superseded; no implementation had occurred at preparation, and real secret generation remains unexecuted.

Deliver FR-28/AC-28 backend JSON and usable local captured email, recovery-specific foundational FR-13/34, NFR-7/10; preserve FR-4 and existing session/CSRF policy. Assignment rendering, owner/SUPER ADMIN assignment resend/status screens and dashboard remain 006. Vue login/reset forms remain T7; no registration, verification, role-management or global-session invalidation policy added. Acceptance of a captured link here uses native HTTP, not a claim of completed browser UI.

## Proposed JSON and URL contracts

Both POST routes require JSON objects, strict allowed keys, existing session_mutation X-CSRF-Token initialized through GET /api/csrf, Spanish messages/associated field errors and no-store. Anonymous recovery/reset are permitted with CSRF; neither requires a logged-in user. Do not derive target ID from an authenticated actor when processing a reset token.

| Route | Input | Success and failure |
| --- | --- | --- |
| POST /api/password-recovery | Exactly identifier: string; reuse email/phone normalization and Symfony email validation. No user/role/owner IDs or callback URL. | 202 with the same generic Spanish acknowledgement for existing/unknown valid identifiers: “Si existe una cuenta con esos datos, recibirás un enlace para restablecer la contraseña.” Never return account ID, token, link or delivery state. Malformed/unknown fields: 422 field errors; CSRF: 403; unavailable key/queue/storage: sanitized 503 without partial issuance. Validate key/config before lookup so infrastructure failure does not disclose existence. No constant-response-time guarantee is claimed. |
| POST /api/password-reset | Exactly token: string and password: string. Preserve password whitespace. | 204 after atomic valid reset, no automatic login. Invalid/expired/used/superseded token: generic 422 token error; invalid password on a valid token: 422 password error with no consumption/change. CSRF: 403; unexpected persistence failure: sanitized 503 and rollback. No token/hash echo. |

Use trusted APP_PUBLIC_URL, validated as an absolute HTTP(S) origin/base URL with no userinfo/query/fragment; HTTPS required in production, loopback HTTP allowed in development/tests. Render the Spanish plaintext email without Twig, with link APP_PUBLIC_URL + /password-reset#token=<URL-safe-token>, a subject identifying Toca Regalo, expiry information and no password. The fragment keeps token material out of server URL access logs. T7 must read the fragment into memory, clear it from the address bar using history replacement, and submit it in JSON without analytics/logging. This establishes the frontend integration contract, not implementation of T7. No public token verification GET route or client-provided Host/callback trust.

## Components, persistence and atomicity

1. Preserve T5's hash-only reset table and exact password policy. Extend its internal issuance handoff so the generated request ID and sensitive in-memory token can be used to create encrypted delivery work and enqueue its ID before the surrounding transaction commits. Never serialize IssuedRecovery itself or weaken its debug/serialization protections. No reset/supersession can commit without corresponding work/queue; failure restores the previous current token.
2. Add an explicit recovery-delivery table with request/account references, unique request delivery identity, stable Message-ID, version/ciphertext/nonce, state, attempt/retry metadata and sanitized status. Add explicit Messenger transport DDL using the installed transport schema; auto_setup remains false. New reversible migrations only, no rewriting accepted migrations or applying development DDL automatically. Map owned delivery entities externally where ORM parity applies.
3. Use installed Sodium XChaCha20-Poly1305, random nonce per envelope, version 1, and authenticated associated data binding request ID, delivery ID and version. RECOVERY_DELIVERY_KEY is strict standard Base64 for exactly 32 bytes, loaded lazily from the ignored shared root dotenv, independent of APP_SECRET/assignment keys. Empty/invalid keys fail closed before issuance/enqueue; tampering/wrong key fails closed before SMTP with sanitized errors. No fallback/demo key. Committed example has an empty placeholder only.
4. Dispatch only a delivery ID through the existing notifications Messenger Doctrine transport on the same DBAL connection/transaction. Keep Mailer message_bus false and call synchronous Mailer from the delivery handler. The work table is authoritative status/protected rendering data, not another polling queue/retry scheduler.
5. Serialize operations by account row, then reset request, then delivery row. Worker reloads current persisted account and current request under the lock immediately before decrypt/render/handoff; suppress superseded/consumed/expired/deleted-account work. Address the current account's email, not a queued plaintext snapshot. Hold serialization through SMTP handoff/state recording to exclude competing reset/supersession/duplicate workers during that interval. Failures release locks by rollback before Messenger schedules retry.
6. Stable Message-ID and sent-state checks suppress avoidable duplicate processing. SMTP acceptance is external: acceptance followed by crash before committed success can cause a duplicate retry; no exactly-once promise or recall of an already accepted email. Test races on both sides of the authoritative handoff boundary.
7. Purge ciphertext/nonce on success, final retry exhaustion or stale cancellation. Supersession and successful consumption cancel/purge affected pending work transactionally, including through existing lifecycle consumers. Preserve terminal sanitized status only; deleted accounts cascade/null as appropriate without retained bearer data. Expired work is purged when guards/cleanup observe it; add bounded per-worker housekeeping for stale recovery work, not another retry scheduler or an invented expiry-cleanup deadline.
8. Messenger remains the only retry owner: five retries after the initial attempt, base × 2^(n−1), default base 30000 ms, zero jitter/no cap. Worker events mirror retry stamp count/due/final outcome without generating tokens or independently re-enqueueing work. Sanitize SMTP/crypto/storage errors before Messenger error stamps/logging; no raw mail body/link, exception payload or credentials in persisted failure data. Missing/tampered/unrecoverable delivery material must not reach SMTP; finalize/purge it with sanitized status, preserving the existing password.

## Key operations and runtime limits

One active recovery key protects version-1 envelopes. Keep it while pending work needs it; drain or explicitly cancel/purge that work before an authorized replacement. No historical key ring or seamless rotation. Document encrypted offline backup separate from DB backups and matching-key restoration. Root dotenv stays ignored/untracked/mode 0600. Expose its configured key only to API/notification recovery consumers, not frontend/browser payloads; unrelated foundation commands must work without it.

This implementation request does not include generation or mutation of the real root key. Authorize only disposable random synthetic keys inside owned test containers/fixtures, cleared at teardown and never printed. Real development provisioning stays a separate explicit operation. Do not start main development recovery runtime with missing real key and claim readiness.

After explicit implementation/runtime approval, reuse installed PHP/MySQL/Mailpit images with --pull never and no build/install. Use owned guarded tmpfs test MySQL, internal local Mailpit, transient notification worker processes, loopback native HTTP and synthetic keys. Validate TestDatabase target and local SMTP capture before DDL/send; inspect no resolved secrets. No external SMTP/provider configuration is needed for local capture. No persistent development DDL/accounts/sessions, real keys, assignment-key dependency, browser startup, commits/pushes or T7.

## Planned files and responsibilities

| Files or directories | Responsibility |
| --- | --- |
| backend/src/Application/Recovery/ and Application/Port/ | Recovery request orchestration, atomic token/work handoff and payload/clock/mail ports; retain shared validation and lifecycle. |
| backend/src/Infrastructure/Mail/ | ID-only message/handler, synchronous delivery, envelope/key adapter and sanitized retry event projection. |
| backend/src/Infrastructure/Doctrine/ and config/doctrine/ | Delivery persistence, account-first locking, lifecycle cancellation/purge and external records/mappings. |
| backend/src/Api/RecoveryController.php; config/routes.yaml and services.yaml | Strict two-route JSON contracts, CSRF/error DTOs, key/public-URL config wiring. |
| backend/config/packages/messenger.yaml; backend/migrations/ | Route production ID messages to existing notifications transport; explicit work/transport schema, no auto-DDL or second queue. |
| .env.example; compose.mail-smoke.yaml; scripts/check and scripts/lib/ as necessary | Empty key placeholder and isolated synthetic-key mail/API/worker checks; preserve shared private dotenv and no-install guards. Update compose.yaml only if recovery-consumer dotenv propagation actually requires it, without adding new services or mandatory keys to unrelated commands. |
| backend/tests/Unit/Recovery/; Integration/Recovery/; Fixtures/Recovery/; Support/ | Crypto/config policy, transaction/race/worker/stale/failure and captured-link/native HTTP evidence. Mail-dependent tests use existing mail group. |
| docs/development.md; new docs/security-operations.md; README.md | English technical key/worker/failure/backup instructions and Spanish API/setup readiness limits; no secret values. |
| verification.md; tasks.md; parent task index; MEMORY.md; AGENTS.md | Exact authority, actual evidence/limitations, completion count and stop-before-T7 boundary. |

Concrete class/migration names within these responsibilities may follow repository conventions; no new product behavior or dependency is implied. If implementation exposes a requirement gap or material scope/design change, stop affected work and present the impact.

## Execution sequence and checks

1. Recheck git status --short --branch and local dev immediately after approval. Create feature/003_T06_recovery-mail-delivery from then-current local dev, preserving all approved local documentation. Current planning edits began on dev at b15308d4a48dc87304c9839f332fbdd2993107ca. Stop if the switch cannot preserve changes; no stash/reset/restore/commit/merge/push.
2. Write behavioral tests first and record missing-behavior failures. Implement issuance/work/queue transaction and encrypted envelope, then controller/handler/retry projection, then operations docs. Do not replace real persistence/mail evidence with fixtures that bypass actual production adapters.
3. Unit/config tests: strict key length/Base64 and public URL checks; missing key leaves unrelated commands available; fresh nonce, bound identities/version, wrong key/tampering refusal; Spanish JSON field errors/CSRF/non-disclosure/no token echo; shared password exact boundaries preserved. Synthetic keys stay private.
4. Real MySQL: migration up/down, owned mapping/schema parity, same-connection queue/work/request commit; force failures at each persistence/enqueue step and prove rollback/no supersession. Inspect rows/serialized Messenger envelopes/failure stamps for absence of plaintext tokens/keys/links. Prove supersession/consumption/deletion cancel/purge delivery data. Test concurrent issuance/reset/send and duplicate workers with independent connections and bounded owned barriers.
5. Real Mailpit/native HTTP/worker: POST recovery, run actual notifications worker, capture Spanish email and extract its real fragment link privately, submit POST reset, then login with the new password and reject the old one. USER/SUPER ADMIN roles remain unchanged. Restart worker before delivery and after controlled transport failure; retry preserves token/hash/Message-ID and ultimately captures a usable same link. Controlled clock verifies expired/superseded/used suppression immediately before handoff; final failure purges ciphertext. No token or captured body printed on assertion failure.
6. Verify five additional retries and configurable exponential due times using Messenger's installed strategy/stamps and controlled fixture time; use an accelerated positive test-only base for actual worker retries, not minutes-long sleeps or a different production progression. Confirm terminal status, queue acknowledgement and redelivery idempotency. Keep dead-letter/error output sanitized.
7. Run scripts/check backend and scripts/check mail including new mail-group tests and T1–T5 regressions, then PHP syntax, Symfony container/YAML lint, editor diagnostics and diff review. Final scripts/check phpstan fixed level 10 over all owned PHP/tests/migrations must have zero errors, no baseline or scope exclusions. Run scripts/check static if wrappers/models change. No browser/UI verification claimed.
8. Verify owned resources/worker/HTTP processes/barriers/synthetic keys/locks removed; root dotenv unchanged/ignored/mode 0600, dependency manifests/locks and prior migrations unchanged. Record actual commands/results/limits. Mark only T6 complete after all conditions pass; stop before T7. No slice Validation automatically.

## Approval and completion

User approved execution plan v0.3 and implementation with “apruebo el plan y su implementación”. Completed with [actual final evidence](./verification.md#t6-completion). No package installation or real dotenv/key provisioning is requested. Preserve all approved prior work and stop after T6.
