# openQomu

Español · [English](README.md)

openQomu es un espacio de trabajo colaborativo que puedes alojar tú: chat en tiempo real, tableros Kanban, documentos, biblioteca de archivos, invitaciones y un panel de métricas. Es una aplicación React de página única con backend opcional de Firebase, así que puedes probarla en local sin configurar nada o desplegarla en tu propia infraestructura.

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, Radix UI.
- **Arquitectura:** hexagonal (dominio puro, puertos, adaptadores) con un adaptador de demostración en memoria.
- **Backend (opcional):** Firebase Auth, Firestore y Storage.
- **Servicios opcionales:** Worker de archivos sobre almacenamiento compatible con S3, Worker de push para FCM, servidor MCP remoto para agentes de IA.
- **Licencia:** AGPL-3.0-only. Consulta [docs/licensing.es.md](docs/licensing.es.md).

openQomu es un proyecto independiente de código abierto. No está afiliado, respaldado ni soportado por ningún producto comercial con un nombre similar. Consulta [TRADEMARKS.es.md](TRADEMARKS.es.md).

## Funcionalidades

- **Canales e hilos** con menciones, reacciones, respuestas, edición, indicador de escritura y confirmaciones de lectura.
- **Tableros Kanban** con arrastrar y soltar, prioridades, etiquetas, dependencias, responsables y flujo de revisión.
- **Documentos** con editor de texto enriquecido y autoguardado.
- **Biblioteca de archivos** con carpetas, búsqueda, favoritos, papelera y almacenamiento configurable.
- **Espacios e invitaciones** con enlaces que caducan y permisos por rol.
- **Panel** con métricas de actividad y carga de trabajo.
- **Modo local** sin servidores: los datos viven en `localStorage` e `IndexedDB`.
- **App Android** con Capacitor, distribuida por tu propio canal de publicación.
- **Servidor MCP** para que los agentes de IA lean y actualicen tareas.

## Inicio rápido (modo local)

Requisitos: Node.js 22.13 o superior.

```bash
npm ci
npm run dev
```

Abre `http://localhost:5173` y pulsa **Entrar a la demo**, o entra directo en `http://localhost:5173/?demo=1`. No hace falta configurar nada: se crea un espacio de demostración con canales, tableros, páginas y archivos de ejemplo en tu navegador. Los datos no salen del dispositivo.

`npm run setup` crea `.env.local` a partir de `.env.example` y valida la configuración.

## Autoalojamiento

openQomu admite tres topologías, documentadas en [docs/self-hosting.es.md](docs/self-hosting.es.md):

| Topología | Backend | Recomendada para |
| --- | --- | --- |
| Local | Ninguno | Probar el producto, uso en un solo dispositivo |
| Firebase | Tu propio proyecto de Firebase | Equipos que quieren sincronización gestionada en tiempo real |
| Estático + Firebase | Firebase + cualquier hosting estático | Control total del alojamiento y del dominio |

El resultado del build es un paquete estático. Puedes servir `dist/` con nginx, Caddy, Docker, GitHub Pages, Cloudflare Pages, Netlify o cualquier almacenamiento de objetos con CDN.

### Firebase en cuatro pasos

1. Crea un proyecto de Firebase y una app web.
2. Activa el inicio de sesión con Google y añade tu dominio a los dominios autorizados.
3. Copia los seis valores `VITE_FIREBASE_*` en `.env.local`.
4. Despliega las reglas de seguridad:

```bash
npm run build
npx firebase deploy --only firestore:rules,firestore:indexes,hosting
```

`firestore.rules` es la frontera de seguridad. Revísala antes de exponer una instancia a internet.

### Docker

```bash
docker build -t openqomu .
docker run --rm -p 8080:80 openqomu
```

Consulta [docs/self-hosting.es.md](docs/self-hosting.es.md) para la variante con Firebase y para los Workers de archivos, push y MCP.

## Configuración

Todas las opciones están en [docs/configuration.es.md](docs/configuration.es.md). Las más relevantes:

