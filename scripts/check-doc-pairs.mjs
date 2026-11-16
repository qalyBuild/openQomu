#!/usr/bin/env node
// Comprueba que cada documento de usuario tiene su pareja en el otro idioma.
// Convención: `x.md` (inglés) y `x.es.md` (español).
// Alcance: los Markdown de la raíz y de docs/, salvo docs/adr y archivos exentos.
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const exempt = new Set(['CHANGELOG.md', 'NOTICE'])
const files = []

for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.md') && !exempt.has(entry.name)) {
    files.push(join(root, entry.name))
  }
}

function walkDocs(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'adr') walkDocs(full)
    } else if (entry.name.endsWith('.md')) {
      files.push(full)
    }
  }
}

walkDocs(join(root, 'docs'))

const missing = []
for (const file of files) {
  const name = relative(root, file)
  if (name.endsWith('.es.md')) {
    if (!existsSync(file.slice(0, -'.es.md'.length) + '.md')) {
      missing.push(`${name} no tiene pareja en inglés`)
    }
    continue
  }
  if (!existsSync(file.slice(0, -'.md'.length) + '.es.md')) {
    missing.push(`${name} no tiene pareja en español`)
  }
}

if (missing.length > 0) {
  console.error('Documentos sin pareja de idioma:')
  for (const item of missing) console.error(`  - ${item}`)
  process.exit(1)
}

console.log(`Parejas de idioma correctas (${files.length} documentos).`)
