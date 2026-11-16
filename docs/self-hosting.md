# Self-hosting

[Español](self-hosting.es.md)

openQomu never calls a server owned by the project maintainers. Every deployment uses credentials and infrastructure provided by the operator.

## 1. Local mode

No backend, no configuration.

```bash
npm ci
npm run dev
```

The app detects that `VITE_FIREBASE_*` is missing and uses the demo adapter: `localStorage` for metadata and `IndexedDB` for files. This mode is single-device and has no authentication.

To build for a static file server:

```bash
npm ci
npm run build
# serve dist/ with any HTTP server
npx serve dist
```

## 2. Firebase project

### Create the project

1. Create a project in the Firebase console.
2. Add a **Web** app and copy its configuration.
3. Enable **Authentication → Google**.
4. Add your future domain and `localhost` under **Authentication → Settings → Authorized domains**.
5. Create a Firestore database in production mode.

### Configure the build

```bash
cp .env.example .env.local
```

Fill the six values:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### Deploy rules and indexes

```bash
npx firebase login
npx firebase use --add          # choose your project; this writes .firebaserc
npx firebase deploy --only firestore:rules,firestore:indexes
```

`firestore.rules` is the authorization layer. Read it before opening the instance to other people.

### Emulators

```bash
npm run emulators        # terminal 1
VITE_USE_FIREBASE_EMULATORS=true npm run dev   # terminal 2
```

Rules tests run against the emulator suite and never touch a real project:

```bash
npm run test:rules
```

## 3. Static hosting

The build output is a static bundle with client-side routing. Any host that serves `index.html` for unknown paths works.

- **Firebase Hosting:** `npx firebase deploy --only hosting`.
- **nginx/Caddy:** see `deploy/nginx.conf` and `deploy/Caddyfile`.
- **Docker:** see below.
- **GitHub Pages, Cloudflare Pages, Netlify, Vercel:** build with `npm run build`, publish `dist/`, configure a SPA fallback.
- **GitHub Actions:** `.github/workflows/pages.yml` builds and publishes with your repository variables.

Environment variables are baked into the bundle at build time. Rebuild when they change; never expose secrets, only Firebase web configuration.

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

Without build args the image serves the local mode. `docker-compose.yml` shows the same configuration with an `.env` file.

## 5. File Worker (optional)

Needed only with `VITE_FILE_STORAGE=s3`. It stores binaries in any S3-compatible service and returns signed URLs.

```bash
cd files-worker
npm ci
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT   # service account JSON, datastore access
npx wrangler secret put S3_ACCESS_KEY_ID
npx wrangler secret put S3_SECRET_ACCESS_KEY
npx wrangler secret put FILE_URL_SECRET            # long random string
```

Set in `files-worker/wrangler.jsonc`: `FIREBASE_PROJECT_ID`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET` and `FILES_ALLOWED_ORIGINS` (your domain plus localhost for development).

```bash
npm run deploy
```

Then in the app build: `VITE_FILE_STORAGE=s3` and `VITE_FILES_URL=https://<worker-host>`.

Alternatives without a Worker: `VITE_FILE_STORAGE=firestore` (small files, ≤700 KB) or `VITE_FILE_STORAGE=storage` with Firebase Storage (Blaze plan).

## 6. Push Worker (optional)

Sends FCM notifications and purges expired deleted messages. Without it the app works, but there are no push notifications and tombstones stay in Firestore.

1. Create a service account with `roles/datastore.user` and `roles/firebasecloudmessaging.admin`.
2. Set secrets:

```bash
cd push-worker
npm ci
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
npx wrangler secret put FIREBASE_PROJECT_ID
npx wrangler secret put FCM_PROJECT_ID
npm run deploy
```

3. Set `PUSH_ALLOWED_ORIGINS` in `wrangler.jsonc` and deploy.
4. In the app build: `VITE_PUSH_URL=https://<worker-host>/notify`.

The Worker exposes `/health` and `/notify` and runs a one-minute cron that processes the outbox and deletes messages whose `deletedAt` is older than one hour.

## 7. MCP Worker (optional)

Exposes a remote MCP server so AI clients can read and update tasks.

```bash
cd mcp-worker
npm ci
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
npx wrangler secret put FIREBASE_PROJECT_ID
npm run deploy
```

Set `MCP_SERVER_URL` to the deployed URL with `/mcp` and `MCP_ALLOWED_HOSTS` to your host. In the app: `VITE_MCP_URL=https://<worker-host>/mcp`. The skill is served at `/skill/SKILL.md`.

## 8. Android app (optional)

1. Create an Android app in Firebase with your own package name and download `google-services.json` into `android/app/`.
2. Build with your identifiers:

```bash
CAPACITOR_APP_ID=app.example.openqomu \
VITE_PUBLIC_APP_URL=https://app.example.com \
npm run build
npx cap sync android
cd android
./gradlew assembleRelease -PopenqomuApplicationId=app.example.openqomu -PopenqomuAppLinkHost=app.example.com
```

3. Signing: copy `android/keystore.properties.example` to `android/keystore.properties` and fill it, or provide the values as `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` secrets in CI.
   App Links verification needs `public/.well-known/assetlinks.json` with your own package name and signing certificate fingerprints. Start from `public/.well-known/assetlinks.json.example`; the real file is git-ignored because it identifies your release certificate.
4. Publish the APK and set `VITE_APK_URL` so the app can offer updates. Without that variable the Android section is hidden.

Changing the application ID means a new installation; it cannot upgrade an app published under another ID.

## 9. Checklist before going live

- [ ] `npm run build` succeeds with production variables.
- [ ] Firestore rules deployed and reviewed.
- [ ] Authorized domains include your real domain.
- [ ] `npm run check:private` passes.
- [ ] Backups of Firestore configured.
- [ ] Optional Workers deployed and their URLs in the build.
