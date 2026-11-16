# Licensing

[Español](licensing.es.md)

## Code

openQomu is distributed under the **GNU Affero General Public License v3.0 only** (`AGPL-3.0-only`). The full text is in [LICENSE](../LICENSE).

The AGPL adds one obligation on top of the GPL: if you run a modified version as a network service, users of that service must be able to obtain the corresponding source code. If you deploy openQomu for your team, that generally means publishing your fork or offering the source to your users.

## Name and logo

The license covers code, not trademarks. The name `openQomu`, its logo and the visual identity are governed by [TRADEMARKS.md](../TRADEMARKS.md). Forks must use a different name and logo.

## Dependencies

All runtime dependencies use permissive licenses compatible with AGPL-3.0: MIT, ISC and Apache-2.0. The list is available with:

```bash
npx license-checker --summary
```

If a dependency ever becomes incompatible, replace it before merging: CI runs a license check.

## Contributions

By submitting a pull request you agree to license your contribution under AGPL-3.0-only and confirm you have the right to do so. Every commit carries a `Signed-off-by` line (Developer Certificate of Origin). See [CONTRIBUTING.md](../CONTRIBUTING.md).

## What you can do

- Self-host openQomu for your organization, including commercially.
- Modify it and keep the changes private **as long as the modified version is not offered to third parties over a network**.
- Distribute binaries or images if you include the source and keep the license.

## What you cannot do

- Offer a modified version as a hosted service without publishing its source.
- Sublicense the code under a more permissive license.
- Use the project name or logo for your fork.
