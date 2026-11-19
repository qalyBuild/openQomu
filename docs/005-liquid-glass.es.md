# 005 · Liquid Glass

## Concepto

openQomu ofrece un material web inspirado en las [guías de materiales de Apple](https://developer.apple.com/design/human-interface-guidelines/materials). Aplica transparencia y refracción a la navegación y a los controles flotantes para mantener el contenido en primer plano. El material nativo de Apple se ofrece mediante sus [frameworks de plataforma](https://developer.apple.com/documentation/technologyoverviews/liquid-glass).

El efecto web combina un fondo, tinte y desenfoque CSS, un borde especular y una lente WebGL opcional sobre el fondo. Los elementos decorativos quedan fuera de la interacción. El componente conserva su posición, orden de apilado y gestión de foco al cambiar de tema.

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

- `chrome`: navegación, sidebar y topbar.
- `overlay`: diálogos, sheets, menús, popovers, select, command y tooltips.
- Las tarjetas, campos y el resto del contenido usan los colores del tema. La lente mide hasta 32 superficies visibles y prioriza los overlays.

## Activación

- Escritorio: CSS con lente WebGL si hay soporte y el renderer lo permite.
- Safari móvil y Android (APK de Capacitor): tinte, desenfoque y borde CSS. La navegación mantiene el material con una intensidad adaptada al tamaño de pantalla.
- Si falta soporte para desenfoque, la superficie usa un fondo sólido. Si se pierde WebGL o el tiempo medio de fotograma supera el presupuesto, se mantiene el material CSS.
- La reducción de transparencia y los colores forzados usan superficies opacas. Con movimiento reducido se elimina la animación continua.

## Criterios de aceptación

1. En temas predeterminados, personalizados y de vidrio, un clic, toque, Enter o un enlace directo abre el detalle de la tarea. El panel queda dentro de la ventana y el contenido se puede editar.
2. Escape o Cerrar devuelven el foco a la tarjeta que abrió el detalle. Espacio conserva el arrastre con teclado.
3. En claro y oscuro, el material distingue navegación y contenido. La lente sigue el desplazamiento y la apertura de overlays.
4. Validar texto y controles con contraste AA, sin lente WebGL, en Safari móvil y en el APK de la versión distribuida. Probar los modos de accesibilidad y el cambio a un tema sin vidrio.
5. Ejecutar `npm run interactions -- --themes` con un servidor en modo demo, además de lint, tipos, tests y build.
