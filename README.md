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
npm run test:frontend     # Cliente HTTP y formularios Vue en jsdom
npm run build:frontend    # Assets estáticos en dist/frontend
npm run build:site        # Frontend y dry run del Worker con assets; no despliega
```

`npm test` incluye también las pruebas del frontend. `npm run typecheck` comprueba
Node, Worker y componentes Vue con configuraciones independientes.

## Frontend: acceso, cuenta, grupos, invitaciones y eventos

[frontend](frontend/) contiene la primera entrega Vue/Bootstrap: login por correo
o teléfono, registro público, recuperación con código, consulta de cuenta,
verificación de correo y logout. Conserva el estilo del prototipo HTML facilitado
el 20-11-2026: marfil, ciruela, coral, títulos serif y logotipo de regalo.
La interfaz de grupos permite crear, listar y consultar grupos y sus miembros.
Las invitaciones permiten envío/listado/revocación por el propietario y aceptación
con código. El propietario puede retirar miembros con confirmación. Los eventos
permiten listado, creación, detalle, consulta de estado y sorteo/cierre manual
confirmados por el propietario y consulta explícita del destinatario propio.

Después de `npm ci`, iniciar en dos terminales:

```sh
npm run dev:api
npm run dev:frontend
```

Abrir `https://localhost:5173/`. Vite genera un certificado autofirmado únicamente
para desarrollo; el navegador puede pedir que se confíe explícitamente en él.
La API local escucha en `127.0.0.1:8787`; Vite envía `/api` a ese servidor sin
reescribir Origin. `dev:api` fija `APP_ORIGIN=https://localhost:5173` solo para
esa ejecución. Conservar exactamente ese hostname y puerto para las cookies
Secure y la comprobación de origen. No ejecutar simultáneamente el antiguo
`npm run dev` en el mismo puerto. Este proxy solo existe durante desarrollo.

La API necesita una D1 local migrada antes de probar cuentas reales; la aplicación
no aplica migraciones al arrancar. `npm run db:migrate:local` cambia el estado
persistente local y debe ejecutarse deliberadamente, no como parte de las pruebas.
Los tests de integración usan D1 efímera. Para correo, preparar secretos locales
según la guía de despliegue; no se incluyen cuentas demo ni envíos simulados en la UI.

El navegador llama solo a rutas relativas `/api/...`, usa la cookie HttpOnly
del servidor y guarda el CSRF únicamente en memoria. `/api/me` restaura la cuenta
al cargar. No se guardan contraseñas, códigos, sesión o asignaciones en localStorage
ni sessionStorage. Los códigos se introducen en formularios y viajan en cuerpos
POST, sin enlaces con tokens. El registro no inicia sesión; la recuperación no
verifica correo ni autentica. Solo se exige un mínimo de seis caracteres Unicode
en las contraseñas; apellidos y teléfono son opcionales.

`npm run build:site` compila el frontend en `dist/frontend` y empaqueta el Worker
en `dist/worker` mediante un dry run de [wrangler.site.jsonc](wrangler.site.jsonc).
No publica nada. Esta configuración sirve assets y API bajo el mismo origen:
`/api`, `/api/*` y `/health` pasan primero al backend. La navegación usa fragmentos
(`#groups`, `#account`); no hay fallback de rutas inexistentes a `index.html`.
Los errores de API no se convierten en HTML. Los assets públicos no contienen
cuentas, sesiones ni asignaciones. No se necesita un binding de assets en el código:
el enrutamiento lo realiza Cloudflare antes de ejecutar el Worker.

[wrangler.jsonc](wrangler.jsonc) conserva el desarrollo de la API sin assets.
Ambas configuraciones contienen únicamente un ID D1 local de ejemplo y no habilitan
`workers.dev`. La publicación requiere una configuración de destino revisada con
base, origen HTTPS, secretos y ruta reales, según [la guía](docs/deployment.md).
Publicar los archivos en otro hostname no configura ese enrutamiento ni CORS.

Las herramientas de Vue necesitan la API de TypeScript 6, por lo que el workspace
privado de frontend fija ese compilador y lo resuelve explícitamente en su check.
El backend conserva TypeScript 7. El lockfile raíz instala ambos con `npm ci`.

### Grupos y miembros

Tras iniciar sesión, el menú permite alternar entre «Grupos» (`#groups`) y «Mi
cuenta» (`#account`). El detalle usa `#groups/<id-codificado>`; el ID selecciona
el recurso, nunca concede permisos. La lista incluye los grupos de los que eres
miembro y distingue «Propietario» de «Participante». No muestra recuentos ni
descripciones que la API no proporciona.

La creación admite solo el nombre (entre 1 y 100 caracteres tras quitar espacios
exteriores). El servidor genera identidad/fecha/propietario y añade al creador
como miembro. Tras la respuesta se abre el grupo creado. El formulario bloquea
envíos duplicados mientras hay una solicitud pendiente; no reintenta un POST
automáticamente ante una respuesta perdida. Si aparece un resultado incierto,
revisa/actualiza el listado antes de volver a crear el mismo grupo.

Las listas de grupos y miembros solicitan páginas de veinte filas, con cursor
opaco y controles «Siguiente página», «Volver al principio» y actualización.
Solo se conserva la página actual. El orden sigue la API por ID, no por nombre
ni fecha; la paginación no es una instantánea. Los miembros muestran únicamente
nombre, fecha de incorporación y condición de propietario, sin teléfono/correo.
Las fechas se presentan en la zona horaria del navegador.

Los clientes de autenticación y grupos tienen contratos separados y comparten
[el transporte HTTP](frontend/src/http-client.ts), incluida la prueba CSRF en
memoria. La creación y la retirada de miembros añaden CSRF; las lecturas no lo necesitan. El servidor
comprueba permisos en cada operación. Una respuesta 401 vigente devuelve al login
y elimina los datos privados de pantalla; un 404 de detalle/miembros elimina
el detalle y muestra el mismo mensaje para grupo inexistente o inaccesible.
Las respuestas antiguas no repueblan una vista tras navegar o cambiar de grupo.
Las invitaciones se describen a continuación. Editar o borrar grupos sigue fuera
de la interfaz actual.

