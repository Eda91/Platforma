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

test('API denies private data until login, invalidates logout session, validates origin and source', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'door-test-'));
  await writeFile(join(dir, 'ILIAS_NDERTESAT.geojson'), JSON.stringify(data));
  const salt = '0123456789abcdef0123456789abcdef';
  const passwordHash = `${salt}:${scryptSync('test-password-123', salt, 64).toString('hex')}`;
  const app = createApp({ dataDir: dir, statuses: {}, username: 'tester', passwordHash, origin: 'http://localhost', secure: false });
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}/api/doortodoor`;
  const endpoint = '/geojson?file=ILIAS_NDERTESAT.geojson&scope=';
  const post = (path, body, cookie, origin = 'http://localhost') => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', origin, ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
  try {
    assert.equal((await (await fetch(base + endpoint + 'public')).json()).features.length, 1);
    assert.equal((await fetch(base + endpoint + 'all')).status, 401);
    assert.equal((await fetch(base + '/geojson?file=../sources.json&scope=public')).status, 404);
    assert.equal((await post('/login', { username: 'tester', password: 'wrong' })).status, 401);
    assert.equal((await post('/login', { username: 'tester', password: 'test-password-123' }, null, 'http://evil.test')).status, 403);
    const login = await post('/login', { username: 'tester', password: 'test-password-123' });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.match(login.headers.get('set-cookie'), /HttpOnly/);
    assert.equal((await (await fetch(base + endpoint + 'all', { headers: { cookie } })).json()).features.length, 5);
    assert.equal((await (await fetch(base + endpoint + 'public', { headers: { cookie } })).json()).features.length, 1);
    assert.equal((await post('/logout', {}, cookie)).status, 200);
    assert.equal((await fetch(base + endpoint + 'all', { headers: { cookie } })).status, 401);
    for (let i = 0; i < 9; i++) await post('/login', { username: 'tester', password: 'wrong' });
    assert.equal((await post('/login', { username: 'tester', password: 'wrong' })).status, 429);
  } finally {
    await new Promise(r => app.close(r));
    await rm(dir, { recursive: true, force: true });
  }
});
