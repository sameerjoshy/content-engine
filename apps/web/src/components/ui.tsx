import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'danger';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`btn btn-${variant} ${className}`} {...props} />;
}

export function Card({
  className = '',
  selected = false,
  onClick,
  style,
  children,
}: {
  className?: string;
  selected?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const interactive = onClick ? ' card-clickable' : '';
  return (
    <div
      className={`card${interactive} ${selected ? ' card-selected' : ''} ${className}`}
      onClick={onClick}
      style={style}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement> & { valid?: boolean }) {
  const { valid, ...rest } = props;
  return (
    <div className="input-valid-wrap">
      <input className={`input ${valid ? '' : 'invalid'}`} {...rest} />
      {valid ? <span className="check">✓</span> : null}
    </div>
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="input" {...props} />;
}

export function Spinner() {
  return <span className="spinner" aria-label="Loading" />;
}

export function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2>{title}</h2>
        {subtitle ? <p className="sub">{subtitle}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function QualityBadge({ score }: { score: number | null }) {
  let label = 'Not reviewed';
  let cls = 'quality-none';
  if (score != null) {
    if (score >= 75) {
      label = `Sharp ${score}`;
      cls = 'quality-good';
    } else if (score >= 45) {
      label = `Needs work ${score}`;
      cls = 'quality-mid';
    } else {
      label = `Vague ${score}`;
      cls = 'quality-low';
    }
  }
  return <span className={`quality-badge ${cls}`}>{label}</span>;
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="tag">{children}</span>;
}