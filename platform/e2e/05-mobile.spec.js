import { test, expect } from '@playwright/test';
import { innerOverflow, overflowX, waitDashboard, waitMap, watchConsole } from './helpers.js';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });

const smallTargets = (page, selector) => page.evaluate(sel => [...document.querySelectorAll(sel)]
  .filter(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && cs.visibility !== 'hidden'; })
  .map(el => { const r = el.getBoundingClientRect(); return { label: (el.getAttribute('aria-label') || el.innerText || el.className).toString().trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; })
  .filter(t => t.w < 44 || t.h < 44), selector);

test.describe('mobile 390x844', () => {
  test('landing : pas de débordement, cibles tactiles', async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto('/#/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await waitMap(page, 3000);
    const ox = await overflowX(page);
    expect.soft(ox.scrollWidth, 'débordement ' + JSON.stringify(ox)).toBeLessThanOrEqual(ox.inner);
    expect.soft(await innerOverflow(page), 'débordement dans un conteneur à défilement (héros)').toEqual([]);
    const geo = await page.evaluate(() => { const b = document.querySelector('.hub-bar')?.getBoundingClientRect(); const t = document.querySelector('.hub-bar .az-region__trigger')?.getBoundingClientRect(); return { bar: b && [Math.round(b.top), Math.round(b.bottom)], trigger: t && [Math.round(t.top), Math.round(t.bottom)] }; });
    test.info().annotations.push({ type: 'info', description: 'barre / sélecteur (top,bottom) : ' + JSON.stringify(geo) });
    expect.soft(geo.trigger && geo.trigger[1] <= geo.bar[1] + 1 && geo.trigger[0] >= geo.bar[0] - 1, 'le sélecteur de région déborde de la barre ' + JSON.stringify(geo)).toBe(true);
    const small = await smallTargets(page, '.hub-bar a, .hub-bar button, .sty-hero button, .sty-hero a, .hub-brand');
    expect.soft(small, 'cibles < 44 px (barre et héros)').toEqual([]);
    expect.soft(errors).toEqual([]);
  });

  test('landing : MiniSim utilisable au toucher', async ({ page }) => {
    await page.goto('/#/');
    await page.evaluate(() => document.getElementById('sty-t-essayez')?.closest('section').scrollIntoView({ block: 'start' }));
    const sim = page.locator('.msim');
    await expect(sim).toBeVisible();
    const ox = await overflowX(page);
    expect.soft(ox.scrollWidth, 'débordement ' + JSON.stringify(ox)).toBeLessThanOrEqual(ox.inner);
    expect.soft(await innerOverflow(page), 'débordement dans un conteneur à défilement (MiniSim)').toEqual([]);
    for (const id of ['contexte', 'ecarts', 'demande', 'sud', 'climat', 'barrages', 'chiffres']) {
      await page.evaluate(i => document.getElementById('sty-t-' + i)?.closest('section').scrollIntoView({ block: 'start' }), id);
      expect.soft(await innerOverflow(page), 'débordement dans .sty-scroll à l’étape ' + id).toEqual([]);
    }
    const small = await smallTargets(page, '.msim button, .msim input[type=range]');
    expect.soft(small, 'cibles < 44 px (MiniSim)').toEqual([]);
    const before = await sim.locator('.msim__num').innerText();
    await sim.getByLabel('Économies d’eau').focus(); await page.keyboard.press('End');
    await expect.poll(() => sim.locator('.msim__num').innerText()).not.toBe(before);
  });

  test('tableau de bord : pas de débordement, panneau en bas, onglets, cibles', async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto('/#/r/souss-massa');
    await waitDashboard(page);
    await waitMap(page, 3000);
    const ox = await overflowX(page);
    expect.soft(ox.scrollWidth, 'débordement ' + JSON.stringify(ox)).toBeLessThanOrEqual(ox.inner);
    const box = await page.locator('.pn-shell').boundingBox();
    const sel = await page.evaluate(() => { const r = document.querySelector('.pn-shell')?.getBoundingClientRect(); return { panelTop: r && Math.round(r.top), vh: innerHeight }; });
    test.info().annotations.push({ type: 'info', description: 'panneau ' + JSON.stringify(box) + ' ; haut du panneau ' + sel.panelTop + ' px sur ' + sel.vh + ' (la carte visible = au-dessus)' });
    expect.soft(box.y, 'le panneau occupe le bas de l’écran').toBeGreaterThan(844 * 0.25);
    expect.soft(box.width).toBeLessThanOrEqual(390);
    const small = await smallTargets(page, '.hub-bar a, .hub-bar button, .pn-shell [role=tab], .pn-shell .az-region__trigger, .pn-shell .pn-intro button');
    expect.soft(small, 'cibles < 44 px (tableau de bord)').toEqual([]);
    for (const [name, hash] of [['Demain', /tomorrow$/], ['Ensemble', /together$/], ['Aujourd’hui', /souss-massa$/]]) {
      await page.getByRole('tab', { name }).tap();
      await expect(page).toHaveURL(hash);
      await expect(page.locator('.pn-shell .az-stat__num').first()).toContainText(/\d/);
    }
    await page.getByRole('tab', { name: 'Demain' }).tap();
    const num = page.locator('.pn-hero .az-stat__num').first();
    const a = await num.innerText();
    await page.getByLabel('Économies d’eau').focus(); await page.keyboard.press('End');
    await expect.poll(() => num.innerText()).not.toBe(a);
    for (const [name, hash] of [['Ensemble', /together$/], ['Aujourd’hui', /souss-massa$/]]) {
      await page.getByRole('tab', { name }).tap(); await expect(page).toHaveURL(hash);
      expect.soft(await innerOverflow(page), 'débordement interne, onglet ' + name).toEqual([]);
    }
    await page.getByRole('tab', { name: 'Demain' }).tap();
    expect.soft(await innerOverflow(page), 'débordement interne, onglet Demain').toEqual([]);
    await page.getByRole('link', { name: 'Sources', exact: true }).first().tap();
    await expect(page.locator('dialog.az-sheet[open]')).toBeVisible();
    expect.soft(await innerOverflow(page), 'débordement interne, tiroir Sources').toEqual([]);
    await page.keyboard.press('Escape');
    const ox2 = await overflowX(page);
    expect.soft(ox2.scrollWidth, 'débordement onglet Demain ' + JSON.stringify(ox2)).toBeLessThanOrEqual(ox2.inner);
    expect.soft(errors).toEqual([]);
  });
});
