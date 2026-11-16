# Contribuir

Español · [English](CONTRIBUTING.md)

Gracias por tu interés. Este documento explica cómo proponer cambios, las convenciones que seguimos y las comprobaciones que debe pasar tu pull request.

## Antes de empezar

- Lee [CODE_OF_CONDUCT.es.md](CODE_OF_CONDUCT.es.md).
- Para cambios de comportamiento o funcionalidades nuevas, abre antes una incidencia. Explica el problema, la solución propuesta y las alternativas que valoraste.
- Los problemas de seguridad nunca van al gestor público: consulta [SECURITY.es.md](SECURITY.es.md).

## Desarrollo

```bash
npm ci
npm run setup
npm run dev
```

Requisitos: Node.js 22.13 o superior, npm 10 o superior. Detalles en [docs/development.es.md](docs/development.es.md).

## Qué hace bueno a un cambio

- Un cambio lógico por pull request. Las refactorizaciones no relacionadas van aparte.
- El dominio se mantiene puro: sin imports de React, Firebase ni Capacitor en `src/domain`.
- Añade pruebas para ramas nuevas, parsers, reglas de permisos y migraciones de datos.
- Actualiza las dos versiones de idioma de cualquier documento que toques (`archivo.md` y `archivo.es.md`).
- El texto de interfaz va en español; identificadores, tipos y nombres de archivo en inglés.

## Comprobaciones

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run check:private
```

Las pruebas de reglas (`npm run test:rules`) usan el emulador de Firebase y son obligatorias para cambios en `firestore.rules`, `storage.rules` o el modelo de datos.

## Commits y firma

Conventional Commits, en imperativo:

```
feat(chat): adjuntar imágenes pegadas en el compositor
fix(kanban): conservar el borrador si falla la subida
docs(autoalojamiento): explicar los Workers
```

Todos los commits deben ir firmados:

```bash
git commit -s -m "feat(chat): adjuntar imágenes pegadas en el compositor"
```

La línea `Signed-off-by` certifica el Developer Certificate of Origin 1.1 (https://developercertificate.org). Al firmar confirmas que escribiste el cambio o que tienes derecho a enviarlo, y lo licencias bajo AGPL-3.0-only.

## Revisión

Un mantenedor revisa corrección, seguridad, accesibilidad y coherencia con el código que rodea al cambio. Habrá preguntas sobre casos límite y modos de fallo. La aprobación exige una ejecución correcta de la integración continua.

## Idioma de la documentación

- `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` y `TRADEMARKS.md` están en inglés, con su pareja `.es.md`.
- `docs/*.md` y `docs/*.es.md` son parejas.
- La interfaz de la aplicación está en español. La internacionalización está en [docs/roadmap.es.md](docs/roadmap.es.md).

## Contacto

Mantenedores del proyecto: carlos09102007@gmail.com.
