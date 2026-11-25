import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const manifest = JSON.parse(await readFile('.openai/hosting.json', 'utf8'));
assert.equal(manifest.project_id, 'appgprj_6afed5354a4481918750d09f1a15a385');
assert.equal(manifest.d1, 'DB');
assert.equal(manifest.r2, null);
assert.equal(manifest.static, undefined);
assert.deepEqual(JSON.parse(await readFile('dist/.openai/hosting.json', 'utf8')), manifest);
assert.deepEqual((await readdir('dist')).sort(), ['.openai', 'server']);
assert.deepEqual(await readdir('dist/server'), ['index.js']);
const script = await readFile('dist/server/index.js', 'utf8');
const module = await import('../dist/server/index.js');
assert.equal(typeof module.default.fetch, 'function');
assert.equal(typeof module.default.scheduled, 'function');

const config = JSON.parse(await readFile('wrangler.site.jsonc', 'utf8'));
const origin = 'https://site.example.test';
const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{
  name: 'sites-artifact', modules: true, script,
  compatibilityDate: config.compatibility_date, d1Databases: ['DB'],
  bindings: { ...config.vars, APP_ORIGIN: origin },
}] }));
try {
  const index = await mf.dispatchFetch(origin + '/');
  assert.equal(index.status, 200);
  assert.match(index.headers.get('Content-Type'), /text\/html/);
  const html = await index.text();
  assert.match(html, /TocaRegalo/);
  const js = html.match(/src="(\/assets\/[^"\s]+\.js)"/)?.[1];
  const css = html.match(/href="(\/assets\/[^"\s]+\.css)"/)?.[1];
  assert.ok(js && css);
  for (const [path, type] of [[js, /javascript/], [css, /text\/css/], ['/gift.svg', /image\/svg\+xml/]]) {
    const response = await mf.dispatchFetch(origin + path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type'), type);
    assert.ok((await response.text()).length > 0);
  }
  const head = await mf.dispatchFetch(origin + '/', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const health = await mf.dispatchFetch(origin + '/health');
  assert.deepEqual(await health.json(), { status: 'ok' });
  for (const path of ['/api', '/api/not-found', '/missing-page', '/assets/missing.js']) {
    const response = await mf.dispatchFetch(origin + path);
    assert.equal(response.status, 404);
    assert.doesNotMatch(await response.text(), /<html|id="app"/i);
  }
  const me = await mf.dispatchFetch(origin + '/api/me');
  assert.equal(me.status, 401);
  assert.equal(me.headers.get('Cache-Control'), 'no-store');
  const denied = await mf.dispatchFetch(origin + '/api/login', {
    method: 'POST', headers: { Origin: 'https://other.example.test', 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(denied.status, 403);
  const method = await mf.dispatchFetch(origin + '/', { method: 'POST' });
  assert.equal(method.status, 405);
  console.log('Sites artifact: manifest, ESM handlers, frontend assets and same-origin API routing verified.');
} finally {
  await mf.dispose();
}
