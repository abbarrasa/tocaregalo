async function ready() {
  const deadline = Date.now() + 120000
  while (Date.now() < deadline) {
    try {
      const shell = await fetch('http://tocaregalo-nginx/', { signal: AbortSignal.timeout(3000) })
      const api = await fetch('http://tocaregalo-nginx/api', { signal: AbortSignal.timeout(3000) })
      if (shell.ok && (await shell.text()).includes('Toca Regalo') && api.ok && api.headers.get('content-type')?.includes('json')) {
        await api.json()
        console.log('Main HTTP shell and JSON API ready.')
        return
      }
    } catch { /* Retry only within the bounded startup window. */ }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw Error('Main HTTP readiness timed out.')
}
ready().catch(() => { console.error('Main HTTP readiness failed.'); process.exitCode = 2 })
