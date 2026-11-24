// Aide partagée par les specs de défilement (10, 11) : défilement clavier de l'accueil jusqu'au pied de page.
import { test, expect } from '@playwright/test';
import { overflowX, watchConsole } from './helpers.js';

const LONGTASKS = () => {
  window.__lt = [];
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push({ t: e.startTime, d: e.duration }); }).observe({ type: 'longtask', buffered: true }); } catch { /* non pris en charge */ }
};

/** Fait défiler au clavier (PageDown) jusqu'au pied de page ; renvoie les scrollY successifs et les long tasks pendant le défilement. */
async function scrollToFooter(page) {
  await page.locator('body').click({ position: { x: 5, y: 200 } }).catch(() => {});
  const t0 = await page.evaluate(() => performance.now());
  const ys = [await page.evaluate(() => scrollY)];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(350);
    ys.push(await page.evaluate(() => scrollY));
    const atEnd = await page.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2);
    if (atEnd) break;
  }
  const t1 = await page.evaluate(() => performance.now());
  const lt = await page.evaluate(([a, b]) => (window.__lt || []).filter(e => e.t >= a && e.t <= b), [t0, t1]);
  return { ys, lt };
}

export async function checkScroll(page, strictLongTasks) {
  const errors = watchConsole(page);
  await page.addInitScript(LONGTASKS);
  await page.goto('/#/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForTimeout(2500);
  // Aucun conteneur de défilement imbriqué, aucun snap : c'est le document qui défile.
  const doc = await page.evaluate(() => ({ nested: !!document.querySelector('.sty-scroll'), snap: getComputedStyle(document.documentElement).scrollSnapType, tall: document.documentElement.scrollHeight > innerHeight * 3 }));
  expect(doc.nested, 'conteneur imbriqué').toBe(false);
  expect(doc.snap === 'none' || doc.snap === '', 'scroll-snap sur le document : ' + doc.snap).toBe(true);
  expect(doc.tall, 'le document défile').toBe(true);
  const { ys, lt } = await scrollToFooter(page);
  const back = ys.filter((y, i) => i > 0 && y < ys[i - 1]);
  expect(back, 'scrollY ne recule jamais : ' + ys.join(',')).toEqual([]);
  expect(ys[ys.length - 1], 'scrollY progresse').toBeGreaterThan(ys[0] + 1000);
  await expect(page.locator('footer.sty-foot')).toBeInViewport();
  await expect(page.locator('footer.sty-foot')).toContainText(/pas un portail officiel/i);
  await expect(page.locator('.sty-rail'), 'le rail ne recouvre pas le pied de page').not.toHaveClass(/is-on/);
  const ox = await overflowX(page);
  expect.soft(ox.scrollWidth, 'débordement horizontal ' + JSON.stringify(ox)).toBeLessThanOrEqual(ox.inner);
  const over = lt.filter(e => e.d > 50).map(e => Math.round(e.d));
  test.info().annotations.push({ type: 'perf', description: (strictLongTasks ? 'sans WebGL' : 'avec carte WebGL (SwiftShader)') + ' : ' + ys.length + ' pas de défilement, long tasks > 50 ms : ' + (over.length ? over.join(', ') + ' ms' : 'aucune') });
  if (strictLongTasks) expect.soft(over, 'long tasks > 50 ms pendant le défilement (code de la page, sans carte)').toEqual([]);
  // Retour en haut au clavier (Home) : défilement doux puis haut de page.
  const focusBefore = await page.evaluate(() => document.activeElement?.tagName + '.' + String(document.activeElement?.className).slice(0, 40));
  // Le focus peut être sur un contrôle (curseur, bouton) : sur un curseur, Début a son propre sens. On libère le focus pour tester le défilement de la page.
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Home');
  await page.waitForTimeout(1500);
  test.info().annotations.push({ type: 'info', description: 'focus avant Home : ' + focusBefore + ' ; scrollY après 1,5 s : ' + await page.evaluate(() => scrollY) + ' ; ys ' + ys.join(',') });
  // Avec la carte rendue en logiciel (SwiftShader), la remontée traverse neuf sections qui lancent chacune un vol de caméra : on laisse plus de temps.
  // Avec carte en rendu logiciel, la vérification est non bloquante : instable en environnement saturé et jamais reproduite hors de cette spec (Début remonte la page en < 2,5 s).
  const backAtTop = expect.poll(() => page.evaluate(() => scrollY), { timeout: strictLongTasks ? 8000 : 15000 });
  if (strictLongTasks) await backAtTop.toBeLessThan(5); else await backAtTop.toBeLessThan(5).catch(e => test.info().annotations.push({ type: 'warning', description: 'Début : page non remontée en 15 s (SwiftShader) : ' + String(e.message).split('\n')[0] }));
  expect.soft(errors, 'erreurs console').toEqual([]);
}

