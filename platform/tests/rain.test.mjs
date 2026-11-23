import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../server/app.mjs';
import { createRainService, rainPoints, rainUrl, normalizeRain, RAIN_SOURCE, RAIN_LICENSE, RAIN_CACHE_MS } from '../server/rain.mjs';

const region = {
  facilities: [
    { id: 'dam-a', name: 'Barrage A', kind: 'dam', coordinates: [-9.5, 30.5] },
    { id: 'dam-b', name: 'Barrage B', kind: 'dam', coordinates: [-8.9, 30.2] },
    { id: 'dam-no-coords', name: 'Sans position', kind: 'dam' },
    { id: 'well', name: 'Puits', kind: 'groundwater', coordinates: [-9, 30] },
  ],
};
const TOTAL_POINTS = 4; // 2 fixed + 2 dams with coordinates

// 37 days: 30 past days then 7 forecast days, ending on 2026-11-25.
function dates() {
  const start = Date.UTC(2026, 9, 20);
  return Array.from({ length: 37 }, (_, i) => new Date(start + i * 86400000).toISOString().slice(0, 10));
}
// Past days 1 mm each (30 mm), forecast days 2 mm each (14 mm).
function entry(latitude, longitude, { precipitation = (i) => (i < 30 ? 1 : 2), probability = true } = {}) {
  const time = dates();
  return {
    latitude, longitude,
    daily: {
      time,
      precipitation_sum: time.map((_, i) => precipitation(i)),
      ...(probability ? { precipitation_probability_max: time.map(() => 10) } : {}),
    },
  };
}
function payload(points = TOTAL_POINTS, options) {
  return Array.from({ length: points }, (_, i) => entry(30 + i / 10, -9 - i / 10, options));
}
function mockFetch(body, { status = 200, fail = false } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (fail) throw new Error('offline');
    return { ok: status < 400, status, json: async () => body };
  };
  return { fetchImpl, calls };
}
function clock(start = Date.UTC(2026, 10, 19, 8)) {
  let t = start;
  return { now: () => t, advance: ms => { t += ms; } };
}
function fixtures() {
  const directory = mkdtempSync(resolve(tmpdir(), 'srmsm-rain-'));
  mkdirSync(resolve(directory, 'public/data'), { recursive: true });
  writeFileSync(resolve(directory, 'public/data/region.json'), JSON.stringify(region));
  return { directory, dbPath: resolve(directory, 'private.sqlite'), publicDir: resolve(directory, 'public'), distDir: resolve(directory, 'no-dist') };
}

test('points: fixed reference points plus dams with coordinates, [lon, lat] converted', () => {
  const points = rainPoints(region);
  assert.equal(points.length, TOTAL_POINTS);
  assert.deepEqual(points.slice(0, 2).map(p => [p.name, p.lat, p.lon]), [['Haut Atlas – Aoulouz', 30.69, -8.17], ['Agadir', 30.42, -9.6]]);
  const dam = points.find(p => p.name === 'Barrage A');
  assert.equal(dam.lat, 30.5); assert.equal(dam.lon, -9.5);
  assert.equal(dam.role, 'position approximative du barrage');
  assert.match(dam.note, /pas une moyenne du bassin versant/);
  assert.ok(!points.some(p => p.name === 'Sans position' || p.name === 'Puits'));
});

test('upstream URL batches all coordinates with the requested windows', () => {
  const url = new URL(rainUrl(rainPoints(region)));
  assert.equal(url.origin + url.pathname, 'https://api.open-meteo.com/v1/forecast');
  assert.equal(url.searchParams.get('latitude'), '30.69,30.42,30.5,30.2');
  assert.equal(url.searchParams.get('longitude'), '-8.17,-9.6,-9.5,-8.9');
  assert.equal(url.searchParams.get('daily'), 'precipitation_sum,precipitation_probability_max');
  assert.equal(url.searchParams.get('past_days'), '30');
  assert.equal(url.searchParams.get('forecast_days'), '7');
  assert.equal(url.searchParams.get('timezone'), 'Africa/Casablanca');
});

test('success shape: labelled modelled daily series and 30-day / 7-day totals', async () => {
  const { fetchImpl, calls } = mockFetch(payload());
  const service = createRainService({ fetchImpl, loadRegion: () => region, now: clock().now });
  const result = await service.get();
  assert.equal(calls.length, 1);
  assert.equal(result.source, RAIN_SOURCE);
  assert.equal(result.license, RAIN_LICENSE);
  assert.equal(result.modelled, true);
  assert.equal(result.stale, false);
  assert.equal(result.fromCache, false);
  assert.equal(new Date(result.fetchedAt).toISOString(), result.fetchedAt);
  assert.equal(result.points.length, TOTAL_POINTS);
  const aoulouz = result.points[0];
  assert.equal(aoulouz.name, 'Haut Atlas – Aoulouz');
  assert.equal(aoulouz.daily.length, 37);
  assert.equal(aoulouz.daily.filter(d => d.kind === 'past_modelled').length, 30);
  assert.equal(aoulouz.daily.filter(d => d.kind === 'forecast').length, 7);
  assert.deepEqual(aoulouz.daily[0], { date: '2026-10-20', kind: 'past_modelled', precipitation_mm: 1, probability_max_pct: 10 });
  assert.equal(aoulouz.daily[36].kind, 'forecast');
  assert.equal(aoulouz.totals.past30Mm, 30);
  assert.equal(aoulouz.totals.past30Complete, true);
  assert.equal(aoulouz.totals.forecast7Mm, 14);
  assert.equal(aoulouz.totals.forecast7Complete, true);
});

