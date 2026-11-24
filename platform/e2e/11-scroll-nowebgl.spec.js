import { test } from '@playwright/test';
import { NO_GPU_ARGS } from './helpers.js';
import { checkScroll } from './scroll-helpers.js';

// Défilement de l'accueil SANS WebGL : mesure le coût du code de la page seul (la carte 3D logicielle produit ses
// propres long tasks, rapportées par 10-scroll-share-footer.spec.js). Lancer seul, sous le verrou.
test.use({ launchOptions: { args: NO_GPU_ARGS } });

test('sans WebGL : clavier jusqu’au pied de page, aucune long task > 50 ms', async ({ page }) => {
  await checkScroll(page, true);
});
