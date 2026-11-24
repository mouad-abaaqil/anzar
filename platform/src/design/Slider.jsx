import { useId } from 'react';

// Slider: native range input (keyboard and screen readers for free), visible value, min / max hints.
export default function Slider({ label, value, min = 0, max = 100, step = 1, onChange, format = v => v, minLabel, maxLabel, disabled }) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="az-slider">
      <div className="az-slider__head">
        <label htmlFor={id} className="az-slider__label">{label}</label>
        <output htmlFor={id} className="az-slider__value">{format(value)}</output>
      </div>
      <input
        id={id}
        type="range"
        className="az-slider__input"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={String(format(value))}
        style={{ '--az-fill': `${pct}%` }}
        onChange={e => onChange(Number(e.target.value))}
      />
      {(minLabel || maxLabel) && (
        <div className="az-slider__ends" aria-hidden="true"><span>{minLabel}</span><span>{maxLabel}</span></div>
      )}
    </div>
  );
}
