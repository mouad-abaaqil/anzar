import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, toCsv } from './csv.mjs';
import { createRainService } from './rain.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PARAMETERS = [
  { id: 'pH', label: 'pH', unit: 'pH', min: 0, max: 14 },
  { id: 'conductivity', label: 'Conductivité', unit: 'µS/cm', min: 0 },
  { id: 'turbidity', label: 'Turbidité', unit: 'NTU', min: 0 },
  { id: 'nitrate', label: 'Nitrates', unit: 'mg/L', min: 0 },
  { id: 'temperature', label: 'Température', unit: '°C', min: -10, max: 100 },
  { id: 'dissolved_oxygen', label: 'Oxygène dissous', unit: 'mg/L', min: 0 },
  { id: 'ecoli', label: 'E. coli', unit: 'CFU/100mL', min: 0 },
];
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
class ApiError extends Error { constructor(status, message, details) { super(message); this.status = status; this.details = details; } }
const text = (v, max = 200) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const tokenHash = token => createHash('sha256').update(token).digest('hex');
const userView = row => ({ id: row.id, name: row.name, email: row.email, workspace: row.workspace });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };

export function createApp({ dbPath = process.env.DB_PATH || resolve(root, 'data/srmsm.sqlite'), publicDir = resolve(root, 'public'), distDir = resolve(root, 'dist'), fetchImpl = globalThis.fetch, secureCookies = process.env.COOKIE_SECURE === 'true' } = {}) {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, workspace TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS observations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, facility_id TEXT NOT NULL, sampled_at TEXT NOT NULL, parameter TEXT NOT NULL, value REAL NOT NULL, unit TEXT NOT NULL, source TEXT NOT NULL, method TEXT NOT NULL, provenance TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS observations_owner ON observations(user_id,sampled_at);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);`);
  const attempts = new Map();
  let weatherCache = null;
  const rain = createRainService({ fetchImpl, loadRegion: region });
  function rateLimit(req, category, limit) {
    const key = `${category}:${req.socket.remoteAddress}`; const now = Date.now();
    let entry = attempts.get(key);
    if (!entry || now - entry.start > 15 * 60_000) { entry = { start: now, count: 0 }; attempts.set(key, entry); }
    if (++entry.count > limit) throw new ApiError(429, 'Trop de requêtes. Réessayez dans quelques minutes.');
    if (attempts.size > 10_000) for (const [k, v] of attempts) if (now - v.start > 15 * 60_000) attempts.delete(k);
  }
  function region() {
    try { return JSON.parse(readFileSync(resolve(publicDir, 'data/region.json'), 'utf8')); }
    catch { throw new ApiError(503, 'Le référentiel public est temporairement indisponible.'); }
  }
  function authenticate(req, required = true) {
    const cookie = req.headers.cookie || '';
    const token = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('srmsm_session='))?.slice('srmsm_session='.length);
    const user = token && /^[a-f0-9]{64}$/.test(token) ? db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?').get(tokenHash(token), Date.now()) : null;
    if (!user && required) throw new ApiError(401, 'Connectez-vous pour accéder à votre espace de mesures.');
    return user || null;
  }
  function issueSession(res, userId) {
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(tokenHash(token), userId, Date.now() + SESSION_MS);
    res.setHeader('Set-Cookie', `srmsm_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}${secureCookies ? '; Secure' : ''}`);
  }
  function validateObservation(input) {
    if (!input || typeof input !== 'object') throw new ApiError(422, 'Mesure invalide.');
    const facilityId = text(input.facilityId, 100);
    if (!region().facilities?.some(f => f.id === facilityId)) throw new ApiError(422, 'Infrastructure inconnue.');
    const parameter = PARAMETERS.find(p => p.id === input.parameter);
    if (!parameter) throw new ApiError(422, 'Paramètre non pris en charge.');
    const unit = text(input.unit, 40).replace('μ', 'µ');
    if (unit !== parameter.unit) throw new ApiError(422, `Unité attendue pour ${parameter.label} : ${parameter.unit}.`);
    if ((typeof input.value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(input.value.trim())) || input.value === null || input.value === undefined || typeof input.value === 'boolean' || (typeof input.value !== 'string' && typeof input.value !== 'number')) throw new ApiError(422, 'La valeur numérique est requise.');
    const value = Number(input.value);
    if (!Number.isFinite(value) || value < parameter.min || (parameter.max !== undefined && value > parameter.max)) throw new ApiError(422, `Valeur hors du domaine physique accepté pour ${parameter.label}.`);
    const dateString = text(input.sampledAt, 40);
    if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(dateString)) throw new ApiError(422, 'Date de prélèvement ISO requise (AAAA-MM-JJ ou horodatage avec fuseau).');
    const date = new Date(dateString);
    if (!Number.isFinite(date.getTime()) || dateString.slice(0,10) !== new Date(`${dateString.slice(0,10)}T00:00:00Z`).toISOString().slice(0,10) || date.getTime() > Date.now()) throw new ApiError(422, 'La date de prélèvement doit être valide et ne peut pas être future.');
    const source = text(input.source, 500);
    if (!source) throw new ApiError(422, 'Indiquez la source ou le laboratoire de cette mesure.');
    return { facilityId, sampledAt: date.toISOString(), parameter: parameter.id, value, unit, source, method: text(input.method, 300), provenance: 'user-imported' };
  }
  function insertObservation(userId, input) {
    const observation = { id: randomUUID(), ...input, createdAt: new Date().toISOString() };
    db.prepare('INSERT INTO observations VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(observation.id, userId, observation.facilityId, observation.sampledAt, observation.parameter, observation.value, observation.unit, observation.source, observation.method, observation.provenance, observation.createdAt);
    return observation;
  }
  function observations(userId) {
    return db.prepare('SELECT id, facility_id AS facilityId, sampled_at AS sampledAt, parameter, value, unit, source, method, provenance, created_at AS createdAt FROM observations WHERE user_id=? ORDER BY sampled_at DESC,created_at DESC').all(userId);
  }
  async function body(req) {
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > 1_048_576) throw new ApiError(413, 'Le fichier dépasse la limite de 1 Mo.'); chunks.push(chunk); }
    try { const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(); return parsed; }
    catch { throw new ApiError(400, 'Corps JSON invalide.'); }
  }
  const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
  async function handler(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    let pathname;
    try {
      pathname = new URL(req.url, 'http://localhost').pathname;
      if (pathname.startsWith('/api/')) {
        rateLimit(req, 'general', 2000);
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
          const allowed = new Set([`http://${req.headers.host}`, `https://${req.headers.host}`, 'http://localhost:5173', 'http://127.0.0.1:5173', ...(process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)]);
          if ((req.headers.origin && !allowed.has(req.headers.origin)) || req.headers['sec-fetch-site'] === 'cross-site') throw new ApiError(403, 'Origine de la requête non autorisée.');
          const bodylessLogout = req.method === 'POST' && pathname === '/api/auth/logout' && (!req.headers['content-length'] || req.headers['content-length'] === '0') && !req.headers['transfer-encoding'];
          if (!req.headers['content-type']?.startsWith('application/json') && req.method !== 'DELETE' && !bodylessLogout) throw new ApiError(415, 'Utilisez le format application/json.');
        }
        if (req.method === 'GET' && pathname === '/api/health') return json(res, 200, { status: 'ok', storage: 'sqlite', version: '1.0.0' });
        if (req.method === 'GET' && pathname === '/api/region') return json(res, 200, region());
        if (req.method === 'GET' && pathname === '/api/parameters') return json(res, 200, { parameters: PARAMETERS });
        if (req.method === 'GET' && pathname === '/api/auth/me') { const user = authenticate(req, false); return json(res, 200, { user: user && userView(user) }); }
        if (req.method === 'POST' && pathname === '/api/auth/register') {
          rateLimit(req, 'auth', 40); const input = await body(req);
          const name = text(input.name, 100), email = text(input.email, 254).toLowerCase(), workspace = text(input.workspace, 100) || 'Mon espace';
          if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(422, 'Indiquez votre nom et une adresse e-mail valide.');
          if (typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 128) throw new ApiError(422, 'Le mot de passe doit contenir entre 12 et 128 caractères.');
          if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) throw new ApiError(409, 'Un compte existe déjà pour cette adresse.');
          const salt = randomBytes(16).toString('hex'); const hash = scryptSync(input.password, salt, 64).toString('hex');
          const user = { id: randomUUID(), name, email, workspace };
          db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run(user.id, name, email, workspace, `${salt}:${hash}`, new Date().toISOString());
          issueSession(res, user.id); return json(res, 201, { user });
        }
        if (req.method === 'POST' && pathname === '/api/auth/login') {
          rateLimit(req, 'auth', 40); const input = await body(req);
          if (typeof input.password !== 'string' || input.password.length > 128) throw new ApiError(401, 'Adresse e-mail ou mot de passe incorrect.');
          const user = db.prepare('SELECT * FROM users WHERE email=?').get(text(input.email, 254).toLowerCase());
          const [salt, expected] = (user?.password_hash || `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
          const actual = scryptSync(input.password, salt, 64);
          if (!timingSafeEqual(actual, Buffer.from(expected, 'hex')) || !user) throw new ApiError(401, 'Adresse e-mail ou mot de passe incorrect.');
          issueSession(res, user.id); return json(res, 200, { user: userView(user) });
        }
        if (req.method === 'POST' && pathname === '/api/auth/logout') {
          const token = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('srmsm_session='))?.slice(14);
          if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(token));
          res.setHeader('Set-Cookie', `srmsm_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookies ? '; Secure' : ''}`);
          return json(res, 200, { ok: true });
        }
        if (req.method === 'GET' && pathname === '/api/weather') {
          if (weatherCache && Date.now() - weatherCache.fetched < 15 * 60_000) return json(res, 200, weatherCache.data);
          const url = 'https://api.open-meteo.com/v1/forecast?latitude=30.4278&longitude=-9.5981&daily=temperature_2m_max,precipitation_sum,et0_fao_evapotranspiration&past_days=14&forecast_days=7&timezone=Africa%2FCasablanca';
          try {
            const upstream = await fetchImpl(url, { signal: AbortSignal.timeout(12000) });
            if (!upstream.ok) throw new Error('upstream');
            const data = await upstream.json();
            if (!Array.isArray(data.daily?.time)) throw new Error('format');
            const result = { ...data, attribution: { name: 'Open-Meteo', url: 'https://open-meteo.com/', license: 'CC BY 4.0', kind: 'modelled', description: 'Données météorologiques modélisées et prévisions pour Agadir. Ce ne sont pas des mesures de qualité de l’eau.' }, fetchedAt: new Date().toISOString() };
            weatherCache = { fetched: Date.now(), data: result }; return json(res, 200, result);
          } catch { throw new ApiError(502, 'Le service météo est indisponible. Réessayez plus tard.'); }
        }
        if (req.method === 'GET' && pathname === '/api/rain') return json(res, 200, await rain.get());
        if (pathname.startsWith('/api/observations')) {
          const user = authenticate(req);
          if (req.method === 'GET' && pathname === '/api/observations') return json(res, 200, { observations: observations(user.id) });
          if (req.method === 'GET' && pathname === '/api/observations/export') { res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="mesures-qualite.csv"', 'Cache-Control': 'no-store' }); return res.end(toCsv(observations(user.id))); }
          if (req.method === 'POST' && pathname === '/api/observations') return json(res, 201, { observation: insertObservation(user.id, validateObservation(await body(req))) });
          if (req.method === 'POST' && pathname === '/api/observations/import') {
            const input = await body(req); let parsed;
            try { parsed = parseCsv(input.csv); } catch (error) { throw new ApiError(422, error.message); }
            const errors = [], valid = [];
            parsed.forEach((row, i) => { try { valid.push(validateObservation(row)); } catch (error) { errors.push({ row: i + 2, error: error.message }); } });
            if (errors.length) throw new ApiError(422, 'Import annulé : corrigez les lignes indiquées. Aucune mesure ajoutée.', errors.slice(0, 100));
            db.exec('BEGIN');
            try { valid.forEach(row => insertObservation(user.id, row)); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; }
            return json(res, 201, { imported: valid.length });
          }
          if (req.method === 'DELETE' && /^\/api\/observations\/[a-f0-9-]+$/.test(pathname)) {
            const result = db.prepare('DELETE FROM observations WHERE id=? AND user_id=?').run(pathname.split('/').pop(), user.id);
            if (!result.changes) throw new ApiError(404, 'Mesure introuvable dans votre espace.');
            return json(res, 200, { ok: true });
          }
        }
        throw new ApiError(404, 'Route API introuvable.');
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw new ApiError(405, 'Méthode non autorisée.');
      let decoded; try { decoded = decodeURIComponent(pathname); } catch { throw new ApiError(400, 'Adresse invalide.'); }
      const directory = existsSync(distDir) ? distDir : publicDir;
      let file = resolve(directory, `.${decoded}`);
      if (!file.startsWith(`${resolve(directory)}${sep}`) && file !== resolve(directory)) throw new ApiError(403, 'Chemin non autorisé.');
      if (!existsSync(file) || !statSync(file).isFile()) {
        if (extname(decoded)) throw new ApiError(404, 'Fichier introuvable.');
        file = resolve(directory, 'index.html');
      }
      if (!existsSync(file)) throw new ApiError(404, 'Interface non construite. Lancez npm run build ou npm run dev.');
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=300' });
      res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
    } catch (error) {
      if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'Une erreur interne est survenue.', ...(error.details ? { details: error.details } : {}) });
      else res.end();
      if (!error.status) console.error('[api]', error.message);
    }
  }
  const server = http.createServer(handler);
  server.headersTimeout = 15000; server.requestTimeout = 30000;
  return { server, db, close: () => new Promise((resolveClose, reject) => server.close(error => { db.close(); error ? reject(error) : resolveClose(); })) };
}
