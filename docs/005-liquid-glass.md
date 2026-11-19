# 005 · Liquid Glass

See the [Spanish version](005-liquid-glass.es.md) for the same specification.

openQomu's web material is inspired by [Apple's materials guidelines](https://developer.apple.com/design/human-interface-guidelines/materials). Translucency and refraction distinguish navigation and floating controls from content. Apple's native material is available through its [platform frameworks](https://developer.apple.com/documentation/technologyoverviews/liquid-glass).

The web effect combines a backdrop, CSS tint and blur, a specular border, and an optional WebGL lens over the backdrop. The decoration ignores user input. Components retain their position, stacking, and focus behavior when the theme changes.

## Theme options

Set `options.effects` to include `glass`. The optional `options.glass` object accepts `material` (`clear`, `regular`, `frosted`), `renderer` (`auto`, `css`, `webgl`), `quality` (`auto`, `high`, `medium`, `low`), and the tint, blur, opacity, lighting, and decorative controls shown in the [complete theme example](005-liquid-glass.es.md#opciones-del-tema).

## Surfaces and fallbacks

- `chrome` covers navigation, the sidebar, and the top bar. `overlay` covers dialogs, sheets, menus, popovers, selects, command menus, and tooltips.
- Cards, fields, and other content use the selected theme colors. The lens tracks up to 32 visible surfaces and prioritizes overlays.
- Desktop uses CSS with the WebGL lens when supported and permitted by the theme. Mobile Safari and the Android Capacitor app use CSS tint, blur and highlights. On small screens the material is adjusted for navigation and the backdrop remains static.
- Browsers without backdrop blur use a solid background. Context loss or excessive render time switches WebGL to CSS. Reduced transparency and forced colors use opaque surfaces. Reduced motion disables continuous animation.

## Acceptance

1. Click, tap, Enter and direct links open task details with default, custom, and glass themes. The panel stays in the viewport and tasks remain editable.
2. Escape and Close restore focus to the task card. Space continues to start keyboard drag and drop.
3. Navigation and content remain distinct in light and dark schemes. The lens tracks scrolling and floating panels.
4. Check AA contrast, the CSS fallback, mobile Safari, the distributed Android version, accessibility settings and switching away from glass.
5. Run `npm run interactions -- --themes` against a demo server, plus lint, type checking, tests and build.
