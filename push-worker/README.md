# Push Worker

Sends openQomu notifications with **FCM HTTP v1** from Cloudflare Workers, without the Blaze plan or Cloud Functions.

- Endpoint: `POST /notify` plus `GET /health`.
- Cron: every minute it processes pending `pushOutbox` events, retries and purges expired deleted messages.
- Data: Firestore REST with a service account.

## Flow

1. The client writes an event to `pushOutbox` and calls `POST /notify` with its Firebase ID token.
2. The Worker verifies the token, checks that the event belongs to the user, resolves recipients and sends through FCM.
3. If the call fails or the app is closed, the cron picks the event up.

## Development

```bash
npm ci
cp .dev.vars.example .dev.vars
npm run dev
```

## Tests

```bash
npm run typecheck
npm test
```

## Deployment

Set `FIREBASE_PROJECT_ID`, `FCM_PROJECT_ID` and `PUSH_ALLOWED_ORIGINS` in `wrangler.jsonc`, then:

```bash
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
npm run deploy
```

The service account needs:

- `roles/datastore.user` to read and write Firestore.
- `roles/firebasecloudmessaging.admin` to send FCM.

If the cron fails with `Firestore update falló (403)`, the secret does not belong to an account with those roles. Upload it again:

```bash
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT < path/to/service-account.json
```

The Workers free plan allows 50 subrequests per invocation, so the cron processes 3 events per minute (`MAX_BATCH`). At higher volume, upgrade the plan or batch reads.

## Deleted message purge

The same cron deletes message documents whose `deletedAt` is older than one hour. Without this Worker the interface hides expired tombstones but the document remains in Firestore.
