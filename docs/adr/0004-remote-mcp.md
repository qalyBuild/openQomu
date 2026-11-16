# ADR 0004: MCP remoto para integración con IA

## Estado

Aceptado.

## Contexto

openQomu es una SPA estática en Firebase Hosting. Los usuarios quieren conectar agentes de IA a sus espacios, tableros y tareas. Se evaluaron MCP local, MCP remoto, OAuth, un asistente dentro de la app y una API REST.

Decisiones del producto:

- Runtime: Cloudflare Workers.
- Autenticación inicial: tokens Bearer por usuario.
- Alcance: clientes MCP que permitan cabeceras HTTP.
- Sin OAuth en la primera versión.

## Decisión

Implementar un servidor MCP remoto en Cloudflare Workers con:

- `createMcpHandler` del Agents SDK (MCP SDK v2, stateless).
- Tokens de API generados en openQomu y almacenados hasheados en Firestore.
- Firestore REST con un service account de solo Datastore.
- Autorización propia por membresía y rol, porque el service account se salta las reglas de Firestore.
- Auditoría de escrituras en `mcpAuditLogs`.
- Skill canónica en `skills/openqomu/SKILL.md`, sincronizada con `scripts/sync-skill.mjs` hacia `mcp-worker/src/skill-content.ts`.

## Alternativas consideradas

### MCP local con stdio

Más simple y sin hosting, pero no es multiusuario ni accesible desde clientes remotos.

### Cloud Run + Firebase Admin

Menos código de acceso a datos, pero exige Blaze y no era la preferencia del usuario.

### OAuth desde el inicio

Compatible con más clientes, pero mucho más trabajo: DCR/CIMD, PKCE, consentimiento y refresh. Se pospone.

### REST/OpenAPI + skill

Útil para automatizaciones, pero no ofrece el modelo de tools y recursos de MCP.

## Consecuencias

- Los clientes que exigen OAuth no funcionan.
- El Worker no puede usar `firebase-admin`; hay que mantener un cliente Firestore REST.
- La autorización se duplica respecto a las reglas de Firestore y debe probarse con cuidado.
- El service account es un secreto crítico; solo tiene `roles/datastore.user`.
- El rate limit por isolate no es global.
- La skill no da conectividad: solo enseña a usar las tools y sus reglas de seguridad.

## Futuro

Si se necesita compatibilidad con ChatGPT o Claude web, se puede añadir OAuth con `workers-oauth-provider` manteniendo las mismas tools. El `authContext` del handler permite cambiar el verificador de tokens sin reescribir la lógica de negocio.
