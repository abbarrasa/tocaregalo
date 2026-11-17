# Toca Regalo

Aplicación web para organizar grupos y eventos de intercambio de regalos. El desarrollo sigue SDD: los requisitos, el plan y las tareas aprobados están en el [índice del proyecto](./specs/001-toca-regalo/tasks.md).

## Estado actual

Se han completado **002:T1–T5 y 002:T9**: configuración y dependencias, API JSON con conexión MySQL verificada, PHPStan y una base Vue/Bootstrap servida por Nginx. Se han comprobado escritorio y móvil, HMR y archivos compilados. T5 incorpora PHPUnit con MySQL aislado, tests de componentes y pruebas de navegador. Faltan las funciones de negocio, las migraciones, sus pruebas y los trabajadores. Esta entrega todavía no permite realizar sorteos.

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

1. Preparar y presentar el plan de ejecución de **002:T6** cuando el usuario solicite continuar; esperar su aprobación antes de implementarla.
2. Conservar los digests y archivos de bloqueo revisados. Las instalaciones de dependencias nunca deben ejecutarse implícitamente al arrancar; futuras descargas fuera del alcance autorizado requieren aprobación.
3. Completar las pruebas y funciones de Symfony y Vue en sus tareas correspondientes. El arranque nunca instalará sus dependencias automáticamente.
4. Crear un archivo local ignorado a partir de [.env.example](./.env.example). Los valores `REVIEW_ONLY_*` son marcadores públicos para validar archivos: deben sustituirse antes de cualquier ejecución. No representan secretos de desarrollo utilizables.
5. Configurar el usuario local mediante `LOCAL_UID` y `LOCAL_GID`, y `APP_TIMEZONE` con la zona horaria del sistema de instalación. Europe/Madrid es solo el ejemplo. La base de datos almacenará instantes en UTC y la aplicación interpretará las fechas con la zona configurada.
6. Suministrar las claves de asignación como archivos secretos separados para desarrollo y pruebas, según la política aprobada. Ninguna imagen ni comando de arranque generará claves automáticamente. No se deben guardar en Git ni facilitar por el chat.
7. Completar las tareas de API, frontend, pruebas y trabajadores antes de validar un arranque funcional.

Las contraseñas elegidas para MySQL y las credenciales codificadas en `DATABASE_URL` deben corresponderse; los caracteres especiales del usuario/contraseña dentro de esa URL necesitan codificación URI. El servidor MySQL no publica puertos en el equipo anfitrión.

## Direcciones previstas

Los servicios de Compose usan el prefijo `tocaregalo-`: `tocaregalo-mysql`, `tocaregalo-php`, `tocaregalo-frontend`, `tocaregalo-nginx`, `tocaregalo-mailpit`, `tocaregalo-notification-worker` y `tocaregalo-closure-worker`. La comprobación temporal utiliza `tocaregalo-php-smoke`. En `DATABASE_URL`, el host interno es `tocaregalo-mysql` y el puerto es `3306`; el SMTP local usa `tocaregalo-mailpit:1025`. Compose añade además el nombre del proyecto a los contenedores, conservando la separación entre desarrollo y pruebas.

| Servicio | Desarrollo | Pruebas |
| --- | --- | --- |
| Aplicación mediante Nginx | `http://localhost:8080` | `http://localhost:8081` |
| Bandeja de correo local | `http://localhost:8025` | `http://localhost:8026` |

Solo Nginx y la bandeja local publican puertos, vinculados a `127.0.0.1`. PHP, Node, MySQL y SMTP permanecen dentro de la red de Compose. El perfil `workers` habilita los trabajadores cuando sus comandos estén implementados. No se ejecutan durante esta tarea.

El proyecto de pruebas se llama `tocaregalo-test` y tiene sus propios volúmenes, base de datos y archivo de claves. Usa siempre `--project-name tocaregalo-test`: esta opción prevalece sobre `COMPOSE_PROJECT_NAME`, cuyo valor de ejemplo identifica el entorno de desarrollo. No debe ejecutarse usando el nombre del proyecto de desarrollo ni apuntar a su base de datos. No hay borrado automático de volúmenes.

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
