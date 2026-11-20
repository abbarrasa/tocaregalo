import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { applyMigration } from './helpers/migrations.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

test('compiled site serves public assets and preserves API routing on one origin', async t => {
  // Build from source so a fresh checkout cannot accidentally test old dist files.
  execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { stdio: 'pipe' });
  const output = await mkdtemp(join(tmpdir(), 'tocaregalo-site-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--config',
    'wrangler.site.jsonc', '--dry-run', '--outdir', output], {
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: 'pipe',
  });
  // This file is deliberately valid JSON as well as JSONC. Use its routing settings,
  // rather than reimplementing different hosting rules just for the test.
  const config: unknown = JSON.parse(await readFile('wrangler.site.jsonc', 'utf8'));
  assert.ok(isRecord(config) && isRecord(config.assets) && isRecord(config.vars));
  assert.ok(typeof config.compatibility_date === 'string' && typeof config.assets.directory === 'string');
  assert.ok(config.assets.not_found_handling === 'none');
  assert.ok(Array.isArray(config.assets.run_worker_first)
    && config.assets.run_worker_first.every((path: unknown) => typeof path === 'string'));
  const assets = join(output, 'assets');
  await cp(resolve(config.assets.directory), assets, { recursive: true });
  // Even accidental public files at reserved paths must never shadow API handlers.
  await mkdir(join(assets, 'api'));
  await writeFile(join(assets, 'api', 'me'), '<html>public collision</html>');
  await writeFile(join(assets, 'health'), '<html>public collision</html>');
  const origin = 'https://site.example.test';
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{
    name: 'site-test', modules: true,
    script: await readFile(join(output, 'worker.js'), 'utf8'),
    compatibilityDate: config.compatibility_date, d1Databases: ['DB'],
    bindings: { ...config.vars, APP_ORIGIN: origin },
    assets: { directory: assets,
      routerConfig: { has_user_worker: true },
      assetConfig: { not_found_handling: config.assets.not_found_handling },
      run_worker_first: config.assets.run_worker_first },
  }] }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  for (const name of (await readdir('migrations')).filter(name => name.endsWith('.sql')).sort()) {
    await applyMigration(db, name);
  }

  const index = await mf.dispatchFetch(origin + '/');
  assert.equal(index.status, 200);
  assert.match(index.headers.get('Content-Type') ?? '', /text\/html/);
  const html = await index.text();
  assert.match(html, /TocaRegalo/);
  assert.doesNotMatch(html, /\/src\/main.ts/);
  const js = html.match(/src="(\/assets\/[^"\s]+\.js)"/)?.[1];
  const css = html.match(/href="(\/assets\/[^"\s]+\.css)"/)?.[1];
  assert.ok(js); assert.ok(css);
  for (const [path, type] of [[js, /javascript/], [css, /text\/css/], ['/gift.svg', /image\/svg\+xml/]] as const) {
    const response = await mf.dispatchFetch(origin + path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type') ?? '', type);
    assert.equal(response.headers.get('Set-Cookie'), null);
    await response.body?.cancel();
  }
  const head = await mf.dispatchFetch(origin + '/', { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  const health = await mf.dispatchFetch(origin + '/health');
  assert.equal(health.status, 200); assert.deepEqual(await health.json(), { status: 'ok' });
  for (const path of ['/api', '/api/not-found', '/assets/missing.js', '/missing-page']) {
    const response = await mf.dispatchFetch(origin + path, { headers: { 'Sec-Fetch-Mode': 'navigate', Accept: 'text/html' } });
    assert.equal(response.status, 404, path);
    assert.doesNotMatch(await response.text(), /<html|id="app"/i);
  }
  const me = await mf.dispatchFetch(origin + '/api/me', { headers: { 'Sec-Fetch-Mode': 'navigate', Accept: 'text/html' } });
  assert.equal(me.status, 401); assert.equal(me.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await me.json(), { error: 'Unauthorized' });
  const login = await mf.dispatchFetch(origin + '/api/login');
  assert.equal(login.status, 405); assert.equal(login.headers.get('Allow'), 'POST');
  await login.body?.cancel();
  const forged = await mf.dispatchFetch(origin + '/api/login', {
    method: 'POST', headers: { Origin: 'https://other.example.test', 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'qa@example.test', password: 'abcdef' }),
  });
  assert.equal(forged.status, 403); assert.equal(forged.headers.get('Set-Cookie'), null);
  await forged.body?.cancel();
});
