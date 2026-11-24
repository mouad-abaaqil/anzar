// Récit d'entrée d'Anzar (landing) : CONTEXTE → PROBLÉMATIQUE → BARRAGES → CHIFFRES → ESSAYEZ, posé sur la carte
// persistante (HubMap) qu'il pilote. Contrat : docs/HUB_CONTRACT.md. Props :
// - data : useHubData() (chargé ici si absent) ; regionId : région de départ ;
// - onEnter(regionId) : ouvre le tableau de bord ; flyToStop(stop) : caméra (absent ou sans WebGL : le récit reste complet).
//   Les effets de carte voyagent dans le stop (revealDams, flyAlongAtlas, orbit : voir stops.js), lus par HubMap.
// Tous les chiffres viennent de stops.js (lus dans public/data/*.json). Mouvement : IntersectionObserver (--p par
// étape) et défilement (barre de progression) ; motifs d'eau en rafale courte (WaterFx) ; rien sous reduced-motion.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, MicroLabel, ProvenanceChip } from '../design';
import MiniSim from './MiniSim.jsx';
import WaterFx, { LevelGauge, Wave, useReducedMotion } from './WaterFx.jsx';
import {
  CHAPTERS, STORY_STOPS, basinSpread, climateFacts, damCounts, demandFacts, fmt, frDate, keyFigures,
  nationalFacts, regionStop, southDesal, southLinks,
} from './stops.js';
import './Story.css';

const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);
const LEGAL = 'Prototype indépendant issu d’un stage à la RAMSA. Pas un portail officiel.';
const pct = (v, d = 1) => fmt(v, d) + ' %';

// Décale le centre demandé pour que la cible tombe dans la zone libre de la carte : à droite du texte sur grand
// écran, au-dessus sur mobile. Approximation Web Mercator (tuiles de 512 px). Pour le héros, HubMap ajoute déjà
// son propre cadrage (marge à gauche et en haut) : décalage plus court à droite, plus long vers le haut sur mobile.
function framed(stop) {
  if (typeof window === 'undefined' || !stop?.center) return stop?.center;
  const w = window.innerWidth, h = window.innerHeight;
  const hero = stop.id === 'hero';
  const [lon, lat] = stop.center;
  // Héros : HubMap vole à zoom + 0,55 avec une marge haute de 18 % et gauche de 14 % (≥ 600 px).
  const degPerPx = 360 / (512 * Math.pow(2, stop.zoom + (hero ? 0.55 : 0)));
  if (w > 760) return [lon - (hero ? 0.15 : 0.22) * w * degPerPx, lat];
  // Vertical : avec l'inclinaison, un pixel d'écran couvre 1 / cos(pitch) fois plus de sol près du centre.
  const tilt = 1 / Math.max(0.35, Math.cos(((stop.pitch || 0) * Math.PI) / 180));
  return [lon, lat - (hero ? 0.42 : 0.24) * tilt * h * degPerPx * Math.cos((lat * Math.PI) / 180)];
}
const MOBILE_HERO_ZOOM_OUT = 0.9;
const forViewport = stop => (stop?.id === 'hero' && typeof window !== 'undefined' && window.innerWidth <= 760 ? { ...stop, zoom: stop.zoom - MOBILE_HERO_ZOOM_OUT } : stop);

function useStoryData(data) {
  const [own, setOwn] = useState(null);
  useEffect(() => {
    if (data) return undefined;
    let alive = true;
    import('./data.js').then(m => m.loadHubData())
      .then(d => alive && setOwn({ status: 'ready', ...d }))
      .catch(() => alive && setOwn({ status: 'error' }));
    return () => { alive = false; };
  }, [data]);
  return data || own || { status: 'loading' };
}

// dam-fill.json n'est pas chargé par useHubData : lu ici, null s'il manque.
function useDamFill() {
  const [v, setV] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch('/data/dam-fill.json').then(r => (r.ok ? r.json() : null)).then(j => alive && setV(j)).catch(() => {});
    return () => { alive = false; };
  }, []);
  return v;
}

