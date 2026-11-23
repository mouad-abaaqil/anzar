import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_POINT, cacheKey, featureCentroid, floodUrl, forecastUrl, loadWithCache, normalizeEt0, normalizeFlood,
  regionIdFromHash, regionPoint, sourceRow, readCache,
} from '../src/lib/openData.js';

const days = (n, start = Date.UTC(2026, 9, 24)) => Array.from({ length: n }, (_, i) => new Date(start + i * 86400000).toISOString().slice(0, 10));
const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), m }; };

test('region id comes from the hash, default when absent', () => {
  assert.equal(regionIdFromHash('#/app/forecast'), 'souss-massa');
  assert.equal(regionIdFromHash('#/app/forecast/draa-tafilalet'), 'draa-tafilalet');
  assert.equal(regionIdFromHash('#/'), 'souss-massa');
  assert.equal(regionIdFromHash(''), 'souss-massa');
});

test('centroid of the largest polygon, null for bad geometry', () => {
  const square = (x, y, s) => [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]];
  const feature = { geometry: { type: 'MultiPolygon', coordinates: [[square(0, 0, 1)], [square(-10, 30, 4)]] } };
  assert.deepEqual(featureCentroid(feature), { lat: 32, lon: -8 });
  assert.equal(featureCentroid({ geometry: { type: 'Point', coordinates: [0, 0] } }), null);
  assert.equal(featureCentroid(null), null);
});

test('region point: Agadir by default, centroid otherwise, null when unknown', () => {
  const geo = { features: [{ properties: { id: 'a', name: 'Région A' }, geometry: { type: 'Polygon', coordinates: [[[-10, 30], [-8, 30], [-8, 32], [-10, 32], [-10, 30]]] } }] };
  assert.equal(regionPoint('souss-massa', geo).lat, DEFAULT_POINT.lat);
  assert.equal(regionPoint(null).name, 'Agadir');
  const p = regionPoint('a', geo);
  assert.deepEqual([p.lat, p.lon, p.name, p.kind], [31, -9, 'Région A', 'centroid']);
  assert.equal(regionPoint('zzz', geo), null);
  assert.equal(regionPoint('a', null), null);
});

test('urls carry the point, windows and no API key', () => {
  const u = forecastUrl({ lat: 30.42, lon: -9.6 });
  assert.match(u, /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?latitude=30\.42&longitude=-9\.6&/);
  assert.match(u, /et0_fao_evapotranspiration/);
  assert.match(u, /past_days=30&forecast_days=7/);
  assert.match(floodUrl({ lat: 30.42, lon: -9.6 }), /^https:\/\/flood-api\.open-meteo\.com\/v1\/flood\?/);
  assert.doesNotMatch(u + floodUrl({ lat: 1, lon: 1 }), /apikey|key=/i);
});

test('ET0 keeps nulls as nulls and splits past from forecast', () => {
  const time = days(37);
  const et = time.map((_, i) => (i === 3 ? null : 2));
  const out = normalizeEt0({ daily: { time, et0_fao_evapotranspiration: et } }, 'x');
  assert.equal(out.past30Complete, false);
  assert.equal(out.past30Mm, 58);
  assert.equal(out.forecast7Mm, 14);
  assert.equal(out.meanPastMmDay, 2);
  assert.equal(out.days.filter(d => d.kind === 'forecast').length, 7);
  const allNull = normalizeEt0({ daily: { time, et0_fao_evapotranspiration: time.map(() => null) } }, 'x');
  assert.equal(allNull.past30Mm, null);
  assert.equal(allNull.meanPastMmDay, null);
});

test('malformed payloads throw instead of inventing values', () => {
  assert.throws(() => normalizeEt0({}, 'x'), /format/);
  assert.throws(() => normalizeEt0({ daily: { time: days(3), et0_fao_evapotranspiration: [1] } }, 'x'), /format/);
  assert.throws(() => normalizeFlood({ daily: { time: ['bad'], river_discharge: [1] } }, 'x'), /format/);
});

test('flood: last past day, forecast peak, unit', () => {
  const time = days(37);
  const q = time.map((_, i) => (i < 30 ? 0.3 : 0.5));
  q[29] = null;
  const max = time.map((_, i) => (i === 34 ? 2.07 : 0.6));
  const out = normalizeFlood({ latitude: 30.4, longitude: -9.6, daily_units: { river_discharge: 'm³/s' }, daily: { time, river_discharge: q, river_discharge_max: max } }, 'x');
  assert.equal(out.lastObserved.date, time[28]);
  assert.equal(out.lastObserved.m3s, 0.3);
  assert.equal(out.forecastPeakM3s, 2.07);
  assert.equal(out.unit, 'm³/s');
  const none = normalizeFlood({ daily: { time, river_discharge: time.map(() => null) } }, 'x');
  assert.equal(none.lastObserved, null);
  assert.equal(none.forecastPeakM3s, null);
});

test('cache: fresh hit, network refresh, stale fallback, error without cache', async () => {
  const storage = memory();
  const key = cacheKey('et0', { lat: 30.42, lon: -9.6 });
  let t = 1000; const now = () => t;
  let calls = 0;
  const ok = async () => { calls += 1; return { v: calls }; };
  const boom = async () => { throw new Error('réseau'); };
  await assert.rejects(loadWithCache({ storage, key, fetcher: boom, now }), /réseau/);
  const first = await loadWithCache({ storage, key, fetcher: ok, now });
  assert.deepEqual([first.status, first.data.v, first.at], ['live', 1, 1000]);
  t += 1000;
  assert.equal((await loadWithCache({ storage, key, fetcher: ok, now })).status, 'cache');
  assert.equal(calls, 1);
  t += 4 * 3600 * 1000;
  const stale = await loadWithCache({ storage, key, fetcher: boom, now });
  assert.deepEqual([stale.status, stale.data.v, stale.at], ['stale', 1, 1000]);
  const forced = await loadWithCache({ storage, key, fetcher: ok, now, force: true });
  assert.equal(forced.status, 'live');
  assert.equal(readCache(storage, key).data.v, 2);
});

test('cache tolerates corrupt storage and missing storage', async () => {
  const storage = memory();
  storage.setItem('k', '{not json');
  assert.equal(readCache(storage, 'k'), null);
  const r = await loadWithCache({ storage: null, key: 'k', fetcher: async () => ({ a: 1 }) });
  assert.equal(r.status, 'live');
});

test('source rows never invent a date', () => {
  const loading = sourceRow('flood', { status: 'loading' });
  assert.equal(loading.at, null);
  assert.match(loading.license, /non commerciale/);
  const live = sourceRow('et0', { status: 'cache', at: Date.UTC(2026, 10, 23, 8) });
  assert.equal(live.at, '2026-11-23T08:00:00.000Z');
  assert.equal(live.statusLabel, 'cache local daté');
});
