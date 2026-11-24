// « Les barrages du bassin » : liste compacte triée, barre de remplissage. Données du bulletin du 23 nov. 2026.
import { useEffect, useMemo, useState } from 'react';
import { Panel } from '../../design';
import { DAMS_LABEL, NAME_NOTE, NO_BASIN_MESSAGE, basinDamsFor } from './damsLogic.js';
import { StockBar } from './charts.jsx';
import { fmt } from './metrics.js';

let cache = null;
function useDamFill() {
  const [s, setS] = useState(cache ? { status: 'ready', fill: cache } : { status: 'loading' });
  useEffect(() => {
    if (cache) return undefined;
    let alive = true;
    fetch('/data/dam-fill.json')
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(j => { if (!Array.isArray(j?.dams)) throw new Error(); cache = j; alive && setS({ status: 'ready', fill: j }); })
      .catch(() => alive && setS({ status: 'error' }));
    return () => { alive = false; };
  }, []);
  return s;
}

export default function BasinDams({ data, regionId, stock }) {
  const f = useDamFill();
  const rb = useMemo(() => (data?.balance?.regions ?? []).find(r => r.id === regionId), [data, regionId]);
  const view = useMemo(() => (f.status === 'ready' ? basinDamsFor(f.fill, rb) : null), [f, rb]);
  return (
    <Panel label={DAMS_LABEL[0].toUpperCase() + DAMS_LABEL.slice(1)} title="Les barrages du bassin">
      {stock && <StockBar stored={stock.storedMm3} capacity={stock.capacityMm3} fillPct={stock.fillPct} />}
      {f.status === 'loading' && <p className="pn-note" role="status">Chargement des barrages…</p>}
      {f.status === 'error' && <p className="pn-note" role="alert">Liste des barrages indisponible. Rien n’est affiché à sa place.</p>}
      {view?.kind === 'none' && <p className="pn-note">{NO_BASIN_MESSAGE}</p>}
      {view?.kind === 'ready' && (
        <>
          {view.basins.map(b => (
            <div key={b.name} className="pn-dams">
              <p className="pn-dams__head">Bassin {b.name}{view.basins.length > 1 && b.fillPct != null ? ' · ' + fmt(b.fillPct, 0) + ' % rempli' : ''}</p>
              <ul className="pn-dams__list" aria-label={'Barrages du bassin ' + b.name}>
                {b.dams.map(d => (
                  <li key={d.key}>
                    <span className="pn-dams__n"><span lang={d.nameAr ? undefined : 'ar'} dir={d.nameAr ? undefined : 'rtl'}>{d.name}{d.unverified ? ' *' : ''}</span>{d.nameAr && <span className="pn-dams__ar" lang="ar" dir="rtl">{d.nameAr}</span>}</span>
                    <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="pn-bar pn-bar--thin" role="img" aria-label={d.name + ' : ' + fmt(d.fillPct, 0) + ' % rempli'}>
                      <rect width="100" height="8" className="pn-bar__bg" />
                      <rect width={Math.max(0.8, d.fillPct)} height="8" className="pn-bar__fill" />
                    </svg>
                    <span className="pn-dams__v">{d.approx ? '~' : ''}{fmt(d.fillPct, 0)} %</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="pn-note pn-faint">{view.unverified ? '* ' + NAME_NOTE : 'Lu visuellement sur le bulletin du ministère ; capacité par barrage non imprimée.'}</p>
        </>
      )}
    </Panel>
  );
}
