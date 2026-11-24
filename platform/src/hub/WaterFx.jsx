// Motifs d'eau d'Anzar (décoratifs, aria-hidden) : pluie fine dont chaque goutte fait une ondulation à la surface,
// ondulations concentriques, surface d'eau en couches (vagues SVG), bulles, jauge « réservoir », vague de bord.
// Budget : un seul rAF partagé (water/clock.js, 30 images/s max), rien hors écran ni onglet caché, arrêt ~10 s après le
// dernier geste (rien ne bouge au repos), rien du tout sous prefers-reduced-motion. Boucles CSS : transform/opacity
// seulement. Couleurs : variables --az-* lues sur l'élément (remappées par .az-deep) ; aucune couleur écrite ici.
import { useEffect, useRef, useState } from 'react';
import { awake, onFrame, watchActivity } from './water/clock.js';
import './WaterFx.css';

const RM = '(prefers-reduced-motion: reduce)';
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(RM).matches);
  useEffect(() => {
    const m = window.matchMedia?.(RM);
    if (!m) return undefined;
    const on = () => setReduced(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

const rand = (a, b) => a + Math.random() * (b - a);
const RIPPLE_MS = 900;

/**
 * Canvas plein cadre (parent positionné).
 * mode 'rain' : pluie continue tant que la zone est visible et l'utilisateur actif ; chaque goutte tombe jusqu'à la
 *   surface (bande [surface, 1] de la hauteur) et y dessine une ondulation.
 * mode 'ripples' : une rafale d'anneaux autour de points [x, y] (fractions) quand play passe à vrai.
 */
export default function WaterFx({ mode = 'rain', play = true, surface = 0.86, points = [[0.3, 0.6], [0.7, 0.4]], className = '' }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const cv = ref.current;
    if (!cv || reduced || !play) return undefined;
    const ctx = cv.getContext?.('2d');
    if (!ctx) return undefined;
    let w = 1, h = 1, visible = true, unsub = null, drops = [], rings = [], t0 = 0, draining = false;
    const size = () => {
      const r = cv.getBoundingClientRect();
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      cv.width = Math.round(w); cv.height = Math.round(h); // densité 1 : traits fins, coût minimal
    };
    const color = () => getComputedStyle(cv).getPropertyValue('--az-water').trim() || 'currentColor';
    let ink = 'currentColor';
    const newDrop = (t, first) => ({
      x: rand(-0.05 * w, 1.05 * w), y: first ? rand(-h, 0) : rand(-0.25 * h, -12), v: rand(0.5, 0.85), len: rand(10, 18),
      stop: h * rand(surface, Math.min(0.995, surface + (1 - surface) * 0.9)), born: t,
    });
    const seed = t => {
      const n = Math.round(Math.min(48, Math.max(16, (w * h) / 26000)));
      drops = Array.from({ length: n }, () => newDrop(t, true));
    };

    const draw = t => {
      if (!t0) t0 = t;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = ink;
      ctx.lineCap = 'round';
      if (mode === 'rain') {
        const live = awake() && !draining;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let i = 0; i < drops.length; i++) {
          const d = drops[i];
          const y = d.y + (t - d.born) * d.v;
          if (y >= d.stop) {
            rings.push({ x: d.x - (d.stop - d.y) * 0.1, y: d.stop, t });
            drops[i] = live ? newDrop(t, false) : null;
            continue;
          }
          const x = d.x - (y - d.y) * 0.1;
          ctx.moveTo(x, y);
          ctx.lineTo(x + d.len * 0.1, y - d.len);
        }
        ctx.stroke();
        drops = drops.filter(Boolean);
      }
      // ondulations (pluie) ou anneaux (rafale)
      if (mode === 'ripples') {
        const k0 = t - t0;
        points.forEach(([fx, fy], i) => {
          for (let ring = 0; ring < 3; ring++) {
            const k = (k0 - i * 260 - ring * 420) / 1500;
            if (k < 0 || k > 1) continue;
            const r = 6 + k * Math.min(140, w * 0.22);
            ctx.globalAlpha = 0.5 * (1 - k);
            ctx.lineWidth = 1.4 * (1 - k) + 0.4;
            ctx.beginPath();
            ctx.ellipse(fx * w, fy * h, r, r * 0.42, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        });
        if (k0 > 2600) stop(true);
      } else {
        rings = rings.filter(r => t - r.t < RIPPLE_MS);
        ctx.lineWidth = 1;
        for (const r of rings) {
          const k = (t - r.t) / RIPPLE_MS;
          ctx.globalAlpha = 0.5 * (1 - k);
          ctx.beginPath();
          ctx.ellipse(r.x, r.y, 2 + k * 16, 0.8 + k * 4.2, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (!drops.length && !rings.length) stop(true);
      }
      ctx.globalAlpha = 1;
    };
    function stop(clear) {
      unsub?.(); unsub = null;
      if (clear) ctx.clearRect(0, 0, w, h);
    }
    const run = () => {
      if (unsub || !visible || document.hidden) return;
      if (mode === 'rain' && !awake()) return;
      draining = false;
      size();
      ink = color();
      const now = performance.now();
      if (mode === 'rain' && !drops.length) seed(now);
      unsub = onFrame(draw);
    };
    // Inactivité : la pluie s'arrête doucement (les gouttes en vol finissent leur chute) ; reprise au premier geste.
    const offWake = mode === 'rain' ? watchActivity(v => { if (v) run(); else draining = true; }) : null;
    let io = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) run(); else { stop(true); drops = []; rings = []; } });
      io.observe(cv);
    }
    run();
    return () => { stop(false); offWake?.(); io?.disconnect(); };
  }, [mode, play, reduced, surface]); // eslint-disable-line react-hooks/exhaustive-deps

  if (reduced) return null;
  return <canvas ref={ref} className={'wfx ' + className} aria-hidden="true" />;
}

