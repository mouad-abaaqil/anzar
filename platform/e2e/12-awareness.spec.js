import { test, expect } from '@playwright/test';
import { BAD_TEXT, overflowX, watchConsole } from './helpers.js';

// Chapitre « Comprendre l'eau » (sensibilisation) : six étapes, visualisations, provenance, lien de la barre haute,
// rubrique du tiroir Sources, chiffres non répétés, responsive. Sous reduced-motion (valeurs finales) et sans attendre la
// carte (le contenu ne dépend pas du WebGL). Lancer seul, sous le verrou :
// sh scripts/with-capture-lock.sh npx playwright test e2e/12-awareness.spec.js
const STEPS = ['comprendre-rare', 'comprendre-irreguliere', 'comprendre-barrage', 'comprendre-nappes', 'comprendre-solutions', 'comprendre-agir'];

test.describe('Comprendre l’eau', () => {
  test('six étapes entre Barrages et Chiffres, chiffres sourcés, aucun texte cassé', async ({ page }) => {
    const errors = watchConsole(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#/');
    await expect(page.locator('#comprendre')).toBeAttached();
    const order = await page.evaluate(() => [...document.querySelectorAll('[data-stop]')].map(s => s.dataset.stop));
    const i = order.indexOf('barrages'), j = order.indexOf('chiffres');
    expect(order.slice(i + 1, j)).toEqual(STEPS);
    for (const id of STEPS) {
      await page.evaluate(x => document.querySelector('[data-stop="' + x + '"]').scrollIntoView({ block: 'start' }), id);
      await expect(page.locator('#sty-t-' + id)).toBeVisible();
    }
    const sec = id => page.locator('[data-stop="' + id + '"]');
    await expect(sec('comprendre-rare')).toContainText('606');
    await expect(sec('comprendre-rare')).toContainText('2 560');
    await expect(sec('comprendre-irreguliere').locator('.aw-col')).toHaveCount(6);
    await expect(sec('comprendre-irreguliere')).toContainText('Scénario, pas une prévision');
    await expect(sec('comprendre-barrage')).toContainText('Eau potable d’abord');
    await expect(sec('comprendre-nappes')).toContainText('ne sont pas modélisées dans Anzar');
    await expect(sec('comprendre-solutions').locator('.aw-sol')).toHaveCount(4);
    await expect(sec('comprendre-solutions')).toContainText('source secondaire');
    await expect(sec('comprendre-agir')).toContainText('ne suffisent pas');
    // Chaque carte de solution porte sa pastille de provenance.
    for (const card of await sec('comprendre-solutions').locator('.aw-sol').all()) expect(await card.locator('.az-prov').count()).toBeGreaterThan(0);
    const txt = await page.locator('#comprendre').innerText();
    expect(txt).not.toMatch(BAD_TEXT);
    expect(errors, 'erreurs console').toEqual([]);
  });

  test('« Tester le simulateur » descend jusqu’à Essayez', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#/');
    await expect(page.locator('[data-stop="comprendre-agir"]')).toBeAttached();
    await page.evaluate(() => document.querySelector('[data-stop="comprendre-agir"]').scrollIntoView({ block: 'start' }));
    await page.getByRole('button', { name: 'Tester le simulateur' }).click();
    await expect(page.locator('#sty-t-essayez')).toBeInViewport({ timeout: 8000 });
  });

  test('lien « Comprendre » de la barre haute, depuis l’accueil et depuis le tableau de bord', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#/');
    await expect(page.locator('#comprendre')).toBeAttached();
    await page.locator('.hub-nav').getByRole('link', { name: 'Comprendre' }).click();
    await expect(page.locator('#sty-t-comprendre-rare')).toBeInViewport({ timeout: 8000 });
    await page.goto('/#/r/souss-massa');
    await page.locator('.hub-nav').getByRole('link', { name: 'Comprendre' }).click();
    await expect(page.locator('#sty-t-comprendre-rare')).toBeInViewport({ timeout: 15000 });
  });

  test('tiroir Sources : rubrique de sensibilisation avec chaque fait, lien https, date, statut', async ({ page }) => {
    await page.goto('/#/sources');
    const box = page.locator('.aw-src');
    await expect(box.getByRole('heading', { name: 'Sensibilisation : sources des chiffres' })).toBeVisible({ timeout: 20000 });
    await expect(box).toContainText('dont la vidéo n’est pas une source officielle');
    const items = box.locator('.aw-src__list > li');
    expect(await items.count()).toBe(18);
    for (const a of await box.locator('.aw-src__list a').all()) expect(await a.getAttribute('href')).toMatch(/^https:\/\//);
    await expect(box).toContainText('lu le 24 nov. 2026');
    await expect(box).toContainText('Source secondaire');
    await expect(box).not.toContainText('youtube.com');
  });

  test('responsive : 360 à 1920 px sans débordement, légendes dans la fenêtre, cibles ≥ 44 px', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#/');
    await expect(page.locator('#comprendre')).toBeAttached();
    for (const [w, h] of [[360, 740], [390, 844], [768, 1024], [1280, 800], [1920, 1080]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(250);
      const ox = await overflowX(page);
      expect.soft(ox.scrollWidth, w + ' px ' + JSON.stringify(ox)).toBeLessThanOrEqual(ox.inner);
      for (const id of STEPS) {
        await page.evaluate(x => document.querySelector('[data-stop="' + x + '"]').scrollIntoView({ block: 'start' }), id);
        const g = await page.evaluate(x => {
          const sec = document.querySelector('[data-stop="' + x + '"]');
          const c = sec.querySelector('[data-cap]').getBoundingClientRect();
          const out = [...sec.querySelectorAll('[data-cap] *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > c.right + 2 || r.left < c.left - 2); }).map(e => String(e.className).slice(0, 30)).slice(0, 4);
          const small = [...sec.querySelectorAll('.az-btn')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.width < 44 || r.height < 44); }).length;
          return { inX: c.left >= -1 && c.right <= innerWidth + 1, out, small };
        }, id);
        expect.soft(g.inX, w + ' ' + id + ' légende hors fenêtre').toBe(true);
        expect.soft(g.out, w + ' ' + id + ' contenu qui dépasse de la légende').toEqual([]);
        expect.soft(g.small, w + ' ' + id + ' cibles < 44 px').toBe(0);
      }
    }
  });
});
