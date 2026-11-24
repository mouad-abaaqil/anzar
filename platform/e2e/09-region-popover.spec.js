import { test, expect } from '@playwright/test';
import { waitDashboard } from './helpers.js';

// Régression : la liste des 12 SRM ne doit jamais sortir du cadre de la fenêtre.
async function check(page, trigger) {
  await page.locator(trigger).first().click();
  const pop = page.locator('.az-region__pop');
  await expect(pop).toBeVisible();
  await page.waitForTimeout(300);
  const b = await pop.evaluate(e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, vw: document.documentElement.clientWidth, vh: innerHeight }; });
  const m = 8; // marge minimale : une liste collée au bord compte comme « hors du cadre »
  expect(b.l, 'bord gauche').toBeGreaterThanOrEqual(m);
  expect(b.t, 'haut').toBeGreaterThanOrEqual(m);
  expect(b.r, 'bord droit').toBeLessThanOrEqual(b.vw - m);
  expect(b.b, 'bas').toBeLessThanOrEqual(b.vh - m);
  await page.keyboard.press('Escape');
}

test.describe('liste des régions dans le cadre', () => {
  test('desktop : barre haute, panneau, mini-simulation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#/');
    await check(page, '.hub-bar .az-region__trigger');
    await page.goto('/#/r/souss-massa');
    await waitDashboard(page);
    await check(page, '.pn-shell .az-region__trigger');
  });
  test('mobile 390 : panneau et barre', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto('/#/r/souss-massa');
    await waitDashboard(page);
    await check(page, '.pn-shell .az-region__trigger');
    await ctx.close();
  });
});