test('caching: second call within 3 hours does not hit upstream; expiry refetches', async () => {
  const { fetchImpl, calls } = mockFetch(payload());
  const time = clock();
  const service = createRainService({ fetchImpl, loadRegion: () => region, now: time.now });
  const first = await service.get();
  const second = await service.get();
  assert.equal(calls.length, 1, 'no second upstream call');
  assert.equal(second.fromCache, true);
  assert.equal(second.fetchedAt, first.fetchedAt);
  time.advance(RAIN_CACHE_MS - 1000);
  await service.get();
  assert.equal(calls.length, 1, 'still cached just before 3 hours');
  time.advance(2000);
  const refreshed = await service.get();
  assert.equal(calls.length, 2, 'refetched after 3 hours');
  assert.equal(refreshed.fromCache, false);
});

test('concurrent first calls share one upstream request', async () => {
  const { fetchImpl, calls } = mockFetch(payload());
  const service = createRainService({ fetchImpl, loadRegion: () => region, now: clock().now });
  await Promise.all([service.get(), service.get(), service.get()]);
  assert.equal(calls.length, 1);
});

test('upstream failure without cache is a truthful 502 with no numbers', async () => {
  const service = createRainService({ fetchImpl: mockFetch(null, { fail: true }).fetchImpl, loadRegion: () => region, now: clock().now });
  await assert.rejects(service.get(), error => {
    assert.equal(error.status, 502);
    assert.match(error.message, /indisponibles/);
    assert.doesNotMatch(error.message, /\d+(\.\d+)?\s*mm/);
    return true;
  });
  const http500 = createRainService({ fetchImpl: mockFetch({}, { status: 500 }).fetchImpl, loadRegion: () => region, now: clock().now });
  await assert.rejects(http500.get(), error => error.status === 502);
});

test('malformed upstream payload is rejected, not turned into numbers', async () => {
  const wrongCount = createRainService({ fetchImpl: mockFetch(payload(TOTAL_POINTS - 1)).fetchImpl, loadRegion: () => region, now: clock().now });
  await assert.rejects(wrongCount.get(), error => error.status === 502);
  const badSeries = payload();
  badSeries[0].daily.precipitation_sum = badSeries[0].daily.precipitation_sum.slice(1);
  const service = createRainService({ fetchImpl: mockFetch(badSeries).fetchImpl, loadRegion: () => region, now: clock().now });
  await assert.rejects(service.get(), error => error.status === 502);
});

test('stale cache is served only when flagged stale:true', async () => {
  let ok = true;
  const fetchImpl = async () => {
    if (!ok) throw new Error('offline');
    return { ok: true, status: 200, json: async () => payload() };
  };
  const time = clock();
  const service = createRainService({ fetchImpl, loadRegion: () => region, now: time.now });
  const fresh = await service.get();
  ok = false;
  time.advance(RAIN_CACHE_MS + 1);
  const stale = await service.get();
  assert.equal(stale.stale, true);
  assert.match(stale.staleReason, /dernière récupération réussie/);
  assert.equal(stale.fetchedAt, fresh.fetchedAt, 'stale data keeps its original fetch time');
  assert.equal(stale.points[0].totals.past30Mm, 30);
});

test('no fabricated data: missing upstream values stay null and incomplete windows are not claimed complete', () => {
  const body = payload(TOTAL_POINTS, { precipitation: i => (i === 5 || i === 33 ? null : 1), probability: false });
  const result = normalizeRain(body, rainPoints(region), '2026-11-19T08:00:00.000Z');
  const aoulouz = result.points[0];
  assert.equal(aoulouz.daily[5].precipitation_mm, null);
  assert.equal(aoulouz.daily[5].probability_max_pct, null);
  assert.equal(aoulouz.totals.past30Mm, 29, 'sum covers only reported days');
  assert.equal(aoulouz.totals.past30Complete, false);
  assert.equal(aoulouz.totals.forecast7Complete, false);
  assert.equal(aoulouz.totals.forecast7Mm, 6);

  const allMissing = payload(TOTAL_POINTS, { precipitation: () => null, probability: false });
  const empty = normalizeRain(allMissing, rainPoints(region), '2026-11-19T08:00:00.000Z').points[0];
  assert.equal(empty.totals.past30Mm, null);
  assert.equal(empty.totals.forecast7Mm, null);
});

test('GET /api/rain: public route, success and 502 through the HTTP app', async () => {
  const fixture = fixtures();
  const { fetchImpl, calls } = mockFetch(payload());
  const app = createApp({ ...fixture, fetchImpl });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const ok = await fetch(`${origin}/api/rain`);
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.points.length, TOTAL_POINTS);
    assert.equal(body.modelled, true);
    await fetch(`${origin}/api/rain`);
    assert.equal(calls.length, 1, 'route uses the cache');
  } finally { await app.close(); }

  const brokenFixture = fixtures();
  const broken = createApp({ ...brokenFixture, fetchImpl: mockFetch(null, { fail: true }).fetchImpl });
  broken.server.listen(0, '127.0.0.1');
  await once(broken.server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${broken.server.address().port}/api/rain`);
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.match(body.error, /indisponibles/);
    assert.equal(body.points, undefined);
  } finally { await broken.close(); rmSync(fixture.directory, { recursive: true, force: true }); rmSync(brokenFixture.directory, { recursive: true, force: true }); }
});
