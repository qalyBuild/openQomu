/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseCatalog } from './registry'

describe('catálogo público', () => {
  it('themes/index.json contiene solo temas válidos', () => {
    const raw: unknown = JSON.parse(readFileSync(resolve(process.cwd(), 'themes/index.json'), 'utf8'))
    expect(Array.isArray(raw)).toBe(true)
    const themes = parseCatalog(raw)
    expect(themes.length).toBe((raw as unknown[]).length)
    expect(themes.length).toBeGreaterThan(0)
  })
})
