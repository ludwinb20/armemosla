interface LoaderProps {
  label?: string;
  inline?: boolean;
  className?: string;
}

export function Loader({ label = 'Cargando…', inline = false, className }: LoaderProps) {
  return (
    <div
      className={`loader${inline ? ' loader--inline' : ''}${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="loader-spinner" aria-hidden />
      {label ? <span className="loader-label">{label}</span> : null}
    </div>
  );
}
