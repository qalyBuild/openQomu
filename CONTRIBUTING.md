# Contributing

[Español](CONTRIBUTING.es.md)

Thanks for your interest. This document explains how to propose changes, the conventions we follow and the checks your pull request must pass.

## Before you start

- Read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- For behaviour changes or new features, open an issue first. Explain the problem, the proposed solution and the alternatives you considered.
- Security issues never go to the public tracker: see [SECURITY.md](SECURITY.md).

## Contribute a theme

Open **Temas → Contribuir con un tema** in openQomu. Select your `.qomutheme`, review its variants, and choose **Descargar y abrir GitHub**. Add the extracted `themes/community/<id>/` folder to your fork and open a PR. You can go straight to a PR for a theme.

Read the [theme contribution guide](themes/README.en.md) for the manifest, starter files, validation, and review criteria. Packages under `themes/community/` are contributed under CC0-1.0, including their bundled wallpapers.

## Development

```bash
npm ci
npm run setup
npm run dev
```

Requirements: Node.js 22.13+, npm 10+. Details in [docs/development.md](docs/development.md).

## What makes a good change

- One logical change per pull request. Unrelated refactors go separately.
- Keep domain code pure: no React, Firebase or Capacitor imports inside `src/domain`.
- Add tests for new branches, parsers, permission rules and data migrations.
- Update both language versions of any document you touch (`file.md` and `file.es.md`).
- Spanish is used for user-facing text; identifiers, types and file names are in English.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run check:private
```

Rules tests (`npm run test:rules`) run against the Firebase emulator and are required for changes to `firestore.rules`, `storage.rules` or the data model.

## Commits and sign-off

Conventional Commits, imperative mood:

```
feat(chat): attach pasted images in the composer
fix(kanban): keep the draft when uploads fail
docs(self-hosting): explain the Workers
```

Every commit must be signed off:

```bash
git commit -s -m "feat(chat): attach pasted images in the composer"
```

The `Signed-off-by` line certifies the Developer Certificate of Origin 1.1 (https://developercertificate.org). By signing off you confirm you wrote the change or have the right to submit it, and you submit it under the applicable project license. Code and documentation use AGPL-3.0-only. Community theme packages use CC0-1.0.

## Review

A maintainer reviews for correctness, security, accessibility and consistency with the surrounding code. Expect questions about edge cases and failure modes. Approval requires a green CI run.

## Documentation language

- `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` and `TRADEMARKS.md` are in English, with a `.es.md` counterpart.
- `docs/*.md` and `docs/*.es.md` are counterparts.
- The application interface is in Spanish. Internationalization is tracked in [docs/roadmap.md](docs/roadmap.md).

## Contact

Project maintainers: carlos09102007@gmail.com.
