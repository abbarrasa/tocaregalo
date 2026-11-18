# 003:T8 — Responsive own-account editing

Revision: v0.1
Status: completed under approved implementation and bounded runtime authorization
Approval: “Apruebo el plan y su implementación”, 2026-11-18.
Date: 2026-11-18
Preparation authority: “Continúa con la siguiente tarea”.
Baseline: approved parent Spec 001 v1.2 / Plan v0.5 / Tasks v0.5; derived Spec 003 v0.3 / Plan v0.4 / Tasks v0.4. T1–T7 complete. Preparation observed clean local dev at 8e1feb4c0ce3e493ff8083724abaefad07ec980e, tracking origin/dev. No implementation branch or runtime started.

## Scope and traceability

Implement only T8's authenticated own-profile/password UI over the existing T4 PATCH /api/me contract. Preserve T7 login/recovery/guards/logout and its phone wrapper. No deletion (007), account creation/member editing (004), roles, ownership, registration, verification, group/event/assignment dashboard, new API operation or schema/dependency change. Spec 003 remains approved; T9 and formal Validation are separate gates.

| Requirement / acceptance | Planned work | Verification |
| --- | --- | --- |
| FR-3 / AC-3 | Required firstName/email/phone, optional lastName, existing phone plugin and server normalization/uniqueness | Component field errors, real duplicate email/canonical phone rejection and no mutation, optional-surname clearing, normalized response |
| FR-4 / AC-4 | Explicit password-only save; shared six-Unicode-character/4096-UTF-8-byte checks with exact whitespace | Component ASCII/multibyte boundaries; real password update, new login and old-password refusal; existing backend boundary regressions |
| FR-29 / AC-29 | Protected own-account route and PATCH deriving actor on server; update own actor from returned DTO | Anonymous/expired-session denial, own USER/SUPER ADMIN changes, prohibited target/role payload rejection, other fixture unchanged |
| NFR-5 | Spanish labels, hints/status/errors; English code/docs | UI and documentation review |
| NFR-6 | Bootstrap mobile/desktop layout | Existing Chromium desktop/mobile, Firefox/WebKit profiles; no horizontal overflow |
| NFR-8 | Initial loading/failure/retry, field errors, submission loading and keyboard focus | Component races/loading/error tests and real browser keyboard/label/error checks |
| NFR-10 | Full owned-PHP fixed-level-10 gate even for frontend work | Final scripts/check phpstan, zero errors, no baseline/exclusions |

NFR-2/4 and FR-15/35 are supporting regressions: retain Vue/Bootstrap, API-only JSON, login/dashboard/logout behavior. This task does not fulfil downstream group-owner authorization or the complete product dashboard.

## Proposed screen and interactions

Add protected /account with heading “Mi cuenta”; add a “Mi cuenta” link in the authenticated dashboard shell and a “Volver al panel” link on the account screen. Reuse route-session revalidation and route heading focus. No account ID in route/query or user-select control. An unauthenticated/expired actor reaches login; a service failure shows a Spanish retry state with no editable stale profile or false anonymity.

After successful GET /api/me restoration, populate first name, optional surnames, email and canonical international phone. Use existing PhoneInput and associated Spanish labels/errors; backend remains authoritative for email/normalization/uniqueness. Present two independent forms:

1. Profile: “Guardar datos”, requiring first name/email/phone and allowing blank surnames. Send only changed allowed profile keys; clearing surnames sends lastName: null. If nothing changed, show “No hay cambios para guardar” without PATCH. Use the normalized response to refresh the visible saved values and baseline; show “Datos actualizados”. Profile submit never sends password.
2. Password: one empty “Nueva contraseña” field and “Cambiar contraseña”. No current-password or confirmation requirement is added. State the approved minimum/byte cap and exact-space policy. Send only password; empty/invalid input is a field error, not an implicit password removal. On success clear the field, show “Contraseña actualizada” and retain the existing session behavior. No forced global logout, recovery request or email is introduced.

Disable both save operations while either mutation is pending, retaining separate validation/status messages. Retain profile input after 422/network errors so it can be corrected; clear password after a completed password request (success or failure) and on route exit/logout, without trimming. Do not persist drafts, actor, CSRF or passwords in browser storage. No secret is displayed in confirmation, logs or artifacts. Changing a field clears its obsolete field error/status as appropriate without discarding other edits.

For each PATCH obtain fresh session-bound CSRF through the existing helper, same-origin credentials and JSON. Whitelist firstName/lastName/email/phone/password/_form errors; ignore unexpected server bodies/fields. On 401 clear stale actor/sensitive state and replace with login; never replay the mutation after reauthentication. On 403 show a sanitized retryable request error without claiming success or bypassing CSRF. Network/5xx errors remain explicit and do not claim a save. Use the returned own-actor DTO to update session identity, preserving returned roles without exposing a role editor. Generation guards must prevent a late update response from resurrecting an actor after logout/another session operation. Existing server authorization/atomicity remains authoritative; do not infer privileges from client roles.

## Files and boundaries

