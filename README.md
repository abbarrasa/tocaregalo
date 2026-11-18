# Toca Regalo

Aplicación web para organizar grupos y eventos de intercambio de regalos. El desarrollo sigue SDD: los requisitos, el plan y las tareas aprobados están en el [índice del proyecto](./specs/001-toca-regalo/tasks.md).

## Estado actual

Se han completado **002:T1–T7 y 002:T9**: configuración y dependencias, API JSON con conexión MySQL verificada, PHPStan y una base Vue/Bootstrap servida por Nginx. Se han comprobado escritorio y móvil, HMR y archivos compilados. T5 incorpora PHPUnit con MySQL aislado, tests de componentes y pruebas de navegador. T6 añade captura local de correo y entradas de procesos verificadas. T7 incorpora comandos reproducibles, tareas de VS Code y documentación operativa. Faltan las funciones de negocio, las migraciones, sus pruebas y los trabajadores. Esta entrega todavía no permite realizar sorteos.

Con autorización previa se han descargado las seis imágenes previstas y la imagen de verificación Playwright 1.65.1, construido las dos herramientas e instalado las dependencias dentro de contenedores. [.env.example](./.env.example) fija las imágenes de desarrollo por digest y mantiene los marcadores públicos de secretos. No se han generado claves de asignación. Los entornos temporales de comprobación se han retirado. El [registro técnico](./specs/002-development-foundation/verification.md) recoge resultados y límites; los avisos de dependencias registrados en T2/T9 siguen pendientes.

## Configuración prevista

Symfony (HTTP y consola) y la comprobación temporal utilizan el mismo `.env` local de la raíz. Ya está preparado con secretos aleatorios locales, permisos `600` y excluido de Git. `DATABASE_URL` corresponde a los parámetros MySQL suministrados; las contraseñas no se muestran ni se guardan en documentación. T3 verificó la conexión real en memoria y retiró el entorno temporal; no hay MySQL de T3 ejecutándose. No envíes contraseñas por el chat ni fuerces la inclusión del `.env` en Git.

- Symfony/API Platform con PHP 8.5, MySQL 8.4 y Nginx.
- Vue 3 y Bootstrap 5.3, con Node 24 y Vite 8.
- Mailpit para capturar los correos de desarrollo, sin envío a destinatarios reales.
- Trabajadores independientes para notificaciones y cierre de eventos; usan la misma imagen PHP.

La configuración está en [compose.yaml](./compose.yaml), con un entorno separado de pruebas definido por [compose.test.yaml](./compose.test.yaml). El backend será exclusivamente una API JSON; Vue construirá las pantallas. No se usa Twig.

## Comprobar los archivos sin instalar ni arrancar servicios

Necesitas Docker Compose ya disponible en tu equipo. Estas comprobaciones solo interpretan la configuración; no descargan imágenes, construyen contenedores ni ejecutan la aplicación:

```bash
docker compose --env-file .env.example -f compose.yaml --profile workers config --quiet
docker compose --project-name tocaregalo-test --env-file .env.example -f compose.yaml -f compose.test.yaml --profile workers config --quiet
git diff --check
```

La sobreescritura de puertos de pruebas usa `!override`, que requiere Docker Compose 2.24.4 o posterior. Se ha detectado Compose 5.7.1 en el entorno de preparación.

## Preparación posterior, pendiente de autorización

1. Tras T8, solicitar autorización para la validación SDD de solo lectura del bloque 002; esperar su aprobación antes de iniciarla.
2. Conservar los digests y archivos de bloqueo revisados. Las instalaciones de dependencias nunca deben ejecutarse implícitamente al arrancar; futuras descargas fuera del alcance autorizado requieren aprobación.
3. Completar las pruebas y funciones de Symfony y Vue en sus tareas correspondientes. El arranque nunca instalará sus dependencias automáticamente.
4. Crear un archivo local ignorado a partir de [.env.example](./.env.example). Los valores `REVIEW_ONLY_*` son marcadores públicos para validar archivos: deben sustituirse antes de cualquier ejecución. No representan secretos de desarrollo utilizables.
5. Configurar el usuario local mediante `LOCAL_UID` y `LOCAL_GID`, y `APP_TIMEZONE` con la zona horaria del sistema de instalación. Europe/Madrid es solo el ejemplo. La base de datos almacenará instantes en UTC y la aplicación interpretará las fechas con la zona configurada.
6. Al implementar el cifrado en 005:T2, suministrar las claves de asignación como archivos secretos separados para desarrollo y pruebas, según la política aprobada. Ninguna imagen ni comando de arranque generará claves automáticamente. No se deben guardar en Git ni facilitar por el chat.
7. Completar las tareas de API, frontend, pruebas y trabajadores antes de validar un arranque funcional.

