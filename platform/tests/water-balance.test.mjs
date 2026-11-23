import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = name => JSON.parse(readFileSync(resolve(root, 'public/data', name), 'utf8'));
const wb = readJson('water-balance.json');
const regionsDoc = readJson('regions.json');
const bulletin = readJson('national-bulletin.json');
const STATUS = new Set(['sourced', 'derived', 'hypothese']);

function walk(node, path, visit) {
  if (Array.isArray(node)) node.forEach((v, i) => walk(v, path + '[' + i + ']', visit));
  else if (node && typeof node === 'object') {
    visit(node, path);
    for (const [k, v] of Object.entries(node)) walk(v, path + '.' + k, visit);
  }
}

test('water-balance.json lists the 12 regions of regions.json', () => {
  const ids = regionsDoc.regions.map(r => r.id).sort();
  assert.deepEqual(wb.regions.map(r => r.id).sort(), ids);
  assert.equal(wb.regions.length, 12);
});

test('every number object has a valid status and a source; sourced needs an http source and a date', () => {
  let n = 0;
  walk(wb, 'wb', (o, path) => {
    const isNumberObj = 'value' in o || 'dry' in o;
    if (!isNumberObj) return;
    n++;
    assert.ok(STATUS.has(o.status), path + ': status must be sourced|derived|hypothese');
    assert.ok(typeof o.source === 'string' && o.source.trim() !== '', path + ': source is required');
    if (o.status === 'sourced') {
      assert.match(o.source, /^https?:\/\//, path + ': sourced needs an http(s) source');
      assert.ok(typeof o.date === 'string' && o.date !== '', path + ': sourced needs a date');
    }
  });
  assert.ok(n > 100, 'expected many number objects, saw ' + n);
});

test('groundwater is null for every region (not modelled), never 0', () => {
  for (const r of wb.regions) assert.strictEqual(r.groundwater, null, r.id);
});

test('basin shares: known basins, sum <= 1 per basin; Laayoune and Dakhla carry no basin', () => {
  const names = new Set(bulletin.basins.map(b => b.name));
  const sums = {};
  for (const r of wb.regions) for (const s of r.basinShares) {
    assert.ok(names.has(s.basin), r.id + ': unknown basin ' + s.basin);
    assert.equal(s.status, 'hypothese');
    sums[s.basin] = (sums[s.basin] || 0) + s.share;
  }
  for (const [b, v] of Object.entries(sums)) assert.ok(v <= 1 + 1e-9, b + ' shares sum to ' + v);
  for (const id of ['laayoune-sakia-el-hamra', 'dakhla-oued-ed-dahab']) {
    const r = wb.regions.find(x => x.id === id);
    assert.deepEqual(r.basinShares, []);
    assert.ok(r.stockNote);
  }
  for (const b of wb.basins) assert.ok(names.has(b.name), 'unknown basin in basins[]: ' + b.name);
});

test('water-balance.json holds no transfer-volume key', () => {
  const forbidden = /volume.*transf|transferable/i;
  const offending = [];
  walk(wb, 'wb', (o, path) => { for (const k of Object.keys(o)) if (forbidden.test(k)) offending.push(path + '.' + k); });
  assert.deepEqual(offending, []);
  for (const p of wb.projects) assert.ok(p.kind !== 'interconnexion' || p.capacityMm3PerYear === null, p.id + ': no volume on interconnexions');
});

test('no project points south from a northern basin; project regions exist', () => {
  const ids = new Set(regionsDoc.regions.map(r => r.id));
  for (const p of wb.projects) {
    for (const id of p.regionIds) assert.ok(ids.has(id), p.id + ' ' + id);
    assert.match(p.source, /^https?:\/\//, p.id);
    if (p.kind === 'interconnexion') for (const id of p.regionIds) assert.ok(!/guelmim|laayoune|dakhla|souss|draa/.test(id), p.id + ': interconnexion toward the south is not documented');
  }
});

test('climate-outlook.json is labelled as a modelled projection with uncertainty', () => {
  const c = readJson('climate-outlook.json');
  assert.match(c.label, /Projection modélisée/);
  assert.match(c.label, /non commercial/);
  assert.match(c.label, /incertitude/);
  const names = new Set(bulletin.basins.map(b => b.name));
  for (const [b, v] of Object.entries(c.basins)) {
    assert.ok(names.has(b), b);
    assert.ok(v.summary.nModels >= 1, b + ' has no usable model');
  }
});
