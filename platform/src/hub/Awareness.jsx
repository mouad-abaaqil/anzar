// Chapitre « Comprendre l'eau » de l'accueil (sensibilisation) : six étapes posées sur la carte 3D, dans le langage
// visuel de Story (légendes « verre » translucides, eau qui monte une fois, boucles gelées au repos et sous
// reduced-motion). Chaque chiffre vient de public/data/awareness.json (faits vérifiés ou secondaires, jamais « non
// vérifiés ») via awareness.js ; chaque chiffre porte sa pastille de provenance et sa date. Recherche :
// docs/research/14-video-secheresse.md. Les sections sont rendues tout de suite (Story observe ses sections au montage) ;
// leur contenu chiffré arrive quand le JSON est chargé, et n'apparaît pas s'il manque.
// Exports : défaut AwarenessChapter (inséré dans Story) ; AwarenessSources (rubrique du tiroir Sources de HubApp).
import { useEffect, useState } from 'react';
import { Button, MicroLabel, ProvenanceChip } from '../design';
import { Surface } from './WaterFx.jsx';
import { awarenessModel, chipFor, fmt, frDate, loadAwareness, sourcesList, statusLabel } from './awareness.js';
import './Awareness.css';

function useAwarenessJson() {
  const [json, setJson] = useState(undefined);
  useEffect(() => {
    let alive = true;
    loadAwareness().then(j => alive && setJson(j || null));
    return () => { alive = false; };
  }, []);
  return json;
}

const Chip = ({ fact, note }) => (fact ? <ProvenanceChip {...chipFor(fact, note)} /> : null);
const SecTag = ({ fact }) => (fact?.status === 'secondaire' ? <span className="aw-sec">source secondaire</span> : null);
const Gm3 = v => fmt(v, Number.isInteger(v) ? 0 : Number.isInteger(Math.round(v * 100) / 10) ? 1 : 2);

/** (a) Réservoir : dotation actuelle contre seuil de pénurie et niveau de 1960 (hauteurs linéaires). */
function RareTank({ m, run }) {
  const p = v => v / m.max;
  const label = fmt(m.now) + ' m³ par habitant et par an en ' + m.nowYear + ', sous le seuil de pénurie de ' + fmt(m.threshold) + ' ; ' + fmt(m.y1960) + ' en 1960';
  return (
    <div className={'aw-rare' + (run ? ' is-run' : '')} style={{ '--now': p(m.now) }}>
      <div className="aw-tank" role="img" aria-label={label}>
        <div className="aw-tank__water"><Surface /></div>
        <span className="aw-tank__mark aw-tank__mark--seuil" style={{ '--at': p(m.threshold) }} aria-hidden="true" />
        <span className="aw-tank__mark" style={{ '--at': p(m.y1960) }} aria-hidden="true" />
      </div>
      <ul className="aw-rare__marks" aria-hidden="true">
        <li style={{ '--at': p(m.y1960) }}><b>{fmt(m.y1960)}</b> en 1960</li>
        <li className="is-seuil" style={{ '--at': p(m.threshold) }}><b>{fmt(m.threshold)}</b> seuil de pénurie</li>
        <li className="is-now" style={{ '--at': p(m.now) }}><b>{fmt(m.now)}</b> en {m.nowYear}</li>
      </ul>
    </div>
  );
}

/** (b) Six colonnes d'eau (apports par année hydrologique) contre la ligne de la moyenne de long terme. */
function InflowCols({ m, run }) {
  const label = 'Apports aux barrages, en milliards de m³ : ' + m.rows.map(r => r.label + ' ' + Gm3(r.value)).join(', ') + ' ; moyenne 1945-2023 : ' + Gm3(m.mean);
  return (
    <div className={'aw-cols' + (run ? ' is-run' : '')} role="img" aria-label={label}>
      <div className="aw-cols__plot" aria-hidden="true">
        <span className="aw-cols__mean" style={{ '--h': m.mean / m.max }}><span>moyenne 1945-2023 · {Gm3(m.mean)}</span></span>
        {m.rows.map((r, i) => (
          <div key={r.label} className="aw-col" style={{ '--h': r.value / m.max, '--i': i }}>
            <span className="aw-col__tube"><span className="aw-col__water"><Surface /></span><span className="aw-col__val">{Gm3(r.value)}</span></span>
          </div>
        ))}
      </div>
      <div className="aw-cols__years" aria-hidden="true">
        {m.rows.map(r => <span key={r.label}>{r.from}<br />{r.to}</span>)}
      </div>
    </div>
  );
}