Las contraseñas elegidas para MySQL y las credenciales codificadas en `DATABASE_URL` deben corresponderse; los caracteres especiales del usuario/contraseña dentro de esa URL necesitan codificación URI. El servidor MySQL no publica puertos en el equipo anfitrión.

## Direcciones previstas

Los servicios de Compose usan el prefijo `tocaregalo-`: `tocaregalo-mysql`, `tocaregalo-php`, `tocaregalo-frontend`, `tocaregalo-nginx`, `tocaregalo-mailpit`, `tocaregalo-notification-worker` y `tocaregalo-closure-worker`. La comprobación temporal utiliza `tocaregalo-php-smoke`. En `DATABASE_URL`, el host interno es `tocaregalo-mysql` y el puerto es `3306`; el SMTP local usa `tocaregalo-mailpit:1025`. Compose añade además el nombre del proyecto a los contenedores, conservando la separación entre desarrollo y pruebas.

| Servicio | Desarrollo | Pruebas |
| --- | --- | --- |
| Aplicación mediante Nginx | `http://localhost:8080` | `http://localhost:8081` |
| Bandeja de correo local | `http://localhost:8025` | `http://localhost:8026` |

Solo Nginx y la bandeja local publican puertos, vinculados a `127.0.0.1`. PHP, Node, MySQL y SMTP permanecen dentro de la red de Compose. El perfil `workers` habilita los trabajadores cuando sus comandos estén implementados. No se ejecutan durante esta tarea.

El proyecto de pruebas se llama `tocaregalo-test` y tiene sus propios volúmenes, base de datos y, cuando se implemente el cifrado, claves separadas. Usa siempre `--project-name tocaregalo-test`: esta opción prevalece sobre `COMPOSE_PROJECT_NAME`, cuyo valor de ejemplo identifica el entorno de desarrollo. No debe ejecutarse usando el nombre del proyecto de desarrollo ni apuntar a su base de datos. No hay borrado automático de volúmenes.

## Correo y secretos

En desarrollo, `MAILER_DSN` apunta a Mailpit en el puerto interno 1025. La bandeja de Mailpit permite inspeccionar mensajes y enlaces de recuperación de las cuentas de prueba; no es una pantalla para usuarios de la aplicación ni un servicio de producción.

El correo real se configurará por entorno con servidor, puerto, STARTTLS/TLS, autenticación y remitente autorizado. Las credenciales se suministrarán fuera del repositorio. Los valores de ejemplo usan el dominio reservado `.test` y no deben sustituirse por secretos en archivos versionados.

## Comprobaciones todavía pendientes

T3 verifica el núcleo JSON y una conexión real a MySQL; T4 verifica Vue y Nginx con Chromium, escritorio y móvil. Todavía están pendientes el entorno completo, las funciones de la aplicación, el correo, los trabajadores y las pruebas de producto en los demás navegadores previstos.

## Comprobar la base Vue y Nginx

Usa las dependencias e imágenes ya autorizadas y preparadas; estos comandos no instalan nada. Requieren el archivo privado de entorno existente. Ejecuta desde la raíz y comprueba que `127.0.0.1:8082` esté libre. El proyecto temporal no inicia MySQL ni trabajadores.