El propietario puede retirar a otros miembros desde el detalle, con confirmación
explícita. El propietario queda protegido; los participantes no ven controles de
retirada. La operación cancela las invitaciones pendientes vigentes de la persona
y revoca su acceso al grupo. Los eventos abiertos se recalculan cuando hay al menos
tres miembros; los cerrados conservan sus sorteos. Para volver al grupo se necesita
aceptar una nueva invitación.

Durante la retirada se bloquean solicitudes duplicadas y operaciones simultáneas
de invitaciones, y se invalidan las lecturas anteriores. Después se recargan desde
la primera página los miembros y las invitaciones. Un 503 puede producirse después
de aplicar la retirada, con trabajo de recálculo pendiente; también puede indicar
indisponibilidad previa. Ante 503 o pérdida de respuesta, la interfaz explica la
incertidumbre y consulta el estado, sin repetir el DELETE automáticamente ni
afirmar que todos los eventos se han recalculado. El listado de miembros no permite
certificar el estado del recálculo. La confirmación y su cancelación gestionan el
foco de teclado. La comprobación local de Chromium y sus límites se recogen en
[el informe de navegador](docs/qa/browser-validation/README.md).

### Invitaciones

El detalle del grupo muestra un panel de invitaciones solo al propietario. Permite
enviar por correo, consultar páginas de veinte invitaciones (ordenadas por correo)
y revocar las pendientes mediante confirmación explícita. El listado contiene solo
correo, fechas y estado: pendiente, caducada o aceptada. No es un historial de envíos.
Las invitaciones caducan a los siete días; otro envío al mismo correo sustituye el
código anterior. La revocación es idempotente y nunca retira miembros ya inscritos.

«Aceptar invitación» (`#invitations`) requiere sesión. Introducir el código del
correo: la dirección almacenada en la cuenta debe coincidir con la invitada.
La aceptación es de un solo uso, no verifica correo y no crea otra sesión. Después
se limpia el código y se carga una página nueva del listado de grupos. Los códigos
no se incluyen en URLs, almacenamiento del navegador ni mensajes de diagnóstico.

El cliente de invitaciones usa el transporte y CSRF compartidos. Envío, aceptación
y DELETE de revocación requieren CSRF; el listado no. El servidor autoriza cada
operación independientemente de los botones visibles. Un 404 de administración
borra el detalle privado y muestra el mismo mensaje de grupo inexistente/inaccesible;
un 401 vigente devuelve al login. Las respuestas antiguas se descartan también al
iniciar una mutación, para no restaurar un listado anterior después del cambio.

La API limita el envío a cinco solicitudes por grupo/correo y treinta por propietario
cada quince minutos. La interfaz bloquea envíos simultáneos y muestra los errores
de límite, permisos, código y red, sin reintentar operaciones automáticamente.
Una respuesta 202 significa aceptación por SendGrid, no entrega al buzón. Ante
resultado incierto, actualizar las invitaciones/grupos antes de repetir una acción;
reenviar puede invalidar un código anterior. No se han probado buzones reales.

### Eventos

Desde el detalle de un grupo, «Ver eventos del grupo» abre
`#groups/<id-codificado>/events`. Los miembros actuales pueden consultar páginas
de veinte eventos, conservando el orden de la API: creación descendente e ID
descendente como desempate. Se conserva solo la página actual y el cursor se
trata como opaco. Actualizar o volver al principio permite reiniciar el listado;
la paginación no constituye una instantánea.

Solo el propietario ve el formulario de creación. Se envía únicamente
`closureAtMs`: `null` sin programación o un instante UTC en milisegundos. La fecha
y hora se introducen en la zona del navegador, indicada junto al campo. Se
rechazan fechas imposibles y horas inexistentes por cambio de horario; para una
hora repetida se utiliza su primera ocurrencia. El navegador comprueba que sea
futura y el servidor vuelve a validarlo con su propio reloj. El servidor genera
el identificador, la fecha de creación inmutable y la vinculación con el grupo.
No se añaden nombres, descripciones ni participantes propios al modelo existente.

Tras crear se abre `#events/<id-codificado>`. El detalle muestra identificador,
creación y cierre programado, con enlaces de regreso. La fecha programada no se
presenta como cierre efectivo, aunque haya pasado; el navegador no ejecuta cierres
ni sorteos. Las fechas se muestran en la zona local del navegador. La gestión de
sorteos/cierre y la consulta privada del destinatario se describen a continuación.

El cliente de eventos comparte transporte y CSRF con autenticación; solo el POST
de creación necesita CSRF. Los listados y detalles validan forma, campos y ámbito
de las respuestas. Un 401 vigente elimina la interfaz privada; los 404 muestran
mensajes genéricos de recurso inexistente/inaccesible. Las lecturas anteriores se
invalidan al crear, navegar o cambiar de recurso. Se bloquean creaciones duplicadas
y no se reintenta una creación ambigua automáticamente: actualizar el listado
antes de repetirla. Las pruebas de componentes usan jsdom y clientes simulados;
la comprobación local en Chromium se detalla en
[el informe de navegador](docs/qa/browser-validation/README.md), incluida la corrección
y repetición del flujo de navegación tras verificar el correo.

### Sorteo y cierre desde el detalle

El panel «Sorteo y cierre» consulta el estado del servidor: pendiente de sorteo
actualizado, sorteo actualizado o cerrado. Muestra el cierre efectivo únicamente
cuando lo devuelve el servidor, sin deducirlo de la fecha programada. Los miembros
pueden consultar y actualizar el estado; solo el propietario ve las acciones de
sorteo/cierre de un evento abierto. No se muestran destinatarios, claves ni
identidades de asignaciones. No hay procesamiento automático desde el navegador.

Ambas acciones requieren confirmación explícita. Participan todos los miembros,
incluido el propietario, y se necesitan al menos tres. Solicitar el sorteo sin
cambios de membresía reutiliza el existente. El cierre puede adelantarse a la
fecha programada y crea o reutiliza un sorteo actualizado, fijando las asignaciones
de forma irreversible. Los eventos cerrados no muestran más acciones. La API
comprueba siempre los permisos y el estado, con independencia de los controles.

