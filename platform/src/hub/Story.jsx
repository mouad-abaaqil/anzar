// Page d'accueil d'Anzar (landing) : OUVERTURE (globe puis plongeon vers le Maroc) → CONTEXTE → PROBLÉMATIQUE
// (écarts, usages de l'eau, Sud, climat) → BARRAGES → CHIFFRES → ESSAYEZ → pied de page. Posée sur la carte persistante
// (HubMap, fixe derrière la page) qu'elle pilote. Contrat : docs/HUB_CONTRACT.md. Props :
// - data : useHubData() (chargé ici si absent) ; regionId : région de départ ;
// - onEnter(regionId) : ouvre le tableau de bord ; flyToStop(stop) : caméra (absent ou sans WebGL : la page reste complète) ;
// - mapFeatures : { fields, globe } capacités annoncées par la carte (mention « parcelles en 3D » seulement si elle sait les montrer).
// Mise en page « l'eau d'abord » : la carte 3D plein écran est LA scène de chaque section ; le texte vit dans des légendes
// légères posées dessus (cartes « verre » translucides, ou titres directement sur un voile dégradé), dont la place varie
// (gauche, droite, bas, centre). Mobile : carte dans la moitié haute, légende en bas. Défilement NATIF du document :
// aucun conteneur imbriqué, aucun snap, aucun gestionnaire de molette. Étape active : IntersectionObserver (bande
// centrale) ; caméra : un seul vol après un court délai, cadré dans la zone que la légende laisse libre.
// Eau (décor, aria-hidden) : pluie et surface animée à l'ouverture, mot « eau » qui se remplit, voile de plus en plus
// profond et jauge latérale liés au défilement, bulles, réservoirs. Boucles gelées au repos et sous reduced-motion.
// Tous les chiffres viennent de stops.js (lus dans public/data/*.json) ; chaque chiffre n'apparaît que dans une section.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, MicroLabel, ProvenanceChip } from '../design';
import MiniSim from './MiniSim.jsx';
import AwarenessChapter from './Awareness.jsx';
import WaterFx, { Bubbles, LevelGauge, Sea, Surface, WaterLine, Wave, useReducedMotion, useTouchRipples } from './WaterFx.jsx';
import { watchActivity } from './water/clock.js';
import { hubHash } from './routes.js';
import {
  CHAPTERS, HERO_DIVE, HERO_DIVE_DELAY_MS, STORY_STOPS, basinSpread, climateFacts, damCounts, demandFacts, fmt, frDate,
  keyFigures, nationalFacts, regionStop, southDesal, southLinks,
} from './stops.js';
import './Story.css';

const LEGAL = 'Prototype indépendant issu d’un stage à la RAMSA. Pas un portail officiel.';
const pct = (v, d = 1) => fmt(v, d) + ' %';
const MOBILE = 899;

// Centre de caméra décalé pour que la cible tombe au milieu de la zone de carte que la légende laisse libre :
// à côté (gauche ou droite) ou au-dessus d'elle sur grand écran, dans la moitié haute sur mobile. La place de la
// légende est mesurée comme si sa section était calée en haut de la fenêtre. Approximation Web Mercator (tuiles de
// 512 px). Étape 'hero' : HubMap ajoute son propre cadrage (heroFraming), on ne décale pas. Globe : pas de décalage.
function framed(stop) {
  if (typeof window === 'undefined' || !stop?.center || stop.globe || stop.id === 'hero') return stop?.center;
  const w = window.innerWidth, h = window.innerHeight;
  const bar = document.querySelector('.hub-bar')?.getBoundingClientRect().bottom || 64;
  const [lon, lat] = stop.center;
  const degPerPx = 360 / (512 * Math.pow(2, stop.zoom));
  const mapCx = w / 2, mapCy = bar + (h - bar) / 2;
  const sec = document.querySelector('[data-stop="' + (stop.id === HERO_DIVE.id ? 'hero' : stop.id) + '"]');
  const cap = sec?.querySelector('[data-cap]');
  let fx = mapCx, fy = mapCy;
  if (sec && cap) {
    const s = sec.getBoundingClientRect(), c = cap.getBoundingClientRect();
    const capTop = Math.max(bar + 0.3 * (h - bar), Math.min(h, bar + (c.top - s.top)));
    const spaces = w > MOBILE
      ? [
        { a: c.left * (h - bar), x: c.left / 2, y: mapCy },
        { a: (w - c.right) * (h - bar), x: (c.right + w) / 2, y: mapCy },
        { a: (capTop - bar) * w, x: mapCx, y: (bar + capTop) / 2 },
      ]
      : [{ a: 1, x: mapCx, y: (bar + capTop) / 2 }];
    const best = spaces.reduce((m, x) => (x.a > m.a ? x : m));
    fx = best.x; fy = best.y;
  }
  // Vertical : avec l'inclinaison, un pixel d'écran couvre 1 / cos(pitch) fois plus de sol près du centre.
  const tilt = 1 / Math.max(0.35, Math.cos(((stop.pitch || 0) * Math.PI) / 180));
  return [lon - (fx - mapCx) * degPerPx, lat + (fy - mapCy) * tilt * degPerPx * Math.cos((lat * Math.PI) / 180)];
}
const MOBILE_HERO_ZOOM_OUT = 0.9;
const forViewport = stop => (stop?.id === HERO_DIVE.id && typeof window !== 'undefined' && window.innerWidth <= 760 ? { ...stop, zoom: stop.zoom - MOBILE_HERO_ZOOM_OUT } : stop);

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

