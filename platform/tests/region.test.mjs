import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const region = JSON.parse(readFileSync(resolve(root, 'public/data/region.json'), 'utf8'));
const sourceIds = new Set(region.sources.map(source => source.id));
const facilities = region.facilities;

test('every facility cites non-empty sources that resolve in the source registry and states a location accuracy', () => {
  assert.ok(facilities.length > 0, 'region.json has facilities');
  for (const facility of facilities) {
    assert.ok(Array.isArray(facility.sourceIds) && facility.sourceIds.length > 0, `${facility.id}: sourceIds must be a non-empty list`);
    for (const id of facility.sourceIds) assert.ok(sourceIds.has(id), `${facility.id}: unknown source id "${id}"`);
    assert.ok(typeof facility.locationAccuracy === 'string' && facility.locationAccuracy.trim() !== '', `${facility.id}: locationAccuracy is missing`);
    if (facility.locationSourceId !== undefined) assert.ok(sourceIds.has(facility.locationSourceId), `${facility.id}: unknown locationSourceId "${facility.locationSourceId}"`);
  }
});

test('latest dam snapshot matches the published regional totals (23 Nov 2026)', () => {
  const latest = [...region.snapshots].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  assert.equal(latest.date, '2026-11-23');
  assert.equal(latest.storageMm3, 382.72);
  assert.equal(latest.capacityMm3, 722.83);
  assert.equal(latest.fillPct, 52.95);
  assert.equal(region.region.storageMm3, 382.72);
  assert.equal(region.region.capacityMm3, 722.83);
  assert.equal(region.region.fillPct, 52.95);
});

test('facilities include nine dams', () => {
  assert.equal(facilities.filter(facility => facility.kind === 'dam').length, 9);
});

// A quality-index mention is allowed only when its surrounding text says no such score is computed.
const negation = /\b(aucun|aucune|pas|sans|non)\b|\bne\b[^<>]{0,60}\bpas\b/i;
const uiFiles = [
  resolve(root, 'src/App.jsx'),
  ...readdirSync(resolve(root, 'src/components'))
    .filter(name => name.endsWith('.jsx'))
    .map(name => resolve(root, 'src/components', name)),
  ...readdirSync(resolve(root, 'src/pages'))
    .filter(name => name.endsWith('.jsx'))
    .map(name => resolve(root, 'src/pages', name)),
];

test('UI never presents a computed WQI or quality index score', () => {
  const scorePatterns = [/\bWQI\b/i, /\bindice\s+(global\s+)?de\s+qualit/i];
  for (const file of uiFiles) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of scorePatterns) {
      for (const match of text.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))) {
        const window = text.slice(Math.max(0, match.index - 120), match.index + 120);
        assert.ok(negation.test(window), `${file}: quality index wording without a disclaimer near: ${JSON.stringify(text.slice(match.index - 40, match.index + 80))}`);
      }
    }
  }
});

test('UI never labels water as potable or non potable as a value', () => {
  // A value is a whole string or JSX text node equal to "Potable" / "Non potable".
  // Descriptive phrases such as "Eau potable" or "Réutilisation non potable" are not classifications.
  const valuePattern = /(['"`>])\s*(non\s+)?potable\s*\.?\s*(['"`<])/gi;
  for (const file of uiFiles) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(valuePattern)) {
      assert.fail(`${file}: potability used as a classification value: ${JSON.stringify(match[0])}`);
    }
  }
});
