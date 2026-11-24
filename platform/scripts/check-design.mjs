#!/usr/bin/env node
// Design gate (docs/DESIGN_ANZAR.md, section "Contrôle").
// Fails when a colour literal (#hex, rgb(), rgba(), hsl(), hsla()) or a literal font-family
// appears in src/**/*.{css,jsx} outside the exceptions below; also checks that
// src/design/colors.js matches the tokens and that every documented contrast pair passes AA.
//
//   npm run check:design                      whole src/
//   npm run check:design -- src/pages/Foo.jsx  only these files or folders
//   npm run check:design -- --contrast        also print the contrast table
//
// Heuristic, not a parser: comments are stripped first; in CSS only declaration values are read
// (so an ID selector like #add is not a colour); in JSX the whole text is read with a hex
// boundary rule. font-family / fontFamily must be var(--az-font-*), inherit or initial.
// Known gap: .js files are not scanned (src/lib holds no colours today).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT, COLORS_JS, colorsSource, contrastReport } from './design-lib.mjs';

// Documented exceptions: path relative to platform/ -> reason. Keep this list short.
export const EXCEPTIONS = {
  'src/design/tokens.css': 'source unique des couleurs et des polices',
  // Annexes Qualité et Cycle : ancien shell, conservé tel quel, chargé seulement par src/hub/Annex.jsx (hors parcours principal).
  'src/tokens.css': 'annexes : ancien jeu de variables (--brand...), chargé seulement par Annex.jsx',
  'src/styles.css': 'annexes : ancienne feuille de style du shell, chargée seulement par Annex.jsx',
  'src/components/QualityPanel.css': 'annexes : page Qualité de l\'eau (ancien thème)',
  'src/components/QualityPanel.jsx': 'annexes : page Qualité de l\'eau (couleurs de graphiques)',
  // Inline brand SVGs (logos with fixed colours) go here, one line each, with their reason.
};

const args = process.argv.slice(2);
const showContrast = args.includes('--contrast');
const targets = args.filter(a => !a.startsWith('--'));
const SRC = path.join(ROOT, 'src');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(css|jsx)$/.test(name)) out.push(p);
  }
  return out;
}

const files = (targets.length ? targets.map(t => path.resolve(process.cwd(), t)) : [SRC])
  .flatMap(p => {
    if (!existsSync(p)) { console.error('introuvable :', p); process.exitCode = 2; return []; }
    return statSync(p).isDirectory() ? walk(p) : [p];
  })
  .filter(p => /\.(css|jsx)$/.test(p));

const HEX = /(^|[^\w&$])#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![\w-])/gi;
const FUNC = /\b(rgba?|hsla?)\s*\(/gi;
const FONT_OK = /^\s*(var\(--az-font-[\w-]+\)|inherit|initial|unset)\s*$/i;
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

function cssDeclarations(text) {
  // Segments ending with ';' or '}' are declarations; segments ending with '{' are selectors / at-rule preludes.
  const out = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{' || ch === ';' || ch === '}') {
      if (ch !== '{') {
        const seg = text.slice(start, i);
        const colon = seg.indexOf(':');
        if (colon > 0 && !seg.trim().startsWith('@')) out.push({ prop: seg.slice(0, colon).trim().toLowerCase(), value: seg.slice(colon + 1), index: start + colon + 1 });
      }
      start = i + 1;
    }
  }
  return out;
}

