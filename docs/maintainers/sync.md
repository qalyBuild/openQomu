# Keeping a private deployment in sync

[Español](sync.es.md)

A private distribution can reuse openQomu as upstream. The goal is to pull product improvements without publishing deployment-specific configuration.

## Configuration boundary

Only these files may differ between the public repository and a private deployment:

| File | Reason |
| --- | --- |
| `.env.local` | Credentials and URLs. Never committed. |
| `src/config/product.ts` | Product name and slug. |
| `index.html` | Document title and meta description. |
| `wrangler.jsonc` (per Worker) | Project IDs, buckets, allowed origins. |
| `android/app/google-services.json` | Firebase Android configuration. |
| `android/keystore.properties` | Signing material. |
| `.firebaserc` | Firebase project alias. |

Anything else should merge cleanly. If a product improvement requires touching a file in this list, put the configurable part behind an environment variable instead of hardcoding a value.

## Workflow

1. Add the public repository as a remote:

```bash
git remote add upstream https://github.com/<owner>/openQomu.git
```

2. Fetch and review before merging:

```bash
git fetch upstream
git log --oneline HEAD..upstream/main
git diff HEAD..upstream/main -- . ':!src/config/product.ts'
```

3. Merge or cherry-pick. Resolve conflicts only in the files listed above.

4. Run the guard:

```bash
npm run check:private
npm run lint
npm run typecheck
npm test
npm run build
```

5. Review the diff for leaked domains, project IDs, UIDs or emails before pushing.

## Upstreaming a fix

When the fix belongs to the product and not to the deployment:

1. Reproduce it with the default configuration.
2. Open a pull request against the public repository.
3. Merge downstream once it is released.

Never open a pull request that contains private configuration. `npm run check:private` and the CI secret scan block the most common leaks.

## Release cadence

- Security fixes: merge immediately.
- Features: merge after the public release tag to avoid divergence.
- Keep one branch per deployment (`main` downstream) and never rewrite published history.