/** (c) Coupe d'une retenue : vase qui monte au fond, évaporation en surface, barrage à droite. Décor (aria-hidden). */
function DamSchema({ run }) {
  return (
    <svg className={'aw-dam' + (run ? ' is-run' : '')} viewBox="0 0 320 150" aria-hidden="true" focusable="false">
      <path className="aw-dam__water" d="M14 58 L262 58 L262 132 C200 138 120 138 60 120 C38 108 22 84 14 58Z" />
      <path className="aw-dam__silt" d="M60 120 C120 138 200 138 262 132 L262 112 C200 120 130 120 82 108 Z" />
      <path className="aw-dam__bank" d="M4 40 C14 70 30 100 60 120 C120 138 200 138 262 132" />
      <path className="aw-dam__wall" d="M258 30 L276 30 L300 138 L258 138 Z" />
      <path className="aw-dam__surface" d="M14 58 L258 58" />
      {[70, 140, 210].map((x, i) => (
        <path key={x} className="aw-dam__evap wx-loop" style={{ animationDelay: i * 0.9 + 's' }} d={'M' + x + ' 50 q4 -6 0 -12 q-4 -6 0 -12'} />
      ))}
    </svg>
  );
}

/** (d) Nappes : prélèvements contre renouvellement ; l'excédent déborde (goutte animée, gelée au repos). */
function AquiferBars({ m, run }) {
  const max = m.take * 1.05;
  return (
    <div className={'aw-aq' + (run ? ' is-run' : '')} role="img" aria-label={'Prélèvements dans les nappes : environ ' + Gm3(m.take) + ' milliards de m³ par an ; renouvellement : environ ' + fmt(m.renew, 0) + ' ; excédent ' + m.pct + ' %'}>
      <div className="aw-aq__row" aria-hidden="true">
        <span className="aw-aq__name">Prélèvements</span>
        <span className="aw-aq__bar" style={{ '--w': m.take / max, '--r': m.renew / m.take }}>
          <span className="aw-aq__fill" /><span className="aw-aq__over" /><span className="aw-aq__drip wx-loop" />
        </span>
        <span className="aw-aq__val">≈ {Gm3(m.take)} Gm³</span>
      </div>
      <div className="aw-aq__row" aria-hidden="true">
        <span className="aw-aq__name">Renouvellement</span>
        <span className="aw-aq__bar aw-aq__bar--renew" style={{ '--w': m.renew / max, '--r': 1 }}><span className="aw-aq__fill" /></span>
        <span className="aw-aq__val">≈ {fmt(m.renew, 0)} Gm³</span>
      </div>
    </div>
  );
}

const SOL_LABEL = { transfert: 'Transfert entre bassins', dessalement: 'Dessalement', reutilisation: 'Réutilisation', reseaux: 'Réseaux d’eau potable' };

