const { defineConfig } = require('./frontend/node_modules/@playwright/test')

module.exports = defineConfig({
  testDir: './tests/e2e',
  outputDir: './frontend/test-results',
  forbidOnly: true,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://tocaregalo-nginx' },
  projects: [
    { name: 'chromium-desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    { name: 'chromium-mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 } } },
    { name: 'firefox-desktop', use: { browserName: 'firefox', viewport: { width: 1440, height: 900 } } },
    { name: 'webkit-desktop', use: { browserName: 'webkit', viewport: { width: 1440, height: 900 } } },
  ],
})
