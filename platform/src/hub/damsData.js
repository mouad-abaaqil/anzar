// Barrages : jointure du bulletin du jour (dam-fill.json, 69 barrages lus, noms arabes + translittérations)
// avec les barrages localisés (national-dams.json, 97 points OSM/Wikidata).
// Règle d'honnêteté : un remplissage n'est posé sur un point que si l'appariement est sans ambiguïté
// (nom arabe ou nom français normalisé identique, un seul site candidat, région cohérente avec le bassin).
// Tout appariement douteux est marqué 'approximatif' et NE reçoit PAS de remplissage.
// Les capacités « dérivées » (stock ÷ taux imprimés) sont de l'arithmétique sur le bulletin, pas une mesure.

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Variantes de translittération courantes dans les noms de barrages marocains.
const VARIANTS = [
  [/\b(1er|premier|1s|i)\b/g, '1'], [/\b(ii|2eme)\b/g, '2'],
  [/\babdallah\b/g, 'abdellah'], [/\bmohammed\b/g, 'mohamed'], [/\bmokhtar\b/g, 'moukhtar'],
  [/\bben\b/g, 'bin'], [/\bbeni\b/g, 'bni'], [/\byacoub\b/g, 'yaacoub'],
];
const STOP = new Set(['barrage', 'barage', 'dam', 'de', 'du', 'des', 'la', 'le', 'l', 'd', 'al', 'el', 'derivation', 'under', 'construction', 'the']);