function SolutionCard({ s }) {
  let figure, unit, label, limit;
  if (s.id === 'transfert') {
    figure = fmt(s.value); unit = 'Mm³';
    label = <>Sebou → Bouregreg, du {frDate(s.from)} au {frDate(s.to)} <Chip fact={s.fact} note="Volume transféré sur la période, pas une capacité annuelle." /></>;
    limit = 'Il déplace l’eau d’un bassin à l’autre, il n’en crée pas.';
  } else if (s.id === 'dessalement') {
    figure = fmt(s.value); unit = 'Mm³/an';
    label = <>{s.stations != null ? s.stations + ' stations, ' : ''}capacité début 2024 <Chip fact={s.fact} note="Capacité installée, pas une production mesurée." /></>;
    limit = s.price
      ? <>Plus cher : à Chtouka, ≈ {fmt(s.price.desal, 2)} DH/m³ facturés contre {fmt(s.price.dam, 2)} pour l’eau de barrage <SecTag fact={s.price.fact} /> <Chip fact={s.price.fact} /></>
      : 'Coût et énergie plus élevés que l’eau de barrage.';
  } else if (s.id === 'reutilisation') {
    figure = fmt(s.value); unit = 'Mm³/an';
    label = <>d’eaux usées épurées réutilisées fin 2022 (golfs, espaces verts) <Chip fact={s.fact} /></>;
    limit = s.factor ? 'Cible fin 2027 : environ ' + (s.factor === 3 ? 'trois' : s.factor) + ' fois plus.' : null;
  } else {
    figure = fmt(s.value); unit = '%';
    label = <>de rendement des réseaux (début 2024) <Chip fact={s.fact} /></>;
    limit = s.target2030 != null ? 'Le reste se perd en route ; objectif : ' + s.target2030 + ' % en 2030.' : null;
  }
  return (
    <li className="sty-card aw-sol">
      <MicroLabel tone="muted" as="p">{SOL_LABEL[s.id]}</MicroLabel>
      <p className="sty-figure sty-figure--sm"><span className="sty-num">{figure}</span><span className="sty-unit">{unit}</span></p>
      <p className="sty-figure__label">{label}</p>
      {limit && <p className="aw-sol__limit">{limit}</p>}
    </li>
  );
}

/**
 * Chapitre complet. Props : Section (composant de section de Story), ctx (contexte de Story), bulletinDate (date du
 * bulletin des barrages, pour rappeler que les chiffres 2017-2024 ne sont pas la situation du jour), onEnter (ouvre le
 * tableau de bord), onTry (défile jusqu'au simulateur).
 */
