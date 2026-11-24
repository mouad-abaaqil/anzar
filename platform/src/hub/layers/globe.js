// Vue globe : logique pure (pas d'import MapLibre), testée en Node (tests/fields-layer.test.mjs).
// MapLibre 6 accepte une expression de projection : globe (vertical-perspective) aux petits zooms, Mercator à
// partir de GLOBE_ZOOM.mercator. Au-dessus de ce zoom, le rendu est strictement plan : les cadrages du récit et du
// tableau de bord (zoom ≥ 3 même sur mobile) ne changent pas, et le plongeon globe → Maroc se fait sans bascule visible.

// Seuil bas : le cadrage national sur mobile (390 px, feuille du panneau à 58 %) est estimé vers le zoom 3,2-3,5.
export const GLOBE_ZOOM = { perspective: 1.9, mercator: 2.6 };
export const GLOBE_PROJECTION = { type: ['interpolate', ['linear'], ['zoom'], GLOBE_ZOOM.perspective, 'vertical-perspective', GLOBE_ZOOM.mercator, 'mercator'] };
export const MERCATOR = { type: 'mercator' };
export const MAP_MIN_ZOOM = 0.8;

// Couches « Maroc » (régions, contours, étiquettes, barrages, arcs) : rien au globe lointain, fondu entre ces zooms.
export const MOROCCO_FADE = [1.8, 2.4];
// Barrages et arcs : seulement quand le Maroc est assez grand (sinon un amas de pastilles pendant le plongeon).
export const DAMS_MIN_ZOOM = 2.6;
export const showMorocco = z => z >= MOROCCO_FADE[0];
export const showDamsAt = z => z >= DAMS_MIN_ZOOM;
export const moroccoK = z => Math.max(0, Math.min(1, (z - MOROCCO_FADE[0]) / (MOROCCO_FADE[1] - MOROCCO_FADE[0])));

/** Enveloppe une valeur de peinture dans un fondu selon le zoom (le zoom doit être l'entrée de premier niveau). */
export const fadeByZoom = v => ['interpolate', ['linear'], ['zoom'], MOROCCO_FADE[0], 0, MOROCCO_FADE[1], v];

// Atmosphère visible au globe, nulle au cadrage national (et en Mercator, où elle n'est pas dessinée).
export const ATMOSPHERE_BLEND = ['interpolate', ['linear'], ['zoom'], 0, 0.7, 1.8, 0.6, 2.6, 0];

// Caméra du globe : Afrique et Europe du Sud visibles, Maroc près du centre, légère inclinaison.
export const GLOBE_CAMERA = { center: [-4, 24], zoom: 1.7, pitch: 12, bearing: 0 };
// Rotation douce du globe : la longitude du centre avance (le globe tourne vers l'est), arrêtée par toute interaction.
export const GLOBE_SPIN = { degreesPerSec: 1.2, maxSeconds: 45 };

/** Une étape (ou une caméra) est-elle « globe » ? */
export const isGlobeStop = s => !!s?.globe;
/** Projection globe à garder pour cette caméra (sinon Mercator pur une fois arrivé). */
export const needsGlobe = zoom => Number.isFinite(zoom) && zoom < GLOBE_ZOOM.mercator;
