import { test, expect } from '@playwright/test';
import { REGIONS, waitDashboard, waitMap, watchConsole } from './helpers.js';

test.describe('interactions du tableau de bord', () => {
  test.beforeEach(async ({ context }) => { await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {}); });

  test('Demain : curseurs changent le chiffre, Réinitialiser le remet', async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto('/#/r/souss-massa/tomorrow');
    await waitDashboard(page);
    const num = page.locator('.pn-hero .az-stat__num').first();
    await expect(num).toContainText(/\d/);
    const a = (await num.innerText()).trim();
    const sav = page.getByLabel('Économies d’eau');
    await sav.focus(); await page.keyboard.press('End');
    await expect.poll(async () => (await num.innerText()).trim(), { message: 'économies 40 %' }).not.toBe(a);
    const b = (await num.innerText()).trim();
    const des = page.getByLabel('Dessalement ajouté');
    await des.focus(); await page.keyboard.press('End');
    await expect.poll(async () => (await num.innerText()).trim(), { message: 'dessalement 300' }).not.toBe(b);
    await page.getByRole('button', { name: 'Réinitialiser' }).click();
    await expect.poll(async () => (await num.innerText()).trim(), { message: 'réinitialisation' }).toBe(a);
    await expect(sav).toHaveValue('0');
    expect(errors).toEqual([]);
  });

  test('changement de région par le sélecteur du panneau', async ({ page }) => {
    await page.goto('/#/r/souss-massa');
    await waitDashboard(page);
    await page.locator('.pn-shell .az-region__trigger').click();
    await page.locator('.pn-shell .az-region__item', { hasText: 'Oriental' }).click();
    await expect(page).toHaveURL(/#\/r\/oriental$/);
    await expect(page.locator('.pn-shell .az-region__name')).toContainText('Oriental');
    await expect(page.locator('.hub-bar__active')).toContainText('Oriental');
    // l'onglet est conservé au changement de région
    await page.getByRole('tab', { name: 'Demain' }).click();
    await expect(page).toHaveURL(/#\/r\/oriental\/tomorrow$/);
    await page.locator('.pn-shell .az-region__trigger').click();
    await page.locator('.pn-shell .az-region__item', { hasText: 'Fès' }).click();
    await expect(page).toHaveURL(/#\/r\/fes-meknes\/tomorrow$/);
  });

  test('clic sur la carte change de région (grille de clics sur le canvas)', async ({ page }) => {
    // En production window.__hubMapApi / __hubMap n'existent pas (réservés hors production) : pas de map.project.
    // On clique une grille de points sur le canvas visible et on observe le changement d'adresse.
    await page.goto('/#/r/souss-massa');
    await waitDashboard(page);
    await waitMap(page, 5000);
    const hasApi = await page.evaluate(() => !!window.__hubMapApi || !!window.__hubMap);
    const box = await page.locator('.maplibregl-canvas').first().boundingBox();
    const before = await page.evaluate(() => location.hash);
    let landed = null;
    outer: for (const fy of [0.35, 0.5, 0.65, 0.8, 0.2]) {
      for (const fx of [0.2, 0.35, 0.5, 0.1, 0.6]) {
        const x = box.x + box.width * fx, y = box.y + box.height * fy;
        const target = await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.className?.toString() || '', [x, y]);
        if (!/maplibregl-canvas/.test(target)) continue;
        await page.mouse.click(x, y);
        await page.waitForTimeout(700);
        const h = await page.evaluate(() => location.hash);
        if (h !== before) { landed = h; break outer; }
      }
    }
    test.info().annotations.push({ type: 'info', description: 'hubMapApi présent: ' + hasApi + ' ; hash après clic: ' + landed });
    expect(landed, 'aucun clic de la grille n’a changé de région (hash resté ' + before + ')').not.toBeNull();
    expect(REGIONS.some(r => landed.startsWith('#/r/' + r.id))).toBe(true);
  });

  test('Partager copie un lien avec région et onglet', async ({ page }) => {
    await page.goto('/#/r/oriental/together');
    await waitDashboard(page);
    await page.getByRole('button', { name: /Partager/ }).click();
    await expect(page.locator('.hub-live')).toContainText(/Lien copié|Copie impossible/);
    const live = await page.locator('.hub-live').innerText();
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(e => 'ERR ' + e.message);
    test.info().annotations.push({ type: 'info', description: live + ' | presse-papiers: ' + clip });
    expect(live).toMatch(/Lien copié/);
    expect(clip).toMatch(/#\/r\/oriental\/together$/);
  });

  test('tiroir Sources : ouverture, contenu, Échap', async ({ page }) => {
    await page.goto('/#/r/souss-massa');
    await waitDashboard(page);
    await page.getByRole('link', { name: 'Sources', exact: true }).first().click();
    const dlg = page.locator('dialog.az-sheet[open]');
    await expect(dlg).toBeVisible();
    await expect(page).toHaveURL(/#\/sources$/);
    await expect(dlg.getByText('Données ouvertes utilisées')).toBeVisible({ timeout: 20_000 });
    await expect(dlg.getByText(/Prototype indépendant/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect(page).toHaveURL(/#\/r\/souss-massa$/);
    // chargement direct de #/sources (nouvelle page), fermeture par le bouton : retour au récit
    const p2 = await page.context().newPage();
    await p2.goto('/#/sources');
    await expect(p2.locator('dialog.az-sheet[open]')).toBeVisible();
    await p2.locator('.az-sheet__close').click();
    await expect(p2.locator('dialog.az-sheet[open]')).toHaveCount(0);
    await expect(p2).toHaveURL(/#\/$/);
    await p2.close();
  });
});
