# 003:T7 — Login and recovery/reset screens

Revision: v0.1
Status: completed under approved v0.1; see verification.md#t7-completion for actual checks and limits
Approval: “Apruebo el plan y la implementación”, 2026-11-18.
Date: 2026-11-18
Preparation authority: “Continúa con la siguiente tarea”.
Baseline: approved Spec 001 v1.2 / Plan v0.5 / Tasks v0.5 and derived Spec 003 v0.3 / Plan v0.4 / Tasks v0.4. T1–T6 complete. Local dev clean at 2a5ce43adeb58c56b2a8de3cf64aab8293b3528f before preparation.

## Scope and traceability

Implement T7's Vue login, recovery and reset forms, phone wrapper, session guards/logout and authenticated dashboard route shell. Covers frontend FR-3/4/15/28/35 and AC-3/4/15/28/35 portions, NFR-2/5/6/8/10. Reuse T3/T6's real JSON/session/CSRF contracts. No public registration or verification link, account editing (T8), deletion, groups/events/draw cards, assignment delivery or role management. The dashboard shell must identify unfinished product content, without fabricated events or claims that a dashboard API exists.

## Proposed routes and interactions

| Route | Behavior |
| --- | --- |
| / | Redirect to /dashboard through the session guard; unauthenticated users reach /login. |
| /login | Spanish login form, password and email/phone identifier. An explicitly labelled Email/Teléfono mode selector changes the identifier input, retaining one identifier in the API payload. Success enters /dashboard; invalid credentials show a generic Spanish error. Link to password recovery; no registration/verification links. An already authenticated actor goes to /dashboard. |
| /password-recovery | Same identifier modes and strict phone behavior; submit existing POST recovery contract and show its generic acknowledgement without account/delivery disclosure. Offer return to login. |
| /password-reset | Read the T6 #token fragment into memory and immediately replace history to remove the fragment before any asynchronous work. One new-password field, shared-policy hints and associated errors; POST exact token/password. Missing token shows an actionable invalid-link state with recovery/login links; used/expired/superseded errors use backend generic wording. Password validation errors preserve the current token for another valid attempt. Success clears secrets and returns to login with an in-memory Spanish success message; no automatic login. |
| /dashboard | Authenticated shell showing only the own actor identity and logout, plus explicit pending-panel text. No calls to unfinished dashboard/group/assignment APIs or invented event empty states. |
| Unknown route | Retain Spanish not-found behavior, return link and direct-URL SPA fallback. |

Keep actor and CSRF state in Vue memory only: no JWT, Pinia, local/session storage, persisted password/token or token query-string. Restore identity through GET /api/me on startup and revalidate private navigation; distinguish 401 from connectivity failures instead of treating every failure as anonymous. Guard initialization must not flash private content or loop. Use request generation/cancellation so delayed pre-logout/pre-login responses cannot restore stale actor state. No arbitrary redirect URL/query parameter; successful login enters the approved dashboard shell.

For each mutation obtain a fresh session-bound token from GET /api/csrf and send X-CSRF-Token with same-origin credentials. Reuse T6 JSON bodies and handle 204 without attempting JSON decoding. Successful logout requires server 204, clears actor/sensitive UI state, and enters login; on network/server failure show an actionable error without claiming the session ended. Backend remains authorization authority; do not infer privileges from client roles. A 401 on protected access clears stale actor state and redirects to login. Clear password/reset-token references on success, route exit/unmount and logout; do not silently replay failed mutations.

## Phone and validation design

Reuse already installed vue-tel-input 9.9.2 through plugins/phone.js and a labelled reusable wrapper. Its local type declarations expose autoFormat, autoDefaultCountry, customValidate and inputOptions; disable auto-format and IP country discovery. Enforce only digits and one initial +, no spaces/hyphens/other signs, including typing, paste, selection replacement and emitted plugin updates. Do not infer a country or silently assign a default prefix. Preserve understandable caret/backspace/composition behavior. Explain the required international prefix in Spanish. No extra national-number length/validity rule from the library may reject a number accepted by the approved backend policy. If the installed widget cannot honor the required behavior, implement the approved local Vue phone plugin/input without installing another package; record why.

Frontend password checks mirror six Unicode characters and at most 4096 UTF-8 bytes (TextEncoder), without trim/normalization or misleading HTML character-only limits. Backend validation remains authoritative. No extra composition, current-password or mandatory confirmation rule. Required inputs, invalid credentials, network/configuration failures, missing/invalid reset link and server field errors have Spanish states. No raw server response dumping or HTML insertion: allow only safe structured error keys/message fields for the expected operation, with a generic fallback. Never echo submitted credentials or tokens.

## Files and responsibility

| Paths | Work |
| --- | --- |
| frontend/src/api/client.js and tests/api-client.test.js | Preserve relative API/same-origin/redirect/content-type protections; add explicit 204 handling and safely structured errors for identity operations, retaining generic handling for unexpected fields/bodies. |
| frontend/src/api/identity.js; composables/useSession.js | Typed-by-contract identity calls, fresh CSRF mutation helper, own actor lifecycle, guarded restoration and late-response cancellation. No persisted secrets. |
| frontend/src/router/index.js; App.vue | Public/private routes, session loading/error states, common heading/navigation and accessible route focus behavior. |
| frontend/src/views/LoginView.vue, RecoveryView.vue, ResetPasswordView.vue, DashboardView.vue | Spanish form/state interactions and authenticated shell. Preserve NotFoundView; replace obsolete preparation landing behavior. |
| frontend/src/plugins/phone.js; components/PhoneInput.vue and IdentifierInput.vue; assets/main.css; main.js | Restricted existing phone integration/local fallback, shared identifier mode, Bootstrap responsive/focus styling and plugin registration. |
| frontend/tests/ | Vitest component/API/guard/phone/password-byte/privacy and asynchronous race tests. |
| tests/e2e/identity.spec.js; shell.spec.js; playwright.config.js | Real same-origin login/logout/recovery/reset, route guards/direct URLs, keyboard/focus and overflow at existing four browser profiles; update preparation-text assertions without dropping security regressions. Disable trace/video/body/token-bearing artifacts for identity tests. |
| compose.identity-verification.yaml; scripts/check and scripts/lib/; backend/tests/Fixtures/Browser/ | Dedicated bounded identity browser harness: tmpfs guarded DB, explicit fixture migrations/seeds, installed API/Nginx/Vite/browser/Mailpit and worker. No public fixture API/production seeding command. |
| README.md; docs/development.md; docs/security-operations.md; verification/tasks/index/MEMORY/AGENTS | User instructions, current runtime limits, exact checks and completion boundary. |

