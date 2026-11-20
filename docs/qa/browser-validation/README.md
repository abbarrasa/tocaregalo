# Comprobación de navegador y cookies — 2026-11-20

Resultado: los flujos comprobados funcionan contra el Worker local y D1 efímera, con **una incidencia abierta tras confirmar el correo**. No constituye una aprobación para producción.

Revisión: `f4cc2b0`, rama `feature/browser-validation`, creada desde `dev` actualizado y limpio. No se modificó código de aplicación ni se realizaron commits, pushes o despliegues.

## Entorno y alcance

- Navegador integrado de VS Code: Chromium 150.0.7871.250 / Electron 43.8.9 sobre Linux. Interacciones con DOM y API reales, sin jsdom ni respuestas simuladas para `/api`.
- Vite HTTPS en `https://localhost:5173`, proxy al Worker local de Miniflare/workerd en `127.0.0.1:8787`. Migraciones 0001–0012 aplicadas exclusivamente a D1 efímera.
- Cuentas ficticias `example.test`, teléfono de ficción y claves de cifrado sintéticas. Dos miembros se provisionaron como fixtures internos para el primer sorteo; posteriormente se comprobó una incorporación pública mediante invitación desde otra cuenta.
- Todas las solicitudes de correo quedaron interceptadas por el entorno local. Los códigos de verificación, recuperación e invitación se conservaron solo en memoria del proceso temporal y se consumieron en los formularios, sin incluirlos en capturas o informes. Ningún correo llegó a un proveedor o buzón real.
- Se utilizó una excepción temporal al certificado autofirmado del navegador y se retiró al terminar. No se modificaron Origin, CSRF, cookies, CORS de la aplicación ni la confianza de certificados del sistema.
- Configuraciones de captura de escritorio y móvil: nominalmente 1440×1000 y 390×844. El navegador integrado reajusta el área visible; se observaron anchuras CSS aproximadas de 1193 y 383 píxeles. Las capturas no certifican un dispositivo físico concreto.

## Resultados observados

| Comprobación | Resultado |
| --- | --- |
| Formulario de registro vacío | La validación nativa bloquea el envío y enfoca `name`; apellidos y teléfono son opcionales. |
| Registro con contraseña de seis caracteres | 201; vuelve a login y `/api/me` sigue devolviendo 401. No autentica automáticamente. |
| Login por correo y por teléfono internacional | 200; cuenta privada visible. |
| Recarga con sesión | La cuenta se restaura mediante la cookie y `/api/me` devuelve 200. |
| Cookie emitida | `__Host-tocaregalo_session`, `Path=/`, `Secure`, `HttpOnly`, `SameSite=Lax`, sin atributo Domain; `Max-Age` observado de 86399 segundos. |
| Acceso desde JavaScript | La cookie de sesión no aparece en `document.cookie`. `localStorage` y `sessionStorage` permanecen vacíos. |
| CSRF | Un POST de creación sin prueba devuelve 403; el formulario real con CSRF crea el grupo con 201. |
| Logout | 204; el servidor emite `Max-Age=0` con los mismos atributos y Chromium elimina la cookie. |
| Revocación efectiva | `/api/me` devuelve 401 sin cookie y también al reintroducir la cookie anterior al logout. Se eliminó después la cookie de replay. No se registró su valor. |
| Grupos y miembros | Creación, detalle, actualización y retirada confirmada funcionan; DELETE 204 y foco en la confirmación. |
| Invitaciones | Envío 202 con transporte interceptado, listado, revocación 204 y aceptación 204 desde otra cuenta registrada. El participante ve el grupo sin panel de invitaciones ni controles de retirada. |
| Eventos | Creación 201 sin programación y con fecha futura; fecha pasada rechazada por el formulario. La hora local coincide con el instante guardado y el evento nuevo aparece primero. |
| Sorteo y cierre | Confirmaciones visibles y enfocadas; ambos POST devuelven 200. El cierre efectivo aparece y desaparecen las acciones del evento cerrado. |
| Destinatario privado | 409 antes del sorteo; 200 después y tras el cierre. Ocultar y actualizar el estado eliminan el nombre; volver a revelar hace otra lectura. Sin datos de asignación en capturas, URLs o almacenamiento. |
| Verificación de correo | Solicitud 202 y confirmación 204 mediante código interceptado. El perfil muestra correo verificado, pero aparece la incidencia descrita abajo. |
| Recuperación | Solicitud 202 y confirmación 204 mediante código interceptado. No inicia sesión; la contraseña anterior devuelve 401 y la nueva permite login 200. |

