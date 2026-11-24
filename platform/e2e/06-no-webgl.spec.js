import { test, expect } from '@playwright/test';
import { BAD_TEXT, NO_GPU_ARGS, overflowX, scrollToStep, visibleText, watchConsole } from './helpers.js';

test.use({ launchOptions: { args: NO_GPU_ARGS } });

test.describe('sans WebGL', () => {
  test('landing lisible et défilable, MiniSim fonctionne', async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto('/#/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Combien d’eau');
    await expect(page.getByRole('button', { name: 'Explorer le tableau de bord' })).toBeVisible();
    const webgl = await page.evaluate(() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); });
    test.info().annotations.push({ type: 'info', description: 'WebGL disponible dans ce contexte : ' + webgl });
    await page.waitForTimeout(2500);
    for (const id of ['contexte', 'ecarts', 'demande', 'sud', 'climat', 'barrages', 'chiffres', 'essayez']) {
      await scrollToStep(page, 'sty-t-' + id);
      await expect(page.locator('#sty-t-' + id), id).toBeVisible();
    }
    const sim = page.locator('.msim');
    const a = await sim.locator('.msim__num').innerText();
    await sim.getByLabel('Économies d’eau').focus(); await page.keyboard.press('End');
    await expect.poll(() => sim.locator('.msim__num').innerText()).not.toBe(a);
    const ox = await overflowX(page);
    expect.soft(ox.scrollWidth, JSON.stringify(ox)).toBeLessThanOrEqual(ox.inner);
    expect.soft(await visibleText(page)).not.toMatch(BAD_TEXT);
    test.info().annotations.push({ type: 'info', description: 'erreurs console sans WebGL : ' + JSON.stringify(errors) });
    expect.soft(errors.filter(e => !/webgl|WebGL|maplibre|GL context/i.test(e)), 'erreurs console hors WebGL').toEqual([]);
  });

  test('tableau de bord : panneau affiché, onglets', async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto('/#/r/souss-massa');
    await expect(page.locator('.pn-shell .pn-hero')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.pn-hero .az-stat__num').first()).toContainText(/\d/);
    for (const [tab, re] of [['Demain', /tomorrow$/], ['Ensemble', /together$/]]) {
      await page.getByRole('tab', { name: tab }).click();
      await expect(page).toHaveURL(re);
      await expect(page.locator('.pn-shell .az-stat__num').first()).toContainText(/\d/);
    }
    expect.soft(await visibleText(page)).not.toMatch(BAD_TEXT);
    test.info().annotations.push({ type: 'info', description: 'erreurs console sans WebGL : ' + JSON.stringify(errors) });
    expect.soft(errors.filter(e => !/webgl|WebGL|maplibre|GL context/i.test(e)), 'erreurs console hors WebGL').toEqual([]);
  });
});
