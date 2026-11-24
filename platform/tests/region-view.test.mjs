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
const parse = h => parseRoute(h);
const route = (view, regionId = null, tab = 'today', page = null) => ({ view, regionId, tab, page });

test('hash parsing: story, exploration with tab, sources', () => {
  assert.deepEqual(parse(''), route('story'));
  assert.deepEqual(parse('#/'), route('story'));
  assert.deepEqual(parse('#/r/oriental'), route('explore', 'oriental'));
  assert.deepEqual(parse('#/r/oriental/tomorrow'), route('explore', 'oriental', 'tomorrow'));
  assert.deepEqual(parse('#/r/oriental/nope'), route('explore', 'oriental', 'today'));
  assert.deepEqual(parse('#/r'), route('explore', 'souss-massa'));
  assert.deepEqual(parse('#/sources'), route('sources'));
  assert.deepEqual(parse('#/x'), route('story'));
});

test('old addresses redirect to the hub equivalent', () => {
  assert.deepEqual(parse('#/app/overview'), route('explore', 'souss-massa', 'today'));
  assert.deepEqual(parse('#/app/overview/oriental'), route('explore', 'oriental', 'today'));
  assert.deepEqual(parse('#/app/map'), route('explore', 'souss-massa', 'today'));
  assert.deepEqual(parse('#/app/balance/oriental'), route('explore', 'oriental', 'tomorrow'));
  assert.deepEqual(parse('#/app/forecast'), route('explore', 'souss-massa', 'tomorrow'));
  assert.deepEqual(parse('#/app/regions'), route('explore', 'souss-massa', 'together'));
  assert.deepEqual(parse('#/app/sources'), route('sources'));
  assert.deepEqual(parse('#/app'), route('explore', 'souss-massa', 'today'));
  assert.deepEqual(parse('#overview'), route('explore', 'souss-massa', 'today'));
});

test('annex pages stay on the old shell', () => {
  assert.deepEqual(parse('#/app/quality'), route('annex', null, 'today', 'quality'));
  assert.deepEqual(parse('#/app/cycle'), route('annex', null, 'today', 'cycle'));
});

test('canonical hash round-trips and normalises', () => {
  assert.equal(canonicalHash(parse('#/app/regions/souss-massa')), '#/r/souss-massa/together');
  assert.equal(canonicalHash(parse('#/app/overview/oriental')), '#/r/oriental');
  assert.equal(canonicalHash(parse('#/app/balance')), '#/r/souss-massa/tomorrow');
  assert.equal(canonicalHash(parse('#/app/sources')), '#/sources');
  assert.equal(canonicalHash(parse('#/app/quality')), '#/app/quality');
  assert.equal(canonicalHash(parse('#/x')), '#/');
  for (const h of ['#/', '#/r/oriental', '#/r/oriental/together', '#/sources', '#/app/cycle']) assert.equal(canonicalHash(parse(h)), h);
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
