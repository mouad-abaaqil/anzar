// Couche liaisons : arcs SCHÉMATIQUES entre from et to. Jamais un tracé de conduite, jamais un volume transférable.
// Seules les liaisons dont les deux extrémités ont lat/lon sont dessinées ; les autres restent des listes (panneau).
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export const LINK_STATUS_LABEL = { 'en service': 'En service', 'en construction': 'En construction', 'planifié': 'Planifié' };

export function linkList(links) {
  return Array.isArray(links) ? links : (links?.links || []);
}

export const hasCoords = p => !!p && num(p.lat) !== null && num(p.lon) !== null;

export function drawableLinks(links) {
  return linkList(links).filter(l => hasCoords(l.from) && hasCoords(l.to));
}

// Courbe de Bézier quadratique en lon/lat, bombée vers le nord ; n+1 points [lon, lat].
export function arcPoints(from, to, n = 40) {
  const a = [from.lon, from.lat];
  const b = [to.lon, to.lat];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1e-6;
  let px = -dy / len;
  let py = dx / len;
  if (py < 0) { px = -px; py = -py; }
  const c = [(a[0] + b[0]) / 2 + px * len * 0.22, (a[1] + b[1]) / 2 + py * len * 0.22];
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return pts;
}

// plein = en service, pointillé = en construction / planifié, atténué = non vérifié.
export function linkStyle(l) {
  const inService = l.status === 'en service';
  const verified = l.verified !== false;
  return { dashed: !inService, alpha: verified ? 0.95 : 0.4, flow: inService && verified };
}

const short = s => String(s || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
export const linkTitle = l => `${short(l.from?.name)} → ${short(l.to?.name)}`;

export function linkTip(l) {
  const hasCap = l.capacity && l.capacity.value !== null && l.capacity.value !== undefined;
  return {
    title: linkTitle(l),
    lines: [
      'Liaison schématique, pas le tracé réel',
      `${LINK_STATUS_LABEL[l.status] || l.status}${l.verified === false ? ' · non vérifiée' : ''}`,
      ...(hasCap ? [`Capacité publiée : ${l.capacity.value} ${l.capacity.unit || ''}, pas un volume disponible`] : []),
      `Source : ${l.sourceTitle || l.sourceUrl}`,
      ...(l.from?.coordSource || l.to?.coordSource ? ['Extrémités placées d’après ' + [...new Set([l.from?.coordSource, l.to?.coordSource].filter(Boolean).map(c => /openstreetmap/i.test(c.name) ? 'OpenStreetMap' : /wikidata/i.test(c.name) ? 'Wikidata' : c.name))].join(' et ') + ', pas d’après la conduite'] : []),
    ],
    href: l.sourceUrl,
  };
}

export function distToPolyline(pt, poly) {
  let best = Infinity;
  for (let i = 1; i < poly.length; i++) {
    const [x1, y1] = poly[i - 1];
    const [x2, y2] = poly[i];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((pt.x - x1) * dx + (pt.y - y1) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(pt.x - (x1 + t * dx), pt.y - (y1 + t * dy)));
  }
  return best;
}
