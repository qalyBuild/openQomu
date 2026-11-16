import { describe, expect, it } from 'vitest'
import {
  buildStoragePath,
  extensionOf,
  fileKindLabel,
  formatBytes,
  isImageFile,
  isMarkdownFile,
  isPdfFile,
  MAX_FILE_SIZE,
  sanitizeFileName,
  validateUpload,
} from './file-service'

describe('file-service', () => {
  it('sanea nombres y rutas', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd')
    expect(sanitizeFileName('mi foto <final>.png')).toBe('mi foto final.png')
    expect(sanitizeFileName('   ')).toBe('archivo')
    expect(extensionOf('Informe.PDF')).toBe('pdf')
    expect(extensionOf('sin-extension')).toBe('')
    expect(buildStoragePath('ws1', 'f1', 'Diseño final.png')).toBe(
      'workspaces/ws1/f1-Diseño final.png',
    )
  })

  it('valida tamaño, vacío y ejecutables', () => {
    expect(() => validateUpload({ name: 'ok.png', size: 1024 })).not.toThrow()
    expect(() => validateUpload({ name: 'ok.png', size: 0 })).toThrow('vacío')
    expect(() => validateUpload({ name: 'grande.zip', size: MAX_FILE_SIZE + 1 })).toThrow('25 MB')
    expect(() => validateUpload({ name: 'malware.exe', size: 100 })).toThrow('ejecutables')
    expect(() => validateUpload({ name: '.', size: 100 })).not.toThrow()
  })

  it('formatea tamaños', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB')
  })

  it('detecta imágenes y PDFs', () => {
    expect(isImageFile({ name: 'foto.png' })).toBe(true)
    expect(isImageFile({ name: 'foto.bin', contentType: 'image/webp' })).toBe(true)
    expect(isImageFile({ name: 'doc.pdf', contentType: 'application/pdf' })).toBe(false)
    expect(isPdfFile({ name: 'doc.PDF' })).toBe(true)
    expect(isMarkdownFile({ name: 'guia.md' })).toBe(true)
    expect(isMarkdownFile({ name: 'notas.markdown' })).toBe(true)
    expect(isMarkdownFile({ name: 'notas.txt' })).toBe(false)
    expect(fileKindLabel({ name: 'hoja.xlsx' })).toBe('XLSX')
    expect(fileKindLabel({ name: 'x', contentType: 'application/pdf' })).toBe('PDF')
  })
})
