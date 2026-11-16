#!/usr/bin/env node
// Crea `.env.local` a partir de `.env.example` y valida la configuración.
// Uso: npm run setup
import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const example = join(root, '.env.example')
const local = join(root, '.env.local')

if (!existsSync(local)) {
  copyFileSync(example, local)
  console.log('Creado .env.local. Rellena solo las variables de los servicios que uses.')
}

function readEnv(path) {
  const values = new Map()
  if (!existsSync(path)) return values
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (match) values.set(match[1], match[2].trim())
  }
  return values
}

const env = readEnv(local)
const firebaseKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]
const filled = firebaseKeys.filter((key) => env.get(key))
const errors = []
const warnings = []

if (filled.length > 0 && filled.length < firebaseKeys.length) {
  errors.push(`Firebase está a medias: faltan ${firebaseKeys.filter((key) => !env.get(key)).join(', ')}.`)
}

if (env.get('VITE_FILE_STORAGE') === 's3' && !env.get('VITE_FILES_URL')) {
  errors.push('VITE_FILE_STORAGE=s3 necesita VITE_FILES_URL con la URL del Worker de archivos.')
}

if (env.get('VITE_FILES_URL') && !/^https?:\/\//.test(env.get('VITE_FILES_URL'))) {
  errors.push('VITE_FILES_URL debe ser una URL absoluta (http:// o https://).')
}

if (env.get('VITE_MCP_URL') && !/\/mcp\/?$/.test(env.get('VITE_MCP_URL'))) {
  warnings.push('VITE_MCP_URL suele terminar en /mcp.')
}

if (!env.get('VITE_FIREBASE_PROJECT_ID') && env.get('VITE_DEMO_MODE') !== 'true') {
  warnings.push('Sin Firebase la app arranca en modo local: los datos solo viven en este navegador.')
}

const mode = filled.length === firebaseKeys.length ? 'Firebase' : 'local'
console.log(`Modo detectado: ${mode}.`)
for (const warning of warnings) console.warn(`Aviso: ${warning}`)
for (const error of errors) console.error(`Error: ${error}`)
process.exit(errors.length > 0 ? 1 : 0)
