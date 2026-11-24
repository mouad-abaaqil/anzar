import { test, expect } from '@playwright/test';
import { overflowX, waitDashboard, waitMap } from './helpers.js';
import { checkScroll } from './scroll-helpers.js';

// Défilement natif de l'accueil, pied de page toujours atteignable, barre basse du tableau de bord, mise en page des
// légendes posées sur la carte (le bouton Partager a été retiré : le nom du fichier est gardé pour les références).
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
  test('légendes sur la carte : 360 à 1920 px, dans la fenêtre, sans chevauchement, cibles ≥ 44 px', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); // légendes à leur place finale (pas d'apparition)
    await page.goto('/#/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const ids = ['hero', 'contexte', 'ecarts', 'demande', 'sud', 'climat', 'barrages', 'chiffres', 'essayez'];
    const sides = new Set();
    for (const [w, h] of [[360, 740], [390, 844], [768, 1024], [1024, 768], [1280, 800], [1920, 1080]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(300);
      const ox = await overflowX(page);
      expect.soft(ox.scrollWidth, w + ' px ' + JSON.stringify(ox)).toBeLessThanOrEqual(ox.inner);
      for (const id of ids) {
        await page.evaluate(i => document.querySelector('[data-stop="' + i + '"]')?.scrollIntoView({ block: 'start' }), id);
        await page.waitForTimeout(150);
        const g = await page.evaluate(i => {
          const sec = document.querySelector('[data-stop="' + i + '"]');
          const c = sec.querySelector('[data-cap]').getBoundingClientRect();
          const s = sec.getBoundingClientRect();
          const bar = document.querySelector('.hub-bar').getBoundingClientRect();
          const rail = document.querySelector('.sty-rail.is-on')?.getBoundingClientRect();
          const ov = (a, b) => !!(a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1);
          const small = [...sec.querySelectorAll('.az-btn, .sty-hero__scroll, .msim input[type=range]')]
            .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 44 || r.height < 44); })
            .map(e => (e.innerText || e.className).toString().trim().slice(0, 24));
          return {
            inX: c.left >= -1 && c.right <= innerWidth + 1, rail: ov(c, rail), small,
            topFrac: (c.top - s.top) / (innerHeight - bar.bottom), side: sec.className.match(/sty-sec--(left|right|bottom|low|center)/)?.[1],
          };
        }, id);
        if (g.side) sides.add(g.side);
        expect.soft(g.inX, w + ' px, ' + id + ' : légende hors de la fenêtre').toBe(true);
        expect.soft(g.rail, w + ' px, ' + id + ' : légende sous le rail').toBe(false);
        expect.soft(g.small, w + ' px, ' + id + ' : cibles < 44 px').toEqual([]);
        // Mobile : la moitié haute reste à la carte (la légende commence sous ~40 % de la scène).
        if (w < 900) expect.soft(g.topFrac, w + ' px, ' + id + ' : la légende mange la moitié haute (carte)').toBeGreaterThan(0.38);
      }
    }
    // Composition variée sur grand écran (pas toujours une colonne à gauche).
    expect(sides.size, 'places des légendes : ' + [...sides].join(',')).toBeGreaterThanOrEqual(4);
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
