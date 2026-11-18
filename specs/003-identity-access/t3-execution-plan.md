# 003:T3 — Session authentication execution plan

Revision: v0.1
Status: executed; T3 complete with evidence and scope limits
Approval: "Apruebo el plan y su implementación", 2026-11-18, approves v0.1 and bounded temporary-MySQL checks.
Date: 2026-11-18
Preparation authority: “Continúa con T3”.
Baseline: approved Spec 001 v1.2, Plan 001 v0.4 and derived Spec/Plan/Tasks 003 v0.3; T1/T2 complete. Scope: FR-15/22/35, AC-15/35, supporting NFR-1/4/5/10 and approved session/CSRF architecture.

## Outcome and proposed JSON details

Implement only session login/logout, own authenticated actor projection and CSRF initialization. Dashboard navigation and Vue forms remain T7/006; account changes, recovery, groups and assignment access remain later tasks. No public registration, role management, JWT or backend views.

| Endpoint | Proposed bounded contract |
| --- | --- |
| GET /api/csrf | Initialize an anonymous session and return {csrfToken: string} for session-bound authentication/mutation checks; no-store. |
| POST /api/login | JSON identifier/password; X-CSRF-Token header required. Accept trimmed case-normalized email or cleaned +/digits phone. On success return the authenticated own actor projection; rotate session ID. |
| GET /api/me | Authenticated own id, firstName, lastName, email, phone and roles only; no hash, password, token, repository entity or assignment. |
| POST /api/logout | Authenticated, CSRF-protected logout; invalidate session and expire cookie, return 204. Previously captured cookie/session cannot access /api/me; another valid login succeeds. |

Use 401 for invalid credentials/unauthenticated access, 403 for missing/invalid CSRF, 422 for malformed or unsupported input, 405 for unsupported methods; stable error keys and Spanish messages, no redirects or HTML. Reject role/owner/recipient/user-ID injection instead of accepting identity from the request. CSRF token is issued through /api/csrf and remains bound to server session state; clients can obtain a fresh token after rotation/logout. Do not invent new password-policy checks for verifying existing credentials or change passwords during login.

## Security and persistence design

- Register installed SecurityBundle and use stateful Symfony firewall/authenticator/provider interfaces. Security principal is an infrastructure adapter implementing Symfony interfaces, wrapping an ID/profile/roles/hash from existing repositories; domain models remain framework-independent. Refresh authenticated identity/roles from persistence, loading by stable user ID when refreshing a session. Missing user invalidates access. Client-supplied roles/owner IDs never define actor privileges.
- Reuse Symfony password algorithms compatible with T1/T2 hashes. No custom cryptography, token authentication or credential logging. Invalid identifier formats and unknown/wrong credentials produce a generic authentication failure without disclosing account existence. Explicit DTOs, no generic entity serialization.
- Use installed Symfony PdoSessionHandler with the existing environment connection parameters. Add an explicit reversible sessions-table migration matching the installed handler's MySQL schema: binary session ID/data and integer lifetime/time columns. Never call auto-create at request/startup time or alter the completed identity migration. Keep sessions distinct from domain records and migration-owned infrastructure metadata.
- Cookie proposal: project-specific name TOCAREGALO_SESSION; HttpOnly, SameSite=Lax, path /, Secure under HTTPS, explicit HTTP-compatible dev/test configuration. Retain framework lifetime defaults; no new product timeout. Production security requires HTTPS as already approved. Test session rotation, isolation, logout destruction and correct cookie flags.
- CSRF uses installed Symfony session-backed token manager, enforced on login/logout and reusable for future mutation adapters; no custom token algorithm or CORS expansion. Ensure CSRF validation cannot be bypassed by content type/method changes. Retain existing JSON-only exception handling and infrastructure /api shell; lazy sessions avoid unnecessary DB access on unrelated anonymous shell routes.

## Files and responsibility

