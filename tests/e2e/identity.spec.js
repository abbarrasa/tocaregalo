const { test, expect } = require('../../frontend/node_modules/@playwright/test')
const fs = require('node:fs/promises')
const { randomUUID } = require('node:crypto')
test.skip(process.env.IDENTITY_E2E !== '1', 'Requires the guarded identity graph')
test.use({ trace: 'off', video: 'off', screenshot: 'off' })
const { initial, changed } = require('./identity-data')
async function privateFill(locator, value) {
  try { await locator.fill(value) } catch { throw new Error('Could not fill a synthetic credential field.') }
}
async function control(action) {
  const path = `${process.env.IDENTITY_CONTROL_DIR}/${randomUUID()}`
  await fs.writeFile(`${path}.request.json`, JSON.stringify({ action }), { mode: 0o600 })
  await expect.poll(async () => { try { return await fs.readFile(`${path}.response.json`, 'utf8') } catch { return 'waiting' } }, { timeout: 15000 }).toBe('ok')
  await fs.unlink(`${path}.response.json`)
}
async function login(page, identifier = 'ana@example.test', password = initial, phone = false) {
  await page.goto('/login')
  if (phone) await page.getByRole('radio', { name: 'Teléfono', exact: true }).check()
  await page.getByLabel(phone ? 'Número de teléfono' : 'Correo electrónico', { exact: true }).fill(identifier)
  await privateFill(page.getByLabel('Contraseña', { exact: true }), password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}
async function recover(page, request, identifier = 'ana@example.test') {
  await page.goto('/password-recovery')
  await page.getByLabel('Correo electrónico', { exact: true }).fill(identifier)
  await page.getByRole('button', { name: 'Enviar enlace' }).click()
  await expect(page.getByRole('status')).toContainText('Si existe una cuenta')
  let link
  await expect.poll(async () => {
    const response = await request.get('http://tocaregalo-mailpit:8025/api/v1/messages')
    const data = await response.json()
    for (const message of data.messages ?? []) {
      const detail = await (await request.get(`http://tocaregalo-mailpit:8025/api/v1/message/${message.ID}`)).json()
      const found = detail.Text?.match(/http:\/\/localhost\/password-reset#token=[A-Za-z0-9_-]{43}/)
      if (found) { link = found[0]; return true }
    }
    return false
  }, { timeout: 20000 }).toBe(true)
  return link
}
async function openLink(page, link) {
  try { await page.goto(link) } catch { throw new Error('Could not open the privately captured recovery link.') }
  // Do not pass the bearer-bearing URL to an assertion or reporter.
  await expect.poll(() => page.evaluate(() => location.hash === '' && !JSON.stringify(history.state).includes('token=')) ).toBe(true)
}
test.beforeEach(async ({ request }) => {
  await control('reset')
  await request.delete('http://tocaregalo-mailpit:8025/api/v1/messages')
})
test.afterEach(async ({ page }) => {
  if (!page.isClosed() && new URL(page.url()).protocol === 'http:') {
    const privateState = await page.evaluate(() => {
      const clean = localStorage.length === 0 && sessionStorage.length === 0
      document.querySelectorAll('input[type="password"]').forEach(input => { input.value = '' })
      return clean
    })
    expect(privateState).toBe(true)
  }
})
test('email/phone sessions, private navigation, logout and replay rejection', async ({ page, context, request }) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
  await login(page, 'ana@example.test', 'incorrect')
  await expect(page.getByRole('alert')).toContainText('no son correctos')
  await expect.poll(async () => (await page.getByLabel('Contraseña', { exact: true }).inputValue()) === '').toBe(true)
  await login(page)
  await expect(page.getByText('Hola, Ana.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Hola, Ana.')).toBeVisible()
  const cookies = await context.cookies()
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
  const cookie = cookies.map(c => `${c.name}=${c.value}`).join('; ')
  const replay = await request.get('/api/me', { headers: { Cookie: cookie } })
  expect(replay.status()).toBe(401)
  await login(page, '+34 (600)-123456', initial, true)
  await expect(page.getByText('Hola, Ana.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.keyboard.press('Tab')
})
test('network failure stays actionable and logout failure retains the active session', async ({ page }) => {
  await login(page)
  await expect(page.getByText('Hola, Ana.')).toBeVisible()
  await page.route('**/api/logout', route => route.abort('failed'))
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('No se pudo cerrar')
  await expect(page.getByText('Hola, Ana.')).toBeVisible()
  await page.unroute('**/api/logout')
  await page.route('**/api/me', route => route.abort('failed'))
  await page.reload()
  await expect(page.getByRole('button', { name: 'Volver a comprobar la sesión' })).toBeVisible()
  await page.unroute('**/api/me')
  await page.getByRole('button', { name: 'Volver a comprobar la sesión' }).click()
  await expect(page.getByText('Hola, Ana.')).toBeVisible()
})
test('captured reset link, password validation, exact password, reuse and old credential rejection', async ({ page, request }) => {
  const link = await recover(page, request)
  await openLink(page, link)
  await privateFill(page.getByLabel('Nueva contraseña', { exact: true }), 'short')
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByLabel('Nueva contraseña', { exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Guardar contraseña' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByLabel('Nueva contraseña', { exact: true })).toBeFocused()
  await privateFill(page.getByLabel('Nueva contraseña', { exact: true }), changed)
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByRole('status')).toContainText('Contraseña actualizada')
  await login(page)
  await expect(page.getByRole('alert')).toBeVisible()
  await login(page, 'ana@example.test', changed)
  await expect(page.getByText('Hola, Ana.')).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await openLink(page, link)
  await privateFill(page.getByLabel('Nueva contraseña', { exact: true }), changed)
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByRole('button', { name: 'Guardar contraseña' })).toHaveCount(0)
})
test('unknown, missing, expired and superseded recovery states and SUPER ADMIN', async ({ page, request }) => {
  await page.goto('/password-recovery')
  await page.getByLabel('Correo electrónico', { exact: true }).fill('unknown@example.test')
  await page.getByRole('button', { name: 'Enviar enlace' }).click()
  await expect(page.getByRole('status')).toContainText('Si existe una cuenta')
  await page.goto('/password-reset')
  await expect(page.getByRole('status')).toContainText('no es válido')
  const old = await recover(page, request)
  await request.delete('http://tocaregalo-mailpit:8025/api/v1/messages')
  const latest = await recover(page, request)
  await openLink(page, old)
  await privateFill(page.getByLabel('Nueva contraseña', { exact: true }), changed)
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByRole('button', { name: 'Guardar contraseña' })).toHaveCount(0)
  await control('expire')
  await openLink(page, latest)
  await privateFill(page.getByLabel('Nueva contraseña', { exact: true }), changed)
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByRole('button', { name: 'Guardar contraseña' })).toHaveCount(0)
  await login(page, 'super@example.test')
  await expect(page.getByText('Hola, Super.')).toBeVisible()
})