Los POST se envían sin cuerpo, con la sesión y CSRF compartidos. Las respuestas
se validan por evento, estado, sorteo y cierre coherentes. Mientras se procesa una
acción se bloquean duplicados y navegación. Un conflicto 409 puede indicar cierre,
menos de tres miembros o cambios concurrentes. Ante errores de mutación se consulta
de nuevo propiedad y estado mediante lecturas, sin repetir el POST automáticamente:
una respuesta perdida no prueba que la operación se haya deshecho. Si la lectura
tampoco funciona, las acciones quedan ocultas hasta actualizar el estado. Un 401
vigente elimina la interfaz privada y un 404 elimina todo el detalle. Las respuestas
antiguas tras cambiar de evento o abandonar la pantalla se descartan.

### Ver mi destinatario

El detalle incluye «Mi destinatario». No se consulta la asignación automáticamente:
«Ver mi destinatario» solicita una lectura nueva y muestra únicamente el nombre
actual devuelto por el servidor. «Ocultar destinatario» elimina el resultado de la
pantalla y permite cancelar visualmente una lectura pendiente; una respuesta tardía
no vuelve a mostrarlo. Volver a revelar realiza otro GET. El nombre se representa
como texto, no como HTML, y no se incluyen datos de contacto, claves ni sobres.

El propietario usa el mismo acceso a su asignación que cualquier participante;
no existe selector de otra persona o sorteo. La consulta funciona para sorteos
vigentes abiertos y para participantes de una instantánea cerrada. Se avisa de que
el destinatario puede cambiar mientras el evento permanezca abierto. La API decide
la autorización y la versión actual, incluso si la pantalla de estado ha quedado
desactualizada.

El resultado vive únicamente en el componente, sin URLs, almacenamiento del
navegador ni registros. Se limpia al ocultar, navegar, actualizar el estado o
iniciar sorteo/cierre. Durante estas operaciones del ciclo de vida el panel se
retira; después vuelve oculto, sin una consulta automática. Las lecturas anteriores
quedan invalidadas. No se bloquea la navegación por un GET del destinatario.

Un 409 indica asignación pendiente o desactualizada; un 401 vigente elimina la
interfaz privada. Un 404 muestra asignación no disponible sin asumir que todo el
evento sea inaccesible: un miembro nuevo puede consultar los metadatos de un evento
cerrado sin pertenecer a su instantánea. Los errores de red/configuración son
genéricos y no se reintentan automáticamente. El GET utiliza cookies de sesión y
`no-store`, sin CSRF ni identidades/sorteos elegidos por el navegador. No se han
certificado todos los navegadores ni el entorno de producción. La comprobación
local en Chromium está en [el informe de navegador](docs/qa/browser-validation/README.md).

## Integración continua y publicación de versiones

[Validate](.github/workflows/validate.yml) comprueba las PR cuyo destino es `dev`
o `main` y los cambios subidos a esas dos ramas. Usa Ubuntu y Node 24, instala
con `npm ci`, comprueba los tipos de Node/Worker y ejecuta la suite completa
(dominio, SQLite y D1 efímera con workerd). El job se llama `Node 24 validation`.
No necesita secretos de aplicación, no envía correos reales ni aplica migraciones
a bases persistentes. Tiene permisos de lectura y un límite de quince minutos;
una ejecución nueva cancela la anterior del mismo evento y referencia.

El flujo de trabajo previsto es:

1. Crear una rama `feature/...` desde `dev` para una tarea aprobada.
2. Subirla manualmente: [el workflow existente](.github/workflows/create-pr.yml)
   crea una PR hacia `dev` cuando corresponde.
3. Revisar la validación, aprobar y fusionar la PR.
4. Crear manualmente una PR de `dev` a `main` cuando se prepare una versión;
   puede agrupar varias tareas. Revisarla, aprobarla y fusionarla.
5. Crear manualmente una release y su etiqueta desde el commit elegido de `main`.

Aprobar una PR no la fusiona automáticamente. Este workflow tampoco configura
protección de ramas: para impedir fusiones con pruebas fallidas hay que exigir
el check `Node 24 validation` en las reglas del repositorio. Eso requiere una
configuración posterior en GitHub. Una release identifica una versión; desplegarla
en Cloudflare sigue siendo un paso separado pendiente.

Las PR creadas por un workflow con `GITHUB_TOKEN` pueden requerir que una persona
con permiso de escritura pulse **Approve workflows to run** antes de iniciar
la validación. Consultar la [documentación de disparadores de GitHub](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).
No se añaden tokens personales para eludir esa aprobación. La ejecución real
en GitHub debe verificarse después de subir los cambios; una prueba local no
certifica el runner remoto.

## Preparación del despliegue

La [guía de operación y despliegue](docs/deployment.md) detalla los datos pendientes,
la configuración HTTPS/D1/secretos, la secuencia de migración y publicación,
las comprobaciones en staging y los límites de recuperación. Incluye consultas
SQL de diagnóstico agregado para trabajos y avisos. Preparar esta guía no implica
haber desplegado recursos ni validado correo o Cron reales.

## Estado

El código actual cubre el sorteo uniforme, el límite lógico del cierre, el
cálculo de reintentos y el cifrado autenticado del destinatario. Las pruebas
usan datos sintéticos. Las pruebas de dominio y SQLite no requieren paquetes;
la integración local necesita las dependencias de desarrollo, sin cuenta Cloudflare.

El frontend usa Vue y Bootstrap. La API está implementada en
TypeScript como Worker, con D1 para persistencia y SendGrid HTTPS para el
correo. El acceso a la URL publicada será público y la aplicación autenticará
por su cuenta antes de conceder acceso a cuentas y datos de grupos o eventos.

