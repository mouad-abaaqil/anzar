import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const links = JSON.parse(readFileSync(new URL('../public/data/water-links.json', import.meta.url), 'utf8'));
const list = Array.isArray(links) ? links : links.links;
const STATUS = ['en service', 'en construction', 'planifié'];
const FORBIDDEN_KEY = /transferable|volumetransf|volume_transf|transferred|transfere/i;

function keys(o, out = []) {
  if (Array.isArray(o)) o.forEach(v => keys(v, out));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { out.push(k); keys(v, out); }
  return out;
}

test('water-links: non-empty list', () => { assert.ok(list.length > 0); });

test('water-links: chaque lien a sourceUrl (http) et un statut connu', () => {
  for (const l of list) {
    assert.match(String(l.sourceUrl), /^https?:\/\//, l.id);
    assert.ok(STATUS.includes(l.status), l.id + ' statut ' + l.status);
    assert.ok(l.id && l.from?.name && l.to?.name, l.id);
  }
});

test('water-links: aucune clé de transfert ou de volume transférable', () => {
  const bad = keys(links).filter(k => FORBIDDEN_KEY.test(k));
  assert.deepEqual(bad, []);
});

test('water-links: lat/lon uniquement quand fournis (paire complète, dans le Maroc)', () => {
  for (const l of list) {
    for (const p of [l.from, l.to]) {
      const a = p.lat === null || p.lat === undefined;
      const o = p.lon === null || p.lon === undefined;
      assert.equal(a, o, l.id + ' : lat et lon vont ensemble');
      if (!a) {
        assert.ok(typeof p.lat === 'number' && p.lat > 20 && p.lat < 36.5, l.id + ' lat');
        assert.ok(typeof p.lon === 'number' && p.lon > -18 && p.lon < -0.5, l.id + ' lon');
      }
    }
  }
});

test('water-links: lat/lon présents ⇒ coordSource {name, url, readDate} et coordonnées dans les bornes du Maroc', () => {
  let located = 0;
  for (const l of list) {
    for (const [side, p] of [['from', l.from], ['to', l.to]]) {
      if (p.lat === null || p.lat === undefined) {
        assert.ok(p.lon === null || p.lon === undefined, l.id + ' ' + side);
        assert.ok(!p.coordSource, l.id + ' ' + side + ' : coordSource sans coordonnées');
        continue;
      }
      located += 1;
      const cs = p.coordSource;
      assert.ok(cs && typeof cs === 'object', l.id + ' ' + side + ' : coordonnées sans coordSource');
      assert.ok(typeof cs.name === 'string' && cs.name.length > 0, l.id + ' ' + side + ' coordSource.name');
      assert.match(String(cs.url), /^https?:\/\//, l.id + ' ' + side + ' coordSource.url');
      assert.match(String(cs.readDate), /^\d{4}-\d{2}-\d{2}$/, l.id + ' ' + side + ' coordSource.readDate');
      assert.ok(p.lat > 20 && p.lat < 36.5 && p.lon > -18 && p.lon < -0.5, l.id + ' ' + side + ' hors du Maroc');
    }
  }
  assert.ok(located >= 8, 'au moins quelques extrémités rattachées');
});

test('water-links: au moins une liaison dessinable de plus que les deux d’origine, aucune clé de volume transférable dans coordSource', () => {
  const both = list.filter(l => l.from.lat != null && l.to.lat != null);
  assert.ok(both.length >= 3, 'liaisons à deux extrémités rattachées : ' + both.length);
  const bad = keys(both.map(l => [l.from.coordSource, l.to.coordSource])).filter(k => FORBIDDEN_KEY.test(k));
  assert.deepEqual(bad, []);
});
