// Button: primary (SRM yellow, the call to action), accent (SRM blue), secondary (hairline), ghost (text). Always >= 44 px tall.
export default function Button({ variant = 'primary', size = 'md', icon, children, className = '', type = 'button', ...rest }) {
  return (
    <button type={type} className={`az-btn az-btn--${variant} az-btn--${size} ${icon && !children ? 'az-btn--icon' : ''} ${className}`} {...rest}>
      {icon && <span className="az-btn__icon" aria-hidden="true">{icon}</span>}
      {children && <span>{children}</span>}
    </button>
  );
}
