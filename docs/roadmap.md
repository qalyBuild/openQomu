# Roadmap

[Español](roadmap.es.md)

This roadmap is indicative. Priorities follow user reports and security work.

## v0.1 — Public release

- Repository sanitization, AGPL-3.0 license and bilingual documentation.
- Local mode and bring-your-own Firebase documented end to end.
- Optional Workers generalized: S3 storage, push and MCP without project-specific values.
- Docker, nginx and Caddy examples; static build for any host.
- CI without secrets: lint, types, tests, rules, web build, Android build.
- Release `v0.1.0` with static bundle and APK.

## v0.2 — Backend independence

- Document `src/domain/ports` as a public contract.
- Supabase adapter: Postgres schema, migrations, row level security equivalent to `firestore.rules`, Realtime for messages and presence, Storage for files.
- `VITE_BACKEND=firebase|supabase|demo` selection.
- Compatibility matrix for every feature.

## v0.3 — Internationalization

- Extract interface strings, add `es` and `en` catalogs.
- Locale-aware dates and number formatting.
- Language selector stored per user.

## Backlog

- Single sign-on (OIDC).
- Import and export of workspaces.
- Message search backed by an index instead of client-side filtering.
- Audit log for administrative actions.
- End-to-end encrypted private channels (research).
