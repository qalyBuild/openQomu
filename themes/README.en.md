# Theme packages

[Español](README.md)

Official packages live in [`official/`](official/) and community packages in [`community/`](community/). A package folder contains its manifest, variant JSON files, and bundled wallpapers. The build generates downloadable `.qomutheme` packages and the catalog used by both Qomu and openQomu. `index.json` remains available to versions that import standalone themes.

## Create and contribute from openQomu

1. Copy [Nord](community/nord/) as a starting point or export one of your own themes from the gallery. Choose new package and variant IDs when creating a new theme.
2. Try your package under **Temas → Importar**. To package a source folder, run `npm ci` and `npm run themes:pack -- path/to/package` from the openQomu repository root.
3. Open **Temas → Contribuir con un tema** and select the `.qomutheme`. Review each variant and choose **Descargar y abrir GitHub**.
4. Create a fork on GitHub. Extract the downloaded ZIP and copy its `themes/community/<id>/` folder to that same path in your fork. You can upload the files on GitHub or use Git locally.
5. Open a pull request (PR) against `qalyBuild/openQomu:main`. Describe the variants and include screenshots of text, buttons, and cards, including any areas with a wallpaper. A new theme only needs the PR. Once approved and merged, the package becomes available in the catalog after deployment.

When contributing using Git, sign off your commit as described in [CONTRIBUTING.md](../CONTRIBUTING.md). Keep IDs stable and increment the package version for updates. Variant IDs are global, and official package IDs are reserved.

## Version 1 format

A `.qomutheme` file is a ZIP with a root `manifest.json`. Variants use `variants/<id>.json` and optional wallpapers live under `assets/`. See the [manifest schema](manifest.schema.json) and a [working example](community/nord/). The validator also checks that the declared paths and IDs match the files, and that each variant matches the package author and license.

- Packages contain 1 to 8 variants. `formatVersion` describes the format. `version` identifies the package revision. Profiles keep using the selected variant ID.
- Allowed tokens are listed in [`src/app/theme/tokens.ts`](../src/app/theme/tokens.ts). `background` and `foreground` are required. Variants can use bundled fonts and registered effects.
- To include a wallpaper, set a variant's `wallpaper` to a path such as `assets/ripples.webp`. WebP, PNG, and JPEG files can be up to 2 MiB, 4096 px on either side, and 8 megapixels. Liquid Glass uses SVG refraction on supported browsers and CSS blur elsewhere when a wallpaper is present.
- ZIP files can be up to 8 MiB and each JSON up to 32 KiB. Include only files referenced by the manifest. The validator rejects CSS, fonts, paths outside the package, and remote resources.
- Standalone JSON files can still be imported. Export a standalone theme from the gallery to convert it into a package.

## Review

- `npm run themes:check` validates format, file limits, community licensing, and unique IDs. The build uses the same validation before publication.
- Review the contrast of text, links, buttons, cards, and focus indicators. If the package includes a wallpaper, review the areas with the lowest contrast. Aim for at least 4.5:1 for normal text.
- Community submissions use **CC0-1.0**. Include wallpapers you created or have permission to redistribute under CC0. Avoid using trademarks in a way that implies a package is official. The [general contribution rules](../CONTRIBUTING.md) still apply to code and documentation outside `themes/community/`.

Maintainers update official packages in openQomu and copy the same official packages into Qomu so both builds are self-contained.
