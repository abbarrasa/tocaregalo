const { test, expect } = require('../../frontend/node_modules/@playwright/test')

test('Spanish shell, responsive Bootstrap and keyboard navigation', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Toca Regalo')
  await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  await expect(page.getByRole('heading', { name: 'Toca Regalo', exact: true })).toBeVisible()
  expect(await page.locator('main').evaluate((el) => getComputedStyle(el).getPropertyValue('--bs-gutter-x').trim())).toBe('1.5rem')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.goto('/missing-harness-route')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Volver al inicio' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Estamos preparando la aplicación.')).toBeVisible()
})

test('same-origin API returns JSON and private paths stay protected', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Toca Regalo', exact: true })).toBeVisible()
  for (const accept of ['application/json', 'text/html']) {
    for (const [path, status] of [['/api', 200], ['/api/not-found-harness', 404], ['/api/docs', 404]]) {
      const result = await page.evaluate(async ({ path, accept }) => {
        const response = await fetch(path, { credentials: 'same-origin', headers: { Accept: accept } })
        return { status: response.status, type: response.headers.get('content-type'), data: await response.json() }
      }, { path, accept })
      expect(result.status).toBe(status)
      expect(result.type).toContain('json')
      expect(result.data).toBeInstanceOf(Object)
    }
  }
  for (const path of ['/.env', '/.git/config', '/index.php', '/test.php/path']) {
    const response = await page.request.get(path)
    expect([403, 404]).toContain(response.status())
  }
})
