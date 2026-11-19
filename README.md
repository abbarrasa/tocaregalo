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

Quedan pendientes el frontend, la verificación telefónica,
la gestión adicional de eventos, las invitaciones, los correos de eventos y sorteos,
el procesamiento desatendido de cierres y reintentos
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
`GET /health`, `POST /api/register`, `POST /api/login`, `GET /api/me` y
`POST /api/logout` y las rutas de verificación de correo descritas más abajo.
No expone datos de sorteos.
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
y nombre visible. El registro público añade credenciales en una tabla separada;
la provisión interna existente sigue sin asignar contraseñas. La creación de una
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
eventos se validan a nivel de persistencia. La creación y consulta de grupos
también están conectadas a las rutas HTTP descritas más abajo. Los eventos
disponen de creación, listado por grupo y consulta individual autenticados; la gestión de miembros
sigue siendo interna.

## Sesiones

La migración [0003_sessions.sql](migrations/0003_sessions.sql) añade sesiones
ligadas a cuentas, con caducidad y borrado en cascada al eliminar la cuenta.
Solo se guarda el hash SHA-256 de un token aleatorio de 256 bits generado con
Web Crypto. El token original nunca se persiste. La caducidad es absoluta y
se comprueba en cada autenticación, incluido el instante exacto de vencimiento.

[SessionService](src/application/session-service.ts) separa los casos de uso
del repositorio y permite inyectar el reloj. `issueForVerifiedAccount` es una
frontera interna: su llamador deberá haber verificado la identidad de la cuenta.
El login público invoca esa frontera después de comprobar la contraseña. No hay
endpoint para entrar usando solo un correo o ID.
La duración interna se proporciona explícitamente en milisegundos (mínimo 1000).
El login usa por defecto 24 horas, configurables mediante `SESSION_TTL_SECONDS`.
Cada emisión genera un token nuevo y permite sesiones independientes por dispositivo. La renovación,
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
`SameSite=Lax` y `Path=/`, sin `Domain`. El login usa el helper `sessionCookie`
y ajusta `Max-Age` a la vida restante de la sesión. El CSRF se deriva del token
con un prefijo de dominio independiente y no
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
La API permite registrar una cuenta sintética y entrar con ella para probar el
flujo. Todavía no hay interfaz de login ni verificación telefónica.

Las pruebas de sesiones cubren almacenamiento de hashes, caducidad, revocación,
aislamiento, atributos de cookie, CSRF y borrado en cascada usando D1 local.
La tercera migración se ha aplicado con Wrangler local. También se ha verificado
el Worker empaquetado en workerd con una base efímera y una cuenta sintética,
incluyendo consulta autenticada, cierre y rechazo de la sesión revocada.

## Registro público y acceso por contraseña

La migración [0004_public_auth.sql](migrations/0004_public_auth.sql) añade
apellidos y teléfono al perfil, un índice único para teléfonos no nulos,
credenciales separadas y contadores de intentos. Las cuentas previas se conservan
sin contraseña; no se pueden reclamar registrándose con su correo existente.

`POST /api/register` acepta JSON:

```json
{
  "email": "persona@example.test",
  "password": "abcdef",
  "name": "Nombre",
  "lastName": "Apellidos opcionales",
  "phone": "+34612345678"
}
```

Correo, contraseña y nombre son obligatorios; se pueden omitir `lastName` y
`phone`. El correo se normaliza a minúsculas; los nombres se recortan y admiten
1–100 caracteres según la validación existente. El teléfono exige prefijo `+`
y formato internacional de hasta 15 dígitos; se eliminan espacios, paréntesis y
guiones. No se infiere un país ni se verifica que el número exista o pertenezca
al usuario. Correo y teléfono normalizado son únicos.

La **única regla de contraseña es un mínimo de seis caracteres Unicode**.
No se imponen mayúsculas, números, símbolos ni máximo específico de contraseña,
y no se recorta, normaliza ni trunca. Se admiten espacios. Como límite operativo
independiente, el cuerpo JSON completo de registro/login no puede superar
16 KiB; el lector comprueba también cuerpos transmitidos sin `Content-Length`.

