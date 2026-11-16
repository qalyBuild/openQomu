import { chromium } from 'playwright-core'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const errors = []
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))

async function login(target = page) {
  await target.goto(BASE, { waitUntil: 'networkidle' })
  await target.getByRole('button', { name: /Entrar a la demo/i }).first().click()
  await target.waitForURL(/\/w\//, { timeout: 20000 })
  await target.waitForTimeout(1200)
  return new URL(target.url()).pathname.split('/')[2]
}

try {
  const workspaceId = await login()

  // --- Drag and drop ---
  await page.goto(`${BASE}/w/${workspaceId}/boards/b-producto`)
  await page.waitForTimeout(1000)
  const card = page.locator('[data-task-id="t-1"]')
  const targetColumn = page.locator('[data-column-id="doing"]')
  const cardBox = await card.boundingBox()
  const columnBox = await targetColumn.boundingBox()
  if (!cardBox || !columnBox) throw new Error('No se encontraron las cajas de drag & drop')
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(cardBox.x + cardBox.width / 2 + 30, cardBox.y + 40, { steps: 8 })
  await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + 140, { steps: 18 })
  await page.mouse.up()
  await page.waitForTimeout(900)
  const movedColumn = await page
    .locator('[data-task-id="t-1"]')
    .evaluate((element) => element.closest('[data-column-id]')?.getAttribute('data-column-id'))
  console.log('\n[drag] columna destino:', movedColumn)
  if (movedColumn !== 'doing') throw new Error(`La tarea no se movió (columna: ${movedColumn})`)
  await page.screenshot({ path: '/tmp/openqomu-11-drag.png' })

  // --- Edit task title ---
  await page.locator('[data-task-id="t-1"]').click()
  await page.waitForTimeout(500)
  const titleInput = page.locator('.task-title-input')
  await titleInput.fill('Definir el alcance de la beta (editada)')
  await titleInput.blur()
  await page.waitForTimeout(700)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const titleVisible = await page.getByText('Definir el alcance de la beta (editada)').first().isVisible()
  console.log('[task-edit] título persistido:', titleVisible)
  if (!titleVisible) throw new Error('El título editado no aparece en el tablero')

  // --- Create task ---
  await page.getByRole('button', { name: 'Nueva tarea' }).click()
  await page.waitForTimeout(400)
  await page.getByPlaceholder('¿Qué hay que hacer?').fill('Tarea creada por smoke test')
  await page.getByRole('button', { name: 'Crear tarea' }).click()
  await page.waitForTimeout(900)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const createdVisible = await page.getByText('Tarea creada por smoke test').first().isVisible()
  console.log('[task-create] visible:', createdVisible)
  if (!createdVisible) throw new Error('La tarea creada no aparece')

  // --- Channel settings ---
  await page.goto(`${BASE}/w/${workspaceId}/c/ch-general`)
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'Ajustes del canal' }).click()
  await page.waitForTimeout(500)
  await page.getByLabel('Descripción').fill('Descripción actualizada por smoke test')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await page.waitForTimeout(800)
  const channelDescription = await page
    .getByText('Descripción actualizada por smoke test')
    .first()
    .isVisible()
  console.log('[channel-settings] descripción actualizada:', channelDescription)
  if (!channelDescription) throw new Error('No se guardó la descripción del canal')

  // --- Private channel members ---
  await page.goto(`${BASE}/w/${workspaceId}/c/ch-lanzamiento`)
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'Ajustes del canal' }).click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /Bruno Vidal/i }).click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await page.waitForTimeout(800)
  const privateMembers = await page.evaluate(() => {
    const raw = localStorage.getItem('openqomu.demo.state.v1')
    if (!raw) return []
    const envelope = JSON.parse(raw)
    return envelope.state.channels['ch-lanzamiento']?.memberIds ?? []
  })
  console.log('[channel-private] memberIds:', privateMembers)
  if (!privateMembers.includes('u-bruno')) throw new Error('No se añadió a Bruno al canal privado')

  // --- Page autosave ---
  await page.goto(`${BASE}/w/${workspaceId}/pages/p-bienvenida`)
  await page.waitForTimeout(1000)
  const editor = page.locator('.ProseMirror')
  await editor.click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type(' Prueba de autosave de openQomu.')
  await page.waitForTimeout(1500)
  const saved = await page.getByText(/Guardado/).first().isVisible()
  console.log('[page-autosave] estado guardado:', saved)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const persisted = await page.getByText(/Prueba de autosave de openQomu/).first().isVisible()
  console.log('[page-autosave] persistió tras recarga:', persisted)
  if (!persisted) throw new Error('El contenido de la página no persistió')
  await page.screenshot({ path: '/tmp/openqomu-12-page-saved.png' })

  // --- Invite dialog ---
  await page.getByRole('button', { name: 'Invitar' }).first().click()
  await page.waitForTimeout(800)
  const inviteInput = page.locator('input[readonly]').first()
  const inviteLink = await inviteInput.inputValue()
  console.log('[invite] enlace:', inviteLink)
  if (!inviteLink.includes('/join/')) throw new Error('Enlace de invitación inválido')
  await page.screenshot({ path: '/tmp/openqomu-13-invite.png' })
  await page.keyboard.press('Escape')
  await page.goto(inviteLink)
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: /Unirme al espacio/i }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 10000 })
  console.log('[invite] join ok:', page.url())

  // --- Settings appearance ---
  await page.goto(`${BASE}/w/${workspaceId}/settings?tab=appearance`)
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: /Claro/i }).first().click()
  await page.waitForTimeout(500)
  const light = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  console.log('[theme] sigue oscuro tras elegir claro:', light)
  await page.screenshot({ path: '/tmp/openqomu-14-light.png' })
  await page.getByRole('button', { name: /Oscuro/i }).first().click()
  await page.waitForTimeout(300)

  // --- Mobile ---
  const mobile = await context.newPage()
  await mobile.setViewportSize({ width: 390, height: 844 })
  await mobile.goto(`${BASE}/w/${workspaceId}/dashboard`)
  await mobile.waitForTimeout(1100)
  const mobileWorkspace = workspaceId
  console.log('[mobile] dashboard:', mobile.url())
  await mobile.screenshot({ path: '/tmp/openqomu-15-mobile-dashboard.png' })
  await mobile.getByRole('button', { name: 'Abrir navegación' }).click()
  await mobile.waitForTimeout(600)
  await mobile.screenshot({ path: '/tmp/openqomu-16-mobile-nav.png' })
  await mobile.goto(`${BASE}/w/${mobileWorkspace}/boards/b-producto`)
  await mobile.waitForTimeout(900)
  await mobile.screenshot({ path: '/tmp/openqomu-17-mobile-board.png' })

  console.log('\nERRORES DE CONSOLA:', errors.length ? errors : 'ninguno')
} catch (error) {
  console.error('\nINTERACTIONS FAILED:', error)
  await page.screenshot({ path: '/tmp/openqomu-interactions-failure.png' })
  console.log('ERRORES:', errors)
  process.exitCode = 1
} finally {
  await browser.close()
}
