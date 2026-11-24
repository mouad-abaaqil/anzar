import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { satelliteTrend, trendPaths, openDataRows, NOT_LOADED, FLOOD_CAVEAT, SATELLITE_LABEL, SATELLITE_REGION, RAIN_CACHE_KIND } from '../src/hub/panel/extraLogic.js';
import { basinDamsFor, basinNamesFor, NO_BASIN_MESSAGE } from '../src/hub/panel/damsLogic.js';
import { apiJson, probeServer } from '../src/hub/panel/serverApi.js';
import { SKILL_MIN } from '../src/lib/forecast.js';
import { computeMetricByRegion, defaultScenario, regionModel, rankingFor, leversFor, linksFor, sortLinks, projectsFor, NO_LINK_MESSAGE, START_YEAR, splitLinks, fluxStepOf, pctText } from '../src/hub/panel/metrics.js';

const j = f => JSON.parse(readFileSync(new URL('../public/data/' + f, import.meta.url), 'utf8'));
const opt = f => { try { return j(f); } catch { return null; } };
const data = { regions: j('regions.json'), balance: j('water-balance.json'), bulletin: j('national-bulletin.json'), climate: opt('climate-outlook.json'), links: opt('water-links.json'), dams: null, geo: null };

test('defaultScenario : champs du contrat et pluie = médiane CMIP6', () => {
  const s = defaultScenario(data, 'souss-massa');
  assert.deepEqual(Object.keys(s).sort(), ['addedDesalMm3', 'demandReductionPct', 'hydrology', 'popGrowth', 'rainChangePct', 'regionId', 'reusePct', 'year']);
  assert.equal(s.hydrology, 'normal');
  assert.equal(s.year, START_YEAR);
  assert.equal(s.demandReductionPct, 0);
  assert.ok(Number.isFinite(s.rainChangePct));
  if (data.climate) assert.equal(s.rainChangePct, data.climate.basins['Souss-Massa'].summary.medianPct);
});

test('defaultScenario : région inconnue ne plante pas', () => {
  const s = defaultScenario(data, 'nulle-part');
  assert.equal(s.popGrowth, 0);
  assert.equal(s.rainChangePct, 0);
});

test('computeMetricByRegion : une entrée par région, flux pour les régions sans barrage', () => {
  const m = computeMetricByRegion({ data, scenario: defaultScenario(data, 'souss-massa'), tab: 'today' });
  assert.equal(Object.keys(m).length, data.balance.regions.length);
  assert.ok(m['souss-massa'].value > 0);
  assert.ok(['critique', 'tendu', 'confortable'].includes(m['souss-massa'].band));
  const flux = Object.values(m).filter(x => x.kind === 'flux');
  assert.ok(flux.length >= 1);
  for (const f of flux) assert.ok(['dominant', 'mixte', 'faible', null].includes(f.band ?? null));
});

test('computeMetricByRegion : sec ≤ humide à l’année 10, jamais NaN', () => {
  const base = defaultScenario(data, 'souss-massa');
  const dry = computeMetricByRegion({ data, scenario: { ...base, hydrology: 'dry', year: 2036 }, tab: 'tomorrow' });
  const wet = computeMetricByRegion({ data, scenario: { ...base, hydrology: 'wet', year: 2036 }, tab: 'tomorrow' });
  assert.ok(dry['souss-massa'].value <= wet['souss-massa'].value);
  for (const v of [...Object.values(dry), ...Object.values(wet)]) assert.ok(v.value === null || Number.isFinite(v.value));
});

test('computeMetricByRegion : données absentes → objet vide', () => {
  assert.deepEqual(computeMetricByRegion({ data: null }), {});
  assert.deepEqual(computeMetricByRegion({}), {});
});

test('regionModel : région à barrages a courbes et mois ; Sud sans stock a un flux', () => {
  const sm = regionModel(data, 'souss-massa');
  assert.equal(sm.noStock, false);
  assert.equal(Object.keys(sm.series).length, 3);
  assert.equal(sm.series.normal.length, 10);
  assert.ok(sm.monthsNow > 0);
  const gl = regionModel(data, 'dakhla-oued-ed-dahab');
  assert.equal(gl.noStock, true);
  assert.equal(gl.monthsNow, null);
  assert.deepEqual(gl.series, {});
  assert.ok(gl.fluxNow);
  assert.equal(regionModel(data, 'x'), null);
});