/** Mots normalisés d'un nom français/translittéré : casse, accents, tirets, « barrage », Al/El, variantes. */
export function nameTokens(name) {
  let s = String(name || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  s = s.replace(/\(.*?\)/g, ' ').replace(/[’'\x60-]/g, ' ').replace(/[^a-z0-9 ]+/g, ' ');
  for (const [re, to] of VARIANTS) s = s.replace(re, to);
  return s.split(/\s+/).filter(t => t && !STOP.has(t));
}
export const normalizeName = name => nameTokens(name).join('');

/** Nom arabe normalisé : diacritiques, hamza, tatweel, « سد », article ال, espaces. */
export function normalizeArabic(name) {
  if (!name) return '';
  let s = String(name).normalize('NFKC').replace(/[\u{64B}-\u{652}\u{670}\u{640}]/gu, '');
  s = s.replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
  return s.split(/\s+/).filter(w => w && w !== 'سد' && w !== 'التحويلي' && w !== 'التلي')
    .map(w => (w.startsWith('ال') && w.length > 3 ? w.slice(2) : w)).join('');
}

// Contrôle de cohérence (ne peut que déclasser un appariement) : régions où chaque bassin du bulletin a des barrages.
export const BASIN_REGIONS = {
  'Oum Er-Rbia': ['beni-mellal-khenifra', 'casablanca-settat', 'marrakech-safi'],
  Loukkos: ['tanger-tetouan-al-hoceima'],
  Moulouya: ['oriental', 'fes-meknes', 'draa-tafilalet'],
  Sebou: ['fes-meknes', 'rabat-sale-kenitra', 'tanger-tetouan-al-hoceima'],
  Bouregreg: ['rabat-sale-kenitra', 'casablanca-settat', 'beni-mellal-khenifra'],
  Tensift: ['marrakech-safi'],
  'Souss-Massa': ['souss-massa'],
  'Drâa-Oued Noun': ['draa-tafilalet', 'souss-massa', 'guelmim-oued-noun'],
  'Guir-Ziz-Ghriss': ['draa-tafilalet', 'oriental'],
};
const regionFits = (basin, regionId) => !BASIN_REGIONS[basin] || BASIN_REGIONS[basin].includes(regionId);

const km = (a, b) => {
  const r = Math.PI / 180;
  const x = (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * r);
  return Math.hypot(x, b.lat - a.lat) * 111.2;
};
// Plusieurs points à moins de 3 km : le même ouvrage cartographié deux fois.
const sameSite = list => list.every(d => km(d, list[0]) < 3);

const rowsOf = (v, key) => (Array.isArray(v) ? v : (v?.[key] || []));

function publicFill(f) {
  return { name: f.name || null, nameAr: f.nameAr || null, basin: f.basin || null, storedMm3: num(f.storedMm3), fillPct: num(f.fillPct) };
}

/**
 * Joint le bulletin aux barrages localisés.
 * @param national national-dams.json (tableau ou {dams})
 * @param fill dam-fill.json ({date, sourceUrl, dams, basins})
 * @param region region.json (Souss-Massa) ou null : repli daté pour ses barrages absents du bulletin national
 * @returns {{ date, sourceUrl, located: object[], unmatchedFill: object[] }}
 */
export function joinDamFill(national, fill, region = null) {
  const date = fill?.date || null;
  const sourceUrl = fill?.sourceUrl || null;
  const located = [];
  for (const [i, d] of rowsOf(national, 'dams').entries()) {
    const lat = num(d.lat); const lon = num(d.lon);
    if (lat === null || lon === null || !d.name) continue;
    const cap = num(d.capacityMm3);
    const known = cap !== null && cap > 0;
    located.push({
      id: d.id || 'barrage-' + i, name: d.name, nameAr: d.nameAr || null, lat, lon,
      regionId: d.regionId || null, basin: d.basin || null,
      capacityMm3: known ? cap : null, capacitySource: known ? 'publiée' : null,
      fillPct: null, storedMm3: null, asOf: null, match: null, matchedBy: null, fillName: null, fillSource: null,
      sources: d.sources || [], approxLocation: d.locationAccuracy === 'approximate',
      _tok: nameTokens(d.name), _norm: normalizeName(d.name), _ar: normalizeArabic(d.nameAr),
    });
  }

  const unmatchedFill = [];
  for (const f of rowsOf(fill, 'dams')) {
    const ar = normalizeArabic(f.nameAr);
    const fr = f.name ? normalizeName(f.name) : '';
    const byAr = ar ? located.filter(d => d._ar && d._ar === ar) : [];
    const byFr = fr ? located.filter(d => d._norm && d._norm === fr) : [];
    let candidates = [...new Set([...byAr, ...byFr])];
    let match = null;
    if (candidates.length && sameSite(candidates) && candidates.every(d => regionFits(f.basin, d.regionId))) match = 'exact';
    else if (candidates.length) match = 'approximatif'; // plusieurs sites distincts portent ce nom, ou région incohérente
    else if (f.name) {
      // Appariement partiel : tous les mots de l'un contenus dans l'autre (au moins deux mots communs).
      const ft = nameTokens(f.name);
      candidates = located.filter(d => {
        const shared = ft.filter(t => d._tok.includes(t)).length;
        return shared >= 2 && (shared === ft.length || shared === d._tok.length) && regionFits(f.basin, d.regionId);
      });
      if (candidates.length) match = 'approximatif';
    }
    if (!match) { unmatchedFill.push(publicFill(f)); continue; }
    if (match === 'exact' && candidates.some(d => d.match === 'exact')) {
      // Deux lignes du bulletin pour un même site : on garde la première, la seconde reste non appariée.
      unmatchedFill.push(publicFill(f));
      continue;
    }
    for (const d of candidates) {
      if (match === 'exact') {
        Object.assign(d, {
          match, matchedBy: byAr.includes(d) ? 'arabe' : 'nom', fillName: f.name || f.nameAr || null,
          nameAr: d.nameAr || f.nameAr || null, basin: d.basin || f.basin || null,
          fillPct: num(f.fillPct), storedMm3: num(f.storedMm3), asOf: date, fillSource: 'bulletin',
        });
        if (d.capacityMm3 === null && num(f.derivedCapacityMm3) > 0 && num(f.storedMm3) >= 1) {
          d.capacityMm3 = f.derivedCapacityMm3; d.capacitySource = 'dérivée';
        }
      } else if (!d.match) {
        Object.assign(d, { match, matchedBy: byAr.includes(d) ? 'arabe' : 'nom', fillName: f.name || f.nameAr || null });
      }
    }
    if (match === 'approximatif') unmatchedFill.push({ ...publicFill(f), approximatif: candidates.map(d => d.id) });
  }

  // Souss-Massa : un barrage de region.json resté sans remplissage national garde le sien, avec sa propre date.
  for (const r of (region?.facilities || [])) {
    if (r.kind !== 'dam' || num(r.fillPct) === null || num(r.storageMm3) === null) continue;
    const norm = normalizeName(r.name);
    const d = located.find(x => x._norm === norm && x.regionId === 'souss-massa');
    if (!d || d.fillPct !== null || d.match === 'approximatif') continue;
    Object.assign(d, { fillPct: r.fillPct, storedMm3: r.storageMm3, asOf: r.asOf || region.asOf || null, match: 'exact', matchedBy: 'nom', fillSource: 'region' });
  }

  for (const d of located) { delete d._tok; delete d._norm; delete d._ar; }
  return { date, sourceUrl, located, unmatchedFill };
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export function frDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1] : '';
}
export const fr = (v, d = 0) => Number(v).toLocaleString('fr-FR', { maximumFractionDigits: d });

/** Classe de niveau pour la couleur sobre de l'eau : 'bas' (< 30 %), 'moyen' (< 60 %), 'haut'. */
export const fillLevel = p => (p === null || p === undefined ? null : p < 30 ? 'bas' : p < 60 ? 'moyen' : 'haut');

/** Diamètre en px : aire proportionnelle à la capacité ; capacité inconnue = taille minimale (pointillé). */
export function damSize(capacityMm3, zoom = 5) {
  const z = Math.min(1.8, Math.max(0.75, 0.6 + (zoom - 4) * 0.22));
  if (!capacityMm3) return Math.round(9 * Math.min(1.3, z));
  const cap = Math.min(40, Math.max(22, 26 * z));
  return Math.round(Math.min(cap, Math.max(10, 0.8 * Math.sqrt(capacityMm3) * z + 5)));
}

const ARABIC = /[\u{600}-\u{6FF}]/u;
/** Nom affiché : « Barrage X », sans « Dam » final ; un nom seulement arabe prend la translittération du bulletin. */
export function damTitle(d) {
  let n = String(d.name || '');
  if (ARABIC.test(n) && d.fillName && !ARABIC.test(d.fillName)) n = d.fillName;
  n = n.replace(/\b1Er\b/, '1er').replace(/\s+dam$/i, '').replace(/\(under construction\)/i, '(en construction)').trim();
  return /^barr?age\b/i.test(n) ? 'Barrage' + n.replace(/^barr?age/i, '') : 'Barrage ' + n;
}
const mm3 = v => fr(v, v < 10 ? 2 : 0) + ' Mm³';

/** Infobulle en français. */
export function damTooltip(d) {
  const lines = [];
  if (d.basin) lines.push('Bassin : ' + d.basin);
  if (d.fillPct !== null && d.fillPct !== undefined) {
    lines.push('Stock : ' + mm3(d.storedMm3) + ' · ' + fr(d.fillPct, 1) + ' % plein');
    if (d.capacityMm3) lines.push('Capacité : ' + mm3(d.capacityMm3) + (d.capacitySource === 'dérivée' ? ' (dérivée : stock ÷ taux)' : ''));
    lines.push('Lu sur le bulletin du ' + (frDay(d.asOf) || 'jour non précisé') + ', pas un relevé en direct');
  } else {
    lines.push(d.capacityMm3 ? 'Capacité : ' + mm3(d.capacityMm3) : 'Capacité non renseignée');
    lines.push(d.match === 'approximatif' ? 'Nom proche d’une ligne du bulletin : appariement incertain, remplissage non affiché' : 'Absent du bulletin apparié : remplissage non affiché');
  }
  if (d.approxLocation) lines.push('Position approximative (OpenStreetMap)');
  return { title: damTitle(d), lines };
}
