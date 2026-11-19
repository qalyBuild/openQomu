# 005 · Liquid Glass

## Concepto

El tema web de openQomu sigue la jerarquía descrita por [Apple en su introducción a Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/liquid-glass) y en las [guías de materiales](https://developer.apple.com/design/human-interface-guidelines/materials). El vidrio identifica navegación y controles por encima del contenido. En el tablero las tarjetas se desplazan por debajo de las cabeceras de columna, y el detalle deja ver el tablero debajo. Los indicadores y gráficos del resumen usan vidrio tintado sobre un fondo de bandas azules. La pantalla baja la intensidad del fondo en el tema claro y lo retira con reducción de transparencia o colores forzados.

Un mapa de desplazamiento generado para el tamaño de cada superficie aplica refracción al contenido que Chromium compone en ese instante. El borde curvo desvía más la imagen que el centro. Una capa de reflejos sigue el puntero o el toque y los botones se comprimen durante la pulsación. El filtrado preserva el foco y las áreas de interacción.

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
- `renderer: "auto"` aplica refracción del contenido en Chromium si `svg` está activo y `lensing` es mayor que cero. `css` usa desenfoque, tinte y reflejos. `webgl` conserva la lente de fondo decorativo para temas que la solicitan explícitamente.
- `quality` limita la resolución del mapa a 256, 512 o 768 píxeles en su lado mayor. Se crean filtros para un máximo de 24 superficies, con prioridad para los paneles flotantes.
- `grid` y `caustics` se aplican en el fondo del modo WebGL. `tintLight` y `lightSpread` se aceptan en temas exportados anteriormente.
- `glass` requiere que `effects` incluya `glass`.

## Superficies y plataformas

- `chrome` cubre la navegación, las herramientas del tablero y las cabeceras de columna. `overlay` cubre diálogos, paneles, menús, popovers y selectores. Las tarjetas de tarea y su texto usan los colores del tema. El resumen aplica el material a sus paneles con el centro más tintado para mantener legibles las cifras y los gráficos.
- La refracción funciona en Chromium de escritorio y en WebView de Android basado en Chromium compatible. Safari y Firefox usan tinte, reflejos y desenfoque CSS. Si falta el desenfoque, usan un fondo sólido.
- La reducción de transparencia y los colores forzados dejan las superficies opacas. Con movimiento reducido se conserva el material estático y se desactivan el seguimiento de reflejos y la compresión de los botones.

## Criterios de aceptación

1. Al desplazar una columna, las tarjetas pasan debajo de su cabecera. Con refracción activa, una línea de contraste cambia de posición cerca del borde. La prueba compara píxeles con el filtro activado y desactivado, también sobre el fondo real del resumen.
2. Un clic, toque, Enter o un enlace directo abre el detalle. Escape o Cerrar devuelven el foco a la tarjeta. Espacio conserva el arrastre con teclado.
3. Navegación, cabeceras, panel lateral y controles son legibles en temas claro y oscuro. Verificar el modo CSS de Safari, la reducción de transparencia y el cambio a un tema sin vidrio.
4. Ejecutar `npm run interactions -- --themes` con un servidor en modo demo, además de lint, tipos, tests y build.