En la primera preparación del entorno temporal se omitió la variable de duración de recuperación, por lo que una petición devolvió 503. Se corrigió **el harness temporal**, se reinició con otra D1 efímera y se repitió el flujo satisfactoriamente. No fue un cambio ni un fallo atribuido a la aplicación.

## Incidencia abierta: navegación bloqueada tras verificar el correo

1. Registrar una cuenta, iniciar sesión y solicitar el código de verificación.
2. Confirmar el código desde «Mi cuenta».
3. Observar la confirmación 204 y el perfil con «Correo verificado».
4. El menú conserva `aria-disabled="true"`; intentar abrir «Grupos» vuelve a la vista de cuenta.
5. Recargar restaura la sesión y devuelve `aria-disabled="false"`, permitiendo continuar.

Esperado: liberar el bloqueo del menú al terminar la confirmación y actualización de cuenta, sin recargar. Impacto: interrumpe la navegación hasta recargar; la verificación sí queda aplicada. La captura [verification-navigation-issue.png](./verification-navigation-issue.png) muestra el perfil verificado y el menú deshabilitado.

Pendiente de corrección aprobada. Revisar la coordinación de `busy` durante la actualización/remontaje entre [App.vue](../../../frontend/src/App.vue) y [AccountPanel.vue](../../../frontend/src/AccountPanel.vue). La causa exacta y la regresión deben confirmarse durante esa tarea; esta comprobación no modifica el código.

## Revisión visual y límites

Se inspeccionaron las imágenes de acceso, registro, cuenta, grupo, confirmación de sorteo, evento cerrado y vista de participante. En las pantallas inspeccionadas los textos y controles permanecen legibles, los botones se adaptan al ancho y no se observó desbordamiento horizontal en las mediciones realizadas. Se observaron foco de teclado, validación nativa y distribución móvil. La incidencia del menú impide dar el conjunto por completamente correcto.

La automatización de clics devolvió timeouts de hit-testing intermitentes aunque la consulta DOM del punto central identificaba el control. Los flujos se completaron con foco y Enter/Espacio reales de Chromium. No se ha determinado si esa discrepancia procede de la integración del navegador o de otra condición; queda pendiente comprobar puntero/táctil sin esa limitación. Algunas capturas de página completa conservan indicadores de foco o del enlace para saltar al contenido.

No se han certificado Safari, Firefox, dispositivos móviles físicos, expiración natural tras 24 horas, navegación entre sitios para SameSite, entrega real de correo, Cron remoto, capacidad, accesibilidad formal ni HTTPS de producción. Se comprobaron atributos/alcance declarado de cookie y revocación real, no todas las políticas posibles del navegador. Las herramientas de contexto `Storage.getCookies`/APIRequestContext no estaban disponibles; la inspección y replay se realizaron con `Network.getCookies`/`Network.setCookie` del destino CDP y fetch desde la página.

## Evidencias

| Pantalla | Captura |
| --- | --- |
| Acceso escritorio | [login-desktop.png](./login-desktop.png) |
| Acceso móvil | [login-mobile.png](./login-mobile.png) |
| Registro y validación nativa | [register-mobile.png](./register-mobile.png) |
| Cuenta escritorio | [account-desktop.png](./account-desktop.png) |
| Grupo propietario escritorio | [group-desktop.png](./group-desktop.png) |
| Grupo propietario móvil | [group-mobile.png](./group-mobile.png) |
| Confirmación de sorteo móvil | [draw-confirmation-mobile.png](./draw-confirmation-mobile.png) |
| Evento cerrado escritorio | [event-closed-desktop.png](./event-closed-desktop.png) |
| Evento cerrado móvil | [event-closed-mobile.png](./event-closed-mobile.png) |
| Grupo participante móvil | [participant-mobile.png](./participant-mobile.png) |
| Incidencia de verificación | [verification-navigation-issue.png](./verification-navigation-issue.png) |

Sesiones cerradas, cookie de prueba eliminada, excepción TLS retirada y servidores temporales detenidos al finalizar. La base persistente local y los recursos remotos quedaron intactos. Se eliminó el harness temporal. Validación de documentación: `git diff --check`; las suites Node/Vitest, tipos y build no se reejecutaron en esta tarea sin cambios de código. Sus resultados históricos están en [MEMORY.md](../../../MEMORY.md).