/** Mot du titre qui se remplit d'eau jusqu'à level (0-1) : le texte reste du vrai texte (lu une fois) ; l'eau est un
 *  pseudo-élément (hors du texte de la page) qui monte avec une vague. */
function FillWord({ children, level }) {
  const l = Math.max(0, Math.min(1, level ?? 1));
  return (
    <span className="sty-eau" style={{ '--lvl': l }}>
      {children}
      <span className="sty-eau__clip wx-loop" data-t={children} aria-hidden="true" />
    </span>
  );
}

/** Section : la carte en fond (rien n'est peint derrière la légende), une légende posée sur la scène.
 *  side : 'left' | 'right' | 'bottom' | 'low' (bas, centré) | 'center' ; tone : 'glass' (verre clair), 'veil' (titre
 *  directement sur un voile profond dégradé). Composant de module (et non défini dans Story) : sinon React le
 *  remonterait à chaque rendu (compteurs, MiniSim). */
function Section({ ctx, id, side = 'left', tone = 'glass', bubbles = false, title, lead, note, children, after }) {
  const i = ctx.idx(id);
  return (
    <section
      ref={el => { if (el) ctx.refs.current[i] = el; }}
      data-index={i}
      data-stop={id}
      data-live=""
      aria-labelledby={'sty-t-' + id}
      className={'sty-sec sty-sec--' + side + ' sty-sec--' + tone + (ctx.run(id) ? ' is-seen' : '') + (ctx.activeId === id ? ' is-active' : '')}
    >
      <WaterLine className="sty-sec__line" />
      {bubbles && <Bubbles className="sty-sec__bubbles" />}
      <div className={'sty-cap' + (tone === 'veil' ? ' az-deep' : '')} data-cap="">
        <header className="sty-sec__head">
          {ctx.kicker(id)}
          <h2 id={'sty-t-' + id} className="sty-title">{title}</h2>
          {lead && <p className="sty-lead">{lead}</p>}
        </header>
        <div className="sty-cap__body">
          {children}
          {after}
          {note && <MicroLabel tone="muted" as="p" className="sty-mapnote">{note}</MicroLabel>}
        </div>
      </div>
    </section>
  );
}

