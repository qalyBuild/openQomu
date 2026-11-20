# Autoalojamiento

Español · [English](self-hosting.md)

openQomu nunca llama a un servidor de los mantenedores del proyecto. Cada despliegue usa credenciales e infraestructura del operador.

## 1. Modo local

Sin backend ni configuración.

```bash
npm ci
npm run dev
```

La app detecta que faltan las variables `VITE_FIREBASE_*` y usa el adaptador de demostración: `localStorage` para metadatos e `IndexedDB` para archivos. Este modo es de un solo dispositivo y no tiene autenticación.

Para compilar y servir como estático:

```bash
npm ci
npm run build
# sirve dist/ con cualquier servidor HTTP
npx serve dist
```

## 2. Proyecto de Firebase

### Crear el proyecto

1. Crea un proyecto en la consola de Firebase.
2. Añade una app **Web** y copia su configuración.
3. Activa **Authentication → Google**.
4. Añade tu dominio futuro y `localhost` en **Authentication → Settings → Authorized domains**.
5. Crea una base de datos de Firestore en modo producción.

### Configurar el build

```bash
cp .env.example .env.local
```

Rellena los seis valores:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### Desplegar reglas e índices

```bash
npx firebase login
npx firebase use --add          # elige tu proyecto; escribe .firebaserc
npx firebase deploy --only firestore:rules,firestore:indexes
```

`firestore.rules` es la capa de autorización. Léela antes de abrir la instancia a otras personas.

### Emuladores

```bash
npm run emulators        # terminal 1
VITE_USE_FIREBASE_EMULATORS=true npm run dev   # terminal 2
```

Las pruebas de reglas usan los emuladores y nunca tocan un proyecto real:

```bash
npm run test:rules
```

## 3. Hosting estático

El resultado del build es un paquete estático con rutas en el cliente. Sirve cualquier host que devuelva `index.html` en rutas desconocidas.

- **Firebase Hosting:** `npx firebase deploy --only hosting`.
- **nginx/Caddy:** consulta `deploy/nginx.conf` y `deploy/Caddyfile`.
- **Docker:** ver más abajo.
- **GitHub Pages, Cloudflare Pages, Netlify, Vercel:** ejecuta `npm run build`, publica `dist/` y configura el fallback de SPA.
- **GitHub Actions:** `.github/workflows/pages.yml` compila y publica con las variables de tu repositorio.

Las variables de entorno se incorporan al paquete en tiempo de compilación. Vuelve a compilar cuando cambien; nunca publiques secretos, solo la configuración web de Firebase.

## 4. Docker

```bash
docker build \
  --build-arg VITE_FIREBASE_API_KEY=... \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN=... \
  --build-arg VITE_FIREBASE_PROJECT_ID=... \
  --build-arg VITE_FIREBASE_STORAGE_BUCKET=... \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID=... \
  --build-arg VITE_FIREBASE_APP_ID=... \
  -t openqomu .
docker run --rm -p 8080:80 openqomu
```

Sin argumentos de compilación la imagen sirve el modo local. `docker-compose.yml` muestra la misma configuración con un archivo `.env`.

## 5. Worker de archivos (opcional)

Solo hace falta con `VITE_FILE_STORAGE=s3`. Guarda binarios en cualquier servicio compatible con S3 y devuelve URLs firmadas.

```bash
cd files-worker
npm ci
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT   # JSON del service account con acceso a Firestore
npx wrangler secret put S3_ACCESS_KEY_ID
npx wrangler secret put S3_SECRET_ACCESS_KEY
npx wrangler secret put FILE_URL_SECRET            # cadena aleatoria larga
```

Configura en `files-worker/wrangler.jsonc`: `FIREBASE_PROJECT_ID`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET` y `FILES_ALLOWED_ORIGINS` (tu dominio y localhost para desarrollo).

```bash
npm run deploy
```

Después, en el build de la app: `VITE_FILE_STORAGE=s3` y `VITE_FILES_URL=https://<host-del-worker>`.

Alternativas sin Worker: `VITE_FILE_STORAGE=firestore` (archivos pequeños, ≤700 KB) o `VITE_FILE_STORAGE=storage` con Firebase Storage (plan Blaze).

## 6. Worker de push (opcional)

Envía notificaciones FCM, purga los mensajes eliminados caducados y borra las tareas completadas a los 15 días. Sin él la app funciona, pero no hay notificaciones, las lápidas permanecen en Firestore y las tareas hechas nunca se purgan.

1. Crea una cuenta de servicio con `roles/datastore.user`, `roles/firebasecloudmessaging.admin` y `roles/storage.objectAdmin` (solo si usas Firebase Storage para adjuntos).
2. Configura los secretos:

```bash
cd push-worker
npm ci
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
npx wrangler secret put FIREBASE_PROJECT_ID
npx wrangler secret put FCM_PROJECT_ID
npm run deploy
```

3. Ajusta `PUSH_ALLOWED_ORIGINS` en `wrangler.jsonc` y vuelve a desplegar. Si usas Firebase Storage, define `FIREBASE_STORAGE_BUCKET`; si no, se deduce de la URL de cada archivo.
4. En el build de la app: `VITE_PUSH_URL=https://<host-del-worker>/notify`.

El Worker expone `/health` y `/notify` y ejecuta un cron de un minuto que procesa la cola. Cada 15 minutos borra los mensajes cuyo `deletedAt` supera una hora y purga las tareas completadas hace más de 15 días. La purga incluye comentarios, adjuntos y referencias de dependencias, también en tableros pausados o deprecados.

## 7. Worker MCP (opcional)

Expone un servidor MCP remoto para que los clientes de IA lean y actualicen tareas.

```bash
cd mcp-worker
npm ci
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
npx wrangler secret put FIREBASE_PROJECT_ID
npm run deploy
```

Configura `MCP_SERVER_URL` con la URL desplegada y `/mcp`, y `MCP_ALLOWED_HOSTS` con tu host. En la app: `VITE_MCP_URL=https://<host-del-worker>/mcp`. La skill se sirve en `/skill/SKILL.md`.

## 8. App Android (opcional)

1. Crea una app Android en Firebase con tu propio identificador y descarga `google-services.json` en `android/app/`.
2. Compila con tus identificadores:

```bash
CAPACITOR_APP_ID=app.example.openqomu \
VITE_PUBLIC_APP_URL=https://app.example.com \
npm run build
npx cap sync android
cd android
./gradlew assembleRelease -PopenqomuApplicationId=app.example.openqomu -PopenqomuAppLinkHost=app.example.com
```

3. Firma: copia `android/keystore.properties.example` a `android/keystore.properties` y rellénalo, o pasa los valores como secretos de CI: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` y `ANDROID_KEY_PASSWORD`.
   La verificación de App Links necesita `public/.well-known/assetlinks.json` con tu nombre de paquete y las huellas de tu certificado de firma. Parte de `public/.well-known/assetlinks.json.example`; el archivo real está ignorado por git porque identifica tu certificado de publicación.
4. Publica la APK y define `VITE_APK_URL` para que la app ofrezca actualizaciones. Sin esa variable la sección Android se oculta.

Cambiar el identificador implica una instalación nueva; no puede actualizar una app publicada con otro identificador.

## 9. Lista de comprobación antes de publicar

- [ ] `npm run build` funciona con las variables de producción.
- [ ] Reglas de Firestore desplegadas y revisadas.
- [ ] Los dominios autorizados incluyen tu dominio real.
- [ ] `npm run check:private` pasa.
- [ ] Copias de seguridad de Firestore configuradas.
- [ ] Workers opcionales desplegados y sus URLs en el build.