export default function AwarenessChapter({ Section, ctx, bulletinDate, onEnter, onTry }) {
  const json = useAwarenessJson();
  const m = json ? awarenessModel(json) : null;
  const run = id => ctx.run(id);
  const missing = json === null ? <MicroLabel tone="muted" as="p">Chiffres de ce chapitre indisponibles pour le moment.</MicroLabel> : null;
  const { rare, irregular: irr, dam, nappes, solutions, agir } = m || {};

  return (
    <div id="comprendre" className="aw">
      {/* (a) Moins de 1 000 m³ par habitant */}
      <Section
        ctx={ctx}
        id="comprendre-rare"
        side="right"
        title={rare ? 'Moins de ' + fmt(rare.threshold) + ' m³ par habitant.' : 'Une eau rare.'}
        lead="Le Maroc vit sous le seuil de pénurie d’eau. Une moyenne de long terme, pas un volume livré à chacun."
        note="Relief de l’Atlas · d’où vient l’eau des barrages"
      >
        {rare ? (
          <article className="sty-card aw-card--row">
            <RareTank m={rare} run={run('comprendre-rare')} />
            <div className="aw-text">
              <p className="sty-figure"><span className="sty-num">{fmt(rare.now)}</span><span className="sty-unit">m³</span></p>
              <p className="sty-figure__label">d’eau renouvelable par habitant et par an ({rare.nowYear}) <Chip fact={rare.fact} /></p>
            </div>
          </article>
        ) : missing}
      </Section>

      {/* (b) Une bonne année ne referme pas le déficit */}
      <Section
        ctx={ctx}
        id="comprendre-irreguliere"
        side="left"
        title="Une bonne année ne referme pas le déficit."
        lead={irr && irr.ratio ? 'L’eau arrive de façon irrégulière : entre ' + irr.hi.label + ' et ' + irr.lo.label + ', les apports aux barrages ont été divisés par plus de ' + ['', '', 'deux', 'trois', 'quatre', 'cinq', 'six'][Math.floor(irr.ratio)] + '.' : 'L’eau arrive de façon irrégulière.'}
        after={irr && <MicroLabel tone="faint" as="p" className="sty-caveat">Apports par année hydrologique (sept. à août), {irr.first} à {irr.last}{bulletinDate ? ' · ce ne sont pas les chiffres du jour : voir le bulletin du ' + bulletinDate + ' plus haut' : ''}</MicroLabel>}
      >
        {irr ? (
          <>
            <article className="sty-card">
              <MicroLabel tone="muted" as="p">Apports aux barrages · milliards de m³ <Chip fact={irr.fact} /> <Chip fact={irr.meanFact} /></MicroLabel>
              <InflowCols m={irr} run={run('comprendre-irreguliere')} />
            </article>
            {irr.gap && (
              <p className="sty-line">
                Écart entre offre et demande : <span className="sty-nowrap">{Gm3(irr.gap.now)} Gm³/an</span> aujourd’hui, jusqu’à <span className="sty-nowrap">{Gm3(irr.gap.y2050)} en 2050</span> sans les mesures du Plan national de l’eau. <b>Scénario, pas une prévision.</b> <Chip fact={irr.gap.fact} note="Scénario avec changement climatique et sans les interventions du Plan national de l’eau." />
              </p>
            )}
          </>
        ) : missing}
      </Section>

      {/* (c) Un barrage plein n'est pas un robinet ouvert */}
      <Section
        ctx={ctx}
        id="comprendre-barrage"
        side="bottom"
        title="Un barrage plein n’est pas un robinet ouvert."
        lead="La vase réduit la place, l’eau s’évapore, et en pénurie la loi sert d’abord l’eau potable."
        note="Barrage Bin el Ouidane (Béni Mellal-Khénifra) · un remplissage n’est pas un volume livrable"
        after={dam?.law && <MicroLabel tone="faint" as="p" className="sty-caveat">Loi 36-15 relative à l’eau{dam.law.article ? ', article ' + dam.law.article : ''} · schéma illustratif, pas à l’échelle</MicroLabel>}
      >
        {dam ? (
          <article className="sty-card aw-damcard">
            <DamSchema run={run('comprendre-barrage')} />
            <ul className="aw-legend">
              {dam.silt && <li><i className="aw-sw aw-sw--silt" aria-hidden="true" /><span>Vase : ≈ <b>{fmt(dam.silt.mt)} Mt</b> de sédiments par an, dont <b>{dam.silt.pct} %</b> restent dans les retenues <Chip fact={dam.silt.fact} note="Estimation et projection, pas une mesure." /></span></li>}
              {dam.evap && <li><i className="aw-sw aw-sw--evap" aria-hidden="true" /><span>Évaporation : <b>{fmt(dam.evap.mm3PerDay, 1)} Mm³ par jour</b> selon le ministère (périmètre non précisé) <Chip fact={dam.evap.fact} /></span></li>}
            </ul>
            {dam.law && (
              <ol className="aw-prio" aria-label="Ordre de priorité en cas de pénurie">
                <li><b>Eau potable d’abord</b> <Chip fact={dam.law.fact} /></li>
                <li>Besoins du cheptel pris en compte</li>
                <li>Irrigation selon la réserve restante {dam.plan && <Chip fact={dam.plan.fact} />}</li>
              </ol>
            )}
          </article>
        ) : missing}
      </Section>

      {/* (d) Sous nos pieds */}
      <Section
        ctx={ctx}
        id="comprendre-nappes"
        side="right"
        title="Sous nos pieds, on puise plus qu’il ne revient."
        lead="Les nappes souterraines comblent les années sèches, jusqu’à s’épuiser."
        note="Plaine du Souss (Souss-Massa) · nappes non représentées sur la carte"
        after={<MicroLabel tone="faint" as="p" className="sty-caveat">Les nappes ne sont pas modélisées dans Anzar : aucun chiffre de nappe sur la carte ni dans le tableau de bord.</MicroLabel>}
      >
        {nappes ? (
          <article className="sty-card">
            <p className="sty-figure"><span className="sty-num">+{nappes.pct}</span><span className="sty-unit">%</span></p>
            <p className="sty-figure__label">pompés au-delà du renouvellement, chaque année <Chip fact={nappes.fact} /></p>
            <AquiferBars m={nappes} run={run('comprendre-nappes')} />
            <p className="aw-small">Renouvellement = prélèvements moins l’excédent ({Gm3(nappes.excess)} Gm³) : calcul Anzar sur la même source.{' '}
              <ProvenanceChip status="derived" source={nappes.fact.sourceName} url={nappes.fact.sourceUrl} date={nappes.fact.period} note={nappes.potential ? 'À comparer au potentiel exploitable évalué par la DGH : ' + Gm3(nappes.potential.gm3) + ' milliards de m³ par an (' + nappes.potential.fact.period + ').' : ''} />
            </p>
          </article>
        ) : missing}
      </Section>

      {/* (e) Les solutions, et leurs limites */}
      <Section
        ctx={ctx}
        id="comprendre-solutions"
        side="center"
        title="Les solutions, et leurs limites."
        lead="Chaque levier aide, aucun ne suffit seul. Chiffres datés, pas la situation du jour."
        note="Bassins du Sebou et du Bouregreg (Kénitra, Rabat) · aucune conduite n’est tracée"
      >
        {solutions ? <ul className="sty-grid aw-sols">{solutions.map(s => <SolutionCard key={s.id} s={s} />)}</ul> : missing}
      </Section>

      {/* (f) Chacun peut agir, à l'échelle de l'enjeu */}
      <Section
        ctx={ctx}
        id="comprendre-agir"
        side="low"
        title="Chacun peut agir, à l’échelle de l’enjeu."
        after={<MicroLabel tone="faint" as="p" className="sty-caveat">Anzar montre des stocks de barrages datés et des scénarios ; ni relevé en direct, ni nappes, ni tracé de conduite.</MicroLabel>}
      >
        {agir ? (
          <>
            <ul className="aw-gestes">
              {agir.gestes && <li>Respecter les restrictions locales quand elles sont décidées : arrosage des espaces verts, lavage des rues, remplissage des piscines. <Chip fact={agir.gestes} note="Mesures prises selon les provinces ; elles ne s’appliquent pas forcément aujourd’hui." /></li>}
              {agir.gestes && <li>Signaler les fuites : leur recherche fait partie des mesures appliquées. <Chip fact={agir.gestes} /></li>}
            </ul>
            {agir.demand && (
              <p className="sty-line aw-honest">
                Mais l’agriculture pèse près des {agir.demand.tenths === 9 ? 'neuf dixièmes' : agir.demand.tenths + ' dixièmes'} de la demande : les gestes domestiques comptent, ils ne suffisent pas. <Chip fact={agir.demand.fact} />
                {agir.drip && <> Et le goutte-à-goutte n’a pas, à lui seul, fait baisser la consommation des exploitations. <Chip fact={agir.drip} /></>}
              </p>
            )}
          </>
        ) : missing}
        <div className="aw-cta">
          <Button variant="primary" size="lg" onClick={() => onEnter?.()}>Ouvrir le tableau de bord</Button>
          <Button variant="secondary" size="lg" onClick={() => onTry?.()}>Tester le simulateur</Button>
        </div>
      </Section>
    </div>
  );
}

