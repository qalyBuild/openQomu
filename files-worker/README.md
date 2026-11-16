# File Worker

Stores openQomu binaries in any S3-compatible service and serves downloads through temporary signed URLs.

The Firestore backend limits each file to 700 KB because it uses a 1 MiB document. This Worker removes that limit: metadata stays in Firestore under `workspaces/{workspaceId}/files/{fileId}` and the binary lives in the bucket under `workspaces/{workspaceId}/{fileId}`.

Supported storage: Backblaze B2, Cloudflare R2, MinIO, Wasabi, AWS S3 and any service that implements the S3 API.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/files/:workspaceId/:fileId` | Firebase ID token | Upload or replace |
| `GET`/`HEAD` | `/files/:workspaceId/:fileId` | `?exp=&sig=` or token | Download |
| `GET` | `/files/:workspaceId/:fileId/url` | Firebase ID token | Signed URL, 1 hour |
| `DELETE` | `/files/:workspaceId/:fileId` | Firebase ID token | Delete |
| `GET` | `/health` | — | Health check |

The Worker verifies the Firebase ID token against Google's public keys and checks that the uid is in the workspace `memberIds` using the service account.

## Configuration

1. Create a private bucket and an access key with read and write permission. Note the endpoint, region and bucket name.
2. Set `FIREBASE_PROJECT_ID`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET` and `FILES_ALLOWED_ORIGINS` in `wrangler.jsonc`.
3. Set the secrets:

```bash
cd files-worker
npm ci
npx wrangler secret put S3_ACCESS_KEY_ID
npx wrangler secret put S3_SECRET_ACCESS_KEY
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT   # service account JSON
npx wrangler secret put FILE_URL_SECRET            # long random string
```

4. Deploy:

```bash
npm run deploy
```

5. Build the app with:

```env
VITE_FILE_STORAGE=s3
VITE_FILES_URL=https://<your-worker-host>
```

Example endpoint values:

- Backblaze B2: `https://s3.<region>.backblazeb2.com`
- Cloudflare R2: `https://<account-id>.r2.cloudflarestorage.com`
- MinIO: `https://minio.example.com`

## Local development

Copy `.dev.vars.example` to `.dev.vars`, fill the values and run:

```bash
npm run dev   # http://localhost:8791
```

Add `http://localhost:5173` to `FILES_ALLOWED_ORIGINS` so the browser can upload from the Vite server.

## Notes

- The bucket can stay private: the Worker is the only component that talks to it.
- The service account only needs read access to Firestore to check `memberIds`.
- The per-file limit is 25 MB, enforced by the Worker and the app. To raise it, change `MAX_UPLOAD_BYTES` and the Firestore rules.
- `FILE_URL_SECRET` must be stable. If it changes, signed URLs in flight stop working and are regenerated when the file is opened again.
