import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const canonicalPath = path.join(root, 'skills/openqomu/SKILL.md')
const workerPath = path.join(root, 'mcp-worker/src/skill-content.ts')

const check = process.argv.includes('--check')

if (!existsSync(canonicalPath)) {
  console.error(`No existe la skill canónica: ${canonicalPath}`)
  process.exit(1)
}

const source = readFileSync(canonicalPath, 'utf8')

if (!source.endsWith('\n')) {
  console.error('La skill canónica debe terminar en salto de línea (estilo POSIX).')
  process.exit(1)
}

if (!source.startsWith('---\n')) {
  console.error('La skill canónica debe empezar por el frontmatter YAML (---).')
  process.exit(1)
}

const header = [
  '// Generado por scripts/sync-skill.mjs desde skills/openqomu/SKILL.md.',
  '// No editar a mano: ejecuta `npm run skill:sync` en la raíz del repo.',
  '',
  'export const SKILL_MARKDOWN = `',
].join('\n')

const body = source.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
const workerModule = `${header}${body}\`\n`

const targets = [{ path: workerPath, content: workerModule }]

const stale = []

for (const target of targets) {
  const current = existsSync(target.path) ? readFileSync(target.path, 'utf8') : null
  if (current === target.content) continue

  stale.push(path.relative(root, target.path))

  if (!check) {
    writeFileSync(target.path, target.content)
    console.log(`Actualizado ${path.relative(root, target.path)}`)
  }
}

if (check) {
  if (stale.length > 0) {
    console.error('Skill desincronizada. Ejecuta `npm run skill:sync` y vuelve a comprobar:')
    for (const file of stale) console.error(`  - ${file}`)
    process.exit(1)
  }
  console.log('Skill sincronizada.')
}
