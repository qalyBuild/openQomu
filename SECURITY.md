# Security Policy

[Español](SECURITY.es.md)

## Supported versions

The latest minor release receives security fixes. Older releases may require an upgrade.

## Reporting a vulnerability

Do not open a public issue. Send a private report to `carlos09102007@gmail.com` including:

- Affected version or commit.
- Steps to reproduce, with a minimal example.
- Impact: what an attacker can read or modify.
- Whether the issue affects the default configuration or only a specific deployment.

You will receive an acknowledgement within 5 working days and a status update within 15 working days. Please allow time for a fix and a coordinated disclosure before publishing details.

## Scope

In scope:

- Authorization flaws in `firestore.rules` and `storage.rules`.
- Cross-workspace data leaks through the client or the Workers.
- Token or secret exposure in the repository or build output.
- Injection, cross-site scripting and unsafe rendering in the application.
- Weaknesses in the MCP authentication and scope model.

Out of scope:

- Findings from automated scanners without a demonstrated impact.
- Denial of service through quota exhaustion on a self-hosted deployment.
- Misconfiguration of a third-party deployment (for example, leaving the demo mode exposed on purpose).

## Hardening guidance for operators

- Keep Firestore rules in sync with the deployed application.
- Restrict authorized domains in Firebase Auth.
- Deploy the Workers only with least-privilege service accounts.
- Rotate credentials after any suspected leak.
- Enable backups and monitor billing alerts.

See [docs/security.md](docs/security.md) for the trust model.
