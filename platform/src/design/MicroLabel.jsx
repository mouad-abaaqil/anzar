// Monospace uppercase micro-label: "BARRAGES · 23 NOV 2026". Write it in normal case; CSS uppercases it.
export default function MicroLabel({ as: Tag = 'span', tone = 'muted', children, className = '', ...rest }) {
  return <Tag className={`az-micro az-micro--${tone} ${className}`} {...rest}>{children}</Tag>;
}
