// 12 régions x 3 onglets par navigation de hash dans la MÊME page : la carte persiste.
import { test, expect } from '@playwright/test';
import { BAD_TEXT, NO_STOCK, REGIONS, waitMap, watchConsole } from './helpers.js';

const TABS = ['today', 'tomorrow', 'together'];

test('12 régions x 3 onglets, carte persistante', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = watchConsole(page);
  await page.goto('/#/r/' + REGIONS[0].id);
  await waitMap(page, 3000);
  await page.evaluate(() => { document.querySelector('.maplibregl-canvas').dataset.e2eMarker = 'same'; });
  const problems = [];
  for (const r of REGIONS) {
    for (const tab of TABS) {
      const hash = '#/r/' + r.id + (tab === 'today' ? '' : '/' + tab);
      await page.evaluate(h => { location.hash = h; }, hash);
      const label = r.id + '/' + tab;
      try {
        await expect(page.locator('.pn-shell'), label + ' panneau').toBeVisible({ timeout: 20_000 });
        await expect(page.locator('.pn-shell [role="tab"][aria-selected="true"]'), label + ' onglet actif').toBeVisible();
        // attendre la fin du chargement paresseux de l'onglet
        await expect(page.locator('.pn-shell .az-tabs__panel .pn-note[role="status"]:has-text("Chargement")')).toHaveCount(0, { timeout: 15_000 });
        await page.waitForTimeout(350);
        const info = await page.evaluate(() => {
          const shell = document.querySelector('.pn-shell');
          const num = shell.querySelector('.az-stat__num');
          return { text: shell.innerText, body: document.body.innerText, num: num?.innerText?.trim() ?? null, flux: !!shell.querySelector('.pn-flux-tag'), active: document.querySelector('.pn-shell [role=tab][aria-selected=true]')?.innerText, canvas: document.querySelector('.maplibregl-canvas')?.dataset.e2eMarker };
        });
        if (info.canvas !== 'same') problems.push(label + ' : la carte a été recréée');
        const badBody = info.body.match(BAD_TEXT);
        if (badBody) problems.push(label + ' : (page entière) texte « ' + badBody[0] + ' » → ' + info.body.slice(Math.max(0, badBody.index - 40), badBody.index + 40).replace(/\n/g, ' '));
        const bad = info.text.match(BAD_TEXT);
        if (bad) problems.push(label + ' : texte « ' + bad[0] + ' » → ' + info.text.slice(Math.max(0, bad.index - 40), bad.index + 40).replace(/\n/g, ' '));
        if (!info.num || !/\d/.test(info.num)) problems.push(label + ' : pas de grand chiffre (« ' + info.num + ' »)');
        if (tab !== 'together' && NO_STOCK.includes(r.id) && !/%/.test(info.text)) problems.push(label + ' : pas de pourcentage de flux');
        if (tab !== 'together' && NO_STOCK.includes(r.id) && /\\d\\s*mois de réserve/.test(info.text)) problems.push(label + ' : « mois de réserve » affiché pour une région sans stock');
        if (!info.text || info.text.length < 200) problems.push(label + ' : panneau quasi vide (' + info.text.length + ' car.)');
      } catch (e) { problems.push(label + ' : ' + String(e.message).split('\n')[0]); }
    }
  }
  expect.soft(problems, 'problèmes').toEqual([]);
  expect.soft(errors, 'erreurs console').toEqual([]);
});
