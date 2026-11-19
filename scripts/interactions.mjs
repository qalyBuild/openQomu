import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { chromium, webkit } from 'playwright-core'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173'
const systemChrome = '/usr/bin/google-chrome-stable'
const browser = await chromium.launch({
  executablePath: existsSync(systemChrome) ? systemChrome : undefined,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
page.setDefaultTimeout(15000)
const errors = []
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))

async function login(target = page) {
  await target.goto(`${BASE}/?demo=1`)
  await target.waitForURL(/\/w\//, { timeout: 20000 })
  return new URL(target.url()).pathname.split('/')[2]
}

try {
  const workspaceId = await login()
  if (process.argv.includes('--file-reads')) {
    await checkFileReads(workspaceId)
  } else {
    await checkThemes(workspaceId)
    if (!process.argv.includes('--themes')) await checkInteractions(workspaceId)
  }
  if (errors.some((error) => error.startsWith('pageerror:'))) throw new Error(errors.join('\n'))
  console.log('\nERRORES DE CONSOLA:', errors.length ? errors : 'ninguno')
} catch (error) {
  console.error('\nINTERACTIONS FAILED:', error)
  await page.screenshot({ path: '/tmp/openqomu-interactions-failure.png' })
  console.log('ERRORES:', errors)
  process.exitCode = 1
} finally {
  await browser.close()
}

async function checkThemes(workspaceId) {
  // --- Apertura de tareas con temas ---
  const boardUrl = `${BASE}/w/${workspaceId}/boards/b-producto`
  const themedCard = page.locator('[data-task-id="t-1"]')
  const detail = page.getByRole('dialog', { name: 'Detalle de la tarea' })
  const verifyDetail = async (target) => {
    const sheet = target.getByRole('dialog', { name: 'Detalle de la tarea' })
    await sheet.locator('.task-title-input').waitFor()
    assert.equal(await sheet.evaluate((element) => getComputedStyle(element).position), 'fixed')
    assert.match(await sheet.locator('.task-title-input').inputValue(), /alcance de la beta/i)
  }

  await page.evaluate(() => {
    localStorage.setItem('openqomu.themes.installed', JSON.stringify([{
      id: 'prueba-personalizada', name: 'Prueba personalizada', scheme: 'light',
      version: 1, author: 'Pruebas', license: 'AGPL-3.0', tokens: { background: '#fff', foreground: '#123', primary: '#284f7a' },
    }]))
  })
  async function applyTheme(target, id) {
    const workspace = new URL(target.url()).pathname.split('/')[2]
    await target.goto(`${BASE}/w/${workspace}/themes`)
    const card = target.locator(`[data-theme-id="${id}"]`).first()
    const button = card.getByRole('button', { name: 'Aplicar', exact: true })
    await button.click()
    await target.waitForFunction((value) => document.documentElement.dataset.theme === value, id)
  }
  for (const id of ['liquid-glass-light', 'liquid-glass-dark', 'qomu-light', 'prueba-personalizada', 'qomu-dark']) {
    await applyTheme(page, id)
    if (id === 'liquid-glass-dark') await verifyDashboardGlass(workspaceId)
    await page.goto(boardUrl)
    await page.waitForFunction((value) => document.documentElement.dataset.theme === value, id)
    await themedCard.click()
    await verifyDetail(page)
    await page.keyboard.press('Escape')
    await detail.waitFor({ state: 'hidden' })
    await themedCard.press('Enter')
    await verifyDetail(page)
    await page.keyboard.press('Escape')
    await detail.waitFor({ state: 'hidden' })
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-task-id') === 't-1')

    await page.goto(`${boardUrl}?task=t-1`)
    await verifyDetail(page)
    if (id === 'liquid-glass-light') {
      await detail.locator('.task-title-input').waitFor()
      await page.locator('[data-slot="sheet-content"][data-glass-refraction="live"]').waitFor()
      await page.keyboard.press('Escape')
      await detail.waitFor({ state: 'hidden' })
      await verifyColumnGlass()
      await verifyLiveRefraction()
    }
    console.log('[themes]', id)
  }

  const webkitBrowser = process.argv.includes('--webkit') ? await webkit.launch() : null
  const touch = await (webkitBrowser ?? browser).newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
  })
  try {
    const phone = await touch.newPage()
    phone.setDefaultTimeout(15000)
    const phoneWorkspace = await login(phone)
    await applyTheme(phone, 'liquid-glass-light')
    await phone.goto(`${BASE}/w/${phoneWorkspace}/boards/b-producto`)
    await phone.locator('[data-task-id="t-1"]').tap()
    await verifyDetail(phone)
    if (webkitBrowser) {
      assert.equal(await phone.locator('[data-slot="sheet-content"][data-glass-refraction]').count(), 0)
    } else {
      await phone.locator('[data-slot="sheet-content"][data-glass-refraction="live"]').waitFor()
    }
    const surface = phone.getByRole('dialog', { name: 'Detalle de la tarea' })
    assert.match(await surface.evaluate((element) => {
      const style = getComputedStyle(element)
      return style.backdropFilter || style.webkitBackdropFilter
    }), /blur/)
    await phone.getByRole('button', { name: 'Cerrar', exact: true }).tap()
    await surface.waitFor({ state: 'hidden' })

    if (!webkitBrowser) {
      const cdp = await touch.newCDPSession(phone)
      await cdp.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
      })
      await phone.locator('[data-task-id="t-1"]').tap()
      await verifyDetail(phone)
      assert.equal(await phone.locator('.glass-backdrop').isVisible(), false)
    }
  } finally {
    await touch.close()
    await webkitBrowser?.close()
  }
  console.log('[themes] tareas accesibles con ratón, teclado, enlace y toque')

}

