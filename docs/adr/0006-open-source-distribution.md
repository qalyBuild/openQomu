# ADR 0006 — Distribución open source y autoalojable

**Estado:** aceptado · **Fecha:** 2026-11-16

## Contexto

El producto se distribuye como aplicación privada con una infraestructura concreta. Se quiere una versión pública que cualquiera pueda alojar con sus propias cuentas, sin depender de dominios, proyectos ni Workers del autor original, y sin publicar credenciales ni datos personales.

## Decisión

1. **Repositorio nuevo** con un único commit inicial. No se publica el historial del repositorio privado.
2. **Licencia AGPL-3.0-only** para el código, con marca y logotipo fuera de la licencia.
3. **Firebase propio (BYO) y modo local** como topologías soportadas en la primera versión. La independencia total del backend queda como hito posterior.
4. **Frontera de configuración explícita**: valores por despliegue en `.env.local`, `src/config/product.ts`, `wrangler.jsonc` y los archivos de firma de Android. El resto del código debe ser idéntico entre la distribución pública y cualquier despliegue privado.
5. **Workers opcionales y genéricos**: almacenamiento compatible con S3, push y MCP sin identificadores de proyecto incrustados.
6. **Sincronización periódica** desde este repositorio hacia los despliegues privados, con comprobaciones automáticas (`check:private`, escaneo de secretos) como red de seguridad.
7. **Documentación bilingüe**: inglés como idioma principal y español como pareja, con la interfaz en español.

## Consecuencias

- **+** Cualquier equipo puede desplegar sin pedir permiso ni credenciales.
- **+** Los merges desde upstream no arrastran configuración privada si se respeta la frontera.
- **+** La AGPL protege el producto frente a un servicio competidor cerrado.
- **−** La AGPL reduce la adopción en organizaciones que evitan copyleft fuerte.
- **−** La sincronización periódica exige disciplina y revisión manual de los diffs.
- **−** Cambiar el `applicationId` impide actualizar instalaciones publicadas con otro identificador.
