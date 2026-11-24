#!/usr/bin/env node
// Rattache les extrémités DÉJÀ NOMMÉES de water-links.json à des coordonnées SOURCÉES. Rejouable.
//   node data-raw/links/geocode-links.mjs            (depuis platform/)
// Entrée  : data-raw/links/water-links.json (jamais modifiée)
// Sortie  : public/data/water-links.json
// Ordre   : 1) public/data/national-dams.json (OSM / Wikidata, nom normalisé identique) ;
//           2) Wikidata (wbsearchentities + P625), pour les villes (« Ville de X ») et les barrages absents du jeu national.
// Règles  : jamais de coordonnée devinée. Nom ambigu, absent ou hors du Maroc : lat/lon = null. Bassins, réseaux,
//           stations et périmètres ne sont pas géocodés (un fleuve ou un bassin n'a pas de point d'entrée sourcé).
//           Les coordonnées déjà présentes en entrée, sans source, ne servent qu'à départager des homonymes : jamais copiées.
// Réseau  : Wikidata, une requête par seconde au plus, User-Agent générique. Panne réseau : extrémité laissée à null.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = p => fileURLToPath(new URL(p, import.meta.url));
const IN = here('./water-links.json');
const DAMS = here('../../public/data/national-dams.json');
const OUT = here('../../public/data/water-links.json');
const READ_DATE = new Date().toISOString().slice(0, 10);
const UA = 'generic-open-data-client/1.0 (prototype hydrologique, requêtes espacées)';
const BOUNDS = { lat: [20, 36.5], lon: [-18, -0.5] }; // Maroc et provinces du Sud, avec marge
const COLLAPSE_KM = 5; // deux candidats à moins de 5 km = le même ouvrage (doublon de la source)

// Décision éditoriale unique (propriétaire à confirmer) : l'extrémité nomme trois lieux ; on la représente par le premier.
const OVERRIDES = {
  'al-massira-marrakech:to': { query: 'Marrakech', why: "extrémité représentée par Marrakech, première ville nommée de « Benguerir, Marrakech et Tamansourt » (choix éditorial, pas un point d'arrivée de conduite)" },
};

