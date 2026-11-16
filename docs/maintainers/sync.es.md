# Mantener sincronizado un despliegue privado

Español · [English](sync.md)

Una distribución privada puede usar openQomu como upstream. El objetivo es recibir mejoras del producto sin publicar configuración del despliegue.

## Frontera de configuración

Solo estos archivos pueden diferir entre el repositorio público y un despliegue privado:

| Archivo | Motivo |
| --- | --- |
| `.env.local` | Credenciales y URLs. Nunca se versiona. |
| `src/config/product.ts` | Nombre y slug del producto. |
| `index.html` | Título del documento y meta descripción. |
| `wrangler.jsonc` (por Worker) | Identificadores de proyecto, buckets y orígenes permitidos. |
| `android/app/google-services.json` | Configuración Android de Firebase. |
| `android/keystore.properties` | Material de firma. |
| `.firebaserc` | Alias del proyecto de Firebase. |

El resto debe mezclarse sin conflictos. Si una mejora exige tocar un archivo de esta lista, expón la parte configurable como variable de entorno en lugar de fijar un valor.

## Flujo de trabajo

1. Añade el repositorio público como remoto:

```bash
git remote add upstream https://github.com/<owner>/openQomu.git
```

2. Descarga y revisa antes de mezclar:

```bash
git fetch upstream
git log --oneline HEAD..upstream/main
git diff HEAD..upstream/main -- . ':!src/config/product.ts'
```

3. Mezcla o aplica cherry-pick. Resuelve conflictos solo en los archivos de la lista anterior.

4. Ejecuta la comprobación:

```bash
npm run check:private
npm run lint
npm run typecheck
npm test
npm run build
```

5. Revisa el diff en busca de dominios, identificadores de proyecto, UIDs o correos filtrados antes de publicar.

## Enviar una corrección al upstream

Cuando la corrección pertenece al producto y no al despliegue:

1. Reproduce el fallo con la configuración por defecto.
2. Abre un pull request contra el repositorio público.
3. Mézclalo en el despliegue cuando se publique la versión.

Nunca abras un pull request con configuración privada. `npm run check:private` y el escáner de secretos de CI bloquean las filtraciones más habituales.

## Cadencia de versiones

- Correcciones de seguridad: se mezclan de inmediato.
- Funcionalidades: se mezclan después de la etiqueta pública para evitar divergencias.
- Mantén una rama por despliegue (`main` en el downstream) y no reescribas el historial publicado.
