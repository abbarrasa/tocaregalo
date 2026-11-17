# 002:T2 — Dependency resolution evidence

Date: 2026-11-17
Status: task complete with audit warnings recorded below; application validation pending
Supported requirements: NFR-1, NFR-2, NFR-3 (dependency/configuration support only).
Authorization: “Continúa con la siguiente tarea” starts T2; “Autorizo todo” approves the [concrete installation scope](./installation-scope.md). Neither authorizes T3, application services, browser downloads, database initialization or secrets.
Branch: `feature/002_T02-lock-dependencies`, from clean local `dev`. No commit or push performed.

## Resolved images and tools

All six `docker pull <family>` operations exited 0. `docker image inspect` verified repository digests, sizes and available version metadata. [.env.example](../../.env.example) now contains these immutable digests, retaining public review-only secret placeholders.

| Family | Resolved version | Digest |
| --- | --- | --- |
| `php:8.5-fpm-bookworm` | 8.5.12 | `sha256:eec275cd99580e0a6e103dd343a7c160c86917003f6b9bba2d4c75d82419c683` |
| `composer:2` | 2.11.2 | `sha256:0c8e663f14c94d07b3c45b175c51f5a14718508f21fe4dd7e54f09488dd0ed71` |
| `node:24-bookworm-slim` | 24.22.3; npm 11.19.1 | `sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54` |
| `mysql:8.4` | 8.4.13 | `sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902` |
| `nginx:stable-alpine` | 1.30.6 | `sha256:901e593c95dc85f5a729f5765516321366ef4ac401821431d408897e95287d0a` |
| `axllent/mailpit:v1` | 1.34.0, version command stdout | `sha256:23a2ef85bc50853ab3093645d1d64679afd8887e89da5e48a88940c172591a4e` |

Image sizes reported by Docker, in the same order: 518724279, 225326594, 230392365, 809877650, 62350159 and 36328518 bytes. These are uncompressed image sizes, not measured network transfer totals; shared layers must not be double-counted as unique disk usage.

Both builds exited 0:

```text
docker build --pull=false --build-arg NODE_BASE_IMAGE=node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 -f docker/node/Dockerfile -t tocaregalo-node:dev .
docker build --pull=false --build-arg PHP_BASE_IMAGE=php:8.5-fpm-bookworm@sha256:eec275cd99580e0a6e103dd343a7c160c86917003f6b9bba2d4c75d82419c683 --build-arg COMPOSER_IMAGE=composer:2@sha256:0c8e663f14c94d07b3c45b175c51f5a14718508f21fe4dd7e54f09488dd0ed71 -f docker/php/Dockerfile -t tocaregalo-php:dev .
```

Local tool image IDs: Node `sha256:f0a39fb7c9bcbf120ffb1712008cf5da7e143c4bef48125f03b751a0ea66b2f4`; PHP `sha256:8c8d2569a90203b985b87ae5f681679d0aea7d65313b40a94d984635153c2375`. Local tags are build outputs, not registry digests. Debian packages were installed inside the PHP image only; no host runtime was installed. BuildKit warned that mandatory base-image arguments have no default; both builds supplied all arguments explicitly. Debian repository packages are not snapshot-pinned, so a later rebuild can produce a different local image ID.

## Locked dependency families

The backend [manifest](../../backend/composer.json) and [lockfile](../../backend/composer.lock) contain 117 PHP packages including development tools. The first resolution admitted newer transitive API Platform/Symfony components. Explicit conflicts now hold all installed API Platform components to 4.2 and Symfony framework components to 7.4; separately versioned contracts/polyfills retain their own compatible versions. The second resolution succeeded without bypassing platform or advisory controls.

| Backend component | Locked version |
| --- | --- |
| Symfony FrameworkBundle | 7.4.23 |
| API Platform Symfony / Doctrine ORM | 4.2.26 |
| Doctrine ORM / DBAL | 3.8.0 / 4.6.0 |
| Doctrine bundle / migrations bundle | 3.4.2 / 3.7.1 |
| PHPUnit | 12.5.44 |

Only the Symfony Runtime Composer plugin is allowed. No Flex/recipes, application scripts or Twig packages were installed. The generated autoloader is infrastructure, not an implemented API.

The frontend [manifest](../../frontend/package.json) and [lockfile](../../frontend/package-lock.json) resolve:

| Frontend component | Locked version |
| --- | --- |
| Vue / Router | 3.5.45 / 4.6.5 |
| Bootstrap / Vue Tel Input | 5.3.9 / 9.9.2 |
| Vite / Vue plugin | 8.3.8 / 6.0.11 |
| Vitest / Vue Test Utils | 5.1.0 / 2.4.11 |
| jsdom / Playwright | 31.0.1 / 1.65.1 |

