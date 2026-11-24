// Motifs d'eau d'Anzar : pluie et ondulations en canvas (une rafale courte, jamais en boucle), jauge dont le
// niveau monte une fois, vague de bord de section. Sans librairie.
// Budget : rien ne tourne au repos (≤ 2 % CPU) ; 30 images/s au plus pendant une rafale de ~3 s ; densité de
// pixels plafonnée à 1,5 ; arrêt si l'onglet est caché ou le canvas hors écran ; rien sous prefers-reduced-motion.
// Couleur : variable --az-water lue sur l'élément (remappée par .az-deep), donc aucune couleur écrite ici.
import { useEffect, useRef, useState } from 'react';
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

const FRAME_MS = 1000 / 30;
const BURST_MS = { rain: 3000, ripples: 2600 };
const rand = (a, b) => a + Math.random() * (b - a);

function makeRain(w, h) {
  const n = Math.round(Math.min(70, Math.max(24, (w * h) / 9000)));
  return Array.from({ length: n }, () => ({
    x: rand(0, w * 1.1), y: rand(-h * 0.5, -10), len: rand(8, 16), v: rand(0.45, 0.75),
    t0: rand(0, 1300), stop: rand(h * 0.35, h * 0.98), hit: -1,
  }));
}

/**
 * Rafale d'eau dans un canvas plein cadre (parent positionné). play : true pour lancer (front montant) ;
 * replayKey : change pour relancer. mode 'rain' (gouttes qui tombent et font un rond) ou 'ripples'
 * (anneaux concentriques autour de points en fractions [x, y]).
 */
export default function WaterFx({ mode = 'rain', play = true, replayKey = 0, points = [[0.3, 0.6], [0.7, 0.4]], className = '' }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const cv = ref.current;
    if (!cv || reduced || !play) return undefined;
    const ctx = cv.getContext?.('2d');
    if (!ctx) return undefined;
    let raf = 0, last = 0, start = 0, elapsedBefore = 0, running = true, visible = true;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    let w = 0, h = 0, drops = [];
    const size = () => {
      const r = cv.getBoundingClientRect();
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    if (mode === 'rain') drops = makeRain(w, h);
    const color = getComputedStyle(cv).getPropertyValue('--az-water').trim() || 'currentColor';
    const total = BURST_MS[mode] || 2600;

    const draw = t => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      if (mode === 'rain') {
        for (const d of drops) {
          const dt = t - d.t0;
          if (dt < 0) continue;
          if (d.hit < 0) {
            const y = d.y + dt * d.v;
            if (y >= d.stop) d.hit = t;
            else {
              ctx.globalAlpha = 0.5;
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.moveTo(d.x - (y - d.y) * 0.12, y);
              ctx.lineTo(d.x - (y - d.y) * 0.12 - d.len * 0.12, y - d.len);
              ctx.stroke();
              continue;
            }
          }
          const k = (t - d.hit) / 700;
          if (k > 1) continue;
          const x = d.x - (d.stop - d.y) * 0.12;
          ctx.globalAlpha = 0.45 * (1 - k);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(x, d.stop, 2 + k * 14, 1 + k * 4, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        points.forEach(([fx, fy], i) => {
          for (let ring = 0; ring < 3; ring++) {
            const k = (t - i * 260 - ring * 420) / 1500;
            if (k < 0 || k > 1) continue;
            const r = 6 + k * Math.min(140, w * 0.22);
            ctx.globalAlpha = 0.5 * (1 - k);
            ctx.lineWidth = 1.4 * (1 - k) + 0.4;
            ctx.beginPath();
            ctx.ellipse(fx * w, fy * h, r, r * 0.42, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        });
      }
      ctx.globalAlpha = 1;
    };

    const tick = now => {
      raf = 0;
      if (!running || !visible || document.hidden) return;
      if (!start) start = now;
      if (now - last >= FRAME_MS) {
        last = now;
        const t = elapsedBefore + (now - start);
        if (t > total) { ctx.clearRect(0, 0, w, h); running = false; return; }
        draw(t);
      }
      raf = requestAnimationFrame(tick);
    };
    const pause = () => { if (start) { elapsedBefore += performance.now() - start; start = 0; } cancelAnimationFrame(raf); raf = 0; };
    const resume = () => { if (running && visible && !document.hidden && !raf) raf = requestAnimationFrame(tick); };
    const onVis = () => (document.hidden ? pause() : resume());
    document.addEventListener('visibilitychange', onVis);
    let io = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) resume(); else pause(); });
      io.observe(cv);
    }
    resume();
    return () => { running = false; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); io?.disconnect(); };
  }, [mode, play, replayKey, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  if (reduced) return null;
  return <canvas ref={ref} className={'wfx ' + className} aria-hidden="true" />;
}

/**
 * Jauge « réservoir » : le niveau monte une fois jusqu'à pct (0-100) quand run devient vrai.
 * ghostPct : trait pointillé de comparaison (ex. même jour l'an dernier). Le niveau est linéaire (honnête) :
 * la forme est un réservoir droit, pas une goutte, pour que la hauteur se lise comme un pourcentage.
 */
export function LevelGauge({ pct, ghostPct = null, ghostLabel = '', run = true, label = '' }) {
  const p = Math.max(0, Math.min(100, pct || 0));
  const g = ghostPct == null ? null : Math.max(0, Math.min(100, ghostPct));
  return (
    <div className={'wfx-gauge' + (run ? ' is-run' : '')} style={{ '--wfx-level': p / 100, '--wfx-ghost': g == null ? 0 : g / 100 }} role="img" aria-label={label}>
      <div className="wfx-gauge__tank">
        <div className="wfx-gauge__water">
          <svg className="wfx-gauge__surface" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 6 Q15 0 30 6 T60 6 T90 6 T120 6 V12 H0Z" fill="currentColor" />
          </svg>
        </div>
        {[25, 50, 75].map(t => <span key={t} className="wfx-gauge__tick" style={{ bottom: t + '%' }} aria-hidden="true" />)}
        {g != null && <span className="wfx-gauge__ghost" aria-hidden="true" />}
      </div>
      {g != null && ghostLabel && <span className="wfx-gauge__legend" aria-hidden="true">{ghostLabel}</span>}
    </div>
  );
}

/** Vague de bord (SVG, currentColor). side 'top' | 'bottom' | 'right'. */
export function Wave({ side = 'bottom', className = '' }) {
  if (side === 'right') {
    return (
      <svg className={'wfx-wave wfx-wave--right ' + className} viewBox="0 0 48 800" preserveAspectRatio="none" aria-hidden="true">
        <path fill="currentColor" d="M0 0 H22 C42 70 6 130 24 200 C42 270 8 330 26 400 C44 470 6 530 24 600 C42 670 10 730 24 800 H0Z" />
      </svg>
    );
  }
  return (
    <svg className={'wfx-wave wfx-wave--' + side + ' ' + className} viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden="true">
      <path fill="currentColor" d="M0 48 V22 C180 4 360 4 540 20 C720 36 900 40 1080 24 C1260 8 1350 10 1440 18 V48Z" />
    </svg>
  );
}
