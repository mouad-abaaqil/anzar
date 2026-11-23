import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = name => JSON.parse(readFileSync(resolve(root, 'public/data', name), 'utf8'));
const regionsDoc = readJson('regions.json');
const bulletin = readJson('national-bulletin.json');
const regions = regionsDoc.regions;
const regionIds = new Set(regions.map(r => r.id));
const sourceIds = new Set(regionsDoc.sources.map(s => s.id));
const basinNames = new Set(bulletin.basins.map(b => b.name));

test('every region has operator acronym, status, date, evidence and at least one resolving source', () => {
  assert.equal(regions.length, 12, 'regions.json lists twelve regions');
  for (const region of regions) {
    const op = region.operator;
    assert.ok(op && typeof op.acronym === 'string' && op.acronym.trim() !== '', `${region.id}: operator.acronym is missing`);
    assert.ok(typeof op.status === 'string' && op.status.trim() !== '', `${region.id}: operator.status is missing`);
    assert.ok(typeof op.date === 'string' && op.date.trim() !== '', `${region.id}: operator.date is missing`);
    assert.ok(typeof op.evidence === 'string' && op.evidence.trim() !== '', `${region.id}: operator.evidence is missing`);
    assert.ok(Array.isArray(op.sourceIds) && op.sourceIds.length > 0, `${region.id}: operator.sourceIds must be a non-empty list`);
    for (const id of op.sourceIds) assert.ok(sourceIds.has(id), `${region.id}: unknown source id "${id}"`);
  }
});

test('region ids are unique and neighbours reference existing regions symmetrically', () => {
  assert.equal(regionIds.size, regions.length, 'region ids are unique');
  const byId = new Map(regions.map(r => [r.id, r]));
  for (const region of regions) {
    assert.ok(Array.isArray(region.neighbours), `${region.id}: neighbours must be a list`);
    for (const n of region.neighbours) {
      assert.ok(regionIds.has(n), `${region.id}: unknown neighbour "${n}"`);
      assert.notEqual(n, region.id, `${region.id}: a region cannot neighbour itself`);
      assert.ok(byId.get(n).neighbours.includes(region.id), `${region.id} -> ${n} is not symmetric`);
    }
  }
});

test('every region basin is null or a basin named in national-bulletin.json', () => {
  for (const region of regions) {
    if (region.basin === null) continue;
    assert.ok(basinNames.has(region.basin), `${region.id}: basin "${region.basin}" is not in national-bulletin.json`);
  }
});

test('basin stored volumes sum to the national total within 0.05 Mm³', () => {
  const sum = bulletin.basins.reduce((total, basin) => total + basin.storedMm3, 0);
  assert.ok(Math.abs(sum - bulletin.national.storedMm3) <= 0.05, `sum ${sum.toFixed(2)} differs from national ${bulletin.national.storedMm3}`);
});

test('every region logo is null or an existing file under public/', () => {
  for (const region of regions) {
    if (region.logo === null) continue;
    assert.ok(existsSync(resolve(root, 'public', region.logo.replace(/^\//, ''))), `${region.id}: logo file not found: ${region.logo}`);
  }
});

test('every region icon file exists under public/', () => {
  for (const region of regions) {
    assert.ok(typeof region.icon === 'string' && region.icon.startsWith('/brand/operators/icons/'), `${region.id}: icon path missing`);
    assert.ok(existsSync(resolve(root, 'public', region.icon.replace(/^\//, ''))), `${region.id}: icon file not found: ${region.icon}`);
  }
});

test('regions.json holds no transfer-volume key', () => {
  const forbidden = /volume.*transf|transferable/i;
  const keys = [];
  const walk = value => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        keys.push(key);
        walk(child);
      }
    }
  };
  walk(regionsDoc);
  const offending = keys.filter(key => forbidden.test(key));
  assert.deepEqual(offending, [], 'no key may describe a transferable volume');
});