test('rankingFor, leversFor : formes et tri', () => {
  const sc = defaultScenario(data, 'souss-massa');
  const r = rankingFor(data, sc);
  assert.equal(r.length, data.balance.regions.length);
  const lv = leversFor(data, 'souss-massa', sc);
  for (let i = 1; i < lv.length; i++) assert.ok(lv[i - 1].deltaMonths >= lv[i].deltaMonths);
});

test('linksFor : filtre par région, Sud sans liaison documentée', { skip: !data.links }, () => {
  const sm = linksFor(data, 'souss-massa');
  assert.ok(sm.length > 0);
  for (const l of sm) assert.ok(l.regionIds.includes('souss-massa'));
  const order = sortLinks(linksFor(data, 'fes-meknes')).map(l => l.status);
  assert.deepEqual(order, [...order].sort((a, b) => ['en service', 'en construction', 'planifié'].indexOf(a) - ['en service', 'en construction', 'planifié'].indexOf(b)));
  assert.ok(NO_LINK_MESSAGE.startsWith('Aucune liaison physique documentée'));
  assert.ok(Array.isArray(projectsFor(data, 'souss-massa')));
});

test('liaisons : Guelmim, Dakhla et Laâyoune n’ont aucune liaison physique documentée (seulement des projets)', { skip: !data.links }, () => {
  for (const id of ['guelmim-oued-noun', 'dakhla-oued-ed-dahab', 'laayoune-sakia-el-hamra']) {
    const { physical, projects } = splitLinks(linksFor(data, id));
    assert.equal(physical.length, 0, id);
    assert.ok(projects.length >= 1, id);
  }
  assert.ok(splitLinks(linksFor(data, 'souss-massa')).physical.length > 0);
});

test('splitLinks, fluxStepOf, pctText', () => {
  const s = splitLinks([{ id: 'a', kind: 'projet', status: 'planifié' }, { id: 'b', kind: 'adduction', status: 'en service' }]);
  assert.deepEqual(s.physical.map(l => l.id), ['b']);
  assert.deepEqual(s.projects.map(l => l.id), ['a']);
  assert.deepEqual([0.1, 0.25, 0.7, 1, 2].map(fluxStepOf), [0, 1, 2, 3, 3]);
  assert.equal(pctText(0.086), '< 1');
  assert.equal(pctText(0), '0');
  assert.equal(pctText(57.4), '57');
});

test('scénario sans regionId : aucun curseur appliqué à une région à tort', () => {
  const sc = { hydrology: 'normal', popGrowth: 4, demandReductionPct: 0, addedDesalMm3: 0, reusePct: 0, rainChangePct: -40, year: 2030 };
  const a = computeMetricByRegion({ data, scenario: sc, tab: 'tomorrow' });
  const b = computeMetricByRegion({ data, scenario: { ...sc, popGrowth: 0, rainChangePct: 0 }, tab: 'tomorrow' });
  assert.deepEqual(a, b);
});

test('tendance satellite : Souss-Massa seulement, verdict de forecast.js respecté (gain faible = pas de prévision affichée)', () => {
  assert.equal(SATELLITE_REGION, 'souss-massa');
  assert.match(SATELLITE_LABEL, /pas un volume/);
  const t = satelliteTrend(j('storage-reconstruction.json'), j('fill-forecast.json'));
  assert.equal(t.status, 'ready');
  assert.ok(['hausse', 'baisse', 'indéterminée'].includes(t.direction));
  const fc = j('fill-forecast.json');
  if (fc.backtest.skillVsPersistence < SKILL_MIN) {
    assert.equal(t.verdict.beats, false);
    assert.equal(t.forecastShown, false);
    assert.match(t.verdict.text, /négligeable/);
  }
  const p = trendPaths(t.points);
  assert.ok(p.line.startsWith('M') && p.band.endsWith('Z'));
  assert.ok(!/NaN/.test(p.line + p.band));
});

test('tendance satellite : document absent, incohérent ou en attente = aucune courbe', () => {
  assert.equal(satelliteTrend(null, null).status, 'unavailable');
  assert.equal(satelliteTrend({ status: 'pending' }, null).status, 'unavailable');
  const bad = { status: 'ready', dams: [], regionTotal: [1, 2, 3, 4].map(i => ({ date: '2026-0' + i + '-15', volumeMm3: 10, low: 20, high: 5 })) };
  assert.equal(satelliteTrend(bad, null).status, 'inconsistent');
});

