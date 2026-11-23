import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { validateReconstruction, validateForecast, RECONSTRUCTION_LABEL, FORECAST_LABEL } from '../src/lib/forecast.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rec = JSON.parse(readFileSync(resolve(root, 'public/data/storage-reconstruction.json'), 'utf8'));
const fc = JSON.parse(readFileSync(resolve(root, 'public/data/fill-forecast.json'), 'utf8'));

const noNaN = (o, path = '') => {
  if (typeof o === 'number') assert.ok(Number.isFinite(o), `non-finite number at ${path}`);
  else if (Array.isArray(o)) o.forEach((v, i) => noNaN(v, `${path}[${i}]`));
  else if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => noNaN(v, `${path}.${k}`));
};

test('storage reconstruction: bands, capacity, labels, validation flags', () => {
  if (rec.status !== 'ready') return; // pending is acceptable
  assert.equal(rec.label, RECONSTRUCTION_LABEL);
  assert.deepEqual(validateReconstruction(rec), []);
  noNaN(rec);
  for (const d of rec.dams) {
    assert.ok(d.estimated === true);
    assert.ok(d.fit.b >= 1 && d.fit.b <= 2 && d.fit.bLow <= d.fit.bHigh);
    for (const s of d.series) {
      assert.ok(s.low <= s.volumeMm3 && s.volumeMm3 <= s.high, `${d.id} ${s.date}`);
      assert.ok(s.volumeMm3 <= 1.05 * d.capacityMm3, `${d.id} ${s.date} exceeds capacity`);
      if (s.fillPct !== undefined) assert.equal(s.estimated, true, `${d.id} ${s.date} fillPct without estimated flag`);
    }
  }
  for (const v of rec.regionTotal) assert.equal(v.estimated, true);
  assert.ok(rec.validation.length > 0);
  for (const v of rec.validation) assert.strictEqual(v.usedInCalibration, false, v.name);
  assert.ok(rec.validation.some(v => /cinq petits barrages : valeurs lues sur graphique, non estimées par satellite/.test(v.composition || '')));
  assert.ok(Array.isArray(rec.caveats) && rec.caveats.length > 0);
});

test('fill forecast: labels, bands, honest backtest', () => {
  if (fc.status !== 'ready') return;
  assert.equal(fc.label, FORECAST_LABEL);
  assert.deepEqual(validateForecast(fc), []);
  noNaN(fc);
  assert.equal(typeof fc.backtest.beatsBaselines, 'boolean');
  const m = Object.fromEntries(fc.backtest.metrics.map(x => [x.model, x]));
  assert.equal(fc.backtest.beatsBaselines, m['modèle'].maeMm3 < m['persistance'].maeMm3 && m['modèle'].maeMm3 < m['climatologie'].maeMm3);
  assert.ok(fc.scenarios.length >= 3 && fc.scenarioBasis);
  assert.ok(fc.caveats.some(c => /lâchers|Lâchers/.test(c)));
});