Quedan pendientes las pantallas de grupos/eventos/invitaciones/destinatarios, la verificación telefónica,
la gestión adicional de eventos e invitaciones, la entrega duradera de otros
correos y la publicación. Los avisos de cierre ya tienen bandeja de salida y reintentos.
El procesamiento programado
de eventos está implementado y probado localmente; su configuración remota sigue pendiente.
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
La migración inicial permite un solo sorteo por evento. Desde la migración
[0010_event_draw_lifecycle.sql](migrations/0010_event_draw_lifecycle.sql), se conservan
versiones por revisión de membresía. El método interno `save` sigue rechazando
un segundo sorteo del mismo evento; la API usa el servicio de ciclo de vida
descrito más adelante. No se sobrescriben asignaciones. Los errores de base de datos
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
de propiedad ni administración completa de miembros. `addMember` sigue siendo
provisión interna de confianza; las altas públicas se realizan mediante el
consumo atómico de una invitación, descrito más abajo.

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
disponen de creación, listado por grupo y consulta individual autenticados.
Los miembros tienen listado y retirada autenticados según las reglas descritas
al final del documento; la provisión directa sigue siendo interna.

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
- `PATCH /api/me/profile`: actualiza nombre, apellidos, correo y teléfono de la
  cuenta derivada de la sesión. El mismo endpoint acepta un cambio de contraseña
  con `currentPassword` y `newPassword`; al cambiar contraseña revoca todas las
  sesiones. Cambiar el correo lo marca como no verificado e invalida retos activos.
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
`identifier` puede ser correo o teléfono internacional. Si el teléfono omite el
prefijo, el prefijo local configurado mediante `LOCAL_COUNTRY_PHONE_PREFIX`
se añade automáticamente; el valor por defecto es `+34`. Por ejemplo,
`612345678`, `34 612345678` y `+34612345678` representan el mismo número.
Una contraseña correcta
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

Para pruebas locales de correo, `.dev.vars` puede incluir:

```dotenv
APP_ENV=development
SENDGRID_API_KEY=clave-local
SENDGRID_FROM_EMAIL=remitente-verificado@example.test
SENDGRID_SANDBOX_MODE=true
SENDGRID_TEST_RECIPIENT_EMAIL=desarrollo@example.test
```

`SENDGRID_SANDBOX_MODE=true` tiene prioridad: SendGrid valida y acepta la
solicitud, pero no entrega correos. `SENDGRID_TEST_RECIPIENT_EMAIL` sustituye
el destinatario real únicamente cuando sandbox está desactivado y
`APP_ENV=development`. Fuera de desarrollo, ambas opciones fallan cerrado y no
realizan llamadas al proveedor. Los secretos reales no deben versionarse.

### Configurar Google

El login social usa OAuth 2.0 Authorization Code con Google. Antes de habilitarlo
se necesitan una credencial web de Google y:

- `GOOGLE_CLIENT_ID`: identificador público OAuth.
- `GOOGLE_CLIENT_SECRET`: secreto OAuth, proporcionado solo al Worker.
- `GOOGLE_REDIRECT_URI`: URL exacta `APP_ORIGIN + /api/auth/google/callback`.

Registrar el callback como URI autorizada en Google. En local se pueden guardar
los secretos en `.dev.vars`; no añadirlos a Wrangler, documentación o código.
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
reales ni validado entregabilidad. Las invitaciones usan otro adaptador sobre
el mismo transporte; los correos de sorteos siguen pendientes.

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
Las rutas de creación y consulta de grupos no incluyen edición, borrado ni
interfaz. Invitaciones y eventos tienen sus propias rutas descritas a continuación.
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

La paginación se ordena por fecha de creación descendente (más recientes primero),
con ID descendente como desempate: `limit` vale 20 por defecto
y admite enteros de 1 a 50. La consulta recupera una fila adicional para detectar
la siguiente página. Cuando exista, `nextCursor` contiene un cursor versionado
con la fecha y el ID del último evento devuelto; enviarlo completo como `cursor`
codificado para URL. Al terminar vale `null`.
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
añadió el índice para el orden anterior por ID. La nueva migración
[0008_event_creation_order.sql](migrations/0008_event_creation_order.sql) añade
`(group_id, created_at_ms DESC, id DESC)` para el orden cronológico.
El plan SQL comprobado en D1 local usa el nuevo índice para avanzar por cursor
sin ordenación temporal. La migración conserva los datos existentes;
los eventos antiguos sin grupo siguen inaccesibles. No se han aplicado
migraciones remotas ni se ha medido capacidad en producción.

La fecha de creación `createdAtMs` se asigna al crear el evento desde el reloj
del servidor. El cliente no puede elegirla y no se puede modificar después.
La migración 0008 añade un trigger que rechaza cambios de esa columna en D1,
incluidos los de eventos históricos, sin alterar sus fechas existentes.
Una actualización que conserve el mismo valor no modifica la fecha y se permite.
No se ha añadido una ruta pública de edición.

Los cursores nuevos son cadenas JSON versionadas con estructura
`[1, createdAtMs, id]`. Deben tratarse como valores opacos y codificarse para URL.
Los anteriores cursores de eventos que contenían únicamente el ID devuelven 400:
para continuar, reiniciar el listado sin cursor. El formato y orden de los
cursores de grupos no cambian. La comparación por fecha e ID evita saltos entre
eventos que compartan milisegundo, incluso si se elimina la fila usada de cursor.

La nueva migración contiene un trigger con puntos y coma internos. Las pruebas
de eventos usan [el cargador de migraciones](tests/helpers/migrations.ts), que
conserva los bloques separados por `-- statement-breakpoint` en estas migraciones.
No dividir el contenido de un trigger por cada punto y coma. Los cargadores
antiguos de otras pruebas solo recorren sus migraciones anteriores de DDL simple.

## Invitaciones a grupos

Solo el propietario puede invitar por correo. El destinatario debe aceptar
explícitamente desde una sesión con el mismo correo. Puede registrarse después
de recibir la invitación; no se crea una cuenta ni una membresía al enviar el
correo. No se exige correo previamente verificado y aceptar no modifica su
estado de verificación, no cambia contraseñas ni inicia una nueva sesión.

- `POST /api/groups/<groupId>/invitations`, JSON `{ "email": "persona@example.test" }`:
  requiere sesión del propietario, Origin HTTPS configurado y `X-CSRF-Token`.
  El correo se normaliza igual que en el registro. No se consulta si ya existe
  una cuenta con esa dirección ni se expone esa información. Se envía el código
  al correo solicitado y se toma el nombre del grupo desde D1. Los campos del
  cuerpo de identidad, grupo o destinatario alternativo no permiten sobrescribir
  esos datos. Devuelve 202 cuando SendGrid acepta el envío, sin devolver el código;
  esto no garantiza entrega en el buzón.
