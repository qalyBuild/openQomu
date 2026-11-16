#!/usr/bin/env node
// Falla si el árbol contiene valores del despliegue privado del autor.
// Se ejecuta en CI y antes de publicar una release.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

// Patrones que nunca deben aparecer en el repositorio público.
const forbidden = [
  { pattern: /carlos09102007\.workers\.dev/g, label: 'Worker del despliegue privado' },
  { pattern: /qomu-app\.(web\.app|firebaseapp\.com)/g, label: 'dominio del despliegue privado' },
  { pattern: /qomu-files-[0-9a-f]{12}/g, label: 'bucket privado' },
  { pattern: /Yjl5JsJdKxSJau[a-z0-9]+/gi, label: 'uid de usuario real' },
  { pattern: /service_account["']?\s*:\s*["']?-----BEGIN/g, label: 'clave de service account' },
  { pattern: /AKIA[0-9A-Z]{16}/g, label: 'clave de acceso AWS' },
  { pattern: /(?:[0-9A-F]{2}:){31}[0-9A-F]{2}/g, label: 'huella de certificado de firma' },
]

const skip = new Set([
  '.git',
  '.opencode',
  'node_modules',
  'graphify-out',
  'dist',
  'dist-mobile',
  'coverage',
  'scripts/check-no-private-values.mjs',
])
const binary = /\.(png|jpg|jpeg|gif|webp|avif|ico|apk|jar|zip|keystore|jks|woff2?|ttf)$/i

const hits = []
for (const entry of readdirSync(root)) {
  if (skip.has(entry)) continue
  walk(join(root, entry))
}

function walk(path) {
  const rel = relative(root, path)
  if (skip.has(rel) || skip.has(rel.split('/')[0])) return
  const info = statSync(path)
  if (info.isDirectory()) {
    if (skip.has(relative(root, path).split('/')[0])) return
    for (const child of readdirSync(path)) walk(join(path, child))
    return
  }
  if (binary.test(path)) return
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return
  }
  for (const { pattern, label } of forbidden) {
    if (pattern.test(text)) {
      hits.push(`${relative(root, path)}: ${label}`)
      break
    }
  }
}

if (hits.length > 0) {
  console.error('Hay valores privados en el árbol. Elimínalos antes de publicar:')
  for (const hit of hits) console.error(`  - ${hit}`)
  process.exit(1)
}

console.log('Sin valores privados en el árbol.')
