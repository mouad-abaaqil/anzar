import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { basinForRegionId, canonicalHash, parseRoute, resolveRegionId } from '../src/lib/regions.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = name => JSON.parse(readFileSync(resolve(root, 'public/data', name), 'utf8'));
const doc = readJson('regions.json');
const bulletin = readJson('national-bulletin.json');
const pages = ['overview', 'map', 'quality', 'cycle', 'regions', 'forecast', 'sources'];
const parse = h => parseRoute(h, pages);

test('hash parsing keeps page and region, default region is implicit', () => {
  assert.deepEqual(parse('#/app/map/oriental'), { view: 'app', page: 'map', regionId: 'oriental' });
  assert.deepEqual(parse('#/app/regions/souss-massa'), { view: 'app', page: 'regions', regionId: null });
  assert.deepEqual(parse('#/app'), { view: 'app', page: 'overview', regionId: null });
  assert.deepEqual(parse('#/app/nope/oriental'), { view: 'app', page: 'overview', regionId: null });
  assert.deepEqual(parse('#overview'), { view: 'app', page: 'overview', regionId: null });
  assert.equal(parse('').view, 'landing');
});

test('canonical hash round-trips and normalises', () => {
  assert.equal(canonicalHash(parse('#/app/regions/souss-massa')), '#/app/regions');
  assert.equal(canonicalHash(parse('#/app/overview/oriental')), '#/app/overview/oriental');
  assert.equal(canonicalHash({ view: 'app', page: 'map', regionId: 'oriental' }), '#/app/map/oriental');
  assert.equal(canonicalHash(parse('#/x')), '#/');
});

test('unknown region ids fall back to souss-massa', () => {
  assert.equal(resolveRegionId(doc.regions, 'oriental'), 'oriental');
  assert.equal(resolveRegionId(doc.regions, 'atlantis'), 'souss-massa');
  assert.equal(resolveRegionId(doc.regions, null), 'souss-massa');
});

test('region basin lookup follows the bulletin and returns null without basin', () => {
  const oriental = basinForRegionId(doc, bulletin, 'oriental');
  assert.equal(oriental.name, 'Moulouya');
  assert.equal(typeof oriental.fillPct, 'number');
  assert.equal(basinForRegionId(doc, bulletin, 'atlantis'), null);
  for (const r of doc.regions.filter(r => !r.basin)) assert.equal(basinForRegionId(doc, bulletin, r.id), null);
});