/** Surface d'eau en couches (vagues SVG qui glissent, boucle CSS gelée au repos). Décor, aria-hidden. */
const SEA_PATH = 'M0 40 C120 22 240 22 360 40 C480 58 600 58 720 40 C840 22 960 22 1080 40 C1200 58 1320 58 1440 40 C1560 22 1680 22 1800 40 C1920 58 2040 58 2160 40 C2280 22 2400 22 2520 40 C2640 58 2760 58 2880 40 V120 H0Z';
export function Sea({ className = '' }) {
  return (
    <div className={'wx-sea ' + className} aria-hidden="true">
      {[0, 1, 2].map(i => (
        <svg key={i} className={'wx-sea__layer wx-sea__layer--' + i + ' wx-loop'} viewBox="0 0 2880 120" preserveAspectRatio="none">
          <path d={SEA_PATH} fill="currentColor" />
        </svg>
      ))}
    </div>
  );
}

/** Bulles qui montent lentement (sections profondes). Décor, aria-hidden. */
const BUBBLES = [[8, 0, 13, 6], [17, 3.5, 11, 4], [29, 7, 15, 8], [41, 1.5, 12, 5], [55, 5, 14, 7], [66, 9, 12, 4], [74, 2.5, 16, 9], [86, 6, 13, 5], [93, 10, 11, 6]];
export function Bubbles({ className = '' }) {
  return (
    <div className={'wx-bubbles ' + className} aria-hidden="true">
      {BUBBLES.map(([x, delay, dur, size], i) => (
        <span key={i} className="wx-bubble wx-loop" style={{ left: x + '%', animationDelay: delay + 's', animationDuration: dur + 's', '--s': size + 'px' }} />
      ))}
    </div>
  );
}

/** Ligne d'eau animée entre deux sections. Décor, aria-hidden. */
export function WaterLine({ className = '' }) {
  return (
    <div className={'wx-line ' + className} aria-hidden="true">
      <svg className="wx-line__svg wx-loop" viewBox="0 0 2880 24" preserveAspectRatio="none">
        <path d="M0 12 C180 2 360 2 540 12 C720 22 900 22 1080 12 C1260 2 1440 2 1620 12 C1800 22 1980 22 2160 12 C2340 2 2520 2 2700 12 C2790 17 2850 17 2880 12" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

/** Surface ondulée d'un réservoir (posée sur la ligne de niveau, la boucle glisse horizontalement). */
export function Surface({ className = '' }) {
  return (
    <svg className={'wx-surface wx-loop ' + className} viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 6 Q25 0 50 6 T100 6 T150 6 T200 6 V12 H0Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Jauge « réservoir » : le niveau monte une fois jusqu'à pct (0-100) quand run devient vrai, la surface ondule.
 * ghostPct : trait pointillé de comparaison (ex. même jour l'an dernier). Le niveau est linéaire (honnête) :
 * la forme est un réservoir droit, pas une goutte, pour que la hauteur se lise comme un pourcentage.
 */
export function LevelGauge({ pct, ghostPct = null, ghostLabel = '', run = true, label = '' }) {
  const p = Math.max(0, Math.min(100, pct || 0));
  const g = ghostPct == null ? null : Math.max(0, Math.min(100, ghostPct));
  return (
    <div className={'wfx-gauge' + (run ? ' is-run' : '')} style={{ '--wfx-level': p / 100, '--wfx-ghost': g == null ? 0 : g / 100 }} role="img" aria-label={label}>
      <div className="wfx-gauge__tank">
        <div className="wfx-gauge__water"><Surface className="wfx-gauge__surface" /></div>
        {[25, 50, 75].map(t => <span key={t} className="wfx-gauge__tick" style={{ bottom: t + '%' }} aria-hidden="true" />)}
        {g != null && <span className="wfx-gauge__ghost" aria-hidden="true" />}
      </div>
      {g != null && ghostLabel && <span className="wfx-gauge__legend" aria-hidden="true">{ghostLabel}</span>}
    </div>
  );
}

/** Vague de bord (SVG, currentColor). side 'top' | 'bottom'. */
export function Wave({ side = 'bottom', className = '' }) {
  return (
    <svg className={'wfx-wave wfx-wave--' + side + ' ' + className} viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden="true">
      <path fill="currentColor" d="M0 48 V22 C180 4 360 4 540 20 C720 36 900 40 1080 24 C1260 8 1350 10 1440 18 V48Z" />
    </svg>
  );
}

/** Ondulation au toucher / clic sur les boutons d'un conteneur (délégation, une seule écoute). */
export function useTouchRipples(rootRef, enabled) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled) return undefined;
    const on = e => {
      const btn = e.target.closest?.('.az-btn, .wx-ripple-host');
      if (!btn || !root.contains(btn) || btn.disabled) return;
      const r = btn.getBoundingClientRect();
      const s = document.createElement('span');
      const d = Math.max(r.width, r.height) * 2;
      s.className = 'wx-ripple';
      s.setAttribute('aria-hidden', 'true');
      s.style.width = s.style.height = d + 'px';
      s.style.left = (e.clientX - r.left - d / 2) + 'px';
      s.style.top = (e.clientY - r.top - d / 2) + 'px';
      btn.appendChild(s);
      s.addEventListener('animationend', () => s.remove(), { once: true });
      setTimeout(() => s.remove(), 900);
    };
    root.addEventListener('pointerdown', on, { passive: true });
    return () => root.removeEventListener('pointerdown', on);
  }, [rootRef, enabled]);
}
