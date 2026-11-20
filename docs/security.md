# Security

[Español](security.es.md)

## Trust model

The client is untrusted. Anyone can build a modified frontend against your Firebase project, so every rule is enforced server-side by `firestore.rules` and `storage.rules`.

- A user must be a member of a workspace to read or write its data.
- Roles are `owner`, `admin` and `member`; destructive operations require ownership or administration.
- Messages may only be edited or deleted by their author or an administrator.
- Field immutability is enforced: `authorId`, `createdAt`, `workspaceId` and channel identifiers cannot change.
- File size and body length limits are enforced in rules, not only in the UI.
- MCP tokens store a hash and scopes, never the secret.

## Known limits

- Local mode has no authentication and no multi-device sync: it is a single-browser workspace.
- Firestore rules protect data, not availability. Use quotas and App Check if you expose an instance publicly.
- Deleted messages remain readable by workspace members for one hour until `push-worker` purges them. Without the Worker they remain until you delete them manually.
- Completed tasks remain in Firestore for 15 days until `push-worker` deletes them with their comments and attachments. Without the Worker they remain indefinitely.
- An administrator can read the content of a workspace. Document this in your organization's policies.

## Secrets

The repository must never contain:

- Service account JSON files.
- S3, Cloudflare or Firebase admin keys.
- Personal UIDs, emails or domains of a private deployment.

`npm run check:private` scans the tree for known values and CI runs a secret scanner on every push. Secrets belong to the deployment environment: `.env.local`, `wrangler secret put` or CI secrets.

## Reporting a vulnerability

Do not open a public issue. Follow [SECURITY.md](../SECURITY.md) at the repository root.

## Operation checklist

- [ ] Review `firestore.rules` after every data model change.
- [ ] Run `npm run test:rules` locally and in CI.
- [ ] Enable backups for Firestore.
- [ ] Rotate credentials if the repository ever leaked one.
- [ ] Keep dependencies current; Dependabot opens weekly pull requests.
