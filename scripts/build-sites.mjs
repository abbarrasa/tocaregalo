import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const types = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.svg', 'image/svg+xml'],
]);
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false' };
const run = (script, args) => execFileSync(process.execPath, [join(root, script), ...args], {
  cwd: root, env, stdio: 'inherit',
});

async function assetsIn(directory, base = directory) {
  const assets = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { assets.push(...await assetsIn(path, base)); continue; }
    if (!entry.isFile()) throw new Error('Unexpected non-regular asset: ' + path);
    const route = '/' + relative(base, path).split(sep).join('/');
    const type = types.get(entry.name.slice(entry.name.lastIndexOf('.')));
    if (!type || route === '/health' || route === '/api' || route.startsWith('/api/')) {
      throw new Error('Unsupported or reserved asset: ' + route);
    }
    assets.push([route, { type, body: await readFile(path, 'utf8') }]);
  }
  return assets;
}

await mkdir(dist, { recursive: true });
const temporary = await mkdtemp(join(dist, '.sites-build-'));
try {
  const frontend = join(temporary, 'frontend');
  run('node_modules/vite/bin/vite.js', ['build', '--outDir', frontend]);
  const assets = await assetsIn(frontend);
  if (!assets.some(([route]) => route === '/index.html')) throw new Error('Missing frontend index.html');
  const entry = join(temporary, 'entry.js');
  const workerImport = relative(temporary, join(root, 'src/worker.ts')).split(sep).join('/');
  await writeFile(entry, `import application from ${JSON.stringify(workerImport)};
const assets = new Map(${JSON.stringify(assets)});
export default {
  ...application,
  async fetch(request, env, context) {
    const path = new URL(request.url).pathname;
    if (path === '/api' || path.startsWith('/api/') || path === '/health') {
      return application.fetch(request, env, context);
    }
    const asset = assets.get(path === '/' ? '/index.html' : path);
    if (!asset) return new Response('Not found', { status: 404 });
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    return new Response(request.method === 'HEAD' ? null : asset.body, {
      headers: { 'Content-Type': asset.type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' },
    });
  },
};
`);
  const bundleDir = join(temporary, 'bundle');
  run('node_modules/wrangler/bin/wrangler.js', ['deploy', entry, '--config', 'wrangler.jsonc', '--dry-run', '--outdir', bundleDir]);
  const worker = (await readFile(join(bundleDir, 'entry.js'), 'utf8')).replace(/^\/\/# sourceMappingURL=.*$/gm, '');
  const manifest = await readFile(join(root, '.openai/hosting.json'), 'utf8');
  // The Sites packager copies all of dist. Remove previous generated build outputs
  // so the archive contains only the self-contained Worker and hosting manifest.
  for (const name of ['frontend', 'worker', 'server', '.openai']) {
    await rm(join(dist, name), { recursive: true, force: true });
  }
  await mkdir(join(dist, 'server'), { recursive: true });
  await mkdir(join(dist, '.openai'), { recursive: true });
  await writeFile(join(dist, 'server/index.js'), worker);
  await writeFile(join(dist, '.openai/hosting.json'), manifest);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
