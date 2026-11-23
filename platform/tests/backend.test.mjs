import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../server/app.mjs';
import { parseCsv, toCsv } from '../server/csv.mjs';

const measurement = { facilityId: 'test-dam', sampledAt: '2024-06-01', parameter: 'pH', value: 7.2, unit: 'pH', source: 'Laboratoire indépendant', method: 'Électrode' };
function fixtures() {
  const directory = mkdtempSync(resolve(tmpdir(), 'srmsm-test-'));
  mkdirSync(resolve(directory, 'public/data'), { recursive: true });
  writeFileSync(resolve(directory, 'public/data/region.json'), JSON.stringify({ facilities: [{ id: 'test-dam' }] }));
  return { directory, dbPath: resolve(directory, 'private.sqlite'), publicDir: resolve(directory, 'public'), distDir: resolve(directory, 'no-dist') };
}
async function start(options) { const app = createApp(options); app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening'); const origin = `http://127.0.0.1:${app.server.address().port}`; return { ...app, origin }; }
async function request(app, path, { method = 'GET', cookie, data, headers } = {}) {
  const response = await fetch(`${app.origin}${path}`, { method, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(data ? { body: JSON.stringify(data) } : {}) });
  const isJson = response.headers.get('content-type')?.includes('application/json');
  return { status: response.status, body: isJson ? await response.json() : await response.text(), cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
}
async function register(app, email = 'first@example.test') { return request(app, '/api/auth/register', { method: 'POST', data: { name: 'Test User', email, password: 'correct horse battery', workspace: 'Laboratoire test' } }); }

test('auth, workspace privacy, validation, CSV import/export, logout and persistence', async () => {
  const fixture = fixtures(); let app = await start(fixture);
  try {
    assert.equal((await request(app, '/api/auth/me')).body.user, null);
    assert.equal((await request(app, '/api/observations')).status, 401);
    assert.equal((await request(app, '/api/health')).body.storage, 'sqlite');
    for (const password of ['1234567890', '12345678901']) {
      const weak = await request(app, '/api/auth/register', { method: 'POST', data: { name: 'Test', email: 'weak@example.test', password, workspace: 'Test' } });
      assert.equal(weak.status, 422); assert.match(weak.body.error, /12 et 128/);
    }
    const a = await register(app); assert.equal(a.status, 201); assert.ok(a.cookie); assert.equal(a.body.user.workspace, 'Laboratoire test');
    assert.ok(!('password_hash' in a.body.user));
    assert.equal((await register(app)).status, 409);
    const b = await register(app, 'second@example.test'); assert.equal(b.status, 201);
    const created = await request(app, '/api/observations', { method: 'POST', cookie: a.cookie, data: measurement });
    assert.equal(created.status, 201); assert.equal(created.body.observation.provenance, 'user-imported');
    assert.equal((await request(app, '/api/observations', { cookie: a.cookie })).body.observations.length, 1);
    assert.equal((await request(app, '/api/observations', { cookie: b.cookie })).body.observations.length, 0);
    assert.equal((await request(app, `/api/observations/${created.body.observation.id}`, { method: 'DELETE', cookie: b.cookie })).status, 404);
    for (const change of [{ value: 15 }, { value: '' }, { unit: 'mg/L' }, { sampledAt: '2099-01-01' }, { sampledAt: '2024-02-30' }, { facilityId: 'unknown' }, { source: '' }, { parameter: 'arsenic' }]) {
      assert.equal((await request(app, '/api/observations', { method: 'POST', cookie: a.cookie, data: { ...measurement, ...change } })).status, 422, JSON.stringify(change));
    }
    const csvHeader = 'facilityId,sampledAt,parameter,value,unit,source,method\n';
    const csv = csvHeader + 'test-dam,2024-06-02,pH,7.1,pH,"Lab, Agadir",Électrode\n';
    const invalid = csv + 'test-dam,2024-06-03,pH,100,pH,Lab,Électrode\n';
    const failedImport = await request(app, '/api/observations/import', { method: 'POST', cookie: a.cookie, data: { csv: invalid } });
    assert.equal(failedImport.status, 422); assert.equal(failedImport.body.details[0].row, 3);
    assert.equal((await request(app, '/api/observations', { cookie: a.cookie })).body.observations.length, 1, 'invalid batch is atomic');
    assert.equal((await request(app, '/api/observations/import', { method: 'POST', cookie: a.cookie, data: { csv } })).body.imported, 1);
    const exported = await request(app, '/api/observations/export', { cookie: a.cookie }); assert.equal(exported.status, 200);
    const parsed = parseCsv(exported.body); assert.equal(parsed.length, 2); assert.ok(parsed.some(r => r.source === 'Lab, Agadir'));
    const noAccess = await request(app, '/api/auth/login', { method: 'POST', data: { email: 'first@example.test', password: 'wrong' } }); assert.equal(noAccess.status, 401);
    const crossOrigin = await request(app, '/api/observations', { method: 'POST', cookie: a.cookie, data: measurement, headers: { Origin: 'https://evil.test' } }); assert.equal(crossOrigin.status, 403);
    assert.equal((await request(app, '/api/missing')).status, 404);
    await app.close(); app = await start(fixture);
    const login = await request(app, '/api/auth/login', { method: 'POST', data: { email: 'first@example.test', password: 'correct horse battery' } });
    assert.equal(login.status, 200); assert.equal((await request(app, '/api/observations', { cookie: login.cookie })).body.observations.length, 2);
    assert.equal((await request(app, `/api/observations/${created.body.observation.id}`, { method: 'DELETE', cookie: login.cookie })).status, 200);
    assert.equal((await request(app, '/api/auth/logout', { method: 'POST', cookie: login.cookie })).status, 200, 'bodyless logout succeeds');
    assert.equal((await request(app, '/api/observations', { cookie: login.cookie })).status, 401);
  } finally { await app.close(); rmSync(fixture.directory, { recursive: true, force: true }); }
});

test('weather response is labelled modelled; upstream failures are truthful', async () => {
  const fixture = fixtures();
  const mock = async () => ({ ok: true, json: async () => ({ daily: { time: ['2026-11-19'], precipitation_sum: [0] } }) });
  const app = await start({ ...fixture, fetchImpl: mock });
  try { const r = await request(app, '/api/weather'); assert.equal(r.status, 200); assert.equal(r.body.attribution.kind, 'modelled'); }
  finally { await app.close(); }
  const broken = await start({ ...fixture, fetchImpl: async () => { throw new Error('offline'); } });
  try { const r = await request(broken, '/api/weather'); assert.equal(r.status, 502); assert.match(r.body.error, /indisponible/); }
  finally { await broken.close(); rmSync(fixture.directory, { recursive: true, force: true }); }
});

test('CSV parser handles newlines/quotes, rejects malformed rows and neutralises formulas', () => {
  const data = [{ ...measurement, source: 'Lab "A", Agadir\nSource' }];
  assert.equal(parseCsv(toCsv(data))[0].source, data[0].source);
  for (const source of ['=IMPORTXML("x")', '+1+2', '@SUM(A1)', '-1+2', '-.1+2', '-SUM(A1)', '\t=1+2', '\r=1+2', '\n=1+2', '\x00=1+2', ' =1+2']) {
    assert.equal(parseCsv(toCsv([{ ...measurement, source }]))[0].source, `'${source}`, `formula/control neutralised: ${JSON.stringify(source)}`);
  }
  for (const value of [-1, -0.1, '-.1', '-1.', '-1e-2', '-1E+2']) {
    assert.equal(parseCsv(toCsv([{ ...measurement, value }]))[0].value, String(value), `negative number preserved: ${value}`);
  }
  assert.throws(() => parseCsv('facilityId,sampledAt,parameter,value,unit,source\na,b,c,d,e,"bad'), /fermé/);
  assert.throws(() => parseCsv('facilityId,sampledAt,parameter,value,unit,source\na,b'), /colonnes/);
});