```bash
docker run --rm --pull never --user "$(id -u):$(id -g)" \
  -v "$PWD/frontend:/workspace/frontend" -w /workspace/frontend \
  tocaregalo-node:dev sh -c 'npm test -- tests/api-client.test.js && npm run build'
docker compose --env-file .env --project-name tocaregalo-t4 -f compose.frontend-smoke.yaml \
  up --detach --no-build --pull never tocaregalo-php tocaregalo-frontend tocaregalo-nginx
docker compose --env-file .env --project-name tocaregalo-t4 -f compose.frontend-smoke.yaml \
  run --rm --no-deps --pull never tocaregalo-browser
```

La pantalla provisional estará en `http://localhost:8082`. La prueba HMR modifica y restaura únicamente su componente provisional. Para comprobar el compilado sin Vite:

```bash
docker compose --env-file .env --project-name tocaregalo-t4 -f compose.frontend-smoke.yaml \
  stop tocaregalo-frontend
SMOKE_NGINX_MODE=static docker compose --env-file .env --project-name tocaregalo-t4 \
  -f compose.frontend-smoke.yaml up --detach --no-build --pull never tocaregalo-nginx
SMOKE_NGINX_MODE=static SMOKE_MODE=static docker compose --env-file .env \
  --project-name tocaregalo-t4 -f compose.frontend-smoke.yaml \
  run --rm --no-deps --pull never tocaregalo-browser
docker compose --env-file .env --project-name tocaregalo-t4 \
  -f compose.frontend-smoke.yaml --profile checks down
```

La imagen de navegador está fijada por digest en [compose.frontend-smoke.yaml](./compose.frontend-smoke.yaml). Los archivos compilados y las capturas quedan ignorados dentro de `frontend/dist`. Los comandos de limpieza no borran volúmenes de datos.

## Análisis estático de PHP

Después de cada tarea de implementación, ejecuta PHPStan en nivel **10** sobre todo el PHP propio, incluidos los tests. La tarea solo puede cerrarse con cero errores; no se permite ocultarlos mediante una línea base. La configuración está en [phpstan.neon.dist](./backend/phpstan.neon.dist).

Desde la raíz del proyecto, con la imagen PHP ya preparada:

```bash
docker run --rm --pull never --user "$(id -u):$(id -g)" \
  -v "$PWD/backend:/workspace/backend" -w /workspace/backend \
  tocaregalo-php:dev composer analyse
```

Este comando no instala paquetes ni monta el archivo privado de entorno. Analiza `src`, `tests`, `config`, `public` y `bin/console`; las dependencias aportan sus tipos, pero no se analizan como código propio. El resultado no sustituye las pruebas de ejecución. La instalación requiere autorización independiente.

## Suites de verificación

T5 prepara PHPUnit, Vitest con componentes Vue y Playwright en Chromium escritorio/móvil, Firefox y WebKit. Las pruebas actuales cubren la base técnica; todavía no prueban funciones de sorteo.

Usa el archivo privado de entorno con los parámetros `TEST_DATABASE_URL` y `TEST_MYSQL_DATABASE` coherentes con las credenciales locales. La base de pruebas debe ser distinta de desarrollo. Comprueba que no exista otro proyecto `tocaregalo-test` en ejecución y que su puerto HTTP (8081 por defecto) esté libre. No cambies el nombre del proyecto ni apuntes sus pruebas a datos de desarrollo.

```bash
docker compose --env-file .env --project-name tocaregalo-test -f compose.verification.yaml \
  up --detach --no-build --pull never --wait --wait-timeout 120 tocaregalo-mysql
docker compose --env-file .env --project-name tocaregalo-test -f compose.verification.yaml \
  run --rm --no-deps --pull never tocaregalo-php-tests
docker compose --env-file .env --project-name tocaregalo-test -f compose.verification.yaml \
  run --rm --no-deps --pull never tocaregalo-node-tests
docker compose --env-file .env --project-name tocaregalo-test -f compose.verification.yaml \
  up --detach --no-build --pull never tocaregalo-php tocaregalo-frontend tocaregalo-nginx
docker compose --env-file .env --project-name tocaregalo-test -f compose.verification.yaml \
  run --rm --no-deps --pull never tocaregalo-browser
docker compose --env-file .env --project-name tocaregalo-test -f compose.verification.yaml \
  run --rm --no-deps --pull never tocaregalo-php-tests composer analyse
docker compose --env-file .env --project-name tocaregalo-test -f compose.verification.yaml \
  --profile checks down
```

