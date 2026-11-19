# 005 · Liquid Glass

## Concepto

Un tema puede declarar el efecto `glass`. El material se dibuja con cuatro capas:

1. Malla de fondo fija.
2. Material CSS sobre cada superficie: tinte, blur, saturación, brillo, filo
   especular, lensing, bloom y sombra.
3. Lente WebGL en un solo canvas para las superficies registradas. Deforma la
   malla de fondo, no el DOM.
4. Capa SVG decorativa opcional en paneles grandes. El contenido queda fuera
   del filtro.

El DOM nunca se distorsiona. La lente WebGL sigue el scroll, el resize y la
apertura de overlays.

## Opciones del tema

```json
"options": {
  "effects": ["glass"],
  "glass": {
    "material": "regular",
    "renderer": "auto",
    "quality": "auto",
    "tint": "#0b0f14",
    "tintLight": "#ffffff",
    "blur": 22,
    "opacity": 0.42,
    "saturation": 1.35,
    "brightness": 0.76,
    "rim": 0.75,
    "lensing": 1,
    "shadow": 1,
    "lightAngle": 340,
    "lightSpread": 110,
    "grid": 0.22,
    "caustics": 0.15,
    "svg": true
  }
}
```

- `material`: `clear`, `regular`, `frosted`.
- `renderer`: `auto`, `css`, `webgl`.
- `quality`: `auto`, `high`, `medium`, `low`.
- Multiplicadores 0–2. `grid` y `caustics` 0–1. Ángulos 0–360.
- `glass` solo es válido si `effects` incluye `glass`.

## Superficies

- `chrome`: sidebar y topbar.
- `panel`: tarjetas y contenedores de gráficos.
- `overlay`: diálogos, sheets, menús, popovers, select, command y tooltips.

La lente mide como máximo 32 superficies visibles, priorizando `overlay`,
`chrome` y área. Los controles pequeños se quedan solo con material CSS.

## Activación

- WebGL en escritorio por defecto, si el navegador lo soporta.
- Móvil y `renderer: "css"`: material CSS.
- `prefers-reduced-transparency` y `forced-colors`: opaco, sin lente.
- `prefers-reduced-motion`: lente y malla estáticas.
- Si el contexto WebGL se pierde o el frame medio supera 24 ms, se degrada a
  CSS sin cambiar el diseño.

## Criterios

1. El tema Liquid Glass claro y oscuro usa material real, no solo colores.
2. La lente sigue las tarjetas al hacer scroll.
3. Abrir un diálogo añade su lente sin desalinear las tarjetas.
4. Sin WebGL, el tema sigue siendo legible y elegante.
5. Contraste AA en texto principal y secundario.
6. Cambiar a otro tema retira canvas, filtros y variables.
7. `typecheck`, tests, build y lint verdes.
