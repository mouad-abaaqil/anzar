import { test, expect } from '@playwright/test';
import { BAD_TEXT, overflowX, scrollToStep, visibleText, waitMap, watchConsole } from './helpers.js';

test.describe('landing', () => {
  test('titre, CTA, carte, console propre, pas de débordement, accueil complet', async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto('/#/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Combien d’eau nous reste-t-il');
    await expect(page.getByRole('button', { name: 'Explorer le tableau de bord' })).toBeVisible();
    await waitMap(page, 3000);
    await expect(page.locator('.maplibregl-canvas').first()).toBeVisible();
    const ox = await overflowX(page);
    expect.soft(ox.scrollWidth, 'débordement horizontal ' + JSON.stringify(ox)).toBeLessThanOrEqual(ox.inner);

    // Accueil : chaque section vient dans la fenêtre à tour de rôle (défilement du document).
    for (const id of ['contexte', 'ecarts', 'demande', 'sud', 'climat', 'barrages', 'chiffres', 'essayez']) {
      await scrollToStep(page, 'sty-t-' + id);
      const h = page.locator('#sty-t-' + id);
      await expect(h, 'titre ' + id).toBeVisible();
      await expect.poll(async () => h.evaluate(el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }), { message: id + ' dans la fenêtre' }).toBe(true);
      await page.waitForTimeout(400);
    }
    const txt = await visibleText(page);
    expect.soft(txt).not.toMatch(BAD_TEXT);
    expect.soft(errors, 'erreurs console').toEqual([]);
  });

  test('CTA ouvre le tableau de bord', async ({ page }) => {
    await page.goto('/#/');
    await page.getByRole('button', { name: 'Explorer le tableau de bord' }).click();
    await expect(page).toHaveURL(/#\/r\/souss-massa$/);
    await expect(page.locator('.pn-shell')).toBeVisible({ timeout: 30_000 });
  });

  test('MiniSim : région et curseurs changent le grand chiffre', async ({ page }) => {
    await page.goto('/#/');
    await scrollToStep(page, 'sty-t-essayez');
    const sim = page.locator('.msim');
    await expect(sim).toBeVisible();
    const read = async () => ({ num: (await sim.locator('.msim__num').innerText()).trim(), unit: (await sim.locator('.msim__unit').innerText()).trim() });
    const a = await read();
    expect(a.unit).toMatch(/mois de réserve/);
    expect(a.num).toMatch(/\d/);
    // Curseur économies au maximum
    const sav = sim.getByLabel('Économies d’eau');
    await sav.focus(); await page.keyboard.press('End');
    await expect.poll(async () => (await read()).num, { message: 'économies 30 %' }).not.toBe(a.num);
    const b = await read();
    await sim.getByRole('button', { name: 'Réinitialiser' }).click();
    await expect.poll(async () => (await read()).num).toBe(a.num);
    // Dessalement
    const des = sim.getByLabel('Dessalement ajouté');
    await des.focus(); await page.keyboard.press('End');
    await expect.poll(async () => (await read()).num, { message: 'dessalement 100' }).not.toBe(a.num);
    await sim.getByRole('button', { name: 'Réinitialiser' }).click();
    // Région
    await sim.locator('.az-region__trigger').click();
    await page.locator('.az-region__pop .az-region__item', { hasText: 'Béni Mellal' }).first().click();
    await expect.poll(async () => (await read()).num + (await read()).unit, { message: 'changement de région' }).not.toBe(a.num + a.unit);
    // Région sans barrage : unité de flux
    await sim.locator('.az-region__trigger').click();
    await page.locator('.az-region__pop .az-region__item', { hasText: 'Dakhla' }).first().click();
    await expect.poll(async () => (await read()).unit).toMatch(/dessalée/);
    const txt = await sim.innerText();
    expect(txt).not.toMatch(BAD_TEXT);
    test.info().annotations.push({ type: 'info', description: 'souss ' + a.num + ' -> économies 30 % ' + b.num });
  });
});
