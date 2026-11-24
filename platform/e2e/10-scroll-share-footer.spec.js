import { test, expect } from '@playwright/test';
import { overflowX, waitDashboard, waitMap } from './helpers.js';
import { checkScroll } from './scroll-helpers.js';

// Défilement natif de l'accueil, pied de page toujours atteignable, barre basse du tableau de bord, partage robuste.
// Machine sensible : lancer seul, sous le verrou (sh scripts/with-capture-lock.sh npx playwright test e2e/10-scroll-share-footer.spec.js).

test.describe('défilement de l’accueil', () => {
  test('clavier jusqu’au pied de page, avec la carte (long tasks en rapport)', async ({ page }) => {
    await checkScroll(page, false);
    await waitMap(page, 0);
  });
  test('aucun chiffre répété d’une section à l’autre', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); // compteurs à leur valeur finale
    await page.goto('/#/');
    await expect(page.locator('#sty-t-chiffres')).toBeAttached();
    await page.waitForTimeout(1500);
    const bySec = await page.evaluate(() => [...document.querySelectorAll('.sty-sec, footer.sty-foot')].map(s => ({
      id: s.getAttribute('aria-labelledby') || 'pied',
      // Chiffres de contenu seulement : sans numéros de chapitre, dates du bulletin, mentions de bas de section ni mini-simulation (calcul interactif).
      nums: (() => {
        const c = s.cloneNode(true);
        c.querySelectorAll('.sty-kicker, .sty-caveat, .msim, .sty-sr, .az-prov').forEach(e => e.remove());
        const txt = c.textContent.replace(/\d{1,2}\s+(janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)\.?\s+\d{4}/g, ' ');
        return [...new Set((txt.match(/\d[\d\u{a0}\u{202f} ]*(?:,\d+)?/gu) || []).map(n => n.replace(/[\s\u{a0}\u{202f}]/gu, '')).filter(n => n.length >= 2 && !/^(19|20)[0-9][0-9]$/.test(n)))];
      })(),
    })));
    const seen = new Map(), dup = [];
    for (const s of bySec) for (const n of s.nums) { if (seen.has(n) && seen.get(n) !== s.id) dup.push(n + ' (' + seen.get(n) + ' / ' + s.id + ')'); else seen.set(n, s.id); }
    test.info().annotations.push({ type: 'info', description: JSON.stringify(bySec) });
    expect(dup, 'chiffres répétés entre sections').toEqual([]);
  });
  test('« Voir les chiffres » défile doucement jusqu’à la section', async ({ page }) => {
    await page.goto('/#/');
    await page.getByRole('button', { name: 'Voir les chiffres' }).click();
    await expect(page.locator('#sty-t-chiffres')).toBeInViewport({ timeout: 8000 });
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(1000);
  });
  test('pas de débordement à 768, 1280 et 1920 px', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    for (const [w, h] of [[768, 1024], [1280, 800], [1920, 1080]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(300);
      const ox = await overflowX(page);
      expect.soft(ox.scrollWidth, w + ' px ' + JSON.stringify(ox)).toBeLessThanOrEqual(ox.inner);
      // Titres de section alignés : même abscisse pour tous.
      const xs = await page.evaluate(() => [...document.querySelectorAll('.sty-sec .sty-title')].map(t => Math.round(t.getBoundingClientRect().left)));
      expect.soft(new Set(xs).size, w + ' px : titres alignés ' + xs.join(',')).toBe(1);
    }
  });
});

test.describe('pied de page et barre basse', () => {
  test('tableau de bord : barre basse toujours visible, ne recouvre ni panneau ni carte', async ({ page }) => {
    await page.goto('/#/r/souss-massa');
    await waitDashboard(page);
    const foot = page.locator('.hub-foot');
    await expect(foot).toBeVisible();
    await expect(foot).toContainText(/Prototype indépendant/);
    await expect(foot.getByRole('link', { name: 'Sources' })).toBeVisible();
    await expect(foot.getByRole('link', { name: 'Marques' })).toBeVisible();
    const g = await page.evaluate(() => {
      const r = s => document.querySelector(s)?.getBoundingClientRect();
      const f = r('.hub-foot'), p = r('.pn-shell'), m = r('.hub-mapwrap');
      return { vh: innerHeight, footTop: f.top, footBottom: f.bottom, panelBottom: p?.bottom, mapBottom: m?.bottom };
    });
    expect(Math.round(g.footBottom), JSON.stringify(g)).toBe(g.vh);
    expect(g.panelBottom, 'panneau au-dessus de la barre').toBeLessThanOrEqual(g.footTop + 1);
    expect(g.mapBottom, 'carte (et ses contrôles) au-dessus de la barre').toBeLessThanOrEqual(g.footTop + 1);
  });
  test('navigation : « Accueil » (plus de « Récit »)', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.locator('.hub-nav').getByRole('link', { name: 'Accueil' })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.hub-bar')).not.toContainText(/Récit/);
    await expect(page.getByRole('link', { name: /retour à l’accueil/ })).toBeVisible();
  });
});

test.describe('partage', () => {
  test('presse-papiers autorisé : lien de la vue (région et onglet) copié, retour visible', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/#/r/souss-massa/tomorrow');
    await waitDashboard(page);
    await page.locator('.hub-bar .hub-share').click();
    await expect(page.locator('.hub-toast')).toHaveText('Lien copié.');
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(new URL('/#/r/souss-massa/tomorrow', baseURL).href);
    // Accueil : lien vers #/
    await page.goto('/#/');
    await page.locator('.hub-bar .hub-share').click();
    await expect(page.locator('.hub-toast')).toHaveText('Lien copié.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(new URL('/#/', baseURL).href);
  });

  test('presse-papiers refusé : repli execCommand, sinon fenêtre avec le lien sélectionné', async ({ page }) => {
    await page.addInitScript(() => {
      if (navigator.clipboard) navigator.clipboard.writeText = () => Promise.reject(new DOMException('refusé', 'NotAllowedError'));
    });
    await page.goto('/#/r/souss-massa/together');
    await waitDashboard(page);
    await page.locator('.hub-bar .hub-share').click();
    // execCommand('copy') réussit dans Chrome : « Lien copié » ; sinon la fenêtre de repli s'ouvre.
    await expect.poll(async () => (await page.locator('.hub-toast').innerText()) || (await page.locator('dialog.hub-sharebox[open]').count() ? 'dialog' : ''), { timeout: 5000 }).toMatch(/Lien copié|dialog/);
  });

  test('aucune copie possible : fenêtre avec le lien sélectionné, fermable', async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      if (navigator.clipboard) navigator.clipboard.writeText = () => Promise.reject(new DOMException('refusé', 'NotAllowedError'));
      document.execCommand = () => false;
    });
    await page.goto('/#/r/souss-massa/together');
    await waitDashboard(page);
    await page.locator('.hub-bar .hub-share').click();
    const dlg = page.locator('dialog.hub-sharebox[open]');
    await expect(dlg).toBeVisible();
    const input = dlg.getByLabel('Lien de cette vue');
    await expect(input).toHaveValue(new URL('/#/r/souss-massa/together', baseURL).href);
    await expect(input).toBeFocused();
    const sel = await input.evaluate(el => el.selectionEnd - el.selectionStart);
    expect(sel, 'lien sélectionné').toBeGreaterThan(10);
    await dlg.getByRole('button', { name: 'Fermer' }).click();
    await expect(page.locator('dialog.hub-sharebox[open]')).toHaveCount(0);
  });
});
