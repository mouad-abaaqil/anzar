// Couche « terres agricoles en 3D » : logique pure (pas d'import MapLibre), testée en Node (tests/fields-layer.test.mjs).
//
// Donnée : couche source-layer 'landcover' des tuiles vectorielles OpenFreeMap (schéma OpenMapTiles, données
// OpenStreetMap, ODbL), class = 'farmland' (sous-classes farmland, orchard, vineyard, plant_nursery…).
// Ce sont des zones agricoles CARTOGRAPHIÉES et généralisées par les tuiles (pas des parcelles cadastrales) :
// elles ne disent rien de l'irrigation réelle ni d'un volume d'eau. Aucune donnée en dessous du zoom 7 (tuiles z≤6
// vides de farmland) : pas de voile à l'échelle nationale. Mesures et limites : docs/OPEN_DATA.md.

export const FIELDS_SOURCE = 'openmaptiles';
export const FIELDS_SOURCE_LAYER = 'landcover';
export const FIELDS_VEIL_ID = 'hub-fields-veil';
export const FIELDS_3D_ID = 'hub-fields-3d';
export const FIELDS_LAYER_IDS = [FIELDS_VEIL_ID, FIELDS_3D_ID];

// Bornes de zoom (zoom MapLibre ; la carte plafonne à 12).
export const FIELDS_ZOOM = {
  veilMin: 6.8, // premières tuiles avec farmland : z7 (un seul polygone fusionné par tuile)
  veilFull: 7.6,
  extrudeMin: 10.2, // extrusion seulement quand les polygones sont assez nombreux et petits (z10+), coût CPU borné
  extrudeFull: 11.2,
};

// Hauteur symbolique (lisibilité), pas une mesure : vergers un peu plus hauts que les cultures basses.
export const FIELD_RELATIVE_HEIGHT = { farmland: 1, farm: 1, orchard: 1.6, vineyard: 1.25, plant_nursery: 1.3 };
// Hauteur de base (m) par zoom : un pixel vaut ~65 m au zoom 11 et ~32 m au zoom 12 à la latitude du Maroc ;
// 25-60 m seraient invisibles à ces échelles, d'où une hauteur plus forte au zoom bas, qui décroît en zoomant.
export const FIELD_BASE_HEIGHT = [[11.2, 220], [12, 150], [13, 80], [14, 45]];
export const FIELDS_OPACITY = { veil: 0.34, veilUnder3d: 0.14, extrusion: 0.86 };
export const FIELDS_FADE_MS = 700;

export const isFieldSubclass = s => Object.hasOwn(FIELD_RELATIVE_HEIGHT, s);
export const relativeHeight = s => FIELD_RELATIVE_HEIGHT[s] ?? 1;

/** Hauteur (m) d'une zone agricole au zoom z (même formule que l'expression MapLibre). */
export function fieldHeight(subclass, z) {
  const { extrudeMin, extrudeFull } = FIELDS_ZOOM;
  const pts = [[extrudeMin, 0], ...FIELD_BASE_HEIGHT];
  if (z <= pts[0][0]) return 0;
  const last = pts[pts.length - 1];
  if (z >= last[0]) return last[1] * relativeHeight(subclass);
  for (let i = 1; i < pts.length; i++) {
    if (z <= pts[i][0]) {
      const [z0, h0] = pts[i - 1]; const [z1, h1] = pts[i];
      return (h0 + (h1 - h0) * (z - z0) / (z1 - z0)) * relativeHeight(subclass);
    }
  }
  return 0;
}

/** Zones agricoles uniquement (polygones landcover class=farmland). */
export const fieldsFilter = () => ['all',
  ['==', ['get', 'class'], 'farmland'],
  ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
];

const relExpr = () => ['match', ['get', 'subclass'], ...Object.entries(FIELD_RELATIVE_HEIGHT).flatMap(([k, v]) => [k, v]), 1];

export function heightExpression() {
  const rel = relExpr();
  return ['interpolate', ['linear'], ['zoom'],
    FIELDS_ZOOM.extrudeMin, 0,
    ...FIELD_BASE_HEIGHT.flatMap(([z, h]) => [z, ['*', h, rel]]),
  ];
}

export const colorExpression = c => ['match', ['get', 'subclass'],
  'orchard', c.mapFieldOrchard, 'vineyard', c.mapFieldVine, c.mapField];

/** Opacité du voile selon le zoom (multipliée par k : 0 = coupé, 1 = affiché). */
export function veilOpacity(k = 1) {
  const { veilMin, veilFull, extrudeMin, extrudeFull } = FIELDS_ZOOM;
  const o = FIELDS_OPACITY;
  return ['interpolate', ['linear'], ['zoom'], veilMin, 0, veilFull, o.veil * k, extrudeMin, o.veil * k, extrudeFull, o.veilUnder3d * k];
}
export const extrusionOpacity = (k = 1) => FIELDS_OPACITY.extrusion * k;

/** Transition d'opacité : nulle si pas d'animation ou reduced-motion. */
export const fieldsTransition = (animate, reducedMotion) => ({ duration: animate && !reducedMotion ? FIELDS_FADE_MS : 0, delay: 0 });

/** Spécifications des deux couches (insérées masquées : opacité 0, puis montée par transition). */
export function fieldsLayers(c, { animate = true, reducedMotion = false } = {}) {
  const tr = fieldsTransition(animate, reducedMotion);
  const common = { source: FIELDS_SOURCE, 'source-layer': FIELDS_SOURCE_LAYER, filter: fieldsFilter() };
  return [
    { id: FIELDS_VEIL_ID, type: 'fill', ...common, minzoom: FIELDS_ZOOM.veilMin, paint: {
      'fill-color': c.mapFieldVeil, 'fill-opacity': veilOpacity(0), 'fill-opacity-transition': tr, 'fill-antialias': false,
    } },
    { id: FIELDS_3D_ID, type: 'fill-extrusion', ...common, minzoom: FIELDS_ZOOM.extrudeMin, paint: {
      'fill-extrusion-color': colorExpression(c), 'fill-extrusion-height': heightExpression(), 'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0, 'fill-extrusion-opacity-transition': tr, 'fill-extrusion-vertical-gradient': true,
    } },
  ];
}

/** Valeurs de peinture à appliquer pour afficher (on) ou couper la couche. */
export const fieldsPaint = on => ({
  [FIELDS_VEIL_ID]: ['fill-opacity', veilOpacity(on ? 1 : 0)],
  [FIELDS_3D_ID]: ['fill-extrusion-opacity', extrusionOpacity(on ? 1 : 0)],
});

/** État demandé : commande impérative (showFields / étape du récit) prioritaire, sinon prop layers.fields. */
export const fieldsWanted = (cmd, layers, story) => (cmd ?? (!story && layers?.fields === true));

export const FIELDS_LEGEND = {
  label: 'Terres agricoles cartographiées (OpenStreetMap, ODbL)',
  note: 'Hauteur symbolique ; zones généralisées, pas des parcelles. Ne dit rien de l’irrigation réelle.',
};