/** Rubrique du tiroir Sources : chaque fait utilisé par le chapitre, avec source, lien, date de lecture et statut. */
export function AwarenessSources() {
  const json = useAwarenessJson();
  if (json === undefined) return null;
  const list = json ? sourcesList(json) : [];
  return (
    <section className="aw-src" aria-labelledby="aw-src-t">
      <h2 id="aw-src-t">Sensibilisation : sources des chiffres</h2>
      <p>Chiffres vérifiés par Anzar auprès des sources primaires ; inspiré des enquêtes de Mustapha Swinga (série « <bdi lang="ar">الجفاف في المغرب</bdi> ») dont la vidéo n’est pas une source officielle.</p>
      <p className="aw-src__small">Exception signalée : un chiffre marqué « source secondaire » vient de la presse et n’a pas été lu à la source primaire. Les documents ministériels marqués « copie hébergée par l’auteur de la vidéo » ont été lus dans ces copies.</p>
      {list.length ? (
        <ul className="aw-src__list">
          {list.map(f => (
            <li key={f.id}>
              <span className={'aw-src__status aw-src__status--' + f.status}>{statusLabel(f.status)}</span>
              <span className="aw-src__claim">{f.claimFr}</span>
              <a href={f.sourceUrl} target="_blank" rel="noreferrer">{f.sourceName}</a>
              <span className="aw-src__small">Période : {f.period} · lu le {frDate(f.readDate)}</span>
            </li>
          ))}
        </ul>
      ) : <p>Liste indisponible pour le moment.</p>}
    </section>
  );
}