- `POST /api/invitations/accept`, JSON `{ "token": "<código>" }`:
  requiere sesión, Origin y CSRF. La cuenta se obtiene de la sesión y su correo
  almacenado debe coincidir con el invitado. La aceptación devuelve 204 sin cookie.
  Tras ella se aplican los permisos habituales de miembro, incluidos los de
  lectura de los eventos existentes del grupo.

La migración [0009_group_invitations.sql](migrations/0009_group_invitations.sql)
conserva los datos previos y añade una invitación actual por grupo/correo.
Los códigos son aleatorios de 256 bits y solo se guarda su hash SHA-256 con
un propósito distinto del de sesiones, verificación y recuperación. Caducan a
los siete días; el instante exacto de vencimiento ya es inválido. Reenviar crea
un código nuevo e invalida el anterior. No se permiten aceptar con otra cuenta,
reutilizar códigos consumidos ni aceptar invitaciones de un propietario que ya
no lo sea. Eliminar el grupo elimina sus invitaciones.

Consumir el código y añadir la membresía se realiza en un único batch D1:
si falla el alta, también se revierte el consumo. Una aceptación concurrente
solo tiene un ganador. Si la cuenta ya era miembro, se consume la invitación
sin duplicar ni cambiar la membresía. Retirar después al miembro no reactiva
los códigos que ya consumió.

Se admiten cinco solicitudes por grupo/correo y treinta por propietario cada
quince minutos. Los contadores son atómicos, incluyen intentos autorizados que
terminen limitados o fallen en el envío, y usan claves hash. Los no propietarios
se rechazan antes de consumir la cuota del grupo; la propiedad también se
comprueba en el SQL de emisión. Las respuestas limitadas devuelven 429 con
`Retry-After: 900`. Un grupo inexistente y uno sin propiedad comparten el mismo
404. Un código inválido, vencido, usado o de correo distinto devuelve el mismo 400.

Se reutilizan los límites JSON de 16 KiB y las respuestas no-store. Sin sesión
válida se devuelve 401; los fallos de Origin/CSRF, 403; tipo de contenido
incorrecto, 415; cuerpo excesivo, 413; métodos no admitidos, 405. Una configuración
de origen inválida impide operar con 503. Los fallos de SendGrid devuelven 503
genérico e invalidan únicamente el código de ese intento, sin borrar un reenvío
posterior. Se usa el remitente y secreto de SendGrid existentes, sin seguimiento
de aperturas/clics. No hay cola duradera, reintentos automáticos, garantía de orden
de entrega ni envío de correo probado en un buzón real.

Las pruebas interceptan todo envío y usan D1 efímera/workerd, incluyendo registro
público posterior a la invitación, login y aceptación. La interfaz, los enlaces
automáticos y la limpieza de invitaciones caducadas quedan para otros alcances.
El listado y la revocación se describen
a continuación.

### Administrar invitaciones

El propietario del grupo puede consultar y revocar invitaciones:

- `GET /api/groups/<groupId>/invitations?limit=20&cursor=<correo>` devuelve
  `{ invitations, nextCursor }`. Requiere sesión del propietario, sin CSRF
  porque es una lectura. Las invitaciones se ordenan por correo normalizado
  ascendente. El límite predeterminado es 20 y el máximo 50; se consulta una
  fila adicional para detectar la siguiente página. El cursor es el último
  correo devuelto, codificado para URL. Si no hay más resultados, vale `null`.
- Cada elemento contiene únicamente `email`, `createdAtMs`, `expiresAtMs` y
  `status`: `pending`, `expired` o `accepted`. Una invitación consumida permanece
  aceptada aunque después caduque o se retire la membresía. La caducidad es
  inclusiva: a partir de `expiresAtMs` ya se muestra caducada. Nunca se devuelven
  códigos, hashes ni marcadores de consumo.
- `DELETE /api/groups/<groupId>/invitations`, con JSON `{ "email": "persona@example.test" }`,
  requiere sesión del propietario, Origin y CSRF. Devuelve 204 y elimina solo
  la invitación activa sin consumir para ese correo. Es idempotente si no existe,
  está caducada o ya se aceptó; estas dos últimas filas se conservan. Una invitación
  aceptada no se revoca mediante esta operación ni se elimina la membresía.

El listado distingue un grupo accesible vacío (200 con array vacío) de uno
inexistente o sin propiedad (mismo 404). Comprueba la propiedad en la misma
consulta que obtiene los datos. La revocación también comprueba la propiedad
al borrar y comparte transacción con su comprobación de autorización, incluidos
los casos sin cambios. Un miembro que no sea propietario no puede listar ni
revocar invitaciones.

Si compiten aceptación y revocación, gana la primera que se serialice en D1:
si se aceptó, la membresía permanece; si se revocó, ese código ya no permite
aceptar. Una invitación emitida después de finalizar la revocación es válida.
Cuando compiten reenvío y revocación, la cancelación afecta a la invitación
vigente al ejecutar su transacción. No se envía correo al listar o revocar.

El listado muestra la fila actual por grupo/correo, no un historial de reenvíos
ni una confirmación de entrega. Las páginas no son una instantánea; un cursor
eliminado o de otro grupo nunca concede permisos ni impide continuar por su
posición. Cursores se normalizan como correos; límites inválidos, correos de
cursor inválidos y parámetros de paginación duplicados devuelven 400. Sesiones
inválidas devuelven 401, y los fallos de Origin/CSRF en DELETE, 403. Se mantienen
las respuestas no-store y el límite JSON de 16 KiB. La colección ahora admite
`GET, POST, DELETE`; los métodos restantes devuelven 405 con `Allow`.

El índice existente por grupo/correo permite paginar sin ordenación temporal;
no se han añadido migraciones ni dependencias. La interfaz, el historial, el
aviso de cancelación por correo siguen pendientes. Las pruebas comprueban
estados, permisos, paginación, rollback y
carreras de aceptación/reenvío con la revocación en D1 efímera/workerd.

