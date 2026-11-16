# ADR 0001 — SPA con Vite en Firebase Hosting

**Estado:** aceptado · **Fecha:** 2026-11-12

## Contexto
openQomu es una app colaborativa en tiempo real, autenticada y con datos por usuario. Se busca máxima velocidad de carga y un despliegue sencillo en Firebase.

## Decisión
Usar React + TypeScript con Vite como SPA estática, desplegada en Firebase Hosting con reescrituras a `index.html`.

## Consecuencias
- **+** Build pequeño, CDN global, sin cold starts de SSR, configuración mínima.
- **+** Firebase Hosting sirve assets con caché agresiva y HTTP/2.
- **−** SEO limitado (la landing es estática y suficiente).
- **−** El primer render depende de JS; se mitiga con skeletons y code splitting.
- Alternativa descartada: Next.js con Firebase Frameworks (requiere Blaze y más complejidad operativa).
