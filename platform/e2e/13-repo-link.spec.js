import { test, expect } from '@playwright/test';

// Le lien discret vers le code source (dépôt public) est présent dans les deux pieds de page.
const REPO = 'https://github.com/mouad-abaaqil/anzar';

async function check(link) {
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
  await expect(link).toHaveAttribute('rel', /noreferrer/);
}

test('pied de page de l’accueil : lien vers le dépôt GitHub', async ({ page }) => {
  await page.goto('/#/', { waitUntil: 'domcontentloaded' });
  await check(page.locator('footer.sty-foot .sty-foot__nav a[href="' + REPO + '"]'));
});

test('tableau de bord : barre basse avec lien vers le dépôt GitHub', async ({ page }) => {
  await page.goto('/#/r/souss-massa', { waitUntil: 'domcontentloaded' });
  await check(page.locator('.hub-foot a[href="' + REPO + '"]'));
});
