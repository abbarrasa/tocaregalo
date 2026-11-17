const { isDeepStrictEqual } = require('node:util')

function assertModel(base, model) {
  const fail = () => { throw new Error('Modelo de verificación inseguro o distinto del principal.') }
  if (model.name !== 'tocaregalo-startup') fail()
  const expected = structuredClone(base.services)
  const actual = model.services
  const db = actual['tocaregalo-mysql']
  if (!db || (db.volumes ?? []).length || !db.tmpfs?.includes('/var/lib/mysql')) fail()
  delete expected['tocaregalo-mysql'].volumes
  expected['tocaregalo-mysql'].tmpfs = ['/var/lib/mysql']
  // Compose may retain an explicit empty list for a reset mount.
  if (Array.isArray(db.volumes) && !db.volumes.length) delete db.volumes
  for (const [service, published, target] of [['tocaregalo-nginx', '8083', 80], ['tocaregalo-mailpit', '8028', 8025]]) {
    const ports = actual[service]?.ports
    if (!ports || ports.length !== 1 || ports[0].host_ip !== '127.0.0.1'
        || String(ports[0].published) !== published || ports[0].target !== target) fail()
    expected[service].ports = ports
  }
  expected['tocaregalo-php'].environment.APP_ENV = 'dev'
  expected['tocaregalo-php'].environment.APP_PUBLIC_URL = 'http://localhost:8083'
  expected['tocaregalo-frontend'].environment.VITE_PUBLIC_PORT = '8083'
  if (!isDeepStrictEqual(expected, actual)) fail()
  const environment = actual['tocaregalo-php'].environment
  const url = new URL(environment.DATABASE_URL)
  const mysql = db.environment
  if (url.protocol !== 'mysql:' || url.hostname !== 'tocaregalo-mysql' || !['', '3306'].includes(url.port)
      || decodeURIComponent(url.pathname.slice(1)) !== mysql.MYSQL_DATABASE
      || decodeURIComponent(url.username) !== mysql.MYSQL_USER
      || decodeURIComponent(url.password) !== mysql.MYSQL_PASSWORD
      || [...url.searchParams.keys()].some(key => !['serverVersion', 'charset'].includes(key))) fail()
  if (actual['tocaregalo-mysql'].ports?.length) fail()
  for (const service of Object.values(actual)) {
    if (service.secrets?.length || service.pull_policy !== 'never') fail()
  }
}
module.exports = { assertModel }
if (require.main === module) {
  let input = ''
  process.stdin.on('data', part => { input += part })
  process.stdin.on('end', () => {
    try {
      const [base, model] = input.split('\n--STARTUP-MODEL--\n').map(JSON.parse)
      assertModel(base, model)
      console.log('Paridad del modelo y destino de base de datos verificados.')
    } catch {
      console.error('Modelo o parámetros no válidos; no se inicia ningún servicio. Revisa la configuración privada.')
      process.exitCode = 2
    }
  })
}
