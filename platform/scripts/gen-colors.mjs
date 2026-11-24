// Writes src/design/colors.js from src/design/tokens.css (colour literals only).
import { writeFileSync } from 'node:fs';
import { COLORS_JS, colorsSource } from './design-lib.mjs';
writeFileSync(COLORS_JS, colorsSource());
console.log('écrit', COLORS_JS);
