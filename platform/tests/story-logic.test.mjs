// Logique pure du récit d'entrée (src/hub/stops.js) : chiffres lus dans les données, phrases calculées, mini-simulation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as S from '../src/hub/stops.js';

const read = f => JSON.parse(readFileSync(new URL('../public/data/' + f, import.meta.url)));
const opt = f => { try { return read(f); } catch { return null; } };
const data = {
  bulletin: read('national-bulletin.json'),
  balance: read('water-balance.json'),
  regions: read('regions.json'),
  geo: read('morocco-regions.geojson'),
  climate: opt('climate-outlook.json'),
  links: opt('water-links.json'),
  dams: opt('national-dams.json'),
};
const damFill = opt('dam-fill.json');

test('national facts come from the bulletin, last year flagged as derived note', () => {
  const n = S.nationalFacts(data);
  assert.equal(n.fillPct, data.bulletin.national.fillPct);
  assert.equal(n.storedMm3, data.bulletin.national.storedMm3);
  if (data.bulletin.national.sameDay2025Pct != null) {
    assert.ok(n.ratio > 0);
    assert.equal(n.lastYearNote, data.bulletin.national.sameDay2025Note ?? null);
  }
  assert.equal(S.nationalFacts({}), null);
});

test('basin spread reads min and max from the bulletin', () => {
  const sp = S.basinSpread(data);
  const v = data.bulletin.basins.map(b => b.fillPct);
  assert.equal(sp.lo.fillPct, Math.min(...v));
  assert.equal(sp.hi.fillPct, Math.max(...v));
  assert.equal(sp.rows.length, data.bulletin.basins.length);
  assert.equal(S.basinSpread({ bulletin: { national: {}, basins: [] } }), null);
});

test('south sentence is computed from water-links.json, never asserted without it', () => {
  const s = S.southLinks(data);
  if (!data.links) { assert.equal(s, null); return; }
  assert.deepEqual(s.ids, S.southRegionIds(data));
  assert.ok(s.sentence.includes(s.physicalCount === 0 ? 'Aucune liaison physique' : String(s.physicalCount)));
  // Avec une liaison physique ajoutée, la phrase change : elle n'est pas écrite en dur.
  const fake = { ...data, links: [...data.links, { id: 'x', kind: 'adduction', status: 'en service', regionIds: [s.ids[0]] }] };
  assert.equal(S.southLinks(fake).physicalCount, s.physicalCount + 1);
  assert.equal(S.southLinks({ ...data, links: null }), null);
});

test('climate facts count basins with a negative median', () => {
  const c = S.climateFacts(data);
  if (!data.climate) { assert.equal(c, null); return; }
  const med = Object.values(data.climate.basins).map(b => b.summary?.medianPct).filter(Number.isFinite);
  assert.equal(c.total, med.length);
  assert.equal(c.drier, med.filter(x => x < 0).length);
  assert.equal(c.exceptions.length, c.total - c.drier);
});

test('dam counts keep bulletin-read and map-located apart', () => {
  const c = S.damCounts(data, damFill);
  if (damFill) assert.equal(c.readCount, damFill.dams.length); else assert.equal(c.readCount, null);
  if (data.dams) assert.ok(c.locatedCount > 0);
  assert.equal(S.damCounts({}, null).readCount, null);
});

test('demand share is the sourced sector guide', () => {
  const dm = S.demandFacts(data);
  const g = data.balance.sectorGuide;
  if (!g) { assert.equal(dm, null); return; }
  assert.equal(dm.totalMm3, g.demand2020Mm3.value);
  assert.ok(dm.agriSharePct > 50 && dm.agriSharePct < 100);
});

test('key figures never repeat an id and carry a provenance status', () => {
  const f = S.keyFigures(data);
  assert.equal(new Set(f.map(x => x.id)).size, f.length);
  for (const x of f) assert.ok(['sourced', 'derived', 'hypothese'].includes(x.status));
});

test('mini simulation: savings and desalination add months, south regions get a flux share', () => {
  const dam = data.balance.regions.find(r => r.basinShares?.length);
  const base = S.miniSim(data, dam.id);
  assert.equal(base.kind, 'months');
  assert.ok(Number.isFinite(base.value));
  const saved = S.miniSim(data, dam.id, { savingsPct: 20 });
  assert.ok(saved.value > base.value);
  assert.ok(saved.delta > 0);
  const desal = S.miniSim(data, dam.id, { desalMm3: 50 });
  assert.ok(desal.value > base.value);
  const south = S.southRegionIds(data)[0];
  if (south) {
    const f = S.miniSim(data, south);
    assert.ok(f === null || f.kind === 'flux');
    if (f) assert.ok(f.value >= 0 && f.value <= 100);
  }
  assert.equal(S.miniSim(data, 'nope'), null);
});

test('camera stops are well formed and follow the chapter order', () => {
  const chapters = S.CHAPTERS.map(c => c.id);
  let last = -1;
  for (const s of S.STORY_STOPS) {
    assert.equal(s.center.length, 2);
    assert.ok(Number.isFinite(s.zoom) && Number.isFinite(s.pitch));
    if (s.chapter) { const i = chapters.indexOf(s.chapter); assert.ok(i >= last); last = i; }
  }
  assert.ok(S.STORY_STOPS.some(s => s.revealDams));
  const r = S.regionStop(data, 'souss-massa');
  assert.ok(r && r.center.every(Number.isFinite));
});
