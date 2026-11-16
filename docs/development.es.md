# Desarrollo

Español · [English](development.md)

## Requisitos

- Node.js 22.13 o superior.
- npm 10 o superior.
- Opcional: emuladores de Firebase (`firebase-tools` es dependencia de desarrollo).

## Puesta en marcha

```bash
npm ci
npm run setup
npm run dev
```

`npm run setup` crea `.env.local` y lo valida. Sin valores de Firebase la app arranca en modo local.

## Comandos

| Comando | Función |
| --- | --- |
| `npm run dev` | Servidor de desarrollo de Vite en el puerto 5173. |
| `npm run build` | Comprobación de tipos y paquete de producción en `dist/`. |
| `npm run preview` | Sirve el paquete de producción. |
| `npm run typecheck` | TypeScript sin emitir. |
| `npm run lint` | oxlint. |
| `npm test` | Pruebas unitarias con Vitest. |
| `npm run test:coverage` | Informe de cobertura. |
| `npm run test:rules` | Reglas de Firestore contra el emulador. |
| `npm run emulators` | Suite de emuladores de Firebase. |
| `npm run skill:check` | Comprueba que la copia de la skill MCP está sincronizada. |
| `npm run check:private` | Falla ante valores del despliegue privado. |

Los comandos de los Workers viven en su carpeta: `npm --prefix files-worker test`, y lo mismo para `push-worker` y `mcp-worker`.

## Reglas de estructura

- El dominio nunca importa React, Firebase ni Capacitor.
- Los efectos secundarios viven en los adaptadores; los servicios de dominio son puros y testeables.
- Los componentes no hablan con Firebase directamente: usan el contenedor de `useContainer()`.
- Una capacidad nueva empieza como método del puerto y después se implementa en el adaptador.

## Estilo

- TypeScript en modo estricto; sin `any` salvo casos inevitables justificados en una línea.
- Los identificadores van en inglés; los textos de interfaz en español.
- Los comentarios explican el porqué, no el qué. Conserva los comentarios existentes al refactorizar.
- El formato sigue los archivos existentes; `oxlint` controla la calidad.

## Pruebas

- Lógica pura: `src/domain/**/*.test.ts`.
- Adaptadores: `src/infrastructure/**/*.test.ts`.
- Componentes: React Testing Library con jsdom.
- Reglas de seguridad: `tests/rules/` contra el emulador.

Un cambio que añade una rama, un parser, lógica de dinero o de seguridad deja al menos una prueba o una comprobación con aserciones.

## Commits

Conventional Commits en español o inglés, un cambio lógico por commit:

```
feat(chat): adjuntar imágenes pegadas en el compositor
fix(kanban): conservar el borrador si falla la subida
docs(autoalojamiento): explicar los Workers
```

## Pull requests

1. Abre una incidencia para los cambios de comportamiento que afecten a usuarios.
2. Mantén el diff acotado; las refactorizaciones no relacionadas van en otro PR.
3. Actualiza las dos versiones de idioma de cualquier documento que toques.
4. Ejecuta `npm run lint`, `npm run typecheck`, `npm test` y `npm run build`.
5. Describe el riesgo, el plan de pruebas y cualquier paso de migración.

## Proceso de release

1. Actualiza `CHANGELOG.md`.
2. Sube `version` en `package.json` (versionado semántico).
3. Etiqueta `vX.Y.Z`; la integración continua compila el paquete estático y la APK y adjunta ambos a la release de GitHub.
4. Verifica la lista de comprobación de [self-hosting.es.md](self-hosting.es.md).
