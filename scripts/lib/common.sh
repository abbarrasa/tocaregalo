# Shared POSIX orchestration helpers. Dotenv is data, never shell code.
EXTRA_MODEL=
IDENTITY_TEMP_DIR=
fail() { printf '%s\n' "$*" >&2; exit 2; }
require_inputs() {
    command -v docker >/dev/null 2>&1 || fail 'Falta Docker con Compose.'
    [ -f "$ROOT/.env" ] || fail 'Falta el archivo privado .env en la raíz.'
    [ -f "$ROOT/backend/vendor/autoload.php" ] || fail 'Faltan las dependencias PHP autorizadas.'
    [ -d "$ROOT/frontend/node_modules" ] || fail 'Faltan las dependencias frontend autorizadas.'
}
compose() {
    if [ -n "${EXTRA_MODEL:-}" ]; then
        docker compose --env-file "$ROOT/.env" --project-name "$PROJECT" -f "$ROOT/$MODEL" -f "$ROOT/$EXTRA_MODEL" "$@"
        return
    fi
    docker compose --env-file "$ROOT/.env" --project-name "$PROJECT" -f "$ROOT/$MODEL" "$@"
}
node_run() {
    docker run --rm --network none --pull never --user "$(id -u):$(id -g)" \
        --mount "type=bind,source=$ROOT/frontend,target=/workspace/frontend" \
        --workdir /workspace/frontend tocaregalo-node:dev "$@"
}
analyse() {
    docker run --rm --network none --pull never --user "$(id -u):$(id -g)" \
        --mount "type=bind,source=$ROOT/backend,target=/workspace/backend" \
        --mount "type=bind,source=$ROOT/.env,target=/workspace/.env,readonly" \
        --workdir /workspace/backend --env APP_ENV=test tocaregalo-php:dev \
        vendor/bin/phpstan analyse --configuration=phpstan.neon.dist --no-progress
}
php_run() { compose run --rm --no-deps -T tocaregalo-php-tests "$@"; }
cleanup() {
    result=$?
    trap - EXIT HUP INT TERM
    if [ "$OWNED" = yes ]; then
        compose down --remove-orphans || { [ "$result" -ne 0 ] || result=1; }
    fi
    if [ -n "$IDENTITY_TEMP_DIR" ]; then
        rm -f "$IDENTITY_SECRET_FILE" "$IDENTITY_CONTROL_DIR"/*.request.json "$IDENTITY_CONTROL_DIR"/*.response.json
        rmdir "$IDENTITY_CONTROL_DIR" "$IDENTITY_TEMP_DIR"
    fi
    [ -z "${LOCK:-}" ] || rmdir "$LOCK"
    exit "$result"
}
claim_test_stack() {
    containers=$(docker ps -aq --filter label=com.docker.compose.project=tocaregalo-test)
    [ -z "$containers" ] || fail 'Ya existe un entorno tocaregalo-test; no se modifica.'
    networks=$(docker network ls -q --filter label=com.docker.compose.project=tocaregalo-test)
    [ -z "$networks" ] || fail 'Ya existe una red tocaregalo-test; no se modifica.'
    # A private mkdir lock excludes concurrent invocations, including during startup.
    LOCK="$ROOT/backend/var/wrapper-test.lock"
    mkdir -p "$ROOT/backend/var"
    mkdir "$LOCK" 2>/dev/null || fail 'Otra comprobación posee el bloqueo de pruebas.'
    OWNED=no
    trap 'cleanup' EXIT
    trap 'exit 130' INT
    trap 'exit 143' HUP TERM
    if [ "$selection" = identity ]; then
        IDENTITY_TEMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/tocaregalo-identity.XXXXXX")
        IDENTITY_SECRET_FILE="$IDENTITY_TEMP_DIR/secret.env"
        IDENTITY_CONTROL_DIR="$IDENTITY_TEMP_DIR/control"
        export IDENTITY_SECRET_FILE IDENTITY_CONTROL_DIR
        mkdir -m 700 "$IDENTITY_CONTROL_DIR"
        (umask 077; docker run --rm --network none --pull never tocaregalo-php:dev php -r 'echo "RECOVERY_DELIVERY_KEY=".base64_encode(random_bytes(32))."\n";' > "$IDENTITY_SECRET_FILE")
    fi
    case "$selection" in
        e2e|mail|identity)
            port=$(compose config --format json | docker run --rm -i --pull never tocaregalo-node:dev node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{const m=JSON.parse(s); const ports=Object.values(m.services).flatMap(v=>v.ports??[]); console.log(ports[0].published)})')
            case "$port" in *[!0-9]*|"" ) fail "Puerto de pruebas no válido." ;; esac
            docker run --rm --network host --pull never tocaregalo-node:dev node -e 'const s=require("net").createServer();s.on("error",()=>process.exit(2));s.listen(Number(process.argv[1]),"127.0.0.1",()=>s.close())' "$port" || fail "El puerto de pruebas está ocupado."
            ;;
    esac
    OWNED=yes
}

# Both development and isolated verification use the same main service graph.
start_application() {
    compose up -d --no-build --pull never --wait --wait-timeout 120 tocaregalo-nginx tocaregalo-mailpit
}
