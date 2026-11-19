# TocaRegalo para Sites

Aplicación web para organizar grupos y eventos de regalos, sortear destinatarios de forma justa y permitir que cada participante consulte su asignación de manera privada.

Código inicial de la implementación independiente. El repositorio previsto es
`abbarrasa/tocaregalo-sites`. La especificación funcional de TocaRegalo v1.2
y el prototipo visual aprobado son las referencias de producto.

## Ejecutar las pruebas

Con Node 24 o posterior, desde la raíz:

```sh
node --test tests/*.test.ts
```

Antes de ejecutar la suite completa, instalar las herramientas locales con
`npm ci`. Comandos disponibles:

```sh
npm test                  # Dominio, SQLite y D1 local (Miniflare)
npm run test:unit         # Dominio y SQLite, sin iniciar workerd
npm run test:integration  # Binding D1 local con Miniflare
npm run typecheck         # Tipos de Node y Workers por separado
```

## Estado

El código actual cubre el sorteo uniforme, el límite lógico del cierre, el
cálculo de reintentos y el cifrado autenticado del destinatario. Las pruebas
usan datos sintéticos. Las pruebas de dominio y SQLite no requieren paquetes;
la integración local necesita las dependencias de desarrollo, sin cuenta Cloudflare.

La aplicación seguirá usando Vue y Bootstrap. La API se implementará en
TypeScript como Worker, con D1 para persistencia y SendGrid HTTPS para el
correo. El acceso a la URL publicada será público y la aplicación autenticará
por su cuenta antes de conceder acceso a cuentas y datos de grupos o eventos.

Quedan pendientes el frontend, el login, las rutas autenticadas de grupos y eventos,
la integración de correo, el procesamiento desatendido de cierres y reintentos
y la publicación. Las pruebas de calendario aquí ejercitan funciones de dominio.
La prueba del plazo de 60 segundos debe cronometrar el cierre desde el instante
previsto en un entorno publicado, sin tráfico de navegador ni sesión abierta.
Si Sites no expone un programador con esa cadencia y latencia, el procesamiento
necesitará un programador externo que invoque un endpoint autenticado e idempotente.

## Persistencia D1

La migración [0001_draws.sql](migrations/0001_draws.sql) prepara eventos,
sorteos, la instantánea de participantes y las asignaciones cifradas.
Los tiempos se guardan como milisegundos UTC. La migración
[0002_accounts_groups.sql](migrations/0002_accounts_groups.sql) añade cuentas,
grupos, membresías y la relación opcional de eventos con grupos.

[DrawRepository](src/persistence/draw-repository.ts) recibe el binding D1 del
Worker. `save` valida la permutación completa, cifra todos los destinatarios y
guarda el sorteo mediante un único `DB.batch`, que D1 ejecuta atómicamente.
Una restricción única permite un solo sorteo por evento: ante un reintento o
conflicto concurrente, el servicio debe consultar `findByEvent` y reutilizar el
sorteo existente. No se reemplazan asignaciones. Los errores de base de datos
se propagan; no deben tratarse todos como duplicados.

Los destinatarios se almacenan como BLOB AES-GCM, con IV, identificador de
clave e índice HMAC. Las claves se proporcionarán mediante secretos del Worker,
nunca en D1. La API deberá autenticar y autorizar al participante antes de
consultar su asignación. `save` tampoco comprueba membresía ni plazo de cierre:
esas reglas requieren la futura capa de servicio y operaciones atómicas adicionales.

[wrangler.jsonc](wrangler.jsonc) configura el binding `DB`, el directorio de
migraciones y un identificador ficticio para desarrollo local. El Worker expone
`GET /health`, `GET /api/me` y `POST /api/logout`. No expone datos de sorteos.
Para aplicar las migraciones e iniciar el Worker local:

```sh
npm run db:migrate:local
npm run dev
```

La migración inicial se ha validado con Wrangler local. Para un futuro despliegue,
crear una base D1 real y sustituir nombre e identificador en la configuración.
El despliegue y las migraciones remotas no se han ejecutado.
Las pruebas de persistencia usan `node:sqlite` (experimental en algunas versiones
de Node 24) para ejecutar el SQL real y comprobar cifrado, restricciones,
borrado en cascada y rollback. La prueba `d1.integration.test.ts` comprueba además
el repositorio con el binding D1 de Miniflare/workerd, incluyendo la conversión de
BLOB y el rollback de un batch fallido. Esta prueba se ejecuta en una base efímera,
independiente de la base persistente de `wrangler dev`. Miniflare está fijado a la
versión que utiliza Wrangler; actualmente esa versión lleva sufijo beta y usa
su adaptador oficial `convertV4MiniflareOptions` para configurar los tests.
La validación en un D1 remoto queda pendiente.

## Cuentas, grupos y permisos de persistencia

[AccountsRepository](src/persistence/accounts-repository.ts) permite provisionar
cuentas con correo único normalizado (espacios exteriores eliminados y minúsculas)
y nombre visible. No guarda contraseñas ni verifica el correo. La creación de una
cuenta no inicia una sesión ni demuestra que el solicitante controle ese correo.

