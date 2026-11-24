import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BAND_SEPARATION_MIN, COLORS_JS, bandSeparation, colorsSource, contrast, contrastReport, parseTokens } from '../scripts/design-lib.mjs';

test('design tokens: palette v2 is derived from the SRM colours', () => {
  const t = parseTokens();
  assert.equal(t['--az-accent'], '#12508f'); // SRM blue
  assert.equal(t['--az-action'], '#fab61f'); // SRM yellow
  assert.equal(t['--az-band-confortable-fill'], '#57b24a'); // SRM green
  assert.equal(t['--az-deep-bg'], '#12508f');
});

test('design tokens: band fills separate without hue (luminance order and spread)', () => {
  for (const s of bandSeparation()) {
    assert.ok(s.lighter, `${s.pair}: the better band must be lighter`);
    assert.ok(s.ratio >= BAND_SEPARATION_MIN, `${s.pair}: ${s.ratio} < ${BAND_SEPARATION_MIN}`);
  }
});

test('design tokens: src/design/colors.js is generated from tokens.css', () => {
  assert.equal(readFileSync(COLORS_JS, 'utf8'), colorsSource(), 'run npm run gen:colors');
});

test('design tokens: contrast formula matches WCAG reference values', () => {
  assert.equal(Math.round(contrast('#000000', '#ffffff') * 100) / 100, 21);
  assert.equal(Math.round(contrast('#767676', '#ffffff') * 100) / 100, 4.54);
});

test('design tokens: every documented pair passes AA', () => {
  const bad = contrastReport().filter(c => !c.ok);
  assert.deepEqual(bad, []);
});
