# Configuration

[Español](configuration.es.md)

Copy `.env.example` to `.env.local`. Only `.env.local` is read by Vite; it is ignored by git.

## Build-time variables

Vite inlines `VITE_*` values into the bundle. They are public: never put a secret here.

| Variable | Default | Effect |
| --- | --- | --- |
| `VITE_PRODUCT_NAME` | `openQomu` | Visible product name. |
| `VITE_FIREBASE_API_KEY` | empty | Firebase web API key. |
| `VITE_FIREBASE_AUTH_DOMAIN` | empty | Firebase Auth domain. |
| `VITE_FIREBASE_PROJECT_ID` | empty | Firestore project. |
| `VITE_FIREBASE_STORAGE_BUCKET` | empty | Firebase Storage bucket. |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | empty | FCM sender. |
| `VITE_FIREBASE_APP_ID` | empty | Firebase app identifier. |
| `VITE_DEMO_MODE` | `false` | Forces local mode even with Firebase configured. |
| `VITE_DEMO_AUTO` | `false` | In demo mode, enters the workspace directly on `/`. |
| `VITE_USE_FIREBASE_EMULATORS` | `false` | Connects Auth, Firestore and Storage to local emulators. |
| `VITE_FILE_STORAGE` | `firestore` | File backend: `firestore`, `storage` or `s3`. |
| `VITE_FILES_URL` | empty | File Worker URL. Required for `s3`. |
| `VITE_PUSH_URL` | empty | Push Worker URL (`/notify`). Optional. |
| `VITE_MCP_URL` | empty | MCP server URL. Optional; hides the AI setup when empty. |
| `VITE_PUBLIC_APP_URL` | current origin | Public URL used in shared links. Required for the Android app. |
| `VITE_APP_LINK_HOSTS` | empty | Extra Android App Link hosts, comma separated. |
| `VITE_LANDING_URL` | `https://openqomu.web.app` | External public landing. |
| `VITE_APK_URL` | empty | APK download URL. When empty the Android section is hidden. |
| `VITE_GOOGLE_WEB_CLIENT_ID` | empty | Google web client ID for native sign-in. |

All six `VITE_FIREBASE_*` values are required together. With a partial configuration the app falls back to local mode, and `npm run setup` reports the missing ones.

## File backends

| `VITE_FILE_STORAGE` | Binary stored in | Limit | Requirements |
| --- | --- | --- | --- |
| `firestore` | Firestore document | 700 KB per file | None (Spark plan) |
| `storage` | Firebase Storage | 25 MB per file | Blaze plan, `storage.rules` |
| `s3` | S3-compatible bucket via Worker | 25 MB per file | `files-worker` deployed |

## Native app

Capacitor reads these variables from the environment, not from `.env.local`:

| Variable | Default | Effect |
| --- | --- | --- |
| `CAPACITOR_APP_ID` | `app.openqomu` | Android application ID. |
| `CAPACITOR_APP_NAME` | `openQomu` | Launcher name. |

Gradle properties for `./gradlew`:

| Property | Default | Effect |
| --- | --- | --- |
| `openqomuApplicationId` | `app.openqomu` | Application ID written into the APK. |
| `openqomuAppLinkHost` | `openqomu.example.com` | Host accepted as Android App Link. |

## Worker variables

Each Worker has its own README and `.dev.vars.example`. Secrets are set with `wrangler secret put`; plain values live in `wrangler.jsonc`.

| Worker | Plain values | Secrets |
| --- | --- | --- |
| `files-worker` | `FIREBASE_PROJECT_ID`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `FILES_ALLOWED_ORIGINS` | `FIREBASE_SERVICE_ACCOUNT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `FILE_URL_SECRET` |
| `push-worker` | `FIREBASE_PROJECT_ID`, `FCM_PROJECT_ID`, `PUSH_ALLOWED_ORIGINS` | `FIREBASE_SERVICE_ACCOUNT` |
| `mcp-worker` | `FIREBASE_PROJECT_ID`, `MCP_SERVER_URL`, `MCP_ALLOWED_HOSTS` | `FIREBASE_SERVICE_ACCOUNT` |

## Validation

```bash
npm run setup        # creates .env.local if missing and validates it
npm run check:private # fails if private deployment values appear in the tree
```
