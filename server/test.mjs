import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scryptSync } from 'node:crypto';
import { createApp, filterFeatures } from './server.mjs';
const feature = status => ({ type: 'Feature', properties: { status }, geometry: { type: 'Point', coordinates: [19.6, 40.1] } });
const data = { type: 'FeatureCollection', features: [feature('Banesë pa akses (PIN LOCATION)'), feature('Në afishim'), feature('Regjistruar'), feature(null), feature('me akses')] };

test('Public filter includes only explicit inaccessible buildings; unknown statuses stay private', () => {
  const source = { type: 'building' };
  assert.equal(filterFeatures(data, source, {}, false).features.length, 1);
  assert.equal(filterFeatures(data, source, {}, true).features.length, 5);
  assert.equal(filterFeatures(data, { type: 'parcel' }, {}, false).features.length, 0);
  assert.equal(filterFeatures(data, { ...source, colorType: 'noAccess' }, {}, false).features.length, 5);
  const survey = { type: 'FeatureCollection', features: [{ ...feature(null), properties: { NAME: 'Test Name' } }] };
  assert.equal(filterFeatures(survey, { type: 'survey' }, { 'test name': { category: 'PaAkses' } }, false).features.length, 1);
  assert.equal(filterFeatures(survey, { type: 'survey' }, {}, false).features.length, 0);
});

test('API denies private data until login, invalidates logout token, validates CORS preflight, origin and source', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'door-test-'));
  await writeFile(join(dir, 'ILIAS_NDERTESAT.geojson'), JSON.stringify(data));
  const salt = '0123456789abcdef0123456789abcdef';
  const passwordHash = `${salt}:${scryptSync('test-password-123', salt, 64).toString('hex')}`;
  const app = createApp({ dataDir: dir, statuses: {}, username: 'tester', passwordHash, origin: 'http://localhost', secure: false });
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}/api/doortodoor`;
  const endpoint = '/geojson?file=ILIAS_NDERTESAT.geojson&scope=';
  const preflight = (origin, headers = 'authorization,content-type') => fetch(base + '/login', { method: 'OPTIONS', headers: { origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': headers } });
  const post = (path, body, token, origin = 'http://localhost') => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  try {
    assert.equal((await preflight('http://localhost')).status, 204);
    assert.equal((await preflight('http://evil.test')).status, 403);
    assert.equal((await preflight('http://localhost', 'x-unapproved')).status, 403);
    assert.equal((await fetch(base + endpoint + 'public', { headers: { origin: 'http://evil.test' } })).status, 403);
    assert.equal((await fetch(base.replace('/api/doortodoor', '') + '/healthz')).status, 200);
    assert.equal((await (await fetch(base + endpoint + 'public')).json()).features.length, 1);
    assert.equal((await fetch(base + endpoint + 'all')).status, 401);
    assert.equal((await fetch(base + '/geojson?file=../sources.json&scope=public')).status, 404);
    assert.equal((await post('/login', { username: 'tester', password: 'wrong' })).status, 401);
    assert.equal((await post('/login', { username: 'tester', password: 'test-password-123' }, null, 'http://evil.test')).status, 403);
    const login = await post('/login', { username: 'tester', password: 'test-password-123' });
    assert.equal(login.status, 200);
    const { token } = await login.json();
    assert.match(token, /^[a-f0-9]{64}$/);
    assert.equal(login.headers.get('set-cookie'), null);
    assert.equal(login.headers.get('access-control-allow-origin'), 'http://localhost');
    assert.equal((await (await fetch(base + endpoint + 'all', { headers: { Authorization: `Bearer ${token}` } })).json()).features.length, 5);
    assert.equal((await (await fetch(base + endpoint + 'public', { headers: { Authorization: `Bearer ${token}` } })).json()).features.length, 1);
    assert.equal((await post('/logout', {}, token)).status, 200);
    assert.equal((await fetch(base + endpoint + 'all', { headers: { Authorization: `Bearer ${token}` } })).status, 401);
    for (let i = 0; i < 9; i++) await post('/login', { username: 'tester', password: 'wrong' });
    assert.equal((await post('/login', { username: 'tester', password: 'wrong' })).status, 429);
  } finally {
    await new Promise(r => app.close(r));
    await rm(dir, { recursive: true, force: true });
  }
});
