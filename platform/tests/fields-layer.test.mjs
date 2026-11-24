import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { colors } from '../src/design/colors.js';
import {
  FIELDS_ZOOM, FIELD_BASE_HEIGHT, FIELDS_LAYER_IDS, FIELDS_OPACITY, FIELDS_FADE_MS, FIELDS_LEGEND,
  fieldHeight, fieldsFilter, heightExpression, fieldsLayers, fieldsPaint, fieldsTransition, fieldsWanted, veilOpacity, isFieldSubclass, parseShowFieldsArg,
}  from '../src/hub/layers/fields.js';
import {
  GLOBE_PROJECTION, GLOBE_ZOOM, GLOBE_CAMERA, MOROCCO_FADE, ATMOSPHERE_BLEND, MAP_MIN_ZOOM,
  fadeByZoom, showMorocco, showDamsAt, DAMS_MIN_ZOOM, moroccoK, needsGlobe, isGlobeStop,
} from '../src/hub/layers/globe.js';

const styleWith = (layers, extra = {}) => ({
  version: 8,
  sources: { openmaptiles: { type: 'vector', tiles: ['https://example.invalid/{z}/{x}/{y}.pbf'], maxzoom: 14 } },
  layers, ...extra,
});

test('champs : filtre = polygones landcover class=farmland seulement', () => {
  const f = fieldsFilter();
  assert.deepEqual(f[1], ['==', ['get', 'class'], 'farmland']);
  assert.ok(JSON.stringify(f).includes('Polygon'));
  assert.ok(!JSON.stringify(f).includes('meadow'), 'les prairies ne sont pas des cultures');
  assert.ok(isFieldSubclass('orchard') && isFieldSubclass('vineyard') && !isFieldSubclass('meadow'));
});

test('champs : bornes de zoom cohérentes (rien au national, extrusion tardive)', () => {
  const z = FIELDS_ZOOM;
  assert.ok(z.veilMin >= 6.5, 'pas de farmland dans les tuiles z≤6 : pas de voile national');
  assert.ok(z.veilMin < z.veilFull && z.veilFull < z.extrudeMin && z.extrudeMin < z.extrudeFull);
  assert.ok(z.extrudeMin >= 10, 'extrusion bornée par le zoom (coût CPU)');
  assert.ok(z.extrudeFull <= 12, 'visible avant le zoom max de la carte (12)');
  assert.equal(FIELD_BASE_HEIGHT[0][0], z.extrudeFull);
});

test('champs : hauteur symbolique, nulle avant le zoom d’extrusion, décroissante ensuite', () => {
  assert.equal(fieldHeight('farmland', 9), 0);
  assert.equal(fieldHeight('farmland', FIELDS_ZOOM.extrudeMin), 0);
  const mid = fieldHeight('farmland', (FIELDS_ZOOM.extrudeMin + FIELDS_ZOOM.extrudeFull) / 2);
  assert.ok(mid > 0 && mid < fieldHeight('farmland', FIELDS_ZOOM.extrudeFull), 'montée progressive en zoomant');
  assert.ok(fieldHeight('farmland', 12) < fieldHeight('farmland', 11.2));
  assert.ok(fieldHeight('orchard', 12) > fieldHeight('farmland', 12), 'vergers un peu plus hauts');
  assert.equal(fieldHeight('inconnu', 12), fieldHeight('farmland', 12));
  for (let z = 10; z <= 14; z += 0.25) assert.ok(fieldHeight('orchard', z) <= 500, 'hauteur modeste, bornée');
  assert.ok(fieldHeight('farmland', 14) <= 60);
});

test('champs : expression de hauteur = même courbe que fieldHeight', () => {
  const e = heightExpression();
  assert.equal(e[0], 'interpolate');
  assert.deepEqual(e[2], ['zoom']);
  assert.equal(e[3], FIELDS_ZOOM.extrudeMin);
  assert.equal(e[4], 0);
});

