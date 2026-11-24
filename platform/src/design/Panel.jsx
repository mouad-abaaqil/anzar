import MicroLabel from './MicroLabel.jsx';

// Panel: hairline box with an optional micro-label, title and actions. One idea per panel.
export default function Panel({ label, title, actions, children, as: Tag = 'section', className = '', ...rest }) {
  return (
    <Tag className={`az-panel ${className}`} {...rest}>
      {(label || title || actions) && (
        <header className="az-panel__head">
          <div>
            {label && <MicroLabel>{label}</MicroLabel>}
            {title && <h2 className="az-panel__title">{title}</h2>}
          </div>
          {actions && <div className="az-panel__actions">{actions}</div>}
        </header>
      )}
      {children}
    </Tag>
  );
}
