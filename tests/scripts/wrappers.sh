#!/bin/sh
set -eu
source_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT HUP INT TERM
root="$work/fixture"
mkdir -p "$root/backend/vendor" "$root/frontend/node_modules"
cp -R "$source_root/scripts" "$root/scripts"
: > "$root/backend/vendor/autoload.php"
: > "$root/.env"
mkdir "$work/bin"
cat > "$work/bin/docker" <<'MOCK'
#!/bin/sh
printf '<%s>' "$@" >> "$RECORDER"
printf '\n' >> "$RECORDER"
if [ -n "${IDENTITY_SECRET_FILE:-}" ]; then
  printf 'IDENTITY_TEMP=%s\n' "${IDENTITY_SECRET_FILE%/*}" >> "$RECORDER"
  [ "$(stat -c %a "${IDENTITY_SECRET_FILE%/*}")" = 700 ] || exit 98
  [ "$(stat -c %a "$IDENTITY_SECRET_FILE")" = 600 ] || exit 98
fi
case "$*" in
  'ps '*| 'network ls '*| 'volume ls '*)
    [ "${INSPECT_EXIT:-0}" = 0 ] || exit "$INSPECT_EXIT"
    case "$*" in 'volume ls '*) printf '%s' "${VOLUME_EXISTS:-}" ;; esac
    printf '%s' "${EXISTING:-}" ;;
  *assert-model.cjs*) cat >/dev/null; exit "${MODEL_EXIT:-0}" ;;
  *"--network host"*) exit "${PORT_EXIT:-0}" ;;
  *'config --format json'*) printf '{"services":{"test":{"ports":[{"published":"8081"}]}}}' ;;
  *'console.log(ports[0].published)'*) cat >/dev/null; printf '8081\n' ;;
  *' up '*) [ "${SIGNAL_UP:-0}" = 0 ] || kill -TERM "$PPID"; exit "${UP_EXIT:-0}" ;;
  'run '*|*' run '*) exit "${RUN_EXIT:-0}" ;;
esac
MOCK
chmod +x "$work/bin/docker"
export PATH="$work/bin:$PATH" RECORDER="$work/log"
: > "$RECORDER"
"$root/scripts/check" --help >/dev/null
"$root/scripts/dev" --help >/dev/null
if "$root/scripts/check" invalid 2>/dev/null; then exit 1; fi
[ ! -s "$RECORDER" ]
(cd / && "$root/scripts/check" frontend 'tests/a file.test.js')
grep -F '<tests/a file.test.js>' "$RECORDER" >/dev/null
if RUN_EXIT=37 "$root/scripts/check" frontend; then exit 1; else [ "$?" = 37 ]; fi
: > "$RECORDER"
if EXISTING=occupied "$root/scripts/check" backend 2>/dev/null; then exit 1; fi
if grep -F '<down>' "$RECORDER"; then exit 1; fi
: > "$RECORDER"
if RUN_EXIT=23 "$root/scripts/check" backend 'Some test'; then exit 1; else [ "$?" = 23 ]; fi
grep -F '<--project-name><tocaregalo-test>' "$RECORDER" >/dev/null
grep -F '<--filter><Some test>' "$RECORDER" >/dev/null
grep -F '<down><--remove-orphans>' "$RECORDER" >/dev/null
if grep -E '<(pull|install|ci|--volumes|--build)>' "$RECORDER"; then exit 1; fi
printf 'Wrapper boundary checks passed.\n'
# A second fixture proves missing inputs and paths containing spaces independently.
fixture="$work/project with spaces"
mkdir -p "$fixture/backend/vendor" "$fixture/frontend/node_modules"
cp -R "$root/scripts" "$fixture/scripts"
: > "$fixture/backend/vendor/autoload.php"
: > "$RECORDER"
if "$fixture/scripts/check" frontend 2>/dev/null; then exit 1; fi
[ ! -s "$RECORDER" ]
: > "$fixture/.env"
(cd / && "$fixture/scripts/check" frontend 'tests/file with spaces.js')
grep -F "source=$fixture/frontend,target=/workspace/frontend" "$RECORDER" >/dev/null
for command in migrate create-super-admin; do
    : > "$RECORDER"
    if "$root/scripts/dev" "$command" 2>/dev/null; then exit 1; fi
    grep -F '<bin/console><list><--raw>' "$RECORDER" >/dev/null
    if grep -E '<(up|run|doctrine:migrations:migrate|app:user:create-super-admin)>' "$RECORDER"; then exit 1; fi
done
printf 'Prerequisite, unavailable-command and spaced-path checks passed.\n'
: > "$RECORDER"
if UP_EXIT=19 "$root/scripts/check" mail 2>/dev/null; then exit 1; else [ "$?" = 19 ]; fi
grep -F '<compose.mail-smoke.yaml>' "$RECORDER" >/dev/null || grep -F 'compose.mail-smoke.yaml>' "$RECORDER" >/dev/null
grep -F '<down><--remove-orphans>' "$RECORDER" >/dev/null
: > "$RECORDER"
"$root/scripts/check" e2e chromium-desktop 'sample test.js'
grep -F '<--project=chromium-desktop><sample test.js>' "$RECORDER" >/dev/null
printf 'Mail failure cleanup and browser routing checks passed.\n'
: > "$RECORDER"
if UP_EXIT=19 "$root/scripts/check" identity 2>/dev/null; then exit 1; else [ "$?" = 19 ]; fi
grep -F 'compose.identity-verification.yaml>' "$RECORDER" >/dev/null
grep -F '<down><--remove-orphans>' "$RECORDER" >/dev/null
owned=$(sed -n 's/^IDENTITY_TEMP=//p' "$RECORDER" | head -1)
[ -n "$owned" ] && [ ! -e "$owned" ]
[ ! -d "$root/backend/var/wrapper-test.lock" ]
printf 'Identity failure cleanup routing passed.\n'
: > "$RECORDER"
if SIGNAL_UP=1 "$root/scripts/check" identity 2>/dev/null; then exit 1; else [ "$?" = 143 ]; fi
owned=$(sed -n 's/^IDENTITY_TEMP=//p' "$RECORDER" | head -1)
[ -n "$owned" ] && [ ! -e "$owned" ]
[ ! -d "$root/backend/var/wrapper-test.lock" ]
printf 'Identity SIGTERM private-material cleanup passed.\n'
: > "$RECORDER"
"$root/scripts/dev" up
grep -F '<up><-d><--no-build><--pull><never>' "$RECORDER" >/dev/null
if grep -F 'assignment_keys' "$RECORDER"; then exit 1; fi
printf 'Key-free shared startup routing passed.\n'
: > "$RECORDER"
if MODEL_EXIT=17 "$root/scripts/dev" verify 2>/dev/null; then exit 1; else [ "$?" = 17 ]; fi
if grep -E '<(up|down)>' "$RECORDER"; then exit 1; fi
: > "$RECORDER"
if UP_EXIT=29 "$root/scripts/dev" verify 2>/dev/null; then exit 1; else [ "$?" = 29 ]; fi
grep -F '<--project-name><tocaregalo-startup>' "$RECORDER" >/dev/null
grep -F 'compose.startup-verification.yaml>' "$RECORDER" >/dev/null
grep -F '<down><--remove-orphans>' "$RECORDER" >/dev/null
: > "$RECORDER"
if PORT_EXIT=18 "$root/scripts/dev" verify 2>/dev/null; then exit 1; else [ "$?" = 18 ]; fi
if grep -E '<(up|down)>' "$RECORDER"; then exit 1; fi
: > "$RECORDER"
if EXISTING=occupied "$root/scripts/dev" verify 2>/dev/null; then exit 1; fi
if grep -E '<(up|down)>' "$RECORDER"; then exit 1; fi
printf 'Main verification ownership/model/port/startup failure boundaries passed.\n'
for mode in inspect volume; do
    : > "$RECORDER"
    if [ "$mode" = inspect ]; then
        if INSPECT_EXIT=31 "$root/scripts/dev" verify 2>/dev/null; then exit 1; else [ "$?" = 31 ]; fi
    else
        if VOLUME_EXISTS=existing-volume "$root/scripts/dev" verify 2>/dev/null; then exit 1; fi
    fi
    if grep -E '<(up|down)>' "$RECORDER"; then exit 1; fi
done
mkdir "$root/backend/var/startup-verification.lock"
if "$root/scripts/dev" verify 2>/dev/null; then exit 1; fi
[ -d "$root/backend/var/startup-verification.lock" ]
rmdir "$root/backend/var/startup-verification.lock"
: > "$RECORDER"
if SIGNAL_UP=1 "$root/scripts/dev" verify 2>/dev/null; then exit 1; else [ "$?" = 143 ]; fi
grep -F '<down><--remove-orphans>' "$RECORDER" >/dev/null
[ ! -d "$root/backend/var/startup-verification.lock" ]
printf 'Daemon, existing-volume, lock and SIGTERM cleanup checks passed.\n'