test('données ouvertes utilisées : sans cache, pas de date et « pas chargée dans cette session »', () => {
  const rows = openDataRows({});
  const od = rows.filter(r => /^open-meteo-(rain|et0|flood)$/.test(r.id));
  assert.equal(od.length, 3);
  for (const r of od) { assert.equal(r.at, null); assert.equal(r.statusLabel, NOT_LOADED); assert.ok(r.license && r.url); }
  const withCache = openDataRows({ rain: { at: Date.UTC(2026, 10, 23) }, flood: null });
  assert.equal(withCache.find(r => r.id === 'open-meteo-rain').at, '2026-11-23T00:00:00.000Z');
  assert.equal(withCache.find(r => r.id === 'open-meteo-flood').at, null);
  assert.equal(rows.find(r => r.id === 'open-meteo-climate').statusLabel, 'fichier absent');
});

test('mises en garde obligatoires : débit GloFAS = pas une jauge ni une alerte de crue ; cache de pluie versionné', () => {
  assert.match(FLOOD_CAVEAT, /pas une jauge ni une alerte de crue/);
  assert.notEqual(RAIN_CACHE_KIND, 'rain-panel');
});

const fill = j('dam-fill.json');
const regionOf = id => data.balance.regions.find(r => r.id === id);
const fakeRes = (body, type = 'application/json', ok = true) => ({ ok, headers: { get: () => type }, json: async () => { if (typeof body === 'string') return JSON.parse(body); return body; } });

test('basinDamsFor : Souss-Massa = 9 barrages triés du plus au moins rempli', () => {
  const v = basinDamsFor(fill, regionOf('souss-massa'));
  assert.equal(v.kind, 'ready');
  assert.equal(v.basins.length, 1);
  const d = v.basins[0].dams;
  assert.equal(d.length, 9);
  for (let i = 1; i < d.length; i++) assert.ok(d[i - 1].fillPct >= d[i].fillPct);
  assert.ok(d.every(x => x.fillPct >= 0 && x.fillPct <= 100));
  assert.ok(v.unverified);
});

test('basinDamsFor : Laâyoune et Dakhla = message honnête, aucun barrage inventé', () => {
  for (const id of ['laayoune-sakia-el-hamra', 'dakhla-oued-ed-dahab']) {
    const v = basinDamsFor(fill, regionOf(id));
    assert.equal(v.kind, 'none');
    assert.equal(v.basins.length, 0);
  }
  assert.match(NO_BASIN_MESSAGE, /Aucun barrage/);
  assert.equal(basinDamsFor(null, regionOf('souss-massa')).kind, 'none');
});

test('basinNamesFor : bassins pesant au moins 30 %, sinon le principal', () => {
  assert.deepEqual(basinNamesFor(regionOf('draa-tafilalet')).sort(), ['Drâa-Oued Noun', 'Guir-Ziz-Ghriss']);
  assert.deepEqual(basinNamesFor(regionOf('guelmim-oued-noun')), ['Drâa-Oued Noun']);
});

test('basinDamsFor : nom absent = nom arabe du bulletin', () => {
  const unnamed = fill.dams.find(x => !x.name);
  if (!unnamed) return;
  const rb = { basinShares: [{ basin: unnamed.basin, share: 1 }] };
  const row = basinDamsFor(fill, rb).basins[0].dams.find(x => x.name === unnamed.nameAr);
  assert.ok(row);
});

test('apiJson : réponse non JSON (index.html en 200) ou erreur = échec', async () => {
  await assert.rejects(apiJson('/api/x', undefined, async () => fakeRes('<html>', 'text/html')));
  await assert.rejects(apiJson('/api/x', undefined, async () => fakeRes('<html>', '')));
  await assert.rejects(apiJson('/api/x', undefined, async () => fakeRes({}, 'application/json', false)));
  await assert.rejects(apiJson('/api/x', undefined, async () => { throw new Error('réseau'); }));
  assert.deepEqual(await apiJson('/api/x', undefined, async () => fakeRes({ a: 1 })), { a: 1 });
});

test('probeServer : html = injoignable, JSON (même 401) = serveur', async () => {
  assert.equal(await probeServer(async () => fakeRes('<html>', 'text/html')), false);
  assert.equal(await probeServer(async () => { throw new Error('x'); }), false);
  assert.equal(await probeServer(async () => fakeRes({ user: null }, 'application/json', false)), true);
});
