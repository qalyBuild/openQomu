# Configuración

Español · [English](configuration.md)

Copia `.env.example` a `.env.local`. Vite solo lee `.env.local`, que está ignorado por git.

## Variables de compilación

Vite incorpora los valores `VITE_*` al paquete. Son públicos: nunca pongas secretos aquí.

| Variable | Por defecto | Efecto |
| --- | --- | --- |
| `VITE_PRODUCT_NAME` | `openQomu` | Nombre visible del producto. |
| `VITE_FIREBASE_API_KEY` | vacío | Clave web de Firebase. |
| `VITE_FIREBASE_AUTH_DOMAIN` | vacío | Dominio de Firebase Auth. |
| `VITE_FIREBASE_PROJECT_ID` | vacío | Proyecto de Firestore. |
| `VITE_FIREBASE_STORAGE_BUCKET` | vacío | Bucket de Firebase Storage. |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | vacío | Emisor de FCM. |
| `VITE_FIREBASE_APP_ID` | vacío | Identificador de la app de Firebase. |
| `VITE_DEMO_MODE` | `false` | Fuerza el modo local aunque haya Firebase. |
| `VITE_USE_FIREBASE_EMULATORS` | `false` | Conecta Auth, Firestore y Storage a los emuladores locales. |
| `VITE_FILE_STORAGE` | `firestore` | Backend de archivos: `firestore`, `storage` o `s3`. |
| `VITE_FILES_URL` | vacío | URL del Worker de archivos. Obligatoria con `s3`. |
| `VITE_PUSH_URL` | vacío | URL del Worker de push (`/notify`). Opcional. |
| `VITE_MCP_URL` | vacío | URL del servidor MCP. Opcional; oculta la configuración de IA cuando está vacía. |
| `VITE_PUBLIC_APP_URL` | origen actual | URL pública para enlaces compartidos. Obligatoria en la app Android. |
| `VITE_APP_LINK_HOSTS` | vacío | Hosts extra de App Links de Android, separados por comas. |
| `VITE_LANDING_URL` | `https://openqomu.web.app` | Landing pública externa. |
| `VITE_APK_URL` | vacío | URL de descarga de la APK. Si está vacía, la sección Android se oculta. |
| `VITE_GOOGLE_WEB_CLIENT_ID` | vacío | Client ID web de Google para el login nativo. |

Las seis variables `VITE_FIREBASE_*` son obligatorias en conjunto. Con una configuración parcial la app usa el modo local y `npm run setup` indica cuáles faltan.

## Backends de archivos

| `VITE_FILE_STORAGE` | Binario en | Límite | Requisitos |
| --- | --- | --- | --- |
| `firestore` | Documento de Firestore | 700 KB por archivo | Ninguno (plan Spark) |
| `storage` | Firebase Storage | 25 MB por archivo | Plan Blaze, `storage.rules` |
| `s3` | Bucket compatible con S3 vía Worker | 25 MB por archivo | `files-worker` desplegado |

## App nativa

Capacitor lee estas variables del entorno, no de `.env.local`:

| Variable | Por defecto | Efecto |
| --- | --- | --- |
| `CAPACITOR_APP_ID` | `app.openqomu` | Identificador de la app Android. |
| `CAPACITOR_APP_NAME` | `openQomu` | Nombre en el lanzador. |

Propiedades de Gradle para `./gradlew`:

| Propiedad | Por defecto | Efecto |
| --- | --- | --- |
| `openqomuApplicationId` | `app.openqomu` | Identificador escrito en la APK. |
| `openqomuAppLinkHost` | `openqomu.example.com` | Host aceptado como App Link de Android. |

## Variables de los Workers

Cada Worker tiene su README y su `.dev.vars.example`. Los secretos se configuran con `wrangler secret put`; los valores públicos viven en `wrangler.jsonc`.

| Worker | Valores públicos | Secretos |
| --- | --- | --- |
| `files-worker` | `FIREBASE_PROJECT_ID`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `FILES_ALLOWED_ORIGINS` | `FIREBASE_SERVICE_ACCOUNT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `FILE_URL_SECRET` |
| `push-worker` | `FIREBASE_PROJECT_ID`, `FCM_PROJECT_ID`, `PUSH_ALLOWED_ORIGINS` | `FIREBASE_SERVICE_ACCOUNT` |
| `mcp-worker` | `FIREBASE_PROJECT_ID`, `MCP_SERVER_URL`, `MCP_ALLOWED_HOSTS` | `FIREBASE_SERVICE_ACCOUNT` |

## Validación

```bash
npm run setup        # crea .env.local si falta y lo valida
npm run check:private # falla si aparecen valores del despliegue privado
```