test('champs : couches valides pour le style MapLibre, masquées à l’insertion', () => {
  const layers = fieldsLayers(colors);
  assert.deepEqual(layers.map(l => l.id), FIELDS_LAYER_IDS);
  assert.equal(layers[0].type, 'fill');
  assert.equal(layers[1].type, 'fill-extrusion');
  assert.equal(layers[1].minzoom, FIELDS_ZOOM.extrudeMin);
  assert.equal(layers[1].paint['fill-extrusion-opacity'], 0);
  assert.equal(validateStyleMin(styleWith(layers)).length, 0, JSON.stringify(validateStyleMin(styleWith(layers))));
  for (const c of [colors.mapField, colors.mapFieldOrchard, colors.mapFieldVine, colors.mapFieldVeil]) assert.match(c, /^#[0-9a-f]{6}$/i);
});

test('champs : affichage / coupure, transitions, reduced-motion', () => {
  const on = fieldsPaint(true); const off = fieldsPaint(false);
  assert.equal(on['hub-fields-3d'][1], FIELDS_OPACITY.extrusion);
  assert.equal(off['hub-fields-3d'][1], 0);
  assert.deepEqual(off['hub-fields-veil'][1], veilOpacity(0));
  assert.equal(fieldsTransition(true, false).duration, FIELDS_FADE_MS);
  assert.equal(fieldsTransition(true, true).duration, 0);
  assert.equal(fieldsTransition(false, false).duration, 0);
});

test('champs : commande impérative prioritaire, sinon prop layers.fields (hors récit)', () => {
  assert.equal(fieldsWanted(null, { fields: true }, false), true);
  assert.equal(fieldsWanted(null, { fields: true }, true), false);
  assert.equal(fieldsWanted(null, {}, false), false);
  assert.equal(fieldsWanted(true, {}, true), true);
  assert.equal(fieldsWanted(false, { fields: true }, false), false);
});

test('champs : la légende ne prétend rien sur l’irrigation et cite OSM / ODbL', () => {
  assert.match(FIELDS_LEGEND.label, /OpenStreetMap/);
  assert.match(FIELDS_LEGEND.label, /ODbL/);
  assert.match(FIELDS_LEGEND.note, /irrigation/);
  assert.doesNotMatch(FIELDS_LEGEND.label + FIELDS_LEGEND.note, /irrigu[ée]e?s?\b(?! réelle)/);
});

test('globe : projection globe → Mercator sous le cadrage national, style valide', () => {
  assert.ok(GLOBE_ZOOM.perspective < GLOBE_ZOOM.mercator);
  assert.ok(GLOBE_ZOOM.mercator <= 3, 'cadrage national (≥ 3 même sur mobile) rendu en Mercator pur');
  const style = styleWith([{ id: 'r', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover', paint: { 'fill-opacity': fadeByZoom(['case', ['boolean', ['feature-state', 'hover'], false], 0.5, 0.3]) } }],
    { projection: GLOBE_PROJECTION, sky: { 'atmosphere-blend': ATMOSPHERE_BLEND } });
  assert.deepEqual(validateStyleMin(style), []);
  assert.ok(needsGlobe(GLOBE_CAMERA.zoom) && !needsGlobe(4.6));
  assert.ok(MAP_MIN_ZOOM <= GLOBE_CAMERA.zoom);
});

test('globe : couches Maroc absentes au globe lointain, pleines au national', () => {
  assert.equal(showMorocco(GLOBE_CAMERA.zoom), false);
  assert.equal(moroccoK(GLOBE_CAMERA.zoom), 0);
  assert.equal(moroccoK(MOROCCO_FADE[1]), 1);
  assert.equal(moroccoK(4.2), 1);
  assert.ok(MOROCCO_FADE[1] <= GLOBE_ZOOM.mercator);
  assert.equal(showDamsAt(GLOBE_CAMERA.zoom), false);
  assert.ok(showDamsAt(3) && DAMS_MIN_ZOOM < 3, 'barrages visibles au cadrage national mobile (≈ 3,2-3,5)');
  assert.ok(isGlobeStop({ globe: true }) && !isGlobeStop({}) && !isGlobeStop(null));
});

test('showFields : un booléen false n’allume jamais la couche (régression)', () => {
  assert.deepEqual(parseShowFieldsArg(false), { on: false, animate: true });
  assert.deepEqual(parseShowFieldsArg(true), { on: true, animate: true });
  assert.deepEqual(parseShowFieldsArg({ on: false }), { on: false, animate: true });
  assert.deepEqual(parseShowFieldsArg({ animate: false }), { on: true, animate: false });
  assert.equal(parseShowFieldsArg().on, true);
});
