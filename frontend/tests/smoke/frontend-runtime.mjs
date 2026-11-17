import assert from 'node:assert/strict'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const baseURL = process.env.SMOKE_BASE_URL ?? 'http://tocaregalo-nginx'
const mode = process.env.SMOKE_MODE ?? 'static'
const browser = await chromium.launch({ headless: true })
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(baseURL)
    await page.getByRole('heading', { name: 'Toca Regalo', exact: true }).waitFor()
    assert.equal(await page.title(), 'Toca Regalo')
    assert.equal(await page.locator('html').getAttribute('lang'), 'es')
    if (mode === 'static') {
      assert.equal(await page.locator('script[src*="@vite/client"]').count(), 0)
      assert.equal(await page.locator('script[src^="/assets/"]').count(), 1)
    }
    await page.getByText('Estamos preparando la aplicación.').waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    // This proves Bootstrap CSS is present, rather than just listed in a manifest.
    assert.equal(await page.locator('main').evaluate((el) => getComputedStyle(el).getPropertyValue('--bs-gutter-x').trim()), '1.5rem')
    await page.screenshot({ path: `dist/t4-${mode}-${viewport.width}.png`, fullPage: true })
    await page.goto(`${baseURL}/missing-smoke-route`)
    await page.getByRole('heading', { name: 'Página no encontrada' }).waitFor()
    await page.reload()
    await page.getByRole('heading', { name: 'Página no encontrada' }).waitFor()
    await page.keyboard.press('Tab')
    assert.equal(await page.getByRole('link', { name: 'Volver al inicio' }).evaluate((el) => el === document.activeElement), true)
    await page.keyboard.press('Enter')
    await page.getByText('Estamos preparando la aplicación.').waitFor()
    for (const [path, status] of [['/api', 200], ['/api/not-found-smoke', 404], ['/api/docs', 404]]) {
      const result = await page.evaluate(async (path) => {
        const response = await fetch(path, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        return { status: response.status, type: response.headers.get('content-type'), data: await response.json() }
      }, path)
      assert.equal(result.status, status)
      assert.match(result.type, /json/)
      assert.equal(typeof result.data, 'object')
    }
    for (const path of ['/.env', '/.git/config', '/index.php', '/test.php/path']) {
      const response = await page.request.get(`${baseURL}${path}`)
      assert.ok([403, 404].includes(response.status()), `${path} must be protected`)
    }
    assert.deepEqual(errors, [])
    console.log(`${mode}: shell, Bootstrap, SPA refresh, keyboard, JSON API, private paths: ${viewport.width}x${viewport.height} passed`)
    await page.close()
  }
  if (mode === 'development') {
    const page = await browser.newPage()
    let hmrConnected = false
    page.on('websocket', (socket) => {
      if (new URL(socket.url()).host === new URL(baseURL).host) {
        socket.on('framereceived', (frame) => {
          if (String(frame.payload).includes('"type":"connected"')) hmrConnected = true
        })
      }
    })
    const source = new URL('../../src/views/PreparationView.vue', import.meta.url)
    const pending = new URL(`${source.href}.hmr-smoke`)
    const replaceSource = async (content) => {
      await writeFile(pending, content)
      await rename(pending, source)
    }
    const original = await readFile(source, 'utf8')
    const marker = 'Comprobación temporal de actualización.'
    try {
      await page.goto(baseURL)
      await page.getByText('Estamos preparando la aplicación.').waitFor()
      await page.waitForFunction(() => [...document.querySelectorAll('script')].some((el) => el.src.includes('@vite/client')))
      await page.evaluate(() => { window.__smokeDocument = 'preserved' })
      // Require the Vite connection through Nginx, not its direct-port fallback.
      await expect.poll(() => hmrConnected, { timeout: 15000 }).toBe(true)
      await replaceSource(original.replace('Estamos preparando la aplicación.', marker))
      await page.getByText(marker).waitFor({ timeout: 15000 })
      assert.equal(await page.evaluate(() => window.__smokeDocument), 'preserved')
    } finally {
      await replaceSource(original)
    }
    await page.getByText('Estamos preparando la aplicación.').waitFor()
    assert.equal(await page.evaluate(() => window.__smokeDocument), 'preserved')
    console.log('development: HMR update and restoration passed without document reload')
    await page.close()
  }
  console.log(`Chromium ${browser.version()}; ${mode} checks passed`)
} finally {
  await browser.close()
}
