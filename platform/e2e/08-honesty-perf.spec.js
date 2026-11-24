import { test, expect } from '@playwright/test';
import { scrollToStep, visibleText, waitDashboard, waitMap } from './helpers.js';

test.describe('contenu honnête', () => {
  test('landing : « pas un relevé en direct » et « Prototype indépendant »', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const hero = await visibleText(page);
    expect.soft(hero, 'Prototype indépendant (héros)').toMatch(/Prototype indépendant/i);
    await scrollToStep(page, 'sty-t-chiffres');
    await page.waitForTimeout(500);
    const sec = await page.locator('#sty-t-chiffres').evaluate(h => h.closest('section').innerText);
    const secLabels = await page.locator('#sty-t-chiffres').evaluate(h => [...h.closest('section').querySelectorAll('[title],[aria-label]')].map(e => (e.getAttribute('title') || '') + ' ' + (e.getAttribute('aria-label') || '')).join(' | '));
    const visibleHonest = /pas un relevé en direct|instantané|bulletin du/i.test(sec);
    test.info().annotations.push({ type: 'info', description: 'section Chiffres, texte visible : ' + sec.replace(/\n+/g, ' / ').slice(0, 400) });
    expect.soft(visibleHonest, 'la section Chiffres du bulletin dit (visible) qu’il s’agit d’un instantané daté, pas d’un relevé en direct').toBe(true);
    // détail de la pastille de provenance (au clic)
    // la section Chiffres porte la mention visible (date du bulletin et « pas un relevé en direct »)
    await expect(page.locator('#sty-t-chiffres').locator('xpath=ancestor::section')).toContainText(/relevé en direct/i);
    await scrollToStep(page, 'sty-t-essayez');
    await expect(page.locator('.msim__legal')).toContainText(/pas un relevé en direct/i);
    await expect(page.locator('.msim__legal')).toContainText(/pas une prédiction/i);
    // Pied de page : mentions obligatoires.
    const foot = page.locator('footer.sty-foot');
    await foot.scrollIntoViewIfNeeded();
    await expect(foot).toContainText(/prototype indépendant issu d’un stage à la RAMSA/i);
    await expect(foot).toContainText(/pas un portail officiel/i);
    await expect(foot).toContainText(/Open-Meteo/);
    await expect(foot).toContainText(/marques de leurs titulaires/i);
  });

  test('tableau de bord : bulletin daté et prototype indépendant', async ({ page }) => {
    await page.goto('/#/r/souss-massa');
    await waitDashboard(page);
    const t = await page.locator('.pn-shell').innerText();
    expect.soft(t).toMatch(/pas un relevé en direct/i);
    expect.soft(t).toMatch(/Prototype indépendant/i);
    expect.soft(t).toMatch(/pas un portail officiel/i);
    await expect(page.locator('.hub-foot')).toContainText(/pas un portail officiel/i);
    await page.getByRole('tab', { name: 'Demain' }).click();
    await expect(page.locator('.pn-shell')).toContainText(/pas une prédiction/i);
    await page.getByRole('tab', { name: 'Ensemble' }).click();
    await expect(page.locator('.pn-shell')).toContainText(/Aucun volume|aucune liaison|liaison schématique|pas le tracé/i, { timeout: 10_000 });
  });
});

test('performance landing (rapport, pas d’échec)', async ({ page }) => {
  await page.addInitScript(() => {
    window.__perf = { lcp: 0, fcp: 0 };
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__perf.fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
  });
  const t0 = Date.now();
  await page.goto('/#/', { waitUntil: 'load' });
  const tLoad = Date.now() - t0;
  await page.getByRole('heading', { level: 1 }).waitFor();
  const tH1 = Date.now() - t0;
  await page.waitForSelector('.maplibregl-canvas', { timeout: 60_000 });
  const tCanvas = Date.now() - t0;
  await page.waitForTimeout(3000);
  const p = await page.evaluate(() => ({ ...window.__perf, nav: (() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; })(), transfer: Math.round(performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), 0) / 1024) }));
  const report = 'LCP ' + Math.round(p.lcp) + ' ms, FCP ' + Math.round(p.fcp) + ' ms, DCL ' + p.nav.dcl + ' ms, load ' + p.nav.load + ' ms ; h1 visible ' + tH1 + ' ms, canvas carte ' + tCanvas + ' ms (rendu logiciel, machine chargée) ; ressources ' + p.transfer + ' Ko';
  console.log('PERF ' + report);
  test.info().annotations.push({ type: 'perf', description: report });
});
