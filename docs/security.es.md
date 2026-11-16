# Seguridad

Español · [English](security.md)

## Modelo de confianza

El cliente no es de confianza. Cualquiera puede compilar un frontend modificado contra tu proyecto de Firebase, así que todas las reglas las aplica el servidor mediante `firestore.rules` y `storage.rules`.

- Un usuario debe pertenecer a un espacio para leer o escribir sus datos.
- Los roles son `owner`, `admin` y `member`; las operaciones destructivas requieren propiedad o administración.
- Solo el autor de un mensaje o un administrador pueden editarlo o eliminarlo.
- La inmutabilidad de campos está garantizada: `authorId`, `createdAt`, `workspaceId` y los identificadores de canal no cambian.
- Los límites de tamaño de archivo y de longitud del cuerpo se aplican en las reglas, no solo en la interfaz.
- Los tokens MCP guardan un hash y los scopes, nunca el secreto.

## Límites conocidos

- El modo local no tiene autenticación ni sincronización entre dispositivos: es un espacio de un solo navegador.
- Las reglas protegen los datos, no la disponibilidad. Usa cuotas y App Check si expones una instancia públicamente.
- Los mensajes eliminados siguen siendo legibles por los miembros del espacio durante una hora, hasta que `push-worker` los purga. Sin ese Worker permanecen hasta que los borres manualmente.
- Un administrador puede leer el contenido de un espacio. Documéntalo en las políticas de tu organización.

## Secretos

El repositorio no debe contener nunca:

- Archivos JSON de cuentas de servicio.
- Claves de S3, Cloudflare o administración de Firebase.
- UIDs, correos o dominios personales de un despliegue privado.

`npm run check:private` recorre el árbol en busca de valores conocidos y la integración continua ejecuta un escáner de secretos en cada push. Los secretos pertenecen al entorno de despliegue: `.env.local`, `wrangler secret put` o secretos de CI.

## Reportar una vulnerabilidad

No abras una incidencia pública. Sigue [SECURITY.es.md](../SECURITY.es.md) en la raíz del repositorio.

## Lista de comprobación operativa

- [ ] Revisa `firestore.rules` tras cada cambio del modelo de datos.
- [ ] Ejecuta `npm run test:rules` en local y en CI.
- [ ] Activa copias de seguridad de Firestore.
- [ ] Rota las credenciales si el repositorio filtró alguna.
- [ ] Mantén las dependencias al día; Dependabot abre pull requests semanales.
