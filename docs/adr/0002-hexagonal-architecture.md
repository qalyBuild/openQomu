# ADR 0002 — Arquitectura hexagonal e inyección de dependencias

**Estado:** aceptado · **Fecha:** 2026-11-12

## Contexto
La app debe ser testeable sin red, respetar SOLID y poder cambiar de backend (Firebase ↔ demo/emuladores) sin reescribir la UI.

## Decisión
Separar `domain` (entidades, puertos, servicios puros), `infrastructure` (adaptadores) y `presentation` (React). Un `AppContainer` compone los adaptadores y se inyecta por contexto. Los servicios reciben puertos por constructor.

## Consecuencias
- **+** Dominio testeable con Vitest sin mocks de Firebase.
- **+** Adaptadores intercambiables y modo demo real.
- **−** Más archivos y ceremonias que un MVP monolítico.
- **−** Curva de entrada: hay que registrar nuevos puertos en el contenedor.