La configuración de [compose.verification.yaml](./compose.verification.yaml) es independiente del entorno completo: no necesita claves de asignación ni inicia correo o trabajadores. MySQL usa memoria temporal y no publica puertos. Las fixtures crean únicamente una tabla temporal y usan rollback, también ante errores; no se borran esquemas ni volúmenes. Las suites rechazan destinos inseguros antes de conectar. Ningún comando instala dependencias. Retira el entorno con el último comando incluso si alguna prueba falla; los informes ignorados quedan en `frontend/test-results`.

## Correo local y entradas de trabajadores

T6 configura Symfony Mailer y Messenger. El correo se envía de forma síncrona dentro del trabajador; no hay una segunda cola oculta de mensajes completos. El transporte de notificaciones conserva cinco reintentos, base configurable, multiplicador dos y sin variación aleatoria ni límite de demora. Las reglas de notificación de la aplicación se implementarán en sus bloques correspondientes.

La comprobación temporal usa Mailpit y MySQL en memoria, con el mismo proyecto aislado `tocaregalo-test`. No la ejecutes simultáneamente con las suites anteriores. Verifica que el proyecto esté libre y que el puerto local de Mailpit (`TEST_MAILPIT_PORT`, 8026 por defecto) no esté ocupado.

```bash
docker compose --env-file .env --project-name tocaregalo-test -f compose.mail-smoke.yaml \
  up --detach --no-build --pull never --wait --wait-timeout 120 tocaregalo-mysql tocaregalo-mailpit
docker compose --env-file .env --project-name tocaregalo-test -f compose.mail-smoke.yaml \
  run --rm --no-deps --pull never tocaregalo-php-tests
docker compose --env-file .env --project-name tocaregalo-test -f compose.mail-smoke.yaml \
  run --rm --no-deps --pull never tocaregalo-php-tests composer analyse
docker compose --env-file .env --project-name tocaregalo-test -f compose.mail-smoke.yaml \
  --profile checks down
```

La prueba crea explícitamente la tabla de transporte solo en la base temporal validada, encola un identificador de fixture y verifica el mensaje capturado, su remitente, destinatario y contenido. Fuerza SMTP a Mailpit, sin contactar servicios externos. La bandeja estará en `http://localhost:8026` mientras el entorno siga activo; SMTP no publica puertos. El entorno T5 sin correo excluye el grupo `mail`; esta suite T6 sí lo ejecuta completo.

Los lanzadores de [notificaciones](./docker/worker/entrypoint.sh) y [cierre](./docker/scheduler/entrypoint.sh) comparten la imagen PHP, transmiten argumentos y señales, y conservan los códigos de error. Los trabajadores de consola usan `SIGTERM`; las pruebas comprobaron terminación con código 143, sin garantizar finalización de trabajos en curso. El comando real de cierre sigue pendiente de 004:T8: su invocación actualmente falla de forma visible. El probe de T6 es exclusivo de pruebas y no cierra eventos. No actives los trabajadores del entorno completo como si la funcionalidad de negocio estuviera terminada.

## Comandos de desarrollo y comprobación

Los scripts requieren `sh`, Git, Perl con JSON::PP (comprobación estática), Docker y Compose, además de las imágenes y dependencias ya instaladas con autorización. No instalan paquetes, descargan imágenes, generan claves ni eliminan volúmenes.

```bash
scripts/dev --help
scripts/check static
scripts/check phpstan
scripts/check backend
scripts/check frontend
scripts/check mail
scripts/check e2e chromium-desktop
scripts/dev build
```

`backend` admite un filtro de PHPUnit; `frontend`, un archivo; `mail`, un filtro; `e2e`, un proyecto y opcionalmente un archivo. Sin proyecto ejecuta los cuatro perfiles configurados. `scripts/check all` (también sin argumentos) los encadena y se detiene ante el primer error; la verificación completa corresponde a T8.

