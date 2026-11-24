import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { waitDashboard, waitMap } from './helpers.js';

mkdirSync('test-results', { recursive: true });
const all = {};
async function audit(page, name) {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.maplibregl-canvas').analyze();
  all[name] = res.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 3).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 3).join(' | ')) }));
  all[name + ' (incomplete)'] = res.incomplete.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 4).map(n => n.target.join(' ')) }));
  writeFileSync('test-results/axe-violations.json', JSON.stringify(all, null, 2));
  const hard = res.violations.filter(v => ['critical', 'serious'].includes(v.impact));
  test.info().annotations.push({ type: 'axe', description: name + ' (' + res.passes.length + ' règles passées, ' + res.incomplete.length + ' incomplètes) : ' + res.violations.map(v => v.id + '(' + v.impact + ',' + v.nodes.length + ')').join(', ') });
  expect(hard.map(v => v.id + ' [' + v.impact + '] ' + v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' ; ')), name + ' : violations critical/serious').toEqual([]);
}

test.describe('axe', () => {
  test('landing', async ({ page }) => { await page.goto('/#/'); await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); await page.waitForTimeout(2500); await audit(page, 'landing'); });
  for (const [tab, hash] of [['today', ''], ['tomorrow', '/tomorrow'], ['together', '/together']]) {
    test('tableau de bord ' + tab, async ({ page }) => { await page.goto('/#/r/souss-massa' + hash); await waitDashboard(page); await page.waitForTimeout(1500); await audit(page, 'dashboard-' + tab); });
  }
  test('tableau de bord Dakhla (flux)', async ({ page }) => { await page.goto('/#/r/dakhla-oued-ed-dahab'); await waitDashboard(page); await page.waitForTimeout(1500); await audit(page, 'dashboard-dakhla'); });
  test('tiroir Sources', async ({ page }) => { await page.goto('/#/sources'); await expect(page.locator('dialog.az-sheet[open]')).toBeVisible(); await page.waitForTimeout(1500); await audit(page, 'sources'); });
});

const focusInfo = page => page.evaluate(() => {
  const el = document.activeElement; if (!el || el === document.body) return null;
  const cs = getComputedStyle(el);
  const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
  const shadow = cs.boxShadow && cs.boxShadow !== 'none';
  const parentCs = el.parentElement ? getComputedStyle(el.parentElement) : null;
  return { tag: el.tagName, role: el.getAttribute('role'), text: (el.getAttribute('aria-label') || el.innerText || el.className || '').toString().trim().slice(0, 40), cls: String(el.className).slice(0, 40), visible: outline || !!shadow, outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor, shadow: cs.boxShadow.slice(0, 60) };
});

async function tabThrough(page, max) {
  const seen = [];
  for (let i = 0; i < max; i++) { await page.keyboard.press('Tab'); const f = await focusInfo(page); if (f) seen.push(f); }
  return seen;
}

test.describe('clavier', () => {
  test('landing : Tab atteint les liens de la barre, le sélecteur de région ; focus visible', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await waitMap(page, 3000);
    const seen = await tabThrough(page, 18);
    const texts = seen.map(s => s.text);
    test.info().annotations.push({ type: 'info', description: 'ordre : ' + texts.join(' > ') });
    for (const want of [/Récit/i, /Tableau/i, /Sources/i, /Région|Souss/i]) expect.soft(texts.some(t => want.test(t)), 'atteint ' + want).toBe(true);
    const invisible = seen.filter(s => !s.visible).map(s => s.text + ' (' + s.cls + ')');
    expect.soft(invisible, 'éléments focalisés sans indicateur visible (outline/box-shadow)').toEqual([]);
  });

  test('tableau de bord : Tab atteint sélecteur de région et onglets (nombre de Tab) ; flèches changent d’onglet', async ({ page }) => {
    await page.goto('/#/r/souss-massa');
    await waitDashboard(page);
    await waitMap(page, 3000); // les marqueurs de barrages de la carte sont focalisables : à attendre pour mesurer le vrai parcours
    const seen = [];
    let toSwitcher = null, toTab = null;
    for (let i = 1; i <= 220 && (toSwitcher === null || toTab === null); i++) {
      await page.keyboard.press('Tab');
      const f = await focusInfo(page);
      if (f) seen.push(f);
      if (f && toSwitcher === null && /az-region__trigger/.test(f.cls) && await page.evaluate(() => !!document.activeElement.closest('.pn-shell'))) toSwitcher = i;
      if (f && toTab === null && f.role === 'tab') toTab = i;
    }
    const mapStops = seen.filter(s => /^Barrage|^Map|^Toggle|©|OpenFreeMap|OpenStreetMap|Zoom|Compass|Boussole|Zoom/i.test(s.text)).length;
    test.info().annotations.push({ type: 'info', description: 'Tab pour atteindre le sélecteur du panneau : ' + toSwitcher + ' ; un onglet : ' + toTab + ' ; arrêts sur la carte avant : ' + mapStops });
    expect.soft(toSwitcher, 'sélecteur de région du panneau atteint').not.toBeNull();
    expect.soft(toTab, 'onglets atteints').not.toBeNull();
    expect.soft(toSwitcher ?? 999, 'nombre de Tab pour atteindre le panneau (barrages de la carte focalisables, pas de lien d’évitement vers le panneau)').toBeLessThanOrEqual(25);
    const invisible = seen.filter(s => !s.visible).map(s => s.text + ' (' + s.cls + ')');
    expect.soft(invisible, 'sans indicateur de focus visible').toEqual([]);
    await page.getByRole('tab', { name: 'Aujourd’hui' }).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/tomorrow$/);
  });

  test('prefers-reduced-motion : récit sans animation, chiffres finaux', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => ({
      still: !!document.querySelector('.sty--still'),
      running: document.getAnimations().filter(a => a.playState === 'running').map(a => (a.animationName || a.transitionProperty || a.constructor.name) + ':' + (a.effect?.target?.className?.toString().slice(0, 30) || '')).slice(0, 12),
      count: document.getAnimations().filter(a => a.playState === 'running').length,
    }));
    test.info().annotations.push({ type: 'info', description: JSON.stringify(info) });
    expect.soft(info.still, 'classe sty--still (reduced) appliquée').toBe(true);
    expect.soft(info.count, 'animations en cours : ' + info.running.join(', ')).toBe(0);
    // La caméra MapLibre (orbite, flyTo) n'est pas une animation CSS : deux captures du canvas à 2 s d'écart.
    await page.evaluate(() => document.querySelector('.sty-scroll')?.scrollTo(0, 0));
    await waitMap(page, 8000);
    const clip = { x: 700, y: 120, width: 700, height: 600 };
    const s1 = await page.screenshot({ clip });
    await page.waitForTimeout(2000);
    const s2 = await page.screenshot({ clip });
    const same = Buffer.compare(s1, s2) === 0;
    test.info().annotations.push({ type: 'info', description: 'carte identique à 2 s d’écart (reduced motion) : ' + same });
    expect.soft(same, 'la carte bouge encore sous prefers-reduced-motion (ou des tuiles arrivent tard)').toBe(true);
    // les compteurs affichent directement leur valeur finale
    await page.evaluate(() => document.getElementById('sty-t-chiffres')?.closest('section').scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(300);
    const nums = await page.locator('.sty-num').allInnerTexts();
    expect.soft(nums.length).toBeGreaterThan(0);
    expect.soft(nums.filter(n => /^\s*0([,.]0+)?\s*$/.test(n)), 'compteurs restés à 0').toEqual([]);
  });
});