| Variable | Función |
| --- | --- |
| `VITE_FIREBASE_*` | Credenciales del proyecto de Firebase. Sin ellas la app usa el modo local. |
| `VITE_PRODUCT_NAME` | Nombre visible del producto. Por defecto `openQomu`. |
| `VITE_FILE_STORAGE` | `firestore`, `storage` o `s3`. |
| `VITE_FILES_URL` | URL del Worker de archivos, solo con `s3`. |
| `VITE_PUSH_URL` | URL del Worker de push. Opcional. |
| `VITE_MCP_URL` | URL del servidor MCP. Opcional. |
| `VITE_PUBLIC_APP_URL` | URL pública para enlaces compartidos. Obligatoria en la app Android. |
| `VITE_LANDING_URL` | Landing pública externa. Por defecto, la oficial. |
| `VITE_APK_URL` | URL de descarga de la APK. Si está vacía, la sección Android se oculta. |

## Desarrollo

```bash
npm run dev          # servidor de desarrollo
npm run typecheck    # TypeScript
npm run lint         # oxlint
npm test             # pruebas unitarias
npm run test:coverage
npm run test:rules   # reglas de Firestore con los emuladores
npm run build        # paquete de producción
```

Las pruebas de reglas necesitan los emuladores de Firebase (`npm run emulators`). Nunca tocan un proyecto real.

Convenciones, estilo de commits y lista de revisión en [docs/development.es.md](docs/development.es.md).

## Estructura del repositorio

```
src/domain            entidades, servicios y puertos del dominio
src/app               composición de la aplicación y proveedores
src/infrastructure    adaptadores de Firebase, demo, Capacitor y push
src/presentation      páginas, funcionalidades y componentes de interfaz
files-worker/         Worker opcional para almacenamiento compatible con S3
push-worker/          Worker opcional para FCM y limpieza de datos
mcp-worker/           servidor MCP remoto opcional
android/              proyecto Android de Capacitor
skills/               skill MCP que se instala en los clientes de IA
docs/                 documentación bilingüe
tests/rules/          pruebas de reglas de Firestore
```

## Workers opcionales

Cada Worker es independiente y solo hace falta si usas su funcionalidad.

- **files-worker**: firma URLs y guarda binarios en un bucket compatible con S3 (B2, R2, MinIO, Wasabi).
- **push-worker**: envía notificaciones FCM, purga los mensajes eliminados y las tareas hechas con un cron de un minuto.
- **mcp-worker**: expone el endpoint MCP y la skill que consumen los clientes de IA.

Cada carpeta tiene su propio README con los pasos de despliegue y los secretos necesarios.

## Mensajes eliminados

Al eliminar un mensaje queda visible como marca durante una hora y después el documento se borra de forma permanente. La purga la ejecuta `push-worker`; sin él, la interfaz oculta los mensajes caducados pero el documento permanece en Firestore.

## Tareas completadas

Una tarea que entra en una columna final (`isDone: true`) se conserva 15 días y después se borra definitivamente junto con sus comentarios y adjuntos. El cron de `push-worker` ejecuta la purga y también limpia las referencias desde tareas dependientes. Sin él, las tareas completadas permanecen en Firestore.

Las métricas de finalización del dashboard describen el tablero actual y los últimos 15 días; no son un archivo histórico. El gráfico de 14 días no se ve afectado.

## Seguridad

- La autenticación y la autorización las aplican las reglas de Firestore, no el cliente.
- No publiques cuentas de servicio ni claves. `npm run check:private` falla ante valores privados conocidos y la integración continua ejecuta un escaneo de secretos.
- Para reportar vulnerabilidades, consulta [SECURITY.es.md](SECURITY.es.md).

## Contribuir

Lee [CONTRIBUTING.es.md](CONTRIBUTING.es.md). La documentación se mantiene en inglés y español; la interfaz está en español.

## Licencia

El código se distribuye bajo la GNU Affero General Public License v3.0 only. Consulta [LICENSE](LICENSE) y [docs/licensing.es.md](docs/licensing.es.md). El nombre y el logotipo no están cubiertos por la licencia; consulta [TRADEMARKS.es.md](TRADEMARKS.es.md).
