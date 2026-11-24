// Semantic bands for "mois de réserve" and the Sahara flow indicator.
// Thresholds come from src/lib/balance.js (assumption thresholds, documented there).
// Every band carries a glyph so it never relies on colour alone.
import { BAND_CRITICAL_MONTHS, BAND_COMFORT_MONTHS } from '../lib/balance.js';

export const BANDS = {
  critique: { label: 'Critique', glyph: '▲', hint: `moins de ${BAND_CRITICAL_MONTHS} mois de réserve` },
  tendu: { label: 'Tendu', glyph: '◆', hint: `de ${BAND_CRITICAL_MONTHS} à ${BAND_COMFORT_MONTHS} mois de réserve` },
  confortable: { label: 'Confortable', glyph: '■', hint: `plus de ${BAND_COMFORT_MONTHS} mois de réserve` },
  na: { label: 'Sans donnée', glyph: '—', hint: 'pas de barrage suivi dans le bulletin' },
};

// Sahara (no dam basin): desalination ÷ drinking demand, four steps, glyph ≈ marks "flux".
export const FLUX_STEPS = [
  { id: 0, label: 'moins de 25 %' },
  { id: 1, label: '25 à 50 %' },
  { id: 2, label: '50 à 100 %' },
  { id: 3, label: 'plus de 100 %' },
];
export const FLUX_GLYPH = '≈';
