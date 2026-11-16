import { chromium } from 'playwright-core'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173'
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome-stable'

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))

function log(step, value = '') {
  console.log(`\n[${step}] ${value}`)
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  log('landing', await page.title())
  await page.screenshot({ path: '/tmp/openqomu-01-landing.png' })

  await page.getByRole('button', { name: /Entrar a la demo/i }).first().click()
  await page.waitForURL(/\/w\//, { timeout: 20000 })
  await page.waitForTimeout(1800)
  const workspaceId = new URL(page.url()).pathname.split('/')[2]
  log('dashboard', page.url())
  log('dashboard-heading', await page.locator('h1').first().innerText())
  await page.screenshot({ path: '/tmp/openqomu-02-dashboard.png' })

  // Chat
  await page.goto(`${BASE}/w/${workspaceId}/c/ch-general`)
  await page.waitForTimeout(1200)
  await page.getByText(/Buenos días/i).first().waitFor({ timeout: 10000 })
  log('chat-messages', await page.locator('.chat-message').count())
  const composer = page.getByPlaceholder('Escribe un mensaje…')
  await composer.fill('Mensaje enviado desde la prueba automática ✅')
  await composer.press('Enter')
  await page.getByText('Mensaje enviado desde la prueba automática').first().waitFor({ timeout: 10000 })
  log('chat-send', 'ok')
  await page.screenshot({ path: '/tmp/openqomu-03-chat.png' })

  // Kanban
  await page.goto(`${BASE}/w/${workspaceId}/boards/b-producto`)
  await page.waitForTimeout(1000)
  await page.getByText('Definir el alcance de la beta').first().click()
  await page.waitForTimeout(700)
  log('task-detail', await page.getByText(/Comentarios \(/).first().innerText())
  await page.screenshot({ path: '/tmp/openqomu-04-task.png' })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.screenshot({ path: '/tmp/openqomu-05-board.png' })

  // Pages
  await page.goto(`${BASE}/w/${workspaceId}/pages/p-bienvenida`)
  await page.waitForTimeout(1200)
  log('page-editor', await page.getByText('Un espacio, todo el contexto').first().isVisible())
  await page.screenshot({ path: '/tmp/openqomu-06-page.png' })

  // Files
  await page.goto(`${BASE}/w/${workspaceId}/files`)
  await page.waitForTimeout(900)
  const fileInput = page.locator('input[type="file"]').first()
  await fileInput.setInputFiles({
    name: 'prueba-smoke.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Contenido de prueba de openQomu'),
  })
  await page.getByText('prueba-smoke.txt').first().waitFor({ timeout: 10000 })
  log('files-upload', 'ok')
  await page.screenshot({ path: '/tmp/openqomu-07-files.png' })

  // Members
  await page.goto(`${BASE}/w/${workspaceId}/members`)
  await page.waitForTimeout(900)
  log('members', await page.getByText('Alex Rivera').first().isVisible())
  await page.screenshot({ path: '/tmp/openqomu-08-members.png' })

  // Global search
  await page.keyboard.press('Control+K')
  await page.waitForTimeout(500)
  const search = page.getByPlaceholder(/Busca canales/i)
  await search.fill('Roadmap')
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/openqomu-09-search.png' })
  await page.getByRole('option', { name: /Roadmap Q4/i }).first().click()
  await page.waitForURL(/\/pages\/p-roadmap/, { timeout: 10000 })
  log('search-navigate', page.url())

  // Settings
  await page.goto(`${BASE}/w/${workspaceId}/settings?tab=appearance`)
  await page.waitForTimeout(700)
  log('settings', await page.getByText('Apariencia').first().isVisible())
  await page.screenshot({ path: '/tmp/openqomu-10-settings.png' })

  console.log('\nERRORES DE CONSOLA:', errors.length ? errors : 'ninguno')
} catch (error) {
  console.error('\nSMOKE FAILED:', error)
  await page.screenshot({ path: '/tmp/openqomu-failure.png' })
  console.log('ERRORES DE CONSOLA:', errors)
  process.exitCode = 1
} finally {
  await browser.close()
}