/** Chiffre qui se compte une fois quand run devient vrai. */
function Count({ value, decimals = 0, run, reduced, className = 'sty-num' }) {
  const [shown, setShown] = useState(reduced ? value : 0);
  const done = useRef(false);
  useEffect(() => {
    if (reduced) { setShown(value); return undefined; }
    if (!run || done.current) return undefined;
    done.current = true;
    let raf = 0;
    const t0 = performance.now();
    const tick = t => {
      const k = Math.min(1, (t - t0) / 1200);
      setShown(value * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, value, reduced]);
  return (
    <>
      <span className="sty-sr">{fmt(value, decimals)}</span>
      <span className={className} aria-hidden="true">{fmt(shown, decimals)}</span>
    </>
  );
}

export default function Story({ data, onEnter, flyToStop, regionId: initialRegionId }) {
  const d = useStoryData(data);
  const ready = d.status === 'ready';
  const damFill = useDamFill();
  const prefersReduced = useReducedMotion();
  const reduced = prefersReduced || typeof IntersectionObserver === 'undefined';
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState(() => new Set([0]));
  const [regionId, setRegionId] = useState(initialRegionId || 'souss-massa');
  useEffect(() => { if (initialRegionId) setRegionId(initialRegionId); }, [initialRegionId]);
  const scrollRef = useRef(null);
  const progressRef = useRef(null);
  const refs = useRef([]);
  const ratios = useRef([]);
  const flyRef = useRef(flyToStop);
  flyRef.current = flyToStop;

  const facts = useMemo(() => {
    if (!ready) return {};
    const safe = f => { try { return f(); } catch { return null; } };
    return {
      nat: safe(() => nationalFacts(d)),
      spread: safe(() => basinSpread(d)),
      demand: safe(() => demandFacts(d)),
      south: safe(() => southLinks(d)),
      desal: safe(() => southDesal(d)),
      climate: safe(() => climateFacts(d)),
      figures: safe(() => keyFigures(d)) || [],
    };
  }, [d, ready]);
  const dams = useMemo(() => (ready ? damCounts(d, damFill) : {}), [d, ready, damFill]);
  const nat = facts.nat;
  const bulletinDate = frDate(nat?.date || d?.bulletin?.date);
  const bulletinChip = { status: 'sourced', source: 'Bulletin du ministère de l’Équipement et de l’Eau', date: bulletinDate, note: 'Instantané public daté, pas un relevé en direct.' };

  // Étape active (la plus visible) et --p (0..1) par section.
  useEffect(() => {
    const els = refs.current.filter(Boolean);
    if (!els.length || typeof IntersectionObserver === 'undefined') return undefined;
    let raf = 0;
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        const i = Number(e.target.dataset.index);
        ratios.current[i] = e.intersectionRatio;
        e.target.style.setProperty('--p', Math.min(1, e.intersectionRatio * 1.7).toFixed(3));
      }
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        let best = 0, bestR = -1;
        ratios.current.forEach((r, i) => { if (r > bestR + 0.001) { best = i; bestR = r; } });
        setActive(best);
        setSeen(s => (s.has(best) ? s : new Set(s).add(best)));
      });
    }, { root: scrollRef.current, threshold: THRESHOLDS });
    els.forEach(el => io.observe(el));
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [ready]);

  // Barre de progression liée au défilement (une écriture de style par image, sans rendu React).
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return undefined;
    let raf = 0;
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const max = sc.scrollHeight - sc.clientHeight;
        progressRef.current?.style.setProperty('--sty-progress', (max > 0 ? sc.scrollTop / max : 0).toFixed(4));
      });
    };
    sc.addEventListener('scroll', on, { passive: true });
    on();
    return () => { sc.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, []);

  const fly = useCallback(raw => {
    const stop = forViewport(raw);
    if (!stop || typeof flyRef.current !== 'function') return;
    try { flyRef.current({ ...stop, center: framed(stop), duration: reduced ? 0 : stop.duration, orbit: reduced ? null : stop.orbit || null }); } catch { /* carte indisponible */ }
  }, [reduced]);

  // Caméra et couches : un mouvement par changement d'étape.
  // Délai court : un défilement rapide qui traverse plusieurs étapes ne lance qu'un vol (CPU, WebGL).
  useEffect(() => {
    const t = setTimeout(() => fly(STORY_STOPS[active]), active === 0 ? 0 : 350);
    // Héros : la carte peut finir de charger après ce premier vol et reprendre son cadrage par défaut ;
    // on renvoie le même arrêt une fois chargée (tant que le lecteur n'a pas quitté le héros).
    const again = active === 0 ? [2200, 5500].map(ms => setTimeout(() => fly(STORY_STOPS[0]), ms)) : [];
    return () => { clearTimeout(t); again.forEach(clearTimeout); };
  }, [active, fly]);

  const pickRegion = id => {
    setRegionId(id);
    if (STORY_STOPS[active]?.id === 'essayez') fly(regionStop(d, id));
  };

  const goTo = id => {
    const i = STORY_STOPS.findIndex(s => s.id === id);
    refs.current[i]?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };
  // Second argument : réglages de la mini-simulation (HubApp peut les reprendre comme scénario de départ).
  const enter = (id, scenario) => onEnter?.(id || regionId, scenario);
  const run = id => seen.has(STORY_STOPS.findIndex(s => s.id === id));
  const isActive = id => STORY_STOPS[active]?.id === id;
  const sec = id => ({
    ref: el => { refs.current[STORY_STOPS.findIndex(s => s.id === id)] = el; },
    'data-index': STORY_STOPS.findIndex(s => s.id === id),
    'aria-labelledby': 'sty-t-' + id,
  });
  const chapterOf = id => STORY_STOPS.find(s => s.id === id)?.chapter;
  const chapterNo = id => CHAPTERS.findIndex(c => c.id === chapterOf(id)) + 1;
  const kicker = id => (
    <MicroLabel tone="accent" className="sty-kicker">
      {String(chapterNo(id)).padStart(2, '0')} · {CHAPTERS.find(c => c.id === chapterOf(id))?.label}
    </MicroLabel>
  );

  const activeChapter = STORY_STOPS[active]?.chapter;
  const spreadDouble = facts.spread && facts.spread.hi.fillPct / facts.spread.lo.fillPct >= 2;

  return (
    <div className={'sty' + (reduced ? ' sty--still' : '')} data-step={STORY_STOPS[active]?.id}>
      <div className="sty-progress" ref={progressRef} aria-hidden="true"><span /></div>

      <div className="sty-scroll" ref={scrollRef} tabIndex={0} role="region" aria-label="Récit : défilez pour avancer">
        {/* ---------- Héros « profondeur » : la carte reste visible à droite (en haut sur mobile). ---------- */}
        <section className="sty-hero" {...sec('hero')}>
          <div className="sty-hero__panel az-deep az-deep--flat">
            <WaterFx mode="rain" play={!reduced} className="sty-hero__fx" />
            <div className="sty-hero__top">
              <MicroLabel tone="accent">Observatoire de l’eau du Maroc</MicroLabel>
              <MicroLabel tone="muted">{bulletinDate ? 'Bulletin du ' + bulletinDate : 'Données ouvertes'}</MicroLabel>
            </div>
            <div className="sty-hero__mid">
              <h1 id="sty-t-hero" className="sty-hero__title">Combien d’<span className="az-accent">eau</span> nous reste-t-il&nbsp;?</h1>
              <p className="sty-hero__lead">Barrages, pluie, dessalement. Région par région.</p>
              <div className="sty-hero__cta">
                <Button variant="primary" size="lg" onClick={() => enter()}>Explorer le tableau de bord</Button>
                <Button variant="secondary" size="lg" onClick={() => goTo('chiffres')}>Voir les chiffres</Button>
              </div>
            </div>
            <div className="sty-hero__bottom">
              <button type="button" className="sty-hero__scroll" onClick={() => goTo('contexte')}>
                <span className="sty-hero__drop" aria-hidden="true" />
                <MicroLabel tone="muted">Défiler pour comprendre</MicroLabel>
              </button>
              <p className="sty-legal">{LEGAL}</p>
            </div>
            <Wave side="right" className="sty-hero__edge" />
            <Wave side="top" className="sty-hero__edge-m" />
          </div>
          <div className="sty-hero__map" aria-hidden="true">
            <MicroLabel tone="muted" className="sty-hero__coord">Relief de l’Atlas · carte 3D</MicroLabel>
          </div>
        </section>

        {/* ---------- 01 Contexte ---------- */}
        <section className={'sty-step' + (isActive('contexte') ? ' is-active' : '')} {...sec('contexte')}>
          <div className="sty-card">
            {kicker('contexte')}
            <h2 id="sty-t-contexte" className="sty-title">Un pays d’eau rare et irrégulière.</h2>
            {nat && (
              <div className="sty-level">
                <LevelGauge
                  pct={nat.fillPct}
                  ghostPct={nat.lastYearPct}
                  ghostLabel={nat.lastYearPct != null ? 'il y a un an' : ''}
                  run={run('contexte') || reduced}
                  label={'Remplissage national ' + pct(nat.fillPct, 2) + (nat.lastYearPct != null ? ', contre environ ' + pct(nat.lastYearPct, 0) + ' un an plus tôt' : '')}
                />
                <div className="sty-level__text">
                  <p className="sty-figure">
                    <Count value={nat.fillPct} decimals={2} run={run('contexte')} reduced={reduced} />
                    <span className="sty-unit">%</span>
                  </p>
                  <p className="sty-figure__label">des barrages remplis <ProvenanceChip {...bulletinChip} /></p>
                  {nat.lastYearPct != null && (
                    <p className="sty-figure__sub">
                      Un an plus tôt : <span className="sty-nowrap">≈ {pct(nat.lastYearPct, 0)}</span> <ProvenanceChip status="derived" source="Variation sur un an imprimée au bulletin" date={bulletinDate} note={nat.lastYearNote || ''} />
                    </p>
                  )}
                </div>
              </div>
            )}
            <p className="sty-line">{nat?.ratio >= 2 ? 'En un an, le niveau a plus que doublé. Une bonne année ne fait pas une réserve.' : 'D’une année à l’autre, tout peut changer.'}</p>
            {nat && <MicroLabel tone="faint" as="p" className="sty-caveat">Bulletin du {bulletinDate} · instantané daté, pas un relevé en direct</MicroLabel>}
          </div>
        </section>

        {/* ---------- 02 Problématique : écarts ---------- */}
        <section className={'sty-step' + (isActive('ecarts') ? ' is-active' : '')} {...sec('ecarts')}>
          <div className="sty-card">
            {kicker('ecarts')}
            <h2 id="sty-t-ecarts" className="sty-title">{spreadDouble ? 'D’un bassin à l’autre, du simple au double.' : 'D’un bassin à l’autre, des écarts nets.'}</h2>
            {facts.spread && (
              <ol className={'sty-basins' + (run('ecarts') || reduced ? ' is-run' : '')} aria-label="Remplissage par bassin">
                {[...facts.spread.rows].reverse().map((b, i) => (
                  <li key={b.name} className={b === facts.spread.lo || b === facts.spread.hi ? 'is-edge' : ''} style={{ '--v': b.fillPct / 100, '--i': i }}>
                    <span className="sty-basins__name">{b.name}</span>
                    <span className="sty-basins__bar" aria-hidden="true"><span /></span>
                    <span className="sty-basins__val">{pct(b.fillPct)}</span>
                  </li>
                ))}
              </ol>
            )}
            {facts.spread && <MicroLabel tone="faint" as="p" className="sty-caveat">Remplissage par bassin · bulletin du {bulletinDate} <ProvenanceChip {...bulletinChip} /></MicroLabel>}
          </div>
        </section>

        {/* ---------- Problématique : qui consomme ---------- */}
        <section className={'sty-step' + (isActive('demande') ? ' is-active' : '')} {...sec('demande')}>
          <div className="sty-card">
            {kicker('demande')}
            <h2 id="sty-t-demande" className="sty-title">Les champs boivent l’essentiel.</h2>
            {facts.demand && (
              <>
                <p className="sty-figure">
                  <Count value={facts.demand.agriSharePct} decimals={0} run={run('demande')} reduced={reduced} />
                  <span className="sty-unit">%</span>
                </p>
                <p className="sty-figure__label">
                  de l’eau demandée va à l’agriculture ({facts.demand.year})
                  {' '}<ProvenanceChip status={facts.demand.status} source="IRES, L’avenir de l’eau au Maroc (Département de l’Eau)" url={facts.demand.source} date={facts.demand.date} />
                </p>
                <div className={'sty-split' + (run('demande') || reduced ? ' is-run' : '')} style={{ '--v': facts.demand.agriSharePct / 100 }} aria-hidden="true">
                  <span className="sty-split__a" /><span className="sty-split__b" />
                </div>
                <p className="sty-line">Villes, industrie et tourisme se partagent le reste.</p>
              </>
            )}
          </div>
        </section>

        {/* ---------- Problématique : le Sud ---------- */}
        <section className={'sty-step' + (isActive('sud') ? ' is-active' : '')} {...sec('sud')}>
          <div className="sty-card">
            {kicker('sud')}
            <h2 id="sty-t-sud" className="sty-title">{facts.south?.physicalCount === 0 ? 'Au Sud, ni barrage suivi ni liaison.' : 'Le Sud, un cas à part.'}</h2>
            {facts.desal && (
              <>
                <p className="sty-figure">
                  <Count value={facts.desal.valueMm3} decimals={1} run={run('sud')} reduced={reduced} />
                  <span className="sty-unit">Mm³/an</span>
                </p>
                <p className="sty-figure__label">
                  de capacité de dessalement, {facts.desal.regionName}
                  {' '}<ProvenanceChip
                    status={facts.desal.status}
                    source="Policy Center for the New South (somme des usines citées)"
                    url={facts.desal.source}
                    date={facts.desal.dataYear ? 'données ' + facts.desal.dataYear : facts.desal.date}
                    note="Capacité installée, pas une production mesurée."
                  />
                </p>
              </>
            )}
            {facts.desal?.cityShare && (
              <p className="sty-figure__sub">
                Ville de Laâyoune : <span className="sty-nowrap">{fmt(facts.desal.cityShare.pct, 0)} %</span> de l’eau potable dessalée
                {' '}<ProvenanceChip status={facts.desal.cityShare.status} source="EcoActu (ONEE)" url={facts.desal.cityShare.source} date={facts.desal.cityShare.date} note="Capacité installée de la ville, pas une consommation ; le reste vient des nappes." />
              </p>
            )}
            {facts.south && <p className="sty-line">{facts.south.sentence} Aucun barrage de ces régions au bulletin : dessalement et nappes (non modélisées).</p>}
          </div>
        </section>

        {/* ---------- Problématique : le climat ---------- */}
        <section className={'sty-step' + (isActive('climat') ? ' is-active' : '')} {...sec('climat')}>
          <div className="sty-card">
            {kicker('climat')}
            <h2 id="sty-t-climat" className="sty-title">Demain, moins de pluie&nbsp;?</h2>
            {facts.climate && (
              <>
                <p className="sty-figure">
                  <Count value={facts.climate.drier} run={run('climat')} reduced={reduced} />
                  <span className="sty-unit">/ {facts.climate.total} bassins</span>
                </p>
                <p className="sty-figure__label">
                  avec moins de pluie projetée{facts.climate.projection ? ' en ' + facts.climate.projection.join('-') : ''}{facts.climate.reference ? ' qu’en ' + facts.climate.reference.join('-') : ''}
                  {' '}<ProvenanceChip status="derived" source="Compte Anzar sur les médianes Open-Meteo (CMIP6)" url={facts.climate.source} date={facts.climate.fetchedAt ? frDate(facts.climate.fetchedAt) : ''} note="Projection modélisée (médiane des modèles), proche RCP8.5. Pas une prévision." />
                </p>
                {facts.climate.exceptions.length > 0 && (
                  <p className="sty-line">
                    Exception : {facts.climate.exceptions.map(e => e.name + ' (' + (e.medianPct > 0 ? '+' : '') + fmt(e.medianPct, 1) + ' %' + (e.nModels ? ', ' + e.nModels + ' modèles seulement' : '') + ')').join(', ')}.
                  </p>
                )}
                <MicroLabel tone="faint" as="p" className="sty-caveat">Projection modélisée CMIP6 · pas une prévision</MicroLabel>
              </>
            )}
          </div>
        </section>

        {/* ---------- 03 Où sont les barrages ---------- */}
        <section className={'sty-step sty-step--dams' + (isActive('barrages') ? ' is-active' : '')} {...sec('barrages')}>
          <div className="sty-card sty-card--fx">
            <WaterFx mode="ripples" play={isActive('barrages')} points={[[0.18, 0.42], [0.62, 0.58], [0.86, 0.3]]} />
            {kicker('barrages')}
            <h2 id="sty-t-barrages" className="sty-title">Au pied de l’Atlas, les barrages.</h2>
            <div className="sty-pair">
              {dams.readCount != null && (
                <div>
                  <p className="sty-figure"><Count value={dams.readCount} run={run('barrages')} reduced={reduced} /></p>
                  <p className="sty-figure__label">
                    barrages lus au bulletin{dams.readDate ? ' du ' + frDate(dams.readDate) : ''}{dams.matchedCount != null ? ', dont' : ''}
                    {' '}<ProvenanceChip status="sourced" source="Bulletin du ministère, lu page par page" url={dams.readSource} date={frDate(dams.readDate)} note="Stock et taux lus visuellement ; sommes vérifiées par bassin." />
                  </p>
                </div>
              )}
              {(dams.matchedCount ?? dams.locatedCount) != null && (
                <div>
                  <p className="sty-figure sty-figure--sm"><Count value={dams.matchedCount ?? dams.locatedCount} run={run('barrages')} reduced={reduced} /></p>
                  <p className="sty-figure__label">{dams.matchedCount != null ? 'placés sur la carte avec leur taux de remplissage' : 'barrages localisés sur la carte'}</p>
                </div>
              )}
            </div>
            <p className="sty-line">
              {dams.placedCount != null
                ? 'La carte compte ' + dams.placedCount + ' barrages localisés (OpenStreetMap, Wikidata) : chaque cercle est un barrage, vide quand le bulletin n’a pas de taux apparié.'
                : 'Chaque cercle sur le relief est un barrage.'}
            </p>
          </div>
        </section>

        {/* ---------- 04 En chiffres ---------- */}
        <section className={'sty-step sty-step--wide' + (isActive('chiffres') ? ' is-active' : '')} {...sec('chiffres')}>
          <div className="sty-card sty-card--wide">
            {kicker('chiffres')}
            <h2 id="sty-t-chiffres" className="sty-title">L’eau du Maroc, en chiffres.</h2>
            <ul className={'sty-tiles' + (run('chiffres') || reduced ? ' is-run' : '')}>
              {facts.figures.map((f, i) => (
                <li key={f.id} className="sty-tile" style={{ '--i': i }}>
                  <p className="sty-figure sty-figure--tile">
                    <Count value={f.value} decimals={f.decimals} run={run('chiffres')} reduced={reduced} />
                    {f.unit && <span className="sty-unit">{f.unit}</span>}
                  </p>
                  <p className="sty-figure__label">{f.label} <ProvenanceChip {...(f.bulletin ? bulletinChip : { status: f.status, source: f.note, url: f.source })} /></p>
                  <span className="sty-tile__water" aria-hidden="true" />
                </li>
              ))}
            </ul>
            {facts.figures.some(f => f.bulletin) && <MicroLabel tone="faint" as="p" className="sty-caveat">Stock, capacité et bassins : bulletin du {bulletinDate} · instantané daté, pas un relevé en direct</MicroLabel>}
          </div>
        </section>

        {/* ---------- 05 Essayez ---------- */}
        <section className={'sty-step sty-step--wide' + (isActive('essayez') ? ' is-active' : '')} {...sec('essayez')}>
          <div className="sty-card sty-card--sim">
            {kicker('essayez')}
            <h2 id="sty-t-essayez" className="sty-title">À vous de jouer.</h2>
            {ready && <MiniSim data={d} regionId={regionId} onRegion={pickRegion} onOpen={enter} />}
          </div>
        </section>

        <footer className="sty-foot az-deep">
          <Wave side="top" className="sty-foot__wave" />
          <div className="sty-foot__inner">
            <img src="/brand/anzar/logo-on-deep.svg" alt="Anzar" height="24" />
            <p className="sty-legal">{LEGAL} Chiffres datés, pas un relevé en direct.</p>
            <a className="sty-foot__link az-micro" href="#/sources">Sources et méthode</a>
          </div>
        </footer>
      </div>


      {/* Rail des chapitres */}
      <nav className={'sty-rail' + (active > 0 ? ' is-on' : '')} aria-label="Chapitres du récit">
        <ol>
          {CHAPTERS.map((c, k) => {
            const first = STORY_STOPS.find(s => s.chapter === c.id);
            const on = activeChapter === c.id;
            const past = CHAPTERS.findIndex(x => x.id === activeChapter) > k;
            return (
              <li key={c.id}>
                <button type="button" className={'sty-rail__item' + (on ? ' is-active' : '') + (past ? ' is-past' : '')} aria-current={on ? 'step' : undefined} onClick={() => goTo(first.id)}>
                  <span className="sty-rail__label">{c.label}</span>
                  <span className="sty-rail__dot" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
