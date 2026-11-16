# MCP Worker

Remote MCP server for openQomu, deployed on Cloudflare Workers.

- Endpoint: `POST /mcp`.
- Public skill: `GET /skill/SKILL.md` (no authentication).
- Transport: Streamable HTTP.
- Authentication: `Authorization: Bearer openqomu_mcp_...`.
- Data: Firestore REST with a service account.

The token is created in the app under **Settings → AI**. Only its hash is stored; the secret is shown once.

## Development

```bash
npm ci
cp .dev.vars.example .dev.vars
npm run dev
```

Local endpoint: `http://127.0.0.1:8788/mcp`.

## Tests and deployment

```bash
npm run typecheck
npm test
npm run deploy
```

Set `FIREBASE_PROJECT_ID`, `MCP_SERVER_URL` (your deployed URL with `/mcp`) and `MCP_ALLOWED_HOSTS` in `wrangler.jsonc`.

## Secrets

```bash
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
npx wrangler secret put FIREBASE_PROJECT_ID
```

The service account needs `roles/datastore.user`. Configure the app with `VITE_MCP_URL=https://<your-worker-host>/mcp`; when that variable is empty the AI section is hidden.

## Scopes

- `openqomu:read`: list workspaces, boards, tasks, members and comments.
- `openqomu:write`: create, update, move and delete tasks, assign reviewers and add comments.

The canonical skill lives in `../skills/openqomu/SKILL.md`. After editing it run `npm run skill:sync` at the repository root; `npm run skill:check` fails when the copy in `src/skill-content.ts` is stale.