## Miembros de grupos

`GET /api/groups/<groupId>/members` permite a cualquier miembro actual consultar
los miembros del grupo. Devuelve `{ members, nextCursor }`, ordenado por ID de
cuenta ascendente, con `limit` de 20 por defecto y máximo 50. Cada elemento
incluye únicamente `accountId`, `displayName`, `joinedAtMs` e `isOwner`.
No se incluyen correo, teléfono, apellidos ni credenciales. La identidad del
consultante siempre procede de la sesión, sin aceptar un actor del navegador.

La paginación usa el último ID de cuenta como cursor, codificado para URL.
Comprueba membresía y obtiene la página en la misma consulta SQL; recupera como
máximo 51 filas utilizando los índices existentes. Un cursor borrado o ajeno
no concede acceso ni impide continuar desde esa posición. Una página agotada
devuelve 200 con lista vacía y cursor nulo; un grupo inexistente o sin membresía
devuelve el mismo 404. Se mantienen los límites y validación de paginación
habituales, las respuestas no-store y 401 para sesiones inválidas.

`DELETE /api/groups/<groupId>/members/<accountId>` requiere sesión del propietario,
Origin HTTPS configurado y `X-CSRF-Token`. No necesita cuerpo. Devuelve 204 al
retirar o repetir la retirada de una cuenta ausente. Un grupo inexistente y uno
sin propiedad comparten 404. El propietario no puede retirarse: devuelve 409
sin alterar su membresía ni sus invitaciones. Los métodos incorrectos devuelven
405 con Allow; los fallos de Origin/CSRF devuelven 403, y una configuración de
origen inválida impide retirar con 503.

La operación cancela las invitaciones activas sin consumir para el correo
almacenado de la cuenta y elimina su membresía en un único batch D1, con la
propiedad comprobada en SQL. Si falla el borrado, se revierte también la
cancelación. Las invitaciones caducadas y consumidas se conservan. La cancelación
se aplica incluso si la membresía ya estaba ausente, para que una aceptación
concurrente de un código anterior no permita entrar después de la retirada.
Una invitación emitida posteriormente puede permitir una nueva incorporación;
esta operación no es un bloqueo permanente de la cuenta.

Retirar un miembro revoca sus consultas de grupo, eventos, miembros y asignación
privada. Conserva íntegros los sorteos y asignaciones cifrados, no elimina la
cuenta ni sus sesiones y no afecta a otros grupos. Una reincorporación posterior
restablece las lecturas sujetas a la membresía vigente. El método antiguo
`GroupsRepository.removeMember` permanece como operación interna de bajo nivel;
la API pública usa el repositorio de miembros para garantizar la cancelación
atómica de invitaciones.

La incorporación inicial de estas rutas no añadió migraciones, dependencias,
correos, interfaz, transferencia de propiedad ni baja voluntaria. El ciclo de
sorteos descrito a continuación sí amplía la persistencia. Las pruebas en D1 efímera/workerd comprueban
privacidad, permisos, protección del propietario, paginación, rollback,
concurrencia con aceptación, revocación de lecturas y conservación del cifrado.

## Sorteos y cierre de eventos

La migración [0010_event_draw_lifecycle.sql](migrations/0010_event_draw_lifecycle.sql)
incorpora el cierre efectivo y versiones de los sorteos. Conserva los IDs, fechas
y bytes cifrados anteriores; solo adopta como vigente un sorteo anterior completo
cuyos participantes coincidan con los miembros actuales. Los restantes quedan
como historial. No se deduce un cierre histórico por tener una fecha programada
pasada. La fecha de creación del evento sigue siendo inmutable.

- `GET /api/events/<eventId>/draw`: cualquier miembro actual consulta
  `{ event: { eventId, closedAtMs, drawId, status } }`. Los estados son `pending`,
  `ready` y `closed`. Un evento abierto sin sorteo actualizado devuelve `drawId: null`.
  No devuelve participantes, destinatarios ni claves.
- `POST /api/events/<eventId>/draw`: el propietario solicita el sorteo de todos
  los miembros actuales, incluido él. No necesita cuerpo. Requiere al menos tres
  miembros. Repetir la petición sin cambios de membresía reutiliza el mismo sorteo.
- `POST /api/events/<eventId>/close`: el propietario cierra el evento, incluso
  antes de la fecha programada. Si falta un sorteo actualizado, lo calcula y lo
  publica junto con el cierre en una única transacción. Si ya está actualizado,
  lo conserva. Con menos de tres miembros no cierra.

Ambos POST requieren sesión, Origin HTTPS exacto y `X-CSRF-Token`; responden
200 con el mismo formato de estado. Un evento inexistente, sin propiedad o
heredado sin grupo devuelve el mismo 404. Eventos ya cerrados, menos de tres
miembros o cambios de membresía que impidan publicar tras tres intentos devuelven
409. Las lecturas requieren membresía (404 si falta); sesiones inválidas devuelven
401, fallos de Origin/CSRF 403 y métodos incorrectos 405. Todo usa `no-store`.

Las incorporaciones, incluidas las aceptaciones de invitación, invalidan el sorteo
de los eventos abiertos sin ejecutarlo automáticamente. Así se pueden incorporar
varias personas antes de solicitar un único nuevo sorteo. La retirada pública de
un miembro recalcula los eventos abiertos si quedan al menos tres personas;
con menos, quedan pendientes. Los eventos cerrados mantienen sus participantes
y asignaciones. Los sorteos anteriores se conservan cifrados y no se sobrescriben.
La revisión de membresía se incrementa en triggers D1 y se comprueba dentro de
la escritura del sorteo/cierre para impedir resultados desactualizados.

La retirada confirma primero la revocación de acceso y marca de forma duradera
los eventos pendientes; después procesa hasta 20 eventos por petición. Si falla
un recálculo o quedan más eventos, devuelve **503 con la retirada ya realizada**.
Repetir el mismo DELETE retoma los pendientes sin repetir los sorteos completados.
Hasta completarlos, los sorteos desactualizados no se muestran como vigentes.
La petición puede reintentarse de inmediato. El programador descrito más adelante
también recupera los pendientes de forma autónoma una vez desplegado.