`scripts/dev up` inicia la base técnica con las imágenes y dependencias existentes, sin exigir claves que todavía no se utilizan. `scripts/dev down` detiene únicamente el proyecto de desarrollo y conserva sus volúmenes. `build` compila Vue, no construye imágenes Docker. `migrate` y `create-super-admin` indican que sus operaciones de negocio todavía no están disponibles, sin modificar datos.

Las pruebas con servicios reservan `tocaregalo-test`, usan MySQL temporal y se retiran al terminar o fallar. Rechazan un entorno de pruebas existente y los puertos ocupados. HTTP de pruebas usa 8081 y Mailpit 8026 por defecto; desarrollo usa 8080 y 8025. Si falta `.env`, una dependencia, una imagen o un parámetro, corrige el requisito indicado; los scripts no lo sustituyen automáticamente. No ejecutes otro proceso sobre el proyecto reservado durante las pruebas.

En VS Code, **Terminal → Ejecutar tarea** ofrece los mismos comandos; abrir el proyecto no arranca servicios. Los detalles técnicos, los límites de los trabajadores y la política de claves y SMTP están en [la guía de desarrollo](./docs/development.md). Para SMTP de despliegue habrá que facilitar servidor, puerto, seguridad TLS, autenticación si procede y remitente; las comprobaciones locales solo usan Mailpit.

## Resultado de la comprobación de T8

El agregado `scripts/check all` ha terminado correctamente: PHPUnit de backend (23 pruebas), suite local de correo (29), Vitest (12), compilación y Playwright (8 pruebas en Chromium de escritorio y móvil, Firefox y WebKit). PHPStan mantiene nivel 10 sin errores. Los entornos temporales se han retirado sin borrar volúmenes.

