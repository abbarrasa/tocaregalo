const { test } = require('node:test')
const assert = require('node:assert/strict')
const { assertModel } = require('./assert-model.cjs')
function models() {
  const environment = { MYSQL_DATABASE: 'test', MYSQL_USER: 'test', MYSQL_PASSWORD: 'fixture' }
  const base = { services: {
    'tocaregalo-mysql': { environment, pull_policy: 'never', volumes: [{ type: 'volume', target: '/var/lib/mysql' }] },
    'tocaregalo-php': { pull_policy: 'never', environment: { APP_ENV: 'dev', APP_PUBLIC_URL: 'http://localhost:8080', DATABASE_URL: 'mysql://test:fixture@tocaregalo-mysql:3306/test' } },
    'tocaregalo-frontend': { pull_policy: 'never', environment: { VITE_PUBLIC_PORT: '8080' } },
    'tocaregalo-nginx': { pull_policy: 'never', ports: [] },
    'tocaregalo-mailpit': { pull_policy: 'never', ports: [] },
  } }
  const model = structuredClone(base)
  model.name = 'tocaregalo-startup'
  delete model.services['tocaregalo-mysql'].volumes
  model.services['tocaregalo-mysql'].tmpfs = ['/var/lib/mysql']
  model.services['tocaregalo-php'].environment.APP_PUBLIC_URL = 'http://localhost:8083'
  model.services['tocaregalo-frontend'].environment.VITE_PUBLIC_PORT = '8083'
  model.services['tocaregalo-nginx'].ports = [{ host_ip: '127.0.0.1', published: '8083', target: 80 }]
  model.services['tocaregalo-mailpit'].ports = [{ host_ip: '127.0.0.1', published: '8028', target: 8025 }]
  return [base, model]
}
test('accepts only the documented storage/address differences', () => assert.doesNotThrow(() => assertModel(...models())))
for (const [name, mutate] of Object.entries({
  'named data volume': m => { m.services['tocaregalo-mysql'].volumes = [{ type: 'volume', target: '/var/lib/mysql' }] },
  'external database': m => { m.services['tocaregalo-php'].environment.DATABASE_URL = 'mysql://test:fixture@external:3306/test' },
  'changed image': m => { m.services['tocaregalo-php'].image = 'other' },
  'public web port': m => { m.services['tocaregalo-nginx'].ports[0].host_ip = '0.0.0.0' },
  'SMTP publication': m => { m.services['tocaregalo-mailpit'].ports.push({ target: 1025 }) },
  'secret dependency': m => { m.services['tocaregalo-php'].secrets = ['key'] },
  'project override': m => { m.name = 'tocaregalo' },
})) test(`rejects ${name}`, () => { const [base, model] = models(); mutate(model); assert.throws(() => assertModel(base, model)) })
test('rejects unsafe database parameters even when both models share them', () => {
  const [base, model] = models()
  for (const m of [base, model]) m.services['tocaregalo-php'].environment.DATABASE_URL += '?unix_socket=/tmp/mysql.sock'
  assert.throws(() => assertModel(base, model))
})
