// Chapitre « Comprendre l'eau » : public/data/awareness.json et la logique de src/hub/awareness.js.
// Chaque fait affiché : statut permis (verifie | secondaire), source nommée, URL https, date de lecture ; aucun fait
// « non-verifie » ; chaque id utilisé par l'interface existe ; la curation reprend fidèlement le fichier brut.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as A from '../src/hub/awareness.js';
import * as S from '../src/hub/stops.js';

const json = JSON.parse(readFileSync(new URL('../public/data/awareness.json', import.meta.url), 'utf8'));
const raw = JSON.parse(readFileSync(new URL('../data-raw/awareness/awareness-facts.json', import.meta.url), 'utf8'));
const rawById = new Map(raw.map(f => [f.id, f]));
const KEEP = ['id', 'theme', 'claimFr', 'value', 'unit', 'period', 'status', 'sourceName', 'sourceUrl', 'readDate', 'passage'];

test('every fact is displayable: allowed status, named source, https URL, ISO read date', () => {
  assert.ok(Array.isArray(json.facts) && json.facts.length > 0);
  const ids = new Set();
  for (const f of json.facts) {
    assert.ok(!ids.has(f.id), 'id en double ' + f.id); ids.add(f.id);
    assert.ok(A.ALLOWED_STATUS.includes(f.status), f.id + ' statut ' + f.status);
    assert.match(f.sourceUrl, /^https:\/\//, f.id);
    assert.match(f.readDate, /^\d{4}-\d{2}-\d{2}$/, f.id);
    assert.ok(f.sourceName && f.claimFr && f.period, f.id);
    assert.ok(A.isDisplayable(f), f.id);
    for (const k of KEEP) assert.ok(k in f, f.id + ' champ ' + k);
  }
});

test('no unverified fact, and the curation matches the raw research file', () => {
  for (const f of json.facts) {
    const r = rawById.get(f.id);
    assert.ok(r, 'absent du fichier brut : ' + f.id);
    assert.notEqual(r.status, 'non-verifie', f.id);
    assert.ok(!f.id.startsWith('v-'), f.id);
    for (const k of KEEP) assert.deepEqual(f[k], r[k] ?? null, f.id + ' / ' + k);
  }
  const unverified = raw.filter(f => f.status === 'non-verifie').map(f => f.id);
  assert.ok(unverified.length > 0);
  for (const id of unverified) assert.ok(!json.facts.some(f => f.id === id), id);
  assert.equal(JSON.stringify(json).includes('youtube.com/watch') && json.facts.some(f => /youtube/.test(f.sourceUrl)), false, 'la vidéo n’est jamais la source d’un fait');
});

test('every id used by the UI exists and the steps match the camera stops', () => {
  for (const id of A.USED_FACT_IDS) assert.ok(json.facts.some(f => f.id === id), 'fait utilisé absent : ' + id);
  const ui = readFileSync(new URL('../src/hub/Awareness.jsx', import.meta.url), 'utf8');
  for (const m of ui.matchAll(/id="(comprendre-[a-z]+)"/g)) assert.ok(m[1] in A.STEP_FACTS, m[1]);
  const steps = S.STORY_STOPS.filter(s => s.chapter === 'comprendre').map(s => s.id);
  assert.deepEqual(steps, Object.keys(A.STEP_FACTS));
  const order = S.STORY_STOPS.map(s => s.id);
  assert.ok(order.indexOf('barrages') < order.indexOf(steps[0]) && order.indexOf(steps.at(-1)) < order.indexOf('chiffres'));
  assert.deepEqual(A.sourcesList(json).map(f => f.id), A.USED_FACT_IDS);
  assert.ok(json.mention.includes('pas une source officielle'));
});

test('model: every step has its figures from the facts', () => {
  const m = A.awarenessModel(json);
  assert.equal(m.rare.now, 606); assert.equal(m.rare.threshold, 1000); assert.equal(m.rare.y1960, 2560);
  assert.equal(m.irregular.rows.length, 6); assert.equal(m.irregular.mean, 11.5); assert.equal(m.irregular.rows[0].value, 10.3);
  assert.ok(m.irregular.ratio > 5 && m.irregular.ratio < 6);
  assert.deepEqual([m.irregular.gap.now, m.irregular.gap.y2050], [1.8, 7]);
  assert.equal(m.dam.silt.mt, 100); assert.equal(m.dam.silt.pct, 60); assert.equal(m.dam.law.article, '126');
  assert.equal(m.nappes.take, 5); assert.equal(m.nappes.pct, 28); assert.equal(m.nappes.renew, 3.9);
  assert.deepEqual(m.solutions.map(s => s.id), ['transfert', 'dessalement', 'reutilisation', 'reseaux']);
  assert.equal(m.solutions[0].value, 151); assert.equal(m.solutions[1].stations, 15); assert.equal(m.solutions[1].value, 192);
  assert.equal(m.solutions[1].price.fact.status, 'secondaire');
  assert.equal(m.solutions[2].value, 32); assert.equal(m.solutions[3].value, 77);
  assert.equal(m.agir.demand.tenths, 9);
});

test('model drops non-displayable facts instead of showing them', () => {
  const bad = { facts: json.facts.map(f => (f.id === 'dotation-par-habitant' ? { ...f, status: 'non-verifie' } : f.id === 'nappes-surexploitation' ? { ...f, sourceUrl: 'http://x' } : f)) };
  const m = A.awarenessModel(bad);
  assert.equal(m.rare, null); assert.equal(m.nappes, null);
  assert.ok(m.irregular);
  const empty = A.awarenessModel(null);
  assert.equal(empty.rare, null); assert.equal(empty.solutions, null);
  const chip = A.chipFor(json.facts.find(f => f.status === 'secondaire'));
  assert.match(chip.note, /secondaire/);
});
