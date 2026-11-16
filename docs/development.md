# Development

[Español](development.es.md)

## Requirements

- Node.js 22.13 or newer.
- npm 10 or newer.
- Optional: Firebase emulators (`firebase-tools` is a dev dependency).

## Setup

```bash
npm ci
npm run setup
npm run dev
```

`npm run setup` creates `.env.local` and validates it. Without Firebase values the app starts in local mode.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite development server on port 5173. |
| `npm run build` | Type check and production bundle in `dist/`. |
| `npm run preview` | Serves the production build. |
| `npm run typecheck` | TypeScript without emitting. |
| `npm run lint` | oxlint. |
| `npm test` | Unit tests with Vitest. |
| `npm run test:coverage` | Coverage report. |
| `npm run test:rules` | Firestore rules against the emulator. |
| `npm run emulators` | Firebase emulator suite. |
| `npm run skill:check` | Verifies the MCP skill copy is in sync. |
| `npm run check:private` | Fails on private deployment values. |

Worker commands live in their own directories: `npm --prefix files-worker test`, and the same for `push-worker` and `mcp-worker`.

## Structure rules

- Domain code never imports React, Firebase or Capacitor.
- Side effects live in adapters; domain services stay pure and testable.
- UI components do not talk to Firebase directly; they use the container from `useContainer()`.
- New backend capabilities start as a port method, then an adapter implementation.

## Style

- TypeScript strict mode; no `any` unless unavoidable and justified in one line.
- Spanish identifiers are not used: code in English, user-facing text in Spanish.
- Comments explain why, not what. Keep existing comments intact when refactoring.
- Formatting follows the existing files; `oxlint` gates the build.

## Tests

- Pure logic: `src/domain/**/*.test.ts`.
- Adapters: `src/infrastructure/**/*.test.ts`.
- Components: React Testing Library with jsdom.
- Security rules: `tests/rules/` against the emulator.

A change that adds a branch, a parser, money or security logic leaves at least one test or an assertion-based check.

## Commits

Conventional Commits in Spanish or English, one logical change per commit:

```
feat(chat): attach pasted images in the composer
fix(kanban): keep the draft when uploads fail
docs(self-hosting): explain the Workers
```

## Pull requests

1. Open an issue for behaviour changes that affect users.
2. Keep the diff focused; unrelated refactors go in a separate PR.
3. Update both language versions of any document you touch.
4. Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`.
5. Describe the risk, the test plan and any migration step.

## Release process

1. Update `CHANGELOG.md`.
2. Bump `version` in `package.json` (semantic versioning).
3. Tag `vX.Y.Z`; CI builds the static bundle and the Android APK and attaches both to the GitHub release.
4. Verify the deployment checklist in [self-hosting.md](self-hosting.md).
