// Couche barrages : normalisation tolérante (national-dams.json, sinon region.json) et aides de rendu.
// Cercles proportionnels à la capacité, SANS remplissage, sauf Souss-Massa (remplissage du bulletin, sourcé).
export const fr = (v, d = 0) => Number(v).toLocaleString('fr-FR', { maximumFractionDigits: d });

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, ' ').replace(/\b(barrage|dam)\b/g, '').trim();

function pickCapacity(d) {
  const c = d.capacityMm3 ?? d.capacity_mm3 ?? d.capacite_mm3 ?? d.capacity;
  const v = num(c && typeof c === 'object' ? c.value : c);
  return v !== null && v > 0 ? v : null;
}

function pickLatLon(d) {
  if (Array.isArray(d.coordinates) && d.coordinates.length === 2) return { lon: num(d.coordinates[0]), lat: num(d.coordinates[1]) };
  return { lat: num(d.lat ?? d.latitude), lon: num(d.lon ?? d.lng ?? d.longitude) };
}

// Barrages du Souss-Massa avec remplissage sourcé (region.json, bulletin du jour).
export function regionDams(region) {
  return (region?.facilities || [])
    .filter(f => f.kind === 'dam' && Array.isArray(f.coordinates) && num(f.storageMm3) !== null && num(f.fillPct) > 0)
    .map(f => ({
      id: f.id, name: f.name, lon: f.coordinates[0], lat: f.coordinates[1],
      capacityMm3: f.storageMm3 / (f.fillPct / 100), fillPct: f.fillPct, storageMm3: f.storageMm3,
      asOf: f.asOf || region.asOf || null, sources: f.sourceIds || [], approx: f.locationAccuracy === 'approximate',
    }));
}

// national : national-dams.json (objet {dams:[…]} ou tableau) ou null ; region : region.json ou null.
export function normalizeDams(national, region) {
  const fills = regionDams(region);
  const byId = new Map(fills.map(f => [f.id, f]));
  const byName = new Map(fills.map(f => [slug(f.name), f]));
  const rows = Array.isArray(national) ? national : (national?.dams || []);
  if (!rows.length) return fills;
  const out = [];
  for (const d of rows) {
    const { lat, lon } = pickLatLon(d);
    const name = d.name || d.nom;
    if (lat === null || lon === null || !name) continue;
    const id = d.id || slug(name);
    const fill = byId.get(id) || byName.get(slug(name)) || fills.find(f => Math.abs(f.lat - lat) < 0.04 && Math.abs(f.lon - lon) < 0.04);
    out.push({
      id, name, lat, lon, capacityMm3: pickCapacity(d) ?? (fill ? fill.capacityMm3 : null),
      fillPct: fill ? fill.fillPct : null, storageMm3: fill ? fill.storageMm3 : null, asOf: fill ? fill.asOf : null,
      sources: d.sources || d.sourceIds || [], approx: d.locationAccuracy === 'approximate',
    });
  }
  // Barrages du Souss-Massa du bulletin sans correspondance nationale : on garde leur remplissage sourcé.
  for (const f of fills) if (!out.some(o => o.fillPct != null && o.id === f.id) && !out.some(o => o.fillPct === f.fillPct && Math.abs(o.lat - f.lat) < 0.04 && Math.abs(o.lon - f.lon) < 0.04)) out.push(f);
  return out;
}

// Diamètre en px : aire proportionnelle à la capacité. Capacité inconnue : petit point creux.
export function damDiameter(capacityMm3, zoom = 5) {
  const z = Math.min(1.7, Math.max(0.7, 0.55 + (zoom - 4) * 0.2));
  if (!capacityMm3) return 7;
  return Math.min(34, Math.max(7, 1.5 * Math.sqrt(capacityMm3) * z));
}

export function damTip(d) {
  const lines = [d.capacityMm3 ? `Capacité ${fr(d.capacityMm3, d.capacityMm3 < 10 ? 1 : 0)} Mm³` : 'Capacité non renseignée'];
  if (d.fillPct !== null && d.fillPct !== undefined) lines.push(`Remplissage ${fr(d.fillPct, 1)} % au ${d.asOf || 'date non précisée'} (bulletin, sourcé)`);
  else lines.push('Remplissage non affiché sur cette carte');
  if (d.approx) lines.push('Position approximative (OpenStreetMap)');
  return { title: /^bara?ge/i.test(d.name) ? d.name : `Barrage ${d.name}`, lines };
}
