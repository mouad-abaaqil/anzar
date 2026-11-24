import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const file = new URL('../public/data/national-dams.json', import.meta.url);
const present = existsSync(file);
const raw = present ? JSON.parse(readFileSync(file, 'utf8')) : null;
const dams = raw ? (Array.isArray(raw) ? raw : raw.dams) : [];
const val = c => (c && typeof c === 'object' ? c.value : c);

test('national-dams.json : forme de chaque barrage', { skip: !present && 'fichier absent (couche repliée sur region.json)' }, () => {
  assert.ok(dams.length > 0);
  for (const d of dams) {
    const name = d.name || d.nom;
    const lat = d.lat ?? d.latitude ?? d.coordinates?.[1];
    const lon = d.lon ?? d.longitude ?? d.coordinates?.[0];
    assert.ok(name, 'nom');
    assert.ok(typeof lat === 'number' && lat > 20 && lat < 36.5, name + ' lat');
    assert.ok(typeof lon === 'number' && lon > -18 && lon < -0.5, name + ' lon');
    const src = d.sources ?? d.sourceIds ?? d.source;
    assert.ok(src && (Array.isArray(src) ? src.length : Object.keys(Object(src)).length || String(src).length), name + ' sources non vides');
    const cap = val(d.capacityMm3 ?? d.capacity_mm3 ?? d.capacity);
    assert.ok(cap === null || cap === undefined || (typeof cap === 'number' && cap > 0), name + ' capacité null ou > 0');
  }
});
