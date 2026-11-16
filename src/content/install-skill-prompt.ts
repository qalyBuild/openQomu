import skillMarkdown from '../../skills/openqomu/SKILL.md?raw'
import { publicAppOrigin } from '@/lib/app-url'

export const PRODUCT_APP_URL = publicAppOrigin()
export const MCP_TOKEN_ENV = 'OPENQOMU_MCP_TOKEN'

export function buildInstallSkillPrompt({
  mcpUrl,
  appUrl = PRODUCT_APP_URL,
  workspaceId,
  skill = skillMarkdown,
}: {
  mcpUrl: string
  appUrl?: string
  workspaceId?: string
  skill?: string
}): string {
  const settingsUrl = workspaceId
    ? `${appUrl}/w/${workspaceId}/settings?tab=ai`
    : `${appUrl} → Ajustes → IA`

  return `# Instala la skill de openQomu y conecta su MCP

Eres un agente de código. Tu tarea es instalar la skill de openQomu en este harness, configurar su servidor MCP y verificar que funciona. No hagas preguntas que puedas responder inspeccionando el entorno.

## Contexto

- App: ${appUrl}
- Ajustes → IA: ${settingsUrl}
- MCP remoto (Streamable HTTP): ${mcpUrl}
- Autenticación: cabecera \`Authorization: Bearer \${${MCP_TOKEN_ENV}}\`
- La skill se llama \`openqomu\` y sirve para consultar espacios, tableros, tareas, responsables, revisiones y comentarios.

## 0. Compatibilidad

- Si ya tienes openQomu MCP funcionando, **no cambies la URL ni el token**. Reutiliza \`${MCP_TOKEN_ENV}\` y actualiza solo la skill.
- No revoques tokens existentes ni crees uno nuevo sin necesidad.
- Los nombres de las tools y el endpoint no cambian.

## 1. Detecta el harness

Identifica si estás en Claude Code, OpenCode, Cursor, Codex, Gemini CLI, Windsurf, Cline u otro. Usa pistas del entorno (variables como \`CLAUDECODE\`, archivos como \`opencode.json\`, \`CLAUDE.md\`, \`.cursor/\`, \`AGENTS.md\`) o el nombre del producto. Si de verdad no puedes saberlo, pregunta al usuario una sola vez.

## 2. Comprueba el token

- Comprueba si existe la variable \`${MCP_TOKEN_ENV}\` (sin imprimir su valor). Si ya existe, reutilízala.
- Si no existe, pide al usuario que cree un token en ${settingsUrl} con \`openqomu:read\` y, si va a escribir, \`openqomu:write\`. No inventes ni escribas un token.
- Para OpenCode, guarda el token en \`~/.config/openqomu/token\` con permisos \`600\` y usa \`{file:~/.config/openqomu/token}\`. Así el servicio lo lee de disco aunque se haya iniciado sin la variable.
- Para el resto de harnesses, guarda el token en la variable \`${MCP_TOKEN_ENV}\`.
- Nunca escribas el token en el chat, en un archivo versionado ni en un commit.

## 3. Instala la skill

Crea el archivo en la ruta que corresponda al harness. No sobrescribas skills ajenas. Si ya existe \`openqomu\`, actualízala.

| Harness | Ruta recomendada |
| --- | --- |
| Claude Code | \`.claude/skills/openqomu/SKILL.md\` (proyecto) o \`~/.claude/skills/openqomu/SKILL.md\` (global) |
| OpenCode | \`.opencode/skills/openqomu/SKILL.md\` |
| Cursor | \`.cursor/rules/openqomu.mdc\` o \`~/.cursor/rules/openqomu.mdc\` |
| Codex | \`~/.agents/skills/openqomu/SKILL.md\` y, si el harness lo soporta, una sección \`## openQomu\` en \`AGENTS.md\` |
| Gemini CLI | \`.gemini/skills/openqomu/SKILL.md\` o una sección en \`GEMINI.md\` |
| Windsurf | \`.windsurf/rules/openqomu.md\` o \`~/.codeium/windsurf/memories/global_rules.md\` |
| Cline | \`.clinerules/openqomu.md\` |
| Otro | Usa la convención de skills/instrucciones del harness. Si no tiene skills, crea \`openqomu-skill.md\` y enlázalo desde las instrucciones del proyecto. |

Si el harness no usa el frontmatter de skills (por ejemplo Cursor \`.mdc\`, reglas de Cline/Windsurf o \`AGENTS.md\` de Codex), conserva el cuerpo markdown de la skill y adapta únicamente el frontmatter al formato del harness.

Si el harness admite skills globales y el usuario quiere usarla en todos sus proyectos, instálala en la ruta global. Si no, usa la del proyecto.

## 4. Configura el MCP

Añade el servidor \`openqomu\` a la configuración del harness. Si ya existe, actualízalo en lugar de duplicarlo.

### Claude Code

\`\`\`bash
claude mcp add --transport http openqomu ${mcpUrl} \\
  --header "Authorization: Bearer \${${MCP_TOKEN_ENV}}"
\`\`\`

O en \`.mcp.json\`:

\`\`\`json
{
  "mcpServers": {
    "openqomu": {
      "type": "http",
      "url": "${mcpUrl}",
      "headers": { "Authorization": "Bearer \${${MCP_TOKEN_ENV}}" }
    }
  }
}
\`\`\`

### OpenCode

En \`opencode.json\`:

\`\`\`json
{
  "mcp": {
    "servers": {
      "openqomu": {
        "type": "remote",
        "url": "${mcpUrl}",
        "oauth": false,
        "headers": { "Authorization": "Bearer {file:~/.config/openqomu/token}" }
      }
    }
  }
}
\`\`\`

\`oauth: false\` es obligatorio: openQomu usa tokens Bearer, no OAuth.

OpenCode sustituye \`{env:...}\` al cargar la configuración. Si el servicio se inició sin la variable, la sustituye por vacío y el Worker responde \`401\` ("Falta el token Bearer"). Por eso se recomienda \`{file:~/.config/openqomu/token}\`: se lee de disco en cada carga.

Crea el archivo con:

\`\`\`bash
mkdir -p ~/.config/openqomu
printf '%s' '<TU_TOKEN>' > ~/.config/openqomu/token
chmod 600 ~/.config/openqomu/token
\`\`\`

### Claude Desktop

Claude Desktop no acepta cabeceras HTTP directamente. Usa el puente \`mcp-remote\` y un archivo de cabeceras:

\`\`\`bash
export ${MCP_TOKEN_ENV}="openqomu_mcp_..."
mkdir -p ~/.config/openqomu
printf 'Authorization: Bearer %s\\n' "$${MCP_TOKEN_ENV}" > ~/.config/openqomu/mcp-headers.txt
chmod 600 ~/.config/openqomu/mcp-headers.txt
\`\`\`

\`\`\`json
{
  "mcpServers": {
    "openqomu": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "${mcpUrl}",
        "--header-file",
        "/home/tu-usuario/.config/openqomu/mcp-headers.txt",
        "--transport",
        "http-only"
      ]
    }
  }
}
\`\`\`

### Cursor

En \`~/.cursor/mcp.json\` (o \`.cursor/mcp.json\`):

\`\`\`json
{
  "mcpServers": {
    "openqomu": {
      "url": "${mcpUrl}",
      "headers": { "Authorization": "Bearer \${env:${MCP_TOKEN_ENV}}" }
    }
  }
}
\`\`\`

### Codex

En \`~/.codex/config.toml\`:

\`\`\`toml
[mcp_servers.openqomu]
url = "${mcpUrl}"
bearer_token_env_var = "${MCP_TOKEN_ENV}"
\`\`\`

También puedes declarar la cabecera explícitamente:

\`\`\`toml
http_headers = { Authorization = "Bearer \${${MCP_TOKEN_ENV}}" }
\`\`\`

### Cline / Windsurf / Gemini CLI / otros

Usa la configuración MCP del harness para un servidor HTTP remoto:

\`\`\`json
{
  "mcpServers": {
    "openqomu": {
      "url": "${mcpUrl}",
      "headers": { "Authorization": "Bearer \${${MCP_TOKEN_ENV}}" }
    }
  }
}
\`\`\`

Si el harness solo admite servidores stdio, usa un puente:

\`\`\`bash
npx -y mcp-remote ${mcpUrl} \\
  --header "Authorization: Bearer \${${MCP_TOKEN_ENV}}"
\`\`\`

## 5. Verifica la conexión

1. Reinicia o recarga el harness si es necesario para que lea la nueva configuración.
2. Llama a \`list_workspaces\`. Debe devolver los espacios reales del usuario.
3. Llama a \`list_boards\` del primer espacio y a \`list_tasks\` de un tablero.
4. Si recibes 401, el token no existe, es inválido o está revocado. Pide al usuario que cree otro en ${settingsUrl}.
5. Si recibes 403, al token le falta el scope \`openqomu:read\` o \`openqomu:write\`. Pide al usuario que cree uno con los permisos necesarios.
6. No consideres la instalación terminada hasta que \`list_workspaces\` responda correctamente.

## 6. Resume al usuario

Explica:

- Qué archivos has creado o modificado y en qué rutas.
- Cómo reiniciar el harness.
- Qué herramientas MCP tiene disponibles.
- 2 o 3 ejemplos de uso, por ejemplo: “¿qué tareas tengo pendientes?”, “crea una tarea para revisar el onboarding” o “mueve esta tarea a En revisión”.

## Contenido de la skill

Copia exactamente lo que hay entre las marcas \`<<<SKILL_INICIO>>>\` y \`<<<SKILL_FIN>>>\` en el archivo de skill que corresponda. Incluye el frontmatter YAML:

<<<SKILL_INICIO>>>
${skill.trim()}
<<<SKILL_FIN>>>
`
}
