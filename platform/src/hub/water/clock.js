// Horloge d'eau partagée par toutes les animations décoratives de l'accueil (pluie, ondulations).
// - UN SEUL requestAnimationFrame pour toute la page, plafonné à 30 images/s, arrêté quand plus personne n'écoute
//   ou quand l'onglet est caché ;
// - « éveil » : les boucles d'ambiance (vagues, bulles, pluie) ne tournent que pendant ~10 s après le dernier geste
//   (défilement, pointeur, clavier, toucher), puis s'arrêtent : rien ne bouge au repos (budget CPU ≤ 2 %, WCAG 2.2.2).
// Les boucles CSS (transform/opacity, compositeur) sont gelées par la classe .is-awake absente ; le canvas de pluie
// lit awake() à chaque image. Aucune couleur ici.
const FRAME_MS = 1000 / 30;
const IDLE_MS = 10000;
const subs = new Set();
const wakeSubs = new Set();
let raf = 0;
let last = 0;
let awakeFlag = true;
let lastActive = 0;
let idleTimer = 0;
const hasDoc = typeof document !== 'undefined';

function loop(t) {
  raf = 0;
  if (!subs.size || (hasDoc && document.hidden)) return;
  if (t - last >= FRAME_MS) {
    last = t;
    subs.forEach(fn => { try { fn(t); } catch { /* une animation fautive n'arrête pas les autres */ } });
  }
  raf = requestAnimationFrame(loop);
}
function start() {
  if (!raf && subs.size && !(hasDoc && document.hidden) && typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(loop);
}
if (hasDoc) document.addEventListener('visibilitychange', start);

/** Abonne fn(t) à l'horloge partagée (≤ 30 images/s). Renvoie la fonction de désabonnement. */
export function onFrame(fn) {
  subs.add(fn);
  start();
  return () => { subs.delete(fn); if (!subs.size && raf) { cancelAnimationFrame(raf); raf = 0; } };
}

/** Vrai pendant les ~10 s qui suivent le dernier geste. */
export const awake = () => awakeFlag;

function setAwake(v) {
  if (v === awakeFlag) return;
  awakeFlag = v;
  wakeSubs.forEach(fn => fn(v));
}
function check() {
  idleTimer = 0;
  const left = IDLE_MS - (performance.now() - lastActive);
  if (left <= 0) setAwake(false);
  else idleTimer = setTimeout(check, Math.max(500, left));
}
function poke() {
  lastActive = performance.now();
  setAwake(true);
  if (!idleTimer) idleTimer = setTimeout(check, IDLE_MS);
}

const EVENTS = ['scroll', 'wheel', 'pointerdown', 'pointermove', 'keydown', 'touchstart'];
let watchers = 0;
/** Suit l'activité de l'utilisateur ; fn(awake) à chaque changement. Renvoie la fonction d'arrêt. */
export function watchActivity(fn) {
  wakeSubs.add(fn);
  if (watchers++ === 0 && hasDoc) {
    EVENTS.forEach(e => window.addEventListener(e, poke, { passive: true }));
    poke();
  }
  fn(awakeFlag);
  return () => {
    wakeSubs.delete(fn);
    if (--watchers === 0 && hasDoc) {
      EVENTS.forEach(e => window.removeEventListener(e, poke));
      clearTimeout(idleTimer); idleTimer = 0;
    }
  };
}
