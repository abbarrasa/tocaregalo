# 002:T4 — Execution plan

Revision: v0.2
Status: v0.2 approved; prior v0.1 scope and Playwright approval preserved; prerequisite T9 pending
Historical approval: “Apruebo los alcances” approved v0.1 implementation/runtime and the separate matching Playwright image download on 2026-11-17. Do not request those unchanged approvals again.
Approval (v0.2): “Apruebo estas revisiones y autorizo actualizar las tareas”, 2026-11-17, approves the PHPStan gate/prerequisite and authorizes task-list preparation. No PHPStan package installation or T9 execution is authorized by this statement.
Date: 2026-11-17
Planning authorization: “Continúa con la siguiente tarea”, following T3 completion. Under the user's per-task rule, this authorizes planning, not implementation.
Authority: [Spec 002 v0.1](./spec.md), [Plan 002 v0.1](./plan.md), [parent architecture v0.1](../001-toca-regalo/plan.md), [T4](./tasks.md). T3 is complete with [runtime evidence](./verification.md#t3-completion).

## Objective and boundaries

Wire the existing Vue/Router/Bootstrap dependencies into a minimal Spanish SPA, its native-fetch API boundary, Vite HMR through Nginx and Nginx serving of compiled static assets. Verify the real frontend/API origin boundary on desktop and mobile. This supports NFR-2/3/4/5/6 without claiming complete product flows.

No login, dashboard, group/event screen, draw behavior, business entity, migration, mail, worker or encryption key. No backend HTML/Twig, new npm/Composer package, major-version change or dependency audit repair. The shell identifies Toca Regalo and states in Spanish that the application is still being prepared; it must not look like a functioning gift-draw application. A missing route may show a generic Spanish not-found state, not an invented business screen.

## Branch and prerequisites

Before T4 execution, complete the separately authorized [PHPStan setup](./phpstan-execution-plan.md) and establish its first zero-error level-10 run on the current owned PHP. This prerequisite will be reflected in the approved Tasks update; it does not renumber T4 or invalidate T3 evidence. After T4 implementation, rerun PHPStan even if no PHP changed and require zero errors before marking T4 complete (NFR-10). The setup task owns new Composer dependencies; T4 itself keeps its original no-new-package scope.

After approval, inspect `git status --short --branch`, preserve all edits and create `feature/002_T04-vue-nginx-entrypoint` from the then-current local dev. If switching is unsafe, stop and identify the conflicts; never stash/discard, commit, merge or push.

Reuse T2's locked dependencies and images, T3's API runtime and existing private root .env. Do not print or overwrite .env. Missing local dependencies/images are a blocker, not permission to reinstall. The inspection for this plan found clean dev and locked Playwright 1.65.1. Original requirements/ER absence remains a historical source limitation; this task follows approved specifications without redefining product behavior.

## Proposed files and responsibilities

| Planned files | Responsibility |
| --- | --- |
| `frontend/index.html`, `frontend/src/main.js`, `frontend/src/App.vue` | Spanish document metadata, Vue mount and minimal shell; import Bootstrap CSS. |
| `frontend/src/router/index.js`, `frontend/src/views/PreparationView.vue` | Router history, preparation placeholder and generic missing-route handling; no product routes. |
| `frontend/src/api/client.js` | Native fetch with relative `/api` URLs, same-origin credentials and JSON/error boundary; no Axios, global state library or token storage. |
| `frontend/src/assets/main.css` | Only necessary shell spacing/responsiveness/focus styles, using Bootstrap conventions. |
| `frontend/vite.config.js` | Installed Vue plugin, development server/HMR behind Nginx, no external API proxy or public environment-secret exposure. |
| `frontend/tests/api-client.test.js` | Focused boundary tests for same-origin requests and failures; comprehensive harness stays T5. |
| `frontend/tests/smoke/frontend-runtime.mjs` | Standalone installed-Playwright checks of actual shell/API, viewports and HMR/static modes; no empty-suite success. |
| `docker/nginx/default.conf`, `docker/nginx/static.conf`, optional shared API-location include | Vite proxy/HMR mode and built-static mode, retaining JSON FastCGI routing and private-path protections. |
| `compose.frontend-smoke.yaml` | Dedicated T4 PHP/Vite/Nginx/browser checks; no assignment-key mounts or dependency on unimplemented workers. |
| `README.md`, verification/task/memory documents | Spanish setup status, exact checks/results/limits and execution approval evidence. |

Any shared Nginx include must also be mounted in the existing Compose configuration. PHP's verification service mounts the private root .env read-only at `/workspace/.env` so Symfony uses the same source as T3. Node, Nginx and browser services receive no secret file or backend environment variables.

## Implementation sequence after approval

1. Write the focused API-client tests and real-browser smoke assertions. Confirm intended missing-implementation failures, distinguishing absent tools/browser binaries from missing app behavior.
2. Add Vue shell, router, Bootstrap and relative-URL fetch boundary. Keep technical identifiers/comments English and visible text Spanish. Do not add a technical diagnostics screen or a fake account flow.
3. Configure Vite and Nginx HMR forwarding. Check root load, assets, refresh, JSON API through PHP/FPM and live module updates through Nginx.
4. Run `npm run build` using the existing Node tool image. Serve the resulting ignored dist directory with Nginx's static configuration and SPA fallback; preserve `/api` routing and deny private paths/direct PHP files. Repeat browser checks against compiled assets.
5. Review task/requirement traceability and diff; record actual results and limitations. Stop before T5. No commit or push.

## Runtime and download scope requested

Plan approval authorizes the proposed T4 runtime operations only:

- Start a dedicated `tocaregalo-t4` Compose project using existing PHP/Node/Nginx images, service names prefixed `tocaregalo-`, no automatic installation/build/pull. Publish only the test Nginx HTTP endpoint on `127.0.0.1:8082`; if occupied, report it rather than silently selecting another port.
- Use PHP/FPM, Vite/Nginx in development mode and Nginx with read-only dist in static mode. The API entrypoint exposes no business resources and requires no database query; no MySQL service, database initialization/volume, mail or worker is needed for T4. T3's actual MySQL evidence remains separate.
- Run focused tests/builds in existing tools and browser checks on the dedicated Docker network. Keep browser traffic/API requests on the same Nginx origin, with no CORS workaround. Do not mount .env, the backend or the Docker socket in the browser container.
- HMR verification may temporarily edit only the newly created shell source and restore its original content using ordinary file editing, never Git restore/reset; prove the browser updates without a full reload. Preserve pre-existing user edits.
- Stop/remove only dedicated T4 containers/network after checks. Keep generated dist ignored; remove no existing data volumes and do not restart unrelated projects.

**Separate installation/download approval requested:** download only the official `mcr.microsoft.com/playwright:v1.65.1-noble` verification image, matching the locked npm Playwright version. Record its immutable digest and actual runtime version after authorized resolution. It contains browser binaries/system dependencies; only Chromium is exercised in this task. No host browser, npm reinstall, apt install, package lock update or extra service image is included. Do not silently substitute a tag/version if unavailable. The browser image is a verification tool, not an application deployment service.

Approval of this execution plan alone does not supply that separate download authorization. If download is not authorized and no verified matching browser runtime is available, browser checks remain blocked and T4 cannot be marked complete. Cross-browser product coverage and the full harness remain T5 and downstream slices.

## Verification and task completion

| Requirement | Evidence required |
| --- | --- |
| NFR-2 | Actual Vue/Bootstrap shell mounts; frontend build succeeds; no Twig source/dependency. |
| NFR-3 | Nginx configuration validates inside its image; shell/assets load in Vite/HMR and compiled-static modes. API/FPM routing works in both. |
| NFR-4 | Fetch boundary tests cover relative API URLs, same-origin credentials, valid JSON and failed responses. Browser requests `/api` via the page's Nginx origin and receives JSON; unknown API paths remain JSON errors, never SPA HTML. |
| NFR-5 | Spanish title, shell/error/missing-route text and README; English technical files/comments. |
| NFR-6 | Chromium at desktop 1440×900 and mobile 390×844: mounted shell, visible text, keyboard focus on any controls, no unintended horizontal overflow. This is shell support, not acceptance of unimplemented product flows. |
| HMR/static regression | Vite module update observed without full reload; built assets load without Vite; refresh and SPA fallback work; private `.env`/dot paths and direct PHP requests do not expose files. |
| Isolation/consistency | Inspect loopback-only publication, no persistent data volume, no secret mounts outside PHP, unchanged package locks and `.env` still ignored; record cleanup and diff/whitespace checks. |
| NFR-10 | After T4 implementation, fixed PHPStan level 10 on project-owned PHP including tests, zero errors without baseline concealment; record actual command/version/result. Failure or unavailable analysis prevents completion. |

Do not mark a failed/unexecuted mandatory check passed. Preserve T2's four moderate npm development audit entries and abandoned doctrine/common warning; no claim of clean audits or full NFR/product acceptance. No arbitrary coverage percentage.

## Approval request

The original v0.1 execution/runtime and exact Playwright image download are already approved. Approve only the v0.2 PHPStan gate/prerequisite addition alongside the affected plan revisions. The separate PHPStan setup/task/installation scope still needs its own approvals; no duplicate Playwright authorization is requested.

No implementation, image download, runtime startup or branch switch has occurred during planning.
