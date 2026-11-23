import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import {
  VERDICT_BAD, fillText, parseState, rainTotals, validateBands, validateForecast, validateReconstruction, verdict,
} from '../src/lib/forecast.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('pending or malformed documents give the pending state', () => {
  assert.equal(parseState({ status: 'pending' }, 'reconstruction').state, 'pending');
  assert.equal(parseState(null, 'forecast').state, 'pending');
  assert.equal(parseState({}, 'forecast').state, 'pending');
  assert.equal(parseState({ status: 'ready' }, 'reconstruction').state, 'invalid');
  assert.equal(parseState({ status: 'ready', dams: [] }, 'reconstruction').state, 'ready');
  assert.equal(parseState({ status: 'ready', backtest: {} }, 'forecast').state, 'ready');
});

test('shipped placeholders are pending', () => {
  for (const [f, k] of [['storage-reconstruction.json', 'reconstruction'], ['fill-forecast.json', 'forecast']]) {
    const doc = JSON.parse(readFileSync(resolve(root, 'public/data', f), 'utf8'));
    if (doc.status !== 'ready') assert.equal(parseState(doc, k).state, 'pending');
  }
});

test('weak skill is not presented as a good verdict', () => {
  const weak = verdict({ backtest: { beatsBaselines: true, skillVsPersistence: 0.057 } });
  assert.equal(weak.beats, false);
  assert.equal(weak.weak, true);
  assert.match(weak.text, /négligeable/);
  const solid = verdict({ backtest: { beatsBaselines: true, skillVsPersistence: 0.25 } });
  assert.equal(solid.beats, true);
});

test('verdict follows beatsBaselines only', () => {
  const bad = verdict({ backtest: { beatsBaselines: false, skillVsPersistence: 0.9 } });
  assert.equal(bad.beats, false);
  assert.equal(bad.text, VERDICT_BAD);
  assert.equal(bad.tone, 'bad');
  const good = verdict({ backtest: { beatsBaselines: true } });
  assert.equal(good.beats, true);
  assert.notEqual(good.text, VERDICT_BAD);
  const unknown = verdict({ backtest: {} });
  assert.equal(unknown.known, false);
  assert.equal(unknown.beats, false);
});

test('band validator reports low <= volume <= high violations', () => {
  assert.deepEqual(validateBands([{ date: '2026-01-01', volumeMm3: 5, low: 4, high: 6 }]), []);
  assert.equal(validateBands([{ date: '2026-01-02', volumeMm3: 7, low: 4, high: 6 }]).length, 1);
  assert.equal(validateBands([{ date: '2026-01-03', volumeMm3: 3, low: 4, high: 6 }]).length, 1);
  assert.equal(validateBands([{ date: '2026-01-04', volumeMm3: null, low: 4, high: 6 }]).length, 1);
  const rec = { dams: [{ id: 'a', series: [{ date: 'd', volumeMm3: 9, low: 1, high: 2 }] }], regionTotal: [{ date: 'd', volumeMm3: 1, low: 0, high: 2 }] };
  assert.equal(validateReconstruction(rec).length, 1);
  assert.equal(validateForecast({ scenarios: [{ name: 'sec', points: [{ date: 'd', volumeMm3: 1, low: 2, high: 3 }] }] }).length, 1);
});

test('fill percentages always carry the word estimé', () => {
  for (const v of [0, 12.34, 100, NaN, undefined, null]) assert.match(fillText(v), /estimé/);
  const src = readFileSync(resolve(root, 'src/pages/ForecastPage.jsx'), 'utf8');
  for (const m of src.matchAll(/fillPct/g)) {
    const around = src.slice(Math.max(0, m.index - 40), m.index + 40);
    assert.match(around, /fillText\(/, `fillPct rendered without fillText: ${around}`);
  }
});

test('rain totals fall back to daily sums using the API kind names', () => {
  const p = { daily: [{ kind: 'past_modelled', precipitation_mm: 2 }, { kind: 'past_modelled', precipitation_mm: 1 }, { kind: 'forecast', precipitation_mm: 4 }] };
  assert.deepEqual(rainTotals(p), { past30: 3, forecast7: 4 });
  assert.deepEqual(rainTotals({ totals: { past30Mm: 10, forecast7Mm: 0 }, daily: [] }), { past30: 10, forecast7: 0 });
  assert.deepEqual(rainTotals({ daily: [] }), { past30: null, forecast7: null });
});

test('forecast UI files avoid forbidden quality wording', () => {
  for (const f of ['src/pages/ForecastPage.jsx', 'src/components/RainPanel.jsx', 'src/lib/forecast.js']) {
    assert.doesNotMatch(readFileSync(resolve(root, f), 'utf8'), /potable|WQI/i);
  }
  assert.ok(readdirSync(resolve(root, 'src/pages')).includes('ForecastPage.jsx'));
});