El registro guarda cuenta y credencial atómicamente y devuelve 201 con
`{ account }`, sin iniciar sesión. El perfil devuelto usa `displayName` para el
nombre y añade `lastName` y `phone` (nulos cuando no se indican). Un conflicto de
correo/teléfono devuelve 409 genérico, sin indicar el campo duplicado. La
respuesta de registro puede revelar que alguno de los identificadores ya existe;
el login devuelve el mismo 401 para cuenta inexistente o contraseña incorrecta.

`POST /api/login` acepta `{ "identifier": "persona@example.test", "password": "abcdef" }`.
`identifier` puede ser correo o teléfono internacional. Una contraseña correcta
genera una sesión nueva y devuelve `{ csrfToken }` junto a la cookie HttpOnly;
el token de sesión no se devuelve en el JSON. `SESSION_TTL_SECONDS` vale `86400`
en la configuración local y debe ser un entero positivo. El logout no afecta
a otras sesiones del mismo usuario.

Ambas rutas exigen `Content-Type: application/json` y una cabecera `Origin`
exactamente igual al `APP_ORIGIN` HTTPS configurado. Los métodos incorrectos
devuelven 405; el origen no permitido, 403; JSON/datos inválidos, 400; tipo de
contenido incorrecto, 415; cuerpo excesivo, 413. Las respuestas llevan
`Cache-Control: no-store`. No se habilita CORS.

La limitación usa ventanas fijas de 15 minutos persistidas en D1: 10 registros
por IP, 30 accesos por IP y 5 accesos por identificador. Cuenta intentos válidos
de formato, incluidos éxitos; el siguiente intento devuelve 429 con
`Retry-After: 900`. Los contadores se actualizan atómicamente y se limpia un
máximo de 100 entradas antiguas por operación de contador. Las claves son hashes,
no identificadores en claro; esto no garantiza anonimato frente a diccionarios.
Se confía en `CF-Connecting-IP` establecido por Cloudflare; sin cabecera todos
comparten el contador `unknown`. Un proxy alternativo deberá conservar esa
frontera de confianza y no aceptar direcciones elegidas por el cliente.

[Argon2PasswordHasher](src/infrastructure/argon2-password-hasher.ts) utiliza
`@noble/hashes` con Argon2id v19, memoria de 19 MiB, dos iteraciones, paralelismo
uno, salt aleatorio de 16 bytes y salida de 32 bytes, en formato PHC. Los
parámetros están fijados y el verificador rechaza formatos no soportados; no
acepta costes arbitrarios de una cadena almacenada. Las cuentas inexistentes
también ejecutan la KDF para reducir diferencias temporales, sin prometer tiempos
de respuesta idénticos. No se almacenan ni devuelven contraseñas en claro.