const blank = s => s.replace(/[^\n]/g, ' '); // keep line numbers
function scanCss(raw) {
  const text = raw.replace(/\/\*[\s\S]*?\*\//g, blank);
  const hits = [];
  for (const d of cssDeclarations(text)) {
    for (const m of d.value.matchAll(HEX)) hits.push({ kind: 'hex', line: lineOf(text, d.index + m.index), what: '#' + m[2] });
    for (const m of d.value.matchAll(FUNC)) hits.push({ kind: m[1].toLowerCase().replace('a', '') + '()', line: lineOf(text, d.index + m.index), what: m[0] });
    if (d.prop === 'font-family' && !FONT_OK.test(d.value)) hits.push({ kind: 'font-family', line: lineOf(text, d.index), what: d.value.trim().slice(0, 40) });
    if (d.prop === 'font' && /['"]|\b(serif|sans-serif|monospace|system-ui)\b/.test(d.value)) hits.push({ kind: 'font-family', line: lineOf(text, d.index), what: 'font: ' + d.value.trim().slice(0, 40) });
  }
  for (const m of text.matchAll(/@import\s+url\([^)]*fonts\.googleapis[^)]*\)/g)) hits.push({ kind: 'font-family', line: lineOf(text, m.index), what: 'police distante' });
  return hits;
}

function scanJsx(raw) {
  const text = raw
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, blank)
    .replace(/(^|[\s;{}(),])\/\/[^\n]*/g, (m, p) => p + blank(m.slice(p.length)));
  const hits = [];
  for (const m of text.matchAll(HEX)) hits.push({ kind: 'hex', line: lineOf(text, m.index), what: '#' + m[2] });
  for (const m of text.matchAll(FUNC)) hits.push({ kind: m[1].toLowerCase().replace('a', '') + '()', line: lineOf(text, m.index), what: m[0] });
  for (const m of text.matchAll(/fontFamily\s*:\s*(['"`])([^'"`]*)\1/g)) if (!FONT_OK.test(m[2])) hits.push({ kind: 'font-family', line: lineOf(text, m.index), what: m[2].slice(0, 40) });
  for (const m of text.matchAll(/font-family\s*:\s*([^;'"`}]+)/g)) if (!FONT_OK.test(m[1])) hits.push({ kind: 'font-family', line: lineOf(text, m.index), what: m[1].trim().slice(0, 40) });
  return hits;
}

const report = [];
for (const f of files.sort()) {
  const rel = path.relative(ROOT, f);
  if (EXCEPTIONS[rel]) continue;
  const raw = readFileSync(f, 'utf8');
  const hits = f.endsWith('.css') ? scanCss(raw) : scanJsx(raw);
  if (hits.length) report.push({ rel, hits });
}

let failed = false;
if (report.length) {
  failed = true;
  const total = report.reduce((n, r) => n + r.hits.length, 0);
  console.log(`Couleurs ou polices en dur : ${total} dans ${report.length} fichier(s)\n`);
  const kinds = ['hex', 'rgb()', 'hsl()', 'font-family'];
  console.log(['total', ...kinds].map(k => k.padStart(12)).join('') + '  fichier');
  for (const r of report.sort((a, b) => b.hits.length - a.hits.length)) {
    const c = k => r.hits.filter(h => h.kind === k).length;
    console.log([r.hits.length, ...kinds.map(c)].map(n => String(n).padStart(12)).join('') + '  ' + r.rel);
  }
  if (targets.length) {
    console.log('');
    for (const r of report) for (const h of r.hits) console.log(`${r.rel}:${h.line}  ${h.kind}  ${h.what}`);
  }
  console.log('\nRemplacer par var(--az-*) (CSS) ou colors.* depuis src/design/colors.js (MapLibre, canvas).');
} else {
  console.log(`Aucune couleur ni police en dur (${files.length} fichier(s) lus).`);
}

// colors.js must be regenerated whenever tokens.css changes.
if (!existsSync(COLORS_JS) || readFileSync(COLORS_JS, 'utf8') !== colorsSource()) {
  failed = true;
  console.log('\nsrc/design/colors.js est périmé : npm run gen:colors');
}

const contrasts = contrastReport();
const bad = contrasts.filter(c => !c.ok);
if (bad.length) failed = true;
if (showContrast || bad.length) {
  console.log('\nContrastes WCAG (premier plan / fond : rapport, minimum)');
  for (const c of showContrast ? contrasts : bad) console.log(`  ${c.ok ? 'ok ' : 'NON'} --az-${c.fg} / --az-${c.bg} : ${c.ratio.toFixed(2)} (min ${c.min}, ${c.role})`);
} else {
  console.log(`Contrastes : ${contrasts.length} paires conformes AA.`);
}

if (failed) process.exitCode = 1;
