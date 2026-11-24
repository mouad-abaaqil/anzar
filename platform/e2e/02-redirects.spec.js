// Redirections des anciennes adresses. Rendu sans WebGL : le routage n'en dépend pas (économise le CPU).
import { test, expect } from '@playwright/test';
import { NO_GPU_ARGS } from './helpers.js';

test.use({ launchOptions: { args: NO_GPU_ARGS } });

const CASES = [
  ['#/app/overview', '#/r/souss-massa'],
  ['#/app/overview/oriental', '#/r/oriental'],
  ['#/app/map', '#/r/souss-massa'],
  ['#/app/balance', '#/r/souss-massa/tomorrow'],
  ['#/app/regions', '#/r/souss-massa/together'],
  ['#/app/forecast', '#/r/souss-massa/tomorrow'],
  ['#/app/sources', '#/sources'],
];
for (const [from, to] of CASES) {
  test('redirection ' + from + ' -> ' + to, async ({ page }) => {
    await page.goto('/' + from);
    await expect.poll(() => page.evaluate(() => location.hash), { timeout: 30_000 }).toBe(to);
    if (to.startsWith('#/r/')) await expect(page.locator('.pn-shell')).toBeVisible({ timeout: 30_000 });
    else await expect(page.locator('dialog.az-sheet[open]')).toBeVisible({ timeout: 30_000 });
  });
}
for (const page_ of ['quality', 'cycle']) {
  test('annexe ' + page_ + ' : avis version serveur', async ({ page }) => {
    await page.goto('/#/app/' + page_);
    await expect(page.getByText('Disponible uniquement dans la version serveur')).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => location.hash)).toBe('#/app/' + page_);
    await expect(page.getByRole('link', { name: 'Retour au tableau de bord' })).toBeVisible();
  });
}
