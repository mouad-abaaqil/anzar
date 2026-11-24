// Accès à l'API serveur (optionnelle). Hébergement statique : pas de /api/*, et un hébergeur peut répondre
// index.html en 200 à une adresse inconnue. Une réponse non JSON compte donc comme un échec.
export const STATIC_BUILD = import.meta.env?.VITE_STATIC === '1';
export const SERVER_ONLY_NOTICE = 'Disponible uniquement dans la version serveur';

/** Le serveur répond-il en JSON (même 401) ? Faux en build statique, en réseau coupé, ou si l'hébergeur renvoie index.html. */
export async function probeServer(fetchFn = globalThis.fetch) {
  if (STATIC_BUILD) return false;
  try {
    const r = await fetchFn('/api/auth/me');
    if (/json/i.test(r.headers?.get?.('content-type') || '')) { await r.json(); return true; }
    return false;
  } catch { return false; }
}

/** JSON de l'API, ou une erreur : réseau en échec, statut non 2xx, ou corps qui n'est pas du JSON. */
export async function apiJson(url, init, fetchFn = globalThis.fetch) {
  if (STATIC_BUILD) throw new Error('static');
  const r = await fetchFn(url, init);
  if (!r.ok) throw new Error('http ' + r.status);
  const type = r.headers?.get?.('content-type') || '';
  if (type && !/json/i.test(type)) throw new Error('not-json');
  try { return await r.json(); } catch { throw new Error('not-json'); }
}