El Worker empaquetado se prueba en workerd con Argon2id real y D1 efímero;
esto no mide CPU ni capacidad en producción. La KDF es síncrona para evitar
asignaciones de memoria de KDF concurrentes en el mismo isolate y puede bloquear
temporalmente otras peticiones. Antes de publicar hay que perfilar el coste y
presupuestar Workers Paid: el plan Free solo dispone de 10 ms de CPU por petición
según los [límites de Cloudflare](https://developers.cloudflare.com/workers/platform/limits/).
Los parámetros se basan en [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

El login verifica la contraseña, no la titularidad de los contactos. La
verificación de correo y la recuperación de contraseña son flujos separados;
la verificación telefónica sigue pendiente.

## Verificación de correo

La migración [0005_email_verification.sql](migrations/0005_email_verification.sql)
añade `email_verified_at_ms` al perfil y una tabla con un único desafío actual
por cuenta. Las cuentas existentes permanecen sin verificar. El login continúa
permitido antes de confirmar el correo.

Flujo de API:

1. Iniciar sesión y obtener `csrfToken` mediante login o `/api/me`.
2. Enviar `POST /api/email-verification/request` con JSON `{}`, la cookie de
   sesión, el `Origin` configurado y `X-CSRF-Token`. El destinatario se obtiene
   de la cuenta autenticada; los campos `email` o `accountId` del cuerpo no
   permiten cambiarlo. Devuelve 202 cuando SendGrid acepta la petición, o 204
   sin enviar otro correo si la cuenta ya estaba verificada.
3. El correo de texto contiene un código aleatorio de 64 caracteres hexadecimales.
   Enviar `POST /api/email-verification/confirm` con JSON `{ "token": "<código>" }`
   y el `Origin` configurado. Esta confirmación no necesita sesión ni CSRF de
   sesión: el código secreto autoriza exclusivamente la verificación de su cuenta.
   Devuelve 204 y no crea sesión ni cookie. La futura interfaz deberá permitir
   copiar/pegar el código; todavía no existe esa pantalla ni un enlace automático.

`GET /api/me` añade `account.emailVerifiedAtMs`: `null` si no está verificado,
o la fecha UTC en milisegundos tras confirmarlo. El código original no se
devuelve en las respuestas de API ni se guarda en D1. Se genera con 256 bits
aleatorios y se guarda un hash SHA-256 con un prefijo de dominio distinto al de
las sesiones. No se usa como contraseña ni como token de sesión.

La caducidad se configura con `EMAIL_VERIFICATION_TTL_SECONDS` (86400 por
defecto local). El instante de vencimiento ya es inválido. Un reenvío sustituye
el código anterior y la confirmación comprueba el correo exacto guardado al
emitirlo. Los códigos inválidos, caducados o reutilizados devuelven el mismo 400.
El consumo y la fecha de verificación se actualizan en un único batch D1; si
falla cualquiera de las operaciones, se revierte todo. Las confirmaciones
concurrentes tienen un solo ganador.

La solicitud admite 5 intentos por cuenta y 30 por IP cada 15 minutos; la
confirmación admite 30 intentos por IP en ese periodo. Comparten la infraestructura
de contadores persistidos y devuelven 429 con `Retry-After: 900`. Las peticiones
exigen JSON y aplican el límite de cuerpo de 16 KiB existente; las respuestas
llevan `Cache-Control: no-store`. Los métodos incorrectos devuelven 405,
una solicitud sin sesión válida 401 y los fallos de origen/CSRF 403.

### Configurar SendGrid

El adaptador usa la [API Mail Send](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send)
por HTTPS. Antes de probar envíos reales se necesitan:

- `SENDGRID_API_KEY`: secreto con permiso Mail Send; no guardarlo en la configuración versionada.
- `SENDGRID_FROM_EMAIL`: remitente autorizado en la cuenta de SendGrid.
- `APP_ORIGIN`: origen HTTPS exacto de la aplicación.
- `EMAIL_VERIFICATION_TTL_SECONDS`: entero positivo de duración del código.

En local se pueden proporcionar los valores de SendGrid en `.dev.vars`, que
está excluido de Git. No copiar secretos a documentación, pruebas ni logs. La
configuración versionada solo incluye la duración y los valores locales existentes.
En el futuro despliegue habrá que configurar el secreto y el remitente reales;
no se han creado ni modificado recursos remotos.

El adaptador aplica un timeout de 10 segundos, desactiva el seguimiento de
aperturas/clics y acepta únicamente una respuesta 202. Usa redirecciones en
modo manual y rechaza los 3xx para no reenviar credenciales a otro destino.
Workers [no admite `redirect: "error"`](https://developers.cloudflare.com/workers/runtime-apis/request/).
Una respuesta 202 indica aceptación por SendGrid, no entrega en el buzón ni
verificación de la cuenta. Los errores del proveedor o de configuración producen
un 503 genérico, sin devolver detalles sensibles; se invalida condicionalmente
el código de ese intento sin borrar otro emitido después.

No hay envío automático al registrarse, cola, reintentos desatendidos ni garantía
de orden de entrega. Tras un fallo se solicita un código nuevo; solo el actual
puede confirmarse. Las pruebas unitarias simulan el proveedor y la integración
intercepta todas las llamadas salientes del Worker: no se han enviado correos
reales ni validado entregabilidad. Los correos de invitaciones/sorteos son trabajo
posterior y no están implementados por este adaptador.

## Recuperación de contraseña

La migración [0006_password_recovery.sql](migrations/0006_password_recovery.sql)
añade una revisión de credenciales y un desafío de recuperación por cuenta.
Conserva cuentas, hashes y sesiones existentes. No crea contraseñas para cuentas
aprovisionadas internamente que todavía no tengan credenciales.

1. Enviar `POST /api/password-recovery/request` con JSON
   `{ "identifier": "persona@example.com" }` o un teléfono internacional.
   El correo se obtiene exclusivamente de la cuenta; ningún campo del cuerpo
   permite sobrescribir el destinatario. Las cuentas sin verificar también pueden
   recuperar su contraseña, sin que esto cambie `emailVerifiedAtMs`.
2. Para solicitudes válidas y no limitadas, la API responde siempre
   `202 { "status": "recovery_requested" }`, exista o no la cuenta. La consulta
   y el envío se ejecutan mediante `waitUntil`, fuera de la respuesta pública.
   Ese 202 no garantiza aceptación por SendGrid ni entrega. Los fallos generan
   solo un mensaje de registro genérico y eliminan condicionalmente el desafío
   fallido sin borrar uno más reciente. No hay cola duradera ni reintento automático.
3. Introducir el código recibido con `POST /api/password-recovery/confirm`, JSON
   `{ "token": "<código>", "newPassword": "<nueva contraseña>" }`.
   Solo se exige un mínimo de seis caracteres Unicode, conservando espacios y
   el contenido exacto. Una confirmación correcta devuelve 204, invalida todas
   las sesiones y obliga a iniciar sesión de nuevo. No crea cookie ni sesión.

Ambas rutas exigen el `Origin` HTTPS configurado y JSON, pero no una sesión.
Los tokens son aleatorios de 256 bits y se almacenan como hash SHA-256 con un
propósito distinto al de sesiones y verificación de correo. Solo hay un código
actual por cuenta: el reenvío sustituye al anterior. Caducan a los 30 minutos
por defecto (`PASSWORD_RECOVERY_TTL_SECONDS=1800`); el instante de caducidad
ya es inválido. El código queda ligado al correo y a la revisión de credenciales
vigentes. Los tokens inválidos, vencidos o usados devuelven el mismo 400.

El consumo del código, el cambio del hash Argon2id y el borrado de sesiones se
realizan en un único batch D1. Si falla una operación, todo se revierte. Una
comprobación de contraseña antigua que coincida con un restablecimiento tampoco
puede emitir una nueva sesión después del cambio.

La solicitud permite 5 intentos por identificador normalizado y 30 por IP cada
15 minutos. Correo y teléfono tienen contadores de identificador distintos.
La confirmación permite 30 intentos por IP en ese periodo. Se conserva el límite
de JSON de 16 KiB, `Cache-Control: no-store` y 429 con `Retry-After: 900`.
Se reutiliza el transporte HTTPS de SendGrid, con un correo específico de
recuperación y el seguimiento desactivado. La interfaz, los envíos reales y la
validación remota siguen pendientes; las pruebas interceptan todo correo.

## API autenticada de grupos

La API permite crear y consultar grupos con una sesión válida. No exige correo
verificado, de acuerdo con la política actual de acceso. Todas las respuestas
llevan `Cache-Control: no-store`; no se expone una lista pública de grupos.

- `POST /api/groups`: JSON `{ "name": "Amigos" }`, cookie de sesión,
  `Origin` configurado y `X-CSRF-Token` del login o de `/api/me`.
  Devuelve 201 con `{ group }` y `Location: /api/groups/<id>`.
  El nombre usa la validación existente (recortado, 1–100 caracteres).
  El servidor genera ID y fecha y toma el propietario de la sesión; los campos
  `id`, `ownerAccountId`, `actorAccountId` o `createdAtMs` enviados por el cliente
  no permiten alterar esos valores. Grupo y membresía del propietario se crean
  en el mismo batch D1.
- `GET /api/groups/<id>`: devuelve `{ group }` solo para miembros actuales.
  Un grupo inexistente y uno inaccesible devuelven el mismo 404.
- `GET /api/groups?limit=20&cursor=<id>`: devuelve `{ groups, nextCursor }`.
  El límite predeterminado es 20, el máximo 50 y el mínimo 1. Se devuelven grupos
  de los que la cuenta es miembro, no solo los que posee. `nextCursor` es el ID
  del último grupo devuelto cuando quedan resultados; al terminar es `null`.
  Para la siguiente página, enviar ese valor como `cursor`, codificado para URL.

Los grupos incluyen `id`, `name`, `ownerAccountId` y `createdAtMs`.
El listado se ordena por ID ascendente, no por fecha. Usa el índice de membresías
por cuenta/grupo, sin OFFSET ni recuento total, y consulta como máximo 51 filas
para detectar una siguiente página. El cursor es una posición, no un permiso:
se comprueba la membresía en cada consulta. La paginación no constituye una
instantánea; altas o cambios de membresía entre peticiones pueden cambiar el
conjunto disponible. La eliminación del grupo usado como cursor no impide
continuar. Los cursores vacíos, de más de 512 caracteres, los límites inválidos
y los parámetros `limit`/`cursor` duplicados devuelven 400.

Una sesión ausente, vencida o revocada devuelve 401. La creación rechaza fallos
de Origin/CSRF con 403, configuración de origen inválida con 503, JSON o nombre
inválidos con 400, tipo de contenido incorrecto con 415 y cuerpos mayores de
16 KiB con 413. Los métodos no admitidos devuelven 405 y `Allow`. Los fallos de
persistencia devuelven un 500 genérico y el batch evita un grupo sin propietario.

Se mantienen separados dominio, servicio de aplicación, HTTP y repositorio.
La API de grupos no incluye invitaciones, alta pública de miembros, edición,
borrado ni interfaz. Los eventos tienen sus propias rutas descritas a continuación.
Las pruebas del Worker empaquetado usan
D1 efímera y comprueban aislamiento, revocación, CSRF, paginación, límites,
validación y rollback. No se han desplegado recursos remotos.

## API autenticada de eventos

Esta primera API usa únicamente el modelo existente: `id`, `groupId`,
`closureAtMs` y `createdAtMs`. No añade nombre, descripción, participantes
propios ni estados nuevos. Los atributos y reglas adicionales necesitan sus
requisitos de producto antes de implementarse.

- `POST /api/groups/<groupId>/events`: JSON `{ "closureAtMs": null }` para un
  evento sin cierre programado, o `{ "closureAtMs": 1800000000000 }` como ejemplo
  de fecha UTC en milisegundos (debe ser futura al realizar la petición).
  El campo es obligatorio. Si no es `null`, debe ser un número entero seguro
  estrictamente mayor que la fecha de creación tomada del reloj del servidor.
  No se convierten cadenas, fechas ISO ni valores fraccionarios. Esta regla
  se aplica a nuevas altas públicas; no reescribe los eventos ya existentes.
- Solo el propietario del grupo puede crear eventos. Se requieren sesión activa,
  `Origin` HTTPS configurado y `X-CSRF-Token`. El propietario se comprueba en
  el SQL de inserción, sin depender de una lectura previa de permisos.
- La creación devuelve 201 `{ event }` y `Location: /api/events/<id>`. El servidor
  genera ID y fecha; el grupo procede de la ruta. Los campos del cuerpo `id`,
  `groupId`, `actorAccountId` o `createdAtMs` no permiten cambiar esos valores.
- `GET /api/events/<id>` devuelve `{ event }` solo a miembros actuales del grupo.
  Revocar una membresía retira inmediatamente el acceso. Tanto los eventos
  inexistentes como los inaccesibles devuelven el mismo 404; los eventos antiguos
  sin grupo siguen inaccesibles y no reciben un propietario implícito.

La creación en un grupo inexistente o sin propiedad también devuelve el mismo
404. Sin sesión válida se devuelve 401; los fallos de Origin/CSRF devuelven 403,
y una configuración de origen inválida impide crear con 503. JSON o fechas
inválidas devuelven 400, tipo de contenido incorrecto 415, y un cuerpo mayor de
16 KiB, 413. Los métodos incorrectos devuelven 405 con `Allow`; todas las
respuestas usan `Cache-Control: no-store`. Los errores de almacenamiento se
traducen en un 500 genérico y una inserción fallida no deja un evento parcial.

El servicio de aplicación depende de un contrato pequeño y reutiliza el SQL
de eventos existente. Los tipos de evento y errores compartidos viven en dominio,
con reexportaciones compatibles desde el repositorio. No se necesitan migraciones
ni dependencias nuevas. Las pruebas usan el Worker empaquetado y D1 efímera para
comprobar permisos, datos históricos, revocación, fechas, CSRF, cuerpos inválidos,
fallos de inserción y altas concurrentes.

Guardar una fecha de cierre no ejecuta ni programa el sorteo. Esta API no
implementa edición, borrado, cierre manual, correos, interfaz
ni procesamiento desatendido. No se han desplegado recursos remotos.

### Listar eventos de un grupo

`GET /api/groups/<groupId>/events?limit=20&cursor=<id>` requiere una sesión
válida y membresía actual del grupo. Devuelve `{ events, nextCursor }` con los
mismos campos de evento que la consulta individual. Un grupo accesible sin
eventos, o sin eventos después del cursor, devuelve 200 con
`{ "events": [], "nextCursor": null }`. Grupos inexistentes e inaccesibles
comparten el mismo 404. No se exige CSRF para esta lectura.

La paginación es por ID ascendente, no por fecha: `limit` vale 20 por defecto
y admite enteros de 1 a 50. La consulta recupera una fila adicional para detectar
la siguiente página. Cuando exista, `nextCursor` contiene el ID del último evento
devuelto; enviarlo como `cursor` codificado para URL. Al terminar vale `null`.
El cursor puede apuntar a un evento eliminado o de otro grupo sin conceder
acceso: la ruta y la membresía siempre determinan el conjunto consultado.
Los cambios de eventos o membresía entre páginas no constituyen una instantánea.

La validación de paginación se comparte con el listado de grupos. Límites
inválidos, cursores vacíos o de más de 512 caracteres y parámetros duplicados
`limit`/`cursor` devuelven 400. Se conserva 401 para sesiones inválidas,
`Cache-Control: no-store` y 405 con `Allow: GET, POST` en métodos no admitidos
para la colección. Las reglas de creación por POST permanecen iguales.

La consulta verifica membresía y obtiene la página en una sola sentencia SQL;
no hay una comprobación previa que pueda quedar obsoleta entre consultas.
El repositorio distingue un grupo inaccesible de una página vacía mediante un
LEFT JOIN y consulta como máximo 51 filas, sin OFFSET ni recuento total.
La migración [0007_event_listing_index.sql](migrations/0007_event_listing_index.sql)
añade el índice `(group_id, id)`. El plan SQL comprobado en SQLite y D1 local
usa ese índice para avanzar por cursor y evita la ordenación temporal que
necesitaba el índice anterior. La migración conserva los datos existentes;
los eventos antiguos sin grupo siguen inaccesibles. No se han aplicado
migraciones remotas ni se ha medido capacidad en producción.
