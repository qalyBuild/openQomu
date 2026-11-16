# ADR 0003 — Modo demo con persistencia local

**Estado:** aceptado · **Fecha:** 2026-11-12

## Contexto
Sin credenciales de Firebase la app no podría evaluarse. Además, queremos pruebas de integración rápidas y una experiencia “probar sin fricción”.

## Decisión
Implementar adaptadores `Demo*Repository` sobre un `DemoStore` singleton con persistencia en `localStorage` y archivos en IndexedDB. Se activan automáticamente si faltan variables `VITE_FIREBASE_*`, o con `VITE_DEMO_MODE=true`. Incluyen datos semilla realistas y login como “Alex Rivera”.

## Consecuencias
- **+** La app es completamente navegable y funcional sin configuración.
- **+** Los tests de repositorios validan el mismo contrato que Firebase.
- **+** Los datos demo persisten entre recargas y se pueden reiniciar.
- **−** No hay colaboración multiusuario real en demo (se simula presencia).
- **−** No apto para producción: los datos locales no se comparten entre dispositivos.
