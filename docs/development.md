# Development operations

T7 exposes the installed foundation through POSIX shell entrypoints. Run from any working directory. Required host tools: Docker with Compose (2.24.4 or newer for existing overrides), Git, POSIX sh and Perl with JSON::PP for static task validation. PHP, Composer, Node and browsers run in existing containers. No wrapper installs dependencies, pulls/builds images or resets volumes. Tool images are the previously built `tocaregalo-php:dev` and `tocaregalo-node:dev`; the browser image remains digest-pinned in [verification Compose](../compose.verification.yaml).

## Commands

| Command | Responsibility |
| --- | --- |
| `scripts/dev --help`, `scripts/check --help` | Spanish usage, no daemon access. |
| `scripts/dev build` / `scripts/check build` | Compile frontend assets; never build Docker images. |
| `scripts/dev up` | Existing development Nginx/PHP/MySQL/frontend and Mailpit; no implicit workers. Fails if assignment key file is unavailable. |
| `scripts/dev down` | Stop only the explicit `tocaregalo` development project; keep volumes. |
| `scripts/dev migrate`, `scripts/dev create-super-admin` | Read-only command discovery in an already running PHP service; delegate only if registered and attached to an interactive terminal. Currently unavailable; no runtime is started and no migrations/accounts are performed. |
| `scripts/check static` | Shell syntax, whitespace, secret ignore, Compose models, package JSON and VS Code task mappings, orchestration tests. |
| `scripts/check phpstan` | PHPStan fixed level 10 on all owned PHP/tests with existing configuration; no network/services. |
| `scripts/check backend [filter]` | Real isolated MySQL PHPUnit, explicitly excluding optional mail group. |
| `scripts/check mail [filter]` | Separate local Mailpit/MySQL fixture suite including mail tests. |
| `scripts/check frontend [file]` | Vitest with installed Node toolchain and no network/services. |
| `scripts/check e2e [project [file]]` | Four configured Playwright projects by default; optionally one allowlisted project and positional test file. |
| `scripts/check all` (or no argument) | Static → PHPStan → backend → mail → frontend → build → e2e, stop at first failure. Complete aggregate execution belongs to T8. |

Filters/files cannot begin with `-`; arbitrary tool options and Compose/DSN overrides are not accepted. Missing inputs, unavailable images and failed/empty suites fail visibly. VS Code **Run Task** exposes the same entrypoints with explicit workspace cwd and no automatic startup. Task JSON resolution checks do not demonstrate a GUI task launch.

## Configuration and isolation

Use only the ignored root `.env`, shared with Symfony through a read-only bind. Keep it mode 600; never print resolved Compose configuration or credentials into logs. See [.env.example](../.env.example) for required names and [README](../README.md) for Spanish setup notes. Existing dependency directories/images must already be present after a separately authorized installation. Wrappers refuse missing inputs rather than install them.

Development HTTP is loopback 8080 and Mailpit UI 8025 by default. Test browser HTTP is 8081; test Mailpit UI is 8026. MySQL and SMTP remain internal. Backend/browser use [T5 Compose](../compose.verification.yaml); mail uses [T6 Compose](../compose.mail-smoke.yaml), always explicit project `tocaregalo-test`. MySQL data is tmpfs. No wrapper targets the development database for tests.

Service-owning tests reject existing test containers/networks, take an exclusive ignored directory lock, and check the configured published loopback port before startup. A later port race is still possible: Docker reports startup failure and cleanup removes only this invocation's test project. Do not operate that reserved project manually while a wrapper runs. Success/failure/INT/TERM trigger scoped teardown without volume deletion; SIGKILL cannot be trapped. After a host crash, inspect remaining resources before manually removing the stale `backend/var/wrapper-test.lock`; never remove an active invocation's lock. Node/PHPStan use standalone `--rm` containers without network access, so they create no Compose network.

The PHP database fixture guard independently verifies the declared test URL/database and forbids development targets before connecting. Optional mail tests only accept the local SMTP service; existing T6 transient transport setup is confined to tmpfs. Recorder tests prove argument routing and failure handling only, not real DB/mail/browser correctness.

## Incomplete business operations and workers

Current browser content is the Spanish preparation shell, not a gift draw application. Migration configuration/schema and the interactive SUPERADMIN command are not yet implemented. Guarded wrappers currently fail if the PHP service or registered command is absent; discovery only lists commands and does not start services. No credentials are accepted as wrapper arguments.

Assignment keys are not provisioned. The [approved key policy](../specs/001-toca-regalo/plan.md#proposed-key-policy-for-approval) requires an explicitly authorized cryptographically random 32-byte master secret, independent labeled encryption/HMAC derivation, a versioned ring mounted read-only outside image/repository/database/log/frontend, and separately encrypted offline key backups. Restoration must be tested with a database copy. Retain versions needed by live envelopes or restorable backups; no arbitrary retention interval is established. Key-file schema/generator and rotation operations are future work: do not invent a JSON file or dummy key to bypass startup.

Worker profiles are opt-in. Restart workers after code changes; they share the PHP tool image. SIGTERM exits 143 were observed in T6; completion of in-flight business messages has not been demonstrated. Real scheduled closure is 004:T8, with independent immediate closure guards; the fixture probe is not deadline evidence.

## SMTP and outstanding limits

Deployment operators supply SMTP host, port, TLS mode, authentication user/password where required, and sender address/display name through environment/secret management. Development uses Mailpit, not external delivery. Do not request production credentials for local checks or commit real values. External delivery, recovery/assignment business email content and monitoring remain their respective future slices.

Historical audits report four moderate npm development advisories and abandoned doctrine/common, with zero PHP security advisories and zero npm production advisories at their recorded runs. The Composer license warning is also retained. See [dependency evidence](../specs/002-development-foundation/dependency-resolution.md) and [verification](../specs/002-development-foundation/verification.md); T7 does not silently refresh dependencies or claim new audit results.
