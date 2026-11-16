# Hoja de ruta

Español · [English](roadmap.md)

Esta hoja de ruta es orientativa. Las prioridades siguen los informes de usuarios y el trabajo de seguridad.

## v0.1 — Publicación

- Saneamiento del repositorio, licencia AGPL-3.0 y documentación bilingüe.
- Modo local y Firebase propio documentados de principio a fin.
- Workers opcionales generalizados: almacenamiento S3, push y MCP sin valores de un proyecto concreto.
- Ejemplos de Docker, nginx y Caddy; build estático para cualquier host.
- Integración continua sin secretos: lint, tipos, pruebas, reglas, build web y build Android.
- Release `v0.1.0` con paquete estático y APK.

## v0.2 — Independencia del backend

- Documentar `src/domain/ports` como contrato público.
- Adaptador de Supabase: esquema PostgreSQL, migraciones, seguridad a nivel de fila equivalente a `firestore.rules`, Realtime para mensajes y presencia, Storage para archivos.
- Selección con `VITE_BACKEND=firebase|supabase|demo`.
- Matriz de compatibilidad por funcionalidad.

## v0.3 — Internacionalización

- Extraer los textos de interfaz y añadir catálogos `es` y `en`.
- Fechas y números según el idioma.
- Selector de idioma guardado por usuario.

## Pendientes

- Inicio de sesión único (OIDC).
- Importación y exportación de espacios.
- Búsqueda de mensajes con índice en lugar de filtrado en el cliente.
- Registro de auditoría de acciones administrativas.
- Canales privados con cifrado de extremo a extremo (investigación).
