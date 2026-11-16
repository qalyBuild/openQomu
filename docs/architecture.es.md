# Architecture

Español · [English](architecture.md)

## Visión general

openQomu es una aplicación React de página única que habla con el backend a través de puertos. El dominio no conoce React, Firebase ni Capacitor, así que el mismo producto funciona con Firestore, con un almacén de demostración en el navegador o con un adaptador de backend futuro.

```
presentación ──▶ app (contenedor) ──▶ puertos del dominio ──▶ adaptadores
      │                                                        │
      └────────────── estado de React, hooks ──────────────────┘
```

## Capas

| Ruta | Responsabilidad |
| --- | --- |
| `src/domain` | Entidades, servicios puros, validación, reglas de permisos e interfaces de puertos. Sin dependencias de frameworks. |
| `src/app` | Composición de dependencias (`createContainer`), proveedores, rutas y arranque del espacio. |
| `src/infrastructure` | Adaptadores: `firebase`, `demo`, `capacitor`, `push`. |
| `src/presentation` | Páginas, componentes de funcionalidades, primitivas de interfaz y hooks. |
| `src/lib` | Utilidades pequeñas sin framework: fechas, URLs, clases CSS. |
| `src/config` | Configuración de despliegue (`PRODUCT_NAME`, `PRODUCT_SLUG`). |

## Puertos y adaptadores

`src/domain/ports` declara una interfaz por agregado: espacios, miembros, canales, mensajes, tableros, tareas, páginas, archivos, carpetas, tokens MCP, dispositivos y la cola de notificaciones. Hoy hay dos adaptadores:

- **demo**: almacén en memoria persistido en `localStorage` y archivos en `IndexedDB`. Se elige automáticamente cuando faltan las credenciales de Firebase.
- **firebase**: colecciones de Firestore, Firebase Auth y Storage opcional. Se elige cuando existen las seis variables `VITE_FIREBASE_*`.

`src/app/container.ts` importa el adaptador de forma perezosa, de modo que el paquete de demostración no descarga el SDK de Firebase y viceversa.

Añadir un backend significa implementar los puertos; no hay que tocar dominio ni presentación. Consulta [roadmap.es.md](roadmap.es.md).

## Modelo de datos

| Entidad | Clave | Notas |
| --- | --- | --- |
| Espacio | `workspaces/{workspaceId}` | Slug más sufijo aleatorio, inmutable. |
| Miembro | `workspaces/{id}/members/{uid}` | Rol: `owner`, `admin` o `member`. |
| Canal | `workspaces/{id}/channels/{channelId}` | Público o privado con `memberIds`. |
| Mensaje | `.../channels/{id}/messages/{messageId}` | Cuerpo, adjuntos, reacciones, respuesta, `deletedAt`. |
| Tablero / columna | `.../boards/{id}` | Columnas con límite de trabajo en curso y color. |
| Tarea | `.../boards/{id}/tasks/{taskId}` | Prioridad, etiquetas, dependencias, responsables, revisor. |
| Página | `.../pages/{pageId}` | Documento de texto enriquecido. |
| Archivo | `.../files/{fileId}` | Metadatos en Firestore, binario según el backend. |
| Carpeta | `.../fileFolders/{folderId}` | Árbol de la biblioteca de archivos. |
| Token MCP | `.../mcpTokens/{tokenId}` | Hash y scopes; el secreto se muestra una sola vez. |
| Dispositivo | `.../devices/{deviceId}` | Token FCM por instalación. |
| Cola de push | `.../pushOutbox/{eventId}` | Cola que procesa el Worker de push. |

El borrado de mensajes es lógico: `deletedAt` marca la lápida, la interfaz la muestra una hora y después `push-worker` borra el documento. Los archivos pasan por papelera antes del borrado definitivo.

## Flujo de ejecución

1. `main.tsx` monta los proveedores: tema, autenticación y espacios.
2. `createContainer()` elige el adaptador según el entorno de compilación.
3. Los proveedores se suscriben a los flujos de espacios, canales y tableros y los exponen mediante hooks.
4. Las mutaciones pasan por métodos de repositorio que validan antes con servicios de dominio.
5. Las notificaciones se escriben en la cola; el Worker de push las entrega a FCM.

## Tiempo real

Los listeners `onSnapshot` de Firestore mantienen chat, tableros y estado de escritura. La presencia se deduce de `lastActiveAt`. En modo demo el almacén notifica a los suscriptores de forma síncrona.

## Frontera de seguridad

El cliente no es de confianza. `firestore.rules` y `storage.rules` imponen pertenencia, roles, inmutabilidad de campos y límites de tamaño. Consulta [security.es.md](security.es.md).

## Decisiones

Los registros de decisiones de arquitectura están en [adr/](adr/).
