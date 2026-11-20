# Changelog

All notable changes are documented here. Format based on Keep a Changelog and
versioning follows Semantic Versioning.

## [0.1.0] - Unreleased

### Added

- Self-hostable distribution of the workspace: chat, Kanban, documents, files,
  invitations and dashboard.
- Local mode with `localStorage` and `IndexedDB`, no backend required.
- Bring-your-own Firebase configuration with Firestore rules and indexes.
- Optional file Worker over any S3-compatible storage.
- Optional push Worker with FCM delivery, one-hour purge of deleted messages and
  15-day purge of completed tasks.
- Optional MCP Worker with a skill for AI clients.
- Docker image, nginx and Caddy examples, static hosting guide.
- Bilingual documentation (English and Spanish).
- CI without secrets: lint, types, unit tests, rules tests, builds, secret scan
  and license check.
- Android build workflow with release artifacts.

### Changed

- Product rebranded as openQomu with AGPL-3.0-only license.
- Configuration externalized: no deployment-specific URLs, project IDs or
  buckets in the repository.
- Deleted messages are visible for one hour, then removed permanently.
- Tasks in a final column are deleted after 15 days, including comments and
  attachments; dashboard completion metrics cover the last 15 days.

### Removed

- Internal deployment files, private Worker configuration and APK distribution
  scripts tied to a specific account.
