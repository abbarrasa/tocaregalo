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

## Estado

El código actual cubre el sorteo uniforme, el límite lógico del cierre, el
cálculo de reintentos y el cifrado autenticado del destinatario. Las pruebas
usan datos sintéticos y no requieren paquetes ni servicios externos.

La aplicación seguirá usando Vue y Bootstrap. La API se implementará en
TypeScript como Worker, con D1 para persistencia y SendGrid HTTPS para el
correo. El acceso a la URL publicada será público y la aplicación autenticará
por su cuenta antes de conceder acceso a cuentas y datos de grupos o eventos.

Quedan pendientes el frontend, la API autenticada, las transacciones en D1,
la integración de correo, el procesamiento desatendido de cierres y reintentos
y la publicación. Las pruebas de calendario aquí ejercitan funciones de dominio.
La prueba del plazo de 60 segundos debe cronometrar el cierre desde el instante
previsto en un entorno publicado, sin tráfico de navegador ni sesión abierta.
Si Sites no expone un programador con esa cadencia y latencia, el procesamiento
necesitará un programador externo que invoque un endpoint autenticado e idempotente.