El Worker necesita `DRAW_KEY_ID` (identificador estable) y los secretos
`DRAW_CIPHER_KEY_HEX` y `DRAW_INDEX_KEY_HEX`: dos claves distintas de 32 bytes,
codificadas cada una como 64 caracteres hexadecimales. Deben generarse con
aleatoriedad criptográfica y configurarse como secretos de Worker. Nunca se
guardan en D1 ni en archivos versionados. Una configuración ausente o inválida
devuelve 503 cuando sea necesario cifrar. Cada rotación debe usar un ID nuevo;
conservar las claves antiguas de forma segura para consultar eventos anteriores.
La carga de escritura mantiene la clave activa; la consulta privada descrita
más adelante permite claves anteriores conservadas en secretos.

El servicio cifra como máximo 16 asignaciones simultáneamente y publica cada
sorteo completo en un único batch de `2 + 2N` sentencias, con hasta nueve parámetros
por sentencia. La instantánea y las sentencias siguen creciendo con N: no existe
una capacidad ilimitada ni una capacidad de producción certificada. Los límites
de CPU, memoria y duración de consulta siguen aplicándose; consultar los
[límites oficiales de D1](https://developers.cloudflare.com/d1/platform/limits/)
antes de publicar o fijar límites de producto.

Las pruebas usan D1 efímera/workerd, claves sintéticas y ningún correo real.
El programador de cierre automático y los avisos duraderos se describen más adelante.
La fecha programada es un vencimiento, no una prueba de cierre efectivo.

## Consulta privada del destinatario

`GET /api/events/<eventId>/recipient` requiere una sesión y membresía actual en
el grupo. Devuelve únicamente:

```json
{
  "drawId": "<current-draw-id>",
  "recipient": { "accountId": "<recipient-account-id>", "displayName": "<current-name>" }
}
```

Cada participante, incluido el propietario, consulta exclusivamente su propia
asignación. Los parámetros de actor, participante, sorteo o destinatario enviados
por el navegador no permiten elegir otra asignación. No se devuelven correo,
teléfono, apellidos, credenciales, claves ni sobres cifrados. El nombre corresponde
al perfil actual del destinatario, no a una instantánea histórica de su nombre.

La consulta se permite con sorteo actualizado en eventos abiertos y cerrados.
En eventos abiertos, el destinatario puede cambiar al recalcular el sorteo.
Si no existe sorteo vigente o ha quedado desactualizado, devuelve 409. Un evento
inexistente, inaccesible o heredado sin grupo devuelve el mismo 404. También
devuelve 404 a un miembro nuevo que no participó en el sorteo cerrado. Retirar
un miembro revoca su acceso; si se reincorpora, puede recuperar el acceso a los
sorteos vigentes en los que participó. Un participante que conserve acceso a un
evento cerrado puede seguir viendo a su destinatario aunque este haya dejado
el grupo.

La primera consulta SQL comprueba membresía, versión vigente y asignación propia.
Tras descifrar con AES-GCM, otra consulta revalida esos permisos y la misma versión
y resuelve el nombre del destinatario, exigiendo que perteneciera a la instantánea.
Si la versión cambia durante el descifrado, responde 409; si se pierde la membresía,
404. La comprobación final define el estado observado por la lectura; las
incorporaciones posteriores pueden volver a invalidar un sorteo abierto.
Se realizan dos lecturas SQL acotadas, sin cargar el listado de participantes.

La clave activa usa `DRAW_KEY_ID` y `DRAW_CIPHER_KEY_HEX`. Para conservar acceso a
eventos cifrados antes de una rotación, configurar también el secreto de Worker
`DRAW_PREVIOUS_CIPHER_KEYS_JSON`, con este formato (los valores son marcadores):

```json
[{ "id": "<previous-key-id>", "cipherHex": "<64-hex-characters>" }]
```

Cada entrada contiene una clave AES de 32 bytes en hexadecimal y su ID original.
Los IDs deben ser únicos y no repetir el activo. Se importa únicamente la clave
seleccionada como no extraíble y con permiso de descifrado. Esta lectura no usa
claves HMAC; su conservación para otros procesos sigue su política correspondiente.
Una clave ausente o configuración inválida devuelve 503 genérico. Un fallo de
autenticación AES-GCM o datos corruptos devuelve 500 genérico, sin intentar otra
asignación ni revelar detalles criptográficos. No se han configurado claves reales.

Sesiones inválidas devuelven 401; IDs vacíos o mal codificados, 400; métodos
distintos de GET, 405 con `Allow: GET`. Las respuestas usan `Cache-Control: no-store`,
sin ampliar CORS ni emitir cookies. Al ser una lectura, no requiere Origin ni CSRF.
No genera sorteos, cierres ni correos. No se añaden migraciones ni dependencias.
Las pruebas usan claves sintéticas y D1 efímera/workerd para verificar aislamiento,
rotación, revocación, datos manipulados y cambios concurrentes.

## Procesamiento programado de eventos

El manejador `scheduled` del Worker está configurado con `* * * * *` en
[wrangler.jsonc](wrangler.jsonc), una ejecución por minuto en UTC mediante
[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).
La configuración está preparada en el repositorio; no se ha desplegado ni activado
un programador remoto. No depende de navegador, sesión de usuario o tráfico HTTP.
No se añade un endpoint público para ejecutar el procesamiento.

Cada ejecución procesa como máximo 20 cierres vencidos y 20 recálculos pendientes.
Los cierres van primero; se usan las fechas del reloj del servidor, no una fecha
de activación proporcionada por el llamante. Solo se cierran eventos abiertos con
fecha no nula ya alcanzada y al menos tres miembros actuales. El vencimiento se
revalida dentro del SQL que publica el sorteo/cierre, junto con propiedad y revisión
de membresía. El propietario conserva la posibilidad de cerrar anticipadamente.
Un evento vencido con menos de tres miembros queda pendiente; al alcanzar tres,
puede cerrarse en una ejecución posterior. Los eventos sin fecha solo se recalculan
si tienen trabajo pendiente; no se cierran automáticamente.

La migración [0011_scheduled_event_processing.sql](migrations/0011_scheduled_event_processing.sql)
añade `event_processing_jobs`, con un trabajo por evento/tipo, versión, etapa de
reintento y próxima fecha. Incorpora los eventos abiertos existentes y mantiene
el trabajo mediante triggers en la misma transacción que la membresía o el evento.
Una retirada encola recálculos; añadir miembros reinicia el trabajo existente pero
no crea un recálculo automático por sí solo. Publicar un sorteo elimina su recálculo
pendiente y cerrar elimina ambos tipos. Eliminar el evento elimina sus trabajos.
El índice por tipo/fecha/ID permite consultar lotes acotados por próxima fecha.

Si un evento falla, se conserva para reintentar tras 1, 2, 4, 8 y después 15 minutos,
manteniendo ese último intervalo sin abandonar el evento. La etapa almacenada se
satura en cinco; no cuenta el total de intentos. Los conflictos de membresía que
persistan tras los tres intentos del servicio también reciben espera. Los cambios
de membresía reinician esa espera. Un fallo no impide procesar los demás candidatos.
Si no puede persistirse el reintento, falla la invocación y el trabajo permanece
para futuras ejecuciones. Este mecanismo es independiente del límite de seis
intentos fallidos de correo aplicado a los avisos descritos a continuación.

Las ejecuciones simultáneas y los cierres manuales reutilizan los sorteos vigentes.
Las escrituras de reintento comparan versión del trabajo y revisión de membresía:
un fallo antiguo no puede retrasar trabajo nuevo ni recrear uno completado.
Los logs del programador contienen solo contadores `closed`, `redrawn`, `deferred`
y `failed`, sin destinatarios, secretos ni errores originales. Que la invocación
termine correctamente no significa que todos los eventos hayan terminado: deben
revisarse esos contadores y el trabajo pendiente.

Las pruebas ejecutan el manejador real con Miniflare/workerd y D1 efímera, además
de probar límites de lote, reintentos, rollback, migración y concurrencia. No se
han aplicado migraciones a la base persistente ni a D1 remota. La ejecución requiere
las claves de escritura ya descritas cuando deba generar un sorteo nuevo.

La cadencia de un minuto **no certifica el objetivo de 60 segundos**. El tiempo de
procesamiento, los lotes acumulados, los reintentos y los
[límites de Workers](https://developers.cloudflare.com/workers/platform/limits/)
pueden ampliar el retraso. Antes de publicar hay que configurar recursos reales,
aplicar la migración en el entorno autorizado, desplegar y medir desde el vencimiento
hasta el cierre confirmado sin tráfico de navegador. Este alcance no realiza esas
operaciones. Las pruebas interceptan los envíos; no se ha enviado correo real.

## Avisos duraderos de cierre

La migración [0012_draw_notifications.sql](migrations/0012_draw_notifications.sql)
añade una bandeja de salida D1. Cada nuevo cierre, manual o automático, encola una
notificación por participante en la misma transacción. Si falla el alta del aviso,
se revierte también el cierre y cualquier sorteo creado en ese batch. No se
generan avisos para cierres históricos ni para sorteos de eventos todavía abiertos.
La clave única evento/cuenta impide encolar dos veces el mismo aviso.

El correo avisa de que el evento se ha cerrado e indica su identificador para
consultarlo en TocaRegalo tras iniciar sesión. **No incluye el destinatario asignado**,
datos de otras personas, credenciales ni un enlace que eluda la autenticación.
Se usa el correo almacenado de la cuenta, sin exigir una verificación adicional.
La cola guarda referencias y estado, sin copiar correos ni asignaciones en claro.

Después de procesar cierres y recálculos, el programador selecciona hasta 20 avisos
por ejecución. Reserva cada aviso justo antes de enviarlo, durante 120 segundos,
mediante una actualización condicional y un token aleatorio. Antes del envío
vuelve a comprobar membresía y sorteo cerrado y consulta el correo actual.
Una retirada cancela atómicamente los avisos pendientes y reservados de esa cuenta
en el grupo. Reincorporarse no los reactiva. Los ya aceptados no se reenvían.
Si la retirada ocurre cuando el envío ya está en curso, no puede retirarse ese correo.

Se reutilizan `SENDGRID_API_KEY` y `SENDGRID_FROM_EMAIL`, el transporte HTTPS con
timeout de diez segundos, sin redirecciones ni seguimiento. Los estados son
`pending`, `sending`, `accepted`, `failed` y `cancelled`. `accepted` significa que
SendGrid respondió 202; no prueba entrega en el buzón. Los errores conocidos
reintentan tras 1, 2, 4, 8 y 16 minutos y paran después del sexto fallo. Las fechas
marcan el primer instante elegible: la cadencia de Cron y el trabajo acumulado
pueden retrasar la ejecución. Los fallos de configuración también cuentan.

Si el procesador se interrumpe, otro puede recuperar la reserva al caducar.
Las confirmaciones y errores comparan el token para no alterar una reserva nueva
ni un aviso cancelado. Una confirmación tardía puede completar una reserva
caducada si ningún otro procesador sustituyó su token. Un error al guardar una
aceptación hace fallar la invocación; no se cuenta como fallo del proveedor.

No existe garantía de entrega exactamente una vez: una aceptación con respuesta
perdida, un timeout o una reserva que venza con el envío en curso pueden ocasionar
duplicados al recuperar el trabajo. Las interrupciones de resultado desconocido no
se cuentan como fallos conocidos. Los logs contienen solo contadores agregados,
nunca direcciones, asignaciones, tokens ni errores originales del proveedor.

Los avisos no bloquean la respuesta HTTP de cierre ni modifican la consulta privada
del destinatario. Este alcance no convierte invitaciones, verificación o recuperación
en envíos duraderos, ni añade interfaz de administración, reenvío manual, webhooks
de entrega o limpieza por antigüedad. Las credenciales y recursos reales siguen
pendientes de configuración autorizada. Las pruebas usan D1 efímera/workerd y
SendGrid simulado; no se han aplicado migraciones persistentes ni enviado correo real.
