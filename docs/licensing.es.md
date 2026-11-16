# Licencias

Español · [English](licensing.md)

## Código

openQomu se distribuye bajo la **GNU Affero General Public License v3.0 only** (`AGPL-3.0-only`). El texto completo está en [LICENSE](../LICENSE).

La AGPL añade una obligación sobre la GPL: si ejecutas una versión modificada como servicio en red, los usuarios de ese servicio deben poder obtener el código fuente correspondiente. Si despliegas openQomu para tu equipo, eso implica normalmente publicar tu fork o facilitar el código a tus usuarios.

## Nombre y logotipo

La licencia cubre el código, no las marcas. El nombre `openQomu`, su logotipo y la identidad visual se rigen por [TRADEMARKS.es.md](../TRADEMARKS.es.md). Los forks deben usar otro nombre y otro logotipo.

## Dependencias

Todas las dependencias de ejecución usan licencias permisivas compatibles con AGPL-3.0: MIT, ISC y Apache-2.0. La lista se obtiene con:

```bash
npx license-checker --summary
```

Si alguna dependencia deja de ser compatible, sustitúyela antes de mezclar el cambio: la integración continua ejecuta una comprobación de licencias.

## Contribuciones

Al enviar un pull request aceptas licenciar tu contribución bajo AGPL-3.0-only y confirmas que tienes derecho a hacerlo. Cada commit incluye una línea `Signed-off-by` (Developer Certificate of Origin). Consulta [CONTRIBUTING.es.md](../CONTRIBUTING.es.md).

## Qué puedes hacer

- Autoalojar openQomu para tu organización, también con fines comerciales.
- Modificarlo y mantener los cambios privados **mientras la versión modificada no se ofrezca a terceros por red**.
- Distribuir binarios o imágenes si incluyes el código fuente y mantienes la licencia.

## Qué no puedes hacer

- Ofrecer una versión modificada como servicio alojado sin publicar su código.
- Resubvencionar el código bajo una licencia más permisiva.
- Usar el nombre o el logotipo del proyecto en tu fork.
