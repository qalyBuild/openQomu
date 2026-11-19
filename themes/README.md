# Temas de la comunidad

Aquí viven los temas que Qomu y openQomu muestran en **Ajustes → Temas → Comunidad**.

## Enviar un tema

1. Crea un archivo `themes/<id>.json` con el formato de abajo.
2. Añade el mismo objeto al final de `themes/index.json`.
3. Abre un PR. La revisión comprueba formato, contraste y que no haya CSS ni recursos externos.

Los temas se publican bajo **CC0-1.0**. No se aceptan nombres de marcas registradas
de editores o productos (por ejemplo, “Monokai Pro”).

## Formato

```json
{
  "id": "mi-tema",
  "name": "Mi tema",
  "scheme": "dark",
  "version": 1,
  "author": "Tu nombre",
  "license": "CC0-1.0",
  "description": "Una línea opcional.",
  "tokens": {
    "background": "#0b0d10",
    "foreground": "#e6edf3",
    "primary": "#58a6ff"
  },
  "options": { "font": "geist", "effects": ["glass"] }
}
```

- `id`: minúsculas, números y guiones. No puede repetir un tema incluido
  (`qomu-light`, `qomu-dark`, `liquid-glass-light`, `liquid-glass-dark`,
  `monokai`, `solarized-dark`).
- `scheme`: `light` o `dark`. Cada tema es un estilo cerrado; no hay variantes.
- `tokens`: solo los nombres de la lista blanca de `src/app/theme/tokens.ts`.
  `background` y `foreground` son obligatorios.
- Colores: hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`), `rgb()`, `rgba()`,
  `hsl()`, `hsla()`, `oklch()` u `oklab()`. Radios: `rem`, `px` o `em`.
- `options.font`: `geist`, `geist-mono` o `system`.
- `options.effects`: `glass`, `noise`, `glow`.
- Límites: cada valor ≤ 100 caracteres, archivo ≤ 32 KB.

Prohibido: `url()`, `@import`, `;`, `{`, `}`. No se admiten fuentes ni imágenes
externas.

## Probar en local

Abre Qomu u openQomu, entra en **Temas → Importar** y elige tu JSON. Revisa los
dos esquemas (claro y oscuro) antes de enviarlo. Los temas deben mantener
contraste legible en texto, botones y tarjetas.
