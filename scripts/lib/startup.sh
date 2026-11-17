# Only scripts/dev verify loads this fixed main-graph verification lifecycle.
refuse_existing_startup() {
    for project in tocaregalo tocaregalo-startup; do
        for resource in container network volume; do
            case "$resource" in
                container) found=$(docker ps -aq --filter "label=com.docker.compose.project=$project") ;;
                *) found=$(docker "$resource" ls -q --filter "label=com.docker.compose.project=$project") ;;
            esac
            [ -z "$found" ] || fail 'Existe un recurso de desarrollo/verificación; no se modifica.'
        done
    done
}
startup_node() {
    docker run --rm -i --network none --pull never --user "$(id -u):$(id -g)" \
        --mount "type=bind,source=$ROOT/tests/startup,target=/checks,readonly" tocaregalo-node:dev node "$@"
}
startup_cleanup() {
    result=$?
    trap - EXIT HUP INT TERM
    if [ "$OWNED" = yes ]; then
        compose down --remove-orphans || { [ "$result" -ne 0 ] || result=1; }
    fi
    rmdir "$LOCK" || { [ "$result" -ne 0 ] || result=1; }
    exit "$result"
}
verify_startup() {
    PROJECT=tocaregalo-startup
    EXTRA_MODEL=compose.startup-verification.yaml
    refuse_existing_startup
    LOCK="$ROOT/backend/var/startup-verification.lock"
    mkdir -p "$ROOT/backend/var"
    mkdir "$LOCK" 2>/dev/null || fail 'Otra verificación posee el bloqueo de arranque.'
    OWNED=no
    trap 'startup_cleanup' EXIT
    trap 'exit 130' INT
    trap 'exit 143' HUP TERM
    refuse_existing_startup
    # Model contents remain private inside this pipeline, not temporary files/logs.
    base=$(EXTRA_MODEL= compose config --format json)
    model=$(compose config --format json)
    printf '%s\n--STARTUP-MODEL--\n%s' "$base" "$model" | startup_node /checks/assert-model.cjs
    unset base model
    docker run --rm --network host --pull never tocaregalo-node:dev node -e '
      const net=require("net");
      Promise.all([8083,8028].map(port=>new Promise((resolve,reject)=>{
        const server=net.createServer();server.on("error",reject);
        server.listen(port,"127.0.0.1",()=>server.close(resolve));
      }))).catch(()=>{console.error("Puerto de verificación ocupado.");process.exitCode=2})'
    OWNED=yes
    start_application
    compose exec -T tocaregalo-php php -r 'require "vendor/autoload.php"; (new Symfony\Component\Dotenv\Dotenv())->bootEnv("/workspace/.env"); $kernel=new App\Kernel("dev", false);$kernel->boot();try{$db=$kernel->getContainer()->get("doctrine")->getConnection();if((int)$db->fetchOne("SELECT 1")!==1||$db->fetchOne("SELECT @@session.time_zone")!=="+00:00"){exit(2);}echo "Main PHP/MySQL read-only connection and UTC passed.\n";}catch(Throwable){fwrite(STDERR,"Database check failed.\n");exit(2);}'
    docker run --rm --pull never --network tocaregalo-startup_default --mount "type=bind,source=$ROOT/tests/startup,target=/checks,readonly" tocaregalo-node:dev node /checks/readiness.cjs
    ids=$(compose ps -q tocaregalo-mysql tocaregalo-nginx tocaregalo-mailpit)
    docker inspect $ids --format '{"Service":{{json (index .Config.Labels "com.docker.compose.service")}},"Ports":{{json .HostConfig.PortBindings}},"Tmpfs":{{json .HostConfig.Tmpfs}},"Health":{{if .State.Health}}{{json .State.Health.Status}}{{else}}null{{end}},"Mounts":{{json .Mounts}}}' | startup_node /checks/assert-runtime.cjs
    docker run --rm --pull never --init --shm-size 1g --network tocaregalo-startup_default \
        --user "$(id -u):$(id -g)" --workdir /workspace/frontend \
        --mount "type=bind,source=$ROOT/frontend,target=/workspace/frontend" \
        --mount "type=bind,source=$ROOT/playwright.config.js,target=/workspace/playwright.config.js,readonly" \
        --mount "type=bind,source=$ROOT/tests/e2e,target=/workspace/tests/e2e,readonly" \
        --env PLAYWRIGHT_BASE_URL=http://tocaregalo-nginx \
        mcr.microsoft.com/playwright:v1.65.1-noble@sha256:1507cbfc550a63a6b7396791ca4f00df17beb56342d2447b3f106c306f525579 \
        npm run test:e2e -- --project=chromium-desktop --project=chromium-mobile
}
