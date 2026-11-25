# openQomu

[Español](README.es.md) · English

openQomu is a self-hostable collaboration workspace: real-time chat, Kanban boards, documents, a file library, invitations and a metrics dashboard. It is a single-page React application with an optional Firebase backend, so you can run it locally with no configuration or deploy it on your own infrastructure.

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, Radix UI.
- **Architecture:** hexagonal (pure domain, ports, adapters) with an in-memory demo adapter.
- **Backend (optional):** Firebase Auth, Firestore and Storage.
- **Optional services:** file Worker over any S3-compatible storage, push Worker for FCM, remote MCP server for AI agents.
- **License:** AGPL-3.0-only. See [docs/licensing.md](docs/licensing.md).

openQomu is an independent open source project. It is not affiliated with, endorsed by, or supported by any commercial product with a similar name. See [TRADEMARKS.md](TRADEMARKS.md).

The public website is maintained in [openQomu-web](https://github.com/qalyBuild/openQomu-web).

## Features

- **Channels and threads** with mentions, reactions, replies, editing, typing indicators and delivery receipts.
- **Kanban boards** with drag and drop, priorities, labels, dependencies, assignments and a review workflow.
- **Documents** with a rich text editor and autosave.
- **File library** with folders, search, favorites, trash and configurable storage backends.
- **Workspaces and invitations** with expiring links and role-based permissions.
- **Dashboard** with activity and workload metrics.
- **Local mode** that works without any server: data lives in `localStorage` and `IndexedDB`.
- **Android app** built with Capacitor, distributed by your own release pipeline.
- **MCP server** so AI agents can read and update tasks.

## Quick start (local mode)

Requirements: Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Open `http://localhost:5173` and choose **Entrar a la demo**, or go straight to `http://localhost:5173/?demo=1`. No configuration is needed: a demo workspace with sample channels, boards, pages and files is created in your browser. Data never leaves the device.

`npm run setup` creates `.env.local` from `.env.example` and validates the configuration.

## Self-hosting

openQomu has three supported topologies. All of them are documented in [docs/self-hosting.md](docs/self-hosting.md):

| Topology | Backend | Recommended for |
| --- | --- | --- |
| Local | None | Trying the product, single-device use |
| Firebase | Your own Firebase project | Teams that want managed real-time sync |
| Static + Firebase | Firebase + any static host | Full control over hosting and domain |

The build is a static bundle. You can serve `dist/` from nginx, Caddy, Docker, GitHub Pages, Cloudflare Pages, Netlify or any object storage with a CDN.

### Firebase in four steps

1. Create a Firebase project and a web app.
2. Enable Google sign-in and add your domain to the authorized domains.
3. Copy the six `VITE_FIREBASE_*` values into `.env.local`.
4. Deploy the security rules:

```bash
npm run build
npx firebase deploy --only firestore:rules,firestore:indexes,hosting
```

`firestore.rules` is the security boundary. Review it before exposing an instance to the internet.

### Docker

```bash
docker build -t openqomu .
docker run --rm -p 8080:80 openqomu
```

See [docs/self-hosting.md](docs/self-hosting.md) for the Firebase variant and for file, push and MCP Workers.

## Configuration

Every option is documented in [docs/configuration.md](docs/configuration.md). The most relevant ones:

| Variable | Purpose |
| --- | --- |
| `VITE_FIREBASE_*` | Firebase project credentials. Without them the app runs in local mode. |
| `VITE_PRODUCT_NAME` | Visible product name. Defaults to `openQomu`. |
| `VITE_FILE_STORAGE` | `firestore`, `storage` or `s3`. |
| `VITE_FILES_URL` | File Worker URL, only for `s3`. |
| `VITE_PUSH_URL` | Push Worker URL. Optional. |
| `VITE_MCP_URL` | MCP server URL. Optional. |
| `VITE_PUBLIC_APP_URL` | Public URL used in shared links. Required for the Android app. |
| `VITE_LANDING_URL` | External public landing. Defaults to the official one. |
| `VITE_APK_URL` | APK download URL. When empty the Android section is hidden. |

## Development

```bash
npm run dev          # development server
npm run typecheck    # TypeScript
npm run lint         # oxlint
npm test             # unit tests
npm run test:coverage
npm run test:rules   # Firestore rules against the emulator suite
npm run build        # production bundle
```

Rules tests need the Firebase emulators (`npm run emulators`). They never touch a real project.

See [docs/development.md](docs/development.md) for conventions, commit style and the review checklist.

## Repository layout

```
src/domain            domain entities, services and ports
src/app               application composition and providers
src/infrastructure    Firebase, demo, Capacitor and push adapters
src/presentation      pages, features and UI components
files-worker/         optional Worker for S3-compatible storage
push-worker/          optional Worker for FCM delivery and cleanup
mcp-worker/           optional remote MCP server
android/              Capacitor Android project
skills/               MCP skill shipped to AI harnesses
docs/                 bilingual documentation
tests/rules/          Firestore rules tests
```

## Optional Workers

Each Worker is independent and only needed if you use its feature.

- **files-worker**: signs URLs and stores binaries in an S3-compatible bucket (B2, R2, MinIO, Wasabi).
- **push-worker**: sends FCM notifications, purges deleted messages and completed tasks on a one-minute cron.
- **mcp-worker**: exposes the MCP endpoint and the skill used by AI clients.

Each directory has its own README with deployment steps and required secrets.

## Deleted messages

Deleting a message keeps a visible tombstone for one hour, then the document is removed permanently. The purge runs in `push-worker`; without it, the interface hides expired messages but the document remains in Firestore.

## Completed tasks

A task that enters a final column (`isDone: true`) is kept for 15 days and then deleted permanently, together with its comments and attachments. The `push-worker` cron performs the purge and also removes references from dependent tasks. Without it, completed tasks remain in Firestore.

Dashboard completion metrics describe the current board and the last 15 days; they are not an all-time archive. The 14-day trend is unaffected.

## Security

- Authentication and authorization are enforced by Firestore rules, not by the client.
- Never commit service accounts or API keys. `npm run check:private` fails on known private values and CI runs a secret scan.
- Report vulnerabilities privately: see [SECURITY.md](SECURITY.md).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Documentation is maintained in English and Spanish; the interface is in Spanish.

## License

Code is licensed under the GNU Affero General Public License v3.0 only. See [LICENSE](LICENSE) and [docs/licensing.md](docs/licensing.md). The name and logo are not covered by the license; see [TRADEMARKS.md](TRADEMARKS.md).
