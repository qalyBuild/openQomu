---
name: openQomu
description: Opera espacios, tableros, tareas, responsables, revisiones y comentarios de openQomu mediante el MCP remoto de openQomu. Úsala cuando el usuario pregunte por tareas, tableros, carga de trabajo, revisiones o quiera crear, actualizar o mover trabajo.
---

# openQomu

## Conexión

- Servidor MCP: la URL del despliegue del usuario (por ejemplo `https://mcp.mi-dominio.com/mcp`).
- Autenticación: token Bearer de openQomu.
- El token se crea en **openQomu → Ajustes → IA**. Se muestra una sola vez.
- Guárdalo en `OPENQOMU_MCP_TOKEN`; nunca lo escribas en el chat, en un archivo versionado ni en un commit.
- Scopes:
  - `openqomu:read`: consultar espacios, tableros, tareas, miembros y comentarios.
  - `openqomu:write`: crear, actualizar, mover tareas, comentar y borrar.
- La URL del MCP la fija quien despliega la instancia (`VITE_MCP_URL`). Pídesela al usuario
  si no la conoces; no la inventes.
- **Compatibilidad**: si ya tienes openQomu MCP funcionando, reutiliza la URL, el token y la
  configuración existentes. No revoques tokens ni crees otros nuevos sin necesidad. Los
  nombres de las tools y el endpoint no cambian.

## Instalación por harness

Si el usuario pide instalar o reparar el MCP, detecta el harness y aplica la configuración
correspondiente. No escribas el token en archivos versionados ni en el chat: referencia
siempre la variable `OPENQOMU_MCP_TOKEN` o el archivo `~/.config/openqomu/token`.

### Claude Code

Añade el servidor con el CLI:

```bash
claude mcp add --transport http openqomu \
  {MCP_URL} \
  --header "Authorization: Bearer $OPENQOMU_MCP_TOKEN"
```

O usa el `.mcp.json` del proyecto:

```json
{
  "mcpServers": {
    "openqomu": {
      "type": "http",
      "url": "{MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${OPENQOMU_MCP_TOKEN}"
      }
    }
  }
}
```

La skill vive en `skills/openqomu/SKILL.md` dentro de este repositorio o en
`~/.claude/skills/openqomu/SKILL.md` (global). Claude Code la descubre al abrir el repo.

### OpenCode

En `opencode.json`:

```json
{
  "mcp": {
    "servers": {
      "openqomu": {
        "type": "remote",
        "url": "{MCP_URL}",
        "oauth": false,
        "headers": {
          "Authorization": "Bearer {file:~/.config/openqomu/token}"
        }
      }
    }
  }
}
```

`oauth: false` es obligatorio: openQomu usa tokens, no OAuth. Crea el archivo del token:

```bash
mkdir -p ~/.config/openqomu
printf '%s' '<TU_TOKEN>' > ~/.config/openqomu/token
chmod 600 ~/.config/openqomu/token
```

OpenCode sustituye `{env:...}` al cargar la configuración. Si el servicio se inició sin la
variable, la sustituye por vacío y el Worker responde `401` ("Falta el token Bearer"). Por eso
se recomienda `{file:~/.config/openqomu/token}`: se lee de disco en cada carga. Si ya usas
`{env:OPENQOMU_MCP_TOKEN}` y te funciona, puedes mantenerlo.

Con Code Mode, las herramientas están en `tools.openqomu.*`. En clientes con tools nativas
aparecen como `openqomu_list_workspaces`, etc.

### Claude Desktop

Claude Desktop no admite cabeceras HTTP directamente. Usa el puente `mcp-remote` con un
archivo de cabeceras fuera del repositorio:

```json
{
  "mcpServers": {
    "openqomu": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "{MCP_URL}",
        "--header-file",
        "/home/tu-usuario/.config/openqomu/mcp-headers.txt",
        "--transport",
        "http-only"
      ]
    }
  }
}
```

Crea `mcp-headers.txt` con permisos `600` y una línea:

```text
Authorization: Bearer <token>
```

`--header-file` exige una ruta absoluta: sustituye `/home/tu-usuario` por la tuya.

Rutas de configuración:
- Linux: `~/.config/Claude/claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

### Cursor

En `~/.cursor/mcp.json` (o `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "openqomu": {
      "url": "{MCP_URL}",
      "headers": { "Authorization": "Bearer ${env:OPENQOMU_MCP_TOKEN}" }
    }
  }
}
```

La skill puede instalarse en `.cursor/rules/openqomu.mdc` o `~/.cursor/rules/openqomu.mdc`; adapta
solo el frontmatter al formato de Cursor.

### Codex

En `~/.codex/config.toml`:

```toml
[mcp_servers.openqomu]
url = "{MCP_URL}"
bearer_token_env_var = "OPENQOMU_MCP_TOKEN"
```

También se puede declarar la cabecera explícitamente:

```toml
http_headers = { Authorization = "Bearer ${OPENQOMU_MCP_TOKEN}" }
```

Guarda la skill en `~/.agents/skills/openqomu/SKILL.md`:

```bash
mkdir -p ~/.agents/skills/openqomu
curl -fsSL {SKILL_URL} \
  -o ~/.agents/skills/openqomu/SKILL.md
```

`OPENQOMU_MCP_TOKEN` debe existir en el entorno desde el que arrancas Codex; expórtalo antes y
reinicia el cliente si no lo detecta.

### Gemini CLI

Instala la skill en `.gemini/skills/openqomu/SKILL.md` o añade una sección `## openQomu` en
`GEMINI.md`. Configura el servidor MCP remoto con la cabecera `Authorization`; si el harness
no admite cabeceras, usa el puente `mcp-remote`.

