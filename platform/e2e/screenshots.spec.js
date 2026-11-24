// Captures du README -> ../docs/screenshots/. Hors suite par défaut : npm run e2e:shots (via with-capture-lock.sh).
import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scrollToStep, settleAnimations, waitDashboard, waitMap } from './helpers.js';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../docs/screenshots');
mkdirSync(OUT, { recursive: true });
test.describe.configure({ mode: 'serial', timeout: 300_000 });

const skipIntro = ctx => ctx.addInitScript(() => { try { localStorage.setItem('anzar-panel-intro', '1'); } catch { /* ignore */ } });
async function shot(page, name, wait = 5000) {
  await settleAnimations(page);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: join(OUT, name + '.png') });
}
async function step(page, id, name, wait = 6000) {
  await scrollToStep(page, 'sty-t-' + id);
  await shot(page, name, wait);
}

test('desktop 1440x900', async ({ page }) => {
  await skipIntro(page.context());
  await page.goto('/#/');
  await page.getByRole('heading', { level: 1 }).waitFor();
  await waitMap(page, 9000);
  await shot(page, '01-landing-hero', 3000);
  await step(page, 'contexte', '02-contexte');
  await step(page, 'ecarts', '03-problematique');
  await step(page, 'barrages', '04-barrages-3d', 9000);
  await step(page, 'chiffres', '05-chiffres', 5000);
  await step(page, 'essayez', '06-essayez', 5000);

  const dash = async (hash, name, wait = 8000) => {
    await page.evaluate(h => { location.hash = h; }, hash);
    await waitDashboard(page);
    await shot(page, name, wait);
  };
  await dash('#/r/souss-massa', '07-dashboard-aujourdhui', 10000);
  await dash('#/r/souss-massa/tomorrow', '08-dashboard-demain', 5000);
  await dash('#/r/souss-massa/together', '09-dashboard-ensemble', 5000);
  await dash('#/r/guelmim-oued-noun/together', '10-sud-guelmim-ensemble', 9000);
  await dash('#/r/dakhla-oued-ed-dahab', '11-sahara-dakhla', 9000);
  await page.evaluate(() => { location.hash = '#/sources'; });
  await page.locator('dialog.az-sheet[open]').waitFor();
  await page.getByText('Données ouvertes utilisées').waitFor({ timeout: 20_000 }).catch(() => {});
  await shot(page, '12-sources', 2500);
});

test('mobile 390x844', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, locale: 'fr-FR' });
  await skipIntro(ctx);
  const page = await ctx.newPage();
  await page.goto('/#/');
  await page.getByRole('heading', { level: 1 }).waitFor();
  await waitMap(page, 9000);
  await shot(page, '13-mobile-landing', 3000);
  await page.evaluate(() => { location.hash = '#/r/souss-massa'; });
  await waitDashboard(page);
  await shot(page, '14-mobile-dashboard', 9000);
  await ctx.close();
});