No package, lock or production schema change is planned. PHP changes should be confined to guarded test setup/teardown when possible; T3/T6 contracts remain unchanged. Exact internal helper names may follow existing conventions within these responsibilities.

## Browser environment and secret scope

Current compose.verification.yaml starts an unseeded foundation graph without Mailpit/worker or a shared recovery key. Extend wrappers with a dedicated identity verification model/selector so existing foundation smoke checks remain reproducible. The new owned tocaregalo-test graph reuses pinned installed images and the existing port/ownership/guard/cleanup rules. It has no persistent volumes and refuses pre-existing test resources. Apply actual migrations and create synthetic USER/SUPER ADMIN fixtures only after TestDatabase guards and runtime target checks, never in the development DB.

Generate one disposable recovery key per owned invocation using the installed PHP image. Share it only with the temporary PHP API, fixture CLI and notification worker via a private owned 0700 temporary directory and 0600 test env file (not a key-file production policy or root dotenv change). Do not print the file/value or resolved Compose configuration; never pass it as a command argument or expose it to Vite/Playwright. Worker/API must share that synthetic key across process restarts. Remove only owned temp material at teardown on success/failure/signals. No real key generation/provisioning or root dotenv mutation. This temporary test env-file propagation is explicitly requested with this plan's runtime approval.

Run a real browser against same-origin Nginx, real Symfony sessions, real MySQL and actual Mailpit capture. Extract a captured link privately through the isolated Mailpit API and navigate the browser without recording bearer-bearing traces/logs. Seed credentials are synthetic and never printed on failed assertions. Do not substitute request interception/mocked login or mail for end-to-end evidence. Test missing-key/configuration conditions in isolated fixture overrides, without claiming main development recovery is ready. No external SMTP, public registration or real user account.

## Execution sequence and checks

1. After approval recheck git status/local dev and create feature/003_T07_identity-screens from then-current local dev, preserving planning edits. Stop on unsafe switching; no stash/reset/restore/commit/merge/push. Preparation observed clean dev at the baseline above.
2. Write behavioral tests first and record actual missing-behavior failures. Implement safe API/204/field-error handling and session guards, then forms/phone integration, then real browser harness. Do not weaken existing request-client and private-path tests merely to change the landing screen.
3. Vitest: loading/submission/error/empty/missing-link states, fresh CSRF and 204, safe allowed error fields, identifier modes, phone typing/paste/selection/IME/no IP discovery, min/byte password boundaries/exact whitespace, guard success/401/network/race behavior, token fragment clearance before requests, credential clearing and no registration/verification links. Associated labels/errors, focus movement, keyboard submission and disabled/loading controls must be testable.
4. Real browser: email and phone login, invalid credentials and anonymous dashboard refusal; direct URL/reload session restoration, logout plus server-session replay refusal; generic recovery acknowledgement, actual captured fragment link, immediate fragment removal, reset success/new login/old-password failure, used/expired/superseded/missing-link and invalid-password no-consumption states. Test ordinary/SUPER ADMIN where identity behavior differs; never show another actor's data. Test network errors with controlled browser network failure only for those explicit failure cases.
5. Run Chromium desktop 1440×900/mobile 390×844 and essential auth/recovery/keyboard flows in Firefox/WebKit using installed Playwright image. Check no horizontal overflow, keyboard reachability/focus and associated Spanish labels/errors. Inspect programmatic browser/network/console output for forbidden token/hash/key leaks without printing secret values; no new screenshot/trace export of recovery data. Browser URL navigation must actually use the captured link, not a fixture-generated bypass token.
6. Run scripts/check frontend, build, static if models/wrappers change, dedicated identity E2E checks, and relevant backend/mail regressions for any test harness changes. Existing foundation E2E security/shell checks must remain passing with new landing behavior. Final scripts/check phpstan fixed level 10 on all owned PHP/tests/migrations must have zero errors, no baseline/exclusions, even if product edits are mostly Vue. Lint affected PHP/Compose/shell configuration and inspect editor diagnostics/diff.
7. Verify owned containers/networks/ports/locks/children/temp env/key files removed and root dotenv unchanged/ignored/mode 0600; locks/manifests/production migrations unchanged. Record actual commands/results/requirements/limits. Mark only T7 complete after done conditions pass; stop before T8 and retain its execution-plan approval gate. Separate slice Validation remains pending.

## Approval requested

Approve execution plan v0.1 and authorize implementation plus its bounded installed-image MySQL/Mailpit/worker/browser/native fixture checks and disposable synthetic env-file/key propagation. No installation, real key provisioning, development data mutation, commit/push or T8 is requested. Proposed routes, identifier mode selector, state/error/focus behavior and harness extension above are concrete technical choices for this task's approval.
