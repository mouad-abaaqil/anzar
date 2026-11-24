// Tests E2E d'Anzar (Playwright). Cible : build de production servi par vite preview (E2E_BASE_URL, défaut 5198).
// Machine sensible : un seul worker, un seul navigateur, Chrome système en rendu WebGL logiciel (SwiftShader).
// Lancer toujours via : sh scripts/with-capture-lock.sh npx playwright test e2e/<fichier>
import { defineConfig } from '@playwright/test';

export const WEBGL_ARGS = ['--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  testIgnore: process.env.SHOTS ? [] : ['**/screenshots.spec.js'],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5198',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
    launchOptions: { args: WEBGL_ARGS },
    trace: 'off',
  },
});
