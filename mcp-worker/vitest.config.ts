import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const cloudflareWorkersStub = fileURLToPath(new URL('./src/test-cloudflare-workers.ts', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      // Vitest no ejecuta en workerd: `cloudflare:workers` se sustituye por un stub vacío.
      'cloudflare:workers': cloudflareWorkersStub,
    },
  },
})