const num = v => typeof v === 'number' && Number.isFinite(v);
const inMorocco = (lat, lon) => num(lat) && num(lon) && lat > BOUNDS.lat[0] && lat < BOUNDS.lat[1] && lon > BOUNDS.lon[0] && lon < BOUNDS.lon[1];
const km = (a, b) => {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

// Nom normalisé : sans accents ni parenthèses, graphies équivalentes ramenées à une seule, mots creux retirés.
const CANON = { mohammed: 'mohamed', abdellah: 'abdallah', abdullah: 'abdallah', premier: '1', '1er': '1', i: '1', ii: '2', iii: '3' };
const STOP = new Set(['barrage', 'dam', 'de', 'du', 'des', 'd', 'l', 'el', 'al', 'la', 'le', 'oued']);
export function norm(s) {
  return String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
    .map(w => CANON[w] || w).filter(w => !STOP.has(w)).join(' ');
}

// Type d'extrémité et nom à chercher, d'après le nom DÉJÀ présent. null = ne pas géocoder.
export function classify(name) {
  const n = String(name || '').trim();
  let m = n.match(/^(?:prise d['’]eau du )?barrage\s+(.+?)\s*(?:\(|$)/i);
  if (m) return { kind: 'dam', query: m[1].trim() };
  m = n.match(/^ville de\s+(.+?)\s*(?:\(|$)/i);
  if (m) return { kind: 'city', query: m[1].trim() };
  return null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
let lastCall = 0;
async function wd(params) {
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  const url = 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({ format: 'json', origin: '*', ...params });
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
    if (res.ok) return res.json();
    if (res.status !== 429 || attempt >= 2) throw new Error('HTTP ' + res.status);
    await sleep(15000 * (attempt + 1)); // limite de débit : on attend, on ne contourne pas
    lastCall = Date.now();
  }
}

async function wikidataLookup(query, kind) {
  const found = new Map();
  for (const language of ['fr', 'en']) {
    const j = await wd({ action: 'wbsearchentities', search: query, language, uselang: language, type: 'item', limit: '10' });
    for (const r of j.search || []) found.set(r.id, r);
    if (found.size) break;
  }
  if (!found.size) return { why: 'aucun résultat Wikidata' };
  const ents = await wd({ action: 'wbgetentities', ids: [...found.keys()].join('|'), props: 'claims|labels|descriptions', languages: 'fr|en' });
  const want = norm(query);
  const ok = [];
  for (const [id, e] of Object.entries(ents.entities || {})) {
    const labels = Object.values(e.labels || {}).map(l => l.value);
    if (!labels.some(l => norm(l) === want)) continue;
    const v = e.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    if (!v || !inMorocco(v.latitude, v.longitude)) continue;
    // On écarte les entités qui ne sont pas du bon type (région, province, personne...) d'après la description.
    const desc = Object.values(e.descriptions || {}).map(d => d.value).join(' ').toLowerCase();
    if (kind === 'city' && !/city|town|commune|municipality|ville|village|capital/.test(desc)) continue;
    if (kind === 'dam' && !/dam|barrage|reservoir|retenue/.test(desc)) continue;
    ok.push({ id, label: e.labels?.fr?.value || e.labels?.en?.value || labels[0], lat: v.latitude, lon: v.longitude });
  }
  if (!ok.length) return { why: 'aucun candidat Wikidata avec ce libellé, des coordonnées au Maroc et une description compatible' };
  if (ok.some(c => km(ok[0], c) > COLLAPSE_KM)) return { why: 'ambigu : ' + ok.map(c => c.id).join(', ') };
  const c = ok[0];
  return { lat: Math.round(c.lat * 1e5) / 1e5, lon: Math.round(c.lon * 1e5) / 1e5, source: { name: 'Wikidata (CC0) : ' + c.label + ' (' + c.id + ')', url: 'https://www.wikidata.org/wiki/' + c.id, readDate: READ_DATE } };
}

function damSource(d) {
  const want = d.coordSource === 'wikidata' ? /wikidata/i : /openstreetmap/i;
  const s = (d.sources || []).find(x => want.test(x.name));
  return s ? { name: s.name + ' : ' + d.name, url: s.url, readDate: s.readDate || READ_DATE } : null;
}

function fromNationalDams(query, dams, near) {
  const want = norm(query);
  let c = dams.filter(d => num(d.lat) && num(d.lon) && (norm(d.name) === want || norm(d.id) === want));
  if (!c.length) return { why: 'absent de national-dams.json' };
  if (c.some(d => km(c[0], d) > COLLAPSE_KM)) {
    // Homonymes éloignés : une ancienne coordonnée d'entrée (non sourcée) peut départager, jamais être recopiée.
    const close = near ? c.filter(d => km(near, d) < 10) : [];
    if (close.length && !close.some(d => km(close[0], d) > COLLAPSE_KM)) c = close;
    else return { why: 'ambigu dans national-dams.json : ' + c.map(d => d.id).join(', ') };
  }
  const d = c[0];
  const source = damSource(d);
  if (!source || !inMorocco(d.lat, d.lon)) return { why: 'source de coordonnées non exploitable' };
  return { lat: d.lat, lon: d.lon, source };
}

const links = JSON.parse(readFileSync(IN, 'utf8'));
const dams = JSON.parse(readFileSync(DAMS, 'utf8'));
const report = [];
let wdFailures = 0;

for (const link of links) {
  for (const side of ['from', 'to']) {
    const p = link[side];
    const near = num(p.lat) && num(p.lon) ? { lat: p.lat, lon: p.lon } : null;
    const key = link.id + ':' + side;
    const ov = OVERRIDES[key];
    const cls = ov ? { kind: 'city', query: ov.query } : classify(p.name);
    let res = null;
    if (!cls) res = { why: 'nom non géocodable (bassin, réseau, station, périmètre ou plusieurs lieux)' };
    else {
      if (cls.kind === 'dam') res = fromNationalDams(cls.query, dams, near);
      if (!res || res.why?.startsWith('absent')) { // ambigu dans le jeu national : on ne cherche pas ailleurs
        try { res = await wikidataLookup(cls.query, cls.kind); } catch (e) { wdFailures += 1; res = { why: 'Wikidata injoignable (' + e.message + ')' }; }
      }
    }
    delete p.coordSource; delete p.coordNote;
    if (res.lat !== undefined) {
      p.lat = res.lat; p.lon = res.lon; p.coordSource = res.source;
      if (ov) p.coordNote = ov.why;
      report.push([key, p.name, 'OK', res.source.name]);
    } else {
      p.lat = null; p.lon = null;
      report.push([key, p.name, 'null', res.why]);
    }
  }
}

writeFileSync(OUT, JSON.stringify(links, null, 2) + '\n');
for (const r of report) console.log(r.join(' | '));
const both = links.filter(l => num(l.from.lat) && num(l.to.lat));
console.log('\nArcs dessinables (deux extrémités rattachées) : ' + both.length + ' / ' + links.length + (wdFailures ? ' ; requêtes Wikidata en échec : ' + wdFailures : ''));
for (const l of both) console.log('  ' + l.id);