| Paths | Responsibility |
| --- | --- |
| frontend/src/views/AccountView.vue | Account forms, canonical baseline/draft, Spanish states, field associations and accessible focus |
| frontend/src/api/identity.js | Extend mutation helper with PATCH support and allowed account error fields; preserve all existing POST contracts and fresh CSRF |
| frontend/src/composables/useSession.js | Apply own update response through existing projection/generation authority; handle 401 without stale actor resurrection |
| frontend/src/router/index.js; views/DashboardView.vue | Protected account route and own-account navigation; preserve pending dashboard content and logout |
| frontend/src/components/PhoneInput.vue; composables/useForm.js; assets/main.css | Reuse; change only if required for shared field/focus/responsive behavior, retaining T7 regressions |
| frontend/tests/identity/ | Test-first API/session/form boundaries, profile delta, validation, password omission/exact bytes, failures and late responses |
| tests/e2e/account.spec.js; identity-data.js; backend/tests/Fixtures/Browser/identity.php | Actual own-account browser acceptance and stable synthetic fixture restoration; no public fixture endpoint |
| README.md; docs/development.md; verification.md; tasks/index; MEMORY.md; AGENTS.md | User help, technical verification/limits, approval and completion bookkeeping |

No product backend change is anticipated. If implementation reveals an API defect or material contract/requirement gap, stop the affected work and obtain the appropriate corrective/change authorization rather than silently expanding T8. Internal helper names may follow existing conventions within these responsibilities.

## Decisions and alternatives

Reuse existing API, phone plugin, form/session helpers and test graph. Avoid a state library, form package, new phone dependency or duplicate validation infrastructure. Separate explicit profile/password actions reduce accidental credential changes and preserve the API's omitted-field semantics; a combined form with an ambiguous empty-password convention is rejected. Partial profile payloads avoid resubmitting untouched stale values; no optimistic-lock/version/conflict policy is added. The server's current atomic merge and unique constraints remain unchanged.

## Execution and verification sequence

1. After approval recheck git status and current local dev. Create feature/003_T08_own-account-screen from then-current dev, preserving planning documents only when switching is safe. Stop on conflicting uncommitted changes; no stash/reset/restore/commit/merge/push.
2. Write behavioral tests first; run/record genuine missing-behavior failures. Implement PATCH transport/session authority, account forms and navigation within approved boundaries.
3. Vitest: initial/restored values and failure states; required/optional fields; changed-key payload and lastName null; unchanged notice/no PATCH; no password in profile update; fresh CSRF/method/error whitelist; canonical server response; duplicate/error associations; independent password action and 5/6-character, ASCII/multibyte 4096/4097-byte/exact-space cases; busy/double-submit controls; 401/403/network failures, retry, no mutation replay and stale-update/logout races. Retain T7 tests.
4. Extend only guarded synthetic fixture reset so changed names/email/phone cannot contaminate later tests. Restore both seeded accounts' profile/password through stable fixture identity under existing target guards/transaction discipline; keep roles and migrations unchanged. Use separate browser sessions for actual unauthorized/other-account checks. No direct fixture database shortcut replaces UI acceptance.
5. Run scripts/check identity with existing installed images across all four profiles, including the new account cases and existing identity/recovery/shell regressions. Real browser flows: own-data update/reload/dashboard identity, surname clear, duplicate email/phone leaving both accounts unchanged, successful exact password change followed by logout/new login and old credential refusal, USER/SUPER ADMIN own-only scope, expired session during editing and rejected target/role fields. Test network failure only through explicit controlled failure cases; do not mock successful mutations. Check labels/errors/focus, keyboard save, phone typing/paste and no horizontal overflow.
6. Run scripts/check frontend, build, static when wrappers/fixtures/configuration are affected, relevant existing backend/account regressions (full backend or mail suite as needed), and final scripts/check phpstan fixed level 10 over all owned PHP/tests/migrations. Lint any changed PHP/configuration, inspect editor diagnostics and git diff --check. Broaden/repeat only for new changes/failures or unresolved concerns. Do not rerun unrelated main startup or claim formal Validation.
7. Verify owned runtime/network/locks/children/private test material removed; root dotenv unchanged/ignored/mode 0600; manifests/locks and production migrations unchanged. Record actual results and limits, update only T8 completion and counts (17/39 becomes 18/38 if complete), and stop before T9.

## Runtime, secret and installation authorization requested

Approval requests reuse of scripts/check identity's invocation-owned guarded tmpfs MySQL, synthetic USER/SUPER ADMIN accounts, explicit test migrations, loopback Nginx/Vite/PHP, local Mailpit/notification worker/control and installed browsers. Reuse one-child fixture FPM pool, bounded processes, ownership/port/lock guards and failure/signal cleanup. No pre-existing test resources may be adopted or removed.

Because T7 recovery regressions run in that graph, generate one disposable recovery key per owned invocation with the installed PHP image and share it only through the private 0700 temporary directory/0600 test env file with PHP services. No key in CLI arguments, output, Vite or browser environment/mount; browser receives only the existing control subdirectory. Retain disabled trace/video/screenshots/page-copy snapshots and sanitized credential/navigation errors. Remove owned test material on completion/failure/signals. Recovery regression is local capture only, no external SMTP.

No package installation, image build/pull/browser download, root dotenv mutation, real key provisioning, development database/account/session mutation, commit/push, T9 implementation or formal Validation is requested. Planning itself starts no containers, checks requiring services or secret generation.

## Approval requested

Approve execution plan v0.1, including the proposed account route/two-form interactions, and explicitly authorize T8 implementation plus the bounded installed-image runtime/synthetic-env-file checks above. Installation and real provisioning remain outside this authorization.