### Windsurf

Instala la skill en `.windsurf/rules/openqomu.md` o en
`~/.codeium/windsurf/memories/global_rules.md`. Configura el servidor MCP remoto con la
cabecera `Authorization`.

### Cline

Instala la skill en `.clinerules/openqomu.md` y configura el servidor MCP remoto con la cabecera
`Authorization`.

### Otros harnesses

Usa la configuración MCP del harness para un servidor HTTP remoto:

```json
{
  "mcpServers": {
    "openqomu": {
      "url": "{MCP_URL}",
      "headers": { "Authorization": "Bearer ${OPENQOMU_MCP_TOKEN}" }
    }
  }
}
```

Si el harness solo admite servidores stdio, usa un puente:

```bash
npx -y mcp-remote {MCP_URL} \
  --header "Authorization: Bearer $OPENQOMU_MCP_TOKEN"
```

### Verificación

1. Comprueba que `OPENQOMU_MCP_TOKEN` existe sin imprimir su valor (o que
   `~/.config/openqomu/token` existe con permisos `600`).
2. Reinicia el harness si es necesario.
3. Llama a `list_workspaces`; debe devolver espacios reales.
4. Llama a `list_boards` del primer espacio y a `list_tasks`.
5. Un `401` significa token ausente, inválido o revocado. Un `403` significa que falta
   `openqomu:read` o `openqomu:write`.
6. No consideres la instalación terminada hasta que `list_workspaces` responda correctamente.

## Conceptos

- **Espacio / workspace**: contenedor superior; por ejemplo, Qaly.
- **Tablero / board**: agrupa tareas dentro de un espacio.
- **Columna**: `todo`, `doing`, `review`, `done`. La columna con `isDone: true` es “hecho”.
- **Tarea**: título, descripción, prioridad, fecha límite, etiquetas, adjuntos, responsables y reviewer.
- **Responsables**: `assigneeIds`.
- **Responsable de revisión**: `reviewerId`.
- **Tareas relacionadas**: una tarea en `Dependientes` puede depender de varias. Pasa a `Por hacer` cuando todas estén hechas y no admite tareas completadas.
- **Prioridad `paused`**: “En pausa”. No cuenta como tarea abierta en el dashboard ni genera avisos de vencimiento.
- Al mover una tarea a una columna `isDone`, `reviewerId` se borra por diseño.
- Las tareas en `isDone` se eliminan definitivamente a los 15 días, con sus comentarios y adjuntos. No cuentes con tareas hechas antiguas.
- Comentarios y adjuntos se migran al mover una tarea entre tableros/espacios desde la UI.

## Reglas de oro

1. Resuelve siempre nombres a IDs antes de escribir: primero espacios, luego tableros, luego tareas.
2. No inventes IDs de espacio, tablero, columna, tarea o usuario.
3. No borres, transfieras ni cambies roles sin confirmación explícita.
4. Si falta información para crear una tarea, pregunta antes de inventarla.
5. Si una tool devuelve permiso denegado, explícalo; no intentes saltarte la autorización.
6. Prefiere `move_task` antes que borrar y recrear.
7. No pegues tokens ni secretos en el chat.
8. Resume en lenguaje natural. No devuelvas JSON crudo salvo que el usuario lo pida.

## Herramientas

### Lectura

- `list_workspaces`
- `get_workspace`
- `list_boards`
- `list_tasks`
- `get_task`
- `search_tasks`
- `list_members`
- `list_comments`

### Escritura

- `create_task`
- `update_task`
- `assign_reviewer`
- `move_task`
- `add_comment`
- `delete_task` (solo con confirmación explícita del usuario)

## Flujos

### Ver mis tareas pendientes

1. `list_workspaces`.
2. `list_boards` del espacio elegido.
3. `list_tasks` por tablero y filtra por `assigneeId` o `reviewerId`.
4. Resume por columna y prioridad.

### Crear una tarea

1. Confirma espacio, tablero y columna.
2. Pide título; prioridad, fecha, responsables y etiquetas son opcionales.
3. Comprueba que los responsables pertenecen al espacio con `list_members`.
4. Llama a `create_task`.
5. Devuelve el título, el tablero, la columna y el ID.

### Mover una tarea

1. Localiza la tarea con `list_tasks` o `search_tasks`.
2. Confirma el tablero y la columna de destino si hay ambigüedad.
3. Llama a `move_task`.
4. Si el destino es `done`, recuerda que el reviewer se limpia.

### Asignar revisión

1. Localiza la tarea y comprueba que no está completada.
2. Usa `list_members` para resolver el nombre a `uid`.
3. Llama a `assign_reviewer`.

### Pausar una tarea

1. Localiza la tarea.
2. Llama a `update_task` con `priority: "paused"`.
3. Recuerda que deja de contar como abierta en el dashboard.

### Comentar

1. Localiza la tarea.
2. Llama a `add_comment` con un cuerpo breve y útil.
3. No incluyas secretos ni datos personales innecesarios.

## Errores frecuentes

- **401**: token inválido, revocado o ausente. Pide al usuario que cree/revise el token.
- **403**: el usuario no pertenece al espacio o el token no tiene `openqomu:write`.
- **404**: el ID no existe o fue movido. Vuelve a listar antes de reintentar.
- **429**: demasiadas peticiones. Espera y reintenta más tarde.

## Formato de respuesta

- Usa listas cortas y agrupadas por tablero/columna.
- Incluye IDs solo cuando ayuden a una acción posterior.
- No muestres tokens, hashes ni service accounts.
