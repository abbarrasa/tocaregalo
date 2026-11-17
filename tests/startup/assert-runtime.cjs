let input = ''
process.stdin.on('data', part => { input += part })
process.stdin.on('end', () => {
  try {
    const containers = input.trim().split('\n').map(JSON.parse)
    if (containers.length !== 3) throw Error()
    for (const container of containers) {
      const name = container.Service
      const ports = container.Ports ?? {}
      if (name === 'tocaregalo-mysql') {
        if (Object.keys(ports).length || container.Health !== 'healthy'
            || !Object.hasOwn(container.Tmpfs, '/var/lib/mysql')
            || container.Mounts.some(m => m.Destination === '/var/lib/mysql' && m.Type !== 'tmpfs')) throw Error()
      } else {
        const key = name === 'tocaregalo-nginx' ? '80/tcp' : '8025/tcp'
        const port = name === 'tocaregalo-nginx' ? '8083' : '8028'
        if (Object.keys(ports).length !== 1 || ports[key]?.length !== 1
            || ports[key][0].HostIp !== '127.0.0.1' || ports[key][0].HostPort !== port) throw Error()
      }
    }
    console.log('Runtime tmpfs, health and loopback boundaries passed.')
  } catch {
    console.error('Runtime isolation check failed.')
    process.exitCode = 2
  }
})