[GroupsRepository](src/persistence/groups-repository.ts) crea el grupo y la
membresía de su propietario en un único batch. La política inicial permite solo
al propietario añadir o retirar miembros y crear eventos. El propietario no se
puede retirar mediante este repositorio. No se implementan todavía transferencia
de propiedad, invitaciones ni alta pública de miembros: `addMember` es una
operación interna que deberá llamarse tras aceptar una invitación.

Todas las identidades `actorAccountId` y el identificador de `findSelf` deberán
proceder de una sesión verificada por la futura API, nunca de un campo arbitrario
enviado por el navegador. Las consultas de grupo y evento verifican membresía;
los cambios de miembros y el alta de eventos verifican propietario en el mismo
SQL que realiza la escritura. Las consultas devuelven `null` cuando no hay acceso,
sin distinguir un recurso inexistente. Añadir miembros o crear eventos sin
propiedad lanza `GroupAccessError`; retirar miembros sin permiso o inexistentes
devuelve `false`. Los conflictos de unicidad y claves externas se propagan.

`DrawRepository.findRecipientForAccount` devuelve exclusivamente la asignación
del titular de la sesión, siempre que siga perteneciendo al grupo del evento.
Retirar una membresía revoca estas consultas sin borrar la instantánea cifrada
del sorteo. La política completa de eliminación de cuentas y destinatarios queda
pendiente. `findRecipient`, `findByEvent` y `save` siguen siendo métodos internos
sin autorización y no deben exponerse directamente en endpoints.

La migración conserva los eventos anteriores con `group_id = NULL`. Las nuevas
consultas con comprobación de membresía no conceden acceso a esos eventos; no se
infiere ni asigna automáticamente un propietario a datos antiguos.

La integración D1 prueba también unicidad de correos, rollback del alta de grupo,
permisos de propietario, aislamiento entre grupos, revocación de acceso, claves
externas y migración desde datos preexistentes. Las operaciones de grupos y
eventos todavía no están conectadas a rutas HTTP.

## Sesiones (base interna; login pendiente)

La migración [0003_sessions.sql](migrations/0003_sessions.sql) añade sesiones
ligadas a cuentas, con caducidad y borrado en cascada al eliminar la cuenta.
Solo se guarda el hash SHA-256 de un token aleatorio de 256 bits generado con
Web Crypto. El token original nunca se persiste. La caducidad es absoluta y
se comprueba en cada autenticación, incluido el instante exacto de vencimiento.

[SessionService](src/application/session-service.ts) separa los casos de uso
del repositorio y permite inyectar el reloj. `issueForVerifiedAccount` es una
frontera interna: su llamador deberá haber verificado la identidad de la cuenta.
No hay endpoint para emitir sesiones ni para entrar usando solo un correo o ID.
La duración se proporciona explícitamente en milisegundos (mínimo 1000); todavía
no se ha decidido la política de duración del producto. Cada emisión genera un
token nuevo y permite sesiones independientes por dispositivo. La renovación,
el tiempo máximo de inactividad y la limpieza de sesiones caducadas quedan pendientes.

Rutas implementadas:

- `GET /api/me`: devuelve `{ account, csrfToken }` únicamente para una sesión
  válida. La cuenta se obtiene de la sesión, sin aceptar un ID del navegador.
- `POST /api/logout`: requiere la cookie, una cabecera `Origin` idéntica a
  `APP_ORIGIN` y `X-CSRF-Token` con el valor devuelto por `/api/me`. Revoca solo
  esa sesión y elimina su cookie mediante una respuesta 204.
- Sin sesión válida se devuelve 401; un fallo de CSRF devuelve 403; un origen
  configurado incorrectamente impide el cierre y devuelve 503. Un método
  incorrecto devuelve 405. Las respuestas de sesión llevan `Cache-Control: no-store`.

La cookie se llama `__Host-tocaregalo_session` y usa `Secure`, `HttpOnly`,
`SameSite=Lax` y `Path=/`, sin `Domain`. El helper `sessionCookie` está preparado
para el futuro login; este deberá ajustar `Max-Age` a la vida restante de la
sesión. El CSRF se deriva del token con un prefijo de dominio independiente y no
es el hash almacenado en D1. Nunca se debe registrar el token, la cookie o el CSRF.

Esta primera integración está orientada a frontend y API bajo el mismo origen;
no habilita CORS. `APP_ORIGIN` debe ser un origen HTTPS exacto, sin barra final ni
ruta. La configuración local contiene `https://localhost:8787`. Para probar con
un navegador, usar HTTPS y ese host:

```sh
npm run db:migrate:local
npm run dev -- --local-protocol https
```

Cambiar `APP_ORIGIN` al configurar otro host/puerto. Si Sites sirve el frontend
desde un origen diferente, habrá que diseñar y probar esa integración antes de
publicar, considerando CORS y las restricciones de cookies del navegador.
No se han creado credenciales, verificado correos ni añadido un mecanismo de
login. Las pruebas usan emisión interna con cuentas sintéticas; `/api/me`
responderá 401 en el navegador hasta disponer de un flujo de autenticación real.

Las pruebas de sesiones cubren almacenamiento de hashes, caducidad, revocación,
aislamiento, atributos de cookie, CSRF y borrado en cascada usando D1 local.
La tercera migración se ha aplicado con Wrangler local. También se ha verificado
el Worker empaquetado en workerd con una base efímera y una cuenta sintética,
incluyendo consulta autenticada, cierre y rechazo de la sesión revocada.