| Paths | Responsibility |
| --- | --- |
| backend/src/Infrastructure/Security/ | Symfony principal/provider, authenticator and JSON success/failure/entrypoint/logout/CSRF adapters as needed; no domain Symfony dependency. |
| backend/src/Api/ | Explicit identity/CSRF JSON endpoints and own-actor projection; preserve existing API Platform boundary. |
| backend/config/bundles.php, packages/framework.yaml, packages/security.yaml, services.yaml, routes.yaml | Register installed security/session/CSRF pieces and explicit routes; no template-rendered login page. |
| backend/migrations/ | New sessions-table migration; no mutation of prior identity schema or application startup auto-migration. |
| backend/tests/Unit/, Functional/, Integration/, Support/ | Identifier/auth boundary, session/CSRF/DTO tests and guarded real-MySQL session persistence/migration checks. Reuse existing target guards, never bypass with mock storage for the persistence claim. |
| README.md, docs/development.md | Current API authentication usage and limits in appropriate language, no actual credentials. |
| specs/003-identity-access/verification.md, tasks.md, MEMORY.md, AGENTS.md | Actual results, approval and next boundary. |

## Execution and verification sequence

1. After approval rerun git status --short --branch; create feature/003_T03_session-authentication from current local dev, preserving this plan/MEMORY. Observed dev is clean before preparation, HEAD/dev 122ca0f3480cbc1c2b7b0380e4bda539e5846ce6. Stop if switching would overwrite edits; no stash/reset/restore/commit/merge/push.
2. Write behavioral tests first and establish failures due to missing endpoints/session behavior. Use synthetic ordinary and SUPER ADMIN fixtures through existing hash/persistence boundaries. Verify actor roles come from DB; no assignment bypass is implemented or claimed here.
3. Add principal/provider/authenticator, CSRF/session configuration, minimal JSON contracts and sessions migration. Keep interface/persistence responsibility boundaries explicit and Spanish errors sanitized. Existing request subscriber forces JSON-LD; inspect interaction with the authenticator/controller routing and preserve existing /api regression responses.
4. Exercise email case/whitespace and phone formatting login, incorrect/unknown/malformed credentials, missing/wrong/other-session CSRF, anonymous /me, correct own projection for each role, unsupported fields/methods/content, session-ID rotation/fixation, independent sessions and logout replay rejection. Missing/removed persisted users cannot retain access. Assert responses/serialized session/log evidence never expose password/hash or other users' data.
5. Prove real MySQL-backed session storage with two independent kernel/request lifetimes and inspected sessions rows; no file/mock-session substitute. Apply/reverse actual migration only within the guarded disposable DB and assert ORM identity schema parity stays intact. Cookie checks cover HTTP dev and simulated HTTPS secure behavior at the HTTP response boundary. Browser navigation/real production TLS remain explicitly unverified until their authorized tasks/environment.
6. Run scripts/check backend with new and T1/T2 regressions, including existing real PTY bootstrap check. Run PHP syntax, container/YAML checks and editor diagnostics, review diff/traceability, then final scripts/check phpstan at fixed level 10 on all owned PHP including tests/migrations, zero errors without baseline/scope omission.
7. Confirm owned containers/network/lock removed, dotenv unchanged/ignored/mode 600 and no manifests/locks/install changes. Record actual commands/results/limitations. Mark only T3 complete after its gates pass and stop before T4.

## Bounded runtime and data authorization requested

Use existing installed images, compose.verification.yaml project tocaregalo-test, supplied TEST_DATABASE_URL and owned tmpfs MySQL plus temporary PHP containers only. Guard target before DDL/session/identity fixtures; Symfony session PDO must use the same verified test target, never root development defaults. Session data and synthetic users persist only in that disposable test instance. Tests may run real migrations/reversal and session/CSRF requests there; clean only invocation-owned resources on failure/success. No browser/frontend/mail/workers, real development DB migration/account/session, keys, SMTP, package/image install/build/pull or secret generation. No production delivery/deployment. Ask only for genuinely missing environment input; do not print resolved env/credentials.

## Approval requested

Approve execution plan v0.1, including the proposed endpoint/header/cookie details, and authorize implementation plus bounded temporary-MySQL verification. These are technical choices within the approved session/API architecture; no new product behavior is introduced. If installed Symfony behavior cannot satisfy the contract, stop affected work and report rather than weaken CSRF/persistence evidence or install a workaround. Preparation modifies documentation only; no branch creation, code, runtime, migration or account operation occurred.

## Completion

[Final evidence](./verification.md#t3-completion-and-final-actual-results): backend 63 tests/374 assertions, native HTTP/MySQL session checks, zero-error level-10 analysis, 53 syntax checks and container/12 YAML lint pass. Owned temporary resources removed. No development schema/session initialized. Stop before T4.
