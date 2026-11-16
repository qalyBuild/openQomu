import { describe, expect, it } from 'vitest'
import {
  buildInstallSkillPrompt,
  PRODUCT_APP_URL,
  MCP_TOKEN_ENV,
} from './install-skill-prompt'

const MCP_URL = 'https://mcp.example.com/mcp'

describe('buildInstallSkillPrompt', () => {
  const prompt = buildInstallSkillPrompt({ mcpUrl: MCP_URL, workspaceId: 'demo-space' })

  it('incluye la app, el endpoint, el token y los ajustes', () => {
    expect(prompt).toContain(PRODUCT_APP_URL)
    expect(prompt).toContain(MCP_URL)
    expect(prompt).toContain(MCP_TOKEN_ENV)
    expect(prompt).toContain('Authorization: Bearer')
    expect(prompt).toContain(`${PRODUCT_APP_URL}/w/demo-space/settings?tab=ai`)
  })

  it('pide detectar el harness y cubre los principales', () => {
    expect(prompt).toContain('Detecta el harness')
    for (const harness of ['Claude Code', 'OpenCode', 'Cursor', 'Codex', 'Gemini CLI', 'Cline']) {
      expect(prompt).toContain(harness)
    }
    expect(prompt).toContain('skills/openqomu/SKILL.md')
    expect(prompt).toContain('.opencode/skills/openqomu/SKILL.md')
    expect(prompt).toContain('.cursor/rules/openqomu.mdc')
    expect(prompt).toContain('~/.agents/skills/openqomu/SKILL.md')
    expect(prompt).toContain('frontmatter')
  })

  it('incluye la configuración MCP y la verificación', () => {
    expect(prompt).toContain('"mcpServers"')
    expect(prompt).toContain('oauth')
    expect(prompt).toContain('mcp-remote')
    expect(prompt).toContain('{file:~/.config/openqomu/token}')
    expect(prompt).toContain('list_workspaces')
    expect(prompt).toContain('list_boards')
  })

  it('incrusta el contenido completo de la skill', () => {
    expect(prompt).toContain('name: openQomu')
    expect(prompt).toContain('## Herramientas')
    expect(prompt).toContain('## Instalación por harness')
    expect(prompt).toContain('openqomu:read')
    expect(prompt).toContain('openqomu:write')
    expect(prompt).toContain('<<<SKILL_INICIO>>>')
    expect(prompt).toContain('<<<SKILL_FIN>>>')
  })

  it('mantiene la compatibilidad con instalaciones existentes', () => {
    expect(prompt).toContain('Si ya tienes openQomu MCP funcionando')
    expect(prompt).toContain('no cambies la URL ni el token')
  })

  it('nunca incluye un token real', () => {
    expect(prompt).not.toMatch(/openqomu_mcp_[A-Za-z0-9_-]{20,}/)
  })

  it('permite personalizar la app, el espacio y la skill', () => {
    const custom = buildInstallSkillPrompt({
      mcpUrl: 'https://mcp.example/mcp',
      appUrl: 'https://app.example',
      workspaceId: 'ws-1',
      skill: '# Skill de prueba',
    })
    expect(custom).toContain('https://mcp.example/mcp')
    expect(custom).toContain('https://app.example')
    expect(custom).toContain('https://app.example/w/ws-1/settings?tab=ai')
    expect(custom).toContain('# Skill de prueba')
  })
})
