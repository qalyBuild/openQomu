# Política de seguridad

Español · [English](SECURITY.md)

## Versiones soportadas

La última versión menor recibe correcciones de seguridad. Las versiones anteriores pueden requerir una actualización.

## Reportar una vulnerabilidad

No abras una incidencia pública. Envía un informe privado a `carlos09102007@gmail.com` con:

- Versión o commit afectados.
- Pasos para reproducir el problema, con un ejemplo mínimo.
- Impacto: qué puede leer o modificar un atacante.
- Si afecta a la configuración por defecto o solo a un despliegue concreto.

Recibirás acuse de recibo en 5 días laborables y una actualización de estado en 15 días laborables. Deja tiempo para corregir y coordinar la divulgación antes de publicar detalles.

## Alcance

Dentro del alcance:

- Fallos de autorización en `firestore.rules` y `storage.rules`.
- Filtraciones de datos entre espacios a través del cliente o de los Workers.
- Exposición de tokens o secretos en el repositorio o en el paquete compilado.
- Inyección, cross-site scripting y renderizado inseguro en la aplicación.
- Debilidades en la autenticación y el modelo de scopes del MCP.

Fuera del alcance:

- Hallazgos de escáneres automáticos sin impacto demostrado.
- Denegación de servicio por agotamiento de cuotas en un despliegue autoalojado.
- Mala configuración de un despliegue de terceros (por ejemplo, dejar el modo demo expuesto a propósito).

## Recomendaciones para operadores

- Mantén las reglas de Firestore sincronizadas con la aplicación desplegada.
- Restringe los dominios autorizados en Firebase Auth.
- Despliega los Workers solo con cuentas de servicio de mínimo privilegio.
- Rota las credenciales tras cualquier filtración sospechada.
- Activa copias de seguridad y alertas de facturación.

Consulta [docs/security.es.md](docs/security.es.md) para el modelo de confianza.
