import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const REGIONS = JSON.parse(readFileSync(join(here, '../public/data/regions.json'), 'utf8')).regions.map(r => ({ id: r.id, name: r.name }));
export const NO_STOCK = ['laayoune-sakia-el-hamra', 'dakhla-oued-ed-dahab']; // indicateur de flux, pas de mois
export const BAD_TEXT = /\b(NaN|undefined|null|Infinity)\b/;
export const NO_GPU_ARGS = ['--disable-gpu', '--disable-webgl', '--disable-webgl2', '--disable-3d-apis'];

const TILE_HOSTS = /mapterhorn|openfreemap|openmaptiles/i;

/** Collecte les erreurs console / page ; ignore les 404 de tuiles (Mapterhorn au-dessus de l'océan). */
export function watchConsole(page) {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const url = m.location()?.url || '';
    const text = m.text();
    if (TILE_HOSTS.test(url + text)) return; // seuls les 404 de tuiles de fond de carte sont tolérés
    errors.push('console.error: ' + text + (url ? ' [' + url + ']' : ''));
  });
  // Toute réponse HTTP >= 400 de la même origine (logo, JSON, image manquants) est un défaut.
  page.on('response', r => {
    const u = r.url();
    if (r.status() >= 400 && !TILE_HOSTS.test(u)) errors.push('http ' + r.status() + ' ' + u);
  });
  return errors;
}

/** Texte visible de la page (innerText), sans les <script>/<style>. */
export const visibleText = page => page.evaluate(() => document.body.innerText);

/** Attend la carte (canvas MapLibre) puis laisse le rendu logiciel se poser. */
export async function waitMap(page, settle = 4000) {
  await page.waitForSelector('.maplibregl-canvas', { timeout: 60_000 });
  if (settle) await page.waitForTimeout(settle);
}

export async function waitDashboard(page) {
  await page.waitForSelector('.pn-shell .pn-hero, .pn-shell .az-tabs__panel', { timeout: 60_000 });
}

/** Débordement horizontal à l'intérieur des conteneurs à défilement propre (invisible pour documentElement). */
export const innerOverflow = page => page.evaluate(() => [...document.querySelectorAll('.sty-scroll, .pn-shell__body, .pn-shell, .az-sheet__body')]
  .map(el => ({ cls: el.className.toString().slice(0, 30), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }))
  .filter(o => o.scrollWidth > o.clientWidth + 1));

export const overflowX = page => page.evaluate(() => {
  const de = document.documentElement;
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width && r.right > window.innerWidth + 1 && !el.closest('.maplibregl-map, .sty-scroll, dialog:not([open])')) {
      offenders.push((el.className && String(el.className).slice(0, 40)) || el.tagName);
      if (offenders.length > 5) break;
    }
  }
  return { scrollWidth: Math.max(de.scrollWidth, document.body.scrollWidth), inner: window.innerWidth, offenders };
});

/** Attend la fin des animations finies (les infinies sont ignorées). */
export const settleAnimations = page => page.evaluate(() => Promise.all(document.getAnimations()
  .filter(a => a.effect?.getTiming?.().iterations !== Infinity).map(a => a.finished.catch(() => {}))).then(() => true));

/** Fait défiler le récit (conteneur .sty-scroll) jusqu'au haut d'une section. */
export async function scrollToStep(page, headingId) {
  await page.evaluate(id => {
    const sec = document.getElementById(id)?.closest('section');
    sec?.scrollIntoView({ block: 'start' });
  }, headingId);
}

export async function pickRegion(page, scopeSelector, name) {
  const scope = page.locator(scopeSelector).first();
  await scope.locator('.az-region__trigger').click();
  await page.locator('.az-region__pop .az-region__item', { hasText: name }).first().click();
}