Initial unrestricted stable helper ranges were narrowed to their resolved major families. A non-forced `npm audit fix` selected Vue Test Utils 2.4.11 within approved major 2, replacing initial 2.6.0. The final `npm ci` installed 145 packages. Optional platform/peer packages in the lockfile are not all installed on Linux; no extra framework was added to satisfy optional peers.

## Commands and outcomes

Dependency commands ran in `docker run --rm --pull=never --user 1000:1000` tool containers, with only the corresponding absolute project directory bind-mounted at `/workspace/backend` or `/workspace/frontend`, and that path selected as workdir. Composer used temporary `/tmp/tocaregalo-composer` home/cache paths; npm used `/tmp/tocaregalo-npm-cache`. Frontend install/ci set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`. Containers were disposable and had no published ports or application secrets. Offline checks additionally used `--network none`.

| Command inside tool container | Actual outcome |
| --- | --- |
| `composer update --no-interaction --no-scripts --prefer-dist` | Exit 0 twice; second resolution enforces all approved component lines; lock and vendor generated. |
| `composer validate --no-check-publish` | Exit 0; missing package-level license metadata warning. Repository LICENSE was preserved without choosing new licensing terms. |
| `composer check-platform-reqs` | Exit 0; PHP, required extensions and Composer APIs satisfied. `php -m` separately confirms native intl, mbstring, pdo_mysql, Sodium, DOM/XML/XMLWriter/tokenizer. |
| `composer install --dry-run --no-interaction --no-scripts` | Exit 0; nothing to install/update/remove. Initial offline attempt warned about inaccessible advisory metadata; online repetition exited 0 without that warning. |
| `composer audit --format=json` | Exit 1: zero security advisories, but abandoned `doctrine/common` reported. This is not a clean audit. |
| `php vendor/bin/phpunit --version` | Exit 0; PHPUnit 12.5.44. No test suite executed. |
| `npm install --ignore-scripts --engine-strict --no-fund` | Exit 0; initial lock generated, five moderate audit entries. |
| `npm audit fix --ignore-scripts --engine-strict --no-fund` | Exit 1 after compatible changes; four moderate entries remain. No force, peer/engine override or major-family change. |
| `npm ci --ignore-scripts --engine-strict --no-audit --no-fund` | Exit 0; reproducible final manifest/lock installation, 145 packages; scripts remain disabled. |
| `npm ls --depth=0`; `npm ls --all --omit=optional` | Both exit 0; required installed tree valid. Optional missing peers are not required dependencies. |
| `npm audit --json --loglevel=error` | Exit 1; four moderate development dependency entries, no high/critical entries. |
| `npm audit --omit=dev --json` | Exit 0; zero production dependency advisories. |
| `node --version`; Node script invoking local Vite, Vitest and Playwright CLIs with `--version` | Exit 0; versions match the table, no browser or application execution. |

Perl JSON::PP decoded both manifests and lockfiles. A lock inspection verified all 117 PHP packages have no Twig and every API Platform/Symfony framework component follows the approved line. `git check-ignore` confirms local vendor/node_modules files remain ignored. Both development and isolated-test Compose `config --quiet` checks exited 0 after digest pinning; commands match [T1 evidence](./verification.md).

Final `git diff --check` passed; all six new files passed new-file whitespace checks (exit 1 with no diagnostics indicates added-file differences). Editor diagnostics found no errors in the two manifests. Local Markdown target inspection found four pre-existing missing-source references: AGENTS and MEMORY each link the original root requirements and ER PDF, which are absent from the current checkout. A source filename search excluding Git/vendor/node_modules found neither file. No source was deleted by T2; this check is recorded as failed rather than all documentation links being declared valid. Approved specifications remain present.

## Open warnings and verification limits

- Remaining npm audit entries: `glob` 10.5.0 and `minimatch` 9.0.9, propagated through `editorconfig` 1.0.7 and `js-beautify` 1.15.4 under Vue Test Utils. Advisories: [glob cancellation traversal](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) and [minimatch amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249). No claim is made that test tooling is vulnerability-free. The compatible fix attempt did not remove them; no forced transitive major override was applied.
- Composer reports `doctrine/common` abandoned without a replacement suggestion. Its presence is transitive in the approved integration, not a new direct application abstraction. No security advisory was reported.
- Mailpit `version` printed 1.34.0 but exited 1 because its release-update lookup requires network; repeating with `MP_DISABLE_VERSION_CHECK=true` did not disable that subcommand's lookup. Only the printed binary version is recorded, not a successful Mailpit runtime check. SMTP was never started.
- No browser binaries, application startup, migrations, database initialization/volumes, keys or real SMTP delivery were performed. MySQL/Nginx versions above come from image metadata, not service health checks.
- No application behavior or unit/integration/browser test is claimed to pass. NFR-1/2/3 are supported by resolved dependencies, not fully accepted. T3 remains unauthorized.