En la comprobación histórica de T8, el arranque principal quedó pendiente de las claves; T10 corrige esa dependencia prematura. Las migraciones de la aplicación, el comando SUPERADMIN y las funciones de negocio todavía no están implementados. No se han instalado paquetes ni generado secretos en T8. La validación SDD y su aceptación son el siguiente paso, sujeto a autorización. Consulta los [resultados y límites](./specs/002-development-foundation/verification.md#t8-execution-record).

## Verificar el arranque principal sin datos persistentes

Ejecuta `scripts/dev verify` con las imágenes y dependencias ya preparadas. Usa los mismos servicios y la misma función de arranque que `scripts/dev up`, con un proyecto temporal fijo `tocaregalo-startup`, MySQL en memoria y puertos locales 8083 (HTTP) y 8028 (Mailpit). Rechaza recursos existentes de desarrollo o verificación y puertos ocupados; no los elimina ni reutiliza. Conserva el archivo privado de entorno y no crea claves, cuentas ni migraciones.

Comprueba conexión MySQL de solo lectura, API JSON y navegación Chromium de escritorio y móvil; al terminar o fallar retira solo sus contenedores y red, sin borrar volúmenes. No equivale a probar la inicialización de un volumen persistente ni las funciones de sorteo. Si se interrumpe por un cierre forzoso del sistema, inspecciona los recursos y el bloqueo ignorado antes de limpiarlos manualmente.

Las claves serán obligatorias en los consumidores de cifrado cuando se implemente 005:T2, con validación y rechazo de operaciones si faltan o son inválidas. Los valores de claves de [.env.example](./.env.example) quedan reservados para ese trabajo futuro.

## Base de identidad

La primera migración de identidad y sus mappings están implementados y comprobados en el entorno temporal. Las comprobaciones de esta tarea aplican y revierten esa migración únicamente en el MySQL temporal de pruebas; no se ha migrado la base de desarrollo ni creado cuentas reales. El comando de migraciones ya está registrado, pero no se ejecuta automáticamente al arrancar. El comando SUPERADMIN se describe a continuación; la autenticación y las pantallas de cuenta siguen pendientes.

## Crear una cuenta SUPER ADMIN

El comando `app:user:create-super-admin` solicita correo, nombre, apellidos opcionales, teléfono con prefijo `+` y una contraseña confirmada. La contraseña no se muestra y admite un mínimo de seis caracteres y un máximo de 4096 bytes UTF-8. Si el correo o teléfono ya existe, la cuenta existente no se modifica.

Con el servicio PHP iniciado y las migraciones aplicadas en el entorno elegido, se ejecuta manualmente en una terminal:

```sh
docker compose --env-file .env exec tocaregalo-php php bin/console app:user:create-super-admin
```

No admite ejecución con `--no-interaction`. El rol se crea si falta, junto con la cuenta en una única transacción. No verifica cuentas ni envía correos. Esta tarea solo usa cuentas sintéticas en una base temporal para sus comprobaciones; no ha aplicado migraciones ni creado una cuenta real en desarrollo. La autenticación y sus pantallas siguen pendientes.

## API de sesión

La API permite iniciar sesión con correo o teléfono y contraseña. Primero solicita `GET /api/csrf`, conservando la cookie `TOCAREGALO_SESSION`; envía el token recibido en `X-CSRF-Token` al hacer `POST /api/login` con los campos JSON `identifier` y `password`.

`GET /api/me` devuelve únicamente los datos y roles de la cuenta autenticada. `POST /api/logout`, con el token CSRF de esa sesión, la cierra e invalida su acceso anterior. Las respuestas no se deben guardar en caché. La cookie es HttpOnly, usa SameSite=Lax y se marca Secure en HTTPS; el despliegue requiere HTTPS.

Se necesita aplicar las migraciones del entorno elegido, incluida la tabla de sesiones, antes de usar estos endpoints. Las comprobaciones del proyecto solo migran y crean usuarios sintéticos en MySQL temporal; no han preparado la base de desarrollo. Las pantallas de login, recuperación y cuenta siguen pendientes.

### Modificar la cuenta propia

Con una sesión iniciada, `PATCH /api/me` acepta un objeto JSON no vacío con los campos que se quieren modificar: `firstName`, `lastName`, `email`, `phone` y `password`. Requiere el encabezado `X-CSRF-Token` de la sesión. Los campos omitidos conservan su valor; `lastName` admite `null` o un texto en blanco para eliminar los apellidos. La contraseña mantiene exactamente los caracteres introducidos y exige al menos seis caracteres y como máximo 4096 bytes UTF-8.

La respuesta correcta devuelve los datos propios, sin contraseña. Los errores de validación devuelven estado 422 y mensajes en español asociados a cada campo mediante `fields`. El email y el teléfono deben ser únicos; una petición inválida no modifica la cuenta. Los cambios de email, teléfono o contraseña se aplican a los siguientes inicios de sesión. Esta operación no permite cambiar roles ni otras cuentas. La creación de miembros por el propietario y los formularios siguen pendientes de sus tareas correspondientes.

### Recuperación de contraseña: estado del desarrollo

El ciclo interno de recuperación ya permite emitir un token, sustituir los anteriores y cambiar la contraseña una sola vez antes de su caducidad. `PASSWORD_RESET_TTL_SECONDS` configura la duración de los nuevos enlaces; el valor predeterminado es `3600` segundos. La base de datos guarda únicamente el hash del token. El backend de correo y sus rutas se describen en el siguiente apartado; los formularios siguen pendientes.

### API y correo de recuperación

`POST /api/password-recovery` recibe `identifier` (email o teléfono internacional). `POST /api/password-reset` recibe `token` y `password`. Ambas operaciones requieren JSON y el encabezado `X-CSRF-Token` obtenido de la sesión. La solicitud de recuperación devuelve el mismo mensaje para cuentas existentes y desconocidas; el cambio válido devuelve estado 204 y permite iniciar sesión con la nueva contraseña.

El correo utiliza un enlace con el token en el fragmento de la URL. Los formularios se implementarán en T7. Antes de usar el correo en desarrollo deben aplicarse las migraciones y aprovisionarse, con autorización, `RECOVERY_DELIVERY_KEY` en el entorno privado. La clave real no se genera con esta tarea; las comprobaciones de correo usan claves desechables y Mailpit. Los errores de configuración no deben resolverse copiando secretos al repositorio.
