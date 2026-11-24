import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { joinDamFill, normalizeName, normalizeArabic, damTooltip, damSize, fillLevel } from '../src/hub/damsData.js';

const rj = f => JSON.parse(readFileSync(new URL('../public/data/' + f, import.meta.url), 'utf8'));

test('normalisation des noms : casse, accents, barrage, Al/El, variantes', () => {
  assert.equal(normalizeName('Barrage Bin el Ouidane'), normalizeName('Bin El Ouidane'));
  assert.equal(normalizeName("barrage de l'Oued al Maleh"), normalizeName('Oued El Maleh'));
  assert.equal(normalizeName('Idriss 1Er'), normalizeName('Idriss Premier'));
  assert.equal(normalizeName('Mokhtar Soussi'), normalizeName('Moukhtar Soussi'));
  assert.equal(normalizeName('Allal Al Fassi'), normalizeName('Allal El Fassi'));
  assert.notEqual(normalizeName('Hassan II'), normalizeName('Hassan 1er'));
  assert.equal(normalizeArabic('سد أحمد الحنصالي'), normalizeArabic('احمد الحنصالي'));
});

test('jointure : exact seulement sans ambiguïté, sinon approximatif sans remplissage', () => {
  const national = [
    { id: 'a', name: 'Barrage Al Massira', lat: 32.5, lon: -7.6, regionId: 'casablanca-settat', capacityMm3: 2760 },
    { id: 'h1', name: 'Barrage Hassan II', lat: 34.2, lon: -2.6, regionId: 'oriental' },
    { id: 'h2', name: 'barrage Hassan-II', lat: 32.8, lon: -4.8, regionId: 'draa-tafilalet' },
    { id: 'x', name: 'Barrage Moulay Ali', lat: 30, lon: -5, regionId: 'draa-tafilalet' },
    { id: 'w', name: 'Wrong Region', lat: 35, lon: -5, regionId: 'tanger-tetouan-al-hoceima' },
  ];
  const fill = { date: '2026-11-23', dams: [
    { name: 'Al Massira', nameAr: 'المسيرة', basin: 'Oum Er-Rbia', storedMm3: 1153, fillPct: 41.78, derivedCapacityMm3: 2760 },
    { name: 'Hassan II', nameAr: 'الحسن الثاني', basin: 'Moulouya', storedMm3: 100, fillPct: 50 },
    { name: 'Moulay Ali Cherif', nameAr: 'مولاي علي الشريف', basin: 'Drâa-Oued Noun', storedMm3: 1, fillPct: 10 },
    { name: 'Wrong Region', nameAr: null, basin: 'Tensift', storedMm3: 1, fillPct: 10 },
    { name: null, nameAr: 'خروب', basin: 'Loukkos', storedMm3: 1, fillPct: 10 },
  ] };
  const r = joinDamFill(national, fill);
  const by = Object.fromEntries(r.located.map(d => [d.id, d]));
  assert.equal(by.a.match, 'exact');
  assert.equal(by.a.fillPct, 41.78);
  assert.equal(by.a.asOf, '2026-11-23');
  for (const id of ['h1', 'h2', 'x', 'w']) {
    assert.equal(by[id].fillPct, null, id + ' ne doit pas recevoir de remplissage');
  }
  assert.equal(by.h1.match, 'approximatif');
  assert.equal(by.x.match, 'approximatif');
  assert.equal(by.w.match, 'approximatif');
  assert.equal(r.unmatchedFill.length, 4);
});

test('données réelles : 96 localisés, aucun remplissage inventé, sommes cohérentes', () => {
  const fill = rj('dam-fill.json');
  const r = joinDamFill(rj('national-dams.json'), fill, rj('region.json'));
  assert.equal(r.located.length, 96);
  const filled = r.located.filter(d => d.fillPct !== null);
  assert.ok(filled.length >= 35, 'au moins 35 barrages joints (' + filled.length + ')');
  assert.ok(filled.every(d => d.match === 'exact'));
  assert.ok(r.located.filter(d => d.match === 'approximatif').every(d => d.fillPct === null && d.storedMm3 === null));
  // Chaque remplissage posé correspond mot pour mot à une ligne du bulletin (ou de region.json, daté).
  for (const d of filled.filter(x => x.fillSource === 'bulletin')) {
    assert.ok(fill.dams.some(f => f.fillPct === d.fillPct && f.storedMm3 === d.storedMm3), d.id);
  }
  // Une ligne du bulletin est soit jointe (une fois), soit listée comme non jointe.
  const joinedRows = new Set(filled.filter(x => x.fillSource === 'bulletin').map(d => d.fillPct + '|' + d.storedMm3));
  assert.equal(joinedRows.size + r.unmatchedFill.length, fill.dams.length);
  // Cas ambigus connus : deux sites distincts portent le même nom.
  const hassan = r.located.filter(d => /hassan.?ii$/i.test(d.name));
  assert.ok(hassan.length === 2 && hassan.every(d => d.fillPct === null));
});

test('infobulle et tailles', () => {
  const t = damTooltip({ name: 'Al Wahda', basin: 'Sebou', fillPct: 73.87, storedMm3: 2807, capacityMm3: 3800, capacitySource: 'publiée', asOf: '2026-11-23' });
  assert.equal(t.title, 'Barrage Al Wahda');
  assert.ok(t.lines.some(l => l.includes('23 nov. 2026') && l.includes('pas un relevé en direct')));
  const u = damTooltip({ name: 'barrage Itzer', fillPct: null, capacityMm3: null, match: 'approximatif' });
  assert.equal(u.title, 'Barrage Itzer');
  assert.equal(damTooltip({ name: 'Tiniourkane Dam', fillPct: null }).title, 'Barrage Tiniourkane');
  assert.equal(damTooltip({ name: 'Idriss 1Er', fillPct: null }).title, 'Barrage Idriss 1er');
  assert.equal(damTooltip({ name: 'سد ساهلة', fillName: 'Sahla', fillPct: null }).title, 'Barrage Sahla');
  assert.ok(u.lines.some(l => l.includes('non affiché')));
  assert.ok(damSize(3800, 5) > damSize(10, 5));
  assert.ok(damSize(null, 5) < damSize(10, 5));
  assert.equal(fillLevel(10), 'bas'); assert.equal(fillLevel(45), 'moyen'); assert.equal(fillLevel(80), 'haut'); assert.equal(fillLevel(null), null);
});
