# 005 · Liquid Glass

See the [Spanish version](005-liquid-glass.es.md) for the same specification.

openQomu's web theme follows the hierarchy in [Apple's Liquid Glass overview](https://developer.apple.com/documentation/technologyoverviews/liquid-glass) and [materials guidelines](https://developer.apple.com/design/human-interface-guidelines/materials). Glass identifies navigation and controls above the content. On the board, cards scroll under the column headings and the task detail shows the board through its surface. Overview metrics and charts sit on tinted glass over a wallpaper with distinct blue curves. The application softens the wallpaper in the light theme and removes it on reduced transparency or forced colors.

A displacement map sized to each surface refracts the pixels Chromium composites behind it. The rounded rim displaces more than the center. Highlights follow the pointer or touch, and buttons compress while pressed. The effect preserves focus and hit targets.

## Theme options

Set `options.effects` to include `glass`. The optional `options.glass` object accepts `material` (`clear`, `regular`, `frosted`), `renderer` (`auto`, `css`, `webgl`), `quality` (`auto`, `high`, `medium`, `low`), and the tint, blur, opacity, lighting, and decorative controls shown in the [complete theme example](005-liquid-glass.es.md#opciones-del-tema).

## Surfaces and fallbacks

- `chrome` covers navigation, board tools, and column headings. `overlay` covers dialogs, sheets, menus, popovers and selects. Task cards and their text use theme colors. Overview panels use a more strongly tinted center to keep the figures and charts readable.
- `renderer: "auto"` uses Chromium's SVG backdrop refraction when `svg` is enabled and `lensing` is positive. Up to 24 surfaces are processed, with overlays prioritized. `quality` limits map resolution to 256, 512, or 768 pixels on the longest side.
- Safari and Firefox use CSS tint, highlights and backdrop blur. Browsers without blur use a solid background. `renderer: "css"` selects the CSS effect, and `renderer: "webgl"` retains the legacy decorative backdrop lens.
- Reduced transparency and forced colors use opaque surfaces. Reduced motion keeps the static material and disables moving highlights and button compression.

## Acceptance

1. Cards scroll behind their headings. On Chromium, compare pixels with the filter on and off to verify visible displacement near the edge, including over the actual overview wallpaper.
2. Click, tap, Enter and direct links open task details. Escape and Close restore focus. Space starts keyboard dragging.
3. Check light and dark themes, mobile WebKit, reduced transparency, and switching to a theme without glass.
4. Run `npm run interactions -- --themes` against a demo server, plus lint, type checking, tests and build.