export default function Story({ data, onEnter, flyToStop, mapFeatures, regionId: initialRegionId }) {
  const d = useStoryData(data);
  const ready = d.status === 'ready';
  const damFill = useDamFill();
  const prefersReduced = useReducedMotion();
  const noIO = typeof IntersectionObserver === 'undefined';
  const reduced = prefersReduced || noIO;
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState(() => new Set([0]));
  const [atEnd, setAtEnd] = useState(false);
  const [dived, setDived] = useState(false);
  const [filled, setFilled] = useState(false);
  const [regionId, setRegionId] = useState(initialRegionId || 'souss-massa');
  useEffect(() => { if (initialRegionId) setRegionId(initialRegionId); }, [initialRegionId]);
  const rootRef = useRef(null);
  const deepRef = useRef(null);
  const gaugeRef = useRef(null);
  const railFillRef = useRef(null);
  const footRef = useRef(null);
  const refs = useRef([]);
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

  // Étape active : la section qui coupe la bande centrale de la fenêtre. Sections vues : apparition une seule fois.
  // Zones animées ([data-live]) : .is-live tant qu'elles sont à l'écran (les boucles d'eau ne tournent que là).
  useEffect(() => {
    const els = refs.current.filter(Boolean);
    if (!els.length || noIO) return undefined;
    const band = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) setActive(Number(e.target.dataset.index));
    }, { rootMargin: '-45% 0px -54% 0px', threshold: 0 });
    const reveal = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const i = Number(e.target.dataset.index);
        setSeen(s => (s.has(i) ? s : new Set(s).add(i)));
        reveal.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    const live = new IntersectionObserver(entries => {
      for (const e of entries) e.target.classList.toggle('is-live', e.isIntersecting);
    }, { threshold: 0 });
    els.forEach(el => { band.observe(el); reveal.observe(el); });
    rootRef.current?.querySelectorAll('[data-live]').forEach(el => live.observe(el));
    const foot = footRef.current;
    const end = foot ? new IntersectionObserver(([e]) => setAtEnd(e.isIntersecting), { threshold: 0 }) : null;
    if (foot) end.observe(foot);
    return () => { band.disconnect(); reveal.disconnect(); live.disconnect(); end?.disconnect(); };
  }, [ready, noIO]);

  // Éveil : les boucles d'eau tournent ~10 s après le dernier geste, puis tout s'immobilise (rien au repos).
  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return undefined;
    return watchActivity(v => root.classList.toggle('is-awake', v));
  }, [reduced]);
  useTouchRipples(rootRef, !reduced);

  // Le mot « eau » se remplit peu après l'ouverture (jusqu'au taux national du bulletin s'il est connu).
  useEffect(() => {
    if (reduced) { setFilled(true); return undefined; }
    const t = setTimeout(() => setFilled(true), 700);
    return () => clearTimeout(t);
  }, [reduced]);

  // Plongée liée au défilement : voile bleu de plus en plus profond et jauge d'eau latérale (écritures de style
  // directes, une par image au plus, sans rendu React).
  useEffect(() => {
    let raf = 0;
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const de = document.documentElement;
        const max = de.scrollHeight - window.innerHeight;
        const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        const k = Math.min(1, Math.max(0, (p - 0.04) / 0.9));
        if (deepRef.current) deepRef.current.style.opacity = (k * k * (3 - 2 * k) * 0.55).toFixed(3);
        const fill = 'scaleY(' + p.toFixed(4) + ')';
        if (gaugeRef.current) gaugeRef.current.style.transform = fill;
        if (railFillRef.current) railFillRef.current.style.transform = fill;
      });
    };
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on, { passive: true });
    on();
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf); };
  }, []);

  const fly = useCallback(raw => {
    const stop = forViewport(raw);
    if (!stop || typeof flyRef.current !== 'function') return;
    // Sous reduced-motion : aucune rotation (false pour une étape globe, que HubMap ferait sinon tourner par défaut).
    try { flyRef.current({ ...stop, center: framed(stop), duration: reduced ? 0 : stop.duration, orbit: reduced ? (stop.globe ? false : null) : stop.orbit || null }); } catch { /* carte indisponible */ }
  }, [reduced]);

  // Ouverture : globe (si la carte sait l'afficher : mapFeatures.globe), puis plongeon vers le Maroc au premier défilement
  // ou après un court moment sans geste. Sans globe (pas de WebGL, carte plus ancienne) ou sous reduced-motion : la carte
  // se pose directement sur le Maroc, sans attente ni rotation.
  const globeOk = !!mapFeatures?.globe && !reduced;
  useEffect(() => {
    if (dived || !globeOk) return undefined;
    const t = setTimeout(() => setDived(true), HERO_DIVE_DELAY_MS);
    const onScroll = () => { if (window.scrollY > 24) setDived(true); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { clearTimeout(t); window.removeEventListener('scroll', onScroll); };
  }, [dived, globeOk]);
  const heroStop = dived || !globeOk ? HERO_DIVE : STORY_STOPS[0];

  // Caméra et couches : un seul vol par changement d'étape, après un court délai (un défilement rapide qui traverse
  // plusieurs étapes ne lance qu'un vol : jamais de vols empilés).
  useEffect(() => {
    const stop = active === 0 ? heroStop : STORY_STOPS[active];
    const t = setTimeout(() => fly(stop), active === 0 ? 0 : 350);
    // Héros sans globe : la carte peut finir de charger après ce premier vol ; on renvoie le même arrêt une fois chargée.
    // (Avec globe, HubMap rejoue l'étape en attente à la fin du chargement : aucun renvoi, donc aucun vol interrompu.)
    const again = active === 0 && !globeOk ? [2200, 5500].map(ms => setTimeout(() => fly(stop), ms)) : [];
    return () => { clearTimeout(t); again.forEach(clearTimeout); };
  }, [active, fly, heroStop, globeOk]);

  const pickRegion = id => {
    setRegionId(id);
    if (STORY_STOPS[active]?.id === 'essayez') fly(regionStop(d, id));
  };

  const goTo = id => {
    const i = STORY_STOPS.findIndex(s => s.id === id);
    refs.current[i]?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };
  // Second argument : réglages de la mini-simulation (HubApp peut les reprendre comme scénario de départ).
  // « Accueil » sur l'accueil : l'adresse ne change pas, on remonte en haut de page.
  const toTop = e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); };
  const enter = (id, scenario) => onEnter?.(id || regionId, scenario);
  const run = id => reduced || seen.has(STORY_STOPS.findIndex(s => s.id === id));
  const idx = id => STORY_STOPS.findIndex(s => s.id === id);
  const chapterOf = id => STORY_STOPS.find(s => s.id === id)?.chapter;
  const chapterNo = id => CHAPTERS.findIndex(c => c.id === chapterOf(id)) + 1;
  const kicker = id => (
    <MicroLabel tone="accent" className="sty-kicker">
      {String(chapterNo(id)).padStart(2, '0')} · {CHAPTERS.find(c => c.id === chapterOf(id))?.label}
    </MicroLabel>
  );

  const ctx = { refs, idx, run, kicker, activeId: STORY_STOPS[active]?.id };
  const activeChapter = STORY_STOPS[active]?.chapter;
  const spreadDouble = facts.spread && facts.spread.hi.fillPct / facts.spread.lo.fillPct >= 2;
  const dem = facts.demand;
  const year = new Date().getFullYear();
  const dashHash = hubHash({ view: 'explore', regionId, tab: 'today' });
  const iresChip = dem ? { status: dem.status, source: 'IRES, L’avenir de l’eau au Maroc (Département de l’Eau)', url: dem.source, date: dem.date } : null;
  const heroLevel = filled ? (nat?.fillPct != null ? nat.fillPct / 100 : 1) : 0;

  return (
    <div ref={rootRef} className={'sty' + (reduced ? ' sty--still' : ' sty--anim')} data-step={STORY_STOPS[active]?.id}>
      {/* Scène fixe posée sur la carte : eau animée pendant le chargement ou sans carte, voile de profondeur. */}
      <div className="sty-scene is-live" aria-hidden="true">
        <div className="sty-scene__sea"><Sea /></div>
        <div className="sty-scene__deep" ref={deepRef} />
      </div>
      <div className="sty-gauge" aria-hidden="true"><span ref={gaugeRef} /></div>

      {/* ---------- Ouverture : la Terre en 3D, puis plongeon ; le titre posé sur un voile profond, l'eau en bas. ---------- */}
      <section className={'sty-hero' + (heroStop === HERO_DIVE ? ' is-dived' : '')} ref={el => { refs.current[0] = el; }} data-index={0} data-stop="hero" data-live="" aria-labelledby="sty-t-hero">
        <div className="sty-hero__veil" aria-hidden="true" />
        <WaterFx mode="rain" play={!reduced} surface={0.9} className="sty-hero__rain" />
        <Sea className="sty-hero__sea" />
        <div className="sty-hero__content az-deep" data-cap="">
          <div className="sty-hero__top">
            <MicroLabel tone="accent">Observatoire de l’eau du Maroc</MicroLabel>
            <MicroLabel tone="muted">{bulletinDate ? 'Bulletin du ' + bulletinDate : 'Données ouvertes'}</MicroLabel>
          </div>
          <h1 id="sty-t-hero" className="sty-hero__title">Combien d’<FillWord level={heroLevel}>eau</FillWord> nous reste-t-il&nbsp;?</h1>
          <p className="sty-hero__lead">Barrages, pluie, dessalement. Région par région.</p>
          <div className="sty-hero__cta">
            <Button variant="primary" size="lg" onClick={() => enter()}>Explorer le tableau de bord</Button>
            <Button variant="secondary" size="lg" onClick={() => goTo('chiffres')}>Voir les chiffres</Button>
          </div>
          <button type="button" className="sty-hero__scroll" onClick={() => goTo('contexte')}>
            <span className="sty-hero__drop" aria-hidden="true" />
            <MicroLabel tone="muted">Défiler pour comprendre</MicroLabel>
          </button>
          <p className="sty-legal">{LEGAL}</p>
        </div>
        <MicroLabel tone="muted" className="sty-hero__coord" aria-hidden="true">{heroStop === HERO_DIVE ? 'Relief de l’Atlas · carte 3D' : 'La Terre · relief en 3D'}</MicroLabel>
      </section>

      {/* ---------- 01 Contexte ---------- */}
      <Section
        ctx={ctx}
        id="contexte"
        side="right"
        title="Un pays d’eau rare et irrégulière."
        lead={nat?.ratio >= 2 ? 'En un an, le niveau a plus que doublé. Une bonne année ne fait pas une réserve.' : 'D’une année à l’autre, tout peut changer.'}
        after={nat && <MicroLabel tone="faint" as="p" className="sty-caveat">Bulletin du {bulletinDate} · instantané daté, pas un relevé en direct</MicroLabel>}
      >
        {nat && (
          <div className="sty-grid">
            <article className="sty-card">
              <div className="sty-level">
                <LevelGauge
                  pct={nat.fillPct}
                  ghostPct={nat.lastYearPct}
                  ghostLabel={nat.lastYearPct != null ? 'il y a un an' : ''}
                  run={run('contexte')}
                  label={'Remplissage national ' + pct(nat.fillPct, 2) + (nat.lastYearPct != null ? ', contre environ ' + pct(nat.lastYearPct, 0) + ' un an plus tôt' : '')}
                />
                <div className="sty-level__text">
                  <p className="sty-figure">
                    <Count value={nat.fillPct} decimals={2} run={run('contexte')} reduced={reduced} />
                    <span className="sty-unit">%</span>
                  </p>
                  <p className="sty-figure__label">des barrages remplis <ProvenanceChip {...bulletinChip} /></p>
                </div>
              </div>
            </article>
            {nat.lastYearPct != null && (
              <article className="sty-card">
                <MicroLabel tone="muted" as="p">Un an plus tôt</MicroLabel>
                <p className="sty-figure sty-figure--sm"><span className="sty-num">≈ {fmt(nat.lastYearPct, 0)}</span><span className="sty-unit">%</span></p>
                <p className="sty-figure__label">même jour, l’an dernier <ProvenanceChip status="derived" source="Variation sur un an imprimée au bulletin" date={bulletinDate} note={nat.lastYearNote || ''} /></p>
              </article>
            )}
          </div>
        )}
      </Section>

      {/* ---------- 02 Problématique : écarts ---------- */}
      <Section
        ctx={ctx}
        id="ecarts"
        side="left"
        title={spreadDouble ? 'D’un bassin à l’autre, du simple au double.' : 'D’un bassin à l’autre, des écarts nets.'}
        lead="Le remplissage varie fortement selon les bassins."
        after={facts.spread && <MicroLabel tone="faint" as="p" className="sty-caveat">Remplissage par bassin · bulletin du {bulletinDate} <ProvenanceChip {...bulletinChip} /></MicroLabel>}
      >
        {facts.spread && (
          <article className="sty-card">
            <ol className={'sty-basins' + (run('ecarts') ? ' is-run' : '')} aria-label="Remplissage par bassin">
              {[...facts.spread.rows].reverse().map((b, i) => (
                <li key={b.name} className={b === facts.spread.lo || b === facts.spread.hi ? 'is-edge' : ''} style={{ '--v': b.fillPct / 100, '--i': i }}>
                  <span className="sty-basins__name">{b.name}</span>
                  <span className="sty-basins__bar" aria-hidden="true"><span /></span>
                  <span className="sty-basins__val">{pct(b.fillPct)}</span>
                </li>
              ))}
            </ol>
          </article>
        )}
      </Section>

      {/* ---------- Problématique : à quoi sert l'eau (champs en 3D sur la carte) ---------- */}
      <Section
        ctx={ctx}
        id="demande"
        side="bottom"
        tone="veil"
        bubbles
        title="À quoi sert l’eau ?"
        lead="Les champs boivent l’essentiel."
        note={mapFeatures?.fields ? 'Plaine du Tadla (Béni Mellal-Khénifra) · parcelles agricoles OpenStreetMap en 3D, hauteur symbolique' : 'Plaine agricole du Tadla (Béni Mellal-Khénifra)'}
        after={dem && (
          <MicroLabel tone="faint" as="p" className="sty-caveat">
            Demande nationale {dem.year}, Département de l’Eau cité par l’IRES · l’eau potable, l’industrie et le tourisme forment un seul poste dans la source
          </MicroLabel>
        )}
      >
        {dem && (
          <div className={'sty-grid sty-uses' + (run('demande') ? ' is-run' : '')}>
            <article className="sty-card sty-use" style={{ '--v': dem.agriSharePct / 100 }}>
              <span className="sty-use__col" aria-hidden="true"><span className="sty-use__water"><Surface /></span></span>
              <div className="sty-use__text">
                <MicroLabel tone="muted" as="p">Agriculture</MicroLabel>
                <p className="sty-figure">
                  <Count value={dem.agriSharePct} decimals={0} run={run('demande')} reduced={reduced} />
                  <span className="sty-unit">%</span>
                </p>
                <p className="sty-figure__label">{fmt(dem.agriMm3, 0)} Mm³ en {dem.year} <ProvenanceChip {...iresChip} /></p>
              </div>
            </article>
            {dem.other && (
              <article className="sty-card sty-use" style={{ '--v': dem.other.sharePct / 100 }}>
                <span className="sty-use__col" aria-hidden="true"><span className="sty-use__water"><Surface /></span></span>
                <div className="sty-use__text">
                  <MicroLabel tone="muted" as="p">Eau potable, industrie, tourisme</MicroLabel>
                  <p className="sty-figure sty-figure--sm"><span className="sty-num">{fmt(dem.other.sharePct, 0)}</span><span className="sty-unit">%</span></p>
                  <p className="sty-figure__label">{fmt(dem.other.value, 0)} Mm³ en {dem.year} <ProvenanceChip {...iresChip} /></p>
                </div>
              </article>
            )}
          </div>
        )}
        {dem?.projection2050 && (
          <p className="sty-line">
            En 2050, l’IRES projette <span className="sty-nowrap">{fmt(dem.projection2050.agriMm3, 0)} Mm³</span> pour l’agriculture et <span className="sty-nowrap">{fmt(dem.projection2050.otherMm3, 0)} Mm³</span> pour le reste.
            {' '}<ProvenanceChip status="sourced" source="IRES, projection 2050" url={dem.projection2050.source} date={dem.projection2050.date} note="Projection publiée, pas une mesure." />
          </p>
        )}
      </Section>

      {/* ---------- Problématique : le Sud ---------- */}
      <Section
        ctx={ctx}
        id="sud"
        side="right"
        title={facts.south?.physicalCount === 0 ? 'Au Sud, ni barrage suivi ni liaison.' : 'Le Sud, un cas à part.'}
        lead={facts.south ? facts.south.sentence + ' Aucun barrage de ces régions au bulletin : dessalement et nappes (non modélisées).' : null}
      >
        {facts.desal && (
          <div className="sty-grid">
            <article className="sty-card">
              <MicroLabel tone="muted" as="p">Dessalement · {facts.desal.regionName}</MicroLabel>
              <p className="sty-figure">
                <Count value={facts.desal.valueMm3} decimals={1} run={run('sud')} reduced={reduced} />
                <span className="sty-unit">Mm³/an</span>
              </p>
              <p className="sty-figure__label">
                de capacité installée
                {' '}<ProvenanceChip
                  status={facts.desal.status}
                  source="Policy Center for the New South (somme des usines citées)"
                  url={facts.desal.source}
                  date={facts.desal.dataYear ? 'données ' + facts.desal.dataYear : facts.desal.date}
                  note="Capacité installée, pas une production mesurée."
                />
              </p>
            </article>
            {facts.desal.cityShare && (
              <article className="sty-card">
                <MicroLabel tone="muted" as="p">Ville de Laâyoune</MicroLabel>
                <p className="sty-figure sty-figure--sm"><span className="sty-num">{fmt(facts.desal.cityShare.pct, 0)}</span><span className="sty-unit">%</span></p>
                <p className="sty-figure__label">
                  de l’eau potable dessalée
                  {' '}<ProvenanceChip status={facts.desal.cityShare.status} source="EcoActu (ONEE)" url={facts.desal.cityShare.source} date={facts.desal.cityShare.date} note="Capacité installée de la ville, pas une consommation ; le reste vient des nappes." />
                </p>
              </article>
            )}
          </div>
        )}
      </Section>

      {/* ---------- Problématique : le climat ---------- */}
      <Section
        ctx={ctx}
        id="climat"
        side="low"
        title="Demain, moins de pluie ?"
        lead="Projection des modèles climatiques, bassin par bassin."
        after={facts.climate && <MicroLabel tone="faint" as="p" className="sty-caveat">Projection modélisée CMIP6 · pas une prévision</MicroLabel>}
      >
        {facts.climate && (
          <div className="sty-grid">
            <article className="sty-card">
              <p className="sty-figure">
                <Count value={facts.climate.drier} run={run('climat')} reduced={reduced} />
                <span className="sty-unit">/ {facts.climate.total} bassins</span>
              </p>
              <p className="sty-figure__label">
                avec moins de pluie projetée{facts.climate.projection ? ' en ' + facts.climate.projection.join('-') : ''}{facts.climate.reference ? ' qu’en ' + facts.climate.reference.join('-') : ''}
                {' '}<ProvenanceChip status="derived" source="Compte Anzar sur les médianes Open-Meteo (CMIP6)" url={facts.climate.source} date={facts.climate.fetchedAt ? frDate(facts.climate.fetchedAt) : ''} note="Projection modélisée (médiane des modèles), proche RCP8.5. Pas une prévision." />
              </p>
            </article>
            {facts.climate.exceptions.length > 0 && (
              <article className="sty-card">
                <MicroLabel tone="muted" as="p">Exception</MicroLabel>
                <p className="sty-line">
                  {facts.climate.exceptions.map(e => e.name + ' (' + (e.medianPct > 0 ? '+' : '') + fmt(e.medianPct, 1) + ' %' + (e.nModels ? ', ' + e.nModels + ' modèles seulement' : '') + ')').join(', ')}.
                </p>
              </article>
            )}
          </div>
        )}
      </Section>

      {/* ---------- 03 Où sont les barrages ---------- */}
      <Section
        ctx={ctx}
        id="barrages"
        side="left"
        tone="veil"
        bubbles
        title="Au pied de l’Atlas, les barrages."
        lead={dams.placedCount != null
          ? 'La carte compte ' + dams.placedCount + ' barrages localisés (OpenStreetMap, Wikidata) : chaque cercle est un barrage, vide quand le bulletin n’a pas de taux apparié.'
          : 'Chaque cercle sur le relief est un barrage.'}
        note="Relief de l’Atlas · barrages localisés"
      >
        <div className="sty-grid sty-grid--fx">
          <WaterFx mode="ripples" play={STORY_STOPS[active]?.id === 'barrages'} points={[[0.18, 0.42], [0.62, 0.58], [0.86, 0.3]]} />
          {dams.readCount != null && (
            <article className="sty-card">
              <p className="sty-figure"><Count value={dams.readCount} run={run('barrages')} reduced={reduced} /></p>
              <p className="sty-figure__label">
                barrages lus au bulletin{dams.readDate ? ' du ' + frDate(dams.readDate) : ''}
                {' '}<ProvenanceChip status="sourced" source="Bulletin du ministère, lu page par page" url={dams.readSource} date={frDate(dams.readDate)} note="Stock et taux lus visuellement ; sommes vérifiées par bassin." />
              </p>
            </article>
          )}
          {(dams.matchedCount ?? dams.locatedCount) != null && (
            <article className="sty-card">
              <p className="sty-figure sty-figure--sm"><Count value={dams.matchedCount ?? dams.locatedCount} run={run('barrages')} reduced={reduced} /></p>
              <p className="sty-figure__label">{dams.matchedCount != null ? 'dont placés sur la carte avec leur taux de remplissage' : 'barrages localisés sur la carte'}</p>
            </article>
          )}
        </div>
      </Section>

      {/* ---------- Comprendre l'eau (sensibilisation) : six étapes, Awareness.jsx ---------- */}
      <AwarenessChapter Section={Section} ctx={ctx} bulletinDate={bulletinDate} onEnter={() => enter()} onTry={() => goTo('essayez')} />

      {/* ---------- 04 En chiffres ---------- */}
      <Section
        ctx={ctx}
        id="chiffres"
        side="center"
        title="L’eau du Maroc, en chiffres."
        after={facts.figures.some(f => f.bulletin) && <MicroLabel tone="faint" as="p" className="sty-caveat">Stock, capacité et bassins : bulletin du {bulletinDate} · instantané daté, pas un relevé en direct</MicroLabel>}
      >
        <ul className={'sty-grid sty-tiles' + (run('chiffres') ? ' is-run' : '')}>
          {facts.figures.map((f, i) => (
            <li key={f.id} className="sty-card sty-tile" style={{ '--i': i }}>
              <p className="sty-figure sty-figure--tile">
                <Count value={f.value} decimals={f.decimals} run={run('chiffres')} reduced={reduced} />
                {f.unit && <span className="sty-unit">{f.unit}</span>}
              </p>
              <p className="sty-figure__label">{f.label} <ProvenanceChip {...(f.bulletin ? bulletinChip : { status: f.status, source: f.note, url: f.source })} /></p>
              <span className="sty-tile__water" aria-hidden="true"><Surface /></span>
            </li>
          ))}
        </ul>
      </Section>

      {/* ---------- 05 Essayez ---------- */}
      <Section ctx={ctx} id="essayez" side="right" title="À vous de jouer." lead="Une région, deux leviers : voyez la réserve bouger.">
        {ready && <MiniSim data={d} regionId={regionId} onRegion={pickRegion} onOpen={enter} />}
      </Section>

      {/* ---------- Pied de page : toujours atteignable en fin de défilement ---------- */}
      <footer className="sty-foot az-deep" ref={footRef} data-live="">
        <Wave side="top" className="sty-foot__wave" />
        <Bubbles className="sty-foot__bubbles" />
        <div className="sty-foot__inner">
          <div className="sty-foot__brand">
            <img src="/brand/anzar/logo-on-deep.svg" alt="Anzar" height="28" />
            <p className="sty-foot__tag">Observatoire de l’eau du Maroc · prototype</p>
          </div>
          <nav className="sty-foot__nav" aria-label="Pied de page">
            <MicroLabel tone="muted" as="p">Navigation</MicroLabel>
            <ul>
              <li><a href="#/" onClick={toTop}>Accueil</a></li>
              <li><a href={dashHash}>Tableau de bord</a></li>
              <li><a href="#/sources">Sources et méthode</a></li>
            </ul>
          </nav>
          <div className="sty-foot__legal">
            <MicroLabel tone="muted" as="p">Mentions</MicroLabel>
            <p>Anzar est un prototype indépendant issu d’un stage à la RAMSA. Ce n’est pas un portail officiel.</p>
            <p>Chiffres publics datés, pas un relevé en direct. Chaque jeu de données porte sa source, sa date et sa licence : voir <a href="#/sources">Sources et méthode</a>.</p>
            <p>Prévisions et climat : Open-Meteo (modélisé, usage non commercial).</p>
            <p>Les logos de la SRM Souss-Massa et des autres SRM sont des marques de leurs titulaires.</p>
          </div>
        </div>
        <p className="sty-foot__copy">© {year} Anzar · prototype indépendant</p>
      </footer>

      {/* Rail des chapitres sur une jauge d'eau qui se remplit avec la lecture (masqué sur le pied de page). */}
      <nav className={'sty-rail' + (active > 0 && !atEnd ? ' is-on' : '')} aria-label="Chapitres de la page d’accueil">
        <span className="sty-rail__tube" aria-hidden="true"><span ref={railFillRef} /></span>
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
