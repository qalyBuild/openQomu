# Paquetes de temas

[English](README.en.md)

Los temas oficiales viven en [`official/`](official/) y los de la comunidad en [`community/`](community/). Cada carpeta de paquete contiene el manifiesto, los JSON de sus variantes y los fondos incluidos. La compilación genera los archivos `.qomutheme` y el catálogo que usan Qomu y openQomu. `index.json` conserva el catálogo para las versiones que todavía importan temas sueltos.

## Crear y contribuir desde openQomu

1. Copia [Nord](community/nord/) como punto de partida o exporta un tema propio desde la galería. Cambia el ID del paquete y los de sus variantes si estás creando un tema nuevo.
2. Prueba el paquete con **Temas → Importar**. Si trabajas con una carpeta, genera el archivo desde la raíz de openQomu con `npm ci` y `npm run themes:pack -- ruta/al/paquete`.
3. En **Temas → Contribuir con un tema**, selecciona el `.qomutheme`. Revisa la vista previa de cada variante y pulsa **Descargar y abrir GitHub**.
4. Crea tu copia (fork) en GitHub. El ZIP descargado contiene `themes/community/<id>/`. Extrae el ZIP y copia esa carpeta en la misma ruta de tu fork. Puedes subir los archivos desde GitHub o usar Git en tu equipo.
5. Abre un pull request (PR) hacia `qalyBuild/openQomu:main`. Describe las variantes y adjunta capturas donde se vean texto, botones y tarjetas, también sobre el fondo si el paquete incluye uno. Para un paquete nuevo basta con el PR. Tras aprobarlo y fusionarlo, el despliegue publica el paquete en el catálogo.

Si contribuyes con Git, firma el commit como indica [CONTRIBUTING.es.md](../CONTRIBUTING.es.md). En una actualización, conserva los IDs y aumenta la versión del paquete. Los IDs de variantes son globales. Los de los paquetes oficiales están reservados.

## Formato v1

Un `.qomutheme` es un ZIP con `manifest.json` en la raíz. Sus variantes viven en `variants/<id>.json` y los fondos opcionales en `assets/`. Consulta el [esquema JSON del manifiesto](manifest.schema.json). El validador comprueba además que las rutas y los IDs del manifiesto coincidan con los archivos y que la autoría y la licencia de cada variante coincidan con las del paquete.

Ejemplo de `manifest.json` para un paquete con una variante:

```json
{
  "formatVersion": 1,
  "id": "marea",
  "version": 1,
  "name": "Marea",
  "author": "Ana",
  "license": "CC0-1.0",
  "variants": [
    {
      "id": "marea-clara",
      "scheme": "light",
      "file": "variants/marea-clara.json"
    }
  ]
}
```

El archivo `variants/marea-clara.json` conserva el formato de los temas sueltos:

```json
{
  "id": "marea-clara",
  "name": "Marea Clara",
  "scheme": "light",
  "version": 1,
  "author": "Ana",
  "license": "CC0-1.0",
  "tokens": {
    "background": "#f0f9fa",
    "foreground": "#152f35",
    "primary": "#17586a"
  }
}
```

- Cada paquete admite de 1 a 8 variantes. `formatVersion` indica cómo leerlo. `version` identifica la edición del paquete. Los perfiles se siguen vinculando al ID de la variante seleccionada.
- Los tokens permitidos están en [`src/app/theme/tokens.ts`](../src/app/theme/tokens.ts). `background` y `foreground` son obligatorios. Puedes elegir una de las fuentes incluidas y los efectos registrados.
- Para incluir un fondo, añade por ejemplo `"wallpaper": "assets/ondas.webp"` a la variante en el manifiesto. Se admiten WebP, PNG y JPEG de hasta 2 MiB, 4096 px por lado y 8 megapíxeles. Un fondo con Liquid Glass utiliza la refracción SVG donde está disponible y el desenfoque CSS como alternativa.
- Límite de 8 MiB por ZIP y 32 KiB por JSON. Incluye solo archivos referenciados por el manifiesto. Los paquetes contienen datos e imágenes locales. El validador rechaza CSS, fuentes, rutas fuera del paquete y recursos remotos.
- Los JSON antiguos se siguen importando. Para actualizar un tema suelto al formato nuevo desde la galería, expórtalo como paquete.

## Qué se revisa

- El comando `npm run themes:check` comprueba formato, límites, licencia comunitaria, archivos e IDs únicos. La compilación ejecuta la misma validación antes de publicar.
- Se comprueba la legibilidad de texto, enlaces, botones, tarjetas y estados de foco. Si hay un fondo, incluye en la revisión las zonas con menos contraste. Como referencia, el texto normal debe alcanzar 4,5:1.
- Los aportes de la comunidad se publican bajo **CC0-1.0**. Incluye fondos propios o que tengas derecho a redistribuir bajo CC0. Evita marcas que puedan dar a entender que el paquete es oficial. La regla de código y documentación de [Contribuir](../CONTRIBUTING.es.md) sigue siendo aplicable a cambios fuera de `themes/community/`.

Los mantenedores actualizan los oficiales en openQomu y trasladan la misma carpeta oficial a Qomu para que las dos compilaciones los incluyan sin depender de la red.
