import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual, scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const here = dirname(fileURLToPath(import.meta.url));
const sources = JSON.parse(await readFile(resolve(here, 'sources.json'), 'utf8'));
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[_-]/g, ' ').replace(/\s+/g, ' ');
const noAccess = value => /\bpa akses\b|\bno access\b|\bpin location\b/.test(normalize(value));
const keys = ['status', 'statusi', 'gjendja', 'tipologjia', 'category', 'kategori', 'shenime', 'shënime', 'pershkrimi', 'përshkrimi'];
const get = (properties, names) => {
  for (const name of names) {
    const entry = Object.entries(properties || {}).find(([key]) => normalize(key) === normalize(name));
    if (entry && entry[1] !== null && entry[1] !== '') return entry[1];
  }
};
const personKey = value => normalize(value).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const NO_ACCESS = 'Banesë pa akses (PIN LOCATION)';

export function resolveStatus(properties, source, statuses = {}) {
  // The trusted source classification overrides client-supplied properties.
  if (source.colorType === 'noAccess') return NO_ACCESS;
  const raw = get(properties, keys);
  if (noAccess(raw)) return NO_ACCESS;
  if (source.type === 'survey') {
    const match = statuses[personKey(get(properties, ['EMER_MBIEM', 'NAME']))];
    const category = normalize(match?.category);
    if (category.includes('paakses') || noAccess(category)) return NO_ACCESS;
    if (category.includes('munges') || category.includes('ska dosje')) return 'Mungesë dokumentacioni';
    if (category.includes('afishim')) return 'Në afishim';
    if (category.includes('shqyrtim')) return 'Në shqyrtim dokumentacioni';
    if (category.includes('pajisur me vendim')) return 'Pajisur me vendim';
    if (category.includes('tjeter')) return 'Të tjera';
    return 'Evidentuar';
  }
  return raw || (source.colorType === 'afishim' ? 'Në afishim' : source.colorType === 'regjistruar' ? 'Regjistruar' : 'Status i papërcaktuar');
}

export function filterFeatures(data, source, statuses, authenticated) {
  const features = data.type === 'FeatureCollection' ? data.features : data.type === 'Feature' ? [data] : [];
  return { type: 'FeatureCollection', features: (features || []).flatMap(feature => {
    const status = resolveStatus(feature.properties, source, statuses);
    if (!authenticated && (!['building', 'survey'].includes(source.type) || !noAccess(status))) return [];
    return [{ type: 'Feature', id: feature.id, geometry: feature.geometry, properties: { ...feature.properties, _resolvedStatus: status } }];
  }) };
}

export function createApp({ dataDir, statuses = {}, username, passwordHash, origin, secure = true }) {
  if (!isAbsolute(dataDir) || !username || !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(passwordHash || '')) throw new Error('Set PRIVATE_DATA_DIR, AUTH_USERNAME and AUTH_PASSWORD_HASH.');
  const allowedOrigin = new URL(origin).origin;
  if (secure && !allowedOrigin.startsWith('https://')) throw new Error('Production requires HTTPS.');
  const [salt, hash] = passwordHash.split(':');
  const cookieName = secure ? '__Host-door_session' : 'door_session';
  const sessions = new Map();
  const attempts = new Map();
  const TTL = 30 * 60 * 1000;
  const prefix = '/api/doortodoor';
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, item] of sessions) if (item.expiresAt <= now) sessions.delete(key);
    for (const [key, item] of attempts) if (item.until <= now) attempts.delete(key);
  }, 60000);
  cleanup.unref();
  const cookie = (token, maxAge) => `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
  return http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Vary', 'Cookie');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
    try {
      const url = new URL(req.url, allowedOrigin);
      const token = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
      const session = sessions.get(token);
      const user = session?.expiresAt > Date.now() ? { username: session.username, expiresAt: session.expiresAt } : null;
      if (req.method === 'GET' && url.pathname === `${prefix}/session`) return send(200, { user });
      if (req.method === 'POST' && [`${prefix}/login`, `${prefix}/logout`].includes(url.pathname)) {
        // Validate the browser origin for both session mutations, including login.
        if (req.headers.origin !== allowedOrigin || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return send(403, { error: 'Kërkesë e palejuar.' });
        if (url.pathname.endsWith('/logout')) {
          sessions.delete(token);
          res.setHeader('Set-Cookie', cookie('', 0));
          return send(200, { user: null });
        }
        const address = req.socket.remoteAddress;
        const now = Date.now();
        let rate = attempts.get(address);
        if (!rate || rate.until <= now) { rate = { count: 0, until: now + 15 * 60 * 1000 }; attempts.set(address, rate); }
        if (++rate.count > 10) return send(429, { error: 'Shumë tentativa. Provoni përsëri pas 15 minutash.' });
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 4096) return send(413, { error: 'Kërkesë shumë e madhe.' });
        }
        let credentials;
        try { credentials = JSON.parse(body); } catch { return send(400, { error: 'Kërkesë e pavlefshme.' }); }
        if (!credentials || typeof credentials.username !== 'string' || typeof credentials.password !== 'string' || credentials.password.length > 1024) return send(400, { error: 'Kërkesë e pavlefshme.' });
        const derived = await promisify(scrypt)(credentials.password, salt, 64);
        if (!timingSafeEqual(derived, Buffer.from(hash, 'hex')) || credentials.username !== username) return send(401, { error: 'Përdoruesi ose fjalëkalimi është i pasaktë.' });
        sessions.delete(token);
        const newToken = randomBytes(32).toString('hex');
        const next = { username, expiresAt: Date.now() + TTL };
        sessions.set(newToken, next);
        res.setHeader('Set-Cookie', cookie(newToken, TTL / 1000));
        return send(200, { user: next });
      }
      if (req.method === 'GET' && url.pathname === `${prefix}/geojson`) {
        const source = sources.find(item => item.file === url.searchParams.get('file'));
        if (!source) return send(404, { error: 'Burim i panjohur.' });
        const scope = url.searchParams.get('scope');
        if (!['public', 'all'].includes(scope)) return send(400, { error: 'Pamje e pavlefshme.' });
        if (scope === 'all' && !user) return send(401, { error: 'Duhet të hyni në llogari.' });
        const data = JSON.parse(await readFile(resolve(dataDir, source.file), 'utf8'));
        return send(200, filterFeatures(data, source, statuses, scope === 'all' && Boolean(user)));
      }
      send(404, { error: 'Nuk u gjet.' });
    } catch (error) {
      console.error(error.message);
      send(500, { error: 'Nuk u ngarkuan të dhënat.' });
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const statuses = JSON.parse(await readFile(resolve(process.env.PRIVATE_DATA_DIR || '.', 'Palase_Statuset_Verifikuara.json'), 'utf8'));
  const app = createApp({ dataDir: process.env.PRIVATE_DATA_DIR, statuses, username: process.env.AUTH_USERNAME, passwordHash: process.env.AUTH_PASSWORD_HASH, origin: process.env.APP_ORIGIN, secure: process.env.NODE_ENV !== 'development' });
  app.listen(Number(process.env.PORT || 3001), '127.0.0.1', () => console.log('DoorToDoor API listening on loopback.'));
}
