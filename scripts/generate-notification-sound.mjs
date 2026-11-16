#!/usr/bin/env node
// Genera el sonido de notificación nativa de Android (WAV mono 16 bits).
// Uso: node scripts/generate-notification-sound.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const output = path.join(root, 'android/app/src/main/res/raw/openqomu_notification.wav')

const SAMPLE_RATE = 22050
const DURATION = 0.5
const samples = Math.round(SAMPLE_RATE * DURATION)
const data = Buffer.alloc(samples * 2)

for (let index = 0; index < samples; index += 1) {
  const t = index / SAMPLE_RATE
  // Dos notas cortas (sol5 y do6) con caída exponencial.
  const note = t < 0.18 ? 784 : 1047
  const decay = Math.exp(-6 * (t % 0.22))
  const envelope = Math.min(1, t * 80) * decay
  const value = Math.sin(2 * Math.PI * note * t) * envelope * 0.55
  data.writeInt16LE(Math.round(value * 32767), index * 2)
}

const header = Buffer.alloc(44)
header.write('RIFF', 0)
header.writeUInt32LE(36 + data.length, 4)
header.write('WAVE', 8)
header.write('fmt ', 12)
header.writeUInt32LE(16, 16)
header.writeUInt16LE(1, 20)
header.writeUInt16LE(1, 22)
header.writeUInt32LE(SAMPLE_RATE, 24)
header.writeUInt32LE(SAMPLE_RATE * 2, 28)
header.writeUInt16LE(2, 32)
header.writeUInt16LE(16, 34)
header.write('data', 36)
header.writeUInt32LE(data.length, 40)

mkdirSync(path.dirname(output), { recursive: true })
writeFileSync(output, Buffer.concat([header, data]))
console.log(`Sonido generado: ${path.relative(root, output)} (${(header.length + data.length) / 1024} KB)`)
