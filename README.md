# Toca Regalo

Aplicación web para organizar grupos y eventos de intercambio de regalos. El desarrollo sigue SDD: los requisitos, el plan y las tareas aprobados están en el [índice del proyecto](./specs/001-toca-regalo/tasks.md).

## Estado actual

Se han completado **002:T1 y 002:T2**: configuración de desarrollo, imágenes de herramientas PHP/Node y dependencias Composer/npm con archivos de bloqueo. La aplicación todavía no está implementada: faltan el arranque de la API y Vue, las migraciones y los comandos de los trabajadores. Esta entrega no permite arrancar una aplicación funcional.

Con autorización previa se han descargado las seis imágenes previstas, construido las dos herramientas e instalado las dependencias dentro de contenedores. [.env.example](./.env.example) fija las imágenes por digest y mantiene los marcadores públicos de secretos. No se han generado claves ni iniciado los servicios de la aplicación. El [registro técnico de dependencias](./specs/002-development-foundation/dependency-resolution.md) recoge versiones, comandos y límites: quedan cuatro avisos moderados en dependencias de pruebas npm y una dependencia PHP abandonada; las auditorías no detectan vulnerabilidades PHP ni avisos npm de producción.

## Configuración prevista

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

1. Autorizar **002:T3** antes de preparar y ejecutar la API JSON y la conexión real a MySQL. T2 no autoriza las tareas posteriores.
2. Conservar los digests y archivos de bloqueo revisados. Las instalaciones de dependencias nunca deben ejecutarse implícitamente al arrancar; futuras descargas fuera del alcance autorizado requieren aprobación.
3. Preparar los proyectos Symfony y Vue en sus tareas correspondientes. El arranque nunca instalará sus dependencias automáticamente.
4. Crear un archivo local ignorado a partir de [.env.example](./.env.example). Los valores `REVIEW_ONLY_*` son marcadores públicos para validar archivos: deben sustituirse antes de cualquier ejecución. No representan secretos de desarrollo utilizables.
5. Configurar el usuario local mediante `LOCAL_UID` y `LOCAL_GID`, y `APP_TIMEZONE` con la zona horaria del sistema de instalación. Europe/Madrid es solo el ejemplo. La base de datos almacenará instantes en UTC y la aplicación interpretará las fechas con la zona configurada.
6. Suministrar las claves de asignación como archivos secretos separados para desarrollo y pruebas, según la política aprobada. Ninguna imagen ni comando de arranque generará claves automáticamente. No se deben guardar en Git ni facilitar por el chat.
7. Completar las tareas de API, frontend, pruebas y trabajadores antes de validar un arranque funcional.

Las contraseñas elegidas para MySQL y las credenciales codificadas en `DATABASE_URL` deben corresponderse; los caracteres especiales del usuario/contraseña dentro de esa URL necesitan codificación URI. El servidor MySQL no publica puertos en el equipo anfitrión.

## Direcciones previstas

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

T2 verifica la construcción de las herramientas, las extensiones PHP y la resolución de dependencias. Todavía están pendientes los permisos del entorno completo, la sintaxis de Nginx dentro de su imagen, la conexión real a MySQL, el arranque de la aplicación, el correo y los trabajadores. No se han descargado navegadores ni ejecutado pruebas de la aplicación.
