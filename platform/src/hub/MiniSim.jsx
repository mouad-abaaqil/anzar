// Mini-tableau de bord de la landing : une région, deux curseurs, un grand chiffre qui bouge en direct, et une jauge
// d'eau (réservoir) dont le niveau suit les curseurs (échelle linéaire : 0 à 36 mois, ou 0 à 100 % du potable dessalé).
// Calcul : stops.js miniSim() → panel/metrics.js regionModel() → src/lib/balance.js (lecture seule, rien n'est
// réimplémenté). Régions à barrages : « mois de réserve » ; régions sans barrage rattaché : part de l'eau potable
// couverte par le dessalement (jamais des mois). Scénario, pas une prédiction.
import { useMemo, useState } from 'react';
import { BANDS, Button, MicroLabel, ProvenanceChip, RegionSwitcher, Slider } from '../design';
import { BAND_COMFORT_MONTHS, BAND_CRITICAL_MONTHS, fmt, frDate, miniSim } from './stops.js';
import { plannedDesalNote } from './panel/extraLogic.js';
import { pctText, regionBalance } from './panel/metrics.js';
import { Surface } from './WaterFx.jsx';
import './MiniSim.css';

const SCALE_MONTHS = 36;
const FLUX_LABEL = { dominant: 'Dessalement dominant', mixte: 'Mixte', faible: 'Nappes dominantes' };

export default function MiniSim({ data, regionId, onRegion, onOpen }) {
  const [savings, setSavings] = useState(0);
  const [desal, setDesal] = useState(0);
  const regions = data?.regions?.regions || [];
  const res = useMemo(() => {
    try { return miniSim(data, regionId, { savingsPct: savings, desalMm3: desal }); } catch { return null; }
  }, [data, regionId, savings, desal]);
  const name = regions.find(r => r.id === regionId)?.name || '';
  const date = frDate(data?.bulletin?.date);
  const months = res?.kind === 'months';
  const value = res ? res.value : null;
  const shown = value == null ? '' : months ? fmt(value, value >= 10 ? 0 : 1) : (res.capped ? '100' : pctText(value));
  const delta = res?.delta;
  const touched = savings > 0 || desal > 0;
  const fill = res ? Math.min(1, months ? value / SCALE_MONTHS : value / 100) : 0;
  const plannedNote = !months && res ? plannedDesalNote(regionBalance(data, regionId)) : null;
  const band = months && res.band ? BANDS[res.band] : null;

  return (
    <div className="msim">
      <div className="msim__head">
        {regions.length > 0 && <RegionSwitcher regions={regions} value={regionId} onChange={id => onRegion?.(id)} label="Région" />}
      </div>

      <div className="msim__result" aria-live="polite" aria-atomic="true">
        {res ? (
          <>
            <div className="msim__row">
              <div className={'msim__tank' + (months ? '' : ' msim__tank--flux')} aria-hidden="true">
                <span className="msim__basin"><span className="msim__water" style={{ transform: 'translateY(' + ((1 - fill) * 100).toFixed(2) + '%)' }}><Surface /></span></span>
                {months && [BAND_CRITICAL_MONTHS, BAND_COMFORT_MONTHS].map(m => (
                  <span key={m} className="msim__mark" style={{ bottom: (m / SCALE_MONTHS) * 100 + '%' }}><i>{m}</i></span>
                ))}
              </div>
              <div className="msim__readout">
                <p className="msim__big">
                  <span className="msim__num">{shown}</span>
                  <span className="msim__unit">{months ? 'mois de réserve' : '% de l’eau potable dessalée'}</span>
                </p>
                <div className="msim__meta">
                  {band && <span className={'az-band az-band--' + res.band}><span aria-hidden="true">{band.glyph}</span> {band.label}</span>}
                  {!months && res.band && <span className="az-band az-band--na"><span aria-hidden="true">≈</span> {FLUX_LABEL[res.band] || ''}</span>}
                  {touched && Number.isFinite(delta) && Math.abs(delta) >= 0.05 && (
                    <span className="msim__delta">{(delta > 0 ? '+' : '−') + fmt(Math.abs(delta), months ? 1 : 0) + (months ? ' mois' : ' pt')} grâce à vos choix</span>
                  )}
                  <ProvenanceChip
                    status="hypothese"
                    source={'Calcul Anzar sur le bulletin du ' + date}
                    note="Scénario, pas une prédiction. Hypothèses visibles dans le tableau de bord ; eaux souterraines non modélisées."
                  />
                </div>
              </div>
            </div>
            {!months && (
              <p className="msim__note">Pas de barrage rattaché au bulletin : on mesure le dessalement, pas des mois.{res.capped ? ' Plafonné à 100 %.' : ''}{plannedNote ? ' ' + plannedNote : ''}</p>
            )}
          </>
        ) : (
          <p className="msim__note">Pas assez de données pour {name || 'cette région'}.</p>
        )}
      </div>

      <div className="msim__controls">
        <Slider label="Économies d’eau" value={savings} min={0} max={30} step={1} onChange={setSavings} format={v => v + ' %'} minLabel="0 %" maxLabel="30 %" />
        <Slider label="Dessalement ajouté" value={desal} min={0} max={100} step={5} onChange={setDesal} format={v => v + ' Mm³/an'} minLabel="0" maxLabel="100 Mm³/an" />
      </div>

      <div className="msim__foot">
        <Button variant="primary" size="lg" onClick={() => onOpen?.(regionId, { demandReductionPct: savings, addedDesalMm3: desal })}>Ouvrir le tableau de bord complet</Button>
        {touched && <Button variant="ghost" size="sm" onClick={() => { setSavings(0); setDesal(0); }}>Réinitialiser</Button>}
      </div>
      <MicroLabel tone="faint" as="p" className="msim__legal">Scénario calculé · pas une prédiction · pas un relevé en direct</MicroLabel>
    </div>
  );
}