async function verifyDashboardGlass(workspaceId) {
  await page.goto(`${BASE}/w/${workspaceId}/dashboard`)
  const dashboard = page.locator('[data-glass-dashboard]')
  const panel = dashboard.locator('[data-glass-refraction="live"]').filter({ hasText: 'Ritmo del equipo' })
  await panel.waitFor()
  await dashboard.locator('[data-glass-refraction="live"]').filter({ hasText: 'Esperando revisión' }).waitFor()
  await page.evaluate(async () => {
    const shell = document.querySelector('[data-slot="app-shell"]')
    const url = getComputedStyle(shell).backgroundImage.match(/url\("([^"]+)"\)/)?.[1]
    if (!url) throw new Error('Falta el fondo del tema Liquid Glass')
    const wallpaper = new Image()
    wallpaper.src = url
    await wallpaper.decode()
  })

  const refracted = (await panel.screenshot({ animations: 'disabled' })).toString('base64')
  await panel.evaluate((element) => {
    const filter = getComputedStyle(element).backdropFilter.replace(/url\([^)]+\)\s*/, '')
    element.style.backdropFilter = filter
  })
  try {
    const control = (await panel.screenshot({ animations: 'disabled' })).toString('base64')
    const changed = await page.evaluate(async ([before, after]) => {
      async function rimPixels(data) {
        const image = new Image()
        image.src = `data:image/png;base64,${data}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0)
        const left = context.getImageData(5, 25, 9, canvas.height - 50)
        const right = context.getImageData(canvas.width - 14, 25, 9, canvas.height - 50)
        return [left.data, right.data]
      }
      const [refracted, control] = await Promise.all([rimPixels(before), rimPixels(after)])
      let changed = 0
      for (const [edge, pixels] of refracted.entries()) {
        for (let i = 0; i < pixels.length; i += 4) {
          const original = control[edge]
          if ([0, 1, 2].some((offset) => Math.abs(pixels[i + offset] - original[i + offset]) > 12)) changed++
        }
      }
      return changed
    }, [refracted, control])
    assert.ok(changed > 100, `El fondo del resumen no se deforma: ${changed} píxeles`)
    console.log('[glass] tarjetones y gráficos del resumen refractan el fondo real')
  } finally {
    await panel.evaluate((element) => element.style.removeProperty('backdrop-filter'))
  }
}

async function verifyColumnGlass() {
  const header = page.locator('[data-column-id="todo"] [data-glass-chrome="column"]')
  await header.locator('button').first().waitFor()
  await header.hover()
  await page.waitForFunction(() => {
    const element = document.querySelector('[data-column-id="todo"] [data-glass-chrome="column"]')
    return Boolean(element?.style.getPropertyValue('--glass-light-x'))
  })
  const viewport = page.viewportSize()
  await page.setViewportSize({ ...viewport, height: 560 })
  const geometry = await header.evaluate((element) => {
    const list = element.parentElement
    const card = list.querySelector('[data-task-id="t-1"]')
    list.scrollTop = 65
    const lens = element.getBoundingClientRect()
    const task = card.getBoundingClientRect()
    const scrollTop = list.scrollTop
    list.scrollTop = 0
    return { overlaps: task.top < lens.bottom && task.bottom > lens.top, scrollTop, sticky: getComputedStyle(element).position }
  })
  await page.setViewportSize(viewport)
  assert.equal(geometry.scrollTop, 65, 'La columna debe desplazarse dentro del tablero')
  assert.equal(geometry.sticky, 'sticky')
  assert.ok(geometry.overlaps, 'La tarjeta debe desplazarse por debajo de la cabecera')
}

async function verifyLiveRefraction() {
  await page.evaluate(() => {
    const stage = document.createElement('div')
    stage.id = 'glass-optics-test'
    stage.style.cssText = 'position:fixed;top:10px;left:10px;width:256px;height:144px;z-index:10000'
    stage.style.background = 'repeating-linear-gradient(90deg, #00f 0 7px, #ff0 7px 14px)'
    const lens = document.createElement('div')
    lens.dataset.glassSurface = 'overlay'
    lens.style.cssText = 'position:absolute;inset:20px 38px;border-radius:24px;--glass-blur:0px'
    lens.style.setProperty('background', 'transparent', 'important')
    lens.style.setProperty('box-shadow', 'none', 'important')
    stage.append(lens)
    document.body.append(stage)
  })
  const stage = page.locator('#glass-optics-test')
  const lens = stage.locator('[data-glass-refraction="live"]')
  try {
    await lens.waitFor()
    const refracted = (await stage.screenshot()).toString('base64')
    await lens.evaluate((element) => element.style.setProperty('backdrop-filter', 'none', 'important'))
    const control = (await stage.screenshot()).toString('base64')
    const displacedPixels = await page.evaluate(async ([before, after]) => {
      async function pixels(data) {
        const image = new Image()
        image.src = `data:image/png;base64,${data}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0)
        return context.getImageData(43, 47, 18, 50).data
      }
      const [refracted, control] = await Promise.all([pixels(before), pixels(after)])
      let changed = 0
      for (let i = 0; i < refracted.length; i += 4) {
        if (Math.abs(refracted[i] - control[i]) > 100) changed++
      }
      return changed
    }, [refracted, control])
    assert.ok(displacedPixels > 200, `Falta desplazamiento en el borde: ${displacedPixels} píxeles`)
    console.log('[glass] el filtro desplaza el contenido real detrás del borde')
  } finally {
    await stage.evaluate((element) => element.remove())
  }
}

async function checkInteractions(workspaceId) {
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
    const raw = localStorage.getItem('openqomu.demo.state.v2')
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

}

async function checkFileReads(workspaceId) {
  const dashboard = `${BASE}/w/${workspaceId}/dashboard`
  const files = `${BASE}/w/${workspaceId}/files`
  const otherDevice = await context.newPage()
  otherDevice.setDefaultTimeout(15000)
  await otherDevice.goto(dashboard)

  async function addDemoFiles(count) {
    await page.evaluate(({ workspaceId, count }) => {
      const stateKey = 'openqomu.demo.state.v2'
      const demo = JSON.parse(localStorage.getItem(stateKey))
      const sample = Object.values(demo.state.files)[0]
      const through = Math.max(Date.now(), ...Object.values(demo.state.files).map(
        (file) => Date.parse(file.createdAt) + 1,
      ))
      for (let index = 0; index < count; index += 1) {
        const id = `file-test-${through}-${index}`
        demo.state.files[id] = {
          ...sample, id, workspaceId, name: `Prueba ${id}.txt`, folderId: null,
          uploadedBy: 'u-ana', trashedAt: null, createdAt: new Date(through).toISOString(),
        }
      }
      localStorage.setItem(stateKey, JSON.stringify(demo))
    }, { workspaceId, count })
    await page.reload()
  }

  await addDemoFiles(105)
  const fileBadge = otherDevice.getByRole('status', { name: /avisos en Archivos/ })
  await fileBadge.waitFor()
  assert.equal(await fileBadge.textContent(), '99+')
  await page.bringToFront()
  await page.goto(files)
  await fileBadge.waitFor({ state: 'hidden' })
  await otherDevice.reload()
  await otherDevice.getByRole('link', { name: 'Archivos', exact: true }).waitFor()
  assert.equal(await fileBadge.count(), 0)

  await page.goto(dashboard)
  await addDemoFiles(1)
  await fileBadge.waitFor()
  assert.equal(await fileBadge.textContent(), '1')
  console.log('[file-reads] 99+ → 0 en otra sesión, persiste tras recarga y un archivo nuevo vuelve a sumar')
}
